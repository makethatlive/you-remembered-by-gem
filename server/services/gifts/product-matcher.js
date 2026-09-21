/**
 * Product Matcher Service
 * 
 * Matches recipients with suitable products from the catalogue
 * based on profile, budget, and preferences.
 */

import { IntelligentMatcher } from './intelligent-matcher.js';

export default class ProductMatcher {
  constructor() {
    this.MIN_SCORE_THRESHOLD = 15; // Lowered from 20 to 15 for small catalogues
    this.MIN_QUALITY_SCORE = 50; // Reject products with poor quality
    this.matcher = new IntelligentMatcher(); // ✅ Initialize intelligent matcher
  }

  /**
   * Deduplicate products by ID, keeping the one with higher tier priority
   */
  deduplicateByProductId(products) {
    const seen = new Map();
    
    products.forEach(p => {
      const existing = seen.get(p.id);
      
      // Keep the one with higher priority (lower tierPriority number)
      if (!existing || p.tierPriority < existing.tierPriority) {
        seen.set(p.id, p);
      }
    });
    
    return Array.from(seen.values());
  }

  /**
   * Validate product has required data quality
   * @param {object} product - Product to validate
   * @returns {boolean} Is valid
   */
  isValidProduct(product) {
    // Must have name
    if (!product.name || product.name === 'undefined' || product.name.length < 3) {
      return false;
    }

    // ✅ RELAXED: Description not required for CURATED_PRODUCT
    // CURATED products are manually selected so quality is pre-verified
    if (product.sourceType !== 'CURATED_PRODUCT') {
      if (!product.description || product.description.length < 10 || /^s+$/.test(product.description)) {
        return false;
      }
    }

    // ✅ RELAXED: CURATED_PRODUCT can skip tag requirement (manually curated, use category fallback)
    // Other products must have interest tags or gift type tags for matching
    if (product.sourceType !== 'CURATED_PRODUCT') {
      const hasTags = (product.interestTags && product.interestTags.length > 0) ||
                      (product.giftTypeTags && product.giftTypeTags.length > 0);
      if (!hasTags) {
        return false;
      }
    }

    // Must have product URL
    if (!product.productUrl || product.productUrl === 'N/A') {
      return false;
    }

    // ✅ Quality score check (must be >= 50 if present)
    // This matches the quality monitor check to avoid rejection after AI selection
    if (product.qualityScore !== null && product.qualityScore !== undefined && product.qualityScore < 50) {
      return false;
    }

    // Must not have critical data quality flags
    if (product.dataQualityFlags && product.dataQualityFlags.includes('missing_description')) {
      return false;
    }

    return true;
  }

