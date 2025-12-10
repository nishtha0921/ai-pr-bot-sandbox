# Migration Guide: Monolithic to Modular Architecture

This guide explains the migration from the old monolithic structure to the new modular architecture.

## What Changed?

### Old Structure (Monolithic)
```
ai-pr-bot-sandbox/
├── local-review-server.js          # 103 lines - server + AI logic mixed
├── .github/scripts/
│   └── fetch-pr-diff.js            # 261 lines - everything mixed together
└── review-pr.sh                    # Shell script entry point
```

### New Structure (Modular)
```
ai-pr-bot-sandbox/
├── src/
│   ├── utils/           # Configuration, logging, errors
│   ├── github/          # GitHub API integration
│   ├── ai/              # AI provider system (Ollama, future: OpenAI)
│   ├── diff/            # Diff parsing and position mapping
│   ├── review/          # Review orchestration
│   └── server/          # Express server
├── scripts/
│   ├── start-server.js  # Server entry point
│   └── review-pr.js     # CLI entry point
└── tests/               # Unit tests
```

## How to Use the New System

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Services

The shell scripts still work, but now use the new modular code:

```bash
./start-services.sh
```

### 3. Review a PR

```bash
./review-pr.sh owner/repo PR_NUMBER
```

Or use the new Node.js CLI directly:

```bash
node scripts/review-pr.js owner/repo PR_NUMBER
```

### 4. Run Tests

```bash
npm test
```

## Benefits of the New Architecture

1. **Easier to Test** - Each module can be tested independently
2. **Easier to Extend** - Adding OpenAI is just a new provider file
3. **Easier to Debug** - Clear boundaries between components
4. **Better Code Reuse** - Modules can be used by CLI, server, or workflows
5. **Easier Onboarding** - Clear structure for new developers
6. **Type Safety** - Can add TypeScript later easily
7. **Performance** - Can optimize individual modules
8. **Maintainability** - Changes in one area don't break others

## Old Files

The old monolithic files have been moved to `old/` directory:
- `old/local-review-server.js` - Old server implementation
- `old/fetch-pr-diff.js` - Old GitHub script

These files are kept for reference but are no longer used.

## API Compatibility

The new server maintains API compatibility with the old server:
- `GET /` - Health check (same response)
- `POST /review` - Review endpoint (same request/response format)
- `GET /health` - New endpoint for AI provider status

## GitHub Actions

The GitHub Actions workflow (`.github/workflows/pr-bot.yml`) still works without changes, as the server API remains compatible.

## Adding a New AI Provider (Example: OpenAI)

With the new architecture, adding OpenAI is simple:

1. Create `src/ai/providers/openai.js`:
```javascript
const BaseAIProvider = require('./base');

class OpenAIProvider extends BaseAIProvider {
  getName() { return 'OpenAI'; }
  async review(diff, context) { /* implementation */ }
  // ... etc
}
```

2. Update `src/review/reviewer.js` to support `openai` option:
```javascript
if (aiProvider === 'openai') {
  this.aiProvider = new OpenAIProvider(config.openai);
}
```

3. Use it:
```bash
node scripts/review-pr.js owner/repo 123 --ai-provider=openai
```

## Need Help?

See `LOCAL-SETUP.md` for detailed setup instructions.
See `tests/README.md` for testing guide.


