/**
 * Continuation token encoding/decoding for resumable batch scraping
 */

/**
 * Encode cursor state as base64 JSON string
 * @param {object} state - Cursor state object
 * @returns {string}
 */
export function encodeCursor(state) {
  const json = JSON.stringify(state);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Decode and parse base64 JSON cursor, return null on error
 * @param {string} cursor - Base64 encoded cursor
 * @returns {object|null}
 */
export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const state = JSON.parse(json);
    return state;
  } catch {
    return null;
  }
}

/**
 * Validate cursor scope matches request scope
 * @param {object|null} cursorState - Decoded cursor state
 * @param {string|null} requestRetailerId - Retailer ID from request body
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCursorScope(cursorState, requestRetailerId) {
  if (!cursorState) return { valid: true }; // No cursor = fresh start
  
  const isPerRetailerRequest = !!requestRetailerId;
  const isPerRetailerToken = cursorState.scope === "retailer";
  
  if (isPerRetailerRequest && !isPerRetailerToken) {
    return {
      valid: false,
      error: "Continuation token is from a full scrape run, cannot be used for per-retailer scrape",
    };
  }
  
  if (!isPerRetailerRequest && isPerRetailerToken) {
    return {
      valid: false,
      error: "Continuation token is from a per-retailer scrape, cannot be used for full scrape run",
    };
  }
  
  // For per-retailer tokens, verify retailer ID matches
  if (isPerRetailerToken && cursorState.retailerId !== requestRetailerId) {
    return {
      valid: false,
      error: "Continuation token retailer ID does not match request retailer ID",
    };
  }
  
  return { valid: true };
}

/**
 * Create initial cursor state for a scrape operation
 * @param {string|null} retailerId - Retailer ID if per-retailer scrape
 * @returns {object}
 */
export function createInitialCursor(retailerId = null) {
  return {
    scope: retailerId ? "retailer" : "full",
    retailerId: retailerId || null,
    retailerIndex: 0,
    discoveryMode: "none",
    shopifyOrigin: null,
    shopifyPage: 1,
    productIndex: 0,
    newProducts: 0,
    updated: 0,
    rejected: 0,
    rejectReasons: {},
    lastError: null,
  };
}
