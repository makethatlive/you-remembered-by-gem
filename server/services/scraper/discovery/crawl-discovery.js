/**
 * Crawl fallback discovery module
 * Bounded HTML crawling for retailers without Shopify or sitemaps
 */

import { fetchWithTimeout, normaliseUrl, matchesNonProductUrl, NON_PRODUCT_PATTERNS } from '../../../utils/scrape-utils.js';

const FETCH_TIMEOUT_MS = 12000;
const CRAWL_LISTING_PAGES = 5; // Listing pages crawled per retailer
const MAX_CRAWL_URLS = 300; // Per-retailer crawl URL cap
const CRAWL_LISTING_PATHS = ["/collections", "/category", "/categories", "/shop", "/gifts", "/range"];
const PRODUCT_PATH_RE = /\/(products?|item|itm|p|dp|buy)\/[^/]+/i;

/**
 * Check if URL matches product path patterns
 * @param {string} loc
 * @param {boolean} isFromCrawl - Whether this is from our own crawl
 * @returns {boolean}
 */
function acceptProductUrl(loc, isFromCrawl) {
  const low = loc.toLowerCase();
  if (matchesNonProductUrl(low, NON_PRODUCT_PATTERNS)) return false;
  if (PRODUCT_PATH_RE.test(loc)) return true;
  
  // For crawled pages, accept descriptive slugs
  if (isFromCrawl && crawlAcceptsSlug(loc)) return true;
  
  return false;
}

/**
 * Descriptive-slug heuristic for crawled pages
 * At least two path segments and a hyphenated final segment
 * @param {string} loc
 * @returns {boolean}
 */
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

/**
 * Harvest links from a single page
 * @param {string} pageUrl
 * @param {boolean} collectListings - Whether to collect listing page URLs
 * @param {Set<string>} found - Set of found product URLs
 * @param {string[]} listingUrls - Array of listing URLs
 */
async function harvestPage(pageUrl, collectListings, found, listingUrls) {
  let html = "";
  let host = "";
  
  try {
    host = new URL(pageUrl).hostname;
    const res = await fetchWithTimeout(pageUrl, {}, FETCH_TIMEOUT_MS);
    if (!res.ok) return;
    html = (await res.text()).slice(0, 400000);
  } catch {
    return; // Unreachable page — skip
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
    
    if (acceptProductUrl(loc, true)) {
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
}

/**
 * Discover product URLs via bounded crawling
 * @param {object} retailer - Retailer object with website_url, gift_page_url
 * @returns {Promise<string[]>}
 */
export async function crawlDiscoverProductUrls(retailer) {
  const seedUrls = [...new Set(
    [retailer.giftPageUrl, retailer.websiteUrl].map((u) => normaliseUrl(u)).filter(Boolean)
  )].slice(0, 2);
  
  const found = new Set();
  const listingUrls = [];
  
  // Harvest seed pages
  for (const seed of seedUrls) {
    await harvestPage(seed, true, found, listingUrls);
  }
  
  // Harvest listing pages
  for (const listing of listingUrls.slice(0, CRAWL_LISTING_PAGES)) {
    await harvestPage(listing, false, found, listingUrls);
  }
  
  found.delete("");
  // Deterministic order
  return [...found].sort().slice(0, MAX_CRAWL_URLS);
}
