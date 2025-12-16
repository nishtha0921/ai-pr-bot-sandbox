#!/usr/bin/env node

/**
 * Start Server Script
 * Entry point for starting the review API server
 */

const { startServer } = require('../src/server/api-server');
const logger = require('../src/utils/logger');
const config = require('../src/utils/config');

// Parse command line arguments
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1], 10) : null;

// Set log level
if (args.includes('--debug')) {
  logger.setLevel('DEBUG');
}

// Load and validate config
try {
  config.load();
  logger.info('Configuration loaded');
} catch (error) {
  logger.error('Failed to load configuration', error);
  process.exit(1);
}

// Start server
try {
  startServer(port);
} catch (error) {
  logger.error('Failed to start server', error);
  process.exit(1);
}




