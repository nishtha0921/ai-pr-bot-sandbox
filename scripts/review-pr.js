#!/usr/bin/env node

/**
 * Review PR Script
 * CLI entry point for reviewing a pull request
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
  owner/repo   Repository in format: owner/repo (e.g., nishtha0921/my-repo)
  pr-number    Pull request number (e.g., 123)

Options:
  --debug      Enable debug logging
  --no-summary Skip posting summary comment

Environment Variables:
  GITHUB_TOKEN    GitHub personal access token (required)
  OLLAMA_URL      Ollama API URL (default: http://localhost:11434/api/generate)
  OLLAMA_MODEL    Ollama model name (default: llama3.1)

Examples:
  node scripts/review-pr.js nishtha0921/my-repo 123
  node scripts/review-pr.js owner/repo 456 --debug
  node scripts/review-pr.js owner/repo 789 --no-summary
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
    logger.info('');

    const reviewer = new Reviewer({ postSummary });

    // Check AI provider availability
    const aiAvailable = await reviewer.checkAIProvider();
    if (!aiAvailable) {
      logger.error('AI provider is not available. Please check your Ollama installation.');
      process.exit(1);
    }

    // Review the PR
    const result = await reviewer.reviewPR(ownerRepo, prNumber);

    logger.section('Review Summary');
    logger.info(`Files reviewed: ${result.filesReviewed}`);
    logger.info(`Comments posted: ${result.commentsPosted}`);
    logger.success('Review completed successfully! ✅');

    process.exit(0);
  } catch (error) {
    logger.error('Review failed', error);
    process.exit(1);
  }
}

// Run main function
main();


