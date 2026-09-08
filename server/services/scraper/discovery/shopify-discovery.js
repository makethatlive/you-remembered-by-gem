/**
 * Shopify product discovery module
 * Detects Shopify stores and paginates through /products.json API
 */

import { fetchWithTimeout, plainText } from '../../../utils/scrape-utils.js';

const FETCH_TIMEOUT_MS = 12000;
const MAX_SHOPIFY_PAGES = 40; // Runaway guard: 10,000 products per retailer

/**
 * Detect Shopify by testing /products.json?limit=1 on origins
 * @param {string[]} origins - Array of origin URLs to test
 * @returns {Promise<string|null>} - Shopify origin URL or null
 */
export async function detectShopifyOrigin(origins) {
  for (const origin of origins) {
    try {
      const res = await fetchWithTimeout(`${origin}/products.json?limit=1`, {}, FETCH_TIMEOUT_MS);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.products)) return origin;
    } catch {
      // Not Shopify at this origin
    }
  }
  return null;
}

/**
 * Map Shopify product JSON to Product_Record fields
 * @param {string} origin - Shopify origin URL
 * @param {object} product - Shopify product JSON object
 * @returns {object|null} - Mapped product or null if invalid
 */
export function mapShopifyProduct(origin, product) {
  const title = (product?.title || "").trim();
  const handle = (product?.handle || "").trim();
  if (!title || !handle) return null;
  
  // Find first available variant
  const variant = (product.variants || []).find((item) => item.available !== false);
  if (!variant) return null; // Reject if no available variants
  
  const price = Number(variant.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  
  // Parse tags from string or array
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

/**
 * Fetch Shopify products with pagination
 * @param {string} origin - Shopify origin URL
 * @param {number} startPage - Starting page number (1-indexed)
 * @param {number} maxPagesThisBatch - Maximum pages to fetch in this batch
 * @returns {Promise<{products: object[], nextPage: number|null, pagesProcessed: number}>}
 */
export async function fetchShopifyProducts(origin, startPage = 1, maxPagesThisBatch = 2) {
  const products = [];
  let currentPage = startPage;
  let pagesProcessed = 0;
  
  for (let i = 0; i < maxPagesThisBatch && currentPage <= MAX_SHOPIFY_PAGES; i++) {
    try {
      const url = `${origin}/products.json?limit=250&page=${currentPage}`;
      const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS);
      
      if (!res.ok) break;
      
      const data = await res.json().catch(() => null);
      if (!data || !Array.isArray(data.products)) break;
      
      const pageProducts = data.products;
      if (pageProducts.length === 0) {
        // No more products, stop pagination
        return { products, nextPage: null, pagesProcessed };
      }
      
      // Map and filter valid products
      for (const shopifyProd of pageProducts) {
        const mapped = mapShopifyProduct(origin, shopifyProd);
        if (mapped) products.push(mapped);
      }
      
      pagesProcessed++;
      currentPage++;
    } catch (err) {
      // Network error or timeout, stop pagination
      break;
    }
  }
  
  // Determine next page: null if we've exhausted or hit max pages, otherwise continue
  const nextPage = (currentPage <= MAX_SHOPIFY_PAGES && pagesProcessed === maxPagesThisBatch)
    ? currentPage
    : null;
  
  return { products, nextPage, pagesProcessed };
}

/**
 * Discover products from a Shopify retailer
 * @param {object} retailer - Retailer object with website_url, gift_page_url
 * @param {object} cursor - Continuation cursor with shopifyOrigin, shopifyPage
 * @param {number} maxPagesThisBatch - Maximum pages to fetch this batch (default 2)
 * @returns {Promise<{products: object[], nextPage: number|null, origin: string|null}>}
 */
export async function discoverShopifyProducts(retailer, cursor = {}, maxPagesThisBatch = 2) {
  // Build list of origins to test
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
  
  if (origins.length === 0) {
    return { products: [], nextPage: null, origin: null };
  }
  
  // Use cached origin from cursor or detect
  let origin = cursor.shopifyOrigin || null;
  if (!origin || !origins.includes(origin)) {
    origin = await detectShopifyOrigin(origins);
  }
  
  if (!origin) {
    // Not a Shopify store
    return { products: [], nextPage: null, origin: null };
  }
  
  // Fetch products with pagination
  const startPage = cursor.shopifyPage || 1;
  const result = await fetchShopifyProducts(origin, startPage, maxPagesThisBatch);
  
  return {
    products: result.products,
    nextPage: result.nextPage,
    origin,
  };
}
