import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  today, fetchWithTimeout as sharedFetchWithTimeout, normaliseUrl, plainText,
  NON_PRODUCT_PATTERNS as BASE_NON_PRODUCT_PATTERNS, validProduct as sharedValidProduct,
  deriveAgeBands, matchesNonProductUrl,
} from "../../shared/scrapeShared.ts";

// ============================================================================
// Full-catalogue, resumable, batched retailer scraper.
// - Shopify: paginates /products.json (limit=250, page=N) until exhausted.
// - Non-Shopify: discovers product URLs from sitemap indexes / product sitemaps,
//   then extracts Product JSON-LD / structured data per product page. AI is only
//   a bounded per-page fallback — never asked to invent a catalogue.
// - Each invocation does one bounded batch and returns a continuation token.
// - Never deactivates or deletes products. New products are always needs_review.
// - Existing products: only last_verified + safe catalogue fields are updated;
//   Gem's curated tags, feedback, quality score and status are preserved
//   (except the existing inactive→needs_review rediscovery rule).
// - No emails: returns an admin-visible report instead.
// ============================================================================

const FETCH_TIMEOUT_MS = 12000;
const BATCH_DEADLINE_MS = 45000;      // soft wall-clock budget per invocation
const SHOPIFY_PAGES_PER_BATCH = 2;    // up to 500 Shopify products per batch
const PRODUCT_PAGES_PER_BATCH = 12;   // non-Shopify product pages per batch
const AI_FALLBACKS_PER_BATCH = 4;     // bounded per-page AI extractions per batch
const MAX_SHOPIFY_PAGES = 40;         // runaway guard (10,000 products/retailer)
const MAX_PRODUCT_URLS = 2000;        // per-retailer sitemap URL cap
const MAX_CHILD_SITEMAPS = 6;         // child sitemaps fetched per retailer
const CRAWL_LISTING_PAGES = 5;        // listing pages crawled per retailer fallback
const MAX_CRAWL_URLS = 300;           // per-retailer crawl URL cap

async function fetchWithTimeout(url, options = {}) {
  return sharedFetchWithTimeout(url, {
    redirect: "follow",
    ...options,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)", ...(options.headers || {}) },
  }, FETCH_TIMEOUT_MS);
}

// ---------- Validation rules (shared policy + extra non-product paths) ----------
const EXTRA_NON_PRODUCT_PATTERNS = [
  "/account", "/login", "/basket", "/cart", "/checkout", "/careers", "/press",
  "/terms", "/privacy", "/returns", "/delivery", "/faq", "/help", "/wishlist",
];
const NON_PRODUCT_PATTERNS = [...BASE_NON_PRODUCT_PATTERNS, ...EXTRA_NON_PRODUCT_PATTERNS];
const PRODUCT_PATH_RE = /\/(products?|item|itm|p|dp|buy)\/[^/]+/i;

// Dedupe key: host + path only, lowercased — matches records saved with/without query.
function urlKey(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function validProduct(prod) {
  return sharedValidProduct(prod, NON_PRODUCT_PATTERNS);
}

// Collapse free-string rejection reasons into a bounded, stable key set so the
// per-batch and per-retailer tallies (and ScrapeRunLog.reject_reasons_json) can
// never grow unbounded. Keep in sync with the reason strings produced in
// extractFromProductPage and the two silent reject call-sites below.
function normalizeReason(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "failed_validation" || s === "shopify_no_available_variant") return s;
  if (s.includes("out of stock")) return "out_of_stock";
  if (s.includes("no valid price")) return "no_valid_price";
  if (s.startsWith("currency")) return "currency_not_gbp";
  if (s.includes("no title")) return "no_title";
  if (s.includes("ai budget")) return "no_structured_data_ai_budget_spent";
  if (s.includes("ai found no buyable")) return "ai_no_buyable_product";
  if (s.includes("ai extraction failed")) return "ai_extraction_failed";
  return "other";
}

// ---------- Continuation token ----------
function encodeCursor(c) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(c))));
}
function decodeCursor(token) {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(token))));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// ---------- Shopify ----------
async function detectShopifyOrigin(origins) {
  for (const origin of origins) {
    try {
      const res = await fetchWithTimeout(`${origin}/products.json?limit=1`);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.products)) return origin;
    } catch {
      // not Shopify at this origin
    }
  }
  return null;
}

