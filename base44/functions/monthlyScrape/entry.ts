import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchWithTimeout } from "../../shared/scrapeShared.ts";

// Per-request availability-check timeout (8s), so one hanging host cannot stall the run.
const AVAILABILITY_TIMEOUT_MS = 8000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function catalogueCorrection(product) {
  const text = `${product.name || ""} ${product.description || ""} ${product.category || ""} ${product.product_url || ""}`;
  const url = (product.product_url || "").toLowerCase();
  const name = (product.name || "").trim();
  if (!name || /^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(name)) return { status: "inactive" };
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(name)) return { status: "inactive" };
  if (["/blog", "/journal", "/news", "/guide", "/article", "/search"].some((part) => url.includes(part))) return { status: "inactive" };
  if (/\b(baby|newborn|infant|toddler|nursery)\b/i.test(text)) return { suitable_age_bands: ["Under 5"] };
  if (/\b(5\s*[-–]\s*6|7\s*[-–]\s*8)\s*(yrs?|years?)\b/i.test(text)) return { suitable_age_bands: ["5-10"] };
  if (/\b(8\s*[-–]\s*12|9\s*[-–]\s*11)\s*(yrs?|years?)\b/i.test(text)) return { suitable_age_bands: ["5-10", "11-17"] };
  if (/\b(for kids?|children'?s|childrens)\b/i.test(text)) return { suitable_age_bands: ["Under 5", "5-10", "11-17"] };
  return {};
}

async function checkAvailability(url) {
  try {
    let response = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, AVAILABILITY_TIMEOUT_MS);
    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(url, {
        method: "GET",
        redirect: "follow",
        headers: { Range: "bytes=0-2048", "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" },
      }, AVAILABILITY_TIMEOUT_MS);
    }
    if (response.ok) return "available";
    if (response.status === 404 || response.status === 410) return "gone";
    return "unknown";
  } catch {
    return "unknown";
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Auth: scheduled automations run with a valid authenticated (admin) context,
    // so a failed auth check must always reject outright — never fall back to "allowed",
    // which would let an anonymous request trigger this resource-intensive job.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // --- Double-run guard ---
    // The lock is honoured only while its heartbeat is fresh. If a previous run was killed
    // before releasing (platform timeout, crash), the heartbeat goes stale after
    // LOCK_STALE_MS and the lock is recovered automatically. Genuinely active runs (fresh
    // heartbeat) are still protected by the early return below.
    const LOCK_STALE_MS = 10 * 60 * 1000;
    const states = await svc.entities.ScrapeState.list();
    let state = states[0];
    let staleLockRecovered = false;
    if (state?.is_running) {
      const beat = state.heartbeat_at ? Date.parse(state.heartbeat_at) : NaN;
      const lockIsFresh = Number.isFinite(beat) && Date.now() - beat < LOCK_STALE_MS;
      if (lockIsFresh) {
        return Response.json({ message: "Scrape already running — check back shortly." }, { status: 200 });
      }
      // Stale lock (no heartbeat, or heartbeat older than the threshold): recover by
      // acquiring below. No manual release is ever needed.
      staleLockRecovered = true;
    }
    if (state) {
      await svc.entities.ScrapeState.update(state.id, { is_running: true, started_at: today(), heartbeat_at: new Date().toISOString() });
    } else {
      state = await svc.entities.ScrapeState.create({ is_running: true, started_at: today(), heartbeat_at: new Date().toISOString() });
    }

    // Refresh the lock heartbeat. A failed write must never abort the run — without a
    // periodic refresh scrapeCatalogueBatch would judge this live run stale and steal
    // the lock mid-run.
    const touchHeartbeat = async () => {
      try {
        await svc.entities.ScrapeState.update(state.id, { heartbeat_at: new Date().toISOString() });
      } catch {
        // Heartbeat writes are best-effort.
      }
    };

    let checkedCount = 0;
    let inactiveCount = 0;
    let newProductsCount = 0;

    try {
      // ================= Phase A — Availability check =================
      const activeProducts = await svc.entities.Product.filter({ status: "active" }, "-created_date", 5000);
      const reviewProducts = await svc.entities.Product.filter({ status: "needs_review" }, "-created_date", 5000);
      const toCheck = [...activeProducts, ...reviewProducts];
      const seenUrls = new Set();

      for (const product of toCheck) {
        if (!product.product_url) continue;
        checkedCount++;
        if (checkedCount % 25 === 0) await touchHeartbeat();
        const urlKey = normUrl(product.product_url);
        if (urlKey && seenUrls.has(urlKey)) {
          inactiveCount++;
          await svc.entities.Product.update(product.id, { status: "inactive", last_checked: today() });
          continue;
        }
        if (urlKey) seenUrls.add(urlKey);

        const correction = catalogueCorrection(product);
        if (correction.status === "inactive") {
          inactiveCount++;
          await svc.entities.Product.update(product.id, { ...correction, last_checked: today() });
          continue;
        }

        const availability = await checkAvailability(product.product_url);
        if (availability === "available") {
          await svc.entities.Product.update(product.id, { ...correction, last_checked: today(), last_verified: today() });
        } else if (availability === "gone") {
          inactiveCount++;
          await svc.entities.Product.update(product.id, { ...correction, status: "inactive", last_checked: today() });
        } else if (Object.keys(correction).length > 0) {
          // A timeout, 403 or rate limit is not proof that the product disappeared.
          await svc.entities.Product.update(product.id, correction);
        }
      }
      console.log(`Phase A: checked ${checkedCount} products, flagged ${inactiveCount} inactive.`);

      // ================= Phase B — Fresh scrape =================
      // Keep one canonical importer. The old monthly job implemented a second, looser
      // scraper that admitted blog posts, UI labels, duplicates and untagged products.
      await touchHeartbeat();
      const scrapeResult = await base44.functions.invoke("scrapeRetailerProducts", {});
      const scrapeData = scrapeResult?.data || scrapeResult || {};
      if (scrapeData.error) throw new Error(scrapeData.error);
      newProductsCount = Number(scrapeData.new_products || 0);

      // Enrich one bounded batch each month so legacy records steadily gain real
      // descriptions and recommendation tags without making the scheduled job unbounded.
      let enrichedCount = 0;
      try {
        // R3 (R4-enrich): scheduled runs never classify. AI classification runs
        // only from deliberate admin button presses / console (Kate's "don't use
        // credits" rule). classify:false sets candidates = [] in v2, so there is no
        // probe, no InvokeLLM call and no extra SDK cost, pre- or post-publish.
        const enrichmentResult = await base44.functions.invoke("enrichCatalogueBatch", { batch_size: 25, classify: false });
        enrichedCount = Number(enrichmentResult?.data?.processed || 0);
      } catch {
        // Enrichment can be resumed from the Products screen and never invalidates scrape results.
      }

      // ================= Phase C — Notify Gem =================
      const appUrl = (req.headers.get("origin") || "").replace(/\/$/, "");
      const productsLink = appUrl ? `${appUrl}/?tab=products` : "the Products tab in your dashboard";
      const summary = `Scrape complete. ${checkedCount} products checked for availability, ${inactiveCount} flagged as inactive. ${newProductsCount} new products added for your review. ${enrichedCount} catalogue records enriched.`;

      await svc.entities.ScrapeState.update(state.id, {
        is_running: false,
        last_completed_at: today(),
        last_run_summary: summary,
      });

      return Response.json({
        message: staleLockRecovered
          ? `Recovered a stale scrape lock and started a fresh run. ${summary}`
          : summary,
        checkedCount,
        inactiveCount,
        newProductsCount,
        enrichedCount,
      });
    } catch (err) {
      // Always release the lock on failure
      await svc.entities.ScrapeState.update(state.id, { is_running: false });
      throw err;
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
