#!/bin/bash

# Test Invoice Generator Script
# Creates various test invoices for comprehensive testing

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
WALLET_ADDRESS="${WALLET_ADDRESS:-0x1234567890123456789012345678901234567890}"

echo "🚀 Creating test invoices..."
echo "Backend: $BACKEND_URL"
echo "Wallet: $WALLET_ADDRESS"
echo ""

# Helper function to create invoice
create_invoice() {
    local external_id=$1
    local company_id=$2
    local debtor_id=$3
    local amount=$4
    local currency=$5
    local due_date=$6
    
    curl -s -X POST "$BACKEND_URL/invoices" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d "{
            \"externalId\": \"$external_id\",
            \"companyId\": \"$company_id\",
            \"debtorId\": \"$debtorId\",
            \"amount\": \"$amount\",
            \"currency\": \"$currency\",
            \"dueDate\": \"$due_date\"
        }" | jq -r '.id // "ERROR"'
}

# Get current date and future dates
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FUTURE_7D=$(date -u -v+7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
FUTURE_30D=$(date -u -v+30d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+30 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
PAST_5D=$(date -u -v-5d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "-5 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "📋 Test Scenario 1: x402 Payment Test Invoices"
echo "-----------------------------------------------"

# Test 1: Small amount, USDC, FINANCED status (for x402 payment)
echo "Creating TEST-X402-SMALL..."
INV1=$(create_invoice "TEST-X402-SMALL" "COMP-ISSUER-001" "COMP-DEBTOR-003" "50000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV1"

# Test 2: Medium amount, USDC, TOKENIZED status
echo "Creating TEST-X402-MEDIUM..."
INV2=$(create_invoice "TEST-X402-MEDIUM" "COMP-ISSUER-001" "COMP-DEBTOR-003" "200000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV2"

# Test 3: Large amount, USDC, PARTIALLY_PAID status
echo "Creating TEST-X402-LARGE..."
INV3=$(create_invoice "TEST-X402-LARGE" "COMP-ISSUER-001" "COMP-DEBTOR-003" "1000000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV3"

echo ""
echo "📋 Test Scenario 2: Agent Authorization Test Invoices"
echo "-----------------------------------------------------"

# Test 4: For agent auto-payment (COMP-DEBTOR-003 has authorization)
echo "Creating TEST-AGENT-AUTO-1..."
INV4=$(create_invoice "TEST-AGENT-AUTO-1" "COMP-ISSUER-001" "COMP-DEBTOR-003" "300000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV4"

# Test 5: Different currency (TRY) - should be blocked by agent
echo "Creating TEST-AGENT-BLOCKED..."
INV5=$(create_invoice "TEST-AGENT-BLOCKED" "COMP-ISSUER-001" "COMP-DEBTOR-003" "400000" "TRY" "$FUTURE_7D")
echo "  Invoice ID: $INV5"

# Test 6: Amount exceeds limit
echo "Creating TEST-AGENT-LIMIT-EXCEED..."
INV6=$(create_invoice "TEST-AGENT-LIMIT-EXCEED" "COMP-ISSUER-001" "COMP-DEBTOR-003" "2000000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV6"

echo ""
echo "📋 Test Scenario 3: Risk Score Test Invoices"
echo "---------------------------------------------"

# Test 7: High risk (overdue, large amount)
echo "Creating TEST-RISK-HIGH..."
INV7=$(create_invoice "TEST-RISK-HIGH" "COMP-ISSUER-001" "COMP-DEBTOR-001" "5000000" "USDC" "$PAST_5D")
echo "  Invoice ID: $INV7"

# Test 8: Low risk (future due date, small amount)
echo "Creating TEST-RISK-LOW..."
INV8=$(create_invoice "TEST-RISK-LOW" "COMP-ISSUER-001" "COMP-DEBTOR-002" "10000" "USDC" "$FUTURE_30D")
echo "  Invoice ID: $INV8"

# Test 9: Medium risk
echo "Creating TEST-RISK-MEDIUM..."
INV9=$(create_invoice "TEST-RISK-MEDIUM" "COMP-ISSUER-001" "COMP-DEBTOR-001" "500000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV9"

echo ""
echo "📋 Test Scenario 4: Status Transition Test Invoices"
echo "---------------------------------------------------"

# Test 10: For TOKENIZED status
echo "Creating TEST-STATUS-TOKENIZED..."
INV10=$(create_invoice "TEST-STATUS-TOKENIZED" "COMP-ISSUER-001" "COMP-DEBTOR-002" "150000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV10"

# Test 11: For FINANCED status
echo "Creating TEST-STATUS-FINANCED..."
INV11=$(create_invoice "TEST-STATUS-FINANCED" "COMP-ISSUER-001" "COMP-DEBTOR-001" "250000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV11"

# Test 12: For PARTIALLY_PAID status
echo "Creating TEST-STATUS-PARTIAL..."
INV12=$(create_invoice "TEST-STATUS-PARTIAL" "COMP-ISSUER-001" "COMP-DEBTOR-002" "600000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV12"

echo ""
echo "📋 Test Scenario 5: Edge Cases"
echo "-------------------------------"

# Test 13: Very small amount
echo "Creating TEST-EDGE-SMALL..."
INV13=$(create_invoice "TEST-EDGE-SMALL" "COMP-ISSUER-001" "COMP-DEBTOR-001" "1000" "USDC" "$FUTURE_7D")
echo "  Invoice ID: $INV13"

# Test 14: Very large amount
echo "Creating TEST-EDGE-LARGE..."
INV14=$(create_invoice "TEST-EDGE-LARGE" "COMP-ISSUER-001" "COMP-DEBTOR-001" "10000000" "USDC" "$FUTURE_30D")
echo "  Invoice ID: $INV14"

# Test 15: Different currency
echo "Creating TEST-EDGE-CURRENCY..."
INV15=$(create_invoice "TEST-EDGE-CURRENCY" "COMP-ISSUER-001" "COMP-DEBTOR-002" "300000" "TRY" "$FUTURE_7D")
echo "  Invoice ID: $INV15"

echo ""
echo "✅ Test invoices created!"
echo ""
echo "Next steps:"
echo "1. Tokenize some invoices: POST /invoices/{id}/tokenize"
echo "2. Finance some invoices: POST /invoices/{id}/finance"
echo "3. Make partial payments: POST /invoices/{id}/payments"
echo "4. Test x402 payments on TOKENIZED/FINANCED/PARTIALLY_PAID invoices"
echo "5. Test agent auto-payment on COMP-DEBTOR-003 invoices"






