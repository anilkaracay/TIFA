# Agent-Authorized Payments

## Overview

Agent-Authorized Payments is a Phase 2 upgrade to the x402 payment system that allows users to optionally authorize the Finance Agent to fully execute invoice payments on their behalf — end-to-end — under explicit constraints.

This feature is **fully optional** and **100% backward-compatible** with the existing user-initiated x402 payment flow.

## Key Concepts

### Two Payment Execution Modes

1. **USER_INITIATED** (default)
   - User selects invoice
   - User sends payment transaction
   - User confirms payment with transaction hash
   - Agent verifies & settles

2. **AGENT_AUTHORIZED** (new)
   - User pre-approves rules & limits
   - Agent automatically selects eligible invoices
   - Agent generates x402 payment request
   - Agent executes payment via controlled wallet
   - Agent confirms & settles automatically
   - User receives notifications & audit logs

### Core Principle

The core payment logic remains the same. Only the **EXECUTION TRIGGER** changes:
- Same x402 session creation
- Same payment verification
- Same settlement logic
- Same invoice status updates

## Architecture

### Backend Components

#### 1. Payment Authorization Module (`/backend/src/payment-authorization`)

**AuthorizationEngine** (`authorizationEngine.ts`)
- Validates user consent
- Enforces limits & rules
- Decides whether agent may execute payment
- Produces full audit trail

**Key Methods:**
- `checkAuthorization()`: Validates if agent can execute payment for an invoice
- `getActiveAuthorization()`: Retrieves active authorization for a company
- `logAudit()`: Records audit log entries

#### 2. Data Models

**payment_authorizations**
- Stores user consent and rules
- Fields: `companyId`, `mode`, `maxAmountPerInvoice`, `dailyLimit`, `monthlyLimit`, `allowedCurrencies`, `allowedChains`, `allowedInvoiceStatuses`, `autoApproveFinancedInvoices`, `autoApproveTokenizedInvoices`, `active`, `revokedAt`

**agent_payment_executions**
- Records all agent payment attempts
- Fields: `authorizationId`, `invoiceId`, `sessionId`, `amount`, `currency`, `chain`, `txHash`, `executionStatus` (EXECUTED | FAILED | BLOCKED), `reason`

**authorization_audit_log**
- Full audit trail of authorization changes
- Fields: `authorizationId`, `action` (CREATED | UPDATED | REVOKED | EXECUTED | BLOCKED), `actor` (USER | AGENT | SYSTEM), `metadata`

#### 3. AutoPaymentAgent Job (`/backend/src/jobs/autoPaymentAgent.ts`)

**Responsibilities:**
- Scans open invoices periodically (every 60 seconds)
- Checks authorization for each invoice
- Executes payments when authorized
- Records execution results

**Flow:**
1. Find companies with active agent authorizations
2. For each company:
   - Find eligible invoices (matching allowed statuses)
   - For each invoice:
     - Call `AuthorizationEngine.checkAuthorization()`
     - If ALLOW: Create x402 session → Execute payment → Confirm → Settle
     - If DENY: Log blocked execution with reason

**Security:**
- Agent NEVER bypasses authorization checks
- All executions are recorded
- All transactions are attributable to companyId, authorizationId, invoiceId

#### 4. Backend Routes (`/backend/src/routes/payment-authorization.ts`)

**Endpoints:**
- `GET /payment-authorization/:companyId` - Get active authorization
- `POST /payment-authorization` - Create new authorization
- `PATCH /payment-authorization/:id` - Update authorization
- `POST /payment-authorization/:id/revoke` - Revoke authorization
- `GET /payment-authorization/:id/executions` - Get execution history
- `GET /payment-authorization/:id/audit` - Get audit log

### Frontend Components

#### 1. AgentAuthorizationPanel (`/frontend/components/x402/AgentAuthorizationPanel.tsx`)

**Features:**
- Toggle to enable/disable agent authorization
- Configuration form:
  - Limits: Max amount per invoice, daily limit, monthly limit
  - Scope: Allowed invoice statuses (FINANCED, TOKENIZED)
  - Allowed currencies and chains
- Preview of current rules
- Save/Revoke actions

#### 2. Updated Payment History

