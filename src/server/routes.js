/**
 * API Routes
 * Define Express routes for the review server
 */

const Reviewer = require('../review/reviewer');
const logger = require('../utils/logger');

/**
 * Setup routes
 */
function setupRoutes(app) {
  /**
   * GET / - Health check
   */
  app.get('/', (req, res) => {
    res.json({
      status: 'Server is running',
      service: 'AI Code Review Bot',
      endpoints: {
        'GET /': 'Health check',
        'POST /review': 'Submit a diff for code review',
      },
    });
  });

  /**
   * POST /review - Review code diff
   */
  app.post('/review', async (req, res) => {
    try {
      const { diff, pr, files, commits, comments } = req.body;

      if (!diff) {
        return res.status(400).json({ error: 'Diff is required' });
      }

      logger.info('Received review request');
      logger.debug('PR context', { pr, filesCount: files?.length });

      // Initialize reviewer
      const reviewer = new Reviewer();

      // Build context
      const context = {
        pr: pr || {},
        files: files || [],
        commits: commits || [],
        existingComments: comments || [],
      };

      // Get AI review
      const reviewResult = await reviewer.aiProvider.review(diff, context);

      logger.success(`Review completed: ${reviewResult.comments.length} comments`);

      // Return comments
      res.json({
        comments: reviewResult.comments,
        provider: reviewer.aiProvider.getName(),
      });
    } catch (error) {
      logger.error('Review request failed', error);
      res.status(500).json({
        error: 'Internal error',
        message: error.message,
      });
    }
  });

  /**
   * GET /health - Health check with AI provider status
   */
  app.get('/health', async (req, res) => {
    try {
      const reviewer = new Reviewer();
      const aiAvailable = await reviewer.checkAIProvider();

      res.json({
        status: 'ok',
        ai: {
          provider: reviewer.aiProvider.getName(),
          available: aiAvailable,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  });
}

module.exports = setupRoutes;


