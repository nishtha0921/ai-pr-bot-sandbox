/**
 * API Server
 * Express server for receiving review requests
 */

const express = require('express');
const setupRoutes = require('./routes');
const logger = require('../utils/logger');
const config = require('../utils/config');

/**
 * Create and configure Express app
 */
function createApp() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Setup routes
  setupRoutes(app);

  // Error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

/**
 * Start the server
 */
function startServer(port = null) {
  // Load config
  config.load();
  const cfg = config.getAll();
  
  const serverPort = port || cfg.server.port || 8100;
  const app = createApp();

  const server = app.listen(serverPort, () => {
    logger.success(`Server running on http://localhost:${serverPort}`);
    logger.info('Available endpoints:');
    logger.info('  GET  / - Health check');
    logger.info('  POST /review - Submit code review');
    logger.info('  GET  /health - Health check with AI status');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  return server;
}

module.exports = {
  createApp,
  startServer,
};


