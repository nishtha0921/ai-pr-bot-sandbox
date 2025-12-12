#!/bin/bash

# RAG Quick Start Script
# This script sets up RAG for your PR review bot

set -e

echo "========================================="
echo "  RAG Quick Start for PR Review Bot"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if ChromaDB is running
echo "Step 1: Checking ChromaDB..."
if curl -s http://localhost:8002/api/v1/heartbeat > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ChromaDB is running${NC}"
else
    echo -e "${YELLOW}⚠ ChromaDB is not running${NC}"
    echo ""
    echo "Starting ChromaDB with Docker..."
    docker run -d -p 8002:8000 --name chromadb chromadb/chroma
    
    # Wait for ChromaDB to start
    echo "Waiting for ChromaDB to initialize..."
    sleep 5
    
    if curl -s http://localhost:8002/api/v1/heartbeat > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ChromaDB started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start ChromaDB${NC}"
        echo "Please start ChromaDB manually:"
        echo "  docker run -d -p 8002:8000 chromadb/chroma"
        exit 1
    fi
fi

echo ""
echo "Step 2: Installing dependencies..."
if [ -f "package.json" ]; then
    if command -v yarn &> /dev/null; then
        yarn add chromadb
    else
        npm install chromadb
    fi
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}✗ package.json not found${NC}"
    echo "Please run this script from the ai-pr-bot-sandbox directory"
    exit 1
fi

echo ""
echo "Step 3: Setup complete!"
echo ""
echo "========================================="
echo "  Next Steps"
echo "========================================="
echo ""
echo "1. Index your repository:"
echo -e "   ${YELLOW}node scripts/index-repo.js /path/to/repo owner repo-name${NC}"
echo ""
echo "   Example:"
echo -e "   ${GREEN}node scripts/index-repo.js . Git-Prime flow-frontend-modules${NC}"
echo ""
echo "2. Review a PR with RAG:"
echo -e "   ${YELLOW}yarn review:rag owner/repo PR_NUMBER${NC}"
echo ""
echo "   Example:"
echo -e "   ${GREEN}yarn review:rag Git-Prime/flow-frontend-modules 436${NC}"
echo ""
echo "========================================="
echo "  Helpful Commands"
echo "========================================="
echo ""
echo "Check ChromaDB status:"
echo "  node test-chroma.js"
echo ""
echo "View indexed documents:"
echo "  curl http://localhost:8002/api/v1/collections/pr-reviews/count"
echo ""
echo "Stop ChromaDB:"
echo "  docker stop chromadb"
echo ""
echo "Restart ChromaDB:"
echo "  docker start chromadb"
echo ""
echo "========================================="
echo ""
echo -e "${GREEN}✓ RAG setup complete! Happy reviewing! 🚀${NC}"
echo ""

