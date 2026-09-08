/**
 * Sitemap product discovery module
 * Fetches robots.txt, sitemaps, and extracts product URLs
 */

import { fetchWithTimeout, normaliseUrl, matchesNonProductUrl, NON_PRODUCT_PATTERNS } from '../../../utils/scrape-utils.js';

const FETCH_TIMEOUT_MS = 12000;
const MAX_PRODUCT_URLS = 2000; // Per-retailer sitemap URL cap
const MAX_CHILD_SITEMAPS = 6; // Child sitemaps fetched per retailer
const PRODUCT_PATH_RE = /\/(products?|item|itm|p|dp|buy)\/[^/]+/i;

/**
 * Extract <loc> tags from sitemap XML
 * @param {string} xml
 * @returns {string[]}
 */
function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

/**
 * Check if URL is acceptable as a product URL
 * @param {string} loc - URL to check
 * @param {boolean} fromProductSitemap - Whether URL is from a sitemap with "product" in name
 * @returns {boolean}
 */
function acceptProductUrl(loc, fromProductSitemap) {
  const low = loc.toLowerCase();
  if (!/^https?:\/\//.test(low)) return false;
  if (matchesNonProductUrl(low, NON_PRODUCT_PATTERNS)) return false;
  if (PRODUCT_PATH_RE.test(loc)) return true;
  if (!fromProductSitemap) return false;
  
  // From a sitemap explicitly named "product": accept descriptive slugs
  const last = low.replace(/\/$/, "").split("/").pop() || "";
  return /-/.test(last) && last.length >= 8;
}

/**
 * Fetch robots.txt and extract Sitemap: directives
 * @param {string} origin
 * @returns {Promise<string[]>}
 */
async function robotsSitemapUrls(origin) {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, {}, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const txt = await res.text();
    return [...txt.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, MAX_CHILD_SITEMAPS);
  } catch {
    return [];
  }
}

/**
 * Discover product URLs from sitemaps
 * @param {string[]} origins - Array of origin URLs to check
 * @returns {Promise<string[]>}
 */
export async function discoverProductUrls(origins) {
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
        const res = await fetchWithTimeout(sitemapUrl, {}, FETCH_TIMEOUT_MS);
        if (!res.ok) continue;
        xml = await res.text();
      } catch {
        continue;
      }
      
      // Check if this is a sitemap index
      if (/<sitemapindex/i.test(xml)) {
        const children = extractLocs(xml);
        const productish = children.filter((u) => /product/i.test(u));
        const chosen = (productish.length > 0 ? productish : children).slice(0, MAX_CHILD_SITEMAPS);
        
        for (const child of chosen) {
          try {
            const cres = await fetchWithTimeout(child, {}, FETCH_TIMEOUT_MS);
            if (!cres.ok) continue;
            const cxml = await cres.text();
            const fromProductSitemap = /product/i.test(child);
            
            for (const loc of extractLocs(cxml)) {
              if (acceptProductUrl(loc, fromProductSitemap)) {
                found.add(normaliseUrl(loc));
              }
            }
          } catch {
            // Skip unreadable child sitemap
          }
          if (found.size >= MAX_PRODUCT_URLS) break;
        }
      } else if (/<urlset/i.test(xml)) {
        // Direct urlset sitemap
        for (const loc of extractLocs(xml)) {
          if (acceptProductUrl(loc, false)) {
            found.add(normaliseUrl(loc));
          }
        }
      }
      
      if (found.size > 0) break; // One usable sitemap per origin is enough
    }
    
    if (found.size >= MAX_PRODUCT_URLS) break;
  }
  
  found.delete("");
  return [...found].sort().slice(0, MAX_PRODUCT_URLS);
}

/**
 * Discover products from sitemap for a retailer
 * @param {object} retailer - Retailer object with website_url, gift_page_url
 * @returns {Promise<string[]>}
 */
export async function discoverSitemapProducts(retailer) {
  const origins = [];
  
  if (retailer.giftPageUrl) {
    try {
      origins.push(new URL(retailer.giftPageUrl).origin);
    } catch {}
  }
  if (retailer.websiteUrl) {
    try {
      const origin = new URL(retailer.websiteUrl).origin;
      if (!origins.includes(origin)) origins.push(origin);
    } catch {}
  }
  
  if (origins.length === 0) return [];
  
  return await discoverProductUrls(origins);
}
