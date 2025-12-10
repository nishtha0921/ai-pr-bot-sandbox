/**
 * Diff Parser
 * Parses unified git diff format
 */

const logger = require('../utils/logger');
const { DiffParsingError } = require('../utils/errors');

/**
 * Parse unified diff format
 */
function parseDiff(diffText) {
  if (!diffText || typeof diffText !== 'string') {
    throw new DiffParsingError('Invalid diff text');
  }

  const files = [];
  const lines = diffText.split('\n');
  
  let currentFile = null;
  let currentHunk = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // File header: diff --git a/file b/file
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
      }
      currentFile = {
        path: null,
        oldPath: null,
        newPath: null,
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      continue;
    }
    
    // Old file path: --- a/path
    if (line.startsWith('---')) {
      if (currentFile) {
        currentFile.oldPath = line.substring(6); // Remove '--- a/'
      }
      continue;
    }
    
    // New file path: +++ b/path
    if (line.startsWith('+++')) {
      if (currentFile) {
        const path = line.substring(6); // Remove '+++ b/'
        currentFile.newPath = path;
        currentFile.path = path;
      }
      continue;
    }
    
    // Hunk header: @@ -10,5 +12,6 @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldLines: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newLines: parseInt(match[4] || '1', 10),
          lines: [],
          header: line,
        };
        if (currentFile) {
          currentFile.hunks.push(currentHunk);
        }
      }
      continue;
    }
    
    // Content lines
    if (currentHunk && currentFile) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', content: line.substring(1) });
        currentFile.additions++;
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'delete', content: line.substring(1) });
        currentFile.deletions++;
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({ type: 'context', content: line.substring(1) });
      }
    }
  }
  
  // Push last file
  if (currentFile) {
    files.push(currentFile);
  }
  
  logger.debug(`Parsed ${files.length} files from diff`);
  
  return files;
}

/**
 * Get summary of diff
 */
function getDiffSummary(diffText) {
  const files = parseDiff(diffText);
  
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  
  return {
    filesChanged: files.length,
    additions: totalAdditions,
    deletions: totalDeletions,
    files: files.map(f => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
    })),
  };
}

module.exports = {
  parseDiff,
  getDiffSummary,
};


