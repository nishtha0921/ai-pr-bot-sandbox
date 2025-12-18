#!/bin/bash
# Stop all services for PR review bot

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Stopping PR Review Bot Services...${NC}"
echo ""

# Stop review server
if [ -f .review-server.pid ]; then
  PID=$(cat .review-server.pid)
  if kill -0 $PID 2>/dev/null; then
    echo -e "${YELLOW}Stopping review server (PID: $PID)...${NC}"
    kill $PID
    rm .review-server.pid
    echo -e "${GREEN}✓ Review server stopped${NC}"
  else
    echo -e "${YELLOW}Review server not running${NC}"
    rm .review-server.pid
  fi
else
  # Try to find and kill by port
  if lsof -ti:8100 > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping review server on port 8100...${NC}"
    kill $(lsof -ti:8100)
    echo -e "${GREEN}✓ Review server stopped${NC}"
  else
    echo -e "${YELLOW}Review server not running${NC}"
  fi
fi

echo ""
echo -e "${GREEN}All services stopped${NC}"
echo ""
echo "Note: Ollama and ngrok are left running (stop manually if needed)"






