/**
 * Gift Quality Monitor Service
 * 
 * Monitors gift list quality and alerts on issues
 */

export default class GiftQualityMonitor {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Check gift list quality after generation
   * @param {string} giftListId - Gift list ID
   * @returns {Promise<object>} Quality report
   */
  async checkGiftListQuality(giftListId) {
    const giftList = await this.prisma.giftList.findUnique({
      where: { id: giftListId },
      include: {
        recipient: true,
        giftItems: {
          include: {
            product: {
              include: {
                retailer: true
              }
            }
          }
        }
      }
    });

    if (!giftList) {
      throw new Error('Gift list not found');
    }

    const issues = [];
    const warnings = [];
    const recipient = giftList.recipient;
    const gifts = giftList.giftItems;

    // Check 1: Must have at least 3 gifts (relaxed from strict 10 requirement)
    // Per client spec: "better to offer 1-5 options than nothing"
    if (gifts.length < 3) {
      issues.push({
        severity: 'critical',
        code: 'INSUFFICIENT_GIFT_COUNT',
        message: `Insufficient gifts: got ${gifts.length}, minimum 3 required`,
      });
    } else if (gifts.length < 10) {
      warnings.push({
        severity: 'warning',
        code: 'BELOW_TARGET_COUNT',
        message: `Generated ${gifts.length} gifts (target is 10). This may indicate catalogue coverage gaps.`,
      });
    }

    // Check 2: AI reasoning present
    const missingReasoning = gifts.filter(g => !g.whyThisGift || g.whyThisGift.length < 20);
    if (missingReasoning.length > 0) {
      issues.push({
        severity: 'critical',
        code: 'MISSING_REASONING',
        message: `${missingReasoning.length} gifts missing AI reasoning`,
        giftIds: missingReasoning.map(g => g.id),
      });
    }

    // Check 3: Interest matching
    // ✅ CATEGORY-BASED MATCHING (aligned with onboarding)
    // Recipient interests from onboarding match product categories exactly
    // e.g., recipient interest "Cooking & food" matches product category "Cooking & food"
    const recipientInterests = (recipient.interests || []).map(i => i.toLowerCase().trim());
    const matchingGifts = gifts.filter(gift => {
      const product = gift.product;
      if (!product) return false;
      
      // Primary match: Product category matches recipient interest
      const category = (product.category || '').toLowerCase();
      const categoryMatch = recipientInterests.some(interest => {
        // Check if category starts with the interest (handles "Cooking & food > Baking")
        return category.startsWith(interest) || category.includes(interest);
      });
      
      // Secondary match: Interest tags (for legacy products)
      const productTags = (product.interestTags || []).map(t => t.toLowerCase());
      const tagMatch = recipientInterests.some(ri => productTags.includes(ri));
      
      // Match if either category or tags match
      return categoryMatch || tagMatch;
    });

    const matchPercentage = (matchingGifts.length / gifts.length) * 100;
    // Relaxed threshold for LEGACY products: 25% minimum (was 40%)
    // Reasoning: LEGACY products have incomplete tags, but offering something is better than nothing
    if (matchPercentage < 25) {
      issues.push({
        severity: 'critical',
        code: 'LOW_INTEREST_MATCH',
        message: `Only ${matchPercentage.toFixed(0)}% of gifts match recipient interests (minimum 25%)`,
        recipientInterests,
        matchingCount: matchingGifts.length,
        totalCount: gifts.length,
      });
    } else if (matchPercentage < 40) {
      warnings.push({
        severity: 'warning',
        code: 'MODERATE_INTEREST_MATCH',
        message: `${matchPercentage.toFixed(0)}% match recipient interests (40%+ recommended)`,
      });
    } else if (matchPercentage < 60) {
      warnings.push({
        severity: 'warning',
        code: 'GOOD_INTEREST_MATCH',
        message: `${matchPercentage.toFixed(0)}% match (60%+ is excellent)`,
      });
    }

    // Check 4: Product data quality
    const lowQualityProducts = gifts.filter(g => {
      const product = g.product;
      if (!product) return true;
      
      // Basic checks
      if (!product.name || !product.productUrl) return true;
      
      // ✅ RELAXED: Description not required for CURATED_PRODUCT
      // CURATED products are manually selected, quality pre-verified
      if (product.sourceType !== 'CURATED_PRODUCT') {
        if (!product.description || product.description.length < 20) {
          return true;
        }
      }
      
      // Quality score check
      if (product.qualityScore && product.qualityScore < 50) {
        return true;
      }
      
      return false;
    });

    if (lowQualityProducts.length > 0) {
      issues.push({
        severity: 'critical',
        code: 'LOW_QUALITY_PRODUCTS',
        message: `${lowQualityProducts.length} products have poor data quality`,
        giftIds: lowQualityProducts.map(g => g.id),
      });
    }

    // Check 5: Relevance scores (lowered thresholds for LEGACY products)
    const avgScore = gifts.reduce((sum, g) => sum + (g.selectionScore || 0), 0) / gifts.length;
    if (avgScore < 15) {
      issues.push({
        severity: 'critical',
        code: 'LOW_RELEVANCE_SCORES',
        message: `Average relevance score ${avgScore.toFixed(1)} is too low (minimum 15)`,
        avgScore: avgScore.toFixed(1),
      });
    } else if (avgScore < 30) {
      warnings.push({
        severity: 'warning',
        code: 'MODERATE_RELEVANCE',
        message: `Average relevance score ${avgScore.toFixed(1)} (30+ recommended)`,
      });
    }

    // Check 6: Retailer diversity
    const retailerCounts = {};
    gifts.forEach(g => {
      const retailer = g.product?.retailer?.name || 'Unknown';
      retailerCounts[retailer] = (retailerCounts[retailer] || 0) + 1;
    });

    const maxFromOneRetailer = Math.max(...Object.values(retailerCounts));
    const retailerPercentage = (maxFromOneRetailer / gifts.length) * 100;
    
    if (retailerPercentage > 50) {
      warnings.push({
        severity: 'warning',
        code: 'LOW_RETAILER_DIVERSITY',
        message: `${retailerPercentage.toFixed(0)}% of gifts from one retailer`,
        retailerCounts,
      });
    }

    // Check 7: Budget compliance
    const outOfBudget = gifts.filter(g => {
      const price = parseFloat(g.price || g.product?.price || 0);
      return price < (recipient.budgetMin || 0) || price > (recipient.budgetMax || 99999);
    });

    if (outOfBudget.length > 0) {
      warnings.push({
        severity: 'warning',
        code: 'BUDGET_MISMATCH',
        message: `${outOfBudget.length} gifts outside budget range (£${recipient.budgetMin}-£${recipient.budgetMax})`,
        giftIds: outOfBudget.map(g => g.id),
      });
    }

    // Generate quality score
    const qualityScore = this.calculateQualityScore(issues, warnings, gifts.length);

    const report = {
      giftListId,
      recipientName: recipient.name,
      status: issues.length === 0 ? (warnings.length === 0 ? 'excellent' : 'acceptable') : 'failed',
      qualityScore,
      giftCount: gifts.length,
      issues,
      warnings,
      stats: {
        interestMatchPercentage: matchPercentage.toFixed(1),
        avgRelevanceScore: avgScore.toFixed(1),
        retailerDiversity: Object.keys(retailerCounts).length,
        budgetCompliance: ((gifts.length - outOfBudget.length) / gifts.length * 100).toFixed(0),
      },
      recommendation: this.getRecommendation(issues, warnings),
      timestamp: new Date().toISOString(),
    };

    // Log to console
    this.logQualityReport(report);

    return report;
  }

