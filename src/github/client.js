/**
 * GitHub API Client
 * Wraps Octokit with error handling and retry logic
 */

const { Octokit } = require('@octokit/core');
const logger = require('../utils/logger');
const { GitHubAPIError } = require('../utils/errors');

class GitHubClient {
  constructor(token) {
    if (!token) {
      throw new Error('GitHub token is required');
    }
    this.octokit = new Octokit({ auth: token });
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Make a request with retry logic
   */
  async request(route, params = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`GitHub API Request: ${route}`, params);
        const response = await this.octokit.request(route, params);
        return response;
      } catch (error) {
        lastError = error;
        
        // Don't retry on 404 or 403
        if (error.status === 404 || error.status === 403) {
          // Don't log warnings for 404 - they're expected when checking for optional files
          if (error.status !== 404) {
            logger.warn(`GitHub API request failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);
          }
          break;
        }
        
        logger.warn(`GitHub API request failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);

        // Wait before retrying
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    throw new GitHubAPIError(
      `GitHub API request failed: ${lastError.message}`,
      lastError.status,
      { route, params }
    );
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the underlying Octokit instance
   */
  getOctokit() {
    return this.octokit;
  }
}

module.exports = GitHubClient;


