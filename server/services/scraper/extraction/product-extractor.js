/**
 * Product page extraction module
 * Extracts structured data from product pages (JSON-LD, meta tags)
 */

import { fetchWithTimeout, plainText, normaliseUrl } from '../../../utils/scrape-utils.js';

const FETCH_TIMEOUT_MS = 12000;

/**
 * Find Product node in JSON-LD structured data
 * @param {any} value
 * @returns {object|null}
 */
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

/**
 * Extract JSON-LD Product nodes from HTML
 * @param {string} html
 * @returns {object|null}
 */
function extractJsonLdProduct(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const node = findProductNode(JSON.parse(m[1].trim()));
      if (node) return node;
    } catch {
      // Malformed block — try the next one
    }
  }
  return null;
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
    // Use free ExchangeRate-API
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
      console.log(`   💱 CONVERSION SUCCESS!`);
      console.log(`      Original: ${currency} ${price.toFixed(2)}`);
      console.log(`      Rate: ${data.rates.GBP.toFixed(6)}`);
      console.log(`      Result: £${gbpPrice.toFixed(2)} GBP`);
      return Math.round(gbpPrice * 100) / 100; // Round to 2 decimals
    } else {
      console.error(`   ❌ No GBP rate found for ${currency}`);
      console.error(`   Available rates:`, Object.keys(data.rates || {}));
      return price;
    }
  } catch (error) {
    console.error(`   ❌ Currency conversion failed (${currency} → GBP):`, error.message);
    console.error(`   Stack:`, error.stack);
    return price;
  }
}

/**
 * Detect currency from HTML if not provided in structured data
 * @param {string} html - HTML content
 * @returns {string} Detected currency code or empty string
 */
