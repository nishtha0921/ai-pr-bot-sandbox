/**
 * Base AI Provider
 * Interface that all AI providers must implement
 */

class BaseAIProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Review code diff
   * @param {string} diff - The git diff to review
   * @param {object} context - Additional context (PR title, files, etc.)
   * @returns {Promise<object>} - Review results with comments array
   */
  async review(diff, context = {}) {
    throw new Error('review() must be implemented by subclass');
  }

  /**
   * Check if provider is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by subclass');
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }

  /**
   * Parse AI response into structured format
   * @param {string} response - Raw AI response
   * @returns {object} - Parsed response with comments array
   */
  parseResponse(response) {
    throw new Error('parseResponse() must be implemented by subclass');
  }
}

module.exports = BaseAIProvider;