  /**
   * Find products that match recipient profile
   * @param {object} recipient - Recipient data with derived profile
   * @param {object} prisma - Prisma client
   * @returns {Promise<array>} Array of scored products
   */
  async findMatchingProducts(recipient, prisma) {
    const { budgetMin, budgetMax, ageBand, gender } = recipient;
    const derived = recipient.derivedProfile || {};

    console.log(`\n🔍 Finding products for ${recipient.name}`);
    console.log(`   Budget: £${budgetMin}-£${budgetMax} (with ±5% margin)`);
    console.log(`   Gender: ${gender}`);
    console.log(`   Age Band: ${ageBand}`);

    // HARD FILTERS - Applied before AI sees anything
    // Budget with ±5% margin
    const budgetMinWithMargin = (budgetMin || 0) * 0.95;
    const budgetMaxWithMargin = (budgetMax || 1000) * 1.05;

    // Gender filter logic (per client spec)
    let genderFilter;
    if (gender === 'MALE' || gender === 'Male') {
      genderFilter = { in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
    } else if (gender === 'FEMALE' || gender === 'Female') {
      genderFilter = { in: ['FEMALE', 'Female', 'WOMEN', 'Women', 'UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
    } else if (gender === 'NON_BINARY' || gender === 'PREFER_NOT_TO_SAY') {
      genderFilter = { in: ['UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
    } else {
      // Default: allow all if gender not specified
      genderFilter = undefined;
    }

    // ✅ TEXT-BASED AGE FILTER (for kids/teens)
    // For recipients under 18, search product text for kid-friendly keywords
    let ageKeywordFilter;
    const isKid = ['ZERO_TO_10', 'ELEVEN_TO_17'].includes(ageBand);
    
    if (isKid) {
      // Keywords to search in product name, description, category
      const kidKeywords = ageBand === 'ZERO_TO_10' 
        ? ['kid', 'child', 'baby', 'toddler', 'toy', 'game', 'play']
        : ['teen', 'youth', 'young', 'kid', 'child', 'toy', 'game'];
      
      console.log(`   🎯 Kid detected (${ageBand}) - searching text for: ${kidKeywords.join(', ')}`);
      
      // Build OR conditions for text search across name/description/category
      ageKeywordFilter = {
        OR: kidKeywords.flatMap(keyword => [
          { name: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          { category: { contains: keyword, mode: 'insensitive' } }
        ])
      };
    }
    // Adults: No age filtering

    console.log(`   Age filter: ${ageKeywordFilter ? 'Applied (text search)' : 'None (Adult)'}`);

    // Build base filters (always applied)
    const baseFilters = {
      status: 'ACTIVE',  // Only fetch ACTIVE products
      price: {
        gte: budgetMinWithMargin,
        lte: budgetMaxWithMargin,
      },
      OR: [
        { qualityScore: { gte: this.MIN_QUALITY_SCORE } },
        { qualityScore: null }  // Allow products without quality score (newly imported)
      ],
      // Note: name, description, productUrl null checks handled in isValidProduct()
      // Prisma doesn't support { not: null } syntax for string fields
    };

    // Add gender filter if defined
    if (genderFilter) {
      baseFilters.genderAppliesTo = genderFilter;
    }

    // ✅ Merge age keyword filter into base filters (for kids only)
    if (ageKeywordFilter) {
      Object.assign(baseFilters, ageKeywordFilter);
    }

    const recipientInterests = recipient.interests || [];
    
    // ═══════════════════════════════════════════════════════════════════════
    // TIER 1: Premium CURATED_PRODUCT + Interest Match
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`\n📦 TIER 1: Premium curated products (CURATED_PRODUCT) + Interest Match`);
    console.log(`   Interests: ${recipientInterests.join(', ') || 'None'}`);
    
    const tier1Where = {
      ...baseFilters,
      sourceType: 'CURATED_PRODUCT',
    };

    const tier1Products = await prisma.product.findMany({
      where: tier1Where,
      include: { retailer: true },
      orderBy: { qualityScore: 'desc' },
      take: 200,
    });

    // ✅ INTELLIGENT INTEREST MATCHING
    let tier1ProductsFiltered = tier1Products;
    if (recipientInterests.length > 0) {
      tier1ProductsFiltered = tier1Products.filter(product => 
        this.matcher.hasInterestMatch(product, recipient)
      );
    }

    console.log(`   Found ${tier1ProductsFiltered.length} premium curated with interest match (from ${tier1Products.length} total)`);

    // Score and validate Tier 1
    console.log(`\n🔍 Validating ${tier1ProductsFiltered.length} Tier 1 products...`);
    const tier1Valid = tier1ProductsFiltered.filter(p => this.isValidProduct(p));
    console.log(`   ✅ Valid: ${tier1Valid.length} | ❌ Invalid: ${tier1ProductsFiltered.length - tier1Valid.length}`);
    
    const tier1Scored = tier1Valid.map(product => ({
      ...product,
      ...this.scoreProduct(product, recipient, derived),
      tier: 'PREMIUM_CURATED',
      tierPriority: 1  // ✅ Highest priority
    }));

    // ✅ SMART TIER PROGRESSION
    const TARGET_CANDIDATES = 20; // Sufficient for AI to choose 10 gifts from
    
    // ═══════════════════════════════════════════════════════════════════════
    // TIER 2: All Curated Products (CURATED_PRODUCT + CURATED_RETAILER + SHOPIFY_UPLOAD) + Interest Match
    // ═══════════════════════════════════════════════════════════════════════
    let tier2Scored = [];
    if (tier1Scored.length < TARGET_CANDIDATES && recipientInterests.length > 0) {
      console.log(`\n📦 TIER 2: All curated products (CURATED_RETAILER + SHOPIFY_UPLOAD) + Interest Match`);
      console.log(`   Need ${TARGET_CANDIDATES - tier1Scored.length} more products`);
      
      const tier2Where = {
        ...baseFilters,
        sourceType: { in: ['CURATED_RETAILER', 'SHOPIFY_UPLOAD'] },
      };

      const tier2Products = await prisma.product.findMany({
        where: tier2Where,
        include: { retailer: true },
        orderBy: { qualityScore: 'desc' },
        take: 300,
      });

      // ✅ INTELLIGENT INTEREST MATCHING (in-memory filter)
      const tier2ProductsWithInterest = tier2Products.filter(product =>
        this.matcher.hasInterestMatch(product, recipient)
      );

      console.log(`   Found ${tier2ProductsWithInterest.length} curated products with interest match (from ${tier2Products.length} candidates)`);

      const tier2Valid = tier2ProductsWithInterest.filter(p => this.isValidProduct(p));
      tier2Scored = tier2Valid.map(product => ({
        ...product,
        ...this.scoreProduct(product, recipient, derived),
        tier: 'CURATED_BROAD',
        tierPriority: 2
      }));
    } else if (tier1Scored.length >= TARGET_CANDIDATES) {
      console.log(`\n✅ TIER 2: Skipped (Tier 1 has ${tier1Scored.length} products - sufficient)`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TIER 3: FALLBACK - All Products (Any sourceType) WITHOUT Interest Match
    // ═══════════════════════════════════════════════════════════════════════
    let tier3Scored = [];
    const totalSoFar = tier1Scored.length + tier2Scored.length;
    
    if (totalSoFar < TARGET_CANDIDATES) {
      console.log(`\n📦 TIER 3: Fallback - All products (any source) without interest requirement`);
      console.log(`   Need ${TARGET_CANDIDATES - totalSoFar} more products`);
      console.log(`   ⚠️  Relaxing interest requirements - graceful degradation`);
    
    const tier3Where = {
      ...baseFilters,
      // ✅ NO sourceType filter - includes ALL: CURATED_PRODUCT, CURATED_RETAILER, SHOPIFY_UPLOAD, LEGACY_UNKNOWN
      // ✅ NO interest filter - any product matching gender/age/budget
    };

    const tier3Products = await prisma.product.findMany({
      where: tier3Where,
      include: { retailer: true },
      orderBy: { qualityScore: 'desc' },
      take: 200,
    });

    console.log(`   Found ${tier3Products.length} fallback products (all sources, no interest match)`);

    // Exclude products already in tier 1 or 2
    const existingIds = [...tier1Scored, ...tier2Scored].map(p => p.id);
    const tier3Valid = tier3Products
      .filter(p => this.isValidProduct(p))
      .filter(p => !existingIds.includes(p.id));

    tier3Scored = tier3Valid.map(product => {
      const scoring = this.scoreProduct(product, recipient, derived);
      return {
        ...product,
        ...scoring,
        tier: 'GENERAL_FALLBACK',
        tierPriority: 3,  // ✅ Lowest priority
        score: scoring.score * 0.85, // Light penalty for no interest match
      };
    });
    } else {
      console.log(`\n✅ TIER 3: Skipped (Tier 1+2 have ${totalSoFar} products - sufficient)`);
    }

    // ✅ IMPROVED: Merge all tiers, deduplicate, sort by SCORE FIRST
    const allCandidates = [...tier1Scored, ...tier2Scored, ...tier3Scored];
    
    // Deduplicate by product ID (keep higher tier if duplicate)
    const uniqueProducts = this.deduplicateByProductId(allCandidates);
    
    // Filter by minimum score threshold
    const scoredProducts = uniqueProducts
      .filter(p => {
        if (p.tier === 'GENERAL_FALLBACK') {
          return p.score >= 3; // Very low threshold for fallback
        }
        
        // ✅ SPECIAL CASE: Recipients under 18 (kids/teens)
        // They don't have interests/giftTypes in UI, only hobbiesAndInterests
        // Accept ANY product that passes validation - rely on age band and gender filtering
        const isYoungRecipient = ['ZERO_TO_10', 'ELEVEN_TO_17'].includes(ageBand);
        if (isYoungRecipient) {
          return true; // Accept all valid products for kids - let AI choose best ones
        }
        
        // ✅ SPECIAL CASE: If adult recipient has NO interests at all
        // Use lower threshold for graceful degradation
        if (recipientInterests.length === 0) {
          return p.score >= 8; // Lower threshold when no interests provided
        }
        
        return p.score >= this.MIN_SCORE_THRESHOLD;
      })
      .sort((a, b) => {
        // ✅ PRIORITY: Sort by SCORE first, then by tier priority
        if (b.score !== a.score) {
          return b.score - a.score;  // Higher score = better
        }
        // If scores are equal, prefer higher tier
        return a.tierPriority - b.tierPriority;  // Lower number = higher priority
      });

    console.log(`\n✅ FINAL CANDIDATE POOL:`);
    console.log(`   Tier 1 (Premium Curated + Interest): ${tier1Scored.length}`);
    console.log(`   Tier 2 (All Curated + Interest): ${tier2Scored.length}`);
    console.log(`   Tier 3 (Fallback - No Interest): ${tier3Scored.length}`);
    console.log(`   Total after scoring: ${scoredProducts.length}`);
    
    // Debug: Show score distribution for young recipients
    if (['ZERO_TO_10', 'ELEVEN_TO_17'].includes(ageBand) && scoredProducts.length < 10) {
      console.log(`\n📊 Score distribution (showing why products filtered):`);
      const allScored = [...tier1Scored, ...tier2Scored, ...tier3Scored];
      const scoreDist = {
        '0-3': 0,
        '3-5': 0,
        '5-10': 0,
        '10-15': 0,
        '15+': 0
      };
      allScored.forEach(p => {
        if (p.score < 3) scoreDist['0-3']++;
        else if (p.score < 5) scoreDist['3-5']++;
        else if (p.score < 10) scoreDist['5-10']++;
        else if (p.score < 15) scoreDist['10-15']++;
        else scoreDist['15+']++;
      });
      console.log(`   0-3 points (passed): ${scoreDist['0-3']}`);
      console.log(`   3-5 points (passed): ${scoreDist['3-5']}`);
      console.log(`   5-10 points (passed): ${scoreDist['5-10']}`);
      console.log(`   10-15 points: ${scoreDist['10-15']}`);
      console.log(`   15+ points: ${scoreDist['15+']}`);
    }

    // ✅ DIVERSITY-BASED SAMPLING: Ensure variety in categories and retailers
    const MAX_PRODUCTS_FOR_AI = 20;
    let limitedProducts;
    
    if (scoredProducts.length <= MAX_PRODUCTS_FOR_AI) {
      // If we have 20 or fewer products, use all of them
      limitedProducts = scoredProducts;
    } else {
      // ✅ INTELLIGENT DIVERSITY SAMPLING
      // Problem: If user selects "Gardening", we don't want all 20 products to be gardening items
      // Solution: Sample products ensuring category and retailer diversity
      console.log(`\n🎨 Applying diversity sampling to ${scoredProducts.length} products...`);
      
      limitedProducts = this.applyDiversitySampling(scoredProducts, MAX_PRODUCTS_FOR_AI, recipient);
      
      console.log(`   ⚡ Selected ${limitedProducts.length} diverse products for AI (from ${scoredProducts.length} candidates)`);
    }

    if (limitedProducts.length === 0) {
      console.warn(`\n⚠️  WARNING: No products found for ${recipient.name}`);
      console.warn(`   This may indicate catalogue coverage gap for:`);
      console.warn(`   - Gender: ${gender}`);
      console.warn(`   - Budget: £${budgetMin}-£${budgetMax}`);
      console.warn(`   - Interests: ${recipientInterests.join(', ')}`);
    }

    // Return top 20 candidates for AI (reduces tokens & improves quality)
    return limitedProducts;
  }

  /**
   * Apply diversity sampling to ensure variety in categories and retailers
   * Prevents sending AI all products from same category (e.g., all gardening items)
   * 
   * Strategy:
   * 1. Group products by top-level category (e.g., "Gardening & outdoor" from "Gardening & outdoor > Plants")
   * 2. Distribute slots proportionally, but cap per category to force diversity
   * 3. Within each category, ensure retailer diversity
   * 4. Fill remaining slots with highest-scoring products
   * 
   * @param {Array} products - Scored products sorted by score (descending)
   * @param {number} targetCount - Target number of products (usually 20)
   * @param {object} recipient - Recipient data for interest-based weighting
   * @returns {Array} Diverse subset of products
   */
  applyDiversitySampling(products, targetCount, recipient) {
    if (products.length <= targetCount) return products;

    const selected = [];
    const categoryGroups = new Map(); // Top-level category -> products
    const retailerUsage = new Map(); // Retailer ID -> count used
    
    // Helper: Extract top-level category from "Cat1 > Cat2 > Cat3"
    const getTopCategory = (product) => {
      if (!product.category) return 'Uncategorized';
      const parts = product.category.split('>').map(p => p.trim());
      return parts[0] || 'Uncategorized';
    };
    
    // Step 1: Group products by top-level category
    products.forEach(product => {
      const topCat = getTopCategory(product);
      if (!categoryGroups.has(topCat)) {
        categoryGroups.set(topCat, []);
      }
      categoryGroups.get(topCat).push(product);
    });
    
    console.log(`   📊 Found ${categoryGroups.size} top-level categories`);
    
    // Step 2: Calculate diversity constraints
    const MAX_PER_CATEGORY = Math.max(3, Math.floor(targetCount / Math.max(categoryGroups.size, 3)));
    const MAX_PER_RETAILER = Math.max(3, Math.floor(targetCount / 5)); // Max 5 retailers ideally
    
    console.log(`   🎯 Diversity limits: ${MAX_PER_CATEGORY} per category, ${MAX_PER_RETAILER} per retailer`);
    
    // Step 3: Sample from each category with retailer diversity
    const categoryEntries = Array.from(categoryGroups.entries())
      .sort((a, b) => {
        // Prioritize categories with higher-scoring products
        const maxScoreA = Math.max(...a[1].map(p => p.score));
        const maxScoreB = Math.max(...b[1].map(p => p.score));
        return maxScoreB - maxScoreA;
      });
    
    // Round 1: Take top products from each category (respecting constraints)
    for (const [category, categoryProducts] of categoryEntries) {
      let taken = 0;
      
      for (const product of categoryProducts) {
        if (selected.length >= targetCount) break;
        if (taken >= MAX_PER_CATEGORY) break;
        
        const retailerId = product.retailerId;
        const retailerCount = retailerUsage.get(retailerId) || 0;
        
        // Check retailer limit
        if (retailerCount >= MAX_PER_RETAILER) continue;
        
        // Add product
        selected.push(product);
        taken++;
        retailerUsage.set(retailerId, retailerCount + 1);
      }
      
      if (taken > 0) {
        console.log(`   ✓ ${category}: ${taken} products`);
      }
    }
    
    // Round 2: Fill remaining slots with highest-scoring products (ignoring constraints)
    if (selected.length < targetCount) {
      console.log(`   📦 Filling remaining ${targetCount - selected.length} slots with top-scored products...`);
      
      const selectedIds = new Set(selected.map(p => p.id));
      
      for (const product of products) {
        if (selected.length >= targetCount) break;
        if (selectedIds.has(product.id)) continue;
        
        selected.push(product);
      }
    }
    
    // Sort final selection by score (AI will see them in score order)
    selected.sort((a, b) => b.score - a.score);
    
    // Log final diversity stats
    const finalCategories = new Set(selected.map(p => getTopCategory(p)));
    const finalRetailers = new Set(selected.map(p => p.retailerId));
    console.log(`   ✅ Final diversity: ${finalCategories.size} categories, ${finalRetailers.size} retailers`);
    
    return selected;
  }

  /**
   * Score a product against recipient profile
   * @param {object} product - Product data
   * @param {object} recipient - Recipient data
   * @param {object} derived - Derived profile insights
   * @returns {object} Score and signals
   */
  scoreProduct(product, recipient, derived) {
    const signals = [];
    let score = 0;

    // Base quality score
    if (product.qualityScore) {
      score += product.qualityScore / 10;
      signals.push(`Quality: ${product.qualityScore}/100`);
    }

    // ✅ INTELLIGENT INTEREST MATCHING
    // Use intelligent matcher for fuzzy, semantic, and keyword matching
    const matches = this.matcher.getMatchingTagsWithScores(product, recipient);
    
    if (matches.length > 0) {
      // Add scores for each match
      matches.forEach(match => {
        score += match.score;
        
        // Add signal with match type indicator
        const indicator = {
          'EXACT': '✓',
          'KEYWORD': '✓',
          'ALIAS': '≈',
          'FUZZY': '~',
          'SEMANTIC': '≈'
        }[match.matchQuality] || '?';
        
        signals.push(`${indicator} Interest: ${match.recipientInterest}`);
      });
      
      // Bonus for multiple interest matches
      if (matches.length > 1) {
        score += 5;
      }
    }

    // Gift type matching
    const giftTypes = [
      ...(recipient.giftTypes || []),
      ...(derived.canonical_gift_types || [])
    ];
    
    giftTypes.forEach(giftType => {
      const giftTypeLower = giftType.toLowerCase();
      const productText = this.getProductText(product).toLowerCase();
      
      if (productText.includes(giftTypeLower)) {
        score += 12;
        signals.push(`Gift Type: ${giftType}`);
      }
    });

    // Persona keyword matching
    if (derived.persona_keywords && derived.persona_keywords.length > 0) {
      const productText = this.getProductText(product).toLowerCase();
      const matches = derived.persona_keywords.filter(kw => 
        productText.includes(kw.toLowerCase())
      );
      
      if (matches.length > 0) {
        score += Math.min(20, matches.length * 5);
        signals.push(`Keywords: ${matches.slice(0, 3).join(', ')}`);
      }
    }

    // ✅ HOBBIES & INTERESTS MATCHING (for kids/teens and text descriptions)
    // This field is used for recipients under 18 who don't have structured interests
    if (recipient.hobbiesAndInterests) {
      const hobbiesText = recipient.hobbiesAndInterests.toLowerCase();
      const productText = this.getProductText(product).toLowerCase();
      
      // Extract keywords from hobbies text (split by common separators)
      const hobbyKeywords = hobbiesText
        .split(/[,;\.]+/)
        .map(h => h.trim())
        .filter(h => h.length > 3); // Only meaningful words
      
      const matches = hobbyKeywords.filter(hobby => 
        productText.includes(hobby)
      );
      
      if (matches.length > 0) {
        score += Math.min(15, matches.length * 5);
        signals.push(`Hobbies: ${matches.slice(0, 2).join(', ')}`);
      }
    }

    // Budget preference (favor middle of range)
    if (recipient.budgetMin && recipient.budgetMax) {
      const midpoint = (recipient.budgetMin + recipient.budgetMax) / 2;
      const range = recipient.budgetMax - recipient.budgetMin;
      const distance = Math.abs(product.price - midpoint) / range;
      const budgetScore = Math.max(0, 5 - distance * 5);
      score += budgetScore;
      
      if (budgetScore > 2) {
        signals.push(`Price: £${product.price}`);
      }
    }

    // Avoid categories
    if (derived.avoid_categories && derived.avoid_categories.length > 0) {
      const productText = this.getProductText(product).toLowerCase();
      const hasAvoided = derived.avoid_categories.some(avoid => 
        productText.includes(avoid.toLowerCase())
      );
      
      if (hasAvoided) {
        score -= 50; // Heavy penalty for avoided items
        signals.push('AVOIDED CATEGORY');
      }
    }

    return {
      score: Math.round(score * 10) / 10,
      matchSignals: signals.slice(0, 4), // Keep top 4 signals
    };
  }

  /**
   * Get searchable text from product
   * @param {object} product - Product data
   * @returns {string} Combined product text
   */
  getProductText(product) {
    return [
      product.name,
      product.description,
      product.category,
      product.retailer?.name,
      ...(product.interestTags || []),
      ...(product.giftTypeTags || []),
      ...(product.searchKeywords || []),
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Normalize text for matching
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
