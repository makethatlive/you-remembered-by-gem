/**
 * Product Enrichment Service
 * Adds metadata, tags, quality scores, and AI classification to products
 * Converted from base44/functions/enrichCatalogueBatch
 */

import {
  INTEREST_KEYWORDS,
  GIFT_TYPE_KEYWORDS,
  CANONICAL_CATEGORIES,
  PRODUCT_AGE_BANDS,
  GENDER_VALUES,
  canonicalCategory,
} from './taxonomy.js';
import { classifyProductsBatch } from './ai-classifier.js';

const CLASSIFY_VERSION = 5;
const CLASSIFY_PER_RUN = 15; // Exactly one LLM call per invocation
const LOW_CONFIDENCE_FLAG = "classification_low_confidence";

// Provenance classes - determines how we handle existing data
const HUMANISH_SOURCES = new Set(["curated_product", "legacy_unknown"]);
const MACHINE_SOURCES = new Set(["curated_retailer", "shopify_upload"]);

// Child safety - age band restrictions
const KID_BANDS = ["Under 5", "5-10", "11-17"];
const UNDER_11_BANDS = ["Under 5", "5-10"];

// Categories where no child is a plausible recipient
const ADULT_ONLY_CATEGORIES = new Set([
  "Wine & drinks", "Spirits & cocktails", "Coffee & tea", "Home & interiors",
  "Gardening", "Cars & motoring", "Wellness & self-care", "Beauty & skincare",
  "Spirituality",
]);

// Plausible for teenagers, not for young children
const TEEN_ONLY_CATEGORIES = new Set([
  "Jewellery", "Watches", "Fashion & accessories", "Photography",
]);

// Categories that ARE about children
const CHILD_CATEGORIES = new Set([
  "Children & family activities", "Toys, games, or activities",
]);

// Adult content patterns (age-restricted)
const ADULT_CONTENT_PATTERNS = [
  /\b(?:bbfc|pegi|esrb|cert(?:ificate)?|rated|rating)\s*:?\s*(?:15|16|18)\b/i,
  /\b(?:15|18)\s*\+/,
  /\br[- ]?rated\b/i,
  /\bover[- ]?18s?\b/i,
  /\bparental advisory\b/i,
  /\bexplicit (?:lyrics|content|version)\b/i,
  /\b(?:horror|slasher|gore|true crime)\b/i,
  /\b(?:erotic|erotica|adults? only|nsfw|sex toy|lingerie)\b/i,
  /\b(?:casino|gambling|poker set|betting|roulette)\b/i,
  /\b(?:vape|vaping|e-?liquid|tobacco|cigar|cigarette|nicotine)\b/i,
  /\b(?:knife|knives|machete)\b/i,
];

// Child evidence patterns
const CHILD_PATTERNS = [
  /\b(?:baby|toddler|kid|child|children|for kids)\b/i,
  /\b(?:age|ages)\s*\d+[-–]\d+\b/i,
  /\byoung (?:child|reader|learner)\b/i,
];

/**
 * HTML entity decoder
 */
function decode(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract meta description from HTML
 */
function metaDescription(html) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]).slice(0, 800);
  }
  return "";
}

/**
 * Fetch product description from URL
 */
async function fetchDescription(url) {
  if (!url) return "";
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" },
    });
    
    if (!response.ok) return "";
    
    const html = await response.text();
    return metaDescription(html.slice(0, 150000));
  } catch (error) {
    console.error(`Failed to fetch description from ${url}:`, error.message);
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Match tags against text using keyword rules
 */
function matchingTags(text, rules) {
  const lower = ` ${text.toLowerCase()} `;
  return Object.entries(rules)
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([tag]) => tag);
}

/**
 * Get product text for matching
 */
function productText(product) {
  return `${product?.name || ""} ${product?.description || ""} ${product?.category || ""} ${product?.productUrl || ""}`;
}

/**
 * Check if product has adult content
 */
