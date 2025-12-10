/**
 * Ollama AI Provider
 * Integrates with local Ollama instance
 */

const BaseAIProvider = require('./base');
const logger = require('../../utils/logger');
const { AIProviderError } = require('../../utils/errors');
const prompts = require('../prompts');

class OllamaProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.url = config.url || 'http://localhost:11434/api/generate';
    this.model = config.model || 'llama3.1';
  }

  /**
   * Get provider name
   */
  getName() {
    return 'Ollama';
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable() {
    try {
      const response = await fetch(this.url.replace('/api/generate', '/api/tags'));
      return response.ok;
    } catch (error) {
      logger.error('Ollama is not available', error);
      return false;
    }
  }

  /**
   * Review code diff
   */
  async review(diff, context = {}) {
    logger.info(`Requesting review from Ollama (${this.model})`);

    // Build prompt
    const prompt = prompts.buildReviewPrompt(diff, context);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AIProviderError(
          `Ollama returned status ${response.status}`,
          'ollama',
          { status: response.status, body: text }
        );
      }

      const data = await response.json();
      const rawResponse = data.response || '';

      logger.debug('Raw Ollama response', rawResponse.substring(0, 500));

      // Parse the response
      return this.parseResponse(rawResponse);
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `Ollama request failed: ${error.message}`,
        'ollama',
        { originalError: error }
      );
    }
  }

  /**
   * Parse Ollama response
   */
  parseResponse(response) {
    try {
      const parsed = JSON.parse(response);
      const comments = parsed.comments || [];
      
      logger.info(`Parsed ${comments.length} comments from Ollama`);
      
      return {
        comments,
        raw: response,
      };
    } catch (error) {
      logger.error('Failed to parse Ollama response as JSON', error);
      logger.debug('Response was', response.substring(0, 500));
      
      // Return empty comments if parsing fails
      return {
        comments: [],
        raw: response,
        parseError: error.message,
      };
    }
  }
}

module.exports = OllamaProvider;


