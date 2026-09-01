import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
// SheetJS, pinned. Pure JS (no WASM/eval — platform-compliant). The npm registry
// stops at 0.18.x for this package (later releases are CDN-only), so 0.18.5 is
// the pin, not a choice. Parses .xlsx AND plain .csv (BOM- and codepage-aware)
// from the same byte array. Static import: no top-level await/throw.
import * as XLSX from "npm:xlsx@0.18.5";
import {
  normaliseUrl, validProduct, deriveAgeBands, fetchWithTimeout, plainText, today, imageLoads,
} from "../../shared/scrapeShared.ts";
import { SHEET_AGE_MAP, canonicalCategory, writeAudience, normaliseAudience } from "../../shared/taxonomyShared.ts";

// Pull Gem's hand-curated products from a Google Sheet she owns, one bounded batch per
// invocation (the frontend loops on next_row). Zero AI calls, zero emails.

const AGE_BAND_ENUM = ["Under 5", "5-10", "11-17", "18+"];

// Accepted spellings per canonical column, matched after normaliseHeader (below)
// lowercases and strips "▸ optional" suffixes and parenthetical qualifiers — so
// Gem's verbatim headers ("Item Name", "Price (£)", "Age (if not general adult)
// ▸ optional", "Interest Category", "Personality Tags (optional) ▸ optional")
// all resolve. "Occasion" and "Comments" have NO canonical on purpose: Product
// has no occasion field and comments are for humans — both columns are dropped.
const HEADER_SYNONYMS = {
  name: ["name", "product name", "product", "item name", "item"],
  product_url: ["product_url", "url", "link", "product link", "product url"],
  image_url: ["image_url", "image", "image link", "image url"],
  price: ["price", "price (gbp)", "price gbp"],
  retailer_name: ["retailer_name", "retailer", "shop", "site"],
  description: ["description", "blurb"],
  category: ["category", "interest category"],
  gender_applies_to: ["gender_applies_to", "gender", "for"],
  age_bands: ["age_bands", "suitable_age_bands", "ages", "age"],
  interest_tags: ["interest_tags", "interests", "interest tags"],
  gift_type_tags: ["gift_type_tags", "gift types", "gift type tags"],
  search_keywords: ["search_keywords", "keywords", "personality tags"],
};

const REQUIRED_HEADERS = ["name", "product_url", "price", "retailer_name"];

// Soft wall-clock budget for the WHOLE invocation, mirroring scrapeCatalogueBatch's
// BATCH_DEADLINE_MS pattern (that file's :23,564 — "soft wall-clock budget per
// invocation"). Round-2 addition: the og:image recovery in (g) below is the only
// thing in this file expensive enough to need it. Once the budget is spent, the
// recovery attempt is skipped for any remaining candidate — the unconditional
// dead-link check every candidate gets keeps running regardless, so no row is ever
// dropped, only pushed to needs_review instead of active, exactly as it would be
// without recovery.
const BATCH_DEADLINE_MS = 45000;

// Header labels tolerate case, stray/trailing spaces, "▸ optional" suffixes and
// parenthetical qualifiers. Underscores are preserved so technical headers like
// "product_url" still match their own synonyms.
function normaliseHeader(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/▸\s*optional/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a canonical -> column-index map from one header row. Shared by sheet
// mode (1d) and the file parser (1f): both now produce a map containing ONLY
// the columns actually found, so downstream headerMap.has() checks are honest
// in both modes.
function buildHeaderMap(headerRow) {
  const map = new Map();
  for (let c = 0; c < headerRow.length; c++) {
    const label = normaliseHeader(headerRow[c]);
    if (!label) continue;
    for (const [canonical, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (synonyms.includes(label) && !map.has(canonical)) map.set(canonical, c);
    }
  }
  return map;
}

// SHEET_AGE_MAP now lives in ../../shared/taxonomyShared.ts (round-3 R1).

// Deterministic file-mode parser constants (round 3, replaces ExtractDataFromUploadedFile).
const MAX_FILE_BYTES = 15 * 1024 * 1024; // refuse silly uploads before parsing
const PREFERRED_SHEET = "curated product list"; // normaliseHeader()-space
const HEADER_SCAN_ROWS = 5; // tolerate banner/title rows above the real header row

// og:image extractor, copied verbatim from generateGiftList (backend functions
// cannot import from each other; scrapeShared is the only shared module and this
// stays local to avoid touching a file two other functions depend on).
function extractImageUrl(html, baseUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      try {
        return new URL(m[1], baseUrl).href; // resolve relative URLs
      } catch {
        return m[1];
      }
    }
  }
  return "";
}

