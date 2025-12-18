/**
 * PR Fetcher
 * Fetches PR data from GitHub API
 */

const logger = require('../utils/logger');
const { GitHubAPIError } = require('../utils/errors');

class PRFetcher {
  constructor(client) {
    this.client = client;
  }

  /**
   * Fetch PR details
   */
  async fetchPRDetails(owner, repo, prNumber) {
    logger.info(`Fetching PR #${prNumber} from ${owner}/${repo}`);
    
    const response = await this.client.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      { owner, repo, pull_number: prNumber, headers: { 'X-GitHub-Api-Version': '2022-11-28' } }
    );

    return {
      title: response.data.title,
      body: response.data.body,
      author: response.data.user?.login,
      base: response.data.base?.ref,
      head: response.data.head?.ref,
      state: response.data.state,
      merged: response.data.merged,
      additions: response.data.additions,
      deletions: response.data.deletions,
      changedFiles: response.data.changed_files,
    };
  }

  /**
   * Fetch changed files in PR
   */
  async fetchFiles(owner, repo, prNumber) {
    logger.info(`Fetching changed files for PR #${prNumber}`);
    
    const response = await this.client.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        },
      }
    );

    return response.data.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    }));
  }

  /**
   * Fetch unified diff for PR
   */
  async fetchDiff(owner, repo, prNumber) {
    logger.info(`Fetching diff for PR #${prNumber}`);
    
    const response = await this.client.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner,
        repo,
        pull_number: prNumber,
        headers: {
          accept: 'application/vnd.github.v3.diff',
          'X-GitHub-Api-Version': '2022-11-28'
        },
      }
    );

    return response.data;
  }

  /**
   * Fetch commits for PR
   */
  async fetchCommits(owner, repo, prNumber) {
    logger.info(`Fetching commits for PR #${prNumber}`);
    
    const response = await this.client.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    return response.data.map(c => ({
      sha: c.sha,
      message: c.commit?.message,
      author: c.author?.login,
    }));
  }

  /**
   * Fetch existing review comments
   */
  async fetchComments(owner, repo, prNumber) {
    logger.info(`Fetching existing comments for PR #${prNumber}`);
    
    const response = await this.client.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
      {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      }
    );

    return response.data.map(c => ({
      path: c.path,
      line: c.line,
      body: c.body,
      author: c.user?.login,
    }));
  }

  /**
   * Fetch all PR data in one call
   */
  async fetchAllData(owner, repo, prNumber) {
    logger.section(`Fetching all data for PR #${prNumber}`);
    
    const [details, files, diff, commits, comments] = await Promise.all([
      this.fetchPRDetails(owner, repo, prNumber),
      this.fetchFiles(owner, repo, prNumber),
      this.fetchDiff(owner, repo, prNumber),
      this.fetchCommits(owner, repo, prNumber),
      this.fetchComments(owner, repo, prNumber),
    ]);

    logger.success(`Fetched PR data: ${files.length} files, ${commits.length} commits`);

    return {
      details,
      files,
      diff,
      commits,
      comments,
    };
  }
}

module.exports = PRFetcher;


