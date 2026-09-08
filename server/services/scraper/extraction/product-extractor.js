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
 * Parse offer data from Product node
 * @param {object} node
 * @returns {{price: number, currency: string, outOfStock: boolean}}
 */
function parseOffer(node) {
  let offers = node?.offers;
  if (Array.isArray(offers)) offers = offers[0];
  if (!offers || typeof offers !== "object") return { price: NaN, currency: "", outOfStock: false };
  const price = Number(offers.price ?? offers.lowPrice);
  const currency = String(offers.priceCurrency || "").toUpperCase();
  const outOfStock = /OutOfStock|Discontinued/i.test(String(offers.availability || ""));
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
 * @returns {{success: boolean, product?: object, rejected?: string}}
 */
function extractFromJsonLd(html, url, responseUrl) {
  const canonical = pageCanonical(html, responseUrl || url);
  const node = extractJsonLdProduct(html);
  
  if (!node) return { success: false };
  
  const { price, currency, outOfStock } = parseOffer(node);
  
  if (outOfStock) return { success: false, rejected: "out of stock" };
  if (!Number.isFinite(price) || price <= 0) return { success: false, rejected: "no valid price" };
  if (currency && currency !== "GBP") return { success: false, rejected: `currency ${currency}` };
  
  const name = plainText(typeof node.name === "string" ? node.name : "");
  if (!name) return { success: false, rejected: "no title" };
  
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
 * @returns {{success: boolean, product?: object, rejected?: string}}
 */
function extractFromMetaTags(html, url, responseUrl) {
  const canonical = pageCanonical(html, responseUrl || url);
  
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
  
  if (!metaTitle || !Number.isFinite(metaPrice) || metaPrice <= 0) {
    return { success: false };
  }
  
  if (metaCurrency && metaCurrency !== "GBP") {
    return { success: false, rejected: `currency ${metaCurrency}` };
  }
  
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
  
  // Try JSON-LD first
  const jsonLdResult = extractFromJsonLd(html, url, res.url);
  if (jsonLdResult.success) {
    return jsonLdResult;
  }
  if (jsonLdResult.rejected) {
    return { ...jsonLdResult, html };
  }
  
  // Try meta tags fallback
  const metaResult = extractFromMetaTags(html, url, res.url);
  if (metaResult.success) {
    return metaResult;
  }
  if (metaResult.rejected) {
    return { ...metaResult, html };
  }
  
  // No structured data found - return HTML for AI fallback
  return { success: false, html };
}
