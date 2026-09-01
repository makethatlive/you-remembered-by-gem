// Shared catalogue-scraping helpers used by scrapeRetailerProducts and
// scrapeCatalogueBatch. Plain module — no Deno.serve.

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// "/news" is deliberately a REGEX, not a plain substring: as a substring it also
// matched genuine product slugs such as
// wonderbly.com/uk/personalized-products/newspaper-football-soccer-book (gap report
// B4, row 4 of Kate's sheet). It now matches only as a COMPLETE path segment --
// "/news/" mid-path, or "/news" at the end of the path (or before a query/fragment).
// Every other token is unchanged: they either end in "/" or are deliberately
// substring-matched ("gift-card" must also catch "gift-cards"). Entries may
// therefore be strings OR regexes -- always match them with matchesNonProductUrl()
// below, never with a bare String.includes() (which throws on a regex argument).
export const NON_PRODUCT_PATTERNS = [
  "/blog", "/journal", /\/news(?:\/|[?#]|$)/, "/guide", "/article", "/search", "/collections/",
  "/pages/", "/about", "/contact", "/reviews", "gift-card", "gift-cards",
  // Editorial / gift-guide pages
  "/editorial", "/magazine", "/stories", "gift-guide", "gift-guides", "/inspiration", "/lookbook",
  // Category / listing / tag pages
  "/category/", "/categories/", "/collection/", "/tag/", "/tags/", "/tagged/", "/listing",
  // Landing pages ("gifts under £10", "gifts for him", etc.)
  "/gifts-under-", "/gifts-for-him", "/gifts-for-her", "/gifts-by-", "/landing",
];

// Titles that are clearly category/listing/landing names, not individual products.
// Anchored deliberately: a genuine product like "Gift Set for Him — Whisky Stones"
// or a £7 product must NOT be rejected; low price alone is never a rejection reason.
export const NON_PRODUCT_TITLE_PATTERNS = [
  /^gifts?\s+(under|over|for|by|from)\b/i,            // "Gifts under £10", "Gifts for Him"
  /\bgift guide\b/i,                                   // any gift-guide title
  /^(all|shop|browse|explore|discover)\s+(gifts?|products?|collections?|.{0,20}collection)$/i,
  /^(new in|new arrivals|best\s?sellers?|sale|clearance|collections?|categories|shop all|view all)$/i,
  /^(men|women|kids|children|him|her|home(ware)?|accessories|jewellery|jewelry|gifting|gifts?)$/i,
];

export const CHILD_PATTERNS = [
  /\b(baby|babies|toddler|infant|newborn|nursery|for kids?|children'?s|childrens)\b/i,
  /\b(0\s*[-–]\s*3|0\s*[-–]\s*4|1\s*[-–]\s*2|3\s*[-–]\s*4|5\s*[-–]\s*6|7\s*[-–]\s*8|8\s*[-–]\s*12|9\s*[-–]\s*11)\s*(yrs?|years?)\b/i,
];

export function normaliseUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["variant", "ref", "source", "srsltid"].includes(key)) url.searchParams.delete(key);
    }
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

// Single entry point for the non-product URL screen. Handles string tokens
// (substring match) and regex tokens (segment-anchored match) alike, so callers
// must never fall back to `patterns.some((part) => low.includes(part))`. Passing an
// empty patterns array disables the screen entirely -- that is how curated input
// (importCuratedProducts) opts out of URL heuristics.
export function matchesNonProductUrl(url, patterns = NON_PRODUCT_PATTERNS) {
  const low = (url || "").toLowerCase();
  return patterns.some((part) => (typeof part === "string" ? low.includes(part) : part.test(low)));
}

export function validProduct(prod, patterns = NON_PRODUCT_PATTERNS) {
  const name = (prod?.name || "").trim();
  const url = normaliseUrl(prod?.product_url);
  if (!name || name.length < 4 || !url) return false;
  if (matchesNonProductUrl(url, patterns)) return false;
  if (/^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(name)) return false;
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(name)) return false;
  // Category/listing/landing titles are never individual products. Price is
  // deliberately not checked here — a genuine product under £10 must pass.
  if (NON_PRODUCT_TITLE_PATTERNS.some((pattern) => pattern.test(name))) return false;
  return true;
}

// Retailers whose products are always 18+ regardless of category.
export const ALWAYS_ADULT_RETAILERS = ["the whisky exchange", "hedonism", "beer52"];

// Keywords that force a product to ["18+"] only.
export const ADULT_KEYWORDS = [
  "alcohol", "spirit", "spirits", "whisky", "whiskey", "wine", "beer", "gin",
  "vodka", "rum", "champagne", "prosecco", "liqueur", "brandy", "cognac",
  "shaving", "shave", "razor", "grooming", "beard",
  "spa", "experience day", "adult experience",
  "perfume", "cologne", "fragrance", "eau de parfum", "eau de toilette",
  "leather wallet", "leather bag", "leather holdall", "leather briefcase",
];

// Decide suitable_age_bands in code (not AI). Always returns a non-empty array.
export function deriveAgeBands(retailer, prod) {
  const retailerName = (retailer.name || "").toLowerCase();
  const category = retailer.category || "";
  const text = `${prod?.name || ""} ${prod?.description || ""} ${prod?.category || ""} ${prod?.product_url || ""} ${retailerName}`.toLowerCase();

  const isAdultProduct =
    ALWAYS_ADULT_RETAILERS.includes(retailerName) ||
    ADULT_KEYWORDS.some((kw) => text.includes(kw));

  if (isAdultProduct) return ["18+"];

  if (/\b(baby|newborn|infant|toddler|nursery)\b/i.test(text)) return ["Under 5"];
  if (/\b(1\s*[-–]\s*2|3\s*[-–]\s*4)\s*(yrs?|years?)\b/i.test(text)) return ["Under 5"];
  if (/\b(5\s*[-–]\s*6|7\s*[-–]\s*8)\s*(yrs?|years?)\b/i.test(text)) return ["5-10"];
  if (/\b(8\s*[-–]\s*12|9\s*[-–]\s*11)\s*(yrs?|years?)\b/i.test(text)) return ["5-10", "11-17"];
  if (CHILD_PATTERNS.some((pattern) => pattern.test(text))) return ["Under 5", "5-10", "11-17"];

  if (category === "Kids" || category === "Unisex + Kids") {
    return ["Under 5", "5-10", "11-17", "18+"];
  }

  return ["11-17", "18+"];
}

export function plainText(value) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

// Confirm an image URL actually loads (HEAD, then a light GET) and is an image.
// A saved-but-dead URL is exactly what produces the browser's broken-image icon, so
// we never trust image_url without this check.
export async function imageLoads(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GiftVerifier/1.0)" },
    });
    // Some servers reject HEAD — fall back to a GET.
    if (!res.ok || res.status === 405) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GiftVerifier/1.0)" },
      });
    }
    if (!res.ok) return false;
    // Must be a real, served image. An empty/HTML content-type means the URL is dead
    // or points at a page (the classic broken-image icon), so we reject it outright —
    // no exceptions. This is what guarantees every saved image actually displays.
    const type = (res.headers.get("content-type") || "").toLowerCase();
    return type.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}