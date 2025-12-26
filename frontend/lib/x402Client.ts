const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

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

export interface X402PaymentConfirmRequest {
  sessionId: string;
  txHash: string;
}

export interface X402PaymentConfirmResponse {
  message: string;
  session: {
    sessionId: string;
    status: string;
    txHash: string;
  };
  payment: {
    id: string;
    amount: string;
    currency: string;
    txHash: string;
  };
  invoice: {
    id: string;
    status: string;
    cumulativePaid: string;
  };
}

/**
 * Request x402 payment for an invoice
 * Returns HTTP 402 with payment details if x402 is enabled and invoice is payable
 * Returns 200 if x402 is disabled or invoice already paid
 */
export async function requestX402Payment(invoiceId: string): Promise<X402PaymentRequest | { message: string; invoice?: any }> {
  const response = await fetch(`${BACKEND_URL}/invoices/${invoiceId}/pay`, {
    method: 'POST',
    headers: {},
  });

  const data = await response.json();

  if (response.status === 402) {
    return data as X402PaymentRequest;
  }

  if (response.ok) {
    return data as { message: string; invoice?: any };
  }

  throw new Error(data.error || data.message || 'Failed to request x402 payment');
}

/**
 * Confirm x402 payment with transaction hash
 */
export async function confirmX402Payment(
  invoiceId: string,
  request: X402PaymentConfirmRequest
): Promise<X402PaymentConfirmResponse> {
  const response = await fetch(`${BACKEND_URL}/invoices/${invoiceId}/pay/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to confirm x402 payment');
  }

  return data as X402PaymentConfirmResponse;
}

export interface X402Session {
  sessionId: string;
  invoiceId: string;
  amountRequested: string;
  currency: string;
  chain: string;
  recipient: string;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  metadata: any;
}

export interface X402PaymentHistoryItem {
  sessionId: string;
  invoiceId: string;
  amountRequested: string;
  currency: string;
  chain: string;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
  txHash: string | null;
  executionMode?: 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null;
  authorizationId?: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface X402Stats {
  totalPayments: number;
  confirmedPayments: number;
  activeSessions: number;
  totalVolume: string;
}

/**
 * Fetch active x402 payment sessions
 */
export async function fetchX402Sessions(): Promise<X402Session[]> {
  const response = await fetch(`${BACKEND_URL}/x402/sessions`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch x402 sessions');
  }

  return response.json();
}

/**
 * Fetch x402 payment history
 */
export async function fetchX402History(limit?: number): Promise<X402PaymentHistoryItem[]> {
  const url = new URL(`${BACKEND_URL}/x402/history`);
  if (limit) {
    url.searchParams.set('limit', limit.toString());
  }

  const response = await fetch(url.toString(), {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch x402 history');
  }

  return response.json();
}

/**
 * Fetch x402 statistics
 */
export async function fetchX402Stats(): Promise<X402Stats> {
  const response = await fetch(`${BACKEND_URL}/x402/stats`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch x402 stats');
  }

  return response.json();
}

