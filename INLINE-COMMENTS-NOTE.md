# Note on Inline Comments

## Current Limitation

The AI (llama3) struggles to accurately extract line numbers from git diff format, which causes inline comments to be skipped because the line numbers don't match the diff positions.

This is a known limitation of local LLMs when working with structured formats like git diffs.

## Workaround Options

### Option 1: Use Summary Comments (Recommended for now)
The bot currently works well for generating overall PR summaries. These appear as a single comment on the PR with all feedback.

### Option 2: Use a More Capable Model
- Try `llama3.1` or `llama3.2` which may be better at structured output
- Consider using OpenAI's GPT-4 API (requires API key and costs money)
- Use Claude API (also requires API key)

### Option 3: Post-process the Comments
We could build a smarter system that:
1. Gets general feedback from the AI
2. Uses fuzzy matching to find the right lines
3. Posts comments on approximate locations

## For Now

The bot works best for:
- ✅ Getting overall code review feedback
- ✅ Identifying patterns and issues across the PR
- ✅ Learning what kinds of things to look for
- ❌ Posting precise inline comments (hits/miss with llama3)

