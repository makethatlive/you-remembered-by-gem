/**
 * Claude AI Client
 * 
 * Professional wrapper for Anthropic Claude API interactions.
 * Handles API communication, error handling, and response parsing.
 * Now includes comprehensive API call logging.
 */

import Anthropic from '@anthropic-ai/sdk';
import APICallLogger from './api-call-logger.js';

export default class ClaudeClient {
  constructor(apiKey, prisma) {
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }
    this.client = new Anthropic({
      apiKey: apiKey,
    });
    this.logger = prisma ? new APICallLogger(prisma) : null;
    this.context = {}; // Store context for logging (recipientId, giftListId, etc.)
  }

  /**
   * Set context for the next API call (for logging purposes)
   * @param {object} context - Context data (recipientId, recipientName, giftListId, operation, callType)
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context after API call
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Generate structured JSON response from Claude
   * @param {string} prompt - The prompt to send to Claude
   * @param {object} schema - JSON schema for structured output
   * @param {object} options - Additional options (model, temperature, etc.)
   * @returns {Promise<object>} Parsed JSON response
   */
  async generateStructuredContent(prompt, schema, options = {}) {
    const {
      model = 'claude-sonnet-5',
      temperature = 0.7,
      maxOutputTokens = 8192,
    } = options;

    const startTime = Date.now();
    console.log('\n🤖 ===== CLAUDE API CALL =====');
    console.log(`   Model: ${model}`);
    console.log(`   Max Tokens: ${maxOutputTokens}`);
    console.log(`   Prompt Length: ${prompt.length} characters`);

    try {
      // Claude Sonnet 5 doesn't support temperature parameter
      const createParams = {
        model,
        max_tokens: maxOutputTokens,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nRespond with valid JSON matching this structure:\n${JSON.stringify(schema, null, 2)}\n\nReturn ONLY the JSON object, no other text.`,
          },
        ],
      };

      const response = await this.client.messages.create(createParams);

      const duration = Date.now() - startTime;

      // Log response details
      console.log(`\n✅ CLAUDE RESPONSE RECEIVED`);
      console.log(`   Response ID: ${response.id}`);
      console.log(`   Model Used: ${response.model}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Stop Reason: ${response.stop_reason}`);
      
      // Token usage information
      if (response.usage) {
        console.log(`\n📊 TOKEN USAGE:`);
        console.log(`   Input Tokens: ${response.usage.input_tokens}`);
        console.log(`   Output Tokens: ${response.usage.output_tokens}`);
        console.log(`   Total Tokens: ${response.usage.input_tokens + response.usage.output_tokens}`);
        
        // Calculate approximate cost (Claude Sonnet 5 pricing)
        const inputCost = (response.usage.input_tokens / 1000000) * 3;
        const outputCost = (response.usage.output_tokens / 1000000) * 15;
        const totalCost = inputCost + outputCost;
        console.log(`   Estimated Cost: $${totalCost.toFixed(4)}`);
      }

      // Extract the text content from Claude's response
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent) {
        throw new Error('No text content in Claude response');
      }

      let text = textContent.text.trim();
      console.log(`   Response Length: ${text.length} characters`);

      // Remove markdown code block formatting if present
      text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

      // Parse the JSON response
      const parsed = JSON.parse(text);
      console.log(`   ✅ JSON parsed successfully`);
      console.log('=============================\n');
      
      // Log the API call to database
      if (this.logger) {
        await this.logger.logCall({
          callType: this.context.callType || 'OTHER',
          provider: 'claude',
          model: response.model,
          recipientId: this.context.recipientId || null,
          recipientName: this.context.recipientName || null,
          giftListId: this.context.giftListId || null,
          operation: this.context.operation || 'generate_structured_content',
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
          durationMs: duration,
          status: 'SUCCESS',
          requestData: { prompt: prompt.substring(0, 500) + '...' }, // First 500 chars
          responseData: { result: JSON.stringify(parsed).substring(0, 500) + '...' }, // First 500 chars
        });
        this.clearContext();
      }
      
      return parsed;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ CLAUDE API ERROR (after ${duration}ms)`);
      console.error(`   Error: ${error.message}`);
      console.error('=============================\n');
      
      // Log the failed API call
      if (this.logger) {
        await this.logger.logCall({
          callType: this.context.callType || 'OTHER',
          provider: 'claude',
          model: model,
          recipientId: this.context.recipientId || null,
          recipientName: this.context.recipientName || null,
          giftListId: this.context.giftListId || null,
          operation: this.context.operation || 'generate_structured_content',
          inputTokens: error.response?.usage?.input_tokens || 0,
          outputTokens: 0,
          durationMs: duration,
          status: 'FAILED',
          errorMessage: error.message,
          requestData: { prompt: prompt.substring(0, 500) + '...' },
        });
        this.clearContext();
      }
      
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  /**
   * Generate plain text response from Claude
   * @param {string} prompt - The prompt to send to Claude
   * @param {object} options - Additional options (model, temperature, etc.)
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    const {
      model = 'claude-sonnet-5',
      temperature = 0.7,
      maxOutputTokens = 2048,
    } = options;

    const startTime = Date.now();
    console.log('\n🤖 ===== CLAUDE API CALL (TEXT) =====');
    console.log(`   Model: ${model}`);

    try {
      // Claude Sonnet 5 doesn't support temperature parameter
      const createParams = {
        model,
        max_tokens: maxOutputTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      const response = await this.client.messages.create(createParams);

      const duration = Date.now() - startTime;
      console.log(`\n✅ CLAUDE RESPONSE (${duration}ms)`);
      console.log(`   Model: ${response.model}`);
      if (response.usage) {
        console.log(`   Tokens: ${response.usage.input_tokens + response.usage.output_tokens}`);
      }
      console.log('=============================\n');

      // Extract the text content from Claude's response
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent) {
        throw new Error('No text content in Claude response');
      }

      return textContent.text;
    } catch (error) {
      console.error(`\n❌ CLAUDE API ERROR: ${error.message}`);
      console.error('=============================\n');
      throw new Error(`Failed to generate text: ${error.message}`);
    }
  }

  /**
   * Check if the API key is valid by making a test request
   * @returns {Promise<boolean>} True if API key is valid
   */
  async validateApiKey() {
    try {
      await this.generateText('Hello', { maxOutputTokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}
