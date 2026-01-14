#!/bin/bash

# Demo Environment Seeder
# Creates diverse invoices for the demo wallet

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
WALLET_ADDRESS="0xb7b92a8c39911439add86b88460baD97D2afbcc9" # User's Demo Wallet

echo "🚀 Seeding Demo Environment..."
echo "Backend: $BACKEND_URL"
echo "Wallet: $WALLET_ADDRESS"
echo ""

# Helper function to create invoice
create_invoice() {
    local external_id=$1
    local amount=$2
    local due_date=$3
    local reference=$4
    
    echo "Creating Invoice: $external_id ($amount MNT)..." >&2
    
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/invoices" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d "{
            \"externalId\": \"$external_id\",
            \"companyId\": \"COMP-ISSUER-001\",
            \"debtorId\": \"COMP-DEBTOR-001\",
            \"amount\": \"$amount\",
            \"currency\": \"MNT\",
            \"dueDate\": \"$due_date\"
        }")
    
    ID=$(echo $RESPONSE | jq -r '.id')
    echo "  -> Created ID: $ID" >&2
    echo $ID
}

# Helper to tokenize
tokenize() {
    local id=$1
    echo "  -> Tokenizing $id..."
    curl -s -X POST "$BACKEND_URL/invoices/$id/tokenize" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" > /dev/null
}

# Helper to finance
finance() {
    local id=$1
    echo "  -> Financing $id..."
    curl -s -X POST "$BACKEND_URL/invoices/$id/finance" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d '{ "amount": "0" }' > /dev/null # Finance full available amount
}

# Helper to pay
pay() {
    local id=$1
    local amount=$2
    echo "  -> Recording Payment for $id ($amount MNT)..."
    curl -s -X POST "$BACKEND_URL/invoices/$id/payments" \
        -H "Content-Type: application/json" \
        -H "x-wallet-address: $WALLET_ADDRESS" \
        -d "{
            \"amount\": \"$amount\",
            \"currency\": \"MNT\",
            \"txHash\": \"0xDEMO_HASH_$(date +%s)_$RANDOM\",
            \"metadata\": { \"source\": \"demo-script\" }
        }" > /dev/null
}

# Dates
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FUTURE_30D=$(date -u -v+30d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+30 days" +"%Y-%m-%dT%H:%M:%SZ")
PAST_10D=$(date -u -v-10d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "-10 days" +"%Y-%m-%dT%H:%M:%SZ")

echo "---------------------------------------------------"

# 1. PENDING INVOICE (ISSUED)
# Standard invoice waiting for action
ID_PENDING_1=$(create_invoice "DEMO-ISSUED-001" "150000" "$FUTURE_30D" "Standard Waiting")
ID_PENDING_2=$(create_invoice "DEMO-ISSUED-002" "50000" "$FUTURE_30D" "Small Pending")

# 2. TOKENIZED INVOICE (Approved but not Financed)
# Tokenized ONLY
ID_TOKENIZED=$(create_invoice "DEMO-TOKEN-003" "200000" "$FUTURE_30D" "Asset Tokenized")
tokenize $ID_TOKENIZED

# 3. FINANCED INVOICE (Active Loan)
# Tokenized and Financed
ID_FINANCED_1=$(create_invoice "DEMO-LOAN-004" "500000" "$FUTURE_30D" "Active Big Loan")
tokenize $ID_FINANCED_1
finance $ID_FINANCED_1

ID_FINANCED_2=$(create_invoice "DEMO-LOAN-005" "120000" "$FUTURE_30D" "Active Small Loan")
tokenize $ID_FINANCED_2
finance $ID_FINANCED_2

# 4. REPAID INVOICE (Completed)
# Tokenized, Financed, and Fully Repaid
ID_REPAID=$(create_invoice "DEMO-PAID-006" "10000" "$FUTURE_30D" "Completed History")
tokenize $ID_REPAID
finance $ID_REPAID
pay $ID_REPAID "10000"

# 5. PARTIALLY REPAID
# Tokenized, Financed, Partially Paid
ID_PARTIAL=$(create_invoice "DEMO-PART-007" "75000" "$FUTURE_30D" "Partial Payment")
tokenize $ID_PARTIAL
finance $ID_PARTIAL
pay $ID_PARTIAL "25000"

# 6. OVERDUE INVOICE
# Past due date
ID_OVERDUE=$(create_invoice "DEMO-LATE-008" "300000" "$PAST_10D" "Overdue Risk")

echo "---------------------------------------------------"
echo "✅ Demo Environment Seeded!"
echo "Enjoy your video! 🎥"
