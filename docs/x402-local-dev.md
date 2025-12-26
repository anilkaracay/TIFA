# x402 Local Development Setup

## Quick Start

### 1. Enable x402 in Backend

Add to `backend/.env`:

```bash
X402_ENABLED=true
X402_CHAIN=base
X402_CURRENCY=USDC
X402_RECIPIENT=0x0000000000000000000000000000000000000000
X402_TTL_SECONDS=300
```

### 2. Enable x402 in Frontend

Add to `frontend/.env.local`:

```bash
NEXT_PUBLIC_X402_ENABLED=true
```

### 3. Run Database Migration

```bash
cd backend
npx prisma migrate dev
```

This will create the `X402PaymentSession` table.

### 4. Start Services

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Testing the Flow

### 1. Create a Payable Invoice

Create an invoice with status `TOKENIZED`, `FINANCED`, or `PARTIALLY_PAID`:

```bash
# Via API or UI
POST /invoices
{
  "externalId": "TEST-INV-001",
  "companyId": "company-1",
  "debtorId": "debtor-1",
  "currency": "USDC",
  "amount": "1000",
  "dueDate": "2024-12-31T00:00:00Z"
}

# Then tokenize it
POST /invoices/{id}/tokenize
```

### 2. Request Payment

```bash
curl -X POST http://localhost:4000/invoices/{invoiceId}/pay
```

Expected response (HTTP 402):
```json
{
  "x402": true,
  "sessionId": "uuid",
  "expiresAt": "2024-01-01T00:05:00Z",
  "payment": {
    "amount": "1000",
    "currency": "USDC",
    "chain": "base",
    "recipient": "0x0000000000000000000000000000000000000000",
    "reference": "invoice:TEST-INV-001"
  },
  "invoice": {
    "invoiceId": "...",
    "status": "TOKENIZED",
    "remainingAmount": "1000"
  }
}
```

### 3. Confirm Payment (Mock Mode)

In mock mode, any valid txHash format is accepted:

```bash
curl -X POST http://localhost:4000/invoices/{invoiceId}/pay/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-from-step-2",
    "txHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
  }'
```

Expected response (HTTP 200):
```json
{
  "message": "Payment confirmed",
  "session": {
    "sessionId": "uuid",
    "status": "CONFIRMED",
    "txHash": "0x..."
  },
  "payment": {
    "id": "...",
    "amount": "1000",
    "currency": "USDC",
    "txHash": "0x..."
  },
  "invoice": {
    "id": "...",
    "status": "PAID",
    "cumulativePaid": "1000"
  }
}
```

## Frontend Testing

1. Navigate to an invoice detail page
2. Look for "Pay with x402" button (only visible if invoice is payable and x402 enabled)
3. Click button → Payment instructions appear
4. Enter any valid txHash (e.g., `0x` + 64 zeros)
5. Click "Confirm Payment"
6. Verify invoice status updates to PAID

## Mock Verifier

In development mode (NODE_ENV !== 'production'), the system uses `MockVerifier` which:
- Validates txHash format (must be `0x` + 64 hex characters)
- Always returns success for valid format
- No actual blockchain verification

This allows testing without chain connection.

## Troubleshooting

### x402 button not showing

- Check `NEXT_PUBLIC_X402_ENABLED=true` in frontend `.env.local`
- Verify invoice status is `TOKENIZED`, `FINANCED`, or `PARTIALLY_PAID`
- Check browser console for errors

### 503 Service Unavailable

- Check `X402_ENABLED=true` in backend `.env`
- Verify `X402_RECIPIENT` is set (can be any valid address for mock mode)

### Database errors

- Run `npx prisma migrate dev` to apply migrations
- Run `npx prisma generate` to regenerate Prisma client

### Rate limit errors

- Wait 60 seconds between requests
- Or restart backend to clear in-memory rate limiter

## Production Setup

For production, you'll need to:

1. Implement `ChainVerifier` in `backend/src/x402/verifier.ts`
2. Set `NODE_ENV=production`
3. Configure actual chain RPC endpoints
4. Set real recipient address
5. Enable proper transaction verification

See `docs/x402-invoice-pay.md` for architecture details.

