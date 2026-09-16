/**
 * Intelligent Interest Matching Service
 * 
 * Provides fuzzy, semantic, and taxonomy-based matching
 * to improve product-interest matching beyond exact string comparison
 */

import { CANONICAL_INTERESTS } from '../../../src/components/shared/taxonomy.js';

export class IntelligentMatcher {
  constructor() {
    this.taxonomyMap = new Map();
    
    // Build taxonomy lookup map
    CANONICAL_INTERESTS.forEach(interest => {
      this.taxonomyMap.set(interest.key.toLowerCase(), interest);
    });
    
    // Semantic similarity pairs (expand as needed)
    this.semanticPairs = {
      'eating': ['food', 'dining', 'cooking', 'culinary'],
      'beverages': ['drinks', 'wine', 'coffee', 'tea'],
      'culinary': ['cooking', 'food', 'chef', 'kitchen'],
      'wellness': ['self-care', 'spa', 'relaxation', 'wellbeing'],
      'fitness': ['sport', 'exercise', 'gym', 'training'],
      'literature': ['books', 'reading', 'novel'],
      'travelling': ['travel', 'adventure', 'trip', 'journey'],
      'music': ['songs', 'concert', 'audio', 'listening'],
      'gardening': ['plants', 'garden', 'outdoor', 'horticulture'],
      'technology': ['tech', 'gadgets', 'devices', 'electronics'],
      'diy': ['crafts', 'making', 'building', 'handmade'],
      'tools': ['equipment', 'instruments', 'implements']
    };
  }