function mapShopifyProduct(origin, product) {
  const title = (product?.title || "").trim();
  const handle = (product?.handle || "").trim();
  if (!title || !handle) return null;
  const variant = (product.variants || []).find((item) => item.available !== false);
  if (!variant) return null; // no genuinely available variant
  const price = Number(variant.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const tags = Array.isArray(product.tags)
    ? product.tags
    : String(product.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  return {
    name: title,
    description: plainText(product.body_html).slice(0, 800),
    category: product.product_type || tags[0] || "",
    price,
    image_url: product.images?.[0]?.src || product.image?.src || "",
    product_url: `${origin}/products/${handle}`,
    search_keywords: tags,
  };
}

// ---------- Sitemap discovery (non-Shopify) ----------
function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

function acceptProductUrl(loc, fromProductSitemap) {
  const low = loc.toLowerCase();
  if (!/^https?:\/\//.test(low)) return false;
  if (matchesNonProductUrl(low, NON_PRODUCT_PATTERNS)) return false;
  if (PRODUCT_PATH_RE.test(loc)) return true;
  if (!fromProductSitemap) return false;
  // From a sitemap explicitly named "product": accept descriptive slugs.
  const last = low.replace(/\/$/, "").split("/").pop() || "";
  return /-/.test(last) && last.length >= 8;
}

// Sitemaps advertised in robots.txt — tried before the two conventional paths.
async function robotsSitemapUrls(origin) {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`);
    if (!res.ok) return [];
    const txt = await res.text();
    return [...txt.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, MAX_CHILD_SITEMAPS);
  } catch {
    return [];
  }
}

async function discoverProductUrls(origins) {
  const found = new Set();
  for (const origin of origins) {
    const sitemapUrls = [
      ...(await robotsSitemapUrls(origin)),
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
    ];
    for (const sitemapUrl of sitemapUrls) {
      let xml = "";
      try {
        const res = await fetchWithTimeout(sitemapUrl);
        if (!res.ok) continue;
        xml = await res.text();
      } catch {
        continue;
      }
      if (/<sitemapindex/i.test(xml)) {
        const children = extractLocs(xml);
        const productish = children.filter((u) => /product/i.test(u));
        const chosen = (productish.length > 0 ? productish : children).slice(0, MAX_CHILD_SITEMAPS);
        for (const child of chosen) {
          try {
            const cres = await fetchWithTimeout(child);
            if (!cres.ok) continue;
            const cxml = await cres.text();
            const fromProductSitemap = /product/i.test(child);
            for (const loc of extractLocs(cxml)) {
              if (acceptProductUrl(loc, fromProductSitemap)) found.add(normaliseUrl(loc));
            }
          } catch {
            // skip unreadable child sitemap
          }
          if (found.size >= MAX_PRODUCT_URLS) break;
        }
      } else if (/<urlset/i.test(xml)) {
        for (const loc of extractLocs(xml)) {
          if (acceptProductUrl(loc, false)) found.add(normaliseUrl(loc));
        }
      }
      if (found.size > 0) break; // one usable sitemap per origin is enough
    }
    if (found.size >= MAX_PRODUCT_URLS) break;
  }
  found.delete("");
  return [...found].sort().slice(0, MAX_PRODUCT_URLS);
}

// ---------- Bounded crawl fallback (no sitemap, not Shopify) ----------
const CRAWL_LISTING_PATHS = ["/collections", "/category", "/categories", "/shop", "/gifts", "/range"];

// Descriptive-slug heuristic, used only on pages we crawled ourselves: at least two
// path segments and a hyphenated final segment, minus the shared non-product paths.
function crawlAcceptsSlug(loc) {
  try {
    const segs = new URL(loc).pathname.split("/").filter(Boolean);
    if (segs.length < 2) return false;
    const last = segs[segs.length - 1];
    if (!(/-/.test(last) && last.length >= 8)) return false;
    const low = loc.toLowerCase();
    return !matchesNonProductUrl(low, NON_PRODUCT_PATTERNS);
  } catch {
    return false;
  }
}

async function crawlDiscoverProductUrls(retailer) {
  const seedUrls = [...new Set(
    [retailer.gift_page_url, retailer.website_url].map((u) => normaliseUrl(u)).filter(Boolean),
  )].slice(0, 2);
  const found = new Set();
  const listingUrls = [];

  const harvestPage = async (pageUrl, collectListings) => {
    let html = "";
    let host = "";
    try {
      host = new URL(pageUrl).hostname;
      const res = await fetchWithTimeout(pageUrl);
      if (!res.ok) return;
      html = (await res.text()).slice(0, 400000);
    } catch {
      return; // unreachable page — skip
    }
    const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
    for (const link of links) {
      let resolved;
      try {
        resolved = new URL(link, pageUrl);
      } catch {
        continue;
      }
      if (resolved.hostname !== host) continue;
      const loc = normaliseUrl(resolved.href);
      if (!loc) continue;
      if (acceptProductUrl(loc, false) || crawlAcceptsSlug(loc)) {
        found.add(loc);
        continue;
      }
      if (collectListings && listingUrls.length < CRAWL_LISTING_PAGES) {
        const path = resolved.pathname.toLowerCase();
        if (CRAWL_LISTING_PATHS.some((part) => path.includes(part)) && !listingUrls.includes(loc)) {
          listingUrls.push(loc);
        }
      }
    }
  };

  for (const seed of seedUrls) await harvestPage(seed, true);
  for (const listing of listingUrls.slice(0, CRAWL_LISTING_PAGES)) await harvestPage(listing, false);

  found.delete("");
  // Deterministic order: the batch cursor re-discovers and indexes by cursor.pi.
  return [...found].sort().slice(0, MAX_CRAWL_URLS);
}

// ---------- Structured data extraction (non-Shopify product pages) ----------
function findProductNode(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const node = findProductNode(item);
      if (node) return node;
    }
    return null;
  }
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Product")) return value;
  if (value["@graph"]) return findProductNode(value["@graph"]);
  return null;
}

function extractJsonLdProduct(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const node = findProductNode(JSON.parse(m[1].trim()));
      if (node) return node;
    } catch {
      // malformed block — try the next one
    }
  }
  return null;
}

function parseOffer(node) {
  let offers = node?.offers;
  if (Array.isArray(offers)) offers = offers[0];
  if (!offers || typeof offers !== "object") return { price: NaN, currency: "", outOfStock: false };
  const price = Number(offers.price ?? offers.lowPrice);
  const currency = String(offers.priceCurrency || "").toUpperCase();
  const outOfStock = /OutOfStock|Discontinued/i.test(String(offers.availability || ""));
  return { price, currency, outOfStock };
}

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

function pageCanonical(html, fallbackUrl) {
  const canonical = metaContent(html, [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
  ]);
  return normaliseUrl(canonical || fallbackUrl) || normaliseUrl(fallbackUrl);
}

function jsonLdImage(node) {
  const image = node?.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : image[0]?.url || "";
  if (image && typeof image === "object") return image.url || "";
  return "";
}

// Extract one product from one page. Structured data first; bounded AI fallback.
// Returns { prod } | { rejected: reason } | { error: message }.
async function extractFromProductPage(svc, url, aiBudget) {
  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    return { error: err.name === "AbortError" ? "timed out" : err.message, usedAI: false };
  }
  if (!res.ok) return { error: `HTTP ${res.status}`, usedAI: false };
  const html = (await res.text()).slice(0, 300000);
  const canonical = pageCanonical(html, res.url || url);

  const node = extractJsonLdProduct(html);
  if (node) {
    const { price, currency, outOfStock } = parseOffer(node);
    if (outOfStock) return { rejected: "out of stock", usedAI: false };
    if (!Number.isFinite(price) || price <= 0) return { rejected: "no valid price", usedAI: false };
    if (currency && currency !== "GBP") return { rejected: `currency ${currency}`, usedAI: false };
    const name = plainText(typeof node.name === "string" ? node.name : "");
    if (!name) return { rejected: "no title", usedAI: false };
    return {
      prod: {
        name,
        description: plainText(typeof node.description === "string" ? node.description : "").slice(0, 800),
        category: "",
        price,
        image_url: jsonLdImage(node) || metaContent(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]),
        product_url: canonical,
        search_keywords: [],
      },
      usedAI: false,
    };
  }

  // Meta-tag fallback (still code-side): og:title + product price meta tags.
  const metaPrice = Number(metaContent(html, [
    /<meta[^>]+property=["'](?:og|product):price:amount["'][^>]+content=["']([^"']+)["']/i,
  ]));
  const metaCurrency = metaContent(html, [
    /<meta[^>]+property=["'](?:og|product):price:currency["'][^>]+content=["']([^"']+)["']/i,
  ]).toUpperCase();
  const metaTitle = plainText(metaContent(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]));
  if (metaTitle && Number.isFinite(metaPrice) && metaPrice > 0 && (!metaCurrency || metaCurrency === "GBP")) {
    return {
      prod: {
        name: metaTitle,
        description: plainText(metaContent(html, [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i])).slice(0, 800),
        category: "",
        price: metaPrice,
        image_url: metaContent(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]),
        product_url: canonical,
        search_keywords: [],
      },
      usedAI: false,
    };
  }

  // Bounded AI fallback — ONE specific page only, never a whole catalogue.
  if (aiBudget <= 0) return { rejected: "no structured data (AI budget spent)", usedAI: false };
  try {
    const raw = await svc.integrations.Core.InvokeLLM({
      prompt: `This is the HTML of a single retailer product page. Extract ONLY the one product sold on this page. Return name, a short description, the GBP price as a number, and the main product image URL. If this page is not an individually buyable product with a clear GBP price, return an empty name.\n\nPAGE HTML:\n${html.slice(0, 30000)}`,
      response_json_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          image_url: { type: "string" },
        },
      },
    });
    const name = plainText(raw?.name || "");
    const price = Number(raw?.price);
    if (!name || !Number.isFinite(price) || price <= 0) return { rejected: "AI found no buyable product", usedAI: true };
    return {
      prod: {
        name,
        description: plainText(raw?.description || "").slice(0, 800),
        category: "",
        price,
        image_url: raw?.image_url || "",
        product_url: canonical,
        search_keywords: [],
      },
      usedAI: true,
    };
  } catch {
    return { rejected: "AI extraction failed", usedAI: true };
  }
}

// ---------- Upsert with preservation rules ----------
async function loadExistingMap(svc, retailerId) {
  const rows = await svc.entities.Product.filter({ retailer_id: retailerId }, "-created_date", 5000);
  const map = new Map();
  for (const row of rows) {
    for (const key of [urlKey(row.product_url), urlKey(row.affiliate_url)]) {
      if (key && !map.has(key)) map.set(key, row);
    }
  }
  return map;
}

// sourceType stamps provenance on NEW records only: "shopify_upload" for Shopify
// catalogue discovery, "curated_retailer" for sitemap/page extraction. Existing
// records are never re-stamped — historical provenance is left untouched.
function upsertProduct(prod, retailer, existingMap, pending, counts, sourceType, cursor, onReject) {
  counts.discovered++;
  if (!validProduct(prod)) {
    onReject("failed_validation"); // increments counts.rejected + both reason tallies
    return;
  }
  const url = normaliseUrl(prod.product_url);
  const key = urlKey(url);
  if (!key || pending.seenKeys.has(key)) {
    counts.skipped_duplicates++;
    return;
  }
  pending.seenKeys.add(key);

  // Image sanity at scrape time: resolve relative/protocol-relative values against the
  // product URL and drop anything that isn't a fully-qualified http(s) URL. A cleared
  // field lets enrichCatalogueBatch flag missing_image as designed.
  let img;
  try {
    img = prod.image_url ? new URL(prod.image_url, url).href : undefined;
  } catch {
    img = undefined;
  }
  if (img && !/^https?:\/\//i.test(img)) img = undefined;

  const existing = existingMap.get(key);
  if (existing) {
    // Preserve curated fields: only last_verified + safe current catalogue fields.
    const payload = { id: existing.id, last_verified: today() };
    if (Number.isFinite(prod.price) && prod.price > 0 && prod.price !== existing.price) payload.price = prod.price;
    if (!String(existing.description || "").trim() && prod.description) payload.description = prod.description;
    if (!existing.image_url && img) payload.image_url = img;
    // Existing safe rediscovery rule: inactive product found in the current
    // catalogue returns to needs_review (never auto-active), unless junk/editorial.
    if (existing.status === "inactive") {
      const flags = Array.isArray(existing.data_quality_flags) ? existing.data_quality_flags : [];
      if (!flags.includes("junk_title") && !flags.includes("editorial_not_product")) payload.status = "needs_review";
    }
    pending.updates.push(payload);
    counts.updated++;
    if (cursor) cursor.ru++;
  } else {
    pending.creates.push({
      name: prod.name,
      description: prod.description || undefined,
      category: prod.category || undefined,
      retailer_id: retailer.id,
      product_url: url,
      affiliate_url: url,
      image_url: img,
      price: prod.price,
      gender_applies_to: retailer.category || undefined,
      age_restricted: false,
      suitable_age_bands: deriveAgeBands(retailer, prod),
      interest_tags: [],
      gift_type_tags: [],
      search_keywords: Array.isArray(prod.search_keywords) ? prod.search_keywords : [],
      source_type: sourceType,
      status: "needs_review", // never active from a scrape
      added_date: today(),
      last_verified: today(),
    });
    counts.new_products++;
    if (cursor) cursor.rn++;
  }
}

async function flushPending(svc, pending) {
  for (let i = 0; i < pending.creates.length; i += 200) {
    await svc.entities.Product.bulkCreate(pending.creates.slice(i, i + 200));
  }
  for (let i = 0; i < pending.updates.length; i += 200) {
    await svc.entities.Product.bulkUpdate(pending.updates.slice(i, i + 200));
  }
  pending.creates = [];
  pending.updates = [];
}

// Per-retailer coverage stamp. A failed stamp must never kill a batch.
async function stampRetailer(svc, retailer, fields) {
  // Guard first: reading .id off an undefined retailer would throw synchronously,
  // which the trailing .catch() below cannot absorb.
  if (!retailer?.id) return;
  await svc.entities.Retailer.update(retailer.id, fields).catch(() => {});
}

// ============================================================================
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    let cursor = { rid: null, mode: null, so: "", pg: 1, pi: 0, rn: 0, ru: 0 };
    if (body.cursor) {
      const decoded = decodeCursor(body.cursor);
      if (!decoded) return Response.json({ error: "Invalid continuation token" }, { status: 400 });
      cursor = { rid: null, mode: null, so: "", pg: 1, pi: 0, rn: 0, ru: 0, ...decoded };
    }

    // ---- Optional single-retailer scope (per-retailer Scrape button, W1) ----
    // Validated BEFORE the lock — matching the invalid-cursor 400 above — so a bad
    // request never acquires and releases the ScrapeState lock.
    let target = null;
    if (body.retailer_id) {
      if (typeof body.retailer_id !== "string") {
        return Response.json({ error: "retailer_id must be a string" }, { status: 400 });
      }
      target = await svc.entities.Retailer.get(body.retailer_id).catch(() => null);
      if (!target) {
        return Response.json({ error: "Unknown retailer — refresh the Retailers tab and try again." }, { status: 400 });
      }
      if (target.active !== true) {
        return Response.json({ error: `${target.name} is inactive — activate it in the retailer form before scraping.` }, { status: 400 });
      }
      if (target.curated_only === true) {
        return Response.json({ error: `${target.name} is curated-only — its products come from Gem's curated import, not a scrape.` }, { status: 400 });
      }
      if (!normaliseUrl(target.website_url) && !normaliseUrl(target.gift_page_url)) {
        return Response.json({ error: `${target.name} has no usable Website URL or Gift Page URL — edit the retailer and add one.` }, { status: 400 });
      }
    }
    // Cursor scope guard: a continuation token minted by a per-retailer run carries
    // sr = that retailer's id; a full-run token carries no sr. A token may only
    // continue the scope that minted it. Without this, a per-retailer token fed to
    // the full path would resume MID-LIST (silently skipping every retailer before
    // it), and a full token fed to a per-retailer run would inherit another walk's
    // sub-state. The ?? null on both sides makes sr-less legacy full-run tokens
    // (every cursor saved before this change) compare equal to full-run requests.
    if (body.cursor && (cursor.sr ?? null) !== (target ? target.id : null)) {
      return Response.json({ error: "This continuation token belongs to a different scrape — press the button again to start fresh." }, { status: 400 });
    }

    // ---- Overlap guard: reuse the existing ScrapeState lock per batch ----
    // The lock is honoured only while its heartbeat is fresh. If a previous batch was
    // killed before releasing (platform timeout, crash), the heartbeat goes stale after
    // LOCK_STALE_MS and the lock is recovered automatically — only the stale is_running
    // state is cleared (by taking the lock over); the caller's saved continuation cursor
    // is untouched, so the run resumes exactly where it left off. Genuinely active
    // batches (fresh heartbeat) are still protected by the 409 below.
    const LOCK_STALE_MS = 10 * 60 * 1000;
    const states = await svc.entities.ScrapeState.list();
    let state = states[0];
    if (state?.is_running) {
      const beat = state.heartbeat_at ? Date.parse(state.heartbeat_at) : NaN;
      const lockIsFresh = Number.isFinite(beat) && Date.now() - beat < LOCK_STALE_MS;
      if (lockIsFresh) {
        return Response.json({ error: "A scrape is already running — try again shortly." }, { status: 409 });
      }
      // Stale lock (no heartbeat, or heartbeat older than the threshold): recover by
      // acquiring below. No manual release is ever needed.
    }
    if (state) {
      await svc.entities.ScrapeState.update(state.id, { is_running: true, started_at: today(), heartbeat_at: new Date().toISOString() });
    } else {
      state = await svc.entities.ScrapeState.create({ is_running: true, started_at: today(), heartbeat_at: new Date().toISOString() });
    }

    // Release always happens in the finally below — success, error, or early return.
    let releaseFields = { is_running: false };
    try {
      const started = Date.now();
      const pastDeadline = () => Date.now() - started > BATCH_DEADLINE_MS;

      // 1. Scope: only Retailer records with active exactly true. In single-retailer
      // mode the pre-validated target IS the whole scope: enabled/usable collapse to
      // [target], noSourceRetailers to [], so the skipped_no_source stamping loop
      // below runs zero iterations — do NOT add a separate single-mode guard there.
      const allRetailers = target ? [target] : await svc.entities.Retailer.list("name", 5000);
      // Exclude curated-only retailers (auto-created by the curated import purely to
      // host Gem's picks — never scraped, never stamped skipped_no_source).
      // Pre-publish the curated_only field is dropped on write, so this exclusion
      // only bites once Megan publishes the Retailer schema.
      const enabled = allRetailers.filter((r) => r.active === true && r.curated_only !== true);
      const disabledCount = allRetailers.filter((r) => r.active !== true).length;
      const usable = enabled.filter((r) => normaliseUrl(r.website_url) || normaliseUrl(r.gift_page_url));
      const noSourceRetailers = enabled.filter((x) => !usable.includes(x));
      const skippedNoSource = enabled.length - usable.length;

      // Stamp URL-less retailers once per run only (fresh, cursor-less request) —
      // re-stamping on every continuation batch would be dozens of redundant writes.
      if (!body.cursor) {
        for (const r of noSourceRetailers) {
          await stampRetailer(svc, r, {
            last_scrape_at: new Date().toISOString(),
            last_discovery_method: "none",
            last_scrape_status: "skipped_no_source",
            last_scrape_error: "No usable Website URL or Gift Page URL — edit the retailer and add one",
            last_scrape_products_found: 0,
          });
        }
      }

      const counts = {
        retailers_attempted: 0,
        discovered: 0,
        new_products: 0,
        updated: 0,
        skipped_duplicates: 0,
        rejected: 0,
        // Per-batch rejection-reason tally. Rides into the response through the
        // existing `batch: { ...counts, ... }` spread — additive, ignored by the
        // existing FullCatalogueScrapeButton totals loop, consumed by forensics.
        reject_reasons: {},
      };
      // Per-RETAILER tally lives on the continuation cursor (cursor.rr) so a
      // retailer that spans several batches accumulates a complete tally; the
      // bounded normalizeReason key set keeps the token small. Legacy tokens and
      // the cursor-reset literals omit rr — self-heal to {} at every increment.
      const noteReject = (raw) => {
        const key = normalizeReason(raw);
        counts.rejected++;
        counts.reject_reasons[key] = (counts.reject_reasons[key] || 0) + 1;
        if (!cursor.rr || typeof cursor.rr !== "object" || Array.isArray(cursor.rr)) cursor.rr = {};
        cursor.rr[key] = (cursor.rr[key] || 0) + 1;
      };
      const errors = [];
      const pending = { creates: [], updates: [], seenKeys: new Set() };
      let shopifyPagesLeft = SHOPIFY_PAGES_PER_BATCH;
      let productPagesLeft = PRODUCT_PAGES_PER_BATCH;
      let aiLeft = AI_FALLBACKS_PER_BATCH;
      const attempted = new Set();
      let currentRetailerName = null;
      // Last error message seen for the retailer currently being processed.
      let retailerError = "";

      // Resume by retailer id: array indexes shift when retailers are added, removed
      // or deactivated mid-run. On a miss, restart from the first retailer — dedupe
      // by URL key makes the re-walk safe.
      let ri = 0;
      if (cursor.rid) {
        ri = usable.findIndex((r) => r.id === cursor.rid);
        if (ri < 0) {
          ri = 0;
          errors.push("cursor retailer missing — restarting from first retailer");
          cursor = { rid: null, mode: null, so: "", pg: 1, pi: 0, rn: 0, ru: 0 };
        }
      } else if (body.cursor) {
        // A continuation token that carries no retailer id is a pre-upgrade (index-based)
        // cursor. Its per-retailer sub-state (mode/so/pg/pi) belongs to a retailer we can
        // no longer identify, so it must NOT be applied to usable[0] — that would scrape
        // one retailer's catalogue and file the products under another.
        errors.push("cursor retailer missing — restarting from first retailer");
        cursor = { rid: null, mode: null, so: "", pg: 1, pi: 0, rn: 0, ru: 0 };
      }
      cursor.rid = usable[ri]?.id ?? null;
      // Single-retailer runs mark their scope on every outgoing token. Set AFTER the
      // two restart branches above (both replace the cursor object and would drop
      // sr). advanceRetailer's cursor reset (line ~651) also drops sr — irrelevant:
      // in single mode advancing past usable[0] makes done true, and done responses
      // return cursor: null.
      if (target) cursor.sr = target.id;

      const retailerOrigins = (retailer) => {
        const origins = [];
        for (const source of [retailer.website_url, retailer.gift_page_url]) {
          try {
            const origin = new URL(source).origin;
            if (!origins.includes(origin)) origins.push(origin);
          } catch {
            // invalid URL — ignore
          }
        }
        return origins;
      };

      // Stamps the retailer just finished, then moves the cursor to the next one.
      // Always await: a fire-and-forget stamp can be cut off when the handler returns.
      const advanceRetailer = async (status, method, errorMsg) => {
        await stampRetailer(svc, usable[ri], {
          last_scrape_at: new Date().toISOString(),
          last_discovery_method: method,
          last_scrape_status: status,
          last_scrape_error: status === "ok" ? "" : (errorMsg || ""),
          last_scrape_products_found: cursor.rn + cursor.ru,
        });
        // Durable forensic record for this retailer's completed pass. Best-effort:
        // pre-publish the ScrapeRunLog entity does not exist server-side and this
        // create fails — swallowed, the run is unaffected (EXPECTED-PREPUBLISH).
        // MUST be a try/catch BLOCK, not a bare .catch(): the platform doc is
        // silent on pre-publish new-entity behaviour (recon-constraints), and a
        // bare .catch() absorbs only a rejected promise — if the SDK's accessor
        // for an unpublished entity ever throws SYNCHRONOUSLY, that exception
        // would escape to the batch handler's outer catch and 500 every batch
        // that completes a retailer. The block form swallows both shapes.
        try {
          await svc.entities.ScrapeRunLog.create({
            run_date: today(),
            scope: target ? "retailer" : "full",
            retailer_id: usable[ri]?.id || "",
            retailer_name: usable[ri]?.name || "",
            scrape_status: status,
            discovery_method: method,
            new_products: cursor.rn,
            updated: cursor.ru,
            reject_reasons_json: JSON.stringify(cursor.rr && typeof cursor.rr === "object" ? cursor.rr : {}),
            error: status === "ok" ? "" : (errorMsg || ""),
          });
        } catch { /* EXPECTED-PREPUBLISH */ }
        ri += 1;
        cursor = { rid: usable[ri]?.id ?? null, mode: null, so: "", pg: 1, pi: 0, rn: 0, ru: 0 };
        retailerError = "";
      };

      while (ri < usable.length && !pastDeadline() && (shopifyPagesLeft > 0 || productPagesLeft > 0)) {
        const retailer = usable[ri];
        currentRetailerName = retailer.name;
        if (!attempted.has(retailer.id)) {
          attempted.add(retailer.id);
          counts.retailers_attempted++;
        }

        // Detect the platform once per retailer (cached in the cursor).
        if (!cursor.mode) {
          const origins = retailerOrigins(retailer);
          const shopifyOrigin = await detectShopifyOrigin(origins);
          if (shopifyOrigin) {
            cursor.mode = "shopify";
            cursor.so = shopifyOrigin;
            cursor.pg = 1;
          } else {
            cursor.mode = "sitemap";
            cursor.pi = 0;
          }
        }

        const existingMap = await loadExistingMap(svc, retailer.id);

        if (cursor.mode === "shopify") {
          if (shopifyPagesLeft <= 0) break;
          let retailerDone = false;
          while (shopifyPagesLeft > 0 && !pastDeadline() && !retailerDone) {
            let data = null;
            try {
              const res = await fetchWithTimeout(`${cursor.so}/products.json?limit=250&page=${cursor.pg}`);
              shopifyPagesLeft--;
              if (!res.ok) {
                retailerError = `HTTP ${res.status} on catalogue page ${cursor.pg}`;
                errors.push(`${retailer.name}: ${retailerError}`);
                retailerDone = true;
                break;
              }
              data = await res.json().catch(() => null);
            } catch (err) {
              shopifyPagesLeft--;
              retailerError = `${err.name === "AbortError" ? "timed out" : err.message} on page ${cursor.pg}`;
              errors.push(`${retailer.name}: ${retailerError}`);
              retailerDone = true;
              break;
            }
            const items = Array.isArray(data?.products) ? data.products : [];
            // Repeat-page guard: some platforms echo page 1 for out-of-range pages.
            const firstId = items[0]?.id ? String(items[0].id) : "";
            if (firstId && firstId === cursor.fid) {
              retailerDone = true;
              break;
            }
            cursor.fid = firstId;
            for (const raw of items) {
              const prod = mapShopifyProduct(cursor.so, raw);
              if (!prod) {
                counts.discovered++;
                noteReject("shopify_no_available_variant");
                continue;
              }
              upsertProduct(prod, retailer, existingMap, pending, counts, "shopify_upload", cursor, noteReject);
            }
            if (items.length < 250 || cursor.pg >= MAX_SHOPIFY_PAGES) retailerDone = true;
            else cursor.pg++;
          }
          if (retailerDone) {
            await advanceRetailer(
              (cursor.rn + cursor.ru) > 0 ? "ok" : (retailerError ? "error" : "no_products"),
              "shopify",
              retailerError,
            );
          } else break; // budget/deadline mid-retailer — resume from cursor next batch
        } else {
          // Non-Shopify: sitemap discovery + per-page structured extraction.
          if (productPagesLeft <= 0) break;
          let urls;
          let discoveredVia;
          if (cursor.mode === "crawl") {
            urls = await crawlDiscoverProductUrls(retailer);
            discoveredVia = "crawl";
          } else {
            urls = await discoverProductUrls(retailerOrigins(retailer));
            discoveredVia = "sitemap";
            if (urls.length === 0) {
              urls = await crawlDiscoverProductUrls(retailer);
              discoveredVia = "crawl";
              cursor.mode = "crawl";
            }
          }
          if (urls.length === 0) {
            errors.push(`${retailer.name}: no sitemap product URLs found and crawl found no product links`);
            await advanceRetailer(
              "error",
              "none",
              "No sitemap, not Shopify, and no product links found on the gift page — site may be JS-rendered or blocking bots",
            );
            continue;
          }
          const end = Math.min(urls.length, cursor.pi + productPagesLeft);
          const slice = urls.slice(cursor.pi, end);
          productPagesLeft -= slice.length;
          // Small concurrency (4) so one slow page can't stall the batch.
          let processed = 0;
          for (let i = 0; i < slice.length && !pastDeadline(); i += 4) {
            const group = slice.slice(i, i + 4);
            const results = await Promise.all(
              group.map((u) => extractFromProductPage(svc, u, aiLeft))
            );
            for (let j = 0; j < results.length; j++) {
              const r = results[j];
              if (r.usedAI) aiLeft = Math.max(0, aiLeft - 1);
              if (r.error) {
                counts.discovered++;
                retailerError = `${group[j]} — ${r.error}`;
                errors.push(`${retailer.name}: ${retailerError}`);
              } else if (r.rejected) {
                counts.discovered++;
                noteReject(r.rejected);
              } else if (r.prod) {
                upsertProduct(r.prod, retailer, existingMap, pending, counts, "curated_retailer", cursor, noteReject);
              }
            }
            // Each group completes atomically via Promise.all, so counting completed
            // groups keeps the resume point exact when the deadline aborts mid-slice.
            processed += group.length;
          }
          cursor.pi = cursor.pi + processed;
          if (cursor.pi >= urls.length) {
            await advanceRetailer(
              (cursor.rn + cursor.ru) > 0 ? "ok" : (retailerError ? "error" : "no_products"),
              cursor.mode === "crawl" ? "crawl" : "sitemap",
              retailerError,
            );
          } else break; // budget/deadline mid-retailer — resume next batch
        }
      }

      await flushPending(svc, pending);

      const done = ri >= usable.length;
      const summary = `Catalogue batch${target ? ` (${target.name} only)` : ""}: ${counts.retailers_attempted} retailer(s) attempted, ${counts.new_products} new, ${counts.updated} updated/verified, ${counts.rejected} rejected, ${errors.length} error(s).${done ? " Run complete." : ""}`;

      releaseFields = {
        is_running: false,
        last_completed_at: today(),
        last_run_summary: summary,
      };

      return Response.json({
        done,
        cursor: done ? null : encodeCursor(cursor),
        enabled_retailers: enabled.length,
        disabled_retailers: disabledCount,
        skipped_no_source: skippedNoSource,
        skipped_no_source_names: noSourceRetailers.map((r) => r.name),
        current_retailer: done ? null : currentRetailerName,
        retailers_remaining: Math.max(0, usable.length - ri),
        batch: { ...counts, errors: errors.slice(0, 40) },
      });
    } finally {
      // Always release the lock — on success (with the summary) and on failure alike.
      await svc.entities.ScrapeState.update(state.id, releaseFields).catch(() => {});
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});