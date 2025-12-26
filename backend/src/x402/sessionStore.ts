import { prisma } from '../db';
import { x402Config } from './config';
import { X402Error, X402ErrorCode } from './errors';
import { randomUUID } from 'crypto';

export interface X402SessionData {
  invoiceId: string;
  amountRequested: string;
  currency: string;
  chain: string;
  recipient: string;
  metadata?: Record<string, any>;
  executionMode?: 'USER_INITIATED' | 'AGENT_AUTHORIZED';
  authorizationId?: string;
}

export interface X402Session {
  id: string;
  sessionId: string;
  invoiceId: string;
  amountRequested: string;
  currency: string;
  chain: string;
  recipient: string;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
  txHash: string | null;
  expiresAt: Date;
  metadata: string | null;
  executionMode?: 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null;
  authorizationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createSession(data: X402SessionData): Promise<X402Session> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + x402Config.ttlSeconds * 1000);

  const session = await prisma.x402PaymentSession.create({
    data: {
      sessionId,
      invoiceId: data.invoiceId,
      amountRequested: data.amountRequested,
      currency: data.currency,
      chain: data.chain,
      recipient: data.recipient,
      status: 'PENDING',
      expiresAt,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      executionMode: data.executionMode || 'USER_INITIATED',
      authorizationId: data.authorizationId || null,
    },
  });

  return {
    id: session.id,
    sessionId: session.sessionId,
    invoiceId: session.invoiceId,
    amountRequested: session.amountRequested,
    currency: session.currency,
    chain: session.chain,
    recipient: session.recipient,
    status: session.status as 'PENDING' | 'CONFIRMED' | 'EXPIRED',
    txHash: session.txHash,
    expiresAt: session.expiresAt,
    metadata: session.metadata,
    executionMode: session.executionMode as 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null,
    authorizationId: session.authorizationId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function findSessionBySessionId(sessionId: string): Promise<X402Session | null> {
  const session = await prisma.x402PaymentSession.findUnique({
    where: { sessionId },
  });

  if (!session) return null;

  return {
    id: session.id,
    sessionId: session.sessionId,
    invoiceId: session.invoiceId,
    amountRequested: session.amountRequested,
    currency: session.currency,
    chain: session.chain,
    recipient: session.recipient,
    status: session.status as 'PENDING' | 'CONFIRMED' | 'EXPIRED',
    txHash: session.txHash,
    expiresAt: session.expiresAt,
    metadata: session.metadata,
    executionMode: session.executionMode as 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null,
    authorizationId: session.authorizationId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function findSessionByInvoiceId(invoiceId: string): Promise<X402Session | null> {
  const session = await prisma.x402PaymentSession.findFirst({
    where: {
      invoiceId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) return null;

  return {
    id: session.id,
    sessionId: session.sessionId,
    invoiceId: session.invoiceId,
    amountRequested: session.amountRequested,
    currency: session.currency,
    chain: session.chain,
    recipient: session.recipient,
    status: session.status as 'PENDING' | 'CONFIRMED' | 'EXPIRED',
    txHash: session.txHash,
    expiresAt: session.expiresAt,
    metadata: session.metadata,
    executionMode: session.executionMode as 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null,
    authorizationId: session.authorizationId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function findSessionByTxHash(txHash: string): Promise<X402Session | null> {
  const session = await prisma.x402PaymentSession.findUnique({
    where: { txHash },
  });

  if (!session) return null;

  return {
    id: session.id,
    sessionId: session.sessionId,
    invoiceId: session.invoiceId,
    amountRequested: session.amountRequested,
    currency: session.currency,
    chain: session.chain,
    recipient: session.recipient,
    status: session.status as 'PENDING' | 'CONFIRMED' | 'EXPIRED',
    txHash: session.txHash,
    expiresAt: session.expiresAt,
    metadata: session.metadata,
    executionMode: session.executionMode as 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null,
    authorizationId: session.authorizationId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function confirmSession(sessionId: string, txHash: string): Promise<X402Session> {
  const session = await findSessionBySessionId(sessionId);
  if (!session) {
    throw new X402Error(X402ErrorCode.SESSION_NOT_FOUND, 'Payment session not found', 404);
  }

  if (session.status === 'CONFIRMED') {
    throw new X402Error(X402ErrorCode.SESSION_ALREADY_CONFIRMED, 'Payment session already confirmed', 409);
  }

  if (session.expiresAt < new Date()) {
    throw new X402Error(X402ErrorCode.SESSION_EXPIRED, 'Payment session has expired', 410);
  }

  // Check if txHash already exists (idempotency)
  const existingSession = await findSessionByTxHash(txHash);
  if (existingSession && existingSession.sessionId !== sessionId) {
    throw new X402Error(X402ErrorCode.TX_ALREADY_PROCESSED, 'Transaction already processed', 409);
  }

  const updated = await prisma.x402PaymentSession.update({
    where: { sessionId },
    data: {
      status: 'CONFIRMED',
      txHash,
    },
  });

  return {
    id: updated.id,
    sessionId: updated.sessionId,
    invoiceId: updated.invoiceId,
    amountRequested: updated.amountRequested,
    currency: updated.currency,
    chain: updated.chain,
    recipient: updated.recipient,
    status: updated.status as 'PENDING' | 'CONFIRMED' | 'EXPIRED',
    txHash: updated.txHash,
    expiresAt: updated.expiresAt,
    metadata: updated.metadata,
    executionMode: updated.executionMode as 'USER_INITIATED' | 'AGENT_AUTHORIZED' | null,
    authorizationId: updated.authorizationId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function expireSessions(): Promise<number> {
  const result = await prisma.x402PaymentSession.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}

