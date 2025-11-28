#!/bin/bash
echo "=== Test 1: Build with NODE_ENV=development (should FAIL) ==="
NODE_ENV=development npm run build 2>&1 | tail -5
echo ""
echo "Exit code: $?"
echo ""

echo "=== Test 2: Build with NODE_ENV=production (should SUCCEED) ==="
rm -rf .next
NODE_ENV=production npm run build 2>&1 | tail -5
echo ""
echo "Exit code: $?"
echo ""

echo "=== Test 3: Build with unset NODE_ENV (should SUCCEED) ==="
rm -rf .next
unset NODE_ENV
npm run build 2>&1 | tail -5
echo ""
echo "Exit code: $?"