Payment history now shows execution mode:
- "Agent" badge for agent-executed payments
- User-initiated payments remain unchanged

## Security Model

### Authorization Checks

Before ANY agent-executed payment, the system checks:

1. **Authorization Exists**: Active authorization for company
2. **Invoice Status**: Invoice status must be in allowed list
3. **Currency**: Must match allowed currencies
4. **Chain**: Must match allowed chains
5. **Per-Invoice Limit**: Amount must not exceed `maxAmountPerInvoice`
6. **Daily Limit**: Today's spend + requested amount must not exceed `dailyLimit`
7. **Monthly Limit**: Month's spend + requested amount must not exceed `monthlyLimit`

### Wallet & Execution

- Agent uses a dedicated "Execution Wallet"
- Wallet limits are enforced BOTH:
  - Off-chain (AuthorizationEngine)
  - On-chain (vault / allowance)
- All transactions are attributable to:
  - `companyId`
  - `authorizationId`
  - `invoiceId`

## User Experience

### Enabling Agent Authorization

1. User navigates to x402 Payments page
2. Sees "Agent-Authorized Payments" panel
3. Toggles switch to ON
4. Configures limits and scope
5. Reviews preview
6. Confirms activation

### When Agent Executes Payments

- Invoice rows show "Executed by Agent" indicator
- Payment History entries show "Execution Mode: Agent-Authorized"
- User receives notifications (via WebSocket)
- Full audit trail available

### Revocation

User can:
- Turn toggle OFF at any time
- See execution history
- See blocked attempts & reasons
- Immediately revoke authorization (sets `active=false`)

**Revocation Behavior:**
- Stops all future executions immediately
- Does NOT affect already settled invoices
- All historical data remains accessible

## Integration Points

### Existing x402 Flow

The agent-authorized flow integrates seamlessly:

1. **Session Creation**: Same `createSession()` function, with `executionMode: 'AGENT_AUTHORIZED'`
2. **Payment Verification**: Same `getVerifier().verify()` logic
3. **Settlement**: Same `confirmPaymentInternal()` function
4. **Invoice Updates**: Same status update logic

### Backward Compatibility

- If toggle is OFF → existing behavior stays EXACTLY the same
- If toggle is ON → agent executes automatically
- User-initiated payments always work regardless of toggle state
- No breaking changes to existing APIs

## Testing

### Unit Tests

- AuthorizationEngine rules
- Limit enforcement
- Status/currency/chain validation

### Integration Tests

- Agent auto-payment happy path
- Limit breach → blocked execution
- Toggle OFF → no agent execution
- User-initiated payments still work

### Regression Tests

- User-initiated payments work exactly as before
- Existing x402 endpoints unchanged
- No impact on invoice status management

## Configuration

### Environment Variables

No new environment variables required. Uses existing x402 configuration:
- `X402_ENABLED`: Must be true for agent payments
- `X402_CHAIN`: Chain for agent payments
- `X402_CURRENCY`: Currency for agent payments
- `X402_RECIPIENT`: Recipient address for agent payments

### Authorization Limits

Configured per-company via UI:
- Max amount per invoice (in cents)
- Daily spending limit (in cents)
- Monthly spending limit (in cents)
- Allowed invoice statuses
- Allowed currencies
- Allowed chains

## Audit & Compliance

### Audit Trail

Every action is logged:
- Authorization created/updated/revoked
- Payment execution attempted
- Payment execution succeeded/failed/blocked
- Reason for blocking

### Compliance Notes

- Full audit trail for regulatory compliance
- User consent explicitly recorded
- Limits enforced programmatically
- Reversible at any time
- No retroactive changes to settled invoices

## Rollback Behavior

If authorization is revoked:
1. `active` flag set to `false`
2. `revokedAt` timestamp recorded
3. Future executions blocked immediately
4. Already-executed payments remain valid
5. Historical data preserved

## Future Enhancements

Potential improvements:
- Multi-signature authorization
- Time-based rules (e.g., only execute on due date)
- Risk-based filtering
- Notification preferences
- Execution scheduling
- Partial payment support

## Documentation

- Architecture: This document
- API: See `/docs/x402-invoice-pay.md`
- Local Dev: See `/docs/x402-local-dev.md`

