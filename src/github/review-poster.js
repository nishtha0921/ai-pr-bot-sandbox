/**
 * Review Poster
 * Posts reviews and comments to GitHub PRs
 * Uses batch posting with fallback to individual posts for invalid comments
 */

const logger = require('../utils/logger');
const { GitHubAPIError } = require('../utils/errors');

class ReviewPoster {
  constructor(client) {
    this.client = client;
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
  }

  /**
   * Post inline review comments with intelligent fallback
   * Tries batch posting first, falls back to individual posts if batch fails
   */
  async postInlineComments(owner, repo, prNumber, comments) {
    if (!comments || comments.length === 0) {
      logger.warn('No comments to post');
      return { posted: 0, skipped: 0 };
    }

    logger.info(`Posting ${comments.length} inline review comments`);

    // Try batch posting first
    try {
      await this.postBatchReview(owner, repo, prNumber, comments);
      logger.success(`Posted ${comments.length} inline comments via batch`);
      return { posted: comments.length, skipped: 0 };
    } catch (error) {
      const status = error.statusCode || error.status;
      
      // If batch fails with 422 (validation error), fall back to individual posts
      if (status === 422) {
        logger.warn('Batch posting failed with validation error, falling back to individual posts');
        return await this.postCommentsIndividually(owner, repo, prNumber, comments);
      }
      
      // For other errors, throw
      logger.error('Failed to post inline comments', error);
      throw error;
    }
  }

  /**
   * Post comments as a batch review
   */
  async postBatchReview(owner, repo, prNumber, comments) {
    return await this.retryWithBackoff(async () => {
      await this.client.request(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        {
          owner,
          repo,
          pull_number: prNumber,
          event: 'COMMENT',
          comments,
          headers: { 'X-GitHub-Api-Version': '2022-11-28' }
        }
      );
    });
  }

  /**
   * Post comments individually, skipping invalid ones
   * This is the fallback when batch posting fails
   */
  async postCommentsIndividually(owner, repo, prNumber, comments) {
    let posted = 0;
    let skipped = 0;

    for (const comment of comments) {
      try {
        await this.postSingleComment(owner, repo, prNumber, comment);
        posted++;
        logger.debug(`✓ Posted comment for ${comment.path}:${comment.line}`);
      } catch (error) {
        skipped++;
        const status = error.statusCode || error.status;
        if (status === 422) {
          logger.warn(`✗ Skipped invalid comment for ${comment.path}:${comment.line} - line not in diff`);
        } else {
          logger.warn(`✗ Failed to post comment for ${comment.path}:${comment.line}: ${error.message}`);
        }
      }
    }

    logger.info(`Posted ${posted}/${comments.length} comments (${skipped} skipped)`);
    return { posted, skipped };
  }

  /**
   * Post a single comment with retry logic
   */
  async postSingleComment(owner, repo, prNumber, comment) {
    return await this.retryWithBackoff(async () => {
      await this.client.request(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/comments',
        {
          owner,
          repo,
          pull_number: prNumber,
          body: comment.body,
          path: comment.path,
          line: comment.line,
          side: comment.side || 'RIGHT',
          headers: { 'X-GitHub-Api-Version': '2022-11-28' }
        }
      );
    });
  }

  /**
   * Retry a function with exponential backoff
   */
  async retryWithBackoff(fn, maxRetries = this.maxRetries) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const status = error.statusCode || error.status;
        
        // Don't retry on validation errors (422) or forbidden (403)
        if (status === 422 || status === 403 || status === 404) {
          throw error;
        }

        // Check for rate limiting (429 or secondary rate limit 403)
        const isRateLimit = status === 429 || 
                           (status === 403 && error.message?.includes('rate limit'));

        if (isRateLimit && attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, error);
          logger.warn(`Rate limited, waiting ${delay}ms before retry ${attempt}/${maxRetries}`);
          await this.sleep(delay);
          continue;
        }

        // For other errors, use exponential backoff
        if (attempt < maxRetries) {
          const delay = this.baseRetryDelay * Math.pow(2, attempt - 1);
          logger.debug(`Retrying after ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Calculate backoff delay based on rate limit headers
   */
  calculateBackoffDelay(attempt, error) {
    // Check for Retry-After header
    if (error.response?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'], 10);
      return retryAfter * 1000; // Convert to milliseconds
    }

    // Check for X-RateLimit-Reset header
    if (error.response?.headers?.['x-ratelimit-reset']) {
      const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10);
      const now = Math.floor(Date.now() / 1000);
      const waitTime = Math.max(resetTime - now, 0);
      return waitTime * 1000; // Convert to milliseconds
    }

    // Default exponential backoff
    return this.baseRetryDelay * Math.pow(2, attempt);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Post summary comment
   */
  async postSummaryComment(owner, repo, prNumber, body) {
    logger.info(`Posting summary comment to PR #${prNumber}`);

    try {
      await this.client.request(
        'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
        {
          owner,
          repo,
          issue_number: prNumber,
          body,
          headers: { 'X-GitHub-Api-Version': '2022-11-28' }
        }
      );

      logger.success('Posted summary comment');
      return { success: true };
    } catch (error) {
      logger.error('Failed to post summary comment', error);
      throw new GitHubAPIError(
        `Failed to post summary comment: ${error.message}`,
        error.status
      );
    }
  }

  /**
   * Create a review with specific event type
   */
  async createReview(owner, repo, prNumber, body, event = 'COMMENT', comments = []) {
    logger.info(`Creating ${event} review for PR #${prNumber}`);

    try {
      const params = {
        owner,
        repo,
        pull_number: prNumber,
        event,
        body,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' }
      };

      if (comments.length > 0) {
        params.comments = comments;
      }

      await this.client.request(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        params
      );

      logger.success(`Created ${event} review`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to create review', error);
      throw new GitHubAPIError(
        `Failed to create review: ${error.message}`,
        error.status
      );
    }
  }

  /**
   * Approve a PR
   */
  async approve(owner, repo, prNumber, body = 'Looks good! ✅') {
    return this.createReview(owner, repo, prNumber, body, 'APPROVE');
  }

  /**
   * Request changes on a PR
   */
  async requestChanges(owner, repo, prNumber, body, comments = []) {
    return this.createReview(owner, repo, prNumber, body, 'REQUEST_CHANGES', comments);
  }
}

module.exports = ReviewPoster;






