/**
 * Position Mapper
 * Maps line numbers to GitHub diff positions
 */

const logger = require('../utils/logger');

/**
 * Parse diff positions for GitHub API
 * Maps new line numbers to their position in the diff
 */
function parseDiffPositions(diffText) {
  const filePositions = {};
  const lines = diffText.split('\n');
  
  let currentFile = null;
  let position = 0;
  let newLineNumber = 0;
  
  for (const line of lines) {
    // Check for file header: +++ b/path/to/file.js
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6); // Remove '+++ b/'
      filePositions[currentFile] = {};
      position = 0;
      continue;
    }
    
    // Check for hunk header: @@ -10,5 +12,6 @@
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      if (match) {
        newLineNumber = parseInt(match[1], 10);
      }
      position++;
      continue;
    }
    
    // Skip if no current file
    if (!currentFile) continue;
    
    // Track positions for added or context lines
    if (line.startsWith('+')) {
      // This is a new line in the file
      filePositions[currentFile][newLineNumber] = position;
      newLineNumber++;
      position++;
    } else if (line.startsWith('-')) {
      // Deleted line, increment position but not line number
      position++;
    } else if (line.startsWith(' ')) {
      // Context line
      newLineNumber++;
      position++;
    }
  }
  
  logger.debug(`Mapped positions for ${Object.keys(filePositions).length} files`);
  
  return filePositions;
}

/**
 * Find position for a line number in a file
 */
function findPosition(diffPositions, filepath, lineNumber) {
  if (!diffPositions[filepath]) {
    logger.warn(`File not found in diff positions: ${filepath}`);
    return null;
  }
  
  const position = diffPositions[filepath][lineNumber];
  
  if (position === undefined) {
    logger.warn(`Position not found for ${filepath}:${lineNumber}`);
    return null;
  }
  
  return position;
}

/**
 * Convert AI comments to GitHub review comments
 * Maps line numbers to positions
 */
function mapCommentsToPositions(comments, diffPositions) {
  const reviewComments = [];
  
  for (const comment of comments) {
    const position = findPosition(diffPositions, comment.path, comment.line);
    
    if (position === null) {
      logger.warn(`Skipping comment for ${comment.path}:${comment.line} - position not found`);
      continue;
    }
    
    reviewComments.push({
      path: comment.path,
      position,
      body: comment.body,
    });
  }
  
  logger.info(`Mapped ${reviewComments.length}/${comments.length} comments to positions`);
  
  return reviewComments;
}

module.exports = {
  parseDiffPositions,
  findPosition,
  mapCommentsToPositions,
};




