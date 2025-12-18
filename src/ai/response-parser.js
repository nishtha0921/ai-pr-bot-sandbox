/**
 * Response Parser
 * Parses and validates AI responses
 */

const logger = require('../utils/logger');

/**
 * Parse JSON response from AI
 */
function parseJSON(response) {
  try {
    // Try direct parse first
    const parsed = JSON.parse(response);
    return { success: true, data: parsed };
  } catch (error) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        logger.info('Extracted JSON from markdown code block');
        return { success: true, data: parsed };
      } catch (e) {
        // Continue to fail
      }
    }
    
    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*"comments"[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        logger.info('Extracted JSON object from response');
        return { success: true, data: parsed };
      } catch (e) {
        // Continue to fail
      }
    }
    
    logger.warn('Failed to parse JSON response');
    logger.debug('Response preview:', response.substring(0, 200));
    return { success: false, error: error.message };
  }
}

/**
 * Validate comment structure
 */
function validateComment(comment) {
  if (!comment || typeof comment !== 'object') {
    return false;
  }

  // Required fields
  if (!comment.path || typeof comment.path !== 'string') {
    return false;
  }

  if (!comment.body || typeof comment.body !== 'string') {
    return false;
  }

  // Line must be a positive number
  if (typeof comment.line !== 'number' || comment.line < 1) {
    return false;
  }

  return true;
}

/**
 * Validate comments array
 */
function validateComments(comments) {
  if (!Array.isArray(comments)) {
    logger.warn('Comments is not an array');
    return [];
  }

  const validComments = comments.filter(comment => {
    const isValid = validateComment(comment);
    if (!isValid) {
      logger.warn('Invalid comment structure', comment);
    }
    return isValid;
  });

  logger.info(`Validated ${validComments.length}/${comments.length} comments`);
  return validComments;
}

/**
 * Parse and validate AI review response
 */
function parseReviewResponse(response) {
  // Try to parse JSON
  const parseResult = parseJSON(response);
  
  if (!parseResult.success) {
    logger.error('Failed to parse AI response as JSON');
    return {
      comments: [],
      parseError: parseResult.error,
    };
  }

  // Extract and validate comments
  const comments = parseResult.data.comments || [];
  const validComments = validateComments(comments);

  return {
    comments: validComments,
    raw: response,
  };
}

module.exports = {
  parseJSON,
  validateComment,
  validateComments,
  parseReviewResponse,
};


