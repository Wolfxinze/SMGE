#!/bin/bash

# Infrastructure Integration Test Script
# Tests all infrastructure components manually

set -e

echo "🧪 SMGE Infrastructure Integration Tests"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Test helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Test Next.js Application
echo "1️⃣  Testing Next.js Application..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:3000/api/health)
  if echo "$HEALTH" | grep -q "\"status\":\"ok\""; then
    pass "Next.js health check responding"
  else
    fail "Next.js health check returned unexpected response"
  fi
else
  fail "Next.js application not responding on port 3000"
fi
echo ""

# 2. Test Environment Variables
echo "2️⃣  Testing Environment Variables..."
cd "$(dirname "$0")/../.."

if [ -f ".env.local" ]; then
  pass ".env.local file exists"

  if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
    pass "Supabase URL configured"
  else
    fail "Supabase URL not configured"
  fi

  if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local; then
    pass "Supabase anon key configured"
  else
    fail "Supabase anon key not configured"
  fi

  if grep -q "N8N_URL" .env.local; then
    pass "n8n URL configured"
  else
    warn "n8n URL not configured (optional for initial setup)"
  fi
else
  fail ".env.local file not found"
fi
echo ""

# 3. Test File Structure
echo "3️⃣  Testing File Structure..."
check_file() {
  if [ -f "$1" ]; then
    pass "$1 exists"
  else
    fail "$1 missing"
  fi
}

check_file "lib/supabase/client.ts"
check_file "lib/supabase/server.ts"
check_file "lib/n8n/client.ts"
check_file "lib/n8n/types.ts"
check_file "app/api/health/route.ts"
check_file "app/api/webhooks/n8n/route.ts"
check_file "docker-compose.yml"
echo ""

# 4. Test Docker Configuration
echo "4️⃣  Testing Docker Setup..."
if command -v docker >/dev/null 2>&1; then
  pass "Docker installed"

  if docker-compose config > /dev/null 2>&1; then
    pass "docker-compose.yml is valid"
  else
    fail "docker-compose.yml has errors"
  fi
else
  warn "Docker not installed (required for n8n)"
fi
echo ""

# 5. Test n8n Connectivity (if running)
echo "5️⃣  Testing n8n Connectivity..."
if curl -s http://localhost:5678 > /dev/null 2>&1; then
  pass "n8n responding on port 5678"
else
  warn "n8n not running (start with: docker-compose up -d)"
fi
echo ""

# 6. Test TypeScript Compilation
echo "6️⃣  Testing TypeScript Build..."
if npm run build > /tmp/build.log 2>&1; then
  pass "TypeScript build successful"
else
  fail "TypeScript build failed (check /tmp/build.log)"
fi
echo ""

# Summary
echo "========================================"
echo "Test Summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
