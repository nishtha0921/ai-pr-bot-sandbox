/**
 * Review Poster
 * Posts reviews and comments to GitHub PRs
 */

const logger = require('../utils/logger');
const { GitHubAPIError } = require('../utils/errors');

class ReviewPoster {
  constructor(client) {
    this.client = client;
  }

  /**
   * Post inline review comments
   */
  async postInlineComments(owner, repo, prNumber, comments) {
    if (!comments || comments.length === 0) {
      logger.warn('No comments to post');
      return { posted: 0, skipped: 0 };
    }

    logger.info(`Posting ${comments.length} inline review comments`);

    try {
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

      logger.success(`Posted ${comments.length} inline comments`);
      return { posted: comments.length, skipped: 0 };
    } catch (error) {
      logger.error('Failed to post inline comments', error);
      throw new GitHubAPIError(
        `Failed to post inline comments: ${error.message}`,
        error.status
      );
    }
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




