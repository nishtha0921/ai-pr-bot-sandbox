# AI PR Review Bot

Automated code review bot powered by Ollama (llama3) that can review pull requests from any GitHub repository locally.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up configuration
cp .env.local.example .env.local
# Edit .env.local and add your GitHub token

# 3. Start services
./start-services.sh

# 4. Review any PR
./review-pr.sh owner/repo PR_NUMBER
```

Or use npm commands:
```bash
npm start                           # Start server
npm run review owner/repo 123      # Review a PR
npm test                           # Run tests
```

## Example

```bash
./review-pr.sh nishtha0921/ai-pr-bot-sandbox 1
```

## Features

- ✅ **Review any repository** - Works with any GitHub repo you have access to
- ✅ **Inline comments** - Posts comments directly on specific lines
- ✅ **Fully local** - Runs entirely on your machine using Ollama
- ✅ **No code changes needed** - No need to add files to other repositories
- ✅ **Smart reviews** - Focuses on bugs, security, performance, and best practices

## Documentation

- **[LOCAL-SETUP.md](LOCAL-SETUP.md)** - Complete setup guide
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration from old structure
- **[.env.local.example](.env.local.example)** - Configuration template
- **[tests/README.md](tests/README.md)** - Testing guide

## How It Works

1. Fetch PR diff from GitHub API
2. Send diff to local Ollama instance (llama3)
3. Parse AI response into structured comments
4. Post inline review comments on specific lines

## Scripts

| Script | Purpose |
|--------|---------|
| `review-pr.sh` | Review a specific PR (shell wrapper) |
| `scripts/review-pr.js` | Review PR (Node.js CLI) |
| `start-services.sh` | Start review server |
| `scripts/start-server.js` | Start server (Node.js) |
| `stop-services.sh` | Stop services |

## Requirements

- Node.js 18+
- Ollama with llama3 model
- GitHub Personal Access Token (with `repo` scope)
- (Optional) ngrok for remote access

## Architecture

The bot uses a modular architecture for better maintainability:

```
src/
├── utils/          # Configuration, logging, errors
├── github/         # GitHub API integration
├── ai/             # AI provider system (Ollama, future: OpenAI)
├── diff/           # Diff parsing and position mapping
├── review/         # Review orchestration
└── server/         # Express server
```

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for detailed architecture documentation.

## Customization

Edit `src/ai/prompts.js` to customize:
- Review prompts
- What issues to look for
- Comment format

Edit `src/utils/config.js` to customize:
- Bot name and emoji
- Default settings

## Troubleshooting

See [LOCAL-SETUP.md](LOCAL-SETUP.md) for detailed troubleshooting.

Quick checks:
```bash
# Check if server is running
curl http://localhost:8100/

# Check Ollama
curl http://localhost:11434/api/tags

# View logs
tail -f logs/review-server.log
```

## License

MIT

