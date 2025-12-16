# Architecture Documentation

This document explains the modular architecture of the AI PR Review Bot.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AI PR Review Bot                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    ┌──────┐           ┌──────┐           ┌──────┐
    │ CLI  │           │Server│           │GitHub│
    │Entry │           │Entry │           │Action│
    └──────┘           └──────┘           └──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    ┌─────────────┐
                    │  Reviewer   │
                    │Orchestrator │
                    └─────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌────────┐          ┌────────┐         ┌────────┐
   │ GitHub │          │   AI   │         │  Diff  │
   │ Module │          │Provider│         │ Parser │
   └────────┘          └────────┘         └────────┘
```

## Module Breakdown

### 1. Utils (`src/utils/`)

**Purpose**: Shared utilities used across the application

- **`config.js`**: Configuration management
  - Loads `.env.local` file
  - Provides config values via `get(path)`
  - Validates required configuration
  
- **`logger.js`**: Consistent logging
  - Log levels: ERROR, WARN, INFO, DEBUG
  - Colored output for better readability
  - Timestamps on all logs
  
- **`errors.js`**: Custom error types
  - `GitHubAPIError` - GitHub API failures
  - `AIProviderError` - AI provider issues
  - `DiffParsingError` - Diff parsing problems
  - `ReviewError` - General review errors

### 2. GitHub Module (`src/github/`)

**Purpose**: All GitHub API interactions

- **`client.js`**: GitHub API client wrapper
  - Wraps Octokit with retry logic
  - Handles rate limiting
  - Centralized error handling
  
- **`pr-fetcher.js`**: Fetch PR data
  - `fetchPRDetails()` - PR metadata
  - `fetchFiles()` - Changed files
  - `fetchDiff()` - Unified diff
  - `fetchCommits()` - Commit history
  - `fetchComments()` - Existing comments
  - `fetchAllData()` - Fetch everything in parallel
  
- **`review-poster.js`**: Post reviews to GitHub
  - `postInlineComments()` - Post line comments
  - `postSummaryComment()` - Post issue comment
  - `createReview()` - Create full review
  - `approve()` - Approve PR
  - `requestChanges()` - Request changes

### 3. AI Module (`src/ai/`)

**Purpose**: AI provider integration with pluggable architecture

- **`providers/base.js`**: Base provider interface
  - Defines contract all providers must implement
  - `review(diff, context)` - Main review method
  - `isAvailable()` - Health check
  - `getName()` - Provider name
  
- **`providers/ollama.js`**: Ollama integration
  - Implements base provider interface
  - Sends diff to local Ollama instance
  - Parses JSON responses
  
- **`prompts.js`**: Centralized prompts
  - `buildReviewPrompt()` - For inline comments
  - `buildSummaryPrompt()` - For PR summary
  - Easy to modify and version control
  
- **`response-parser.js`**: Parse AI responses
  - `parseJSON()` - Parse JSON safely
  - `validateComment()` - Validate comment structure
  - `parseReviewResponse()` - Parse and validate

### 4. Diff Module (`src/diff/`)

**Purpose**: Parse and process git diffs

- **`parser.js`**: Parse unified diff format
  - `parseDiff()` - Parse diff into structured data
  - `getDiffSummary()` - Get summary statistics
  - Extracts files, hunks, additions, deletions
  
- **`position-mapper.js`**: Map line numbers to positions
  - `parseDiffPositions()` - Build line→position map
  - `findPosition()` - Find position for line number
  - `mapCommentsToPositions()` - Convert AI comments to GitHub format
  
- **`formatter.js`**: Format diffs
  - `truncateDiff()` - Limit diff length
  - `formatFileSummary()` - Format file list
  - `addDiffContext()` - Add PR context to diff
  - `extractChangedLines()` - Get only changed lines

### 5. Review Module (`src/review/`)

**Purpose**: Orchestrate the review process

- **`reviewer.js`**: Main orchestrator
  - Coordinates all modules
  - Implements review workflow:
    1. Fetch PR data from GitHub
    2. Parse diff positions
    3. Send to AI for review
    4. Map comments to positions
    5. Post review to GitHub
  
- **`comment-builder.js`**: Build review comments
  - `buildInlineComment()` - Format inline comment
  - `buildSummaryComment()` - Format summary
  - `formatCommentBody()` - Add severity icons
  - `addBotSignature()` - Add bot branding

### 6. Server Module (`src/server/`)

**Purpose**: HTTP API for review requests

- **`api-server.js`**: Express server setup
  - Creates and configures Express app
  - Middleware setup
  - Error handling
  - Graceful shutdown
  
- **`routes.js`**: API routes
  - `GET /` - Health check
  - `POST /review` - Submit code review
  - `GET /health` - AI provider status

## Data Flow

### CLI Review Flow

```
1. User runs: node scripts/review-pr.js owner/repo 123
   │
