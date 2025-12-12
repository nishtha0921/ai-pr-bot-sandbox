/**
 * Reviewer
 * Main orchestrator for the code review process
 */

const GitHubClient = require('../github/client');
const PRFetcher = require('../github/pr-fetcher');
const ReviewPoster = require('../github/review-poster');
const OllamaProvider = require('../ai/providers/ollama');
const { mapCommentsToLines } = require('../diff/line-mapper');
const { parseDiffPositions, mapCommentsToPositions } = require('../diff/position-mapper');
const commentBuilder = require('./comment-builder');
const logger = require('../utils/logger');
const config = require('../utils/config');
const { ReviewError } = require('../utils/errors');

class Reviewer {
  constructor(options = {}) {
    // Load config
    config.load();
    const cfg = config.getAll();
    
    // Initialize GitHub client
    const githubToken = options.githubToken || cfg.github.token;
    if (!githubToken) {
      throw new ReviewError('GitHub token is required');
    }
    this.githubClient = new GitHubClient(githubToken);
    this.prFetcher = new PRFetcher(this.githubClient);
    this.reviewPoster = new ReviewPoster(this.githubClient);
    
    // Initialize AI provider
    const aiProvider = options.aiProvider || 'ollama';
    if (aiProvider === 'ollama') {
      this.aiProvider = new OllamaProvider({
        url: options.ollamaUrl || cfg.ollama.url,
        model: options.ollamaModel || cfg.ollama.model,
      });
    } else {
      throw new ReviewError(`Unknown AI provider: ${aiProvider}`);
    }
    
    this.options = options;
  }

  /**
   * Review a pull request
   */
  async reviewPR(ownerRepo, prNumber) {
    logger.section(`Reviewing PR #${prNumber} in ${ownerRepo}`);
    
    // Parse owner/repo
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) {
      throw new ReviewError('Invalid owner/repo format. Expected: owner/repo');
    }
    
    try {
      // Step 1: Fetch PR data
      logger.info('Step 1: Fetching PR data from GitHub');
      const prData = await this.prFetcher.fetchAllData(owner, repo, prNumber);
      
      // Step 2: Send to AI for review
      logger.info('Step 2: Sending diff to AI for review');
      const context = {
        pr: prData.details,
        files: prData.files,
        commits: prData.commits,
        existingComments: prData.comments,
      };
      
      const reviewResult = await this.aiProvider.review(prData.diff, context);
      logger.success(`AI returned ${reviewResult.comments.length} comments`);
      
      // Step 3: Map comments using line-based API (simpler & more reliable)
      logger.info('Step 3: Mapping comments to line numbers');
      
      // Get the latest commit SHA
      const commitId = prData.commits && prData.commits.length > 0 
        ? prData.commits[prData.commits.length - 1].sha 
        : null;
      
      const reviewComments = mapCommentsToLines(
        reviewResult.comments,
        prData.files,
        commitId
      );
      
      // Step 4: Post review to GitHub
      logger.info('Step 4: Posting review to GitHub');
      if (reviewComments.length > 0) {
        await this.reviewPoster.postInlineComments(owner, repo, prNumber, reviewComments);
        logger.success(`Posted ${reviewComments.length} inline comments`);
      } else {
        logger.warn('No valid comments to post');
      }
      
      // Step 6: Post summary comment (optional)
      // if (this.options.postSummary !== false) {
      //   const summary = commentBuilder.buildSummaryComment(
      //     {
      //       comments: reviewComments,
      //       provider: this.aiProvider.getName(),
      //     },
      //     {
      //       filesChanged: prData.files.length,
      //       additions: prData.details.additions,
      //       deletions: prData.details.deletions,
      //     }
      //   );
      //   await this.reviewPoster.postSummaryComment(owner, repo, prNumber, summary);
      //   logger.success('Posted summary comment');
      // }
      
      logger.section('Review completed successfully! ✅');
      
      return {
        success: true,
        commentsPosted: reviewComments.length,
        filesReviewed: prData.files.length,
      };
    } catch (error) {
      logger.error('Review failed', error);
      throw error;
    }
  }

  /**
   * Check if AI provider is available
   */
  async checkAIProvider() {
    const available = await this.aiProvider.isAvailable();
    if (available) {
      logger.success(`${this.aiProvider.getName()} is available`);
    } else {
      logger.error(`${this.aiProvider.getName()} is not available`);
    }
    return available;
  }
}

module.exports = Reviewer;


