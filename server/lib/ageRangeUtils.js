/**
 * Age Range Utilities (Server-side)
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
 */
function parseAgeBand(band) {
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
 */
function rangesOverlap(range1, range2) {
  // If either is open-ended (max = null), check if ranges can overlap
  if (range1.max === null) {
    // range1 is open-ended (e.g., "75+")
    return range2.max === null || range2.max >= range1.min;
  }
  
  if (range2.max === null) {
    // range2 is open-ended (e.g., "75+")
    return range1.max >= range2.min;
  }

  // Both have defined ranges - check standard overlap
  return range1.min <= range2.max && range2.min <= range1.max;
}

/**
 * Check if recipient's age band overlaps with ANY of the product's age bands.
 * 
 * @param {string} recipientBand - Recipient's age band (e.g., "18-25", "5-6", "75+")
 * @param {string[]} productBands - Product's suitable age bands array
 * @returns {boolean} - true if there's any overlap, false otherwise
 */
function doAgeRangesOverlap(recipientBand, productBands) {
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
 */
function getAllowedAgeBands() {
  return {
    children: ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"],
    adults: ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"],
    all: ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17", "18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]
  };
}

/**
 * Check if an age band is for children (under 18).
 */
function isChildrenAgeBand(ageBand) {
  const childrenBands = ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"];
  return childrenBands.includes(ageBand);
}

/**
 * Check if an age band is for adults (18+).
 */
function isAdultAgeBand(ageBand) {
  const adultBands = ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"];
  return adultBands.includes(ageBand);
}

export {
  parseAgeBand,
  rangesOverlap,
  doAgeRangesOverlap,
  getAllowedAgeBands,
  isChildrenAgeBand,
  isAdultAgeBand
};
