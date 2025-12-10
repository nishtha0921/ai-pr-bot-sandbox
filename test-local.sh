#!/bin/bash
# Test script for local workflow execution

# Replace with your actual GitHub token
export GITHUB_TOKEN="${GITHUB_TOKEN:-ghp_YOUR_TOKEN_HERE}"
export REVIEW_API_URL="http://localhost:8100/review"
export PR_NUMBER="${1:-1}"  # Use first argument or default to PR #1
export REPO_OWNER="nishtha0921"
export REPO_NAME="ai-pr-bot-sandbox"

echo "Testing PR #$PR_NUMBER"
echo "Server URL: $REVIEW_API_URL"

node .github/scripts/fetch-pr-diff.js
