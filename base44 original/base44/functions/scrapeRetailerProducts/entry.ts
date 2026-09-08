import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  today, fetchWithTimeout as sharedFetchWithTimeout, normaliseUrl, plainText,
  validProduct, deriveAgeBands,
} from "../../shared/scrapeShared.ts";
import { CANONICAL_INTERESTS, CANONICAL_GIFT_TYPES } from "../../shared/taxonomyShared.ts";

// Per-retailer fetch timeout (15s). Aborts the request if the retailer URL
// doesn't respond in time so one slow retailer can't stall the whole run.
const FETCH_TIMEOUT_MS = 15000;

// Per-retailer AI extraction timeout (30s). Guards against the extraction step
// hanging so one slow retailer can't stall the whole run.
const EXTRACTION_TIMEOUT_MS = 30000;

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(url, options = {}) {
  return sharedFetchWithTimeout(url, options, FETCH_TIMEOUT_MS);
}

const EXTRACT_PROMPT = `Extract up to 30 genuine, individually buyable gift products from this retailer page.
Exclude navigation text, collection headings, reviews, blog/editorial pages, gift guides, search pages, category pages, "choose your design", "shop now" and any item without a clear product title, absolute product URL and GBP price.
For each product return: name, description, category, price (number), image_url, product_url, interest_tags, gift_type_tags, search_keywords.
interest_tags may only use values that genuinely apply from: ${CANONICAL_INTERESTS.map((e) => e.key).join("; ")}.
gift_type_tags may only use values that genuinely apply from: ${CANONICAL_GIFT_TYPES.map((e) => e.key).join("; ")}.
Return a JSON array only — no markdown.`;

// Parse AI JSON response into an array of products, or [] if malformed.
function parseProducts(raw) {
  if (raw == null) return [];
  let text = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.products)) return parsed.products;
  return [];
}

async function fetchShopifyCatalogue(retailer) {
  try {
    const source = retailer.website_url || retailer.gift_page_url;
    const origin = new URL(source).origin;
    const response = await fetchWithTimeout(`${origin}/products.json?limit=250`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.products)) return [];
    return data.products.slice(0, 250).map((product) => {
      // Only import products with a genuinely available variant.
      const variant = (product.variants || []).find((item) => item.available !== false);
      if (!variant) return null;
      const tags = Array.isArray(product.tags)
        ? product.tags
        : String(product.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      return {
        name: product.title,
        description: plainText(product.body_html).slice(0, 800),
        category: product.product_type || tags[0] || "",
        price: Number(variant?.price),
        image_url: product.images?.[0]?.src || product.image?.src || "",
        product_url: `${origin}/products/${product.handle}`,
        interest_tags: [],
        gift_type_tags: [],
        search_keywords: tags,
      };
    }).filter((product) => product && Number.isFinite(product.price) && product.price > 0 && product.product_url && (product.name || "").trim());
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Scheduled automations run with a valid authenticated (admin) context, so a failed
    // auth check must always reject outright — never fall back to an "allowed" state,
    // which would let an anonymous request trigger scraping and AI extraction.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 1. Active retailers
    const retailers = await svc.entities.Retailer.filter({ active: true }, "name", 5000);

    let newCount = 0;
    let verifiedCount = 0;
    const errors = [];

    for (const retailer of retailers) {
      if (!retailer.gift_page_url) {
        errors.push(`${retailer.name}: no gift_page_url — retailer skipped`);
        continue;
      }
      try {
        // 2. Shopify's structured catalogue is faster and far more accurate than scraping
        // page text. If unavailable, fall back to the reviewed AI extractor.
        let products = await fetchShopifyCatalogue(retailer);
        const fromStructuredCatalogue = products.length > 0;
        if (products.length === 0) {
          let res;
          try {
            res = await fetchWithTimeout(retailer.gift_page_url, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" },
            });
          } catch (fetchErr) {
            const reason = fetchErr.name === "AbortError" ? "timed out" : fetchErr.message;
            errors.push(`${retailer.name}: ${reason}`);
            continue;
          }
          if (!res.ok) {
            errors.push(`${retailer.name}: HTTP ${res.status}`);
            continue;
          }
          const html = await res.text();
          let raw;
          try {
            raw = await withTimeout(
              svc.integrations.Core.InvokeLLM({
                prompt: `${EXTRACT_PROMPT}\n\nPAGE HTML:\n${html.slice(0, 60000)}`,
              }),
              EXTRACTION_TIMEOUT_MS,
              "extraction timed out"
            );
          } catch (extractErr) {
            errors.push(`${retailer.name}: ${extractErr.message}`);
            continue;
          }
          products = parseProducts(raw);
        }

        // 4. Upsert each extracted product
        for (const prod of products) {
          if (!validProduct(prod)) continue;
          const url = normaliseUrl(prod?.product_url);
          const price = typeof prod?.price === "number" ? prod.price : Number(prod?.price);
          if (!url || !prod?.name || !Number.isFinite(price) || !(price > 0)) continue;

          const byProductUrl = await svc.entities.Product.filter({ product_url: url });
          const byAffiliateUrl = byProductUrl.length ? [] : await svc.entities.Product.filter({ affiliate_url: url });
          const existing = [...byProductUrl, ...byAffiliateUrl];
          if (existing.length > 0) {
            // Already exists — update last_verified, overwrite no curated fields.
            const current = existing[0];
            const updatePayload = { last_verified: today() };
            // An inactive product rediscovered in the retailer's current structured
            // catalogue goes back to needs_review (never auto-activated), unless it
            // was flagged as junk or editorial.
            if (fromStructuredCatalogue && current.status === "inactive") {
              const flags = Array.isArray(current.data_quality_flags) ? current.data_quality_flags : [];
              if (!flags.includes("junk_title") && !flags.includes("editorial_not_product")) {
                updatePayload.status = "needs_review";
              }
            }
            await svc.entities.Product.update(current.id, updatePayload);
            verifiedCount++;
          } else {
            await svc.entities.Product.create({
              name: prod.name,
              description: prod.description || undefined,
              category: prod.category || undefined,
              retailer_id: retailer.id,
              product_url: url,
              affiliate_url: url,
              image_url: prod.image_url || undefined,
              price,
              gender_applies_to: retailer.category || undefined,
              age_restricted: false,
              suitable_age_bands: deriveAgeBands(retailer, prod),
              interest_tags: Array.isArray(prod.interest_tags) ? prod.interest_tags : [],
              gift_type_tags: Array.isArray(prod.gift_type_tags) ? prod.gift_type_tags : [],
              search_keywords: Array.isArray(prod.search_keywords) ? prod.search_keywords : [],
              // Provenance: Shopify structured catalogue vs approved retailer page extraction.
              source_type: fromStructuredCatalogue ? "shopify_upload" : "curated_retailer",
              status: "needs_review",
              added_date: today(),
              last_verified: today(),
            });
            newCount++;
          }
        }
      } catch (err) {
        errors.push(`${retailer.name}: ${err.message}`);
      }
    }

    // Mirror needs_review products to Gem's "Gem Product Review" Google Sheet.
    let rowsAddedToSheet = null;
    try {
      const mirrorRes = await base44.functions.invoke("mirrorProductsToSheet", {});
      rowsAddedToSheet = mirrorRes?.data?.rows_added ?? null;
    } catch (err) {
      errors.push(`mirrorProductsToSheet: ${err.message}`);
    }

    return Response.json({
      retailers_processed: retailers.length,
      new_products: newCount,
      verified_products: verifiedCount,
      rows_added_to_sheet: rowsAddedToSheet,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});