  /**
   * Check if a product matches ANY of the recipient's interests
   * @param {object} product - Product with interestTags
   * @param {object} recipient - Recipient with interests array
   * @returns {boolean}
   */
  hasInterestMatch(product, recipient) {
    const productTags = product.interestTags || [];
    const recipientInterests = this.getAllRecipientInterests(recipient);
    
    if (recipientInterests.length === 0) {
      return false;
    }
    
    // METHOD 1: Check interest tags (preferred)
    if (productTags.length > 0) {
      for (const productTag of productTags) {
        for (const recipientInterest of recipientInterests) {
          const matchQuality = this.getMatchQuality(productTag, recipientInterest);
          if (matchQuality !== 'NO_MATCH') {
            return true;
          }
        }
      }
    }
    
    // METHOD 2: ✅ FALLBACK - Check product name/description for keywords
    // This helps when interest tags are missing or incorrect
    const productText = [
      product.name,
      product.description
    ].filter(Boolean).join(' ').toLowerCase();
    
    if (productText.length > 0) {
      for (const recipientInterest of recipientInterests) {
        const taxonomy = this.getTaxonomyFor(recipientInterest);
        
        // Check if any taxonomy keywords appear in product text
        if (taxonomy?.keywords) {
          for (const keyword of taxonomy.keywords) {
            if (productText.includes(keyword.toLowerCase())) {
              return true; // Found keyword match in product text
            }
          }
        }
        
        // Check direct interest name match
        const interestNormalized = this.normalizeSearchTerm(recipientInterest.toLowerCase());
        if (productText.includes(interestNormalized)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get all recipient interests including "Other" custom text
   * @param {object} recipient
   * @returns {string[]}
   */
  getAllRecipientInterests(recipient) {
    const interests = [...(recipient.interests || [])];
    
    // Add custom interests from interestsDetail JSON
    if (recipient.interestsDetail) {
      const detail = typeof recipient.interestsDetail === 'string' 
        ? JSON.parse(recipient.interestsDetail) 
        : recipient.interestsDetail;
      
      if (detail.otherText && detail.otherText.trim()) {
        // Split by comma and add as separate interests
        const customInterests = detail.otherText
          .split(',')
          .map(i => i.trim())
          .filter(i => i.length > 0);
        interests.push(...customInterests);
      }
    }
    
    return interests;
  }

  /**
   * Determine the quality of match between product tag and recipient interest
   * @param {string} productTag
   * @param {string} recipientInterest
   * @returns {string} EXACT | KEYWORD | ALIAS | FUZZY | SEMANTIC | NO_MATCH
   */
  getMatchQuality(productTag, recipientInterest) {
    const productLower = productTag.toLowerCase().trim();
    const recipientLower = recipientInterest.toLowerCase().trim();
    
    // 1. EXACT MATCH
    if (productLower === recipientLower) {
      return 'EXACT';
    }
    
    // 2. KEYWORD MATCH (from taxonomy)
    const taxonomy = this.getTaxonomyFor(recipientInterest);
    if (taxonomy?.keywords) {
      for (const keyword of taxonomy.keywords) {
        // Check if keyword appears in product tag or vice versa
        if (productLower.includes(keyword) || keyword.includes(productLower)) {
          return 'KEYWORD';
        }
      }
    }
    
    // 3. ALIAS MATCH (from taxonomy)
    if (taxonomy?.aliases) {
      for (const alias of taxonomy.aliases) {
        if (productLower === alias || recipientLower === alias) {
          return 'ALIAS';
        }
      }
    }
    
    // 4. FUZZY SIMILARITY (typos, slight variations)
    const similarity = this.calculateStringSimilarity(productLower, recipientLower);
    if (similarity > 0.80) {  // 80% similar
      return 'FUZZY';
    }
    
    // 5. SEMANTIC SIMILARITY (related words)
    if (this.areSemanticallySimilar(productLower, recipientLower)) {
      return 'SEMANTIC';
    }
    
    return 'NO_MATCH';
  }

  /**
   * Get taxonomy entry for a recipient interest
   */
  getTaxonomyFor(recipientInterest) {
    const key = recipientInterest.toLowerCase().trim();
    
    // Direct lookup
    if (this.taxonomyMap.has(key)) {
      return this.taxonomyMap.get(key);
    }
    
    // Find by matching with canonical key
    for (const [canonicalKey, taxonomy] of this.taxonomyMap.entries()) {
      if (canonicalKey === key) {
        return taxonomy;
      }
    }
    
    return null;
  }

  /**
   * Check if two terms are semantically similar
   */
  areSemanticallySimilar(term1, term2) {
    // Normalize terms (remove common words)
    const normalized1 = this.normalizeSearchTerm(term1);
    const normalized2 = this.normalizeSearchTerm(term2);
    
    // Check if both terms are in the same semantic group
    for (const [key, synonyms] of Object.entries(this.semanticPairs)) {
      const group = [key, ...synonyms];
      
      const has1 = group.some(word => normalized1.includes(word) || word.includes(normalized1));
      const has2 = group.some(word => normalized2.includes(word) || word.includes(normalized2));
      
      if (has1 && has2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Normalize search term by removing common filler words
   */
  normalizeSearchTerm(term) {
    const fillerWords = ['and', 'or', 'the', '&', 'with', 'for', 'in', 'on', 'at'];
    let normalized = term.toLowerCase();
    
    fillerWords.forEach(filler => {
      normalized = normalized.replace(new RegExp(`\\b${filler}\\b`, 'g'), ' ');
    });
    
    return normalized.trim().replace(/\s+/g, ' ');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @returns {number} Similarity score 0-1
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get all matching product tags with their match quality scores
   * Useful for scoring
   */
  getMatchingTagsWithScores(product, recipient) {
    const matches = [];
    const productTags = product.interestTags || [];
    const recipientInterests = this.getAllRecipientInterests(recipient);
    
    for (const productTag of productTags) {
      for (const recipientInterest of recipientInterests) {
        const matchQuality = this.getMatchQuality(productTag, recipientInterest);
        
        if (matchQuality !== 'NO_MATCH') {
          matches.push({
            productTag,
            recipientInterest,
            matchQuality,
            score: this.getScoreForMatchQuality(matchQuality)
          });
        }
      }
    }
    
    return matches;
  }

  /**
   * Convert match quality to numeric score
   */
  getScoreForMatchQuality(matchQuality) {
    const scores = {
      'EXACT': 20,
      'KEYWORD': 15,
      'ALIAS': 12,
      'FUZZY': 8,
      'SEMANTIC': 10,
      'NO_MATCH': 0
    };
    
    return scores[matchQuality] || 0;
  }
}
