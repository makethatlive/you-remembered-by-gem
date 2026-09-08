/**
 * Product Availability Checking Service
 * Ported from base44/functions/checkAvailabilityBatch/entry.ts
 * 
 * Bounded, client-driven availability sweep. The caller walks the catalogue 
 * one small batch at a time using the returned cursor, so no single invocation 
 * can run long enough to need a lock.
 */

import { fetchWithTimeout, normaliseUrl, urlKey, validProduct } from '../../utils/scrape-utils.js';

// Per-request availability-check timeout (8s), so one hanging host cannot stall a batch
const AVAILABILITY_TIMEOUT_MS = 8000;

/**
 * Get current timestamp as ISO-8601 DateTime for Prisma
 * @returns {Date}
 */
function now() {
  return new Date();
}

const DEFAULT_BATCH_SIZE = 25;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 50;

/**
 * Check if a product should be marked inactive based on catalogue correction rules
 * @param {object} product - Product object with name, description, category, product_url
 * @returns {object} - { status: 'inactive' } or { suitable_age_bands: [...] } or {}
 */
function catalogueCorrection(product) {
  const text = `${product.name || ""} ${product.description || ""} ${product.category || ""} ${product.productUrl || ""}`;
  const url = (product.productUrl || "").toLowerCase();
  const name = (product.name || "").trim();

  // Invalid names
  if (!name || /^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(name)) {
    return { status: "INACTIVE" };
  }

  // Listicle/editorial titles
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(name)) {
    return { status: "INACTIVE" };
  }

  // Non-product URL patterns
  if (["/blog", "/journal", "/news", "/guide", "/article", "/search"].some((part) => url.includes(part))) {
    return { status: "INACTIVE" };
  }

  // Age band corrections (optional - can be removed if not needed)
  if (/\b(baby|newborn|infant|toddler|nursery)\b/i.test(text)) {
    return { suitableAgeBands: ["Under 5"] };
  }
  if (/\b(5\s*[-–]\s*6|7\s*[-–]\s*8)\s*(yrs?|years?)\b/i.test(text)) {
    return { suitableAgeBands: ["5-10"] };
  }
  if (/\b(8\s*[-–]\s*12|9\s*[-–]\s*11)\s*(yrs?|years?)\b/i.test(text)) {
    return { suitableAgeBands: ["5-10", "11-17"] };
  }
  if (/\b(for kids?|children'?s|childrens)\b/i.test(text)) {
    return { suitableAgeBands: ["Under 5", "5-10", "11-17"] };
  }

  return {};
}

/**
 * Check availability of a product URL
 * @param {string} url - Product URL to check
 * @returns {Promise<string>} - 'available', 'gone', or 'unknown'
 */
async function checkAvailability(url) {
  try {
    let response = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, AVAILABILITY_TIMEOUT_MS);
    
    // Some servers reject HEAD or return 403 — fall back to GET with Range header
    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          redirect: "follow",
          headers: { 
            Range: "bytes=0-2048", 
            "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" 
          },
        },
        AVAILABILITY_TIMEOUT_MS
      );
    }

    if (response.ok) return "available";
    if (response.status === 404 || response.status === 410) return "gone";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Process a batch of products for availability checking
 * @param {object} prisma - Prisma client instance
 * @param {object} options - { cursor, batch_size }
 * @returns {Promise<object>} - { processed, next_cursor, done }
 */
export async function checkAvailabilityBatch(prisma, { cursor = 0, batchSize = DEFAULT_BATCH_SIZE }) {
  // Validate and constrain batch size
  const validBatchSize = Math.min(
    MAX_BATCH_SIZE,
    Math.max(MIN_BATCH_SIZE, Math.floor(Number(batchSize) || DEFAULT_BATCH_SIZE))
  );

  // Validate cursor
  const validCursor = Math.floor(Number(cursor) || 0);
  const startCursor = validCursor > 0 ? validCursor : 0;

  // Fetch all ACTIVE and NEEDS_REVIEW products (matching base44's filter logic)
  const activeProducts = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 5000, // Match base44's limit
  });

  const reviewProducts = await prisma.product.findMany({
    where: { status: "NEEDS_REVIEW" },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  // Merge the two lists
  const toCheck = [...activeProducts, ...reviewProducts];

  // Get the batch slice using cursor
  const slice = toCheck.slice(startCursor, startCursor + validBatchSize);

  // Track URLs to detect duplicates within this batch
  const seenUrls = new Set();

  // Cursor stability: count how many products we retire from the batch.
  // When a product is marked inactive, it drops out of the next query
  // at an index BELOW the cursor (it was already processed).
  // Advancing by slice.length would overshoot by the number retired.
  // Subtracting retired count keeps the cursor stable.
  let retired = 0;

  for (const product of slice) {
    if (!product.productUrl) continue;

    const urlNorm = urlKey(product.productUrl);

    // Duplicate URL detection
    if (urlNorm && seenUrls.has(urlNorm)) {
      await prisma.product.update({
        where: { id: product.id },
        data: { status: "INACTIVE", lastChecked: now() },
      });
      retired += 1;
      continue;
    }
    if (urlNorm) seenUrls.add(urlNorm);

    // Catalogue corrections (invalid names, non-product URLs, age bands)
    const correction = catalogueCorrection(product);
    if (correction.status === "INACTIVE") {
      await prisma.product.update({
        where: { id: product.id },
        data: { 
          status: "INACTIVE", 
          lastChecked: now(),
          ...(correction.suitableAgeBands ? { suitableAgeBands: correction.suitableAgeBands } : {}),
        },
      });
      retired += 1;
      continue;
    }

    // Check availability via HTTP request
    const availability = await checkAvailability(product.productUrl);

    if (availability === "available") {
      // Product is still live — update lastChecked and lastVerified
      await prisma.product.update({
        where: { id: product.id },
        data: {
          lastChecked: now(),
          lastVerified: now(),
          ...(correction.suitableAgeBands ? { suitableAgeBands: correction.suitableAgeBands } : {}),
        },
      });
    } else if (availability === "gone") {
      // Product returned 404/410 — mark as inactive
      await prisma.product.update({
        where: { id: product.id },
        data: {
          status: "INACTIVE",
          lastChecked: now(),
          ...(correction.suitableAgeBands ? { suitableAgeBands: correction.suitableAgeBands } : {}),
        },
      });
      retired += 1;
    } else {
      // Timeout, 403, rate limit, etc. — NOT proof the product is gone
      // Only apply age band corrections if we detected any
      if (correction.suitableAgeBands) {
        await prisma.product.update({
          where: { id: product.id },
          data: { suitableAgeBands: correction.suitableAgeBands },
        });
      }
      // Don't update lastChecked if we couldn't verify availability
    }
  }

  // Return batch processing results
  return {
    processed: slice.length,
    next_cursor: startCursor + slice.length - retired,
    done: slice.length < validBatchSize,
  };
}
