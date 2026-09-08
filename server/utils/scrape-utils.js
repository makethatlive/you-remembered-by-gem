/**
 * Shared catalogue-scraping helpers
 * Ported from base44/shared/scrapeShared.ts for standalone Express operation
 */

/**
 * Get current date in ISO format (YYYY-MM-DD)
 * @returns {string}
 */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch with timeout and User-Agent header
 * @param {string} url
 * @param {object} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GiftBot/1.0)',
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Non-product URL patterns to reject during scraping
 * Mix of strings (substring match) and RegExp (segment-anchored match)
 */
export const NON_PRODUCT_PATTERNS = [
  "/blog", "/journal", /\/news(?:\/|[?#]|$)/, "/guide", "/article", "/search", "/collections/",
  "/pages/", "/about", "/contact", "/reviews", "gift-card", "gift-cards",
  // Editorial / gift-guide pages
  "/editorial", "/magazine", "/stories", "gift-guide", "gift-guides", "/inspiration", "/lookbook",
  // Category / listing / tag pages
  "/category/", "/categories/", "/collection/", "/tag/", "/tags/", "/tagged/", "/listing",
  // Landing pages ("gifts under £10", "gifts for him", etc.)
  "/gifts-under-", "/gifts-for-him", "/gifts-for-her", "/gifts-by-", "/landing",
  // Extra patterns from Base44
  "/account", "/login", "/basket", "/cart", "/checkout", "/careers", "/press",
  "/terms", "/privacy", "/returns", "/delivery", "/faq", "/help", "/wishlist",
];

/**
 * Title patterns that indicate category/listing pages, not products
 */
export const NON_PRODUCT_TITLE_PATTERNS = [
  /^gifts?\s+(under|over|for|by|from)\b/i,
  /\bgift guide\b/i,
  /^(all|shop|browse|explore|discover)\s+(gifts?|products?|collections?|.{0,20}collection)$/i,
  /^(new in|new arrivals|best\s?sellers?|sale|clearance|collections?|categories|shop all|view all)$/i,
  /^(men|women|kids|children|him|her|home(ware)?|accessories|jewellery|jewelry|gifting|gifts?)$/i,
];

/**
 * Patterns indicating child-targeted products
 */
export const CHILD_PATTERNS = [
  /\b(baby|babies|toddler|infant|newborn|nursery|for kids?|children'?s|childrens)\b/i,
  /\b(0\s*[-–]\s*3|0\s*[-–]\s*4|1\s*[-–]\s*2|3\s*[-–]\s*4|5\s*[-–]\s*6|7\s*[-–]\s*8|8\s*[-–]\s*12|9\s*[-–]\s*11)\s*(yrs?|years?)\b/i,
];

/**
 * Retailers whose products are always 18+ regardless of category
 */
export const ALWAYS_ADULT_RETAILERS = ["the whisky exchange", "hedonism", "beer52"];

/**
 * Keywords that force a product to ["18+"] only
 */
export const ADULT_KEYWORDS = [
  "alcohol", "spirit", "spirits", "whisky", "whiskey", "wine", "beer", "gin",
  "vodka", "rum", "champagne", "prosecco", "liqueur", "brandy", "cognac",
  "shaving", "shave", "razor", "grooming", "beard",
  "spa", "experience day", "adult experience",
  "perfume", "cologne", "fragrance", "eau de parfum", "eau de toilette",
  "leather wallet", "leather bag", "leather holdall", "leather briefcase",
];

/**
 * Normalize URL: remove query params (utm_*, variant, ref, etc.), hash, trailing slash
 * @param {string} value
 * @returns {string}
 */
export function normaliseUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["variant", "ref", "source", "srsltid"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/**
 * Generate URL deduplication key: hostname + pathname, lowercased, no trailing slash
 * @param {string} url
 * @returns {string}
 */
export function urlKey(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.toLowerCase()}${pathname.toLowerCase()}`;
  } catch {
    return "";
  }
}

/**
 * Check if URL matches non-product patterns (substring or regex)
 * @param {string} url
 * @param {Array<string|RegExp>} patterns
 * @returns {boolean}
 */
export function matchesNonProductUrl(url, patterns = NON_PRODUCT_PATTERNS) {
  const low = (url || "").toLowerCase();
  return patterns.some((part) => (typeof part === "string" ? low.includes(part) : part.test(low)));
}

/**
 * Validate product: name, URL, and rejection patterns
 * @param {object} prod - Product object with name, product_url
 * @param {Array<string|RegExp>} patterns - Optional custom rejection patterns
 * @returns {boolean}
 */
export function validProduct(prod, patterns = NON_PRODUCT_PATTERNS) {
  const name = (prod?.name || "").trim();
  const url = normaliseUrl(prod?.product_url);
  if (!name || name.length < 4 || !url) return false;
  if (matchesNonProductUrl(url, patterns)) return false;
  if (/^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(name)) return false;
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(name)) return false;
  if (NON_PRODUCT_TITLE_PATTERNS.some((pattern) => pattern.test(name))) return false;
  return true;
}

/**
 * Derive suitable_age_bands from retailer and product data (code-side, no AI)
 * Always returns a non-empty array
 * @param {object} retailer - Retailer object with name, category
 * @param {object} prod - Product object with name, description, category, product_url
 * @returns {string[]}
 */
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

/**
 * Strip HTML tags and normalize whitespace from text
 * @param {string} value
 * @returns {string}
 */
export function plainText(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if an image URL actually loads and is an image (HEAD, then GET fallback)
 * @param {string} url
 * @returns {Promise<boolean>}
 */
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
    // Must be a real image content-type
    const type = (res.headers.get("content-type") || "").toLowerCase();
    return type.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve relative or protocol-relative URLs against a base URL
 * @param {string} imageUrl
 * @param {string} baseUrl
 * @returns {string}
 */
export function resolveImageUrl(imageUrl, baseUrl) {
  if (!imageUrl) return "";
  try {
    // Protocol-relative URL
    if (imageUrl.startsWith("//")) {
      return "https:" + imageUrl;
    }
    // Absolute URL
    if (/^https?:\/\//i.test(imageUrl)) {
      return imageUrl;
    }
    // Relative URL
    return new URL(imageUrl, baseUrl).href;
  } catch {
    return "";
  }
}