function detectCurrency(html) {
  console.log(`   🔍 Detecting currency from HTML...`);
  
  // Look for currency symbols and codes in HTML
  const patterns = [
    // Currency codes in meta tags
    /<meta[^>]+currency["'][^>]+content=["']([A-Z]{3})["']/i,
    // Shopify currency
    /Shopify\.currency\s*=\s*["']([A-Z]{3})["']/i,
    // Common currency in body
    /currency["\s:]+([A-Z]{3})/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      console.log(`   ✅ Currency detected from pattern: ${match[1].toUpperCase()}`);
      return match[1].toUpperCase();
    }
  }
  
  // Check for PKR symbol (₨ or Rs)
  if (/[₨Rs]\s*\d+[,\d]+/.test(html)) {
    console.log(`   ✅ Currency detected from symbol: PKR (₨/Rs found)`);
    return 'PKR';
  }
  
  // Check for common symbols
  if (/\$\d+/.test(html) && !/£\d+/.test(html)) {
    console.log(`   ✅ Currency detected from symbol: USD ($)`);
    return 'USD';
  }
  
  if (/€\d+/.test(html)) {
    console.log(`   ✅ Currency detected from symbol: EUR (€)`);
    return 'EUR';
  }
  
  // Default to GBP if unknown
  console.log(`   ⚠️  No specific currency detected, defaulting to GBP`);
  return 'GBP';
}

/**
 * Parse offer data from Product node
 * @param {object} node
 * @param {string} html - Full HTML for currency detection fallback
 * @returns {{price: number, currency: string, outOfStock: boolean}}
 */
function parseOffer(node, html) {
  console.log(`   📦 Parsing offer data from JSON-LD...`);
  
  let offers = node?.offers;
  if (Array.isArray(offers)) offers = offers[0];
  if (!offers || typeof offers !== "object") {
    console.log(`   ⚠️  No valid offers object found`);
    return { price: NaN, currency: "", outOfStock: false };
  }
  
  const price = Number(offers.price ?? offers.lowPrice);
  let currency = String(offers.priceCurrency || "").toUpperCase();
  
  console.log(`   💰 Extracted from JSON-LD:`);
  console.log(`      Price: ${price}`);
  console.log(`      Currency (structured data): ${currency || '(not specified)'}`);
  
  // Fallback: detect currency from HTML if not in structured data
  if (!currency) {
    console.log(`   ⚠️  No priceCurrency in structured data, falling back to HTML detection`);
    currency = detectCurrency(html);
  }
  
  const outOfStock = /OutOfStock|Discontinued/i.test(String(offers.availability || ""));
  
  console.log(`   📊 Final offer data:`);
  console.log(`      Price: ${price}`);
  console.log(`      Currency: ${currency}`);
  console.log(`      Out of Stock: ${outOfStock}`);
  
  return { price, currency, outOfStock };
}

/**
 * Extract image URL from Product node
 * @param {object} node
 * @returns {string}
 */
function jsonLdImage(node) {
  const image = node?.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : image[0]?.url || "";
  if (image && typeof image === "object") return image.url || "";
  return "";
}

/**
 * Extract content from meta tags
 * @param {string} html
 * @param {RegExp[]} patterns - Array of regex patterns to match
 * @returns {string}
 */
function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

/**
 * Extract canonical URL from page
 * @param {string} html
 * @param {string} fallbackUrl
 * @returns {string}
 */
function pageCanonical(html, fallbackUrl) {
  const canonical = metaContent(html, [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
  ]);
  return normaliseUrl(canonical || fallbackUrl) || normaliseUrl(fallbackUrl);
}

/**
 * Extract product from page using JSON-LD structured data
 * @param {string} html
 * @param {string} url - Original URL
 * @param {string} responseUrl - Final URL after redirects
 * @returns {Promise<{success: boolean, product?: object, rejected?: string}>}
 */
async function extractFromJsonLd(html, url, responseUrl) {
  console.log(`\n   🔬 EXTRACTION METHOD: JSON-LD`);
  console.log(`   📄 URL: ${url}`);
  
  const canonical = pageCanonical(html, responseUrl || url);
  const node = extractJsonLdProduct(html);
  
  if (!node) {
    console.log(`   ❌ No JSON-LD Product node found`);
    return { success: false };
  }
  
  console.log(`   ✅ Found JSON-LD Product node`);
  
  let { price, currency, outOfStock } = parseOffer(node, html);
  
  if (outOfStock) {
    console.log(`   ❌ Product is out of stock - rejecting`);
    return { success: false, rejected: "out of stock" };
  }
  
  if (!Number.isFinite(price) || price <= 0) {
    console.log(`   ❌ Invalid price (${price}) - rejecting`);
    return { success: false, rejected: "no valid price" };
  }
  
  console.log(`\n   💰 ORIGINAL PRICE: ${currency} ${price}`);
  
  // Convert to GBP if different currency
  if (currency && currency !== "GBP") {
    console.log(`   🔄 Currency is ${currency}, conversion needed`);
    const originalPrice = price;
    price = await convertToGBP(price, currency);
    
    if (price === originalPrice) {
      console.warn(`   ⚠️  WARNING: Conversion failed or returned same price!`);
      console.warn(`      Using original price: ${originalPrice}`);
    } else {
      console.log(`   ✅ CONVERSION COMPLETE: ${currency} ${originalPrice} → £${price} GBP`);
    }
  } else {
    console.log(`   ℹ️  Currency is already GBP, no conversion needed`);
  }
  
  const name = plainText(typeof node.name === "string" ? node.name : "");
  if (!name) {
    console.log(`   ❌ No product name found - rejecting`);
    return { success: false, rejected: "no title" };
  }
  
  console.log(`   ✅ Product name: ${name}`);
  console.log(`   💷 FINAL PRICE TO BE STORED: £${price} GBP\n`);
  
  return {
    success: true,
    product: {
      name,
      description: plainText(typeof node.description === "string" ? node.description : "").slice(0, 800),
      category: "",
      price,
      image_url: jsonLdImage(node) || metaContent(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]),
      product_url: canonical,
      search_keywords: [],
    },
  };
}

/**
 * Extract product from page using meta tags
 * @param {string} html
 * @param {string} url - Original URL
 * @param {string} responseUrl - Final URL after redirects
 * @returns {Promise<{success: boolean, product?: object, rejected?: string}>}
 */
