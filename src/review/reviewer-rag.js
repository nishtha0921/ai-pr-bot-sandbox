/**
 * RAG-Enhanced Reviewer
 * Extends base reviewer with RAG capabilities
 */

const Reviewer = require('./reviewer');
const OllamaRAGProvider = require('../ai/providers/ollama-rag');
const VectorStore = require('../rag/vector-store');
const RAGRetriever = require('../rag/retriever');
const DocumentIndexer = require('../rag/indexer');
const { mapCommentsToLines } = require('../diff/line-mapper');
const logger = require('../utils/logger');
const config = require('../utils/config');

class RAGReviewer extends Reviewer {
  constructor(options = {}) {
    // Initialize RAG components first
    const vectorStore = new VectorStore({
      chromaUrl: options.chromaUrl || 'http://localhost:8002',
      collectionName: options.collectionName || 'pr-reviews'
    });

    const ragRetriever = new RAGRetriever(vectorStore);
    const indexer = new DocumentIndexer(vectorStore);

    // Call parent constructor with standard 'ollama' provider
    // (we'll replace it with RAG-enhanced version after)
    const parentOptions = {
      ...options,
      aiProvider: 'ollama'  // Use standard ollama for parent initialization
    };
    
    super(parentOptions);

    // Now replace the AI provider with RAG-enhanced version
    config.load();
    const cfg = config.getAll();
    this.aiProvider = new OllamaRAGProvider(
      {
        url: options.ollamaUrl || cfg.ollama.url,
        model: options.ollamaModel || cfg.ollama.model,
        useRAG: options.useRAG !== false
      },
      ragRetriever
    );

    // Store RAG components
    this.vectorStore = vectorStore;
    this.ragRetriever = ragRetriever;
    this.indexer = indexer;
    this.autoIndex = options.autoIndex !== false;
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
   * Review PR with RAG
   */
  async reviewPR(ownerRepo, prNumber) {
    logger.section(`Reviewing PR #${prNumber} with RAG`);

    // Initialize RAG if not already done
    await this.initialize();

    // Parse owner/repo
    const [owner, repo] = ownerRepo.includes('/') 
      ? ownerRepo.split('/')
      : [ownerRepo, null];

    if (!repo) {
      throw new Error('Invalid owner/repo format. Expected: owner/repo');
    }

    // Step 1: Fetch PR data
    logger.info('Step 1: Fetching PR data from GitHub');
    const prData = await this.prFetcher.fetchAllData(owner, repo, prNumber);

    // Step 2: Auto-index repository if enabled
    if (this.autoIndex) {
      await this.maybeIndexRepository(owner, repo);
    }

    // Step 3: Index this review for future reference
    await this.indexCurrentReview(prData, owner, repo);

    // Step 4: Get AI review with RAG context
    logger.info('Step 2: Sending diff to AI for review with RAG context');
    const aiResponse = await this.aiProvider.review(prData.diff, {
      prData: prData.details,
      files: prData.files,
      commits: prData.commits
    });

    logger.success(`AI returned ${aiResponse.comments.length} comments`);

    // Step 5: Map comments using line-based API
    logger.info('Step 3: Mapping comments to line numbers');
    
    // Get the latest commit SHA
    const commitId = prData.commits && prData.commits.length > 0 
      ? prData.commits[prData.commits.length - 1].sha 
      : null;
    
    const mappedComments = mapCommentsToLines(
      aiResponse.comments,
      prData.files,
      commitId
    );

    logger.info(`Mapped ${mappedComments.length}/${aiResponse.comments.length} comments to line numbers`);

    // Step 6: Post review
    logger.info('Step 4: Posting review to GitHub');
    if (mappedComments.length > 0) {
      await this.reviewPoster.postInlineComments(owner, repo, prNumber, mappedComments);
      logger.success(`Posted ${mappedComments.length} inline comments`);
    } else {
      logger.warn('No valid comments to post');
    }

    logger.section('Review completed successfully! ✅');

    return {
      filesReviewed: prData.files.length,
      commentsPosted: mappedComments.length,
      ragEnabled: true
    };
  }

  /**
   * Maybe index repository (if not already indexed recently)
   */
  async maybeIndexRepository(owner, repo) {
    try {
      // Check if repo is already indexed
      const results = await this.vectorStore.search(
        `repository ${owner}/${repo}`,
        1,
        { owner, repo, type: 'documentation' }
      );

      if (results.length > 0) {
        logger.debug(`Repository ${owner}/${repo} already indexed`);
        return true;
      }

      // Repository not indexed - try to fetch and index key files from GitHub
      logger.info(`Repository ${owner}/${repo} not indexed - fetching key files from GitHub...`);
      
      const indexed = await this.indexRepositoryFromGitHub(owner, repo);
      
      if (indexed) {
        logger.success(`Successfully indexed ${indexed} documents from ${owner}/${repo}`);
        return true;
      } else {
        logger.warn(`Could not auto-index repository. Consider running: node scripts/index-repo.js <path> ${owner} ${repo}`);
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

      // List of important files to index
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

      // Fetch each file
      for (const file of filesToIndex) {
        try {
          const response = await this.githubClient.request(
            'GET /repos/{owner}/{repo}/contents/{path}',
            {
              owner,
              repo,
              path: file
            }
          );

          if (response.data && response.data.content) {
            // Decode base64 content
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            
            // Determine document type
            const type = file.endsWith('.md') ? 'documentation' : 'configuration';
            
            // Chunk large files
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
          // File doesn't exist, skip silently
          logger.debug(`✗ Skipped ${file} (not found)`);
        }
      }

      // Add all documents to vector store
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
      // Index the PR review for future context
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
}

module.exports = RAGReviewer;

