# Local PR Review Bot - Setup Guide

This guide will help you set up the PR review bot to run locally and review PRs from any repository.

## What You'll Need

- **Ollama** installed with llama3 model
- **Node.js** v18 or higher
- **GitHub Personal Access Token**
- **(Optional) ngrok** for remote access

---

## Quick Start (5 Minutes)

### 1. Install Ollama

If you haven't already:

```bash
# macOS
brew install ollama

# Or download from https://ollama.ai
```

Pull the llama3 model:

```bash
ollama pull llama3
```

### 2. Get Your GitHub Token

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a name like "PR Review Bot"
4. Select scope: **`repo`** (Full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)

### 3. Configure the Bot

Create a `.env.local` file:

```bash
cd /Users/appfire-nishthaarora/Documents/OpenAI-projects/ai-pr-bot-sandbox
cp .env.local.example .env.local
```

Edit `.env.local` and add your GitHub token:

```bash
GITHUB_TOKEN=ghp_your_token_here
REVIEW_API_URL=http://localhost:8100/review
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3
```

### 4. Install Dependencies

```bash
npm install
npm install @octokit/core
```

---

## Daily Usage

### Start Services

```bash
./start-services.sh
```

This starts:
- Review server on port 8100
- Checks Ollama is running

### Review a PR

```bash
./review-pr.sh owner/repo PR_NUMBER
```

**Examples:**

```bash
# Review PR #42 from appfire/my-repo
./review-pr.sh appfire/my-repo 42

# Review PR #10 from your personal repo
./review-pr.sh yourusername/your-repo 10
```

### Stop Services

```bash
./stop-services.sh
```

---

## What Happens When You Review a PR?

1. Script fetches the PR diff from GitHub
2. Sends it to your local Ollama instance
3. Ollama analyzes the code and generates feedback
4. Script posts inline comments directly on the PR

---

## Optional: Enable Remote Access

If you want the bot to work automatically when PRs are opened (without manually running commands):

### 1. Install ngrok

```bash
brew install ngrok
```

### 2. Authenticate ngrok

Sign up at https://ngrok.com and get your auth token:

```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

### 3. Start ngrok

```bash
ngrok http 8100
```

Copy the https URL (e.g., `https://abc-123.ngrok-free.dev`) and update your `.env.local`:

```bash
REVIEW_API_URL=https://abc-123.ngrok-free.dev/review
```

Now you can use this URL in GitHub Actions workflows in other repos.

---

## Troubleshooting

### "Review server is not running"

Make sure you ran `./start-services.sh` first.

### "Ollama error" or timeouts

1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Make sure llama3 is installed: `ollama list`
3. Try pulling the model again: `ollama pull llama3`

### "Failed to parse Ollama response as JSON"

The model is returning text instead of JSON. This usually happens with very large diffs. The bot automatically handles this and returns empty comments if parsing fails.

### No comments posted to PR

Check:
1. Your GitHub token has `repo` scope
2. You have write access to the repository
3. The PR is still open
4. Check logs: `tail -f logs/review-server.log`

### "position not found in diff"

This happens when the line number doesn't match the diff. The bot will log which comments were skipped. This is usually fine - it just means Ollama referenced a line that wasn't in the changed files.

---

## File Structure

```
ai-pr-bot-sandbox/
├── review-pr.sh              # Main CLI to review PRs
├── start-services.sh         # Start all services
├── stop-services.sh          # Stop services
├── local-review-server.js    # Review server code
├── .github/
│   └── scripts/
│       └── fetch-pr-diff.js  # PR fetching logic
├── .env.local                # Your configuration (git-ignored)
├── .env.local.example        # Template
└── logs/                     # Server logs
```

---

## Tips

- **Keep services running**: You can leave `start-services.sh` running all day and just use `review-pr.sh` whenever you want to review a PR
- **Check logs**: If something goes wrong, check `logs/review-server.log`
- **Test locally first**: Before using ngrok, test with localhost to make sure everything works
- **Adjust prompts**: Edit `local-review-server.js` to customize what kind of feedback you want

---

## Advanced: Customizing the Review Prompt

Edit `local-review-server.js` around line 24 to change what the AI looks for:

```javascript
const prompt = `You are a code reviewer focusing on...
- Security vulnerabilities
- Performance issues
- Best practices
... (customize as needed)
`;
```

---

## Security Notes

- **Never commit `.env.local`** - it contains your GitHub token
- Keep your GitHub token secret
- If you expose ngrok URL, anyone can use your local resources
- The bot only has the permissions of your GitHub token

---

## Questions?

- Check the logs: `tail -f logs/review-server.log`
- Verify services: `curl http://localhost:8100/`
- Test Ollama: `ollama run llama3 "Hello"`

Enjoy automated code reviews! 🤖

