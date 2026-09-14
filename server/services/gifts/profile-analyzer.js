/**
 * Profile Analyzer Service
 * 
 * Analyzes recipient profiles and derives structured insights
 * for gift matching using AI.
 */

import crypto from 'crypto';

export default class ProfileAnalyzer {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.TAXONOMY_VERSION = '1.0';
  }

  /**
   * Generate a hash of the recipient profile to cache AI-derived insights
   * @param {object} recipient - Recipient data
   * @returns {string} Hash string
   */
  generateProfileHash(recipient) {
    const source = JSON.stringify([
      recipient.interests,
      recipient.personality,
      recipient.giftTypes,
      recipient.thingsYouKnow, // "Anything else?" field - the ONE free-text box
      recipient.avoidNotes,
      recipient.ageBand,
      recipient.gender,
      recipient.relationship,
      this.TAXONOMY_VERSION,
    ]);

    return crypto.createHash('md5').update(source).digest('hex');
  }

  /**
   * Derive structured profile insights from free-form recipient data
   * @param {object} recipient - Recipient data
   * @param {object} prisma - Prisma client for caching
   * @returns {Promise<object|null>} Derived profile or null
   */
  async deriveProfile(recipient, prisma) {
    try {
      const hash = this.generateProfileHash(recipient);

      // Return cached profile if hash matches
      if (recipient.derivedProfile && recipient.derivedProfileHash === hash) {
        console.log('✅ Using cached derived profile (no AI call needed)');
        return recipient.derivedProfile;
      }

      console.log('\n🧠 ===== PROFILE ANALYSIS STARTING =====');
      console.log(`   Recipient: ${recipient.name}`);
      console.log(`   Profile Hash: ${hash}`);
      console.log(`   Using: Claude AI\n`);

      // Interest and gift type taxonomies
      const interestKeys = [
        'Cooking & food', 'Music', 'Wellness & self-care', 'Wine & drinks',
        'Cars & motoring', 'Gaming', 'Photography', 'Travel & adventure',
        'Fitness & sport', 'Gardening', 'Fashion & accessories', 'Art & culture',
        'Tech & gadgets', 'Beauty & skincare', 'Outdoor pursuits', 'Cycling',
        'Reading & literature', 'Home & interior', 'Sustainability'
      ];

      const giftTypeKeys = [
        'Experiences', 'Things to eat or drink', 'Beautiful objects for the home',
        'Something to wear or carry', 'Books or creative content',
        'Personalised or bespoke items', 'Subscriptions or memberships',
        'Pampering and self-care', 'Practical but high quality',
        'Quirky and unexpected', 'Toys, games, or activities'
      ];

      const restrictionKeys = [
        'alcohol', 'food', 'fragrance', 'candles', 'jewelry', 
        'clothing', 'books', 'tech', 'plastic'
      ];

      const prompt = `You are analyzing a gift recipient's profile to extract structured insights for a gift recommendation system.

RECIPIENT PROFILE:
- Interests: ${JSON.stringify(recipient.interests || [])}
- Personality: ${JSON.stringify(recipient.personality || [])}
- Gift Types: ${JSON.stringify(recipient.giftTypes || [])}
- Additional Details: ${recipient.thingsYouKnow || 'Not provided'}
- Avoid: ${recipient.avoidNotes || 'Not provided'}
- Age Band: ${recipient.ageBand}
- Gender: ${recipient.gender}
- Relationship: ${recipient.relationship}

INSTRUCTIONS:
Analyze this profile and extract structured data for gift matching. Be precise and only use information explicitly stated or clearly implied.

Return your analysis in this exact structure:
1. canonical_interests: Choose ONLY from: ${interestKeys.join(', ')}
2. canonical_gift_types: Choose ONLY from: ${giftTypeKeys.join(', ')}
3. persona_keywords: 10-20 specific words or short phrases that describe products they'd love (e.g., "yoga mat", "gin", "vintage", "minimalist")
4. avoid_categories: Choose ONLY from: ${restrictionKeys.join(', ')} - plus up to 5 specific words they explicitly want to avoid
5. life_stage_summary: One concise sentence (max 30 words) describing their life stage

Focus on quality over quantity. Only include interests and gift types that are clearly supported by the profile.`;

      const schema = {
        type: 'object',
        properties: {
          canonical_interests: {
            type: 'array',
            items: { type: 'string' }
          },
          canonical_gift_types: {
            type: 'array',
            items: { type: 'string' }
          },
          persona_keywords: {
            type: 'array',
            items: { type: 'string' }
          },
          avoid_categories: {
            type: 'array',
            items: { type: 'string' }
          },
          life_stage_summary: {
            type: 'string'
          }
        },
        required: [
          'canonical_interests',
          'canonical_gift_types',
          'persona_keywords',
          'avoid_categories',
          'life_stage_summary'
        ]
      };

      const response = await this.claudeClient.generateStructuredContent(
        prompt,
        schema,
        { maxOutputTokens: 8192 } // Remove temperature for Claude Sonnet 5
      );

      // Sanitize and validate the response
      const derivedProfile = this.sanitizeProfile(response, interestKeys, giftTypeKeys, restrictionKeys);

      console.log('\n✅ PROFILE ANALYSIS COMPLETE');
      console.log(`   Interests: ${derivedProfile.canonical_interests.length}`);
      console.log(`   Gift Types: ${derivedProfile.canonical_gift_types.length}`);
      console.log(`   Keywords: ${derivedProfile.persona_keywords.length}`);
      console.log('==========================================\n');

      // Cache the result
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          derivedProfile,
          derivedProfileHash: hash,
        },
      });

      return derivedProfile;
    } catch (error) {
      console.error('\n❌ Profile derivation failed:', error.message);
      console.log('   Generation will continue without derived profile\n');
      return null; // Gracefully fail - generation can continue without derived profile
    }
  }

  /**
   * Sanitize AI response to ensure data quality
   * @param {object} response - Raw AI response
   * @param {array} validInterests - Valid interest taxonomy
   * @param {array} validGiftTypes - Valid gift type taxonomy
   * @param {array} validRestrictions - Valid restriction categories
   * @returns {object} Sanitized profile
   */
  sanitizeProfile(response, validInterests, validGiftTypes, validRestrictions) {
    const asArray = (value) => (Array.isArray(value) ? value : []);

    return {
      canonical_interests: asArray(response.canonical_interests)
        .filter(x => validInterests.includes(x))
        .slice(0, 15),
      canonical_gift_types: asArray(response.canonical_gift_types)
        .filter(x => validGiftTypes.includes(x))
        .slice(0, 10),
      persona_keywords: asArray(response.persona_keywords)
        .map(x => String(x || '').toLowerCase().trim())
        .filter(x => x.length > 0 && x.length <= 30)
        .slice(0, 20),
      avoid_categories: asArray(response.avoid_categories)
        .map(x => String(x || '').toLowerCase().trim())
        .filter(x => x.length >= 3 && x.length <= 20)
        .slice(0, 10),
      life_stage_summary: String(response.life_stage_summary || '').trim().slice(0, 150),
    };
  }
}
