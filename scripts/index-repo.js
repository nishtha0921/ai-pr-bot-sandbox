#!/usr/bin/env node

/**
 * Index Repository Script
 * Indexes repository content for RAG-enhanced reviews
 */

const VectorStore = require('../src/rag/vector-store');
const DocumentIndexer = require('../src/rag/indexer');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);

function printUsage() {
  console.log(`
Usage: node scripts/index-repo.js <repo-path> <owner> <repo-name> [options]

Arguments:
  repo-path    Path to local repository (e.g., /path/to/repo)
  owner        Repository owner (e.g., Git-Prime)
  repo-name    Repository name (e.g., flow-frontend-modules)

Options:
  --chroma-url  ChromaDB URL (default: http://localhost:8000)
  --collection  Collection name (default: pr-reviews)

Examples:
  node scripts/index-repo.js ~/repos/my-repo myorg my-repo
  node scripts/index-repo.js . Git-Prime flow-frontend-modules --chroma-url http://localhost:8000
`);
}

async function main() {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse positional arguments
  const repoPath = args[0];
  const owner = args[1];
  const repoName = args[2];

  if (!repoPath || !owner || !repoName) {
    logger.error('Missing required arguments');
    printUsage();
    process.exit(1);
  }

  // Parse options
  const chromaUrl = args.find(arg => arg.startsWith('--chroma-url='))
    ?.split('=')[1] || 'http://localhost:8002';
  const collection = args.find(arg => arg.startsWith('--collection='))
    ?.split('=')[1] || 'pr-reviews';

  try {
    logger.section(`Indexing Repository for RAG`);
    logger.info(`Repository: ${owner}/${repoName}`);
    logger.info(`Path: ${repoPath}`);
    logger.info(`ChromaDB: ${chromaUrl}`);
    logger.info('');

    // Initialize vector store
    const vectorStore = new VectorStore({
      chromaUrl,
      collectionName: collection
    });

    const initialized = await vectorStore.initialize();
    if (!initialized) {
      logger.error('Failed to initialize vector store');
      logger.error('Make sure ChromaDB is running: docker run -d -p 8002:8000 chromadb/chroma');
      process.exit(1);
    }

    // Check current stats
    const statsBefore = await vectorStore.getStats();
    logger.info(`Documents before indexing: ${statsBefore.documentCount}`);

    // Create indexer
    const indexer = new DocumentIndexer(vectorStore);

    // Index repository
    const count = await indexer.indexRepository(repoPath, owner, repoName);

    // Show stats
    const statsAfter = await vectorStore.getStats();
    logger.section('Indexing Complete');
    logger.info(`New documents indexed: ${count}`);
    logger.info(`Total documents in store: ${statsAfter.documentCount}`);
    logger.success('Repository indexed successfully! ✅');

    process.exit(0);
  } catch (error) {
    logger.error('Indexing failed', error);
    process.exit(1);
  }
}

// Run main function
main();

