/**
 * Comment Builder
 * Builds review comment structures with formatting
 */

const config = require('../utils/config');

/**
 * Add bot signature to comment
 */
function addBotSignature(body) {
  const cfg = config.getAll();
  const botName = cfg.bot.name;
  const botEmoji = cfg.bot.emoji;
  
  return `${body}\n\n---\n${botEmoji} *${botName}*`;
}

/**
 * Build inline comment
 */
function buildInlineComment(path, position, body, addSignature = true) {
  const finalBody = addSignature ? addBotSignature(body) : body;
  
  return {
    path,
    position,
    body: finalBody,
  };
}

/**
 * Build summary comment
 */
function buildSummaryComment(reviewResult, stats = {}) {
  const cfg = config.getAll();
  const parts = [];
  
  parts.push(`# ${cfg.bot.emoji} Code Review Summary\n`);
  
  // Stats
  if (stats.filesChanged !== undefined) {
    parts.push(`**Changes**: ${stats.filesChanged} files, +${stats.additions} -${stats.deletions}\n`);
  }
  
  // Comments count
  const commentCount = reviewResult.comments?.length || 0;
  if (commentCount > 0) {
    parts.push(`**Comments**: ${commentCount} inline comment${commentCount !== 1 ? 's' : ''}\n`);
  } else {
    parts.push(`**Status**: No issues found ✅\n`);
  }
  
  // AI provider info
  if (reviewResult.provider) {
    parts.push(`**Reviewed by**: ${reviewResult.provider}\n`);
  }
  
  // Additional summary if provided
  if (reviewResult.summary) {
    parts.push(`\n## Summary\n${reviewResult.summary}\n`);
  }
  
  parts.push(`\n---\n*${cfg.bot.name}*`);
  
  return parts.join('\n');
}

/**
 * Format comment body with markdown
 */
function formatCommentBody(issue, suggestion = null, severity = 'info') {
  const severityEmoji = {
    error: '🔴',
    warning: '⚠️',
    info: 'ℹ️',
    suggestion: '💡',
  };
  
  const emoji = severityEmoji[severity] || severityEmoji.info;
  const parts = [`${emoji} **${issue}**`];
  
  if (suggestion) {
    parts.push('');
    parts.push('**Suggestion:**');
    parts.push(suggestion);
  }
  
  return parts.join('\n');
}

/**
 * Build issue comment (not inline)
 */
function buildIssueComment(body) {
  return addBotSignature(body);
}

/**
 * Build approval comment
 */
function buildApprovalComment(customMessage = null) {
  const cfg = config.getAll();
  const defaultMessage = 'This PR looks good! No major issues found. ✅';
  const message = customMessage || defaultMessage;
  
  return `${cfg.bot.emoji} ${message}\n\n---\n*${cfg.bot.name}*`;
}

/**
 * Build request changes comment
 */
function buildRequestChangesComment(issuesCount) {
  const cfg = config.getAll();
  const message = `Found ${issuesCount} issue${issuesCount !== 1 ? 's' : ''} that should be addressed.`;
  
  return `${cfg.bot.emoji} ${message}\n\nPlease review the inline comments below.\n\n---\n*${cfg.bot.name}*`;
}

module.exports = {
  addBotSignature,
  buildInlineComment,
  buildSummaryComment,
  formatCommentBody,
  buildIssueComment,
  buildApprovalComment,
  buildRequestChangesComment,
};




