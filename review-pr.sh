#!/bin/bash
# Review a PR from any repository locally
# Usage: ./review-pr.sh owner/repo PR_NUMBER

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load configuration
if [ -f .env.local ]; then
  source .env.local
else
  echo -e "${RED}Error: .env.local not found${NC}"
  echo "Please run setup first or create .env.local with your GitHub token"
  exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
  echo -e "${RED}Usage: ./review-pr.sh owner/repo PR_NUMBER${NC}"
  echo "Example: ./review-pr.sh appfire/my-repo 42"
  exit 1
fi

# Parse arguments
REPO_PATH=$1
PR_NUMBER=$2

# Split owner/repo
IFS='/' read -r REPO_OWNER REPO_NAME <<< "$REPO_PATH"

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
  echo -e "${RED}Error: Invalid repository format${NC}"
  echo "Use format: owner/repo (e.g., appfire/my-repo)"
  exit 1
fi

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
  echo -e "${RED}Error: GITHUB_TOKEN not set in .env.local${NC}"
  exit 1
fi

# Check if review API URL is set
if [ -z "$REVIEW_API_URL" ]; then
  echo -e "${YELLOW}Warning: REVIEW_API_URL not set, using default localhost${NC}"
  REVIEW_API_URL="http://localhost:8100/review"
fi

# Display what we're doing
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Reviewing PR #${PR_NUMBER} from ${REPO_OWNER}/${REPO_NAME}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if server is running
if ! curl -s http://localhost:8100/ > /dev/null 2>&1; then
  echo -e "${RED}Error: Review server is not running${NC}"
  echo "Please start services first: ./start-services.sh"
  exit 1
fi

# Export environment variables
export GITHUB_TOKEN
export REVIEW_API_URL
export PR_NUMBER
export REPO_OWNER
export REPO_NAME

# Run the review using the new modular script
echo -e "${YELLOW}Fetching PR data and generating review...${NC}"
echo ""

node scripts/review-pr.js "${REPO_PATH}" "${PR_NUMBER}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Review complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Check the PR on GitHub: https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${PR_NUMBER}"