  /**
   * Calculate overall quality score (0-100)
   * @param {array} issues - Critical issues
   * @param {array} warnings - Warnings
   * @param {number} giftCount - Number of gifts
   * @returns {number} Quality score
   */
  calculateQualityScore(issues, warnings, giftCount) {
    let score = 100;
    
    // Deduct for critical issues
    score -= issues.length * 20;
    
    // Deduct for warnings
    score -= warnings.length * 5;
    
    // Bonus for exact count (10 gifts as expected)
    if (giftCount === 10) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get recommendation based on quality check
   * @param {array} issues - Critical issues
   * @param {array} warnings - Warnings
   * @returns {string} Recommendation
   */
  getRecommendation(issues, warnings) {
    if (issues.length > 0) {
      return '🚨 REJECT - Critical quality issues detected. Do not send to subscriber. Regenerate gift list.';
    }
    
    if (warnings.length >= 3) {
      return '⚠️  REVIEW REQUIRED - Multiple quality concerns. Manual review recommended before sending.';
    }
    
    if (warnings.length > 0) {
      return '✅ APPROVE WITH CAUTION - Minor issues detected but acceptable quality.';
    }
    
    return '✅ APPROVE - Excellent quality. Safe to send to subscriber.';
  }

  /**
   * Log quality report to console
   * @param {object} report - Quality report
   */
  logQualityReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🎁 GIFT LIST QUALITY REPORT');
    console.log('='.repeat(80));
    console.log(`Recipient: ${report.recipientName}`);
    console.log(`Status: ${report.status.toUpperCase()}`);
    console.log(`Quality Score: ${report.qualityScore}/100`);
    console.log(`Gift Count: ${report.giftCount}`);
    
    if (report.issues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      report.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.code}] ${issue.message}`);
      });
    }
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. [${warning.code}] ${warning.message}`);
      });
    }
    
    console.log('\n📊 STATISTICS:');
    console.log(`  Interest Match: ${report.stats.interestMatchPercentage}%`);
    console.log(`  Avg Relevance: ${report.stats.avgRelevanceScore}`);
    console.log(`  Retailer Diversity: ${report.stats.retailerDiversity} retailers`);
    console.log(`  Budget Compliance: ${report.stats.budgetCompliance}%`);
    
    console.log('\n💡 RECOMMENDATION:');
    console.log(`  ${report.recommendation}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get statistics for all gift lists
   * @returns {Promise<object>} Statistics
   */
  async getOverallStatistics() {
    const allLists = await this.prisma.giftList.findMany({
      include: {
        recipient: true,
        giftItems: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100, // Last 100 lists
    });

    const stats = {
      total: allLists.length,
      byStatus: {
        PENDING_APPROVAL: 0,
        APPROVED: 0,
        REJECTED: 0,
        SENT: 0,
      },
      avgGiftCount: 0,
      avgTimeToGenerate: 0,
    };

    allLists.forEach(list => {
      stats.byStatus[list.status] = (stats.byStatus[list.status] || 0) + 1;
      stats.avgGiftCount += list.giftItems.length;
    });

    stats.avgGiftCount = (stats.avgGiftCount / allLists.length).toFixed(1);

    return stats;
  }
}
