/**
 * Catalogue Recovery Service
 * Ported from base44/functions/recoverInactiveProducts/entry.ts
 * 
 * Admin-only catalogue recovery. Reviews inactive products and moves plausible ones
 * back to needs_review (never active). Confirmed-gone and junk products stay inactive.
 * No emails are sent.
 */

import { fetchWithTimeout } from '../../utils/scrape-utils.js';

// Per-product URL check timeout (8s)
const URL_CHECK_TIMEOUT_MS = 8000;

// Non-product URL patterns that indicate junk/editorial pages
const NON_PRODUCT_URL_PATTERNS = [
  "sell-my", "sell-your", "/sell", "sell/", "trade-in", "trade_in",
  "valuation", "valuations", "we-buy", "cash-for",
  "/blog", "blog/", "/journal", "journal/", "/news", "news/",
  "/guide", "guides/", "/magazine", "/stories", "/article", "articles/",
  "/about", "about-us", "/contact", "contact-us", "/faq", "/help",
  "/account", "/login", "/register", "/basket", "/cart", "/checkout",
  "/search", "/wishlist", "gift-card", "gift-cards", "/careers",
  "/press", "/terms", "/privacy", "/returns", "/delivery-information",
];

/**
 * Check if URL looks like a non-product page
 * @param {string} url - URL to check
 * @returns {boolean} - true if URL looks like a non-product page
 */
function looksNonProduct(url) {
  const low = (url || "").toLowerCase();
  return NON_PRODUCT_URL_PATTERNS.some((frag) => low.includes(frag));
}

/**
 * Determine if a product is junk (invalid data, editorial content, non-product URL)
 * @param {object} product - Product object with name, dataQualityFlags, productUrl, affiliateUrl
 * @returns {boolean} - true if product is junk
 */
function isJunkProduct(product) {
  const flags = Array.isArray(product.dataQualityFlags) ? product.dataQualityFlags : [];
  
  // Check quality flags
  if (flags.includes("junk_title") || flags.includes("editorial_not_product")) {
    return true;
  }
  
  // Check name validity
  const name = (product.name || "").trim();
  if (!name || name.length < 4) {
    return true;
  }
  
  // Check for generic/invalid names
  if (/^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(name)) {
    return true;
  }
  
  // Check for listicle/editorial titles
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(name)) {
    return true;
  }
  
  // Check if URL looks like a non-product page
  if (looksNonProduct(product.productUrl || product.affiliateUrl || "")) {
    return true;
  }
  
  return false;
}

/**
 * Check if a product URL is still accessible
 * Returns "gone" (confirmed 404/410), "unknown" (timeouts, 403, 429, temporary server errors),
 * or "alive" (accessible)
 * 
 * @param {string} url - Product URL to check
 * @returns {Promise<string>} - "gone", "unknown", or "alive"
 */
async function checkUrl(url) {
  if (!url) return "unknown";
  
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        redirect: "follow",
        headers: { 
          "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" 
        },
      },
      URL_CHECK_TIMEOUT_MS
    );
    
    // Discard the body — only the status matters
    // Unread bodies can stall concurrent request pools
    try { 
      if (response.body) {
        await response.body.cancel(); 
      }
    } catch { 
      /* already consumed/closed */ 
    }
    
    // Check HTTP status
    if (response.status === 404 || response.status === 410) {
      return "gone";
    }
    
    if (response.ok) {
      return "alive";
    }
    
    // 403, 429, 5xx and other inconclusive statuses — not confirmed dead
    return "unknown";
  } catch (error) {
    // Timeout / network error — not confirmed dead
    return "unknown";
  }
}

/**
 * Process inactive products in concurrent batches
 * @param {Array} products - Array of inactive products to check
 * @param {number} batchSize - Number of concurrent checks per batch
 * @returns {Promise<object>} - { toReview: [...], confirmedGone: number, excludedAsJunk: number }
 */
async function processBatches(products, batchSize = 20) {
  let recoveredToReview = 0;
  let confirmedGone = 0;
  let excludedAsJunk = 0;
  const toReview = [];
  
  // Process in concurrent batches so one slow retailer can't stall the run
  for (let i = 0; i < products.length; i += batchSize) {
    const slice = products.slice(i, i + batchSize);
    
    await Promise.all(slice.map(async (product) => {
      // Check if product is junk
      if (isJunkProduct(product)) {
        excludedAsJunk++;
        return; // stays inactive
      }
      
      // Check if product URL is still accessible
      const result = await checkUrl(product.productUrl || product.affiliateUrl);
      
      if (result === "gone") {
        confirmedGone++;
        return; // stays inactive
      }
      
      // alive or unknown — plausible, not confirmed gone → needs_review (never active)
      toReview.push({ 
        id: product.id, 
        status: "NEEDS_REVIEW",
        lastChecked: new Date(),
      });
      recoveredToReview++;
    }));
  }
  
  return {
    toReview,
    recoveredToReview,
    confirmedGone,
    excludedAsJunk,
  };
}

/**
 * Main recovery function - checks inactive products and moves plausible ones to NEEDS_REVIEW
 * @param {object} prisma - Prisma client instance
 * @returns {Promise<object>} - Recovery statistics
 */
export async function recoverInactiveCatalogue(prisma) {
  console.log('🔄 Starting catalogue recovery...');
  
  // Fetch all INACTIVE products (matching base44's filter logic)
  const inactiveProducts = await prisma.product.findMany({
    where: { status: "INACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 5000, // Max 5000 to prevent excessive processing
  });
  
  console.log(`📦 Found ${inactiveProducts.length} inactive products to check`);
  
  // Process products in concurrent batches
  const { toReview, recoveredToReview, confirmedGone, excludedAsJunk } = 
    await processBatches(inactiveProducts, 20);
  
  // Apply updates in bulk (max 500 per call for Prisma performance)
  let updated = 0;
  for (let i = 0; i < toReview.length; i += 500) {
    const batch = toReview.slice(i, i + 500);
    
    // Update each product individually (Prisma doesn't have bulkUpdate)
    await Promise.all(batch.map(async (update) => {
      await prisma.product.update({
        where: { id: update.id },
        data: {
          status: update.status,
          lastChecked: update.lastChecked,
        },
      });
    }));
    
    updated += batch.length;
    console.log(`✅ Updated ${updated} / ${toReview.length} products to NEEDS_REVIEW`);
  }
  
  console.log(`✨ Recovery complete: ${recoveredToReview} recovered, ${confirmedGone} confirmed gone, ${excludedAsJunk} excluded as junk`);
  
  return {
    checked: inactiveProducts.length,
    recovered_to_review: recoveredToReview,
    confirmed_gone: confirmedGone,
    excluded_as_junk: excludedAsJunk,
  };
}
