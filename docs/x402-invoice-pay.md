# x402 Invoice Payment Protocol

## Overview

The x402 payment protocol provides an optional payment path for buyers to pay invoices directly via blockchain transactions. This feature is implemented as an additive, feature-flagged module that integrates seamlessly with existing payment flows without breaking changes.

## Architecture

### Flow Diagram

```
Buyer → Frontend → Backend → x402 Module → Payment Verifier → Existing Payment Flow
```

1. Buyer clicks "Pay with x402" button
2. Frontend calls `POST /invoices/:invoiceId/pay`
3. Backend checks if invoice is payable and x402 is enabled
4. If enabled, creates a payment session and returns HTTP 402 with payment details
5. Buyer sends payment transaction on blockchain
6. Buyer enters transaction hash in frontend
7. Frontend calls `POST /invoices/:invoiceId/pay/confirm`
8. Backend verifies transaction via PaymentVerifier
9. On success, calls existing payment confirmation logic
10. Invoice status updated, WebSocket events emitted

## Endpoints

### POST `/invoices/:invoiceId/pay`

Request payment details for an invoice via x402.

**Response Codes:**
- `402 Payment Required`: x402 is enabled and invoice is payable. Returns payment request payload.
- `200 OK`: x402 is disabled or invoice already paid. Returns status message.
- `400 Bad Request`: Invoice is not payable (wrong status).
- `404 Not Found`: Invoice not found.
- `429 Too Many Requests`: Rate limit exceeded.

**Response Body (402):**
```json
{
  "x402": true,
  "sessionId": "uuid",
  "expiresAt": "ISO 8601 timestamp",
  "payment": {
    "amount": "string",
    "currency": "USDC",
    "chain": "base",
    "recipient": "0x...",
    "reference": "invoice:INV-123"
  },
  "invoice": {
    "invoiceId": "string",
    "status": "TOKENIZED|FINANCED|PARTIALLY_PAID",
    "remainingAmount": "string"
  }
}
```

### POST `/invoices/:invoiceId/pay/confirm`

Confirm payment with transaction hash.

**Request Body:**
```json
{
  "sessionId": "uuid",
  "txHash": "0x..."
}
```

**Response Codes:**
- `200 OK`: Payment confirmed successfully.
- `400 Bad Request`: Invalid request body or verification failed.
- `404 Not Found`: Session not found.
- `409 Conflict`: Transaction already processed (idempotent response).
- `410 Gone`: Session expired.
- `503 Service Unavailable`: x402 is disabled.

**Response Body (200):**
```json
{
  "message": "Payment confirmed",
  "session": {
    "sessionId": "uuid",
    "status": "CONFIRMED",
    "txHash": "0x..."
  },
  "payment": {
    "id": "string",
    "amount": "string",
    "currency": "string",
    "txHash": "0x..."
  },
  "invoice": {
    "id": "string",
    "status": "PARTIALLY_PAID|PAID",
    "cumulativePaid": "string"
  }
}
```

## Session Lifecycle

1. **PENDING**: Session created, waiting for payment confirmation
2. **CONFIRMED**: Payment verified and confirmed
3. **EXPIRED**: Session expired (TTL exceeded)

Sessions automatically expire after `X402_TTL_SECONDS` (default: 300 seconds). Expired sessions are cleaned up by the reconciliation job running every 60 seconds.

## Idempotency

The system ensures idempotency through:

1. **Unique txHash constraint**: Each transaction hash can only be processed once across all sessions
2. **Session status check**: Confirmed sessions cannot be confirmed again
3. **Idempotent responses**: If a txHash is already processed, the endpoint returns the same result without error

If a buyer submits the same txHash twice:
- First request: Processes payment and confirms session
- Second request: Returns the same confirmation result (idempotent)

## Integration with Existing Payment Flow

The x402 confirmation reuses the existing payment confirmation logic:

