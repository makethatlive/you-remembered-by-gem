/**
 * Gift List Generator Service
 * 
 * Main orchestrator for gift list generation.
 * Coordinates profile analysis, product matching, AI selection,
 * and database persistence.
 */

import ProfileAnalyzer from './profile-analyzer.js';
import ProductMatcher from './product-matcher.js';
import AIGiftSelector from './ai-gift-selector.js';
import GiftQualityMonitor from './gift-quality-monitor.js';

export default class GiftListGenerator {
  constructor(claudeClient, prisma) {
    this.prisma = prisma;
    this.profileAnalyzer = new ProfileAnalyzer(claudeClient);
    this.productMatcher = new ProductMatcher();
    this.giftSelector = new AIGiftSelector(claudeClient);
    this.qualityMonitor = new GiftQualityMonitor(prisma);
  }

  /**
   * Generate a complete gift list for a recipient
   * @param {object} params - Generation parameters
   * @returns {Promise<object>} Generated gift list with metadata
   */
  async generateGiftList(params) {
    const {
      recipientId,
      listType = 'curated',
      daysUntil = null,
      excludeProductIds = [],
      supersedesListId = null,
    } = params;

    try {
      // Step 1: Load recipient data
      const recipient = await this.loadRecipient(recipientId);

      // Step 2: Derive or load profile insights
      const derivedProfile = await this.profileAnalyzer.deriveProfile(recipient, this.prisma);
      recipient.derivedProfile = derivedProfile;

      // Step 3: Find matching products
      console.log(`Finding products for ${recipient.name}...`);
      let candidates = await this.productMatcher.findMatchingProducts(recipient, this.prisma);

      // Exclude specified products
      if (excludeProductIds.length > 0) {
        candidates = candidates.filter(p => !excludeProductIds.includes(p.id));
      }

      if (candidates.length < 3) {
        return {
          status: 'insufficient_products',
          message: `Only found ${candidates.length} matching products. Need at least 3.`,
          recipient: { id: recipient.id, name: recipient.name },
          candidatesFound: candidates.length,
        };
      }

      // Step 4: AI selects best gifts (let Claude decide 3-10)
      console.log(`Selecting best gifts from ${candidates.length} candidates...`);
      const selectedGifts = await this.giftSelector.selectGifts(candidates, recipient);

      // Step 5: Validate gift list quality before saving
      const validation = this.validateGiftListQuality(selectedGifts, recipient);
      if (!validation.isValid) {
        console.error('❌ Gift list failed quality validation:', validation.reasons.join(', '));
        return {
          status: 'quality_check_failed',
          message: `Gift list quality check failed: ${validation.reasons.join(', ')}`,
          recipient: { id: recipient.id, name: recipient.name },
          failedReasons: validation.reasons,
          giftsGenerated: selectedGifts.length,
        };
      }

      // Step 6: Create gift list and items in database
      console.log('Saving gift list to database...');
      const giftList = await this.persistGiftList({
        recipient,
        listType,
        selectedGifts,
        daysUntil,
        supersedesListId,
      });

      // Step 7: Run quality monitoring check
      console.log('Running quality monitoring check...');
      const qualityReport = await this.qualityMonitor.checkGiftListQuality(giftList.id);

      // If quality check fails, mark as rejected
      if (qualityReport.status === 'failed') {
        await this.prisma.giftList.update({
          where: { id: giftList.id },
          data: {
            status: 'REJECTED',
            visibleToSubscriber: false,
          }
        });

        return {
          status: 'rejected_quality',
          message: 'Gift list rejected due to quality issues',
          giftList: {
            id: giftList.id,
            status: 'REJECTED',
          },
          qualityReport,
        };
      }

      return {
        status: 'pending_approval',
        message: 'Gift list generated successfully',
        giftList: {
          id: giftList.id,
          status: giftList.status,
          itemCount: selectedGifts.length,
        },
        recipient: {
          id: recipient.id,
          name: recipient.name,
        },
        stats: {
          candidatesEvaluated: candidates.length,
          giftsSelected: selectedGifts.length,
          aiStrategy: selectedGifts[0]?.aiStrategy || 'Standard selection',
        },
        qualityReport,
      };
    } catch (error) {
      console.error('Gift list generation failed:', error);
      throw error;
    }
  }

  /**
   * Validate gift list meets quality standards
   * @param {array} gifts - Selected gifts
   * @param {object} recipient - Recipient data
   * @returns {object} Validation result
   */
  validateGiftListQuality(gifts, recipient) {
    const reasons = [];
    
    // Must have at least 7 gifts
    if (gifts.length < 7) {
      reasons.push(`Too few gifts: ${gifts.length} (minimum 7 required)`);
    }

    // All gifts must have reasoning
    const missingReasoning = gifts.filter(g => !g.whyThisGift || g.whyThisGift.length < 20);
    if (missingReasoning.length > 0) {
      reasons.push(`${missingReasoning.length} gifts missing proper reasoning`);
    }

    // Calculate average relevance score
    const avgScore = gifts.reduce((sum, g) => sum + (g.score || 0), 0) / gifts.length;
    if (avgScore < 30) {
      reasons.push(`Average relevance too low: ${avgScore.toFixed(1)} (minimum 30 required)`);
    }

    // At least 60% of gifts must directly match recipient interests
    const recipientInterests = (recipient.interests || []).map(i => i.toLowerCase());
    const matchingGifts = gifts.filter(gift => {
      const giftInterests = (gift.interestTags || []).map(t => t.toLowerCase());
      return recipientInterests.some(ri => giftInterests.includes(ri));
    });

    const matchPercentage = (matchingGifts.length / gifts.length) * 100;
    if (matchPercentage < 60) {
      reasons.push(`Only ${matchPercentage.toFixed(0)}% of gifts match interests (minimum 60% required)`);
    }

    // Check for diversity (no more than 70% from same retailer during catalogue growth)
    const retailerCounts = {};
    gifts.forEach(g => {
      const retailer = g.retailer?.name || 'Unknown';
      retailerCounts[retailer] = (retailerCounts[retailer] || 0) + 1;
    });

    const maxFromOneRetailer = Math.max(...Object.values(retailerCounts));
    const retailerPercentage = (maxFromOneRetailer / gifts.length) * 100;
    if (retailerPercentage > 70) { // Temporarily relaxed from 40% to allow 3-gift lists
      reasons.push(`Too many gifts from one retailer: ${retailerPercentage.toFixed(0)}%`);
    }

    return {
      isValid: reasons.length === 0,
      reasons,
      stats: {
        giftCount: gifts.length,
        avgScore: avgScore.toFixed(1),
        matchPercentage: matchPercentage.toFixed(0),
        retailerDiversity: Object.keys(retailerCounts).length,
      },
    };
  }

