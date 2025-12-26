#!/bin/bash

# Test Agent Auto-Payment
# Verifies that agent automatically pays authorized invoices

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"

echo "🤖 Testing Agent Auto-Payment"
echo "============================="
echo ""

# Get invoices for COMP-DEBTOR-003 that should be auto-paid
echo "📋 Checking invoices for COMP-DEBTOR-003..."
INVOICES=$(curl -s "$BACKEND_URL/invoices?status=all" | \
    jq -r '[.[] | select(.debtorId == "COMP-DEBTOR-003") | select(.externalId | startswith("TEST-"))]')

COUNT=$(echo "$INVOICES" | jq 'length')
echo "✅ Found $COUNT test invoices for COMP-DEBTOR-003"
echo ""

# Show invoice details
echo "📄 Invoice Details:"
echo "$INVOICES" | jq -r '.[] | "  - \(.externalId): \(.status) | Amount: \(.amount) | Paid: \(.cumulativePaid)"'
echo ""

# Check agent execution history
echo "📊 Checking agent execution history..."
EXECUTIONS=$(curl -s "$BACKEND_URL/payment-authorization/cmjmyweou0001ygl5cuoia8ml/executions" | \
    jq -r '[.[] | select(.invoiceId != null)] | sort_by(.createdAt) | reverse | .[0:5]')

EXEC_COUNT=$(echo "$EXECUTIONS" | jq 'length')
echo "✅ Found $EXEC_COUNT recent executions"
echo ""

if [ "$EXEC_COUNT" -gt 0 ]; then
    echo "📋 Recent Executions:"
    echo "$EXECUTIONS" | jq -r '.[] | "  - Invoice: \(.invoiceId) | Status: \(.executionStatus) | Amount: \(.amount) | Reason: \(.reason // "N/A")"'
    echo ""
fi

echo "⏳ Waiting for agent to process invoices (check again in 60 seconds)..."
echo ""
echo "To check manually:"
echo "  curl \"$BACKEND_URL/payment-authorization/cmjmyweou0001ygl5cuoia8ml/executions\" | jq '.'"