1. Calculates new `cumulativePaid` amount
2. Updates invoice status (PARTIALLY_PAID or PAID)
3. Creates `InvoicePayment` record
4. Updates on-chain status via `InvoiceRegistry.setStatus()` if applicable
5. Emits WebSocket events (`invoice.payment_recorded`, `pool.utilization_changed`)

This ensures consistency with existing payment flows without code duplication.

## Business Rules

### Payable Statuses

Invoices are payable via x402 if status is:
- `TOKENIZED`: Invoice has been tokenized on-chain
- `FINANCED`: Invoice has been financed (pool repayment handled automatically)
- `PARTIALLY_PAID`: Invoice has partial payment, remaining amount can be paid

### Amount Calculation

- For `PARTIALLY_PAID`: `amountRequested = totalAmount - cumulativePaid`
- For `TOKENIZED` or `FINANCED`: `amountRequested = totalAmount`

### Settlement

If invoice is `FINANCED`, the existing settlement logic automatically handles pool repayment. The x402 module does not re-implement this logic; it calls the existing payment confirmation flow.

## Security

### Rate Limiting

- 5 requests per minute per invoiceId
- In-memory rate limiter (resets every 60 seconds)
- Returns `429 Too Many Requests` if exceeded

### Transaction Verification

- **MockVerifier**: For development/testing, validates txHash format only
- **ChainVerifier**: Placeholder for production (TODO: implement actual chain verification)

### Session Security

- Sessions expire after TTL
- Each session can only be confirmed once
- txHash must be unique across all sessions (prevents replay attacks)

## Configuration

### Environment Variables

```bash
# Enable/disable x402 payment
X402_ENABLED=true

# Chain configuration
X402_CHAIN=base

# Currency/token
X402_CURRENCY=USDC

# Payment recipient address
X402_RECIPIENT=0x...

# Session TTL in seconds (default: 300)
X402_TTL_SECONDS=300
```

### Frontend Feature Flag

```bash
NEXT_PUBLIC_X402_ENABLED=true
```

## Database Schema

### X402PaymentSession

```prisma
model X402PaymentSession {
  id              String   @id @default(cuid())
  invoiceId       String
  invoice         Invoice  @relation(...)
  sessionId       String   @unique // UUID
  amountRequested String
  currency        String
  chain           String
  recipient       String
  status          String   // PENDING, CONFIRMED, EXPIRED
  txHash          String?  @unique
  expiresAt       DateTime
  metadata        String?  // JSON
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## Logging

All operations are logged with correlation IDs:
- Session creation: `[x402:{sessionId}] Created payment session`
- Transaction verification: `[x402:{sessionId}] Verifying transaction`
- Session confirmation: `[x402:{sessionId}] Session confirmed`

## Error Handling

Structured error codes:
- `X402_DISABLED`: x402 is disabled
- `INVOICE_NOT_PAYABLE`: Invoice status not payable
- `SESSION_NOT_FOUND`: Session does not exist
- `SESSION_EXPIRED`: Session expired
- `TX_VERIFICATION_FAILED`: Transaction verification failed
- `TX_ALREADY_PROCESSED`: Transaction already processed (idempotent)

## Local Development

### Mock Mode

For local development without chain connection:

1. Set `X402_ENABLED=true`
2. Set `X402_RECIPIENT=0x0000000000000000000000000000000000000000` (or any valid address)
3. Use MockVerifier (default in non-production)
4. Any valid txHash format (`0x` + 64 hex chars) will be accepted

### Testing Flow

1. Create an invoice with status `TOKENIZED`, `FINANCED`, or `PARTIALLY_PAID`
2. Call `POST /invoices/:id/pay` → Should return 402 with payment details
3. Use a mock txHash: `0x0000000000000000000000000000000000000000000000000000000000000000`
4. Call `POST /invoices/:id/pay/confirm` with sessionId and txHash
5. Verify invoice status updated and payment recorded

## Future Enhancements

- [ ] Implement ChainVerifier for production use
- [ ] Add support for partial payments
- [ ] Add payment memo/note support
- [ ] Add multi-chain support
- [ ] Add payment status polling
- [ ] Add payment history tracking

