import { X402Session } from './sessionStore';

export interface X402PaymentRequest {
  x402: true;
  sessionId: string;
  expiresAt: string;
  payment: {
    amount: string;
    currency: string;
    chain: string;
    recipient: string;
    reference: string;
  };
  invoice: {
    invoiceId: string;
    status: string;
    remainingAmount: string;
  };
}

export function buildX402Response(session: X402Session, invoice: {
  id: string;
  externalId: string;
  status: string;
  amount: string;
  cumulativePaid: string;
}): X402PaymentRequest {
  const totalAmount = BigInt(invoice.amount);
  const paid = BigInt(invoice.cumulativePaid || '0');
  const remaining = totalAmount - paid;

  return {
    x402: true,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt.toISOString(),
    payment: {
      amount: session.amountRequested,
      currency: session.currency,
      chain: session.chain,
      recipient: session.recipient,
      reference: `invoice:${invoice.externalId}`,
    },
    invoice: {
      invoiceId: invoice.id,
      status: invoice.status,
      remainingAmount: remaining.toString(),
    },
  };
}

