/**
 * Ollama Provider with RAG Support
 * Extends base Ollama provider with RAG context
 */

const OllamaProvider = require('./ollama');
const logger = require('../../utils/logger');

class OllamaRAGProvider extends OllamaProvider {
  constructor(config, ragRetriever) {
    super(config);
    this.ragRetriever = ragRetriever;
    this.useRAG = config.useRAG !== false; // Enabled by default
  }

  /**
   * Review with RAG context
   */
  async review(diff, context = {}) {
    if (!this.useRAG || !this.ragRetriever) {
      // Fall back to base provider
      return super.review(diff, context);
    }

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
      const response = await this.generateReview(enhancedPrompt, context);

      logger.success('RAG-enhanced review completed');
      return response;

    } catch (error) {
      logger.warn('RAG retrieval failed, falling back to base review', error);
      // Fall back to base provider on error
      return super.review(diff, context);
    }
  }

  /**
   * Build RAG-enhanced prompt
   */
  buildRAGPrompt(diff, context, ragContext) {
    const { buildReviewPrompt } = require('../prompts');
    
    // Truncate diff to prevent context overflow
    // With RAG context, we need to be more conservative
    const maxDiffLength = 3000;  // Shorter because we add RAG context
    const truncatedDiff = diff.length > maxDiffLength 
      ? diff.substring(0, maxDiffLength) + '\n\n... (diff truncated for length) ...'
      : diff;
    
    const basePrompt = buildReviewPrompt(truncatedDiff, context);

    // Truncate RAG context too
    const maxRagLength = 2000;
    const truncatedRagContext = ragContext.length > maxRagLength
      ? ragContext.substring(0, maxRagLength) + '\n\n... (context truncated) ...'
      : ragContext;

    // Insert RAG context before the diff
    const ragEnhancedPrompt = `
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

    return ragEnhancedPrompt;
  }

  /**
   * Get review with context awareness
   */
  async generateReview(prompt, context) {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for more consistent reviews
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
  parseResponse(responseText) {
    const { parseReviewResponse } = require('../response-parser');
    return parseReviewResponse(responseText);
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
   * Get provider name
   */
  getName() {
    return 'Ollama with RAG';
  }
}

module.exports = OllamaRAGProvider;

