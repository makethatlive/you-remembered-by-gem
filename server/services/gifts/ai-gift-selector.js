/**
 * AI Gift Selector Service
 * 
 * Uses Claude AI to intelligently select and curate gifts
 * from candidate products for a specific recipient.
 */

export default class AIGiftSelector {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
  }

  /**
   * Select the best gifts for a recipient from candidate products
   * @param {array} candidates - Scored candidate products
   * @param {object} recipient - Recipient data
   * @param {number} count - Suggested number (Claude can choose 3-10)
   * @returns {Promise<array>} Selected gifts with AI reasoning
   */
  async selectGifts(candidates, recipient, count = null) {
    if (candidates.length === 0) {
      throw new Error('No candidate products available for selection');
    }

    console.log('\n🎁 ===== AI GIFT SELECTION STARTING =====');
    console.log(`   Recipient: ${recipient.name}`);
    console.log(`   Candidates: ${candidates.length} products`);
    console.log(`   Requested: 20 products (system uses first 10: 5 primary + 5 backups)`);
    console.log(`   Using: Claude AI\n`);

    // Set context for AI call logging
    this.claudeClient.setContext({
      callType: 'GIFT_SELECTION',
      operation: 'select_gifts',
      recipientId: recipient.id,
      recipientName: recipient.name,
    });

    // Validate candidates meet quality standards
    const qualityCandidates = candidates.filter(c => {
      if (!c.name || !c.description || !c.score) {
        return false;
      }
      // Must have at least score of 15 to be considered
      return c.score >= 15;
    });

    console.log(`   ${qualityCandidates.length} candidates meet quality threshold (score >= 15)`);

    if (qualityCandidates.length < 10) {
      throw new Error(`Insufficient quality candidates: only ${qualityCandidates.length} products scored 20+. Need at least 10 for 5 primary gifts + 5 backups.`);
    }

    // Take top candidates for AI consideration (max 50 to keep prompt manageable)
    const topCandidates = qualityCandidates.slice(0, Math.min(50, qualityCandidates.length));

    const prompt = this.buildSelectionPrompt(recipient, topCandidates, 20); // Always request 20
    const schema = this.getSelectionSchema(20);

    try {
      // Don't pass temperature for Claude Sonnet 5
      const response = await this.claudeClient.generateStructuredContent(
        prompt,
        schema,
        { maxOutputTokens: 4096 }
      );

      const validated = this.validateSelections(response, topCandidates, count);
      
      console.log(`\n✅ AI GIFT SELECTION COMPLETE`);
      console.log(`   Selected: ${validated.length} gifts`);
      console.log(`   Strategy: ${response.overall_strategy || 'N/A'}`);
      console.log('==========================================\n');

      return validated;
    } catch (error) {
      console.error('\n❌ AI Gift selection failed:', error.message);
      console.log('   Falling back to score-based selection...\n');
      // Fallback: return top scoring products
      return this.fallbackSelection(topCandidates, count);
    }
  }

  /**
   * Build the prompt for gift selection
   * @param {object} recipient - Recipient data
   * @param {array} candidates - Candidate products
   * @param {number} count - Number of gifts needed
   * @returns {string} Complete prompt
   */
  buildSelectionPrompt(recipient, candidates, count) {
    const derived = recipient.derivedProfile || {};
    
    const productsFormatted = candidates.map((product, index) => `
${index + 1}. ${product.name}
   Price: £${product.price}
   Retailer: ${product.retailer?.name || 'Unknown'}
   Description: ${product.description || 'No description'}
   Match Score: ${product.score}
   Match Signals: ${product.matchSignals?.join(', ') || 'None'}
`).join('\n');

    return `You are a professional gift curator selecting personalized gifts for a special someone.

RECIPIENT PROFILE:
- Name: ${recipient.name}
- Relationship: ${recipient.relationship}
- Age Band: ${recipient.ageBand}
- Gender: ${recipient.gender}
- Budget: £${recipient.budgetMin || 0} - £${recipient.budgetMax || 500}
- Occasion: ${recipient.occasion}
- Interests: ${recipient.interests?.join(', ') || 'Not specified'}
- Personality Traits: ${recipient.personality?.join(', ') || 'Not specified'}
- Additional Details: ${recipient.thingsYouKnow || 'Not specified'}
- Life Stage: ${derived.life_stage_summary || 'Not specified'}
- Avoid: ${recipient.avoidNotes || 'Nothing specified'}

CANDIDATE PRODUCTS:
${productsFormatted}

TASK:
Choose exactly 20 products, ranked best match first. The system will validate your ranked choices in order and use the first 10: 5 primary gifts and 5 backups.

Your goal is to create a thoughtful, varied gift list that:
1. Matches the recipient's interests and personality authentically
2. Includes diverse types of gifts (not all jewelry, not all wine, etc.)
3. Spans the budget range appropriately
4. Shows genuine understanding of who they are
5. Avoids anything they've explicitly said to avoid

For EACH selected gift, provide:
- product_index: The number from the list above (1-${candidates.length})
- why_this_gift: Two complete sentences explaining WHY this specific gift fits THIS specific person. Be personal and specific - reference their interests, life stage, or personality. Avoid generic phrases like "a lovely treat."

IMPORTANT:
- Use product_index to reference products (1-${candidates.length})
- Make sure your reasoning is specific to both the person AND the product
- Vary your selections across different categories where possible
- Make the first 5 entries varied gift concepts — never dominated by one shop or one category
- Use no more than 2 products from any single retailer
- Return exactly 20 products ranked by match quality`;
  }

  /**
   * Get JSON schema for selection response
   * @param {number} count - Number of gifts expected
   * @returns {object} JSON schema
   */
  getSelectionSchema(count) {
    return {
      type: 'object',
      properties: {
        selections: {
          type: 'array',
          description: `Array of exactly 20 selected gifts, ranked best match first`,
          items: {
            type: 'object',
            properties: {
              product_index: {
                type: 'integer',
                description: 'Index of the product from the candidate list (1-based)'
              },
              why_this_gift: {
                type: 'string',
                description: 'Personalized explanation for why this gift suits the recipient'
              }
            },
            required: ['product_index', 'why_this_gift']
          }
        },
        overall_strategy: {
          type: 'string',
          description: 'Brief explanation of your selection strategy for this recipient'
        }
      },
      required: ['selections', 'overall_strategy']
    };
  }

  /**
   * Validate and map selections to actual products
   * @param {object} response - AI response
   * @param {array} candidates - Candidate products
   * @param {number} count - Expected count
   * @returns {array} Validated selections with product data
   */
  validateSelections(response, candidates, count) {
    const selections = response.selections || [];
    const validSelections = [];

    for (const selection of selections) {
      const index = selection.product_index - 1; // Convert to 0-based
      
      if (index >= 0 && index < candidates.length) {
        const product = candidates[index];
        validSelections.push({
          ...product,
          whyThisGift: selection.why_this_gift,
          aiStrategy: response.overall_strategy,
        });
      }
    }

    // Accept 10-20 gifts (use first 10)
    if (validSelections.length < 10) {
      console.warn(`Only ${validSelections.length} valid selections, using fallback`);
      return this.fallbackSelection(candidates, 10);
    }

    // Return first 10 validated gifts (5 primary + 5 backups)
    return validSelections.slice(0, 10);
  }

  /**
   * Fallback selection using simple scoring
   * @param {array} candidates - Candidate products
   * @param {number} count - Number to select
   * @returns {array} Top scoring products
   */
  fallbackSelection(candidates, count) {
    console.log('\n⚠️  USING FALLBACK SELECTION (No Claude AI)');
    console.log(`   Selecting top 10 by score only (5 primary + 5 backups)\n`);
    
    return candidates.slice(0, 10).map(product => ({
      ...product,
      whyThisGift: this.generateFallbackReason(product),
      aiStrategy: 'Fallback: Score-based selection (AI unavailable)',
    }));
  }

  /**
   * Generate a basic reason when AI fails
   * @param {object} product - Product data
   * @returns {string} Reason text
   */
  generateFallbackReason(product) {
    const signals = product.matchSignals || [];
    if (signals.length > 0) {
      return `This product matches based on: ${signals.join(', ')}. It's a thoughtfully chosen gift that aligns with their interests and preferences.`;
    }
    return `A carefully selected gift that fits within budget and matches their profile. This product has been chosen for its quality and relevance.`;
  }
}
