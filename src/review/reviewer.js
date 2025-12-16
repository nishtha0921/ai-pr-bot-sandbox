/**
 * Reviewer
 * Main orchestrator for the code review process with RAG support
 */

const GitHubClient = require('../github/client');
const PRFetcher = require('../github/pr-fetcher');
const ReviewPoster = require('../github/review-poster');
const OllamaProvider = require('../ai/providers/ollama');
const VectorStore = require('../rag/vector-store');
const RAGRetriever = require('../rag/retriever');
const DocumentIndexer = require('../rag/indexer');
const { mapCommentsToLines } = require('../diff/line-mapper');
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
    
    // Initialize RAG components
    this.vectorStore = new VectorStore({
      chromaUrl: options.chromaUrl || 'http://localhost:8002',
      collectionName: options.collectionName || 'pr-reviews'
    });
    this.ragRetriever = new RAGRetriever(this.vectorStore);
    this.indexer = new DocumentIndexer(this.vectorStore);
    
    // Initialize AI provider with RAG support
    this.aiProvider = new OllamaProvider(
      {
        url: options.ollamaUrl || cfg.ollama.url,
        model: options.ollamaModel || cfg.ollama.model,
        useRAG: options.useRAG !== false
      },
      this.ragRetriever
    );
    
    this.autoIndex = options.autoIndex !== false;
    this.options = options;
  }

  /**
   * Initialize RAG system
   */
  async initialize() {
    logger.info('Initializing RAG system...');
    
    const initialized = await this.vectorStore.initialize();
    if (!initialized) {
      logger.warn('Vector store initialization failed - RAG disabled');
      return false;
    }

    const stats = await this.vectorStore.getStats();
    logger.info(`Vector store ready: ${stats.documentCount} documents`);
    
    return true;
  }

  /**
   * Review a pull request
   */
  async reviewPR(ownerRepo, prNumber) {
    logger.section(`Reviewing PR #${prNumber} in ${ownerRepo}`);
    
    // Initialize RAG
    await this.initialize();
    
    // Parse owner/repo
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) {
      throw new ReviewError('Invalid owner/repo format. Expected: owner/repo');
    }
    
    try {
      // Step 1: Fetch PR data
      logger.info('Step 1: Fetching PR data from GitHub');
      const prData = await this.prFetcher.fetchAllData(owner, repo, prNumber);
      
      // Step 2: Auto-index repository if enabled
      if (this.autoIndex) {
        await this.maybeIndexRepository(owner, repo);
      }

      // Step 3: Index this review for future reference
      await this.indexCurrentReview(prData, owner, repo);
      
      // Step 4: Send to AI for review
      logger.info('Step 2: Sending diff to AI for review');
      const context = {
        prData: prData.details,
        files: prData.files,
        commits: prData.commits,
        existingComments: prData.comments,
      };
      
      const reviewResult = await this.aiProvider.review(prData.diff, context);
      logger.success(`AI returned ${reviewResult.comments.length} comments`);
      
      // Step 5: Map comments using line-based API
      logger.info('Step 3: Mapping comments to line numbers');
      
      const commitId = prData.commits && prData.commits.length > 0 
        ? prData.commits[prData.commits.length - 1].sha 
        : null;
      
      const reviewComments = mapCommentsToLines(
        reviewResult.comments,
        prData.files,
        commitId
      );
      
      logger.info(`Mapped ${reviewComments.length}/${reviewResult.comments.length} comments to line numbers`);
      
      // Step 6: Post review to GitHub
      logger.info('Step 4: Posting review to GitHub');
      if (reviewComments.length > 0) {
        await this.reviewPoster.postInlineComments(owner, repo, prNumber, reviewComments);
        logger.success(`Posted ${reviewComments.length} inline comments`);
      } else {
        logger.warn('No valid comments to post');
      }
      
      logger.section('Review completed successfully! ✅');
      
      return {
        success: true,
        commentsPosted: reviewComments.length,
        filesReviewed: prData.files.length,
        ragEnabled: this.options.useRAG !== false
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

  /**
   * Check if RAG is available
   */
  async isRAGAvailable() {
    return await this.aiProvider.isRAGAvailable();
  }

  /**
   * Get RAG statistics
   */
  async getRAGStats() {
    return await this.vectorStore.getStats();
  }

  /**
   * Maybe index repository (if not already indexed recently)
   */
  async maybeIndexRepository(owner, repo) {
    try {
      const results = await this.vectorStore.search(
        `repository ${owner}/${repo}`,
        1,
        { owner, repo, type: 'documentation' }
      );

      if (results.length > 0) {
        logger.debug(`Repository ${owner}/${repo} already indexed`);
        return true;
      }

      logger.info(`Repository ${owner}/${repo} not indexed - fetching key files from GitHub...`);
      
      const indexed = await this.indexRepositoryFromGitHub(owner, repo);
      
      if (indexed) {
        logger.success(`Successfully indexed ${indexed} documents from ${owner}/${repo}`);
        return true;
      } else {
        logger.warn(`Could not auto-index repository.`);
        return false;
      }
      
    } catch (error) {
      logger.debug('Repository index check failed', error);
      return false;
    }
  }

  /**
   * Index repository by fetching key files from GitHub API
   */
  async indexRepositoryFromGitHub(owner, repo) {
    try {
      const documents = [];
      const filesToIndex = [
        'README.md',
        'CONTRIBUTING.md',
        'CODE_OF_CONDUCT.md',
        'SECURITY.md',
        'ARCHITECTURE.md',
        'docs/README.md',
        'package.json',
        'tsconfig.json',
        '.eslintrc.json',
        '.prettierrc'
      ];

      logger.debug(`Fetching ${filesToIndex.length} key files from GitHub...`);

      for (const file of filesToIndex) {
        try {
          const response = await this.githubClient.request(
            'GET /repos/{owner}/{repo}/contents/{path}',
            { owner, repo, path: file }
          );

          if (response.data && response.data.content) {
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            const type = file.endsWith('.md') ? 'documentation' : 'configuration';
            
            if (content.length > 1000) {
              const chunks = this.chunkText(content, 1000);
              chunks.forEach((chunk, index) => {
                documents.push({
                  id: this.generateId(`${owner}-${repo}-${file}-${index}`),
                  text: `File: ${file}\n\n${chunk}`,
                  metadata: {
                    type,
                    file,
                    owner,
                    repo,
                    chunk: index,
                    source: 'github_api',
                    indexed_at: new Date().toISOString()
                  }
                });
              });
            } else {
              documents.push({
                id: this.generateId(`${owner}-${repo}-${file}`),
                text: `File: ${file}\n\n${content}`,
                metadata: {
                  type,
                  file,
                  owner,
                  repo,
                  source: 'github_api',
                  indexed_at: new Date().toISOString()
                }
              });
            }

            logger.debug(`✓ Fetched ${file}`);
          }
        } catch (error) {
          if (error.status !== 404) {
            logger.debug(`✗ Error fetching ${file}:`, error.message);
          }
        }
      }

      if (documents.length > 0) {
        await this.vectorStore.addDocuments(documents);
        return documents.length;
      }

      return 0;
      
    } catch (error) {
      logger.error('Failed to index repository from GitHub', error);
      return 0;
    }
  }

  /**
   * Chunk text into smaller pieces
   */
  chunkText(text, maxChunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + maxChunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
      
      if (start >= text.length - overlap) break;
    }

    return chunks;
  }

  /**
   * Generate unique document ID
   */
  generateId(text) {
    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(text)
      .digest('hex');
  }

  /**
   * Index current review for future reference
   */
  async indexCurrentReview(prData, owner, repo) {
    try {
      await this.indexer.indexReview(
        prData.details,
        prData.comments,
        owner,
        repo
      );
      logger.debug(`Indexed review for PR #${prData.details.number}`);
    } catch (error) {
      logger.warn('Failed to index current review', error);
    }
  }
}

module.exports = Reviewer;
