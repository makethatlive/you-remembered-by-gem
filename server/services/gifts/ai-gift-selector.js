/**
 * AI Gift Selector Service
 * 
 * Uses Claude AI to intelligently select and curate gifts
 * from candidate products for a specific recipient.
 * 
 * SPECIFICATION: Per client requirements (August 2026)
 * - System prompt defines AI role and boundaries
 * - User prompt is dynamically populated per recipient
 * - Output includes confidence levels (interest_match vs general)
 * - Hard filters (gender, budget, age) applied BEFORE AI sees candidates
 * - AI selects up to 5 gift recommendations (graceful fallback accepts 1-5)
 */

export default class AIGiftSelector {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
  }

  /**
   * SYSTEM PROMPT - Defines AI role (does not change per-recipient)
   * Per client spec: "This defines the AI's role, boundaries, and behaviour"
   */
  getSystemPrompt() {
    return `You are the gift curation engine for You Remembered, by Gem, a premium UK personal gifting subscription service. Your tagline is 'Gifts as thoughtful as you are' and your positioning is 'your personal gifting concierge'.

You will be given a recipient profile and a pre-filtered list of candidate products. The candidates have ALREADY been filtered for gender, age, and budget suitability — you do not need to re-check these. Your job is to select and rank the best gifts from this list based on fit with the recipient's interests, personality, and any free-text detail provided.

YOUR TASK
From the candidate list provided, select and rank UP TO 10 gift recommendations.
- The first 5 should be your STRONGEST recommendations (these will be shown as "Top 5 Selected")
- The next 5 (if available) should be good BACKUP options (these will be shown as "Backup Gifts")
- You may return fewer than 10 if there aren't enough suitable products

SELECTION PRIORITY (in order)
1. Products tagged with an interest category that matches one the recipient has selected. Prioritise the closest, most specific match over a loose or generic one.
2. Within interest-matched products, prioritise items that also align with the recipient's personality tags, gift-type preferences (e.g. 'Designer items', 'Practical but high quality', 'Quirky and unexpected'), and anything mentioned in the free-text fields.
3. If fewer than 10 strong interest-matched candidates exist, you may include well-suited candidates that fit the recipient's gender, age, and budget but don't strongly match a stated interest. Mark these clearly with confidence: "general" rather than "interest_match" in your output.

DIVERSITY AND VARIETY (CRITICAL)
- NEVER select duplicate or nearly-identical products. If you see multiple versions of the same item (e.g., "Moka Express Coffee Maker" and "Moka Espresso Coffee Maker"), select ONLY ONE.
- Ensure VARIETY across the recipient's interests. If they have multiple interests (e.g., Gardening, Cooking, DIY), include gifts representing EACH interest area, not just one.
- Avoid selecting multiple products from the same narrow category unless the recipient has explicitly focused on it. For example, don't select 3 protein powders or 2 coffee makers unless that's their main stated passion.
- Aim for a balanced, interesting mix that covers different aspects of their personality and interests.

READING THE FREE-TEXT FIELDS
The recipient profile includes free-text fields ('anything else that would help', 'things to avoid'). Treat these as high-signal, not decorative:
- If a specific brand, colour, hobby, sports team, or item is mentioned favourably, treat it as a strong positive signal — actively prefer candidates that connect to it, and mention it in your written rationale.
- If something is mentioned as disliked, unwanted, or to avoid (e.g. an allergy, a colour they hate, a category they don't want), you must NEVER select a product that conflicts with this, even if it otherwise matches their interests well. Treat 'avoid' instructions as an absolute exclusion, not a soft preference.

GENDER-APPROPRIATE JUDGEMENT ON UNISEX ITEMS
Most candidates you receive will already be tagged Male, Female, or Unisex, and this has been filtered before reaching you. For items tagged Unisex specifically, use reasonable judgement about whether the item, as styled or described, genuinely suits this recipient — for example, a 'unisex' fragrance range may still have gendered notes worth considering. Do not override the Male/Female/Unisex tag itself — only use judgement within the Unisex category.

WHAT YOU MUST NEVER DO
- Never invent a product, price, retailer, or URL. Only select from the candidate list you are given.
- Never recommend a product tagged for the wrong gender, even if you think it might 'still work' — this filtering has already been done and must not be second-guessed.
- Never select a product that conflicts with a stated 'avoid'.
- Never select duplicate or nearly-identical products (e.g., two coffee makers, two protein powders of the same brand).
- Never select only from one interest area when the recipient has multiple interests — spread the selection across their stated interests.
- Never pad the list with a weak or irrelevant candidate merely to reach 10 — if there are genuinely fewer than 10 suitable candidates, return what you can find (even if only 1-9 products).

OUTPUT FORMAT
Respond ONLY in valid JSON, in exactly this structure. No preamble, no markdown, no text outside the JSON object.`;
  }

  /**
   * Select the best gifts for a recipient from candidate products
   * @param {array} candidates - Scored candidate products (already filtered by gender/age/budget)
   * @param {object} recipient - Recipient data
   * @returns {Promise<array>} Selected gifts with AI reasoning
   */
  async selectGifts(candidates, recipient) {
    console.log('\n🎁 ===== AI GIFT SELECTION STARTING =====');
    console.log(`   Recipient: ${recipient.name}`);
    console.log(`   Candidates available: ${candidates.length} products`);
    console.log(`   Target: 10 gift recommendations (5 primary + up to 5 backup)`);
    console.log(`   Using: Claude AI with client-specified prompt\n`);

    // Set context for AI call logging
    this.claudeClient.setContext({
      callType: 'GIFT_SELECTION',
      operation: 'select_gifts',
      recipientId: recipient.id,
      recipientName: recipient.name,
    });

    // NO HARD REQUIREMENT - Work with whatever we have
    // Per client: "if there are genuinely fewer than 10 suitable candidates, say so explicitly"
    if (candidates.length === 0) {
      console.warn('   ⚠️  No candidates available - cannot generate gift list');
      throw new Error('No candidate products available for selection');
    }

    console.log(`   ✓ Working with ${candidates.length} candidates (no minimum required)`);
    
    // Take top candidates for AI (max 50 to keep prompt manageable)
    const topCandidates = candidates.slice(0, Math.min(50, candidates.length));

    const userPrompt = this.buildUserPrompt(recipient, topCandidates);
    const schema = this.getOutputSchema();

    try {
      const response = await this.claudeClient.generateStructuredContent(
        userPrompt,
        schema,
        { 
          maxOutputTokens: 4096,
          systemPrompt: this.getSystemPrompt() // Client's system prompt
        }
      );

      const validated = this.validateAndMapSelections(response, topCandidates, recipient);
      
      console.log(`\n✅ AI GIFT SELECTION COMPLETE`);
      console.log(`   Selected: ${validated.length} gifts`);
      console.log(`   Confidence: ${validated.filter(g => g.confidence === 'interest_match').length} interest-match, ${validated.filter(g => g.confidence === 'general').length} general`);
      console.log(`   Personal summary: ${response.personal_summary?.substring(0, 60)}...`);
      console.log('==========================================\n');

      return validated;
    } catch (error) {
      console.error('\n❌ AI Gift selection failed:', error.message);
      console.log('   Falling back to score-based selection...\n');
      return this.fallbackSelection(topCandidates);
    }
  }

  /**
   * Build USER PROMPT - Dynamically populated per recipient
   * Per client spec: Template with [BRACKETS] populated from recipient profile
   */
  buildUserPrompt(recipient, candidates) {
    const derived = recipient.derivedProfile || {};
    
    // Format candidate list per spec
    const candidateList = candidates.map((product, index) => {
      const source = product.source || 'Unknown';
      const interestCategory = product.interestTags?.[0] || 'General';
      
      return `Product ID: ${product.id}
   Name: ${product.name}
   Retailer: ${product.retailer?.name || 'Unknown'}
   Price: £${product.price}
   Interest Category: ${interestCategory}
   Source: ${source}
   Tier: ${product.tier || 'N/A'}
   Description: ${(product.description || '').substring(0, 150)}...`;
    }).join('\n\n');

    // Build personality tags string
    const personalityTags = recipient.personality?.join(', ') || 'Not specified';
    
    // Build gift type preferences
    const giftTypePrefs = recipient.giftTypes?.join(', ') || derived.canonical_gift_types?.join(', ') || 'Not specified';

    return `RECIPIENT PROFILE

Relationship to subscriber: ${recipient.relationship || 'Not specified'}
Age band: ${recipient.ageBand || 'Not specified'}
Gender: ${recipient.gender || 'Not specified'}
Occasion: ${recipient.occasion || 'Birthday'}
Budget: £${recipient.budgetMin || 0} minimum / £${recipient.budgetMax || 100} maximum
  (candidates below have already been filtered to this range +/- 5%)

Interests: ${recipient.interests?.join(', ') || 'Not specified'}
Personality: ${personalityTags}
Gift types they love: ${giftTypePrefs}
Things to avoid: ${recipient.avoidNotes || recipient.thingsToAvoid || 'Nothing specified'}
Anything else that would help: ${recipient.thingsYouKnow || recipient.additionalNotes || 'Not specified'}
Upcoming milestones: ${recipient.milestones || 'None mentioned'}

CANDIDATE PRODUCTS (${candidates.length} items, already filtered for gender/age/budget)

${candidateList}

Select and rank up to 10 gift recommendations from the candidates above, following the rules in your system prompt. The first 5 should be your strongest picks, and the next 5 (if available) should be solid backup options. If fewer than 10 strong matches exist, return what you can (minimum 1 product).`;
  }

  /**
   * Get OUTPUT SCHEMA per client specification
   * Must include: personal_summary, recommendations, confidence, notes_for_gem
   */
  getOutputSchema() {
    return {
      type: 'object',
      properties: {
        personal_summary: {
          type: 'string',
          description: 'One warm sentence describing this person, for Gem\'s reference in the approval queue'
        },
        recommendations: {
          type: 'array',
          description: 'Up to 10 gift recommendations: first 5 are primary, next 5 are backup (accepts 1-10, no hard minimum)',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            properties: {
              product_id: {
                type: 'string',
                description: 'Product ID from the candidate list - never invented'
              },
              confidence: {
                type: 'string',
                enum: ['interest_match', 'general'],
                description: 'interest_match if matches stated interests, general if based on gender/age/budget only'
              },
              rationale: {
                type: 'string',
                description: '2-3 sentences: why this suits THIS person specifically, referencing their stated interests, personality, or free-text detail where relevant'
              }
            },
            required: ['product_id', 'confidence', 'rationale']
          }
        },
        notes_for_gem: {
          type: 'string',
          description: 'Optional - flag anything worth Gem\'s attention, e.g. "fewer than 5 strong matches were available" or "limited catalogue in this interest category"'
        }
      },
      required: ['personal_summary', 'recommendations']
    };
  }

  /**
   * Validate and map AI selections to actual products
   */
  validateAndMapSelections(response, candidates, recipient) {
    const validated = [];
    
    // Map products by ID for quick lookup
    const productMap = new Map();
    candidates.forEach(p => productMap.set(p.id, p));

    // Process recommendations (first 5 are primary, rest are backup)
    const recommendations = response.recommendations || [];
    recommendations.forEach((rec, index) => {
      const product = productMap.get(rec.product_id);
      if (product) {
        validated.push({
          ...product,
          whyThisGift: rec.rationale,
          confidence: rec.confidence,
          isPrimary: index < 5, // First 5 are primary, rest are backup
          rank: index + 1,
          aiStrategy: response.personal_summary,
          notesForGem: response.notes_for_gem,
        });
      } else {
        console.warn(`   ⚠️  Recommendation ${index + 1}: product_id ${rec.product_id} not found in candidates`);
      }
    });

    // Report on primary vs backup split
    const primaryCount = validated.filter(g => g.isPrimary).length;
    const backupCount = validated.filter(g => !g.isPrimary).length;
    
    if (validated.length > 0) {
      console.log(`\n   ℹ️  AI returned ${validated.length} recommendations (${primaryCount} primary, ${backupCount} backup)`);
      if (response.notes_for_gem) {
        console.log(`   Notes from AI: ${response.notes_for_gem}`);
      }
    }

    if (validated.length === 0) {
      console.warn(`   ⚠️  No valid selections from AI - falling back`);
      return this.fallbackSelection(candidates);
    }

    return validated;
  }

  /**
   * Fallback selection when AI fails
   * Returns top scoring products with basic reasoning
   */
  fallbackSelection(candidates) {
    console.log('\n⚠️  USING FALLBACK SELECTION (No Claude AI)');
    console.log(`   Selecting up to 10 products by score only (5 primary + 5 backup)\n`);
    
    // Take top candidates (up to 10, graceful if fewer)
    const count = Math.min(10, candidates.length);
    
    return candidates.slice(0, count).map((product, index) => {
      // Determine confidence based on tier
      const confidence = (product.tier === 'GENERAL_FALLBACK') ? 'general' : 'interest_match';
      
      return {
        ...product,
        whyThisGift: this.generateFallbackReason(product),
        confidence: confidence,
        isPrimary: index < 5, // First 5 are primary, rest are backup
        rank: index + 1,
        aiStrategy: 'Fallback: Score-based selection (AI unavailable)',
        notesForGem: `Fallback selection used. ${candidates.length} candidates were available, returned ${count} (${Math.min(5, count)} primary, ${Math.max(0, count - 5)} backup).`,
      };
    });
  }

  /**
   * Generate a basic reason when AI fails
   * @param {object} product - Product data
   * @returns {string} Reason text
   */
  generateFallbackReason(product) {
    const signals = product.matchSignals || [];
    const tier = product.tier || '';
    
    if (tier === 'CURATED_INTEREST' && signals.length > 0) {
      return `This curated product matches based on: ${signals.join(', ')}. It's a thoughtfully chosen gift that aligns with their interests and preferences.`;
    }
    
    if (signals.length > 0) {
      return `This product matches based on: ${signals.join(', ')}. It's been selected for its quality and relevance to their profile.`;
    }
    
    return `A carefully selected gift that fits within their budget and profile. This product has been chosen for its quality and suitability.`;
  }
}
