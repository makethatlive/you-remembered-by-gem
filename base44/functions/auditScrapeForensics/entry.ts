import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { validProduct as sharedValidProduct, NON_PRODUCT_PATTERNS as BASE_NON_PRODUCT_PATTERNS, normaliseUrl } from "../../shared/scrapeShared.ts";

// ============================================================================
// Read-only catalogue forensics. Buckets every Product row and grades every
// retailer's coverage, entirely from durable evidence — no network probes, no
// AI, no entity writes. Optionally snapshots the result into the
// "Scrape Forensics" spreadsheet (cleared + rewritten each run).
// Layer-C reads (Retailer stamps, curated_only, ScrapeRunLog) treat absence as
// normal: pre-publish they are simply empty and the report says so.
// ============================================================================

const SHEET_TITLE = "Scrape Forensics";
const PRODUCTS_TAB = "Products";
const COVERAGE_TAB = "Coverage";
// Same NUMERIC threshold as RetailersTab.jsx:46 isUnderfilled, but applied to
// active+needs_review here (the badge counts actives only) — deliberate: unreviewed
// scrape output is still coverage. The two surfaces can disagree; notes[] says so.
const UNDERFILLED_THRESHOLD = 10;

// Keep in sync with scrapeCatalogueBatch EXTRA_NON_PRODUCT_PATTERNS.
const EXTRA_NON_PRODUCT_PATTERNS = [
  "/account", "/login", "/basket", "/cart", "/checkout", "/careers", "/press",
  "/terms", "/privacy", "/returns", "/delivery", "/faq", "/help", "/wishlist",
];
const NON_PRODUCT_PATTERNS = [...BASE_NON_PRODUCT_PATTERNS, ...EXTRA_NON_PRODUCT_PATTERNS];

// Keep in sync with scrapeCatalogueBatch urlKey (host+path, lowercased).
function urlKey(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

// A Layer-C scrape stamp that was never written is null / undefined / "", and
// Number(null) === 0, which IS finite. A bare Number.isFinite check therefore
// reports "measured zero" for a retailer that was never measured — precisely
// the wrong answer for a coverage audit. Reject the empty shapes first and
// return null so the caller falls through to the ScrapeRunLog fallback.
function stampNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function classifyProduct(p, dupKeys) {
  const flags = Array.isArray(p.data_quality_flags) ? p.data_quality_flags : [];
  // Round-3 prime directive: rows Gem supplied by hand are never auto-condemned.
  // Curated titles/URLs legitimately trip the scraper heuristics ("Gifts for
  // Grandad Mug" matches a junk-title regex; curated /collections/ URLs match
  // NON_PRODUCT_PATTERNS) — heuristic hits on curated rows are ADVISORY and
  // route to Gem's review queue, never to correctly_rejected.
  const curated = p.source_type === "curated_product";
  const reasons = [];
  // Rule 1: the pipeline's own junk heuristics.
  if (!sharedValidProduct({ name: p.name, product_url: p.product_url }, NON_PRODUCT_PATTERNS)) reasons.push("failed_validation");
  if (flags.includes("junk_title")) reasons.push("flagged_junk_title");
  if (flags.includes("editorial_not_product")) reasons.push("flagged_editorial");
  if (reasons.length) {
    if (curated) {
      return { bucket: "needs_manual_review", reasons: ["curated_fails_scraper_heuristics", ...reasons] };
    }
    if (p.status === "active" || p.status === "needs_review") reasons.push("junk_but_not_retired");
    return { bucket: "correctly_rejected", reasons };
  }
  // Rule 2: duplicate URL within the retailer (curated dupes also go to Gem).
  if (dupKeys.has(p.id)) {
    if (curated) return { bucket: "needs_manual_review", reasons: ["curated_duplicate_url"] };
    return { bucket: "correctly_rejected", reasons: ["duplicate_url"] };
  }
  // Rule 3: retired with no recorded reason — only Gem can adjudicate.
  if (p.status === "inactive") return { bucket: "needs_manual_review", reasons: ["inactive_no_recorded_reason"] };
  // Rule 4: enrichment has not genuinely run, or it flagged gaps it could fix on a re-run.
  if (!p.catalogue_enriched_at) return { bucket: "needs_re_enrichment", reasons: ["never_enriched"] };
  const gapFlags = flags.filter((f) => f === "missing_description" || f === "missing_image");
  if (gapFlags.length) return { bucket: "needs_re_enrichment", reasons: gapFlags };
  // Rule 5: clean and waiting on a human.
  if (p.status === "needs_review") return { bucket: "needs_manual_review", reasons: ["awaiting_review"] };
  if (p.status === "reported_broken") return { bucket: "needs_manual_review", reasons: ["reported_broken"] };
  return { bucket: "healthy", reasons: [] };
}

// ---------- Sheets helpers (mirrorProductsToSheet donor pattern) ----------
async function getOrCreateSpreadsheet(accessToken) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const query = encodeURIComponent(
    `name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    { headers: authHeader }
  );
  if (!searchRes.ok) throw new Error(`Drive search failed: HTTP ${searchRes.status} ${await searchRes.text()}`);
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: PRODUCTS_TAB } }, { properties: { title: COVERAGE_TAB } }],
    }),
  });
  if (!createRes.ok) throw new Error(`Sheet create failed: HTTP ${createRes.status} ${await createRes.text()}`);
  return (await createRes.json()).spreadsheetId;
}

// Every tab — one created with the spreadsheet or one added later — gets
// Google's DEFAULT GRID of 1000 rows x 26 columns. spreadsheets.values.update
// does NOT grow that grid; it 400s as soon as the written range runs past it.
// Kate's catalogue is ~2,000 products, so the per-product tab would blow the
// 1000-row default on the first real run. Carry each tab's sheetId and current
// grid size so rewriteTab can grow before it writes.
async function fetchTabMeta(accessToken, spreadsheetId) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties)`,
    { headers: authHeader }
  );
  if (!metaRes.ok) throw new Error(`Sheet metadata failed: HTTP ${metaRes.status} ${await metaRes.text()}`);
  const byTitle = new Map();
  for (const s of ((await metaRes.json()).sheets || [])) {
    const props = s.properties || {};
    if (typeof props.title !== "string") continue;
    byTitle.set(props.title, {
      sheetId: props.sheetId,
      rowCount: Number(props.gridProperties?.rowCount) || 0,
      columnCount: Number(props.gridProperties?.columnCount) || 0,
    });
  }
  return byTitle;
}

