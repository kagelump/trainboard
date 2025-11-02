#!/bin/bash
#
# Test script for ODPT API Proxy Cloudflare Worker
#
# This script tests the deployed worker to ensure it's working correctly.
#
# Usage:
#   ./test.sh <worker-url>
#
# Example:
#   ./test.sh https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

WORKER_URL="${1}"

if [ -z "$WORKER_URL" ]; then
    echo -e "${RED}Error: Worker URL is required${NC}"
    echo ""
    echo "Usage: $0 <worker-url>"
    echo "Example: $0 https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev"
    exit 1
fi

# Remove trailing slash if present
WORKER_URL="${WORKER_URL%/}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing ODPT API Proxy Worker${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Worker URL:${NC} $WORKER_URL"
echo ""

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
echo -e "GET ${WORKER_URL}/health"
echo ""

HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${WORKER_URL}/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE:/d')

echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Test 2: Invalid endpoint
echo -e "${YELLOW}Test 2: Invalid Endpoint (should return 400)${NC}"
echo -e "GET ${WORKER_URL}/invalid"
echo ""

INVALID_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${WORKER_URL}/invalid")
HTTP_CODE=$(echo "$INVALID_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✓ Invalid endpoint handling works${NC}"
else
    echo -e "${YELLOW}⚠ Expected 400, got HTTP $HTTP_CODE${NC}"
fi
echo ""

# Test 3: Real ODPT API request (Station endpoint)
echo -e "${YELLOW}Test 3: ODPT Station Request${NC}"
echo -e "GET ${WORKER_URL}/odpt:Station?odpt:railway=odpt.Railway:Tokyu.Toyoko"
echo ""

STATION_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${WORKER_URL}/odpt:Station?odpt:railway=odpt.Railway:Tokyu.Toyoko")
HTTP_CODE=$(echo "$STATION_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$STATION_RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
    # Check if response is valid JSON array
    if echo "$RESPONSE_BODY" | python3 -m json.tool > /dev/null 2>&1; then
        STATION_COUNT=$(echo "$RESPONSE_BODY" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓ Station request successful${NC}"
        echo -e "${BLUE}  Found $STATION_COUNT stations${NC}"

        # Show first station as example
        if [ "$STATION_COUNT" -gt "0" ]; then
            echo ""
            echo -e "${BLUE}  Example station:${NC}"
            echo "$RESPONSE_BODY" | python3 -c "import sys, json; station = json.load(sys.stdin)[0]; print(f\"    Name: {station.get('dc:title', 'N/A')}\"); print(f\"    Code: {station.get('odpt:stationCode', 'N/A')}\"); print(f\"    ID: {station.get('owl:sameAs', 'N/A')}\")" 2>/dev/null || echo "    (Unable to parse station data)"
        fi
    else
        echo -e "${YELLOW}⚠ Response is not valid JSON${NC}"
        echo "$RESPONSE_BODY" | head -5
    fi
else
    echo -e "${RED}✗ Station request failed (HTTP $HTTP_CODE)${NC}"
    echo "$RESPONSE_BODY" | head -10
fi
echo ""

# Test 4: CORS headers
echo -e "${YELLOW}Test 4: CORS Headers${NC}"
echo -e "OPTIONS ${WORKER_URL}/odpt:Station"
echo ""

CORS_HEADERS=$(curl -s -I -X OPTIONS "${WORKER_URL}/odpt:Station" | grep -i "access-control")

if [ -n "$CORS_HEADERS" ]; then
    echo -e "${GREEN}✓ CORS headers present${NC}"
    echo "$CORS_HEADERS"
else
    echo -e "${YELLOW}⚠ No CORS headers found${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Worker is operational!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update your trainboard defaults.json (compile-time defaults):"
echo -e "   ${BLUE}API_BASE_URL: ${WORKER_URL}/${NC}"
echo ""
echo -e "2. Remove ODPT_API_KEY from defaults.json (do NOT commit private keys)"
echo ""
echo -e "3. Test the trainboard app in your browser"
echo ""
