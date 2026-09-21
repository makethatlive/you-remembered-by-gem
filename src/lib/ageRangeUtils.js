/**
 * Age Range Utilities
 * 
 * Utility functions for working with flexible age band ranges.
 * These ranges match the onboarding form options exactly.
 * 
 * Allowed ranges:
 * - Children: "1-2", "3-4", "5-6", "7-8", "9-11", "12-17"
 * - Adults: "18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"
 */

/**
 * Parse age band string into min/max numbers.
 * 
 * @param {string} band - e.g., "18-25", "75+", "5-6"
 * @returns {{min: number, max: number|null}} - null max = open-ended (e.g., "75+")
 * 
 * @example
 * parseAgeBand("18-25") // { min: 18, max: 25 }
 * parseAgeBand("75+")   // { min: 75, max: null }
 * parseAgeBand("5-6")   // { min: 5, max: 6 }
 */
export function parseAgeBand(band) {
  if (!band || typeof band !== 'string') {
    return { min: 0, max: null };
  }

  // Handle open-ended ranges (e.g., "75+")
  if (band.endsWith('+')) {
    const min = parseInt(band.slice(0, -1), 10);
    return { min: isNaN(min) ? 0 : min, max: null };
  }

  // Handle closed ranges (e.g., "18-25", "5-6")
  if (band.includes('-')) {
    const [minStr, maxStr] = band.split('-');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    return { 
      min: isNaN(min) ? 0 : min, 
      max: isNaN(max) ? null : max 
    };
  }

  // Single number (treat as exact age)
  const age = parseInt(band, 10);
  return { 
    min: isNaN(age) ? 0 : age, 
    max: isNaN(age) ? null : age 
  };
}

/**
 * Check if two age ranges overlap.
 * 
 * @param {{min: number, max: number|null}} range1
 * @param {{min: number, max: number|null}} range2
 * @returns {boolean} - true if ranges overlap
 * 
 * @example
 * rangesOverlap({min: 18, max: 25}, {min: 26, max: 35}) // false (no overlap)
 * rangesOverlap({min: 18, max: 25}, {min: 20, max: 30}) // true (overlap: 20-25)
 * rangesOverlap({min: 75, max: null}, {min: 80, max: 85}) // true (75+ includes 80-85)
 */
export function rangesOverlap(range1, range2) {
  // If either is open-ended (max = null), check if ranges can overlap
  if (range1.max === null) {
    // range1 is open-ended (e.g., "75+")
    // It overlaps if range2 starts at or after range1.min OR range2 is also open-ended
    return range2.max === null || range2.max >= range1.min;
  }
  
  if (range2.max === null) {
    // range2 is open-ended (e.g., "75+")
    // It overlaps if range1 ends at or after range2.min
    return range1.max >= range2.min;
  }

  // Both have defined ranges - check standard overlap
  // Two ranges overlap if: range1.min <= range2.max AND range2.min <= range1.max
  return range1.min <= range2.max && range2.min <= range1.max;
}

/**
 * Check if recipient's age band overlaps with ANY of the product's age bands.
 * 
 * This is the main function used for filtering products by age.
 * 
 * @param {string} recipientBand - Recipient's age band (e.g., "18-25", "5-6", "75+")
 * @param {string[]} productBands - Product's suitable age bands array
 * @returns {boolean} - true if there's any overlap, false otherwise
 * 
 * @example
 * // Exact match
 * doAgeRangesOverlap("18-25", ["18-25", "26-35"]) // true
 * 
 * // Partial overlap
 * doAgeRangesOverlap("26-35", ["18-25", "26-35", "36-45"]) // true
 * 
 * // No overlap
 * doAgeRangesOverlap("18-25", ["56-65", "66-75", "75+"]) // false
 * 
 * // Open-ended overlap
 * doAgeRangesOverlap("75+", ["66-75", "75+"]) // true
 * 
 * // No product bands specified (no restrictions)
 * doAgeRangesOverlap("18-25", []) // true (allow all ages)
 */
export function doAgeRangesOverlap(recipientBand, productBands) {
  // No recipient band or empty/invalid - no filtering
  if (!recipientBand || typeof recipientBand !== 'string') {
    return true;
  }

  // No product bands specified - product has no age restrictions
  if (!Array.isArray(productBands) || productBands.length === 0) {
    return true;
  }

  // Parse recipient's age band
  const recipientRange = parseAgeBand(recipientBand);

  // Check if recipient's range overlaps with ANY product band
  return productBands.some(productBand => {
    const productRange = parseAgeBand(productBand);
    return rangesOverlap(recipientRange, productRange);
  });
}

/**
 * Get all allowed age band values (from onboarding form).
 * 
 * @returns {Object} - Object with children and adult age ranges
 */
export function getAllowedAgeBands() {
  return {
    children: ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"],
    adults: ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"],
    all: ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17", "18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]
  };
}

/**
 * Check if an age band is for children (under 18).
 * 
 * @param {string} ageBand - Age band to check
 * @returns {boolean} - true if children's age band
 */
export function isChildrenAgeBand(ageBand) {
  const childrenBands = ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"];
  return childrenBands.includes(ageBand);
}

/**
 * Check if an age band is for adults (18+).
 * 
 * @param {string} ageBand - Age band to check
 * @returns {boolean} - true if adult age band
 */
export function isAdultAgeBand(ageBand) {
  const adultBands = ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"];
  return adultBands.includes(ageBand);
}
