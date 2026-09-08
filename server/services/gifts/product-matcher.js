/**
 * Product Matcher Service
 * 
 * Matches recipients with suitable products from the catalogue
 * based on profile, budget, and preferences.
 */

export default class ProductMatcher {
  constructor() {
    this.MIN_SCORE_THRESHOLD = 10;
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
    };

    // Fetch products with retailers
    const products = await prisma.product.findMany({
      where,
      include: {
        retailer: true,
      },
      take: 500, // Limit for performance
    });

    // Score and filter products
    const scoredProducts = products
      .map(product => ({
        ...product,
        ...this.scoreProduct(product, recipient, derived),
      }))
      .filter(p => p.score >= this.MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

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

    // Interest matching
    const interests = [
      ...(recipient.interests || []),
      ...(derived.canonical_interests || [])
    ];
    
    interests.forEach(interest => {
      const interestLower = interest.toLowerCase();
      const productText = this.getProductText(product).toLowerCase();
      
      if (productText.includes(interestLower)) {
        score += 15;
        signals.push(`Interest: ${interest}`);
      }
    });

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
