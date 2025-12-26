export enum X402ErrorCode {
  X402_DISABLED = 'X402_DISABLED',
  INVOICE_NOT_PAYABLE = 'INVOICE_NOT_PAYABLE',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_ALREADY_CONFIRMED = 'SESSION_ALREADY_CONFIRMED',
  INVALID_TX_HASH = 'INVALID_TX_HASH',
  TX_VERIFICATION_FAILED = 'TX_VERIFICATION_FAILED',
  TX_ALREADY_PROCESSED = 'TX_ALREADY_PROCESSED',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  RECIPIENT_MISMATCH = 'RECIPIENT_MISMATCH',
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export class X402Error extends Error {
  constructor(
    public code: X402ErrorCode,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'X402Error';
  }
}

export function createX402Error(code: X402ErrorCode, message?: string): X402Error {
  const messages: Record<X402ErrorCode, { message: string; statusCode: number }> = {
    [X402ErrorCode.X402_DISABLED]: { message: 'x402 payment is disabled', statusCode: 503 },
    [X402ErrorCode.INVOICE_NOT_PAYABLE]: { message: 'Invoice is not payable via x402', statusCode: 400 },
    [X402ErrorCode.INVOICE_NOT_FOUND]: { message: 'Invoice not found', statusCode: 404 },
    [X402ErrorCode.SESSION_NOT_FOUND]: { message: 'Payment session not found', statusCode: 404 },
    [X402ErrorCode.SESSION_EXPIRED]: { message: 'Payment session has expired', statusCode: 410 },
    [X402ErrorCode.SESSION_ALREADY_CONFIRMED]: { message: 'Payment session already confirmed', statusCode: 409 },
    [X402ErrorCode.INVALID_TX_HASH]: { message: 'Invalid transaction hash', statusCode: 400 },
    [X402ErrorCode.TX_VERIFICATION_FAILED]: { message: 'Transaction verification failed', statusCode: 400 },
    [X402ErrorCode.TX_ALREADY_PROCESSED]: { message: 'Transaction already processed', statusCode: 409 },
    [X402ErrorCode.AMOUNT_MISMATCH]: { message: 'Payment amount does not match expected amount', statusCode: 400 },
    [X402ErrorCode.RECIPIENT_MISMATCH]: { message: 'Payment recipient does not match expected recipient', statusCode: 400 },
    [X402ErrorCode.CURRENCY_MISMATCH]: { message: 'Payment currency does not match expected currency', statusCode: 400 },
    [X402ErrorCode.RATE_LIMIT_EXCEEDED]: { message: 'Rate limit exceeded', statusCode: 429 },
  };

  const defaultMessage = messages[code];
  return new X402Error(code, message || defaultMessage.message, defaultMessage.statusCode);
}