function hasAdultContent(product) {
  const text = productText(product);
  return ADULT_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check if product has evidence it's for children
 */
function hasChildEvidence(product, category, retailer) {
  if (CHILD_CATEGORIES.has(category)) return true;
  
  const retailerCategory = retailer?.category || "";
  if (retailerCategory === "Kids" || retailerCategory === "Unisex + Kids") return true;
  
  return CHILD_PATTERNS.some((pattern) => pattern.test(productText(product)));
}

/**
 * Apply age safety rules (subtractive only)
 */
function applyAgeSafetyRules(bands, { product, category, retailer, gemOwned }) {
  let out = Array.isArray(bands) ? [...bands] : [];

  // Layer 2: Adult content (runs on ALL rows including curated)
  if (hasAdultContent(product)) {
    out = out.filter((band) => !KID_BANDS.includes(band));
  }

  if (!gemOwned) {
    // Layer 1a: Adult-only categories
    if (ADULT_ONLY_CATEGORIES.has(category)) {
      out = out.filter((band) => !KID_BANDS.includes(band));
    } 
    // Layer 1b: Teen-only categories
    else if (TEEN_ONLY_CATEGORIES.has(category)) {
      out = out.filter((band) => !UNDER_11_BANDS.includes(band));
    }
    
    // Layer 3: Under-11 requires evidence
    if (!hasChildEvidence(product, category, retailer)) {
      out = out.filter((band) => !UNDER_11_BANDS.includes(band));
    }
  }

  // Don't empty the list - default to 18+
  return out.length ? out : ["18+"];
}

/**
 * Detect quality issues
 */
function qualityFlags(product, description) {
  const flags = [];
  const combined = `${product.name || ""} ${description} ${product.category || ""} ${product.productUrl || ""}`;
  
  if (!description) flags.push("missing_description");
  if (!product.imageUrl) flags.push("missing_image");
  if (/^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(product.name || "")) {
    flags.push("junk_title");
  }
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(product.name || "")) {
    flags.push("editorial_not_product");
  }
  if (/\b(baby|newborn|infant|toddler|nursery|for kids?|children'?s|8\s*[-–]\s*12\s*(yrs?|years?))\b/i.test(combined) && 
      String(product.suitableAgeBands || "").includes("18+")) {
    flags.push("child_tagged_adult");
  }
  
  return flags;
}

/**
 * Calculate quality score (0-100)
 */
function qualityScore(product, description, interests, giftTypes, flags) {
  let score = 20;
  if (product.productUrl) score += 15;
  if (product.imageUrl) score += 15;
  if (description) score += 20;
  if (product.category) score += 10;
  if (interests.length) score += 10;
  if (giftTypes.length) score += 10;
  score -= flags.length * 20;
  return Math.max(0, Math.min(100, score));
}

/**
 * Merge tags (additive union for human-authored content)
 */
function mergeTags(existing, matched, cap) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), ...matched])].slice(0, cap);
}

/**
 * Check if two age band sets are equal
 */
function sameBandSet(a, b) {
  const A = new Set(Array.isArray(a) ? a : []);
  const B = new Set(Array.isArray(b) ? b : []);
  return A.size === B.size && [...A].every((x) => B.has(x));
}

/**
 * Main enrichment function - processes a batch of products
 * Track 1: Deterministic enrichment (tags, quality, description) - FREE
 * Track 2: AI classification (category, gender, age_bands, age_restricted) - DISABLED BY DEFAULT
 */
