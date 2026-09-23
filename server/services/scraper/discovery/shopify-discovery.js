/**
 * Shopify product discovery module
 * Detects Shopify stores and paginates through /products.json API
 */

import { fetchWithTimeout, plainText } from '../../../utils/scrape-utils.js';

/**
 * Detect currency from a Shopify store by checking the homepage HTML
 * @param {string} origin - Shopify origin URL
 * @returns {Promise<string>} Currency code (defaults to GBP if not found)
 */
async function detectShopifyCurrency(origin) {
  console.log(`\n   🔍 Detecting currency for Shopify store: ${origin}`);
  
  try {
    const response = await fetchWithTimeout(origin, {}, FETCH_TIMEOUT_MS);
    if (!response.ok) {
      console.log(`   ⚠️  Failed to fetch homepage, defaulting to GBP`);
      return 'GBP';
    }
    
    const html = await response.text();
    
    // Look for Shopify.currency
    const shopifyCurrencyMatch = html.match(/Shopify\.currency\s*=\s*[{"']([A-Z]{3})["']/i);
    if (shopifyCurrencyMatch) {
      console.log(`   ✅ Found currency in Shopify config: ${shopifyCurrencyMatch[1]}`);
      return shopifyCurrencyMatch[1];
    }
    
    // Look for currency symbols and codes
    const patterns = [
      // Meta tags
      /<meta[^>]+currency["'][^>]+content=["']([A-Z]{3})["']/i,
      // Common currency in script
      /currency["\s:]+([A-Z]{3})/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        console.log(`   ✅ Found currency from pattern: ${match[1]}`);
        return match[1].toUpperCase();
      }
    }
    
    // Check for PKR symbol (₨ or Rs)
    if (/[₨Rs]\s*\d+[,\d]+/.test(html) || /PKR/i.test(html)) {
      console.log(`   ✅ Found PKR currency symbols in HTML`);
      return 'PKR';
    }
    
    // Check for common symbols
    if (/\$\d+/.test(html) && !/£\d+/.test(html)) {
      console.log(`   ✅ Found USD symbol`);
      return 'USD';
    }
    
    if (/€\d+/.test(html)) {
      console.log(`   ✅ Found EUR symbol`);
      return 'EUR';
    }
    
    console.log(`   ⚠️  No specific currency detected, defaulting to GBP`);
    return 'GBP';
    
  } catch (error) {
    console.error(`   ❌ Error detecting currency:`, error.message);
    return 'GBP';
  }
}

/**
 * Convert price to GBP using exchange rate API
 * @param {number} price - Price in source currency
 * @param {string} currency - Source currency code (PKR, USD, EUR, etc.)
 * @returns {Promise<number>} Price in GBP
 */
async function convertToGBP(price, currency) {
  if (!currency || currency === 'GBP') {
    console.log(`   ℹ️  Currency is already GBP, no conversion needed`);
    return price;
  }
  
  console.log(`   🔄 Converting ${currency} to GBP...`);
  
  try {
    const apiUrl = `https://api.exchangerate-api.com/v4/latest/${currency}`;
    console.log(`   📡 Fetching exchange rate from: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`   ❌ Exchange API failed: ${response.status}`);
      return price;
    }
    
    const data = await response.json();
    
    if (data.rates && data.rates.GBP) {
      const gbpPrice = price * data.rates.GBP;
      console.log(`   💱 SHOPIFY CONVERSION SUCCESS!`);
      console.log(`      Original: ${currency} ${price.toFixed(2)}`);
      console.log(`      Rate: ${data.rates.GBP.toFixed(6)}`);
      console.log(`      Result: £${gbpPrice.toFixed(2)} GBP`);
      return Math.round(gbpPrice * 100) / 100;
    } else {
      console.error(`   ❌ No GBP rate found for ${currency}`);
      return price;
    }
  } catch (error) {
    console.error(`   ❌ Currency conversion failed (${currency} → GBP):`, error.message);
    return price;
  }
}

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
 * @param {string} storeCurrency - Store currency code (detected once per retailer)
 * @param {number|null} exchangeRate - Cached exchange rate to GBP
 * @returns {Promise<object|null>} - Mapped product or null if invalid
 */
export async function mapShopifyProduct(origin, product, storeCurrency = 'GBP', exchangeRate = null) {
  console.log(`\n   🛍️  SHOPIFY PRODUCT: ${product?.title || '(no title)'}`);
  
  const title = (product?.title || "").trim();
  const handle = (product?.handle || "").trim();
  if (!title || !handle) {
    console.log(`   ❌ Invalid title or handle, skipping`);
    return null;
  }
  
  // Find first available variant
  const variant = (product.variants || []).find((item) => item.available !== false);
  if (!variant) {
    console.log(`   ❌ No available variants, skipping`);
    return null; // Reject if no available variants
  }
  
  let price = Number(variant.price);
  if (!Number.isFinite(price) || price <= 0) {
    console.log(`   ❌ Invalid price (${price}), skipping`);
    return null;
  }
  
  console.log(`   💰 Original: ${storeCurrency} ${price}`);
  
  // Convert to GBP if different currency using CACHED rate
  if (storeCurrency && storeCurrency !== 'GBP' && exchangeRate) {
    const originalPrice = price;
    price = Math.round(price * exchangeRate * 100) / 100;
    console.log(`   ✅ Converted: £${price} GBP`);
  } else if (storeCurrency === 'GBP') {
    console.log(`   ℹ️  Already GBP`);
  } else {
    console.log(`   ⚠️  No exchange rate, keeping original price`);
  }
  
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
 * @param {string|null} storeCurrency - Store currency (if already detected)
 * @param {number|null} exchangeRate - Cached exchange rate to GBP
 * @returns {Promise<{products: object[], nextPage: number|null, pagesProcessed: number, storeCurrency: string, exchangeRate: number|null}>}
 */
export async function fetchShopifyProducts(origin, startPage = 1, maxPagesThisBatch = 2, storeCurrency = null, exchangeRate = null) {
  // Detect currency once per retailer (only on first call)
  if (!storeCurrency) {
    storeCurrency = await detectShopifyCurrency(origin);
    console.log(`\n   🏪 STORE CURRENCY DETECTED: ${storeCurrency}`);
  }
  
  // Fetch exchange rate once per retailer (only on first call or if not cached)
  if (!exchangeRate && storeCurrency && storeCurrency !== 'GBP') {
    console.log(`   📡 Fetching exchange rate for ${storeCurrency} → GBP...`);
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${storeCurrency}`);
      if (response.ok) {
        const data = await response.json();
        if (data.rates && data.rates.GBP) {
          exchangeRate = data.rates.GBP;
          console.log(`   ✅ Exchange rate cached: ${storeCurrency} → GBP = ${exchangeRate.toFixed(6)}`);
          console.log(`   📊 All products will be converted using this rate\n`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Failed to fetch exchange rate:`, error.message);
    }
  }
  
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
        return { products, nextPage: null, pagesProcessed, storeCurrency, exchangeRate };
      }
      
      // Map and filter valid products (passing store currency and cached rate)
      for (const shopifyProd of pageProducts) {
        const mapped = await mapShopifyProduct(origin, shopifyProd, storeCurrency, exchangeRate);
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
  
  return { products, nextPage, pagesProcessed, storeCurrency, exchangeRate };
}

/**
 * Discover products from a Shopify retailer
 * @param {object} retailer - Retailer object with website_url, gift_page_url
 * @param {object} cursor - Continuation cursor with shopifyOrigin, shopifyPage, storeCurrency, exchangeRate
 * @param {number} maxPagesThisBatch - Maximum pages to fetch this batch (default 2)
 * @returns {Promise<{products: object[], nextPage: number|null, origin: string|null, storeCurrency: string|null, exchangeRate: number|null}>}
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
    return { products: [], nextPage: null, origin: null, storeCurrency: null, exchangeRate: null };
  }
  
  // Use cached origin from cursor or detect
  let origin = cursor.shopifyOrigin || null;
  if (!origin || !origins.includes(origin)) {
    origin = await detectShopifyOrigin(origins);
  }
  
  if (!origin) {
    // Not a Shopify store
    return { products: [], nextPage: null, origin: null, storeCurrency: null, exchangeRate: null };
  }
  
  // Fetch products with pagination (pass cached currency and exchange rate from cursor)
  const startPage = cursor.shopifyPage || 1;
  const storeCurrency = cursor.storeCurrency || null;
  const exchangeRate = cursor.exchangeRate || null;
  const result = await fetchShopifyProducts(origin, startPage, maxPagesThisBatch, storeCurrency, exchangeRate);
  
  return {
    products: result.products,
    nextPage: result.nextPage,
    origin,
    storeCurrency: result.storeCurrency, // Cache for next batch
    exchangeRate: result.exchangeRate, // Cache for next batch
  };
}
