#!/bin/bash
#
# Deploy script for ODPT API Proxy Cloudflare Worker
#
# This script deploys the worker to Cloudflare using Wrangler.
#
# Prerequisites:
# - Node.js and npm installed
# - Wrangler CLI installed (npm install -g wrangler)
# - Cloudflare account with Workers enabled
# - wrangler.toml configured with your account details
# - ODPT_API_KEY secret set (use: wrangler secret put ODPT_API_KEY)
#
# Usage:
#   ./deploy.sh [environment]
#
# Arguments:
#   environment - Optional deployment environment (default: production)
#                 Options: production, staging, development
#
# Examples:
#   ./deploy.sh              # Deploy to production
#   ./deploy.sh staging      # Deploy to staging environment
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

# Default environment
ENVIRONMENT="${1:-production}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ODPT API Proxy - Cloudflare Worker Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: Wrangler CLI is not installed${NC}"
    echo -e "${YELLOW}Install it with: npm install -g wrangler${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Wrangler CLI found"

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}Error: wrangler.toml not found${NC}"
    echo -e "${YELLOW}Copy wrangler.toml.example to wrangler.toml and configure it:${NC}"
    echo -e "${YELLOW}  cp wrangler.toml.example wrangler.toml${NC}"
    echo -e "${YELLOW}  # Then edit wrangler.toml with your account ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} wrangler.toml found"

# Check if worker.js exists
if [ ! -f "worker.js" ]; then
    echo -e "${RED}Error: worker.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} worker.js found"

# Validate wrangler.toml
if grep -q "YOUR_ACCOUNT_ID_HERE" wrangler.toml; then
    echo -e "${RED}Error: wrangler.toml still contains placeholder values${NC}"
    echo -e "${YELLOW}Please update wrangler.toml with your actual account ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} wrangler.toml configured"

# Check if user is logged in to Cloudflare
echo ""
echo -e "${BLUE}Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare. Initiating login...${NC}"
    wrangler login
else
    echo -e "${GREEN}✓${NC} Authenticated with Cloudflare"
fi

# Check if ODPT_API_KEY secret is set
echo ""
echo -e "${BLUE}Checking secrets...${NC}"
echo -e "${YELLOW}Note: This script cannot verify if ODPT_API_KEY is set.${NC}"
echo -e "${YELLOW}If the secret is not set, run:${NC}"
echo -e "${YELLOW}  wrangler secret put ODPT_API_KEY${NC}"
echo ""

# Confirm deployment
echo -e "${YELLOW}Ready to deploy to ${ENVIRONMENT}${NC}"
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Deploy the worker
echo ""
echo -e "${BLUE}Deploying worker...${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    wrangler deploy
else
    wrangler deploy --env "$ENVIRONMENT"
fi

DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${GREEN}Your worker is now live at:${NC}"
    echo -e "${BLUE}https://odpt-api-proxy.<your-subdomain>.workers.dev${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Test the health endpoint:"
    echo -e "   ${BLUE}curl https://odpt-api-proxy.<your-subdomain>.workers.dev/health${NC}"
    echo ""
    echo -e "2. Update your trainboard defaults.json to use the proxy (compile-time defaults):"
    echo -e "   ${BLUE}API_BASE_URL: https://odpt-api-proxy.<your-subdomain>.workers.dev/${NC}"
    echo ""
    echo -e "3. Remove the ODPT_API_KEY from defaults.json (proxy handles it now); do NOT commit private keys"
    echo ""
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Deployment failed!${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Check the error messages above for details${NC}"
    exit $DEPLOY_EXIT_CODE
fi