export async function enrichProductBatch(prisma, { batchSize = 25, retailerId = null, classify = false, dryRun = false, apiKey = null }) {
  const where = {};
  
  // Filter by retailer if specified
  if (retailerId) {
    where.retailerId = retailerId;
    // Include both active and needs_review for per-retailer enrichment
    where.OR = [
      { status: 'ACTIVE' },
      { status: 'NEEDS_REVIEW' }
    ];
  } else {
    // Global mode: only active products
    where.status = 'ACTIVE';
  }

  // Fetch products that need enrichment
  const allProducts = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 5000, // Match base44 limit
    include: {
      retailer: true, // Need retailer for AI classification context
    },
  });

  // ===== Track 1: Deterministic enrichment =====
  const needsWork = allProducts.filter((product) =>
    !product.catalogueEnrichedAt ||
    !Array.isArray(product.interestTags) || 
    !Array.isArray(product.giftTypeTags) ||
    !Number.isFinite(Number(product.qualityScore))
  );

  const detBatch = dryRun ? [] : needsWork.slice(0, batchSize);
  console.log(`📊 Track 1 (Deterministic): ${detBatch.length} products need enrichment (${needsWork.length} total)`);

  // Process each product for deterministic enrichment
  const detUpdates = await Promise.all(detBatch.map(async (product) => {
    // Fetch description if missing
    const liveDescription = product.description || 
      await fetchDescription(product.productUrl || product.affiliateUrl);
    const description = liveDescription || "";

    // Build text for tag matching
    const tagText = `${product.name || ""} ${description} ${product.category || ""} ${(product.searchKeywords || []).join(" ")}`;
    
    // Match interest and gift type tags
    const matchedInterests = matchingTags(tagText, INTEREST_KEYWORDS);
    const matchedGiftTypes = matchingTags(tagText, GIFT_TYPE_KEYWORDS);
    
    // Determine if we should preserve existing tags (human-authored)
    const preserve = HUMANISH_SOURCES.has(product.sourceType || "legacy_unknown");
    
    const interests = preserve 
      ? mergeTags(product.interestTags, matchedInterests, 25) 
      : matchedInterests;
    
    const giftTypes = preserve 
      ? mergeTags(product.giftTypeTags, matchedGiftTypes, 15) 
      : matchedGiftTypes;
    
    // Generate search keywords
    const generatedKeywords = [...new Set(
      tagText.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4)
    )];
    
    const searchKeywords = preserve 
      ? mergeTags(product.searchKeywords, generatedKeywords, 40) 
      : generatedKeywords.slice(0, 40);
    
    // Calculate quality flags and score
    const flags = qualityFlags(product, description);
    const score = qualityScore(product, description, interests, giftTypes, flags);
    
    // Preserve classification_low_confidence flag if it exists
    if ((product.dataQualityFlags || []).includes(LOW_CONFIDENCE_FLAG)) {
      flags.push(LOW_CONFIDENCE_FLAG);
    }

    return {
      id: product.id,
      description: description || undefined,
      interestTags: interests,
      giftTypeTags: giftTypes,
      searchKeywords: searchKeywords,
      qualityScore: score,
      dataQualityFlags: flags,
      catalogueEnrichedAt: new Date(),
    };
  }));

  // ===== Track 2: AI classification =====
  let classificationLive = false;
  let classified = 0;
  let classifyRemaining = 0;
  let classificationError = "";
  let dryRunResults = null;
  const classifyPatches = new Map();

  // Check which products need classification (version-stamped)
  const isStamped = (p) =>
    Number(p?.aiClassifications?.version) >= CLASSIFY_VERSION && 
    !!p?.aiClassifications?.classifiedAt;
  
  const candidates = classify ? allProducts.filter((p) => !isStamped(p)) : [];

  if (classify && candidates.length > 0) {
    console.log(`🤖 Track 2 (AI Classification): ${candidates.length} products need classification`);

    if (!dryRun) {
      // Schema probe: test if aiClassifications field round-trips
      // This prevents burning API credits before schema is published
      try {
        const probeId = candidates[0].id;
        await prisma.product.update({
          where: { id: probeId },
          data: { aiClassifications: { probe_at: new Date().toISOString() } }
        });
        const probeRow = await prisma.product.findUnique({
          where: { id: probeId }
        });
        classificationLive = !!probeRow?.aiClassifications?.probe_at;
        console.log(`   Schema probe: ${classificationLive ? '✅ Live' : '❌ Not ready'}`);
      } catch (error) {
        classificationLive = false;
        console.log(`   Schema probe failed: ${error.message}`);
      }
    }

    if (dryRun || classificationLive) {
      const classBatch = candidates.slice(0, CLASSIFY_PER_RUN);
      
      // Build retailer map for classification context
      const retailerById = new Map();
      for (const p of classBatch) {
        if (p.retailerId && p.retailer) {
          retailerById.set(p.retailerId, p.retailer);
        }
      }

      try {
        console.log(`   Classifying ${classBatch.length} products with Claude...`);
        
        // Call AI classifier
        const results = await classifyProductsBatch(classBatch, retailerById, apiKey);
        
        // Process each classification result
        for (const { product, verdicts } of results) {
          if (classifyPatches.has(product.id)) continue;

          const vCat = verdicts.category;
          const vGen = verdicts.gender;
          const vBands = verdicts.age_bands;
          const vRes = verdicts.restricted;

          const patch = {};
          const gemOwned = product.sourceType === "curated_product";

          // ===== canonical_category =====
          // Machine-owned NEW field; write only when absent
          if (!product.canonicalCategory && vCat.value && vCat.confidence >= 0.6) {
            patch.canonicalCategory = vCat.value;
            vCat.applied = true;
          } else {
            vCat.skip_reason = product.canonicalCategory 
              ? "already_set" 
              : (vCat.value ? "low_confidence" : "no_verdict");
          }

          // Effective category for safety rules
          const effectiveCategory =
            patch.canonicalCategory || 
            product.canonicalCategory || 
            canonicalCategory(product.category) || 
            "";

          // ===== gender_applies_to =====
          // Correctable on non-curated products
          const genderBlank = !(product.genderAppliesTo || "").trim();
          const genderMachine = !gemOwned;
          
          if (vGen.value && ((genderBlank && vGen.confidence >= 0.7) || 
              (!genderBlank && genderMachine && vGen.confidence >= 0.7 && vGen.evidence))) {
            patch.genderAppliesTo = vGen.value;
            vGen.applied = true;
          } else if (!vGen.value) {
            vGen.skip_reason = "no_verdict";
          } else if (!genderBlank && !genderMachine) {
            vGen.skip_reason = "human_owned";
          } else {
            vGen.skip_reason = "low_confidence";
          }

          // ===== suitable_age_bands =====
          // Correctable on machine-derived bands
          const bandsEmpty = !Array.isArray(product.suitableAgeBands) || product.suitableAgeBands.length === 0;
          const bandsMachine = !gemOwned;
          
          if (vBands.value.length && ((bandsEmpty && vBands.confidence >= 0.7) || 
              (!bandsEmpty && bandsMachine && vBands.confidence >= 0.7 && vBands.evidence))) {
            patch.suitableAgeBands = vBands.value;
            vBands.applied = true;
          } else if (!vBands.value.length) {
            vBands.skip_reason = "no_verdict";
          } else if (!bandsEmpty && !bandsMachine) {
            vBands.skip_reason = "human_owned";
          } else {
            vBands.skip_reason = "low_confidence";
          }

          // R4 child-safety rules (subtractive only)
          const currentBands = patch.suitableAgeBands || product.suitableAgeBands || [];
          if (currentBands.length) {
            const safeBands = applyAgeSafetyRules(currentBands, {
              product,
              category: effectiveCategory,
              retailer: retailerById.get(product.retailerId) || null,
              gemOwned,
            });
            if (!sameBandSet(safeBands, currentBands)) {
              patch.suitableAgeBands = safeBands;
              vBands.safety_adjusted = true;
              vBands.safety_from = currentBands;
            }
          }

          // ===== age_restricted =====
          // Monotonic safety: can only escalate false -> true
          if (vRes.value === true && vRes.confidence >= 0.8 && vRes.evidence && 
              product.ageRestricted !== true) {
            patch.ageRestricted = true;
            vRes.applied = true;
          } else if (vRes.value === true && product.ageRestricted === true) {
            vRes.skip_reason = "already_set";
          } else if (vRes.value === true) {
            vRes.skip_reason = "low_confidence";
          }

          // Flag low-confidence classifications
          if ([vCat, vGen, vBands, vRes].some((v) => v.applied && v.confidence < 0.75)) {
            patch.dataQualityFlags = [
              ...new Set([...(product.dataQualityFlags || []), LOW_CONFIDENCE_FLAG])
            ];
          }

          // Store classification audit record
          patch.aiClassifications = {
            version: CLASSIFY_VERSION,
            classifiedAt: new Date().toISOString(),
            model: "claude-3-5-sonnet-20241022",
            category: vCat,
            gender: vGen,
            age_bands: vBands,
            restricted: vRes,
          };

          if (!dryRun) {
            classifyPatches.set(product.id, patch);
          } else {
            // Dry run: collect results without writing
            if (!dryRunResults) dryRunResults = [];
            dryRunResults.push({
              id: product.id,
              name: product.name,
              patch,
            });
          }
        }

        classified = results.length;
        if (classificationLive) {
          classifyRemaining = Math.max(0, candidates.length - classified);
        }
        
        console.log(`   ✅ Classified ${classified} products`);
      } catch (error) {
        // Classification failure doesn't void deterministic results
        classificationError = error?.message || "classification failed";
        console.error(`   ❌ Classification error: ${classificationError}`);
      }
    }
  }

  // ===== Merge + write =====
  const updatesById = new Map(detUpdates.map((u) => [u.id, u]));
  
  // Merge classification patches with deterministic updates
  for (const [id, patch] of classifyPatches) {
    const detUpdate = updatesById.get(id);
    
    // Same-run overlap guard: preserve det's fresh data_quality_flags
    if (detUpdate && patch.dataQualityFlags) {
      patch.dataQualityFlags = [
        ...new Set([...(detUpdate.dataQualityFlags || []), LOW_CONFIDENCE_FLAG])
      ];
    }
    
    updatesById.set(id, { ...(detUpdate || { id }), ...patch });
  }

  const updates = [...updatesById.values()];

  // Bulk write (unless dry run)
  if (!dryRun && updates.length > 0) {
    console.log(`💾 Writing ${updates.length} product updates...`);
    await prisma.$transaction(
      updates.map(update => {
        const { id, ...data } = update;
        return prisma.product.update({
          where: { id },
          data,
        });
      })
    );
    console.log(`   ✅ Updates saved`);
  }

  const remaining = Math.max(0, needsWork.length - detBatch.length) + 
    (classificationLive ? classifyRemaining : 0);

  return {
    processed: dryRun ? 0 : updates.length,
    remaining,
    classified,
    classification_live: classificationLive,
    classification_error: classificationError || undefined,
    dry_run: dryRun || undefined,
    dry_run_results: dryRunResults || undefined,
  };
}
