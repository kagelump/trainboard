#!/bin/bash
#
# Setup script for ODPT API Proxy Cloudflare Worker
#
# This script helps you set up the Cloudflare Worker environment for the ODPT API proxy.
# It guides you through:
# - Installing Wrangler CLI
# - Authenticating with Cloudflare
# - Creating wrangler.toml from template
# - Setting up secrets
#
# Usage:
#   ./setup.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ODPT API Proxy - Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check Node.js installation
echo -e "${BLUE}Step 1: Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo -e "${YELLOW}Please install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js found: $NODE_VERSION"
echo ""

# Step 2: Check/Install Wrangler
echo -e "${BLUE}Step 2: Checking Wrangler CLI...${NC}"
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Wrangler CLI is not installed${NC}"
    read -p "Install Wrangler globally? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Installing Wrangler...${NC}"
        npm install -g wrangler
        echo -e "${GREEN}✓${NC} Wrangler installed successfully"
    else
        echo -e "${YELLOW}Please install Wrangler manually:${NC}"
        echo -e "${YELLOW}  npm install -g wrangler${NC}"
        exit 1
    fi
else
    WRANGLER_VERSION=$(wrangler --version)
    echo -e "${GREEN}✓${NC} Wrangler found: $WRANGLER_VERSION"
fi
echo ""

# Step 3: Cloudflare Authentication
echo -e "${BLUE}Step 3: Cloudflare Authentication${NC}"
if wrangler whoami &> /dev/null; then
    echo -e "${GREEN}✓${NC} Already authenticated with Cloudflare"
    wrangler whoami
else
    echo -e "${YELLOW}Not authenticated with Cloudflare${NC}"
    echo -e "${BLUE}Opening browser for authentication...${NC}"
    wrangler login
fi
echo ""

# Step 4: Create wrangler.toml from template
echo -e "${BLUE}Step 4: Configuration Setup${NC}"
if [ -f "wrangler.toml" ]; then
    echo -e "${YELLOW}Warning: wrangler.toml already exists${NC}"
    read -p "Overwrite with template? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Keeping existing wrangler.toml${NC}"
    else
        cp wrangler.toml.example wrangler.toml
        echo -e "${GREEN}✓${NC} Created wrangler.toml from template"
    fi
else
    cp wrangler.toml.example wrangler.toml
    echo -e "${GREEN}✓${NC} Created wrangler.toml from template"
fi
echo ""

# Step 5: Get Account ID
echo -e "${BLUE}Step 5: Account ID Configuration${NC}"
echo -e "${YELLOW}You need your Cloudflare Account ID${NC}"
echo -e "Find it at: ${BLUE}https://dash.cloudflare.com/profile${NC}"
echo -e "Or run: ${BLUE}wrangler whoami${NC}"
echo ""

# Try to get account ID from wrangler
ACCOUNT_ID=""
if command -v jq &> /dev/null; then
    # If jq is available, try to extract account ID
    ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
fi

if [ -n "$ACCOUNT_ID" ]; then
    echo -e "${GREEN}Found Account ID: $ACCOUNT_ID${NC}"
    read -p "Use this Account ID? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Update wrangler.toml with account ID
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/YOUR_ACCOUNT_ID_HERE/$ACCOUNT_ID/" wrangler.toml
        else
            # Linux
            sed -i "s/YOUR_ACCOUNT_ID_HERE/$ACCOUNT_ID/" wrangler.toml
        fi
        echo -e "${GREEN}✓${NC} Updated wrangler.toml with Account ID"
    else
        echo -e "${YELLOW}Please manually edit wrangler.toml and replace YOUR_ACCOUNT_ID_HERE${NC}"
    fi
else
    read -p "Enter your Cloudflare Account ID: " USER_ACCOUNT_ID
    if [ -n "$USER_ACCOUNT_ID" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/YOUR_ACCOUNT_ID_HERE/$USER_ACCOUNT_ID/" wrangler.toml
        else
            sed -i "s/YOUR_ACCOUNT_ID_HERE/$USER_ACCOUNT_ID/" wrangler.toml
        fi
        echo -e "${GREEN}✓${NC} Updated wrangler.toml with Account ID"
    else
        echo -e "${YELLOW}Please manually edit wrangler.toml and replace YOUR_ACCOUNT_ID_HERE${NC}"
    fi
fi
echo ""

# Step 6: Set ODPT API Key Secret
echo -e "${BLUE}Step 6: ODPT API Key Configuration${NC}"
echo -e "${YELLOW}You need to set your ODPT API key as a secret${NC}"
echo -e "Get your API key from: ${BLUE}https://developer.odpt.org/${NC}"
echo ""
read -p "Do you want to set the ODPT_API_KEY secret now? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${BLUE}Setting ODPT_API_KEY secret...${NC}"
    echo -e "${YELLOW}Paste your ODPT API key when prompted${NC}"
    wrangler secret put ODPT_API_KEY
    echo -e "${GREEN}✓${NC} ODPT_API_KEY secret set"
else
    echo -e "${YELLOW}Remember to set the secret before deploying:${NC}"
    echo -e "${YELLOW}  wrangler secret put ODPT_API_KEY${NC}"
fi
echo ""

# Step 7: Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo -e "1. Review and customize wrangler.toml:"
echo -e "   ${BLUE}nano wrangler.toml${NC}"
echo ""
echo -e "2. Test the worker locally (optional):"
echo -e "   ${BLUE}wrangler dev${NC}"
echo ""
echo -e "3. Deploy to Cloudflare:"
echo -e "   ${BLUE}./deploy.sh${NC}"
echo ""
echo -e "4. Update your trainboard configuration to use the proxy"
echo ""
echo -e "${BLUE}For detailed documentation, see README.md${NC}"
echo ""
