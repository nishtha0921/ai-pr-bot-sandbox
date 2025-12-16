#!/usr/bin/env node

/**
 * Review PR Script
 * CLI entry point for PR reviews with RAG capabilities
 */

const Reviewer = require('../src/review/reviewer');
const logger = require('../src/utils/logger');
const config = require('../src/utils/config');

// Parse command line arguments
const args = process.argv.slice(2);

function printUsage() {
  console.log(`
Usage: node scripts/review-pr.js <owner/repo> <pr-number> [options]

Arguments:
  owner/repo   Repository in format: owner/repo (e.g., Git-Prime/flow-frontend-modules)
  pr-number    Pull request number (e.g., 123)

Options:
  --debug           Enable debug logging
  --no-summary      Skip posting summary comment
  --no-rag          Disable RAG (fall back to base reviewer)
  --chroma-url      ChromaDB URL (default: http://localhost:8002)
  --collection      Collection name (default: pr-reviews)
  --no-auto-index   Don't auto-index this review

Environment Variables:
  GITHUB_TOKEN    GitHub personal access token (required)
  OLLAMA_URL      Ollama API URL (default: http://localhost:11434/api/generate)
  OLLAMA_MODEL    Ollama model name (default: qwen2.5-coder)
  CHROMA_URL      ChromaDB URL (default: http://localhost:8002)

Examples:
  node scripts/review-pr.js Git-Prime/flow-frontend-modules 436
  node scripts/review-pr.js owner/repo 456 --debug
  node scripts/review-pr.js owner/repo 789 --no-rag
`);
}

async function main() {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse positional arguments
  const ownerRepo = args[0];
  const prNumber = parseInt(args[1], 10);

  if (!ownerRepo || !prNumber) {
    logger.error('Missing required arguments');
    printUsage();
    process.exit(1);
  }

  // Parse options
  const debug = args.includes('--debug');
  const postSummary = !args.includes('--no-summary');
  const useRAG = !args.includes('--no-rag');
  const autoIndex = !args.includes('--no-auto-index');
  
  const chromaUrl = args.find(arg => arg.startsWith('--chroma-url='))
    ?.split('=')[1] || process.env.CHROMA_URL || 'http://localhost:8002';
  
  const collection = args.find(arg => arg.startsWith('--collection='))
    ?.split('=')[1] || process.env.CHROMA_COLLECTION || 'pr-reviews';

  // Set log level
  if (debug) {
    logger.setLevel('DEBUG');
  }

  // Load and validate config
  try {
    config.load();
    config.validate();
    logger.info('Configuration loaded and validated');
  } catch (error) {
    logger.error('Configuration error', error);
    process.exit(1);
  }

  // Create reviewer
  try {
    logger.section(`AI Code Review Bot`);
    logger.info(`Repository: ${ownerRepo}`);
    logger.info(`PR Number: ${prNumber}`);
    logger.info(`RAG Enabled: ${useRAG ? 'Yes' : 'No'}`);
    if (useRAG) {
      logger.info(`ChromaDB: ${chromaUrl}`);
    }
    logger.info('');

    const reviewer = new Reviewer({ 
      postSummary,
      useRAG,
      autoIndex,
      chromaUrl,
      collectionName: collection
    });

    // Initialize RAG system
    if (useRAG) {
      const initialized = await reviewer.initialize();
      if (!initialized) {
        logger.warn('RAG initialization failed - falling back to base reviewer');
        logger.warn('Make sure ChromaDB is running: docker run -d -p 8002:8000 chromadb/chroma');
      } else {
        const stats = await reviewer.getRAGStats();
        logger.success(`RAG system ready: ${stats.documentCount} documents indexed`);
        
        const ragAvailable = await reviewer.isRAGAvailable();
        logger.info(`Context retrieval: ${ragAvailable ? 'Available' : 'Limited'}`);
      }
    }

    // Check AI provider availability
    const aiAvailable = await reviewer.checkAIProvider();
    if (!aiAvailable) {
      logger.error('AI provider is not available. Please check your Ollama installation.');
      process.exit(1);
    }

    logger.info('');

    // Review the PR
    const result = await reviewer.reviewPR(ownerRepo, prNumber);

    logger.section('Review Summary');
    logger.info(`Files reviewed: ${result.filesReviewed}`);
    logger.info(`Comments posted: ${result.commentsPosted}`);
    if (useRAG) {
      logger.info(`RAG enhanced: ${result.ragEnabled ? 'Yes' : 'No'}`);
    }
    logger.success('Review completed successfully! ✅');

    process.exit(0);
  } catch (error) {
    logger.error('Review failed', error);
    process.exit(1);
  }
}

// Run main function
main();

