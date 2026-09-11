/**
 * Product Matcher Service
 * 
 * Matches recipients with suitable products from the catalogue
 * based on profile, budget, and preferences.
 */

export default class ProductMatcher {
  constructor() {
    this.MIN_SCORE_THRESHOLD = 20; // Increased from 10 to ensure better quality
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

    // Build product query filters
    const where = {
      status: 'ACTIVE', // Use uppercase enum value
      price: {
        gte: budgetMin || 0,
        lte: budgetMax || 1000,
      },
      qualityScore: {
        gte: this.MIN_QUALITY_SCORE, // Only quality products
      },
      // Ensure product has basic required data
      NOT: {
        name: null,
      },
    };

    // Fetch products with retailers
    const products = await prisma.product.findMany({
      where,
      include: {
        retailer: true,
      },
      take: 500, // Limit for performance
    });

    console.log(`   Fetched ${products.length} products from catalogue`);
    
    // Validate product data quality before scoring
    const validProducts = products.filter(p => this.isValidProduct(p));
    console.log(`   ${validProducts.length} products passed quality validation`);

    // Score and filter products
    const scoredProducts = validProducts
      .map(product => ({
        ...product,
        ...this.scoreProduct(product, recipient, derived),
      }))
      .filter(p => p.score >= this.MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    console.log(`   ${scoredProducts.length} products scored above threshold (${this.MIN_SCORE_THRESHOLD})`);

    if (scoredProducts.length === 0) {
      console.warn(`   ⚠️  WARNING: No products found matching interests: ${recipient.interests?.join(', ')}`);
    }

    return scoredProducts.slice(0, 100); // Top 100 candidates for AI selection
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
