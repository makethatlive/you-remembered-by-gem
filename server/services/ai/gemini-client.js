/**
 * Gemini AI Client
 * 
 * Professional wrapper for Google Gemini API interactions.
 * Handles API communication, error handling, and response parsing.
 */

// Use createRequire for CommonJS modules in ESM context
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { GoogleGenerativeAI } = require('@google/generative-ai');

export default class GeminiClient {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate structured JSON response from Gemini
   * @param {string} prompt - The prompt to send to Gemini
   * @param {object} schema - JSON schema for structured output
   * @param {object} options - Additional options (model, temperature, etc.)
   * @returns {Promise<object>} Parsed JSON response
   */
  async generateStructuredContent(prompt, schema, options = {}) {
    const {
      model = 'gemini-2.5-flash',
      temperature = 0.7,
      maxOutputTokens = 8192,
    } = options;

    try {
      const generativeModel = this.genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const result = await generativeModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse the JSON response
      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  /**
   * Generate plain text response from Gemini
   * @param {string} prompt - The prompt to send to Gemini
   * @param {object} options - Additional options (model, temperature, etc.)
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    const {
      model = 'gemini-2.5-flash',
      temperature = 0.7,
      maxOutputTokens = 2048,
    } = options;

    try {
      const generativeModel = this.genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      });

      const result = await generativeModel.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error.message);
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
