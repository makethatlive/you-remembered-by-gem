/**
 * Product Matcher Service
 * 
 * Matches recipients with suitable products from the catalogue
 * based on profile, budget, and preferences.
 */

export default class ProductMatcher {
  constructor() {
    this.MIN_SCORE_THRESHOLD = 15; // Lowered from 20 to 15 for small catalogues
    this.MIN_QUALITY_SCORE = 50; // Reject products with poor quality
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

    // Must have description (not just "sss" or similar)
    if (!product.description || product.description.length < 10 || /^s+$/.test(product.description)) {
      return false;
    }

    // Must have interest tags or gift type tags
    const hasTags = (product.interestTags && product.interestTags.length > 0) ||
                    (product.giftTypeTags && product.giftTypeTags.length > 0);
    if (!hasTags) {
      return false;
    }

    // Must have product URL
    if (!product.productUrl || product.productUrl === 'N/A') {
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
      genderFilter = { in: ['MALE', 'Male', 'UNISEX', 'Unisex'] };
    } else if (gender === 'FEMALE' || gender === 'Female') {
      genderFilter = { in: ['FEMALE', 'Female', 'UNISEX', 'Unisex'] };
    } else if (gender === 'NON_BINARY' || gender === 'PREFER_NOT_TO_SAY') {
      genderFilter = { in: ['UNISEX', 'Unisex'] };
    } else {
      // Default: allow all if gender not specified
      genderFilter = undefined;
    }

    console.log(`   Gender filter: ${genderFilter ? genderFilter.in.join(', ') : 'None (all products)'}`);

    // Build base filters (always applied)
    const baseFilters = {
      status: 'ACTIVE',
      price: {
        gte: budgetMinWithMargin,
        lte: budgetMaxWithMargin,
      },
      qualityScore: {
        gte: this.MIN_QUALITY_SCORE,
      },
      name: { not: null },
      description: { not: null },
      productUrl: { not: null },
    };

    // Add gender filter if defined
    if (genderFilter) {
      baseFilters.genderAppliesTo = genderFilter;
    }

    const recipientInterests = recipient.interests || [];
    
    // TIER 1: Curated + Interest Match (Priority)
    console.log(`\n📦 TIER 1: Curated products with interest match`);
    console.log(`   Interests: ${recipientInterests.join(', ') || 'None'}`);
    
    const tier1Where = {
      ...baseFilters,
      sourceType: 'CURATED_PRODUCT',
    };

    // Add interest filter if interests exist
    if (recipientInterests.length > 0) {
      tier1Where.OR = recipientInterests.map(interest => ({
        interestTags: { has: interest }
      }));
    }

    const tier1Products = await prisma.product.findMany({
      where: tier1Where,
      include: { retailer: true },
      orderBy: { qualityScore: 'desc' },
      take: 100,
    });

    console.log(`   Found ${tier1Products.length} curated products with interest match`);

    // Score and validate Tier 1
    const tier1Valid = tier1Products.filter(p => this.isValidProduct(p));
    const tier1Scored = tier1Valid.map(product => ({
      ...product,
      ...this.scoreProduct(product, recipient, derived),
      tier: 'CURATED_INTEREST',
    }));

    // TIER 2: Scraped + Interest Match (if Tier 1 insufficient)
    let tier2Scored = [];
    if (tier1Scored.length < 15 && recipientInterests.length > 0) {
      console.log(`\n📦 TIER 2: Scraped products with interest match (need ${15 - tier1Scored.length} more)`);
      
      const tier2Where = {
        ...baseFilters,
        sourceType: { in: ['CURATED_RETAILER', 'SHOPIFY_UPLOAD'] },
        OR: recipientInterests.map(interest => ({
          interestTags: { has: interest }
        })),
      };

      const tier2Products = await prisma.product.findMany({
        where: tier2Where,
        include: { retailer: true },
        orderBy: { qualityScore: 'desc' },
        take: 100,
      });

      console.log(`   Found ${tier2Products.length} scraped products with interest match`);

      const tier2Valid = tier2Products.filter(p => this.isValidProduct(p));
      tier2Scored = tier2Valid.map(product => ({
        ...product,
        ...this.scoreProduct(product, recipient, derived),
        tier: 'SCRAPED_INTEREST',
      }));
    }

    // TIER 3: ANY product (gender + age + budget only, no interest required)
    let tier3Scored = [];
    const totalSoFar = tier1Scored.length + tier2Scored.length;
    
    if (totalSoFar < 15) {
      console.log(`\n📦 TIER 3: Any products matching gender/age/budget (need ${15 - totalSoFar} more)`);
      console.log(`   ⚠️  Relaxing interest requirements - graceful degradation`);
      
      const tier3Where = {
        ...baseFilters,
        // No source filter - both curated and scraped
        // No interest filter - any product that fits basics
      };

      const tier3Products = await prisma.product.findMany({
        where: tier3Where,
        include: { retailer: true },
        orderBy: { qualityScore: 'desc' },
        take: 200,
      });

      console.log(`   Found ${tier3Products.length} general products (no interest match required)`);

      // Exclude products already in tier 1 or 2
      const existingIds = [...tier1Scored, ...tier2Scored].map(p => p.id);
      const tier3Valid = tier3Products
        .filter(p => this.isValidProduct(p))
        .filter(p => !existingIds.includes(p.id));

      tier3Scored = tier3Valid.map(product => ({
        ...product,
        ...this.scoreProduct(product, recipient, derived),
        tier: 'GENERAL_FALLBACK',
        score: (product.score || 0) * 0.7, // Slightly penalize general fallback
      }));
    }

    // Merge all tiers
    const allCandidates = [...tier1Scored, ...tier2Scored, ...tier3Scored];
    
    // Filter by minimum score threshold (lowered for tier 3)
    const scoredProducts = allCandidates
      .filter(p => {
        if (p.tier === 'GENERAL_FALLBACK') {
          return p.score >= 5; // Very low threshold for general fallback
        }
        return p.score >= this.MIN_SCORE_THRESHOLD;
      })
      .sort((a, b) => {
        // Prioritize by tier first, then by score
        const tierPriority = { CURATED_INTEREST: 3, SCRAPED_INTEREST: 2, GENERAL_FALLBACK: 1 };
        const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
        if (tierDiff !== 0) return tierDiff;
        return b.score - a.score;
      });

    console.log(`\n✅ FINAL CANDIDATE POOL:`);
    console.log(`   Tier 1 (Curated+Interest): ${tier1Scored.length}`);
    console.log(`   Tier 2 (Scraped+Interest): ${tier2Scored.length}`);
    console.log(`   Tier 3 (General Fallback): ${tier3Scored.length}`);
    console.log(`   Total after scoring: ${scoredProducts.length}`);

    if (scoredProducts.length === 0) {
      console.warn(`\n⚠️  WARNING: No products found for ${recipient.name}`);
      console.warn(`   This may indicate catalogue coverage gap for:`);
      console.warn(`   - Gender: ${gender}`);
      console.warn(`   - Budget: £${budgetMin}-£${budgetMax}`);
      console.warn(`   - Interests: ${recipientInterests.join(', ')}`);
    }

    // Return top candidates (up to 100 for AI to choose from)
    return scoredProducts.slice(0, 100);
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

    // Interest matching - STRICT: Use interestTags array directly
    const recipientInterests = (recipient.interests || []).map(i => i.toLowerCase());
    const productInterestTags = (product.interestTags || []).map(t => t.toLowerCase());
    
    // Direct tag matching (highest value)
    const directMatches = recipientInterests.filter(interest => 
      productInterestTags.includes(interest)
    );
    
    if (directMatches.length > 0) {
      const matchScore = directMatches.length * 30; // 30 points per exact match
      score += matchScore;
      directMatches.forEach(match => {
        signals.push(`✓ Interest: ${match}`);
      });
    }
    
    // Partial text matching (lower value, fallback)
    const additionalMatches = recipientInterests.filter(interest => {
      const interestLower = interest.toLowerCase();
      return !directMatches.includes(interest) && 
             productInterestTags.some(tag => tag.includes(interestLower) || interestLower.includes(tag));
    });
    
    if (additionalMatches.length > 0) {
      score += additionalMatches.length * 15; // 15 points per partial match
      additionalMatches.forEach(match => {
        signals.push(`~ Interest: ${match}`);
      });
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
