/**
 * Unit tests for x402 payment verifier
 */

import { describe, it, expect } from 'vitest';
import { MockVerifier, ChainVerifier, PaymentDetails } from '../verifier';

describe('MockVerifier', () => {
  const verifier = new MockVerifier();

  it('should verify valid txHash format', async () => {
    const expected: PaymentDetails = {
      amount: '1000',
      currency: 'USDC',
      chain: 'base',
      recipient: '0x0000000000000000000000000000000000000000',
    };

    const txHash = '0x' + 'a'.repeat(64);
    const result = await verifier.verify(txHash, expected);

    expect(result.success).toBe(true);
    expect(result.verifiedAmount).toBe(expected.amount);
    expect(result.verifiedCurrency).toBe(expected.currency);
    expect(result.verifiedRecipient).toBe(expected.recipient);
  });

  it('should reject invalid txHash format', async () => {
    const expected: PaymentDetails = {
      amount: '1000',
      currency: 'USDC',
      chain: 'base',
      recipient: '0x0000000000000000000000000000000000000000',
    };

    const invalidTxHashes = [
      '0x' + 'a'.repeat(63), // Too short
      '0x' + 'a'.repeat(65), // Too long
      '0x' + 'g'.repeat(64), // Invalid hex
      'not-a-hash',
      '',
    ];

    for (const txHash of invalidTxHashes) {
      const result = await verifier.verify(txHash, expected);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }
  });

  it('should accept any valid format txHash in mock mode', async () => {
    const expected: PaymentDetails = {
      amount: '1000',
      currency: 'USDC',
      chain: 'base',
      recipient: '0x0000000000000000000000000000000000000000',
    };

    const txHash = '0x' + '0'.repeat(64);
    const result = await verifier.verify(txHash, expected);

    expect(result.success).toBe(true);
  });
});

describe('ChainVerifier', () => {
  const verifier = new ChainVerifier();

  it('should throw error indicating not implemented', async () => {
    const expected: PaymentDetails = {
      amount: '1000',
      currency: 'USDC',
      chain: 'base',
      recipient: '0x0000000000000000000000000000000000000000',
    };

    const txHash = '0x' + 'a'.repeat(64);

    await expect(verifier.verify(txHash, expected)).rejects.toThrow(
      'ChainVerifier not yet implemented'
    );
  });
});