async function ensureTabs(accessToken, spreadsheetId) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const meta = await fetchTabMeta(accessToken, spreadsheetId);
  const missing = [PRODUCTS_TAB, COVERAGE_TAB].filter((t) => !meta.has(t));
  if (missing.length === 0) return meta;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
  });
  if (!res.ok) throw new Error(`Add tab failed: HTTP ${res.status} ${await res.text()}`);
  // Re-read so the tabs just added carry a real sheetId and grid size.
  return await fetchTabMeta(accessToken, spreadsheetId);
}

// Grow the grid to fit the payload. Never shrinks: a smaller rowCount would
// delete cells, and this function is only ever allowed to make room.
async function growGridToFit(accessToken, spreadsheetId, tab, tabMeta, rows) {
  if (!tabMeta || typeof tabMeta.sheetId !== "number") return;
  const widest = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
  const rowCount = Math.max(rows.length + 50, 1000, tabMeta.rowCount);
  const columnCount = Math.max(widest, 26, tabMeta.columnCount);
  if (rowCount === tabMeta.rowCount && columnCount === tabMeta.columnCount) return;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: tabMeta.sheetId, gridProperties: { rowCount, columnCount } },
          fields: "gridProperties.rowCount,gridProperties.columnCount",
        },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Grow ${tab} failed: HTTP ${res.status} ${await res.text()}`);
  tabMeta.rowCount = rowCount;
  tabMeta.columnCount = columnCount;
}

async function rewriteTab(accessToken, spreadsheetId, tab, rows, tabMeta) {
  const authHeader = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  // Grow first — a clear+PUT against a too-small grid fails outright. Best-effort
  // in the same spirit as the rest of the sheet path: if the growth call itself
  // fails, let the PUT below report the real problem rather than losing a
  // snapshot that would have fitted anyway.
  try {
    await growGridToFit(accessToken, spreadsheetId, tab, tabMeta, rows);
  } catch (err) {
    console.warn(`auditScrapeForensics: grid growth for ${tab} failed: ${err.message}`);
  }
  // Clear the whole tab, not A1:Z — columnCount may now exceed Z.
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}:clear`,
    { method: "POST", headers: authHeader, body: "{}" }
  );
  if (!clearRes.ok) throw new Error(`Clear ${tab} failed: HTTP ${clearRes.status} ${await clearRes.text()}`);
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}!A1?valueInputOption=RAW`,
    { method: "PUT", headers: authHeader, body: JSON.stringify({ values: rows }) }
  );
  if (!writeRes.ok) throw new Error(`Write ${tab} failed: HTTP ${writeRes.status} ${await writeRes.text()}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    // Destructive: writing clears and replaces both tabs of the "Scrape
    // Forensics" spreadsheet. Opt-in, so a caller that omits the flag - or any
    // future caller that is not ForensicsAuditPanel - gets the read-only audit.
    const writeSheet = body.write_sheet === true;

    const products = await svc.entities.Product.list("-created_date", 5000);
    const retailers = await svc.entities.Retailer.list("name", 5000);
    // Layer-C entity: does not exist server-side pre-publish. Absence is normal.
    // try/catch BLOCK deliberately (same reasoning as the scraper's create):
    // it absorbs both a rejected promise and a synchronous accessor throw.
    // A resolve with a non-array (null / undefined / {}) is just as plausible a
    // shape for an unknown entity as a throw, and try/catch does NOT absorb it —
    // coerce so the later .length and for-of cannot throw outside the catch.
    let runLogs = [];
    try {
      const rawRunLogs = await svc.entities.ScrapeRunLog.list("-created_date", 5000);
      runLogs = Array.isArray(rawRunLogs) ? rawRunLogs : [];
    } catch {
      runLogs = [];
    }

    // Duplicate detection: within each retailer, every row after the first
    // (created_date order — the list is newest-first, so walk it reversed to
    // keep the OLDEST row) sharing a urlKey is a duplicate.
    const dupKeys = new Set();
    const seenPerRetailer = new Map();
    for (let i = products.length - 1; i >= 0; i--) {
      const p = products[i];
      const key = `${p.retailer_id}::${urlKey(p.product_url)}`;
      if (!urlKey(p.product_url)) continue;
      if (seenPerRetailer.has(key)) dupKeys.add(p.id);
      else seenPerRetailer.set(key, p.id);
    }

    const retailerById = new Map(retailers.map((r) => [r.id, r]));
    const buckets = { correctly_rejected: [], needs_manual_review: [], needs_re_enrichment: [], healthy: [] };
    const perRetailer = new Map(); // retailer_id -> mutable counters
    const counterFor = (rid) => {
      if (!perRetailer.has(rid)) {
        perRetailer.set(rid, {
          total: 0, active: 0, needs_review: 0, inactive: 0, reported_broken: 0,
          correctly_rejected: 0, needs_manual_review: 0, needs_re_enrichment: 0, healthy: 0,
        });
      }
      return perRetailer.get(rid);
    };

    for (const p of products) {
      const { bucket, reasons } = classifyProduct(p, dupKeys);
      buckets[bucket].push({ p, reasons });
      const c = counterFor(p.retailer_id || "unknown");
      c.total++;
      if (c[p.status] !== undefined) c[p.status]++;
      c[bucket]++;
    }

    // Latest run-log row per retailer (list is newest-first).
    const latestLog = new Map();
    for (const log of runLogs) {
      if (log.retailer_id && !latestLog.has(log.retailer_id)) latestLog.set(log.retailer_id, log);
    }

    const coverage = retailers.map((r) => {
      const c = counterFor(r.id);
      const log = latestLog.get(r.id) || null;
      const hasSource = Boolean(normaliseUrl(r.website_url) || normaliseUrl(r.gift_page_url));
      // Expected: stamp first (post-publish), else run log, else unknown.
      const stamped = stampNumber(r.last_scrape_products_found);
      const expected = stamped !== null
        ? stamped
        : (log ? (Number(log.new_products) || 0) + (Number(log.updated) || 0) : null);
      const reviewable = c.active + c.needs_review;
      const gap = expected !== null ? expected - reviewable : null;
      const stampStatus = r.last_scrape_status || log?.scrape_status || "";
      const method = r.last_discovery_method || log?.discovery_method || "";
      let verdict = "ok";
      if (r.curated_only === true) verdict = "curated_only";
      else if (r.active !== true) verdict = "inactive_retailer";
      else if (!hasSource) verdict = "no_source";
      else if (
        c.total === 0 ||
        reviewable < UNDERFILLED_THRESHOLD ||
        stampStatus === "error" || stampStatus === "no_products" ||
        method === "crawl" || method === "none" ||
        (gap !== null && gap > 0)
      ) verdict = "needs_rescrape";
      let logReasons = {};
      try { logReasons = log?.reject_reasons_json ? JSON.parse(log.reject_reasons_json) : {}; } catch { logReasons = {}; }
      return {
        retailer_id: r.id, name: r.name, active: r.active === true,
        curated_only: r.curated_only === true, has_source: hasSource,
        counts: c, expected_found: expected, coverage_gap: gap,
        last_scrape_status: stampStatus, discovery_method: method,
        last_scrape_error: r.last_scrape_error || log?.error || "",
        reject_reasons: logReasons, verdict,
      };
    });

    const totals = {
      products: products.length,
      pool_truncated: products.length === 5000,
      healthy: buckets.healthy.length,
      correctly_rejected: buckets.correctly_rejected.length,
      needs_manual_review: buckets.needs_manual_review.length,
      needs_re_enrichment: buckets.needs_re_enrichment.length,
      retailers: retailers.length,
      retailers_needing_rescrape: coverage.filter((c) => c.verdict === "needs_rescrape").length,
      retailers_no_source: coverage.filter((c) => c.verdict === "no_source").length,
      run_log_rows: runLogs.length, // 0 pre-publish — reasons unavailable for historical runs
    };

    // On-screen samples only — the sheet carries the full detail.
    const examples = {};
    for (const key of ["correctly_rejected", "needs_manual_review", "needs_re_enrichment"]) {
      examples[key] = buckets[key].slice(0, 15).map(({ p, reasons }) => ({
        id: p.id, name: p.name, retailer: retailerById.get(p.retailer_id)?.name || "—",
        status: p.status, reasons,
      }));
    }

    let sheet = null;
    if (writeSheet) {
      try {
        const { accessToken } = await svc.connectors.getConnection("googlesheets");
        const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
        const tabMeta = await ensureTabs(accessToken, spreadsheetId);
        const productRows = [[
          "product_id", "name", "retailer", "status", "source_type", "enriched",
          "data_quality_flags", "bucket", "reasons", "price", "product_url",
        ]];
        for (const key of ["correctly_rejected", "needs_manual_review", "needs_re_enrichment"]) {
          for (const { p, reasons } of buckets[key]) {
            productRows.push([
              p.id, p.name || "", retailerById.get(p.retailer_id)?.name || "",
              p.status || "", p.source_type || "", p.catalogue_enriched_at ? "yes" : "no",
              (p.data_quality_flags || []).join("|"), key, reasons.join("|"),
              p.price ?? "", p.product_url || "",
            ]);
          }
        }
        const coverageRows = [[
          "retailer", "verdict", "active", "curated_only", "has_source",
          "products_total", "active_products", "needs_review", "inactive", "reported_broken",
          "correctly_rejected", "needs_manual_review", "needs_re_enrichment",
          "expected_found", "coverage_gap", "last_scrape_status", "discovery_method",
          "reject_reasons", "last_scrape_error",
        ]];
        for (const c of coverage) {
          coverageRows.push([
            c.name, c.verdict, c.active ? "TRUE" : "FALSE", c.curated_only ? "TRUE" : "FALSE",
            c.has_source ? "TRUE" : "FALSE", c.counts.total, c.counts.active, c.counts.needs_review,
            c.counts.inactive, c.counts.reported_broken, c.counts.correctly_rejected,
            c.counts.needs_manual_review, c.counts.needs_re_enrichment,
            c.expected_found ?? "", c.coverage_gap ?? "", c.last_scrape_status, c.discovery_method,
            JSON.stringify(c.reject_reasons || {}), c.last_scrape_error,
          ]);
        }
        await rewriteTab(accessToken, spreadsheetId, PRODUCTS_TAB, productRows, tabMeta.get(PRODUCTS_TAB));
        await rewriteTab(accessToken, spreadsheetId, COVERAGE_TAB, coverageRows, tabMeta.get(COVERAGE_TAB));
        sheet = { spreadsheet_id: spreadsheetId, product_rows: productRows.length - 1, coverage_rows: coverageRows.length - 1 };
      } catch (err) {
        // The summary is still the deliverable — never lose it to a sheet hiccup.
        sheet = { error: err.message };
      }
    }

    return Response.json({
      generated_at: new Date().toISOString(),
      totals,
      coverage,
      examples,
      sheet,
      notes: [
        "Per-URL rejection reasons for runs before this package landed were never persisted and are unrecoverable; reason tallies appear only for runs made after ScrapeRunLog is live (post-publish).",
        "Retailer scrape stamps are publish-gated fields; before publish the expected/actual comparison uses product counts and heuristics only.",
        "needs_re_enrichment rows: run per-retailer Enrich for the affected retailers, then re-run this audit — rows migrate to needs_manual_review once enriched.",
        "Curated rows (source_type curated_product) are never auto-bucketed as correctly rejected: scraper-heuristic hits on them are advisory (curated_fails_scraper_heuristics / curated_duplicate_url) — verify with Gem before retiring anything she supplied.",
        "The retailer coverage grade counts active+needs_review against the threshold of 10; the Retailers tab's Underfilled badge counts actives only, so the two surfaces can legitimately disagree on retailers with many unreviewed rows.",
      ],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
