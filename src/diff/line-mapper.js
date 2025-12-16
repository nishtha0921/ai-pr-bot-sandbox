/**
 * Line-based Comment Mapper
 * Uses GitHub's line-based API instead of position-based
 * 
 * This is simpler and more reliable than calculating positions
 */

const logger = require('../utils/logger');

/**
 * Map AI comments to GitHub review comments using line numbers
 * 
 * @param {Array} comments - AI comments with { path, line, body }
 * @param {Array} files - PR files from GitHub API
 * @param {string} commitId - Commit SHA (optional, not used in batch reviews)
 * @returns {Array} - Review comments formatted for GitHub API
 */
function mapCommentsToLines(comments, files, commitId = null) {
  const reviewComments = [];
  
  // Create a map of filenames to their patch info
  const fileMap = new Map();
  files.forEach(file => {
    if (file.patch) {
      fileMap.set(file.filename, {
        patch: file.patch,
        additions: file.additions,
        deletions: file.deletions
      });
    }
  });

  for (const comment of comments) {
    const file = fileMap.get(comment.path);
    
    if (!file) {
      logger.warn(`File not found in PR files: ${comment.path}`);
      continue;
    }

    // Check if line is within the changed lines
    const isValidLine = isLineInDiff(comment.line, file.patch);
    
    if (!isValidLine) {
      logger.warn(`Line ${comment.line} not found in diff for ${comment.path}`);
      continue;
    }

    // Note: commit_id is NOT included here because when posting as a batch review,
    // GitHub doesn't accept commit_id in the comments array.
    // It's only used when posting individual comments via the single comment API.
    reviewComments.push({
      path: comment.path,
      line: comment.line,
      side: 'RIGHT',  // RIGHT = new file (after changes)
      body: comment.body
    });
  }
  
  logger.info(`Mapped ${reviewComments.length}/${comments.length} comments to line numbers`);
  
  return reviewComments;
}

/**
 * Check if a line number appears in the diff patch
 * 
 * @param {number} lineNumber - Line number to check
 * @param {string} patch - Diff patch from GitHub
 * @returns {boolean} - True if line is in the diff
 */
function isLineInDiff(lineNumber, patch) {
  const lines = patch.split('\n');
  let currentLine = 0;
  
  for (const line of lines) {
    // Check for hunk header: @@ -10,5 +12,6 @@
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      continue;
    }
    
    // Track line numbers in the new file
    if (line.startsWith('+') || line.startsWith(' ')) {
      if (currentLine === lineNumber) {
        return true;
      }
      currentLine++;
    }
  }
  
  return false;
}

/**
 * Get line ranges from patch (useful for validation)
 * 
 * @param {string} patch - Diff patch
 * @returns {Array} - Array of {start, end} line ranges
 */
function getChangedLineRanges(patch) {
  const ranges = [];
  const lines = patch.split('\n');
  let currentStart = null;
  let currentLine = 0;
  
  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Save previous range
      if (currentStart !== null) {
        ranges.push({ start: currentStart, end: currentLine - 1 });
      }
      
      // Parse new range
      const match = line.match(/\+(\d+),?(\d+)?/);
      if (match) {
        currentStart = parseInt(match[1], 10);
        currentLine = currentStart;
      }
      continue;
    }
    
    if (line.startsWith('+') || line.startsWith(' ')) {
      currentLine++;
    }
  }
  
  // Save last range
  if (currentStart !== null) {
    ranges.push({ start: currentStart, end: currentLine - 1 });
  }
  
  return ranges;
}

module.exports = {
  mapCommentsToLines,
  isLineInDiff,
  getChangedLineRanges
};

