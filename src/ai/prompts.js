/**
 * AI Prompts
 * Centralized prompt templates for AI providers
 */

/**
 * Build review prompt for code diff
 */
function buildReviewPrompt(diff, context = {}) {
  const { pr = {}, files = [] } = context;

  return `You are a code reviewer. Analyze this git diff and provide feedback ONLY on changed lines.

CRITICAL RULES:
1. Look for lines starting with "+" in the diff - these are NEW/CHANGED lines
2. The "line" number MUST be from the @@ hunk header (the number after the + sign)
3. Only comment on lines that were actually changed (start with +)
4. Return ONLY valid JSON, no other text

Pull Request: ${pr.title || 'N/A'}
Files: ${files.map(f => f.filename).join(', ') || 'N/A'}

Diff to review:
${diff.substring(0, 4000)}

Example of reading line numbers from diff:
@@ -10,5 +12,8 @@ means new code starts at line 12
+const x = 1;  <- this is line 12
+const y = 2;  <- this is line 13
+const z = 3;  <- this is line 14

Return JSON ONLY:
{
  "comments": [
    {
      "path": "src/file.js",
      "line": 13,
      "body": "Consider using const for y"
    }
  ]
}

Find 2-5 issues in the changed lines. If no issues, return empty array.`.trim();
}

/**
 * Build summary prompt for overall PR review
 */
function buildSummaryPrompt(diff, context = {}) {
  const { pr = {}, files = [], commits = [] } = context;

  return `You are a senior software engineer reviewing a pull request.

Pull Request:
- Title: ${pr.title || 'N/A'}
- Description: ${pr.body || 'N/A'}
- Author: ${pr.author || 'N/A'}

Changed files (${files.length}):
${files.map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')}

Recent commits (${commits.length}):
${commits.slice(0, 5).map(c => `- ${c.sha.slice(0, 7)}: ${c.message}`).join('\n')}

Diff (first 4000 chars):
${diff.substring(0, 4000)}

Provide a comprehensive code review covering:
1. **Summary**: Briefly describe what this PR does
2. **Strengths**: What's good about this change
3. **Issues**: Potential bugs, security concerns, or code smells
4. **Suggestions**: Improvements for code quality, performance, or maintainability

Format as markdown.`.trim();
}

module.exports = {
  buildReviewPrompt,
  buildSummaryPrompt,
};






