/**
 * Document Indexer
 * Indexes repository content, reviews, and documentation for RAG
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class DocumentIndexer {
  constructor(vectorStore) {
    this.vectorStore = vectorStore;
    this.supportedExtensions = [
      '.js', '.jsx', '.ts', '.tsx',
      '.py', '.java', '.go', '.rs',
      '.md', '.txt', '.json', '.yml', '.yaml'
    ];
    this.maxFileSize = 100000; // 100KB
  }

  /**
   * Index entire repository
   * @param {string} repoPath - Path to repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   */
  async indexRepository(repoPath, owner, repo) {
    logger.section(`Indexing repository: ${owner}/${repo}`);
    
    const documents = [];

    // 1. Index documentation files
    const docs = await this.indexDocumentation(repoPath, owner, repo);
    documents.push(...docs);

    // 2. Index source code (sample files for context)
    const code = await this.indexCodeFiles(repoPath, owner, repo);
    documents.push(...code);

    // 3. Index configuration files
    const config = await this.indexConfigFiles(repoPath, owner, repo);
    documents.push(...config);

    // Add all documents to vector store
    if (documents.length > 0) {
      await this.vectorStore.addDocuments(documents);
      logger.success(`Indexed ${documents.length} documents`);
    } else {
      logger.warn('No documents found to index');
    }

    return documents.length;
  }

  /**
   * Index documentation files (README, CONTRIBUTING, etc.)
   */
  async indexDocumentation(repoPath, owner, repo) {
    const documents = [];
    const docFiles = [
      'README.md',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'SECURITY.md',
      'ARCHITECTURE.md',
      'docs/README.md'
    ];

    for (const docFile of docFiles) {
      const filePath = path.join(repoPath, docFile);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const chunks = this.chunkText(content, 1000);

        chunks.forEach((chunk, index) => {
          documents.push({
            id: this.generateId(`doc-${docFile}-${index}`),
            text: chunk,
            metadata: {
              type: 'documentation',
              file: docFile,
              owner,
              repo,
              chunk: index,
              indexed_at: new Date().toISOString()
            }
          });
        });

        logger.debug(`Indexed ${docFile}: ${chunks.length} chunks`);
      } catch (error) {
        // File doesn't exist, skip
        logger.debug(`Skipped ${docFile}: not found`);
      }
    }

    return documents;
  }

  /**
   * Index important code files for context
   */
  async indexCodeFiles(repoPath, owner, repo, maxFiles = 50) {
    const documents = [];
    const files = await this.findCodeFiles(repoPath);
    
    // Sort by importance (certain directories first)
    const sortedFiles = this.prioritizeFiles(files);
    const filesToIndex = sortedFiles.slice(0, maxFiles);

    for (const file of filesToIndex) {
      try {
        const stats = await fs.stat(file);
        if (stats.size > this.maxFileSize) {
          logger.debug(`Skipping ${file}: too large`);
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(repoPath, file);
        
        // Index entire file as context
        documents.push({
          id: this.generateId(`code-${relativePath}`),
          text: `File: ${relativePath}\n\n${content}`,
          metadata: {
            type: 'source_code',
            file: relativePath,
            owner,
            repo,
            extension: path.extname(file),
            size: stats.size,
            indexed_at: new Date().toISOString()
          }
        });

        logger.debug(`Indexed ${relativePath}`);
      } catch (error) {
        logger.debug(`Failed to index ${file}:`, error.message);
      }
    }

    return documents;
  }

  /**
   * Index configuration files
   */
  async indexConfigFiles(repoPath, owner, repo) {
    const documents = [];
    const configFiles = [
      'package.json',
      'tsconfig.json',
      '.eslintrc.json',
      '.prettierrc',
      'jest.config.js'
    ];

    for (const configFile of configFiles) {
      const filePath = path.join(repoPath, configFile);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        documents.push({
          id: this.generateId(`config-${configFile}`),
          text: `Configuration: ${configFile}\n\n${content}`,
          metadata: {
            type: 'configuration',
            file: configFile,
            owner,
            repo,
            indexed_at: new Date().toISOString()
          }
        });

        logger.debug(`Indexed ${configFile}`);
      } catch (error) {
        logger.debug(`Skipped ${configFile}: not found`);
      }
    }

    return documents;
  }

  /**
   * Index past PR review (historical context)
   */
  async indexReview(prData, comments, owner, repo) {
    const documents = [];

    // Create a document for the PR review
    const reviewText = `
PR #${prData.number}: ${prData.title}

Description:
${prData.body || 'No description'}

Files Changed: ${prData.changedFiles}
Additions: ${prData.additions}
Deletions: ${prData.deletions}

Review Comments:
${comments.map(c => `- ${c.path}:${c.line}: ${c.body}`).join('\n')}
    `.trim();

    documents.push({
      id: this.generateId(`review-${owner}-${repo}-${prData.number}`),
      text: reviewText,
      metadata: {
        type: 'review_history',
        pr_number: prData.number,
        owner,
        repo,
        files_changed: prData.changedFiles,
        comment_count: comments.length,
        indexed_at: new Date().toISOString()
      }
    });

    await this.vectorStore.addDocuments(documents);
    logger.debug(`Indexed review for PR #${prData.number}`);
    
    return documents.length;
  }

  /**
   * Find all code files recursively
   */
  async findCodeFiles(dir, files = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .git, etc.
      if (this.shouldSkipDirectory(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.findCodeFiles(fullPath, files);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.supportedExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Prioritize important files
   */
  prioritizeFiles(files) {
    const priority = {
      '/src/': 10,
      '/lib/': 8,
      '/components/': 7,
      '/utils/': 6,
      '/api/': 9,
      '/models/': 8,
      '/services/': 8
    };

    return files.sort((a, b) => {
      const scoreA = Object.entries(priority).reduce((acc, [dir, score]) => 
        a.includes(dir) ? Math.max(acc, score) : acc, 0);
      const scoreB = Object.entries(priority).reduce((acc, [dir, score]) => 
        b.includes(dir) ? Math.max(acc, score) : acc, 0);
      return scoreB - scoreA;
    });
  }

  /**
   * Should skip this directory?
   */
  shouldSkipDirectory(name) {
    const skipDirs = [
      'node_modules', '.git', 'dist', 'build',
      'coverage', '.next', '__pycache__', 'venv'
    ];
    return skipDirs.includes(name) || name.startsWith('.');
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
    return crypto
      .createHash('md5')
      .update(text)
      .digest('hex');
  }
}

module.exports = DocumentIndexer;