2. CLI loads config, creates Reviewer
   │
3. Reviewer.reviewPR(owner/repo, 123)
   │
   ├─→ PRFetcher.fetchAllData()
   │   └─→ GitHub API calls (parallel)
   │
   ├─→ parseDiffPositions(diff)
   │   └─→ Build line→position map
   │
   ├─→ AIProvider.review(diff, context)
   │   └─→ Ollama API call
   │
   ├─→ mapCommentsToPositions(comments, positions)
   │   └─→ Convert line numbers to positions
   │
   └─→ ReviewPoster.postInlineComments()
       └─→ GitHub API call
```

### Server Review Flow

```
1. GitHub Action calls: POST /review
   │
2. Route handler receives { diff, pr, files }
   │
3. Reviewer.aiProvider.review(diff, context)
   │
4. Returns { comments: [...] }
   │
5. GitHub Action posts comments using positions
```

## Configuration

Configuration is loaded in this order:
1. `.env.local` file (if exists)
2. Environment variables
3. Default values

Required configuration:
- `GITHUB_TOKEN` - GitHub personal access token
- `OLLAMA_URL` - Ollama API URL
- `OLLAMA_MODEL` - Model name (llama3.1, qwen2.5-coder, etc.)

Optional configuration:
- `BOT_NAME` - Bot display name
- `BOT_EMOJI` - Bot emoji
- `PORT` - Server port (default: 8100)

## Extension Points

### Adding a New AI Provider

1. Create `src/ai/providers/yourprovider.js`
2. Extend `BaseAIProvider`
3. Implement required methods
4. Update `Reviewer` to support new provider

Example:
```javascript
class OpenAIProvider extends BaseAIProvider {
  getName() { return 'OpenAI'; }
  
  async review(diff, context) {
    // Call OpenAI API
    return { comments: [...] };
  }
  
  async isAvailable() {
    // Check API key
    return true;
  }
}
```

### Adding a New Entry Point

1. Create script in `scripts/`
2. Import `Reviewer`
3. Call `reviewer.reviewPR()`

Example:
```javascript
const Reviewer = require('../src/review/reviewer');

const reviewer = new Reviewer();
await reviewer.reviewPR('owner/repo', 123);
```

## Testing

Each module has corresponding tests in `tests/`:
- Unit tests for individual functions
- Integration tests for workflows
- Mock external services (GitHub, Ollama)

Run tests:
```bash
npm test
```

## Performance Considerations

1. **Parallel API Calls**: PR data fetched in parallel
2. **Diff Truncation**: Large diffs truncated for AI
3. **Comment Batching**: All comments posted in one review
4. **Position Caching**: Diff positions parsed once

## Security

1. **Token Management**: GitHub token loaded from env
2. **Input Validation**: All user input validated
3. **Error Handling**: Sensitive data not logged
4. **API Rate Limiting**: Retry logic with backoff

## Future Improvements

1. **TypeScript**: Add type safety
2. **OpenAI Provider**: Alternative to Ollama
3. **Caching**: Cache PR data and reviews
4. **Webhooks**: Direct GitHub webhook integration
5. **Database**: Store review history
6. **Analytics**: Track review metrics




