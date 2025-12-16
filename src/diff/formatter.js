/**
 * Diff Formatter
 * Formats diffs for AI consumption
 */

const logger = require('../utils/logger');

/**
 * Truncate diff to maximum length
 */
function truncateDiff(diff, maxLength = 4000) {
  if (!diff) return '';
  
  if (diff.length <= maxLength) {
    return diff;
  }
  
  logger.warn(`Truncating diff from ${diff.length} to ${maxLength} chars`);
  return diff.substring(0, maxLength) + '\n\n[... diff truncated ...]';
}

/**
 * Format file summary for AI
 */
function formatFileSummary(files) {
  if (!files || files.length === 0) {
    return 'No files changed';
  }
  
  return files
    .map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`)
    .join('\n');
}

/**
 * Format commit summary for AI
 */
function formatCommitSummary(commits, maxCommits = 5) {
  if (!commits || commits.length === 0) {
    return 'No commits';
  }
  
  const limited = commits.slice(0, maxCommits);
  return limited
    .map(c => `- ${c.sha?.slice(0, 7)}: ${c.message}`)
    .join('\n');
}

/**
 * Add context to diff for AI
 */
function addDiffContext(diff, context = {}) {
  const { pr = {}, files = [], commits = [] } = context;
  
  const parts = [];
  
  // PR info
  if (pr.title) {
    parts.push(`# Pull Request: ${pr.title}`);
  }
  if (pr.body) {
    parts.push(`\n## Description\n${pr.body.substring(0, 500)}`);
  }
  
  // File summary
  if (files.length > 0) {
    parts.push(`\n## Changed Files (${files.length})`);
    parts.push(formatFileSummary(files));
  }
  
  // Commit summary
  if (commits.length > 0) {
    parts.push(`\n## Recent Commits (${commits.length})`);
    parts.push(formatCommitSummary(commits));
  }
  
  // The actual diff
  parts.push('\n## Diff\n```diff');
  parts.push(truncateDiff(diff));
  parts.push('```');
  
  return parts.join('\n');
}

/**
 * Format diff for display
 */
function formatDiffForDisplay(diff, maxLines = 50) {
  if (!diff) return '';
  
  const lines = diff.split('\n');
  
  if (lines.length <= maxLines) {
    return diff;
  }
  
  const truncated = lines.slice(0, maxLines).join('\n');
  return `${truncated}\n\n[... ${lines.length - maxLines} more lines ...]`;
}

/**
 * Extract changed lines from diff
 */
function extractChangedLines(diff) {
  if (!diff) return [];
  
  const lines = diff.split('\n');
  const changedLines = [];
  
  let currentFile = null;
  let lineNumber = 0;
  
  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6);
      continue;
    }
    
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      if (match) {
        lineNumber = parseInt(match[1], 10);
      }
      continue;
    }
    
    if (line.startsWith('+') && !line.startsWith('+++')) {
      changedLines.push({
        file: currentFile,
        line: lineNumber,
        content: line.substring(1),
      });
      lineNumber++;
    } else if (line.startsWith(' ')) {
      lineNumber++;
    }
  }
  
  return changedLines;
}

module.exports = {
  truncateDiff,
  formatFileSummary,
  formatCommitSummary,
  addDiffContext,
  formatDiffForDisplay,
  extractChangedLines,
};




