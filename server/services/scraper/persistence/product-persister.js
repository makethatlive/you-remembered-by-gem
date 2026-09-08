/**
 * Product persistence module
 * Handles product upsert with field preservation rules
 */

import { urlKey, deriveAgeBands, resolveImageUrl, today } from '../../../utils/scrape-utils.js';

/**
 * Load existing products for a retailer and build URL key map
 * @param {object} prisma - Prisma client instance
 * @param {string} retailerId
 * @returns {Promise<Map<string, object>>}
 */
export async function loadExistingMap(prisma, retailerId) {
  const rows = await prisma.product.findMany({
    where: { retailerId },
    select: {
      id: true,
      productUrl: true,
      affiliateUrl: true,
      status: true,
      dataQualityFlags: true,
      description: true,
      imageUrl: true,
      price: true,
    },
  });
  
  const map = new Map();
  for (const row of rows) {
    for (const key of [urlKey(row.productUrl), urlKey(row.affiliateUrl)]) {
      if (key && !map.has(key)) map.set(key, row);
    }
  }
  return map;
}

/**
 * Upsert a product: create new or update existing with field preservation
 * @param {object} prod - Product data
 * @param {object} retailer - Retailer object
 * @param {Map} existingMap - URL key map of existing products
 * @param {object} pending - Pending creates/updates
 * @param {object} counts - Batch counts
 * @param {string} sourceType - "SHOPIFY_UPLOAD" or "CURATED_RETAILER"
 * @param {object} cursor - Continuation cursor
 */
export function upsertProduct(prod, retailer, existingMap, pending, counts, sourceType, cursor) {
  counts.discovered++;
  
  const url = prod.product_url;
  const key = urlKey(url);
  if (!key || pending.seenKeys.has(key)) {
    counts.skipped_duplicates++;
    return;
  }
  pending.seenKeys.add(key);
  
  // Resolve image URL
  let img = resolveImageUrl(prod.image_url, url);
  if (img && !/^https?:\/\//i.test(img)) img = undefined;
  
  const existing = existingMap.get(key);
  if (existing) {
    // Update existing product: preserve curated fields
    const payload = {
      where: { id: existing.id },
      data: {
        lastVerified: new Date(today()),
      },
    };
    
    // Only update price if changed
    if (Number.isFinite(prod.price) && prod.price > 0) {
      const existingPrice = Number(existing.price);
      if (prod.price !== existingPrice) {
        payload.data.price = prod.price;
      }
    }
    
    // Only update description if existing is empty
    if (!String(existing.description || "").trim() && prod.description) {
      payload.data.description = prod.description;
    }
    
    // Only update image if existing is empty
    if (!existing.imageUrl && img) {
      payload.data.imageUrl = img;
    }
    
    // Inactive rediscovery rule
    if (existing.status === "INACTIVE") {
      const flags = Array.isArray(existing.dataQualityFlags) ? existing.dataQualityFlags : [];
      if (!flags.includes("junk_title") && !flags.includes("editorial_not_product")) {
        payload.data.status = "NEEDS_REVIEW";
      }
    }
    
    pending.updates.push(payload);
    counts.updated++;
    if (cursor) cursor.updated++;
  } else {
    // Create new product
    const ageBands = deriveAgeBands(retailer, prod);
    
    pending.creates.push({
      name: prod.name,
      description: prod.description || undefined,
      category: prod.category || undefined,
      retailerId: retailer.id,
      productUrl: url,
      affiliateUrl: url,
      imageUrl: img,
      price: prod.price,
      genderAppliesTo: retailer.category || undefined,
      ageRestricted: false,
      suitableAgeBands: ageBands,
      interestTags: [],
      giftTypeTags: [],
      searchKeywords: Array.isArray(prod.search_keywords) ? prod.search_keywords : [],
      sourceType,
      status: "NEEDS_REVIEW",
      addedDate: new Date(today()),
      lastVerified: new Date(today()),
    });
    counts.new_products++;
    if (cursor) cursor.newProducts++;
  }
}

/**
 * Flush pending creates and updates to database in chunks
 * @param {object} prisma - Prisma client instance
 * @param {object} pending - Pending creates/updates
 */
export async function flushPending(prisma, pending) {
  // Flush creates in chunks of 100
  for (let i = 0; i < pending.creates.length; i += 100) {
    const chunk = pending.creates.slice(i, i + 100);
    await prisma.product.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
  
  // Flush updates in chunks of 50
  for (let i = 0; i < pending.updates.length; i += 50) {
    const chunk = pending.updates.slice(i, i + 50);
    await prisma.$transaction(
      chunk.map(update => prisma.product.update(update))
    );
  }
  
  // Clear pending arrays
  pending.creates = [];
  pending.updates = [];
}



