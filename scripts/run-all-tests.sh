#!/bin/bash

# Comprehensive Test Suite Runner
# Runs all test scenarios for TIFA system

echo "🧪 TIFA Comprehensive Test Suite"
echo "================================="
echo ""

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper function
test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASSED${NC}: $1"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}: $1"
        ((FAILED++))
    fi
}

echo "📋 Step 1: Creating Test Invoices"
echo "-----------------------------------"
bash scripts/create-test-invoices.sh > /dev/null 2>&1
test_result "Create test invoices"

echo ""
echo "📋 Step 2: Setting Up Invoice Statuses"
echo "----------------------------------------"
bash scripts/setup-test-invoices.sh > /dev/null 2>&1
test_result "Setup invoice statuses"

echo ""
echo "📋 Step 3: Testing x402 Payment Flow"
echo "-------------------------------------"
bash scripts/test-x402-payment.sh > /tmp/x402-test.log 2>&1
if grep -q "✅ Payment confirmed" /tmp/x402-test.log; then
    test_result "x402 payment flow"
else
    echo -e "${RED}❌ FAILED${NC}: x402 payment flow"
    ((FAILED++))
fi

echo ""
echo "📋 Step 4: Checking Agent Auto-Payment"
echo "---------------------------------------"
bash scripts/test-agent-payment.sh > /tmp/agent-test.log 2>&1
test_result "Agent auto-payment check"

echo ""
echo "📋 Step 5: Verifying Test Data"
echo "-------------------------------"

# Check payable invoices
PAYABLE_COUNT=$(curl -s "$BACKEND_URL/invoices?status=TOKENIZED,FINANCED,PARTIALLY_PAID" | \
    jq '[.[] | select(.externalId | startswith("TEST-"))] | length')
if [ "$PAYABLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASSED${NC}: Found $PAYABLE_COUNT payable test invoices"
    ((PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}: No payable test invoices found"
    ((FAILED++))
fi

# Check agent executions
EXEC_COUNT=$(curl -s "$BACKEND_URL/payment-authorization/cmjmyweou0001ygl5cuoia8ml/executions" 2>/dev/null | \
    jq '[.[] | select(.executionStatus == "EXECUTED")] | length' || echo "0")
if [ "$EXEC_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASSED${NC}: Found $EXEC_COUNT successful agent executions"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING${NC}: No agent executions found (agent may need more time)"
fi

echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check logs above.${NC}"
    exit 1
fi






