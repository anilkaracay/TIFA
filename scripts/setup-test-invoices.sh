#!/bin/bash

# Setup Test Invoices - Move them to different statuses for testing

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
WALLET_ADDRESS="${WALLET_ADDRESS:-0x1234567890123456789012345678901234567890}"

echo "🔧 Setting up test invoices with different statuses..."
echo ""

# Helper functions
tokenize_invoice() {
    local id=$1
    echo "  Tokenizing $id..."
    curl -s -X POST "$BACKEND_URL/invoices/$id/tokenize" \
        -H "x-wallet-address: $WALLET_ADDRESS" | jq -r '.status // "ERROR"'
}

finance_invoice() {
    local id=$1
    echo "  Financing $id..."
    curl -s -X POST "$BACKEND_URL/invoices/$id/finance" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d '{}' | jq -r '.status // "ERROR"'
}

partial_payment() {
    local id=$1
    local amount=$2
    echo "  Partial payment $amount to $id..."
    curl -s -X POST "$BACKEND_URL/invoices/$id/payments" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d "{
            \"transactionId\": \"test-tx-$(date +%s)\",
            \"amount\": \"$amount\",
            \"currency\": \"USDC\",
            \"paidAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
        }" | jq -r '.status // "ERROR"'
}

# Get invoice IDs from database or use known IDs
echo "📋 Step 1: Tokenizing invoices for x402 payment tests"
echo "-----------------------------------------------------"
TOKENIZE_IDS=("cmjmzl5k500wfizvq610wwk9v" "cmjmzl5mp00wvizvqacmadc05")
for id in "${TOKENIZE_IDS[@]}"; do
    tokenize_invoice "$id"
    sleep 1
done

echo ""
echo "📋 Step 2: Financing invoices for x402 payment tests"
echo "----------------------------------------------------"
FINANCE_IDS=("cmjmzl5jt00wdizvq1ff7zewv" "cmjmzl5n000wxizvq33mf0ai0" "cmjmzl5ks00wjizvqot45rlxu")
for id in "${FINANCE_IDS[@]}"; do
    finance_invoice "$id"
    sleep 1
done

echo ""
echo "📋 Step 3: Creating partial payments"
echo "------------------------------------"
PARTIAL_ID="cmjmzl5nc00wzizvqiy3zp59z"
partial_payment "$PARTIAL_ID" "300000"  # 600000 total, pay 300000 = PARTIALLY_PAID

echo ""
echo "✅ Test invoices setup complete!"
echo ""
echo "Test Scenarios Ready:"
echo "1. x402 Payment Tests:"
echo "   - TOKENIZED: cmjmzl5k500wfizvq610wwk9v, cmjmzl5mp00wvizvqacmadc05"
echo "   - FINANCED: cmjmzl5jt00wdizvq1ff7zewv, cmjmzl5n000wxizvq33mf0ai0"
echo "   - PARTIALLY_PAID: cmjmzl5nc00wzizvqiy3zp59z"
echo ""
echo "2. Agent Auto-Payment Tests:"
echo "   - COMP-DEBTOR-003 FINANCED: cmjmzl5ks00wjizvqot45rlxu"
echo "   - COMP-DEBTOR-003 TOKENIZED: (tokenize cmjmzl5le00wnizvqh12xeqf6)"
echo ""
echo "3. Risk Score Tests:"
echo "   - High Risk (overdue): cmjmzl5lq00wpizvq3j10mtf7"
echo "   - Low Risk (future): cmjmzl5m100wrizvqksqs4mod"
echo "   - Medium Risk: cmjmzl5md00wtizvqxyhoseo9"

