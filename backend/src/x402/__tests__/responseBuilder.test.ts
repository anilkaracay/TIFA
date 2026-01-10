/**
 * Unit tests for x402 response builder
 */

import { describe, it, expect } from 'vitest';
import { buildX402Response } from '../responseBuilder';
import { X402Session } from '../sessionStore';

describe('ResponseBuilder', () => {
  it('should build correct x402 response', () => {
    const session: X402Session = {
      id: 'session-id',
      sessionId: 'test-session-uuid',
      invoiceId: 'invoice-id',
      amountRequested: '1000',
      currency: 'USDC',
      chain: 'base',
      recipient: '0x0000000000000000000000000000000000000000',
      status: 'PENDING',
      txHash: null,
      expiresAt: new Date('2024-01-01T00:05:00Z'),
      metadata: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    const invoice = {
      id: 'invoice-id',
      externalId: 'INV-123',
      status: 'TOKENIZED',
      amount: '1000',
      cumulativePaid: '0',
    };

    const response = buildX402Response(session, invoice);

    expect(response.x402).toBe(true);
    expect(response.sessionId).toBe(session.sessionId);
    expect(response.expiresAt).toBe(session.expiresAt.toISOString());
    expect(response.payment.amount).toBe('1000');
    expect(response.payment.currency).toBe('USDC');
    expect(response.payment.chain).toBe('base');
    expect(response.payment.recipient).toBe(session.recipient);
    expect(response.payment.reference).toBe('invoice:INV-123');
    expect(response.invoice.invoiceId).toBe('invoice-id');
    expect(response.invoice.status).toBe('TOKENIZED');
    expect(response.invoice.remainingAmount).toBe('1000');
  });

  it('should calculate remaining amount correctly for PARTIALLY_PAID', () => {
    const session: X402Session = {
      id: 'session-id',
      sessionId: 'test-session-uuid',
      invoiceId: 'invoice-id',
      amountRequested: '500',
      currency: 'USDC',
      chain: 'base',
      recipient: '0x0000000000000000000000000000000000000000',
      status: 'PENDING',
      txHash: null,
      expiresAt: new Date('2024-01-01T00:05:00Z'),
      metadata: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    const invoice = {
      id: 'invoice-id',
      externalId: 'INV-123',
      status: 'PARTIALLY_PAID',
      amount: '1000',
      cumulativePaid: '500',
    };

    const response = buildX402Response(session, invoice);

    expect(response.invoice.remainingAmount).toBe('500');
  });
});






