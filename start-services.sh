#!/bin/bash
# Start all required services for the PR review bot

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Starting AI PR Review Bot Services${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. Check if Ollama is running
echo -e "${YELLOW}[1/2] Checking Ollama...${NC}"
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "${RED}Error: Ollama is not running${NC}"
  echo "Please start Ollama first:"
  echo "  brew services start ollama"
  echo "  OR"
  echo "  ollama serve"
  exit 1
fi
echo -e "${GREEN}✓ Ollama is running${NC}"
echo ""

# 2. Start the review server
echo -e "${YELLOW}[2/2] Starting review server...${NC}"

# Kill existing server if running
if [ -f .review-server.pid ]; then
  OLD_PID=$(cat .review-server.pid)
  if kill -0 $OLD_PID 2>/dev/null; then
    echo "Stopping existing server (PID: $OLD_PID)"
    kill $OLD_PID
    sleep 1
  fi
  rm .review-server.pid
fi

# Start new server in background
node scripts/start-server.js > logs/server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > .review-server.pid

# Wait for server to start
sleep 2

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
  echo -e "${GREEN}✓ Review server started (PID: $SERVER_PID)${NC}"
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}All services started successfully!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Server is running at: http://localhost:8100"
  echo "View logs: tail -f logs/server.log"
  echo ""
  echo "To review a PR:"
  echo "  ./review-pr.sh owner/repo PR_NUMBER"
  echo ""
  echo "To stop services:"
  echo "  ./stop-services.sh"
else
  echo -e "${RED}Error: Failed to start review server${NC}"
  echo "Check logs: cat logs/server.log"
  rm .review-server.pid
  exit 1
fi


