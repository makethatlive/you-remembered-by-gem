import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchWithTimeout, today } from "../../shared/scrapeShared.ts";

// Bounded, client-driven availability sweep. Replaces the legacy monthlyScrape
// Phase A pass: the caller walks the catalogue one small batch at a time using the
// returned cursor, so no single invocation can run long enough to need a lock.
// Per-request availability-check timeout (8s), so one hanging host cannot stall a batch.
const AVAILABILITY_TIMEOUT_MS = 8000;

const DEFAULT_BATCH_SIZE = 25;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 50;

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
    const svc = base44.asServiceRole;

    // Only an authenticated admin may trigger the sweep — a failed auth check always
    // rejects outright; it never falls back to an "allowed" state.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const rawCursor = Number(body?.cursor);
    const cursor = Number.isFinite(rawCursor) && rawCursor > 0 ? Math.floor(rawCursor) : 0;

    const rawBatchSize = Number(body?.batch_size);
    const batchSize = Number.isFinite(rawBatchSize)
      ? Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, Math.floor(rawBatchSize)))
      : DEFAULT_BATCH_SIZE;

    const activeProducts = await svc.entities.Product.filter({ status: "active" }, "-created_date", 5000);
    const reviewProducts = await svc.entities.Product.filter({ status: "needs_review" }, "-created_date", 5000);
    const toCheck = [...activeProducts, ...reviewProducts];
    const slice = toCheck.slice(cursor, cursor + batchSize);

    const seenUrls = new Set();

    // Cursor stability: the working set above is exactly {active, needs_review}, and the
    // only status this function ever writes is "inactive" — so every product it retires
    // drops out of the next invocation's query, at an index BELOW the cursor (it was
    // already processed). Advancing by slice.length would therefore overshoot by the
    // number retired and silently skip that many rows. Counting the retirements and
    // subtracting them keeps the cursor pointing at the same product it would have
    // pointed at if nothing had been removed.
    let retired = 0;

    for (const product of slice) {
      if (!product.product_url) continue;
      const urlKey = normUrl(product.product_url);
      if (urlKey && seenUrls.has(urlKey)) {
        await svc.entities.Product.update(product.id, { status: "inactive", last_checked: today() });
        retired += 1;
        continue;
      }
      if (urlKey) seenUrls.add(urlKey);

      const correction = catalogueCorrection(product);
      if (correction.status === "inactive") {
        await svc.entities.Product.update(product.id, { ...correction, last_checked: today() });
        retired += 1;
        continue;
      }

      const availability = await checkAvailability(product.product_url);
      if (availability === "available") {
        await svc.entities.Product.update(product.id, { ...correction, last_checked: today(), last_verified: today() });
      } else if (availability === "gone") {
        await svc.entities.Product.update(product.id, { ...correction, status: "inactive", last_checked: today() });
        retired += 1;
      } else if (Object.keys(correction).length > 0) {
        // A timeout, 403 or rate limit is not proof that the product disappeared.
        await svc.entities.Product.update(product.id, correction);
      }
    }

    return Response.json({
      processed: slice.length,
      next_cursor: cursor + slice.length - retired,
      done: slice.length < batchSize,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
