/**
 * RAG Retriever
 * Retrieves relevant context for PR reviews
 */

const logger = require('../utils/logger');

class RAGRetriever {
  constructor(vectorStore) {
    this.vectorStore = vectorStore;
  }

  /**
   * Retrieve relevant context for a PR
   * @param {Object} prData - PR metadata
   * @param {Array} files - Changed files
   * @param {string} diff - PR diff
   */
  async retrieveContext(prData, files, diff) {
    logger.info('Retrieving relevant context for PR review');

    const contexts = {
      documentation: [],
      codeExamples: [],
      reviewHistory: [],
      relatedIssues: []
    };

    // 1. Get relevant documentation
    contexts.documentation = await this.getRelevantDocs(prData, files);

    // 2. Get similar code patterns
    contexts.codeExamples = await this.getSimilarCode(files, diff);

    // 3. Get review history for similar changes
    contexts.reviewHistory = await this.getReviewHistory(files);

    // 4. Get related issues/bugs
    contexts.relatedIssues = await this.getRelatedIssues(prData);

    return contexts;
  }

  /**
   * Get relevant documentation
   */
  async getRelevantDocs(prData, files) {
    const queries = [
      prData.title,
      prData.body || '',
      files.map(f => f.filename).join(' ')
    ];

    const allResults = [];
    
    for (const query of queries) {
      if (!query || query.trim().length === 0) continue;

      const results = await this.vectorStore.search(
        query,
        3,
        { type: 'documentation' }
      );
      allResults.push(...results);
    }

    // Deduplicate by ID
    const unique = this.deduplicateResults(allResults);
    
    logger.debug(`Found ${unique.length} relevant documentation chunks`);
    return unique;
  }

  /**
   * Get similar code patterns
   */
  async getSimilarCode(files, diff) {
    // Use file paths as queries
    const queries = files.map(f => `File changes in: ${f.filename}`);
    
    const allResults = [];
    
    for (const query of queries.slice(0, 5)) { // Limit to 5 files
      const results = await this.vectorStore.search(
        query,
        2,
        { type: 'source_code' }
      );
      allResults.push(...results);
    }

    const unique = this.deduplicateResults(allResults);
    
    logger.debug(`Found ${unique.length} similar code examples`);
    return unique;
  }

  /**
   * Get review history for similar changes
   */
  async getReviewHistory(files) {
    // Search for past reviews of similar files
    const fileNames = files.map(f => f.filename).slice(0, 3);
    const query = `Previous reviews for: ${fileNames.join(', ')}`;

    const results = await this.vectorStore.search(
      query,
      3,
      { type: 'review_history' }
    );

    logger.debug(`Found ${results.length} similar past reviews`);
    return results;
  }

  /**
   * Get related issues (placeholder - would integrate with issue tracker)
   */
  async getRelatedIssues(prData) {
    // Extract issue numbers from PR body (e.g., "Fixes #123")
    const issueRefs = this.extractIssueReferences(prData.body || '');
    
    if (issueRefs.length === 0) {
      return [];
    }

    // Search for related issues in vector store
    const query = `Issues: ${issueRefs.join(', ')}`;
    const results = await this.vectorStore.search(
      query,
      2,
      { type: 'issue' }
    );

    logger.debug(`Found ${results.length} related issues`);
    return results;
  }

  /**
   * Build enhanced context for AI prompt
   */
  buildEnhancedContext(contexts, maxLength = 4000) {
    let contextText = '';

    // Add documentation context
    if (contexts.documentation.length > 0) {
      contextText += '\n## Relevant Documentation\n\n';
      contexts.documentation.forEach((doc, i) => {
        contextText += `### Doc ${i + 1}: ${doc.metadata.file}\n`;
        contextText += `${doc.text.substring(0, 500)}...\n\n`;
      });
    }

    // Add code examples
    if (contexts.codeExamples.length > 0) {
      contextText += '\n## Similar Code Patterns\n\n';
      contexts.codeExamples.forEach((code, i) => {
        contextText += `### Example ${i + 1}: ${code.metadata.file}\n`;
        contextText += `${code.text.substring(0, 400)}...\n\n`;
      });
    }

    // Add review history
    if (contexts.reviewHistory.length > 0) {
      contextText += '\n## Past Review Patterns\n\n';
      contexts.reviewHistory.forEach((review, i) => {
        contextText += `### Review ${i + 1}\n`;
        contextText += `${review.text.substring(0, 400)}...\n\n`;
      });
    }

    // Truncate if too long
    if (contextText.length > maxLength) {
      contextText = contextText.substring(0, maxLength) + '\n\n[Context truncated...]';
    }

    return contextText;
  }

  /**
   * Extract issue references from text
   */
  extractIssueReferences(text) {
    const issuePattern = /#(\d+)/g;
    const matches = text.matchAll(issuePattern);
    return Array.from(matches).map(m => m[1]);
  }

  /**
   * Deduplicate results by ID
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      if (seen.has(result.id)) {
        return false;
      }
      seen.add(result.id);
      return true;
    });
  }

  /**
   * Rank and filter results by relevance
   */
  rankResults(results, threshold = 0.7) {
    return results
      .filter(r => r.distance < threshold)
      .sort((a, b) => a.distance - b.distance);
  }
}

module.exports = RAGRetriever;

