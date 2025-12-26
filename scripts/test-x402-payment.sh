#!/bin/bash

# Test x402 Payment Flow
# Tests the complete x402 payment flow with different invoice statuses

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
WALLET_ADDRESS="${WALLET_ADDRESS:-0x1234567890123456789012345678901234567890}"

echo "🧪 Testing x402 Payment Flow"
echo "=============================="
echo ""

# Get payable invoices
echo "📋 Fetching payable invoices..."
PAYABLE=$(curl -s "$BACKEND_URL/invoices?status=all" | \
    jq -r '[.[] | select(.externalId | startswith("TEST-")) | select(.status == "TOKENIZED" or .status == "FINANCED" or .status == "PARTIALLY_PAID") | select((.amount | tonumber) > ((.cumulativePaid // "0") | tonumber))] | .[0]')

if [ -z "$PAYABLE" ] || [ "$PAYABLE" == "null" ] || [ "$PAYABLE" == "" ]; then
    echo "❌ No payable test invoices found"
    echo "Available test invoices:"
    curl -s "$BACKEND_URL/invoices?status=all" | jq -r '[.[] | select(.externalId | startswith("TEST-"))] | .[] | "  - \(.externalId): \(.status) | Amount: \(.amount) | Paid: \(.cumulativePaid // "0")"'
    exit 1
fi

INVOICE_ID=$(echo "$PAYABLE" | jq -r '.id')
EXTERNAL_ID=$(echo "$PAYABLE" | jq -r '.externalId')
AMOUNT=$(echo "$PAYABLE" | jq -r '.amount')
PAID=$(echo "$PAYABLE" | jq -r '.cumulativePaid')
REMAINING=$((AMOUNT - PAID))

echo "✅ Found payable invoice:"
echo "   External ID: $EXTERNAL_ID"
echo "   Invoice ID: $INVOICE_ID"
echo "   Amount: $AMOUNT"
echo "   Paid: $PAID"
echo "   Remaining: $REMAINING"
echo ""

# Step 1: Request x402 payment
echo "📤 Step 1: Requesting x402 payment..."
PAYMENT_REQUEST=$(curl -s -X POST "$BACKEND_URL/invoices/$INVOICE_ID/pay" \
    -H "x-wallet-address: $WALLET_ADDRESS")

if echo "$PAYMENT_REQUEST" | jq -e '.x402' > /dev/null 2>&1; then
    SESSION_ID=$(echo "$PAYMENT_REQUEST" | jq -r '.sessionId')
    EXPIRES_AT=$(echo "$PAYMENT_REQUEST" | jq -r '.expiresAt')
    PAYMENT_AMOUNT=$(echo "$PAYMENT_REQUEST" | jq -r '.payment.amount')
    
    echo "✅ Payment request received:"
    echo "   Session ID: $SESSION_ID"
    echo "   Amount: $PAYMENT_AMOUNT"
    echo "   Expires At: $EXPIRES_AT"
    echo ""
    
    # Step 2: Confirm payment with mock txHash
    echo "📥 Step 2: Confirming payment..."
    MOCK_TXHASH="0x$(openssl rand -hex 32)"
    
    CONFIRM_RESULT=$(curl -s -X POST "$BACKEND_URL/invoices/$INVOICE_ID/pay/confirm" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d "{
            \"sessionId\": \"$SESSION_ID\",
            \"txHash\": \"$MOCK_TXHASH\"
        }")
    
    if echo "$CONFIRM_RESULT" | jq -e '.message' > /dev/null 2>&1; then
        NEW_STATUS=$(echo "$CONFIRM_RESULT" | jq -r '.invoice.status')
        NEW_PAID=$(echo "$CONFIRM_RESULT" | jq -r '.invoice.cumulativePaid')
        
        echo "✅ Payment confirmed:"
        echo "   Transaction Hash: $MOCK_TXHASH"
        echo "   New Status: $NEW_STATUS"
        echo "   New Cumulative Paid: $NEW_PAID"
        echo ""
        echo "🎉 x402 Payment test completed successfully!"
    else
        echo "❌ Payment confirmation failed:"
        echo "$CONFIRM_RESULT" | jq '.'
    fi
else
    echo "❌ Payment request failed:"
    echo "$PAYMENT_REQUEST" | jq '.'
fi