// A1 ranges must single-quote the tab title, double any embedded apostrophe and be
// URI-encoded, or a tab called "Gem's Picks" 400s. Used for EVERY range this file builds.
function buildRange(tabName, a1) {
  return encodeURIComponent(`'${String(tabName).replace(/'/g, "''")}'!${a1}`);
}

async function readValues(accessToken, spreadsheetId, tabName, a1) {
  const range = buildRange(tabName, a1);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Sheet read failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.values || [];
}

function splitList(value) {
  return String(value || "").split(/[,|;]/).map((part) => part.trim()).filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    // Wall-clock budget starts here so it covers file mode's download+parse as
    // well as the verification loop's og:image recovery (g) — see BATCH_DEADLINE_MS.
    const invocationStarted = Date.now();
    const pastDeadline = () => Date.now() - invocationStarted > BATCH_DEADLINE_MS;

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // A failed auth check must always reject outright, never fall back to "allowed".
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const spreadsheetUrl = String(body.spreadsheet_url || "");
    const fileUrl = String(body.file_url || "");
    const requestedTab = body.tab_name ? String(body.tab_name) : "";
    const startRowRaw = Number(body.start_row);
    const start_row = Number.isFinite(startRowRaw) && startRowRaw > 0 ? Math.floor(startRowRaw) : 2;
    const batchRaw = Number(body.batch_size);
    const batch_size = Math.max(1, Math.min(50, Number.isFinite(batchRaw) && batchRaw > 0 ? Math.floor(batchRaw) : 40));

    // 1. Input mode — exactly one of spreadsheet_url (Google Sheet pull) or
    // file_url (uploaded xlsx/csv extracted server-side). Row acquisition is the
    // only thing that differs: all validation, mapping, dedupe, verification and
    // writes below are shared.
    if (spreadsheetUrl && fileUrl) {
      return Response.json({ error: "Provide either spreadsheet_url or file_url, not both" }, { status: 400 });
    }
    if (!spreadsheetUrl && !fileUrl) {
      return Response.json({ error: "Provide spreadsheet_url (Google Sheet) or file_url (uploaded .xlsx/.csv)" }, { status: 400 });
    }

    let headerMap;
    let rows;
    // File mode only; stays undefined (omitted from the JSON response) in sheet mode.
    let extractedRowsTotal;

    if (spreadsheetUrl) {
      // 1a. Spreadsheet id from the pasted URL.
      const idMatch = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch) {
        return Response.json({ error: "spreadsheet_url must be a Google Sheets link containing /spreadsheets/d/<id>" }, { status: 400 });
      }
      const spreadsheetId = idMatch[1];

      // 1b. Sheets connector. The `spreadsheets` scope reads any sheet Gem owns when
      // addressed by id — no Drive search (drive.file only sees app-created files,
      // which is exactly why the URL is pasted rather than searched for).
      const { accessToken } = await svc.connectors.getConnection("googlesheets");

      // 1c. Resolve the tab name when not supplied.
      let tabName = requestedTab;
      if (!tabName) {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!metaRes.ok) {
          throw new Error(`Spreadsheet lookup failed: HTTP ${metaRes.status} ${await metaRes.text()}`);
        }
        const meta = await metaRes.json();
        tabName = meta?.sheets?.[0]?.properties?.title || "";
        if (!tabName) {
          return Response.json({ error: "Could not determine a tab name for this spreadsheet" }, { status: 400 });
        }
      }

      // 1d. Header row -> column index map.
      const headerRows = await readValues(accessToken, spreadsheetId, tabName, "A1:Z1");
      const headerRow = headerRows[0] || [];
      const foundHeaders = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
      headerMap = buildHeaderMap(headerRow);
      const missing = REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
      if (missing.length > 0) {
        return Response.json({
          error: `Sheet is missing required column(s): ${missing.join(", ")}`,
          found_headers: foundHeaders,
        }, { status: 400 });
      }

      // 1e. The batch of data rows.
      rows = await readValues(
        accessToken, spreadsheetId, tabName, `A${start_row}:Z${start_row + batch_size - 1}`
      );
    } else {
      // 1f. File mode — DETERMINISTIC parse (round 3). Fetch the uploaded bytes
      // and parse with SheetJS. No AI: the same file always yields the same
      // rows, so later batches can never mis-slice against earlier ones. The
      // expected_total guard below is retained as a true invariant (it should
      // now be unreachable) and the panel's pinning loop is unchanged.
      const fileRes = await fetchWithTimeout(fileUrl, {}, 20000);
      if (!fileRes.ok) {
        return Response.json({
          error: `Could not download the uploaded file (HTTP ${fileRes.status}). Re-upload and try again.`,
        }, { status: 422 });
      }
      const fileBytes = new Uint8Array(await fileRes.arrayBuffer());
      if (fileBytes.byteLength > MAX_FILE_BYTES) {
        return Response.json({
          error: "Uploaded file is larger than 15 MB. Export just the product tab and upload that.",
        }, { status: 413 });
      }
      let workbook;
      try {
        // type:"array" auto-detects xlsx (zip signature) vs plain-text CSV, and
        // handles the UTF-8 BOM the template ships with. raw:false yields the
        // FORMATTED cell text (so "£45.00" style price cells arrive as strings
        // the existing price cleanup already strips).
        workbook = XLSX.read(fileBytes, { type: "array", raw: false });
      } catch (e) {
        return Response.json({
          error: `Could not parse the uploaded file as .xlsx or .csv (${e.message}). Download the template from this screen and paste your rows into it.`,
        }, { status: 422 });
      }

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        return Response.json({ error: "The uploaded workbook contains no sheets." }, { status: 422 });
      }

      // Grid = array-of-arrays with "" for blank cells — the exact shape sheet
      // mode gets from the Sheets API, so the shared row pipeline below runs
      // unchanged. blankrows: true is DELIBERATE (and stated explicitly even
      // though it is already SheetJS's default when header:1 is used): mid-file
      // blank rows MUST stay in allRows so processed, next_row and absolute row
      // numbers stay aligned with the spreadsheet — the row loop's existing
      // blank-row skip handles them. Trailing blank rows fall outside the
      // sheet's used range and are naturally absent. Do NOT "optimise" this to
      // blankrows: false — that silently breaks the slicing arithmetic and the
      // skipped-row report's row numbers.
      const gridFor = (name) =>
        XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true });

      // Header scan: first row among the sheet's first HEADER_SCAN_ROWS rows
      // that resolves every REQUIRED_HEADERS entry. Returns null on failure.
      const scanSheet = (name) => {
        const grid = gridFor(name);
        const limit = Math.min(grid.length, HEADER_SCAN_ROWS);
        for (let rix = 0; rix < limit; rix++) {
          const map = buildHeaderMap(grid[rix] || []);
          if (REQUIRED_HEADERS.every((h) => map.has(h))) {
            return { grid, headerRowIdx: rix, map };
          }
        }
        return null;
      };

      // Selection ladder: explicit tab_name -> sheet named "Curated Product
      // List" -> first sheet that passes the header scan.
      let picked = null;
      let pickedName = "";
      if (requestedTab) {
        const wanted = normaliseHeader(requestedTab);
        pickedName = sheetNames.find((n) => normaliseHeader(n) === wanted) || "";
        if (!pickedName) {
          return Response.json({
            error: `No sheet named "${requestedTab}" in this workbook. Sheets found: ${sheetNames.join(", ")}`,
          }, { status: 400 });
        }
        picked = scanSheet(pickedName);
        if (!picked) {
          const firstRow = (gridFor(pickedName)[0] || []).map((h) => String(h ?? "").trim()).filter(Boolean);
          return Response.json({
            error: `Sheet "${pickedName}" is missing required column(s) — need ${REQUIRED_HEADERS.join(", ")} (or their template labels).`,
            found_headers: firstRow,
          }, { status: 400 });
        }
      } else {
        const preferred = sheetNames.find((n) => normaliseHeader(n) === PREFERRED_SHEET);
        for (const name of preferred ? [preferred, ...sheetNames.filter((n) => n !== preferred)] : sheetNames) {
          picked = scanSheet(name);
          if (picked) { pickedName = name; break; }
        }
        if (!picked) {
          return Response.json({
            error: `No sheet in this workbook has the required columns (${REQUIRED_HEADERS.join(", ")}) in its first ${HEADER_SCAN_ROWS} rows. Sheets found: ${sheetNames.join(", ")}. Download the template from this screen and paste your rows into it.`,
          }, { status: 400 });
        }
      }

      headerMap = picked.map;
      const allRows = picked.grid.slice(picked.headerRowIdx + 1);
      extractedRowsTotal = allRows.length;

      // Parse-stability invariant (was the round-2 re-extraction guard). With a
      // deterministic parser this should be unreachable; if it ever fires, the
      // file bytes changed under the URL mid-import or the parser regressed.
      const expectedTotalRaw = Number(body.expected_total);
      const expectedTotal = Number.isFinite(expectedTotalRaw) && expectedTotalRaw > 0 ? Math.floor(expectedTotalRaw) : 0;
      if (expectedTotal > 0 && extractedRowsTotal !== expectedTotal) {
        return Response.json({
          error: `Re-reading the uploaded file returned ${extractedRowsTotal} data row(s) this time but ${expectedTotal} on an earlier batch of this same import. Click Start Import again to restart from the top; already-created products are detected as duplicates and will not be re-created.`,
        }, { status: 409 });
      }

      // Wrong-sheet / empty-data guard: fresh runs only, so continuation batches
      // past the end of the data return done instead of an error.
      const urlIdx = headerMap.get("product_url");
      const anyUsable = allRows.some((r) => normaliseUrl(String(r[urlIdx] ?? "").trim()));
      if (start_row <= 2 && !anyUsable) {
        return Response.json({
          error: `Sheet "${pickedName}" has the right columns but no usable product rows (every Product URL cell is blank or invalid).`,
        }, { status: 422 });
      }

      rows = allRows.slice(start_row - 2, start_row - 2 + batch_size);
    }

    // 6. Lookups, once per invocation. The 5000 limit matches every other Product.list
    // call in this codebase; the catalogue is 2,600+ and growing — if it ever passes
    // 5000 the dedup map silently truncates and duplicates become possible.
    const retailers = await svc.entities.Retailer.list("name", 5000);
    const retailerByName = new Map();
    for (const r of retailers) {
      const key = String(r.name || "").toLowerCase().trim();
      if (key && !retailerByName.has(key)) retailerByName.set(key, r);
    }

    const existingProducts = await svc.entities.Product.list("-created_date", 5000);
    const existingByUrl = new Map();
    for (const p of existingProducts) {
      // Keyed under BOTH URLs: a sheet row carrying the affiliate URL of an existing
      // product must not create a duplicate. First write wins.
      for (const raw of [p.product_url, p.affiliate_url]) {
        if (!raw) continue;
        const key = normaliseUrl(raw);
        if (key && !existingByUrl.has(key)) existingByUrl.set(key, p);
      }
    }
    const seenThisRun = new Set();

    // 7. Row validation.
    // Sheets returns ragged/short rows and [] for blank ones, so EVERY cell read goes
    // through this helper — unguarded row[i].trim() throws on the first ragged row.
    const colIdx = (header) => headerMap.get(header);
    const cell = (row, header) => String(row[colIdx(header)] ?? "").trim();

    const skipped = [];
    const candidates = [];
    const updates = []; // { id, patch } — fill-missing writes for existing URL matches
    let matched_existing = 0;
    const created_retailers = [];
    // Populated only when a cross-batch category widening (e) fails to persist —
    // round-2 addition so that failure is reported instead of silently swallowed.
    const category_conflicts_unresolved = [];
    // Round-3 R1: raw sheet values the canonical taxonomy did not recognise. Both
    // arrays are REPORTS, never filters — an unknown category is written through
    // UNCHANGED, and an unknown gender is widened to the safe audience rather than
    // guessed at. Kate reads these to extend the canon (OQ-3).
    const unknown_categories = [];
    const unknown_genders = [];

    // Pre-pass: per-retailer gender/kids profile across this batch, consumed only
    // when auto-creating a missing retailer. UNANIMITY RULE: "Men"/"Women" only
    // when EVERY row for that retailer is Male/Female. Rationale: generation
    // resolves a product's effective gender from retailer.category whenever
    // gender_applies_to normalises to "any" (generateGiftList:864-872), so a
    // guessed single-sex category would hide that retailer's Unisex products from
    // every other recipient.
    const retailerProfile = new Map();
    for (const rawRow of rows) {
      const row = rawRow || [];
      const profKey = cell(row, "retailer_name").toLowerCase().trim();
      if (!profKey) continue;
      const prof = retailerProfile.get(profKey) || { genders: new Set(), kids: false };
      const g = cell(row, "gender_applies_to").toLowerCase().trim();
      if (g) prof.genders.add(g);
      const bands = splitList(cell(row, "age_bands"))
        .flatMap((b) => SHEET_AGE_MAP[b.toLowerCase().trim()] || (AGE_BAND_ENUM.includes(b) ? [b] : []));
      if (bands.some((b) => b !== "18+")) prof.kids = true;
      retailerProfile.set(profKey, prof);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const absoluteRow = start_row + i;

      const name = cell(row, "name");
      const rawUrl = cell(row, "product_url");
      const rawPrice = cell(row, "price");
      const retailerName = cell(row, "retailer_name");

      // A wholly blank row is not an error — skip it silently, but it still counts
      // towards processed/next_row so the panel's arithmetic stays honest.
      if (!name && !rawUrl && !rawPrice && !retailerName) continue;

      if (name.length < 4) {
        skipped.push({ row: absoluteRow, name, reason: "name missing/too short" });
        continue;
      }

      const canonical = normaliseUrl(rawUrl);
      if (!canonical) {
        skipped.push({ row: absoluteRow, name, reason: "invalid URL" });
        continue;
      }
      // PF-2 (gap report B4): every row reaching this loop is Gem-supplied — sheet
      // mode and file mode are both curated input — so the NON_PRODUCT_PATTERNS URL
      // screen is ADVISORY here and is dropped entirely (empty patterns override).
      // Gem hand-picks these URLs and they legitimately sit under paths the scraper
      // heuristics reject: /pages/ (row 39, "Pocket AI Assistant", a genuine Shopify
      // product) and /collections/<x>/products/<handle> (the old Shopify carve-out,
      // now subsumed). A heuristic must never auto-condemn a row Gem chose — the same
      // curated exemption the forensics audit applies. The name/shape checks still
      // run in full (length, junk-title regexes), price is checked below, and the
      // scrapers keep the complete pattern set unchanged.
      const prod = { name, product_url: canonical };
      const shapeOk = validProduct(prod, []);
      if (!shapeOk) {
        skipped.push({
          row: absoluteRow,
          name,
          reason: `not accepted as a product — check the URL and the product name "${name}" (listing-style names such as "Gifts for Him" are rejected; rename the row and re-run)`,
        });
        continue;
      }

      const price = Number(rawPrice.replace(/[£,\s]/g, ""));
      if (!Number.isFinite(price) || price <= 0 || price > 10000) {
        skipped.push({ row: absoluteRow, name, reason: "invalid price" });
        continue;
      }

      // Auto-create unknown retailers (deliberate reversal of the round-1 rule,
      // per Kate's 2026-07-24 direction). The old mis-gendering concern is closed
      // by the unanimity rule: category is "Men"/"Women" only when every row for
      // the retailer agrees, otherwise "Unisex (Adult)" — the generation-time
      // category fallback then never mis-genders a Unisex product. curated_only
      // keeps these retailers out of the catalogue scraper; active MUST be true
      // or generation drops every product they host (generateGiftList:861).
      const retailerKey = retailerName.toLowerCase().trim();
      let retailer = retailerByName.get(retailerKey);
      if (!retailer) {
        const prof = retailerProfile.get(retailerKey) || { genders: new Set(), kids: false };
        const genders = [...prof.genders];
        const category = prof.kids ? "Unisex + Kids"
          : (genders.length === 1 && genders[0] === "male") ? "Men"
          : (genders.length === 1 && genders[0] === "female") ? "Women"
          : "Unisex (Adult)";
        let origin = "";
        try { origin = new URL(canonical).origin; } catch { origin = ""; }
        if (!origin) {
          skipped.push({ row: absoluteRow, name, reason: `could not derive a website URL for new retailer "${retailerName.trim()}"` });
          continue;
        }
        try {
          retailer = await svc.entities.Retailer.create({
            name: retailerName.trim(),
            website_url: origin,
            category,
            active: true,
            curated_only: true,
          });
        } catch (e) {
          skipped.push({ row: absoluteRow, name, reason: `retailer auto-create failed for "${retailerName.trim()}" — ${e.message}` });
          continue;
        }
        // generateGiftList silently drops every product whose retailer record is
        // missing (entry.ts:861) — trust only a create that returned a real id.
        if (!retailer?.id) {
          skipped.push({ row: absoluteRow, name, reason: `retailer auto-create returned no id for "${retailerName.trim()}"` });
          continue;
        }
        retailerByName.set(retailerKey, retailer);
        created_retailers.push({ name: retailer.name, category, website_url: origin });
      } else if (retailer.curated_only === true && (retailer.category === "Men" || retailer.category === "Women")) {
        // A later batch can disprove an earlier batch's single-sex guess (the
        // unanimity pre-pass only sees the current batch). Widen to Unisex (Adult)
        // the moment a non-matching gender appears. Widening only — never narrows,
        // never touches hand-managed (non-curated_only) retailers. Inert
        // pre-publish (curated_only is dropped on write until then). The write is
        // NOT fire-and-forget (round-2 fix): a failed correction must not be
        // treated as if it succeeded, because the whole point of this branch is
        // preventing a mis-gendered PERSISTED category from hiding this
        // retailer's Unisex products from other recipients at generation time.
        const g = cell(row, "gender_applies_to").toLowerCase().trim();
        const conflicts = (retailer.category === "Men" && g && g !== "male") ||
          (retailer.category === "Women" && g && g !== "female");
        if (conflicts) {
          try {
            await svc.entities.Retailer.update(retailer.id, { category: "Unisex (Adult)" });
            retailer = { ...retailer, category: "Unisex (Adult)" };
            retailerByName.set(retailerKey, retailer);
          } catch (e) {
            // Do NOT update the in-memory retailer/map on failure: the persisted
            // record still carries the old single-sex category, so treating this
            // row as corrected would misrepresent what's actually stored.
            category_conflicts_unresolved.push({
              retailer: retailer.name,
              stuck_category: retailer.category,
              attempted_category: "Unisex (Adult)",
              row: absoluteRow,
              error: e.message,
            });
          }
        }
      }

      if (seenThisRun.has(canonical)) {
        skipped.push({ row: absoluteRow, name, reason: "duplicate row in sheet" });
        continue;
      }
      seenThisRun.add(canonical);

      const description = plainText(cell(row, "description")).slice(0, 1000);
      const rawCategory = plainText(cell(row, "category"));
      // Canonical spelling when the sheet value (or a known alias) matches the
      // canonical taxonomy; otherwise Gem's raw value is kept UNCHANGED and
      // reported in unknown_categories — never silently rewritten or dropped.
      const category = canonicalCategory(rawCategory) || rawCategory;
      if (rawCategory && !canonicalCategory(rawCategory) && !unknown_categories.includes(rawCategory)) {
        unknown_categories.push(rawCategory);
      }
      const rawGender = cell(row, "gender_applies_to");
      const gender_applies_to = writeAudience(rawGender);
      // Mirror of unknown_categories: any non-blank Gender cell that writeAudience
      // had to coerce to "Unisex" WITHOUT recognising it (not male/female/boy/girl/
      // unisex-family wording) is reported, never silently widened-and-forgotten.
      if (String(rawGender || "").trim()
          && !["male", "female", "any"].includes(normaliseAudience(rawGender))
          && !unknown_genders.includes(rawGender)) {
        unknown_genders.push(rawGender);
      }
      const image_url = cell(row, "image_url");

      // Sheet vocabulary first ('9-11' -> two bands, 'Kids' -> all child bands);
      // raw enum values pass through. sheetBands is what Gem actually said;
      // suitable_age_bands adds the derive fallback for CREATES only — the
      // fill-missing update path below must never write derived bands onto an
      // existing record (that would stamp bands Gem never stated).
      const sheetBands = [...new Set(
        splitList(cell(row, "age_bands")).flatMap((b) =>
          SHEET_AGE_MAP[b.toLowerCase().trim()] || (AGE_BAND_ENUM.includes(b) ? [b] : [])
        )
      )];
      let suitable_age_bands = sheetBands;
      if (suitable_age_bands.length === 0) {
        suitable_age_bands = deriveAgeBands(retailer, { name, description, category, product_url: canonical });
      }

      const interest_tags = splitList(cell(row, "interest_tags")).slice(0, 15);
      // Seed the Interest Category as an interest tag; round-3 R1 canonicalises
      // it first (an unrecognised value passes through verbatim). Generation
      // compares tags via normText, which strips case and punctuation, so the
      // canonical spelling still exact-matches the onboarding interest for the
      // +18 score — and for onboarding interests with no keyword rules the exact
      // tag is the only realistic match path.
      if (interest_tags.length === 0 && category) interest_tags.push(category);
      const search_keywords = splitList(cell(row, "search_keywords")).slice(0, 15);
      const gift_type_tags = splitList(cell(row, "gift_type_tags")).slice(0, 15);

      const match = existingByUrl.get(canonical);
      if (match) {
        // FILL-MISSING upsert (round 3). Writes are gated on the existing field
        // being EMPTY, so overwriting Gem-curated (or any other) data is
        // structurally impossible. price/status/notes/name/last_verified/
        // retailer_id/affiliate_url and every enrichment stamp are never
        // touched here. source_type is stamped only when it actually differs,
        // so re-running an already-imported sheet performs zero writes.
        const isEmpty = (v) =>
          v == null ||
          (typeof v === "string" && v.trim() === "") ||
          (Array.isArray(v) && v.length === 0);
        const patch = {};
        if (match.source_type !== "curated_product") patch.source_type = "curated_product";
        if (description && isEmpty(match.description)) patch.description = description;
        if (image_url && isEmpty(match.image_url)) patch.image_url = image_url;
        if (category && isEmpty(match.category)) patch.category = category;
        if (gender_applies_to && isEmpty(match.gender_applies_to)) patch.gender_applies_to = gender_applies_to;
        if (sheetBands.length > 0 && isEmpty(match.suitable_age_bands)) patch.suitable_age_bands = sheetBands;
        if (interest_tags.length > 0 && isEmpty(match.interest_tags)) patch.interest_tags = interest_tags;
        if (gift_type_tags.length > 0 && isEmpty(match.gift_type_tags)) patch.gift_type_tags = gift_type_tags;
        if (search_keywords.length > 0 && isEmpty(match.search_keywords)) patch.search_keywords = search_keywords;
        matched_existing++;
        if (Object.keys(patch).length > 0) updates.push({ id: match.id, patch });
        continue;
      }

      candidates.push({
        row: absoluteRow,
        name,
        retailer,
        canonical,
        price,
        image_url,
        description,
        category,
        gender_applies_to,
        suitable_age_bands,
        interest_tags,
        gift_type_tags,
        search_keywords,
      });
    }

    // 8. Verification — CREATES ONLY. Updates and skips are never fetched.
    const verified = [];
    for (let i = 0; i < candidates.length; i += 5) {
      const slice = candidates.slice(i, i + 5);
      const results = await Promise.all(slice.map(async (c) => {
        let dead = false;
        let statusCode = 0;
        try {
          const res = await fetchWithTimeout(c.canonical, {}, 8000);
          statusCode = res.status;
          // Only a definitive gone/not-found rejects. Network errors and
          // 401/403/405/429/5xx are passable: validProduct already vetted the shape and
          // generateGiftList fully re-verifies every pick at generation time.
          if (res.status === 404 || res.status === 410) dead = true;
          // Gem's sheet has no image column: recover og:image from the page we
          // already fetched (code-side, zero AI) so image-verified rows can go
          // active. Rows arriving WITH an image_url keep the old behaviour
          // untouched. Body read is raced against a timer because the fetch
          // timeout only covers headers. Gated on !pastDeadline() (round-2 fix):
          // this recovery is the ONLY new network cost W3.3(g) adds, so once the
          // invocation's soft budget (BATCH_DEADLINE_MS) is spent, remaining
          // candidates skip straight to the pre-W3.3(g) fast path instead of
          // attempting recovery — they still get the unconditional dead-link
          // check above and land needs_review instead of active, same as any
          // other row whose image can't be confirmed. No row is ever dropped.
          if (!dead && res.ok && !c.image_url && !pastDeadline()) {
            const html = String(await Promise.race([
              res.text(),
              new Promise((resolve) => setTimeout(() => resolve(""), 6000)),
            ]).catch(() => "")).slice(0, 200000);
            const img = html ? extractImageUrl(html, c.canonical) : "";
            if (img) c.image_url = img;
          }
        } catch {
          dead = false;
        }
        const imageOk = !dead && !!c.image_url && await imageLoads(c.image_url);
        return { candidate: c, dead, statusCode, imageOk };
      }));
      for (const r of results) verified.push(r);
    }

    // 9. Status decision. Gem personally picked these, so they go live — the only gate
    // is the house no-broken-image rule.
    const creates = [];
    let created_active = 0;
    let created_needs_review = 0;
    for (const { candidate: c, dead, statusCode, imageOk } of verified) {
      if (dead) {
        skipped.push({ row: c.row, name: c.name, reason: `dead link (HTTP ${statusCode})` });
        continue;
      }
      const status = imageOk ? "active" : "needs_review";
      if (status === "active") created_active++;
      else created_needs_review++;
      creates.push({
        name: c.name,
        retailer_id: c.retailer.id,
        product_url: c.canonical,
        affiliate_url: c.canonical,
        image_url: c.image_url || "",
        price: c.price,
        description: c.description,
        category: c.category,
        gender_applies_to: c.gender_applies_to,
        suitable_age_bands: c.suitable_age_bands,
        interest_tags: c.interest_tags,
        gift_type_tags: c.gift_type_tags,
        search_keywords: c.search_keywords,
        source_type: "curated_product",
        status,
        added_date: today(),
        last_verified: status === "active" ? today() : undefined,
        notes: "Imported from Gem curated sheet",
      });
    }

    for (let i = 0; i < creates.length; i += 200) {
      await svc.entities.Product.bulkCreate(creates.slice(i, i + 200));
    }
    let fields_filled = 0;
    for (const u of updates) {
      await svc.entities.Product.update(u.id, u.patch);
      fields_filled += Object.keys(u.patch).filter((k) => k !== "source_type").length;
    }

    skipped.sort((a, b) => a.row - b.row);

    // 10. processed counts EVERY row fetched this invocation (including skipped and
    // blank ones) so the panel's counter and next_row arithmetic agree.
    return Response.json({
      processed: rows.length,
      created_active,
      created_needs_review,
      matched_existing,
      updated_existing: updates.length,
      fields_filled,
      created_retailers,
      category_conflicts_unresolved,
      unknown_categories,
      unknown_genders,
      extracted_total: extractedRowsTotal,
      skipped,
      next_row: start_row + rows.length,
      done: rows.length < batch_size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
