/**
 * Unit tests for x402 session store
 * 
 * To run these tests, install a test framework (e.g., Jest, Vitest) and configure it.
 * Example with Vitest:
 *   npm install -D vitest @vitest/ui
 *   Add to package.json: "test": "vitest"
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, findSessionBySessionId, confirmSession, expireSessions, X402SessionData } from '../sessionStore';
import { prisma } from '../../db';
import { X402ErrorCode } from '../errors';

// Mock Prisma if needed, or use test database
// For now, these are example tests that show the expected behavior

describe('SessionStore', () => {
  beforeEach(async () => {
    // Clean up test data
    // await prisma.x402PaymentSession.deleteMany({});
  });

  describe('createSession', () => {
    it('should create a new session with correct TTL', async () => {
      const data: X402SessionData = {
        invoiceId: 'test-invoice-id',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const session = await createSession(data);

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(session.status).toBe('PENDING');
      expect(session.invoiceId).toBe(data.invoiceId);
      expect(session.amountRequested).toBe(data.amountRequested);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set expiresAt based on TTL', async () => {
      const data: X402SessionData = {
        invoiceId: 'test-invoice-id',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const session = await createSession(data);
      const expectedExpiry = Date.now() + 300 * 1000; // Default TTL is 300 seconds
      const actualExpiry = session.expiresAt.getTime();

      // Allow 1 second tolerance
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe('findSessionBySessionId', () => {
    it('should find session by sessionId', async () => {
      const data: X402SessionData = {
        invoiceId: 'test-invoice-id',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const created = await createSession(data);
      const found = await findSessionBySessionId(created.sessionId);

      expect(found).toBeDefined();
      expect(found?.sessionId).toBe(created.sessionId);
    });

    it('should return null for non-existent sessionId', async () => {
      const found = await findSessionBySessionId('non-existent-uuid');
      expect(found).toBeNull();
    });
  });

  describe('confirmSession', () => {
    it('should confirm session with valid txHash', async () => {
      const data: X402SessionData = {
        invoiceId: 'test-invoice-id',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const session = await createSession(data);
      const txHash = '0x' + '0'.repeat(64);

      const confirmed = await confirmSession(session.sessionId, txHash);

      expect(confirmed.status).toBe('CONFIRMED');
      expect(confirmed.txHash).toBe(txHash);
    });

    it('should throw error if session not found', async () => {
      await expect(
        confirmSession('non-existent-uuid', '0x' + '0'.repeat(64))
      ).rejects.toThrow();
    });

    it('should throw error if session already confirmed', async () => {
      const data: X402SessionData = {
        invoiceId: 'test-invoice-id',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const session = await createSession(data);
      const txHash = '0x' + '0'.repeat(64);

      await confirmSession(session.sessionId, txHash);

      await expect(
        confirmSession(session.sessionId, '0x' + '1'.repeat(64))
      ).rejects.toThrow();
    });

    it('should prevent duplicate txHash across sessions', async () => {
      const data1: X402SessionData = {
        invoiceId: 'test-invoice-id-1',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const data2: X402SessionData = {
        invoiceId: 'test-invoice-id-2',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const session1 = await createSession(data1);
      const session2 = await createSession(data2);
      const txHash = '0x' + '0'.repeat(64);

      await confirmSession(session1.sessionId, txHash);

      await expect(
        confirmSession(session2.sessionId, txHash)
      ).rejects.toThrow();
    });
  });

  describe('expireSessions', () => {
    it('should expire sessions past TTL', async () => {
      // Create a session and manually set expiresAt to past
      const data: X402SessionData = {
        invoiceId: 'test-invoice-id',
        amountRequested: '1000',
        currency: 'USDC',
        chain: 'base',
        recipient: '0x0000000000000000000000000000000000000000',
      };

      const session = await createSession(data);

      // Manually expire it
      await prisma.x402PaymentSession.update({
        where: { sessionId: session.sessionId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const expiredCount = await expireSessions();
      expect(expiredCount).toBeGreaterThan(0);

      const updated = await findSessionBySessionId(session.sessionId);
      expect(updated?.status).toBe('EXPIRED');
    });
  });
});

