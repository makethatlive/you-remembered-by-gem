/**
 * Product validation module
 * Validates products and normalizes rejection reasons
 */

import { validProduct } from '../../../utils/scrape-utils.js';

/**
 * Normalized rejection reason keys (bounded set)
 */
export const REJECTION_REASONS = {
  FAILED_VALIDATION: "failed_validation",
  SHOPIFY_NO_AVAILABLE_VARIANT: "shopify_no_available_variant",
  OUT_OF_STOCK: "out_of_stock",
  NO_VALID_PRICE: "no_valid_price",
  CURRENCY_NOT_GBP: "currency_not_gbp",
  NO_TITLE: "no_title",
  NO_STRUCTURED_DATA_AI_BUDGET_SPENT: "no_structured_data_ai_budget_spent",
  AI_NO_BUYABLE_PRODUCT: "ai_no_buyable_product",
  AI_EXTRACTION_FAILED: "ai_extraction_failed",
  OTHER: "other",
};

/**
 * Normalize rejection reason string to bounded stable key
 * @param {string} raw - Raw rejection reason string
 * @returns {string} - Normalized reason key
 */
export function normalizeReason(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "failed_validation" || s === "shopify_no_available_variant") return s;
  if (s.includes("out of stock")) return REJECTION_REASONS.OUT_OF_STOCK;
  if (s.includes("no valid price")) return REJECTION_REASONS.NO_VALID_PRICE;
  if (s.startsWith("currency")) return REJECTION_REASONS.CURRENCY_NOT_GBP;
  if (s.includes("no title")) return REJECTION_REASONS.NO_TITLE;
  if (s.includes("ai budget")) return REJECTION_REASONS.NO_STRUCTURED_DATA_AI_BUDGET_SPENT;
  if (s.includes("ai found no buyable")) return REJECTION_REASONS.AI_NO_BUYABLE_PRODUCT;
  if (s.includes("ai extraction failed")) return REJECTION_REASONS.AI_EXTRACTION_FAILED;
  return REJECTION_REASONS.OTHER;
}

/**
 * Validate product against all rules
 * @param {object} prod - Product object
 * @returns {{valid: boolean, reason?: string}}
 */
export function validateProduct(prod) {
  if (!validProduct(prod)) {
    return { valid: false, reason: REJECTION_REASONS.FAILED_VALIDATION };
  }
  return { valid: true };
}

/**
 * Track rejection in batch statistics
 * @param {object} counts - Batch counts object
 * @param {object} cursor - Continuation cursor object
 * @param {string} reason - Raw rejection reason
 */
export function trackRejection(counts, cursor, reason) {
  const key = normalizeReason(reason);
  
  counts.rejected++;
  counts.reject_reasons[key] = (counts.reject_reasons[key] || 0) + 1;
  
  // Per-retailer tally in cursor
  if (!cursor.rejectReasons || typeof cursor.rejectReasons !== "object" || Array.isArray(cursor.rejectReasons)) {
    cursor.rejectReasons = {};
  }
  cursor.rejectReasons[key] = (cursor.rejectReasons[key] || 0) + 1;
}
