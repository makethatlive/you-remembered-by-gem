/**
 * Product Matcher Service
 * 
 * Matches recipients with suitable products from the catalogue
 * based on profile, budget, and preferences.
 */

import { IntelligentMatcher } from './intelligent-matcher.js';
import { doAgeRangesOverlap, isChildrenAgeBand } from '../../lib/ageRangeUtils.js';

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

    // ✅ GEM'S PICKS (CURATED_PRODUCT): Minimal validation
    // These are manually curated by Gem - trust the quality
    if (product.sourceType === 'CURATED_PRODUCT') {
      // Only check essentials: name and product URL
      if (!product.productUrl || product.productUrl === 'N/A') {
        return false;
      }
      return true; // Accept all Gem's Picks - Gem has vetted them
    }

    // ✅ OTHER SOURCES: Stricter validation
    // CURATED_RETAILER and SHOPIFY_UPLOAD need description
    if (!product.description || product.description.length < 10 || /^\s+$/.test(product.description)) {
      return false;
    }

    // Must have interest tags or gift type tags for matching
    const hasTags = (product.interestTags && product.interestTags.length > 0) ||
                    (product.giftTypeTags && product.giftTypeTags.length > 0);
    if (!hasTags) {
      return false;
    }

    // Must have product URL
    if (!product.productUrl || product.productUrl === 'N/A') {
      return false;
    }

    // ✅ Quality score check for non-Gem products only
    if (product.qualityScore !== null && product.qualityScore !== undefined && product.qualityScore < 50) {
      return false;
    }

    return true;
  }

  /**
   * Convert old age band enums to new flexible format
   * @param {string} ageBand - Age band (old enum or new format)
   * @returns {string[]} Array of possible age bands in new format
   */
  normalizeAgeBand(ageBand) {
    if (!ageBand) return [];
    
    // If already in new format (contains "-" or ends with "+"), return as-is
    if (ageBand.includes('-') || ageBand.endsWith('+')) {
      return [ageBand];
    }
    
    // Convert old enums to new format (try all possible ranges)
    const enumMapping = {
      'UNDER_5': ['1-2', '3-4'],
      'FIVE_TO_TEN': ['5-6', '7-8', '9-11'],
      'ELEVEN_TO_17': ['12-17'],
      'EIGHTEEN_TO_30': ['18-25', '26-35'],
      'THIRTY_ONE_TO_50': ['36-45', '46-55'],
      'FIFTY_TO_SIXTY_FIVE': ['56-65'],
      'SIXTY_FIVE_PLUS': ['66-75', '75+'],
    };
    
    return enumMapping[ageBand] || [ageBand]; // Fallback to original if unknown
  }

  /**
   * Find products that match recipient profile
   * @param {object} recipient - Recipient data with derived profile
   * @param {object} prisma - Prisma client
   * @returns {Promise<array>} Array of scored products
   */
  async findMatchingProducts(recipient, prisma) {
    const { budgetMin, budgetMax, ageBand: rawAgeBand, gender } = recipient;
    const derived = recipient.derivedProfile || {};

    // ✅ Normalize age band (convert old enums to new format)
    const possibleAgeBands = this.normalizeAgeBand(rawAgeBand);
    const ageBand = possibleAgeBands[0]; // Use first option for child detection
    
    console.log(`\n🔍 Finding products for ${recipient.name}`);
    console.log(`   Budget: £${budgetMin}-£${budgetMax} (with ±5% margin)`);
    console.log(`   Gender: ${gender}`);
    console.log(`   Age Band: ${rawAgeBand}${possibleAgeBands.length > 1 ? ` → ${possibleAgeBands.join(' or ')}` : ''}`);

    // HARD FILTERS - Applied before AI sees anything
    // Budget with ±5% margin
    const budgetMinWithMargin = (budgetMin || 0) * 0.95;
    const budgetMaxWithMargin = (budgetMax || 1000) * 1.05;

    // ✅ CHILDREN DETECTION (1-11 years)
    // Children age bands: "1-2", "3-4", "5-6", "7-8", "9-11"
    const childrenAgeBands = ["1-2", "3-4", "5-6", "7-8", "9-11"];
    const isChild = childrenAgeBands.includes(ageBand);
    
    console.log(`   🎯 Recipient Type: ${isChild ? 'CHILD (1-11) - Gem\'s Picks + Children category ONLY' : 'TEEN/ADULT (12+) - All sources'}`);

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
    };

    // Add gender filter if defined
    if (genderFilter) {
      baseFilters.genderAppliesTo = genderFilter;
    }

    // ✅ CHILDREN-SPECIFIC FILTERS (1-11 years)
    // For children (1-11), ONLY Gem's Picks from Children category
    if (isChild) {
      baseFilters.sourceType = 'CURATED_PRODUCT'; // ONLY Gem's Picks
      baseFilters.category = {
        startsWith: 'Children' // Category must start with "Children"
      };
      console.log(`   🎯 Child filters applied: CURATED_PRODUCT + Children category only`);
    }
    // For teens/adults (12+): No source or category restrictions

    const recipientInterests = recipient.interests || [];
    
    // ═══════════════════════════════════════════════════════════════════════
    // TIER 1: Premium CURATED_PRODUCT + Interest Match
    // For children (1-11): baseFilters already restricts to CURATED_PRODUCT + Children category
    // For teens/adults (12+): This tier adds CURATED_PRODUCT restriction
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`\n📦 TIER 1: Premium curated products (CURATED_PRODUCT) + Interest Match`);
    console.log(`   Interests: ${recipientInterests.join(', ') || 'None'}`);
    
    const tier1Where = {
      ...baseFilters,
      sourceType: 'CURATED_PRODUCT', // For teens/adults, this adds the restriction
                                      // For children, this matches baseFilters
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
    
    // ✅ AGE BAND OVERLAP FILTER
    // Filter products by age band overlap (recipient's age must overlap with product's suitable age bands)
    // For old enums, try all possible age ranges
    const tier1AgeFiltered = tier1Valid.filter(product => {
      const productAgeBands = product.suitableAgeBands || [];
      // Check if ANY of the possible recipient age bands overlap with product
      return possibleAgeBands.some(recipientBand => 
        doAgeRangesOverlap(recipientBand, productAgeBands)
      );
    });
    
    if (tier1Valid.length !== tier1AgeFiltered.length) {
      console.log(`   🎯 Age band filter: ${tier1AgeFiltered.length} match (${tier1Valid.length - tier1AgeFiltered.length} removed by age mismatch)`);
    }
    
    const tier1Scored = tier1AgeFiltered.map(product => ({
      ...product,
      ...this.scoreProduct(product, recipient, derived),
      tier: 'PREMIUM_CURATED',
      tierPriority: 1  // ✅ Highest priority
    }));

    // ✅ SMART TIER PROGRESSION
    const TARGET_CANDIDATES = 20; // Sufficient for AI to choose 10 gifts from
    
    // ═══════════════════════════════════════════════════════════════════════
    // TIER 2: All Curated Products (CURATED_RETAILER + SHOPIFY_UPLOAD) + Interest Match
    // ⚠️ SKIP FOR CHILDREN - Children (1-11) ONLY get Gem's Picks (Tier 1)
    // ═══════════════════════════════════════════════════════════════════════
    let tier2Scored = [];
    if (!isChild && tier1Scored.length < TARGET_CANDIDATES && recipientInterests.length > 0) {
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
      
      // ✅ AGE BAND OVERLAP FILTER
      const tier2AgeFiltered = tier2Valid.filter(product => {
        const productAgeBands = product.suitableAgeBands || [];
        // Check if ANY of the possible recipient age bands overlap with product
        return possibleAgeBands.some(recipientBand => 
          doAgeRangesOverlap(recipientBand, productAgeBands)
        );
      });
      
      if (tier2Valid.length !== tier2AgeFiltered.length) {
        console.log(`   🎯 Age band filter: ${tier2AgeFiltered.length} match (${tier2Valid.length - tier2AgeFiltered.length} removed by age mismatch)`);
      }
      
      tier2Scored = tier2AgeFiltered.map(product => ({
        ...product,
        ...this.scoreProduct(product, recipient, derived),
        tier: 'CURATED_BROAD',
        tierPriority: 2
      }));
    } else if (isChild) {
      console.log(`\n⏭️  TIER 2: Skipped (Children 1-11 ONLY get Gem's Picks from Tier 1)`);
    } else if (tier1Scored.length >= TARGET_CANDIDATES) {
      console.log(`\n✅ TIER 2: Skipped (Tier 1 has ${tier1Scored.length} products - sufficient)`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TIER 3: FALLBACK - All Products (Any sourceType) WITHOUT Interest Match
    // ⚠️ SKIP FOR CHILDREN - Children (1-11) ONLY get Gem's Picks (Tier 1)
    // ═══════════════════════════════════════════════════════════════════════
    let tier3Scored = [];
    const totalSoFar = tier1Scored.length + tier2Scored.length;
    
    if (!isChild && totalSoFar < TARGET_CANDIDATES) {
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

    // ✅ AGE BAND OVERLAP FILTER
    const tier3AgeFiltered = tier3Valid.filter(product => {
      const productAgeBands = product.suitableAgeBands || [];
      // Check if ANY of the possible recipient age bands overlap with product
      return possibleAgeBands.some(recipientBand => 
        doAgeRangesOverlap(recipientBand, productAgeBands)
      );
    });
    
    if (tier3Valid.length !== tier3AgeFiltered.length) {
      console.log(`   🎯 Age band filter: ${tier3AgeFiltered.length} match (${tier3Valid.length - tier3AgeFiltered.length} removed by age mismatch)`);
    }

    tier3Scored = tier3AgeFiltered.map(product => {
      const scoring = this.scoreProduct(product, recipient, derived);
      return {
        ...product,
        ...scoring,
        tier: 'GENERAL_FALLBACK',
        tierPriority: 3,  // ✅ Lowest priority
        score: scoring.score * 0.85, // Light penalty for no interest match
      };
    });
    } else if (isChild) {
      console.log(`\n⏭️  TIER 3: Skipped (Children 1-11 ONLY get Gem's Picks from Tier 1)`);
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
        
        // ✅ SPECIAL CASE: Children recipients (1-11)
        // They don't have structured interests in UI, only hobbiesAndInterests
        // Accept ANY product that passes validation - rely on Gem's Pick + Children category filtering
        if (isChild) {
          return true; // Accept all valid Gem's Picks from Children category - let AI choose best ones
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
    
    // Debug: Show score distribution for children recipients
    if (isChild && scoredProducts.length < 10) {
      console.log(`\n📊 Score distribution for children (showing why products filtered):`);
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

    // ✅ GEM'S PICKS: Runtime calculated scoring (no database quality score)
    // Gem's curated products don't have quality scores - calculate based on category match
    if (product.sourceType === 'CURATED_PRODUCT') {
      // Start with base score for being Gem's Pick
      score = 50; // Base score for curated quality
      
      // Category match is PRIMARY signal for Gem's Picks
      const recipientInterests = (recipient.interests || []).map(i => i.toLowerCase().trim());
      const productCategory = (product.category || '').toLowerCase();
      
      const categoryMatches = recipientInterests.filter(interest => {
        return productCategory.startsWith(interest) || productCategory.includes(interest);
      });
      
      if (categoryMatches.length > 0) {
        score += 30; // Strong bonus for category match
        categoryMatches.forEach(match => {
          signals.push(`✓ Category: ${match}`);
        });
      }
      
      // Price preference (favor middle of budget range)
      if (recipient.budgetMin && recipient.budgetMax) {
        const midpoint = (recipient.budgetMin + recipient.budgetMax) / 2;
        const range = recipient.budgetMax - recipient.budgetMin;
        const distance = Math.abs(product.price - midpoint) / range;
        const budgetScore = Math.max(0, 10 - distance * 10);
        score += budgetScore;
        
        if (budgetScore > 5) {
          signals.push(`Price: £${product.price}`);
        }
      }
      
      // Name/description keyword matching with interests
      const productText = `${product.name} ${product.description || ''}`.toLowerCase();
      recipientInterests.forEach(interest => {
        if (productText.includes(interest)) {
          score += 5;
          signals.push(`~${interest}`);
        }
      });
      
      return {
        score: Math.round(score * 10) / 10,
        matchSignals: signals.slice(0, 4),
      };
    }

    // ✅ OTHER PRODUCTS: Use database quality score + matching
    // Base quality score (for non-Gem products)
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
