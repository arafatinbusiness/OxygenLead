#!/bin/bash

# OxygenLead Setup Script
# Run this once to set up everything locally

set -e

echo "🚀 OxygenLead Setup Script"
echo "=========================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install from https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker found"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js found ($(node --version))"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} pnpm not found. Installing..."
    npm install -g pnpm
fi
echo -e "${GREEN}✓${NC} pnpm found"

# Step 1: Start Docker containers
echo -e "\n${BLUE}Step 1: Starting Docker containers...${NC}"
docker-compose up -d postgres redis

echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
for i in {1..30}; do
    if docker exec oxygenlead-postgres pg_isready -U oxygenlead &>/dev/null; then
        echo -e "${GREEN}✓${NC} PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

echo -e "${YELLOW}⏳ Waiting for Redis to be ready...${NC}"
for i in {1..30}; do
    if docker exec oxygenlead-redis redis-cli ping &>/dev/null; then
        echo -e "${GREEN}✓${NC} Redis is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Redis failed to start"
        exit 1
    fi
    sleep 1
done

# Step 2: Install dependencies
echo -e "\n${BLUE}Step 2: Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Step 3: Initialize database
echo -e "\n${BLUE}Step 3: Initializing database...${NC}"
pnpm db:push
echo -e "${GREEN}✓${NC} Database initialized"

# Step 4: Seed test data
echo -e "\n${BLUE}Step 4: Seeding test data...${NC}"
pnpm db:seed
echo -e "${GREEN}✓${NC} Test data seeded"

# Success message
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Start the application:"
echo "   ${YELLOW}pnpm dev${NC}"
echo ""
echo "2. Open in browser:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "3. Login with:"
echo "   Email:    demo@oxygenlead.com"
echo "   Password: password123"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  pnpm db:studio    - Open database GUI"
echo "  docker-compose ps - Check container status"
echo "  docker-compose logs postgres - View database logs"
echo ""
echo -e "${YELLOW}See SETUP_GUIDE.md for detailed documentation${NC}"