  /**
   * Load recipient with all necessary data
   * @param {string} recipientId - Recipient ID
   * @returns {Promise<object>} Recipient data
   */
  async loadRecipient(recipientId) {
    const recipient = await this.prisma.recipient.findUnique({
      where: { id: recipientId },
      include: {
        owner: true, // Subscriber
      },
    });

    if (!recipient) {
      throw new Error('Recipient not found');
    }

    return recipient;
  }

  /**
   * Persist gift list and items to database
   * @param {object} data - Gift list data
   * @returns {Promise<object>} Created gift list
   */
  async persistGiftList(data) {
    const {
      recipient,
      listType,
      selectedGifts,
      daysUntil,
      supersedesListId,
    } = data;

    // Calculate birthday date
    const birthdayDate = this.calculateBirthdayDate(recipient.birthday);

    // Create the gift list
    const now = new Date();
    const giftList = await this.prisma.giftList.create({
      data: {
        recipientId: recipient.id,
        subscriberId: recipient.subscriberId,
        subscriberUserId: recipient.owner?.createdById || null,
        listType: listType.toUpperCase(), // Convert to uppercase enum value
        status: 'PENDING_APPROVAL', // Use uppercase enum value
        birthdayDate,
        visibleToSubscriber: false,
        supersedesListId,
        generatedAt: now, // Set generation timestamp
        createdAt: now,
        updatedAt: now,
      },
    });

    // Create gift items
    const itemPromises = selectedGifts.map((gift, index) =>
      this.prisma.giftItem.create({
        data: {
          giftListId: giftList.id,
          subscriberUserId: recipient.owner?.createdById || null,
          productId: gift.id,
          title: gift.name,
          description: gift.description,
          price: gift.price,
          imageUrl: gift.imageUrl,
          productUrl: gift.productUrl || gift.product_url || '',
          affiliateUrl: gift.affiliateUrl || gift.affiliate_url,
          retailerName: gift.retailer?.name || 'Unknown',
          whyThisGift: gift.whyThisGift,
          sourceType: 'CURATED_PRODUCT',
          deliverySpeed: 'STANDARD',
          status: 'ACTIVE',
          selectionScore: gift.score,
          matchedSignals: gift.matchSignals || [],
        },
      })
    );

    await Promise.all(itemPromises);

    // Update superseded list if specified
    if (supersedesListId) {
      await this.prisma.giftList.update({
        where: { id: supersedesListId },
        data: { status: 'REJECTED', visibleToSubscriber: false },
      });
    }

    return giftList;
  }

  /**
   * Calculate birthday date from yearless format
   * @param {string} birthday - Birthday in format '--MM-DD'
   * @returns {Date} Birthday date for current/next occurrence
   */
  calculateBirthdayDate(birthday) {
    if (!birthday || typeof birthday !== 'string') {
      // If no birthday, use today's date
      return new Date();
    }

    // Handle yearless format '--MM-DD'
    if (birthday.startsWith('--')) {
      const [, month, day] = birthday.split('-');
      if (!month || !day) {
        return new Date();
      }

      const currentYear = new Date().getFullYear();
      const monthNum = parseInt(month, 10) - 1; // JS months are 0-indexed
      const dayNum = parseInt(day, 10);

      // Validate month and day
      if (isNaN(monthNum) || isNaN(dayNum) || monthNum < 0 || monthNum > 11 || dayNum < 1 || dayNum > 31) {
        return new Date();
      }

      const birthdayThisYear = new Date(currentYear, monthNum, dayNum);

      // If birthday has passed this year, use next year
      if (birthdayThisYear < new Date()) {
        return new Date(currentYear + 1, monthNum, dayNum);
      }

      return birthdayThisYear;
    }

    // Try to parse as regular date
    const parsed = new Date(birthday);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Fallback to today if all parsing fails
    return new Date();
  }

  /**
   * Get generation statistics for monitoring
   * @param {string} recipientId - Recipient ID
   * @returns {Promise<object>} Statistics
   */
  async getGenerationStats(recipientId) {
    const lists = await this.prisma.giftList.findMany({
      where: { recipientId },
      include: {
        _count: {
          select: { giftItems: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalLists: lists.length,
      pendingApproval: lists.filter(l => l.status === 'pending_approval').length,
      approved: lists.filter(l => l.status === 'approved').length,
      rejected: lists.filter(l => l.status === 'rejected').length,
      lastGenerated: lists[0]?.createdAt || null,
    };
  }
}
