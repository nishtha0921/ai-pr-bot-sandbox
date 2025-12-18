/**
 * Ollama AI Provider
 * Integrates with local Ollama instance with optional RAG support
 */

const logger = require('../../utils/logger');
const { AIProviderError } = require('../../utils/errors');
const prompts = require('../prompts');

class OllamaProvider {
  constructor(config = {}, ragRetriever = null) {
    this.url = config.url || 'http://localhost:11434/api/generate';
    this.model = config.model || 'qwen2.5-coder';
    this.ragRetriever = ragRetriever;
    this.useRAG = config.useRAG !== false && ragRetriever !== null;
  }

  /**
   * Get provider name
   */
  getName() {
    return this.useRAG ? 'Ollama with RAG' : 'Ollama';
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
   * Check if RAG is available
   */
  async isRAGAvailable() {
    if (!this.ragRetriever) {
      return false;
    }

    try {
      const stats = await this.ragRetriever.vectorStore.getStats();
      return stats && stats.documentCount > 0;
    } catch (error) {
      logger.warn('RAG availability check failed', error);
      return false;
    }
  }

  /**
   * Review code diff (with optional RAG enhancement)
   */
  async review(diff, context = {}) {
    // Use RAG-enhanced review if available
    if (this.useRAG && this.ragRetriever) {
      return this.reviewWithRAG(diff, context);
    }

    return this.reviewBasic(diff, context);
  }

  /**
   * Basic review without RAG
   */
  async reviewBasic(diff, context = {}) {
    logger.info(`Requesting review from Ollama (${this.model})`);

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
   * RAG-enhanced review
   */
  async reviewWithRAG(diff, context = {}) {
    logger.info('Performing RAG-enhanced review');

    try {
      // 1. Retrieve relevant context
      const ragContexts = await this.ragRetriever.retrieveContext(
        context.prData,
        context.files,
        diff
      );

      // 2. Build enhanced context
      const enhancedContext = this.ragRetriever.buildEnhancedContext(ragContexts);

      // 3. Create RAG-enhanced prompt
      const enhancedPrompt = this.buildRAGPrompt(diff, context, enhancedContext);

      // 4. Get AI review with enhanced context
      const response = await this.generateReview(enhancedPrompt);

      logger.success('RAG-enhanced review completed');
      return response;

    } catch (error) {
      logger.warn('RAG retrieval failed, falling back to basic review', error);
      return this.reviewBasic(diff, context);
    }
  }

  /**
   * Build RAG-enhanced prompt
   */
  buildRAGPrompt(diff, context, ragContext) {
    // Truncate diff to prevent context overflow
    const maxDiffLength = 3000;
    const truncatedDiff = diff.length > maxDiffLength 
      ? diff.substring(0, maxDiffLength) + '\n\n... (diff truncated for length) ...'
      : diff;
    
    const basePrompt = prompts.buildReviewPrompt(truncatedDiff, context);

    // Truncate RAG context too
    const maxRagLength = 2000;
    const truncatedRagContext = ragContext.length > maxRagLength
      ? ragContext.substring(0, maxRagLength) + '\n\n... (context truncated) ...'
      : ragContext;

    return `
${basePrompt.split('Code Changes:')[0]}

## Retrieved Context

The following context has been retrieved from the repository documentation, similar code patterns, and past reviews:

${truncatedRagContext}

## Code Changes:

${truncatedDiff}

Please use the retrieved context above to provide more informed and consistent reviews. 
Consider:
- Are the changes consistent with documented patterns?
- Have similar issues been flagged in past reviews?
- Do the changes follow the project's coding standards?

IMPORTANT: Return ONLY valid JSON with this exact structure:
{
  "comments": [
    { "path": "file.js", "line": 10, "body": "comment" }
  ]
}

NO other text before or after the JSON.
    `.trim();
  }

  /**
   * Generate review from prompt
   */
  async generateReview(prompt) {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 2000,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseResponse(data.response);

    } catch (error) {
      logger.error('Ollama request failed', error);
      throw error;
    }
  }

  /**
   * Parse Ollama response
   */
  parseResponse(response) {
    const { parseReviewResponse } = require('../response-parser');
    return parseReviewResponse(response);
  }
}

module.exports = OllamaProvider;
