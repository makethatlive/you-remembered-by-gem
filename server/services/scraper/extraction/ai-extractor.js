/**
 * AI extraction fallback module
 * Uses Claude client for bounded product extraction when structured data is unavailable
 */

import { plainText } from '../../../utils/scrape-utils.js';

/**
 * Extract product data using AI (Claude) as fallback
 * @param {object} claudeClient - Initialized Claude client instance
 * @param {string} html - Product page HTML
 * @param {number} aiBudget - Remaining AI budget for this batch
 * @returns {Promise<{success: boolean, product?: object, rejected?: string, usedAI: boolean}>}
 */
export async function extractWithAI(claudeClient, html, aiBudget) {
  // Check budget
  if (!claudeClient || aiBudget <= 0) {
    return { success: false, rejected: "no structured data (AI budget spent)", usedAI: false };
  }
  
  // Prepare extraction schema
  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      price: { type: "number" },
      image_url: { type: "string" },
    },
  };
  
  // Prepare prompt
  const prompt = `This is the HTML of a single retailer product page. Extract ONLY the one product sold on this page. Return name, a short description, the GBP price as a number, and the main product image URL. If this page is not an individually buyable product with a clear GBP price, return an empty name.

PAGE HTML:
${html.slice(0, 30000)}`;
  
  try {
    // Call Claude with 30-second timeout
    const raw = await Promise.race([
      claudeClient.generateStructuredContent(prompt, schema),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000)),
    ]);
    
    // Validate response
    const name = plainText(raw?.name || "");
    const price = Number(raw?.price);
    
    if (!name || !Number.isFinite(price) || price <= 0) {
      return { success: false, rejected: "AI found no buyable product", usedAI: true };
    }
    
    return {
      success: true,
      product: {
        name,
        description: plainText(raw?.description || "").slice(0, 800),
        category: "",
        price,
        image_url: raw?.image_url || "",
        product_url: "", // Will be set by caller
        search_keywords: [],
      },
      usedAI: true,
    };
  } catch (err) {
    return { success: false, rejected: "AI extraction failed", usedAI: true };
  }
}