async function extractFromMetaTags(html, url, responseUrl) {
  console.log(`\n   🔬 EXTRACTION METHOD: META TAGS`);
  console.log(`   📄 URL: ${url}`);
  
  const canonical = pageCanonical(html, responseUrl || url);
  
  let metaPrice = Number(metaContent(html, [
    /<meta[^>]+property=["'](?:og|product):price:amount["'][^>]+content=["']([^"']+)["']/i,
  ]));
  let metaCurrency = metaContent(html, [
    /<meta[^>]+property=["'](?:og|product):price:currency["'][^>]+content=["']([^"']+)["']/i,
  ]).toUpperCase();
  
  console.log(`   💰 Extracted from meta tags:`);
  console.log(`      Price: ${metaPrice}`);
  console.log(`      Currency: ${metaCurrency || '(not specified)'}`);
  
  // Fallback: detect currency from HTML
  if (!metaCurrency) {
    console.log(`   ⚠️  No currency in meta tags, falling back to HTML detection`);
    metaCurrency = detectCurrency(html);
  }
  
  const metaTitle = plainText(metaContent(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]));
  
  if (!metaTitle || !Number.isFinite(metaPrice) || metaPrice <= 0) {
    console.log(`   ❌ Invalid title or price - rejecting`);
    return { success: false };
  }
  
  console.log(`\n   💰 ORIGINAL PRICE: ${metaCurrency} ${metaPrice}`);
  
  // Convert to GBP if different currency
  if (metaCurrency && metaCurrency !== "GBP") {
    console.log(`   🔄 Currency is ${metaCurrency}, conversion needed`);
    const originalPrice = metaPrice;
    metaPrice = await convertToGBP(metaPrice, metaCurrency);
    
    if (metaPrice === originalPrice) {
      console.warn(`   ⚠️  WARNING: Conversion failed or returned same price!`);
      console.warn(`      Using original price: ${originalPrice}`);
    } else {
      console.log(`   ✅ CONVERSION COMPLETE: ${metaCurrency} ${originalPrice} → £${metaPrice} GBP`);
    }
  } else {
    console.log(`   ℹ️  Currency is already GBP, no conversion needed`);
  }
  
  console.log(`   ✅ Product name: ${metaTitle}`);
  console.log(`   💷 FINAL PRICE TO BE STORED: £${metaPrice} GBP\n`);
  
  return {
    success: true,
    product: {
      name: metaTitle,
      description: plainText(metaContent(html, [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i])).slice(0, 800),
      category: "",
      price: metaPrice,
      image_url: metaContent(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]),
      product_url: canonical,
      search_keywords: [],
    },
  };
}

/**
 * Extract product from a product page URL
 * Tries JSON-LD first, then meta tags
 * @param {string} url
 * @returns {Promise<{success: boolean, product?: object, rejected?: string, error?: string, html?: string}>}
 */
export async function extractFromProductPage(url) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 EXTRACTING PRODUCT FROM URL`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`URL: ${url}`);
  
  let res;
  try {
    res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS);
  } catch (err) {
    return { success: false, error: err.name === "AbortError" ? "timed out" : err.message };
  }
  
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}` };
  }
  
  const html = (await res.text()).slice(0, 300000);
  
  console.log(`   ✅ HTML fetched (${html.length} chars)`);
  
  // Try JSON-LD first
  const jsonLdResult = await extractFromJsonLd(html, url, res.url);
  if (jsonLdResult.success) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ EXTRACTION SUCCESSFUL (JSON-LD)`);
    console.log(`   Product: ${jsonLdResult.product.name}`);
    console.log(`   Final Price: £${jsonLdResult.product.price} GBP`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return jsonLdResult;
  }
  if (jsonLdResult.rejected) {
    console.log(`   ❌ JSON-LD extraction rejected: ${jsonLdResult.rejected}`);
    return { ...jsonLdResult, html };
  }
  
  console.log(`   ⚠️  JSON-LD extraction failed, trying meta tags...`);
  
  // Try meta tags fallback
  const metaResult = await extractFromMetaTags(html, url, res.url);
  if (metaResult.success) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ EXTRACTION SUCCESSFUL (META TAGS)`);
    console.log(`   Product: ${metaResult.product.name}`);
    console.log(`   Final Price: £${metaResult.product.price} GBP`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return metaResult;
  }
  if (metaResult.rejected) {
    console.log(`   ❌ Meta tags extraction rejected: ${metaResult.rejected}`);
    return { ...metaResult, html };
  }
  
  console.log(`   ❌ Both JSON-LD and meta tags failed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // No structured data found - return HTML for AI fallback
  return { success: false, html };
}
