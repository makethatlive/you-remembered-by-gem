/**
 * AI Classification Service for Product Enrichment
 * Uses Claude API to classify products (category, gender, age_bands, age_restricted)
 * Ported from base44/functions/enrichCatalogueBatch/entry.ts (R3 Track 2)
 */

import Anthropic from '@anthropic-ai/sdk';
import { CANONICAL_CATEGORIES, PRODUCT_AGE_BANDS, GENDER_VALUES } from './taxonomy.js';

const CLASSIFY_PER_RUN = 15; // Exactly one LLM call per invocation

/**
 * Sanitize one LLM verdict with enum compliance
 */
function cleanVerdict(raw, cleanValue) {
  return {
    value: cleanValue(raw?.value),
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence) || 0)),
    evidence: String(raw?.evidence || "").slice(0, 200),
    applied: false,
    skip_reason: "",
  };
}

/**
 * Classify a batch of products using Claude API
 * 
 * @param {Array} products - Products to classify (max 15)
 * @param {Map} retailerMap - Map of retailer_id -> retailer object
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Array>} - Array of classification results
 */
export async function classifyProductsBatch(products, retailerMap, apiKey) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  if (!products || products.length === 0) {
    return [];
  }

  // Limit batch size
  const batch = products.slice(0, CLASSIFY_PER_RUN);

  // Build prompt products array
  const promptProducts = batch.map((p, i) => ({
    ref: i,
    name: p.name || "",
    description: String(p.description || "").slice(0, 300),
    category_text: p.category || "",
    retailer: retailerMap.get(p.retailerId)?.name || "",
    retailer_audience: retailerMap.get(p.retailerId)?.category || "",
    price_gbp: p.price,
    url: p.productUrl || "",
  }));

  // Build the classification prompt (exact from base44)
  const prompt = `You are classifying products for a curated UK gift catalogue. Use ONLY the product data below; never invent facts.

For EACH product return an entry with its ref and four classifications:
- category: the single best fit, copied character for character from this exact list: ${CANONICAL_CATEGORIES.join(" | ")} — or "" if nothing fits.
- gender: who the product is aimed at, exactly one of: men | women | unisex. When unclear, unisex.
- age_bands: every recipient age band the product suits, chosen only from: Under 5 | 5-10 | 11-17 | 18+. Choose a child band ONLY when the product is expressly made for children — a toy, a children's book, a U/PG/family edition — never merely because a child might find the subject interesting. Age-rated or adult-themed media (15/18 certificate, explicit lyrics, horror) is 18+ only.
- restricted: true ONLY if the product is legally age-restricted in the UK (alcohol, blades, tobacco or vapes, gambling, adult content), otherwise false.

For each of the four also return confidence (a number from 0 to 1) and evidence (a short phrase from the product data that justifies the value; "" if none).

PRODUCTS:
${JSON.stringify(promptProducts, null, 2)}

Return only the JSON object and nothing else.`;

  // Define the response schema
  const responseSchema = {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ref: { type: "number" },
            category: {
              type: "object",
              properties: {
                value: { type: "string" },
                confidence: { type: "number" },
                evidence: { type: "string" }
              },
              required: ["value", "confidence", "evidence"]
            },
            gender: {
              type: "object",
              properties: {
                value: { type: "string" },
                confidence: { type: "number" },
                evidence: { type: "string" }
              },
              required: ["value", "confidence", "evidence"]
            },
            age_bands: {
              type: "object",
              properties: {
                value: { type: "array", items: { type: "string" } },
                confidence: { type: "number" },
                evidence: { type: "string" }
              },
              required: ["value", "confidence", "evidence"]
            },
            restricted: {
              type: "object",
              properties: {
                value: { type: "boolean" },
                confidence: { type: "number" },
                evidence: { type: "string" }
              },
              required: ["value", "confidence", "evidence"]
            }
          },
          required: ["ref", "category", "gender", "age_bands", "restricted"]
        }
      }
    },
    required: ["products"]
  };

  // Initialize Claude client
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Call Claude API with JSON schema
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022", // Latest Claude 3.5 Sonnet
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    tools: [
      {
        name: "classify_products",
        description: "Classify products with category, gender, age bands, and age restriction",
        input_schema: responseSchema
      }
    ],
    tool_choice: { type: "tool", name: "classify_products" }
  });

  // Extract the tool call result
  const toolUse = message.content.find(block => block.type === 'tool_use');
  if (!toolUse || !toolUse.input) {
    throw new Error('No classification response from Claude');
  }

  const raw = toolUse.input;
  const entries = Array.isArray(raw?.products) ? raw.products : [];

  // Process and sanitize each classification
  const results = [];
  for (const entry of entries) {
    const product = batch[Number(entry?.ref)];
    if (!product) continue;

    // Sanitize verdicts with enum compliance
    const vCat = cleanVerdict(entry.category, (v) => 
      (CANONICAL_CATEGORIES.includes(v) ? v : "")
    );
    
    const vGen = cleanVerdict(entry.gender, (v) => {
      const g = String(v || "").toLowerCase().trim();
      return GENDER_VALUES.includes(g) ? g : "";
    });
    
    const vBands = cleanVerdict(entry.age_bands, (v) =>
      Array.isArray(v) ? [...new Set(v.filter((b) => PRODUCT_AGE_BANDS.includes(b)))] : []
    );
    
    const vRes = cleanVerdict(entry.restricted, (v) => v === true);

    results.push({
      product,
      verdicts: {
        category: vCat,
        gender: vGen,
        age_bands: vBands,
        restricted: vRes,
      }
    });
  }

  return results;
}
