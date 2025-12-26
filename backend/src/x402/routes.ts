import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { x402Config } from './config';
import { X402Error, X402ErrorCode } from './errors';
import { createSession, findSessionBySessionId, findSessionByTxHash, confirmSession, X402Session } from './sessionStore';
import { buildX402Response } from './responseBuilder';
import { getVerifier, PaymentDetails } from './verifier';
import { emitInvoiceEvent, emitPoolEvent } from '../websocket/server';
import { loadContract } from '../onchain/provider';

const STATUS_MAP: Record<string, number> = {
    NONE: 0,
    ISSUED: 1,
    TOKENIZED: 2,
    FINANCED: 3,
    PARTIALLY_PAID: 4,
    PAID: 5,
    DEFAULTED: 6
};

// Rate limiting: simple in-memory store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute per invoiceId

function checkRateLimit(invoiceId: string): void {
    const now = Date.now();
    const key = `x402:${invoiceId}`;
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return;
    }

    if (record.count >= RATE_LIMIT_MAX) {
        throw createX402Error(X402ErrorCode.RATE_LIMIT_EXCEEDED);
    }

    record.count++;
}

function isInvoicePayable(status: string): boolean {
    return ['TOKENIZED', 'FINANCED', 'PARTIALLY_PAID'].includes(status);
}

function calculatePaymentAmount(invoice: { amount: string; cumulativePaid: string; status: string }): string {
    const totalAmount = BigInt(invoice.amount);
    const paid = BigInt(invoice.cumulativePaid || '0');
    
    if (invoice.status === 'PARTIALLY_PAID') {
        return (totalAmount - paid).toString();
    }
    
    return totalAmount.toString();
}

/**
 * Internal function to confirm payment - reused by both x402 and existing payment flow
 * Exported for use by AutoPaymentAgent
 */
export async function confirmPaymentInternal(
    invoiceId: string,
    amount: string,
    currency: string,
    txHash: string | null,
    correlationId?: string
): Promise<{ payment: any; invoice: any }> {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
        throw createX402Error(X402ErrorCode.INVOICE_NOT_FOUND);
    }

    const oldPaid = BigInt(invoice.cumulativePaid);
    const paymentAmt = BigInt(amount);
    const newPaid = oldPaid + paymentAmt;
    const totalAmt = BigInt(invoice.amount);

    let newStatus = invoice.status;
    if (newPaid >= totalAmt) {
        newStatus = 'PAID';
    } else if (newPaid > BigInt(0) && newStatus !== 'PAID') {
        newStatus = 'PARTIALLY_PAID';
    }

    // Update on-chain status if applicable
    if (newStatus !== invoice.status && invoice.invoiceIdOnChain) {
        const InvoiceRegistry = loadContract("InvoiceRegistry");
        const statusEnum = STATUS_MAP[newStatus];
        if (statusEnum) {
            InvoiceRegistry.setStatus(invoice.invoiceIdOnChain, statusEnum)
                .then((tx: any) => tx.wait())
                .catch((e: any) => console.error(`[x402:${correlationId}] Payment status update failed`, e));
        }
    }

    const [payment, updatedInvoice] = await prisma.$transaction([
        prisma.invoicePayment.create({
            data: {
                invoiceId,
                amount,
                currency,
                paidAt: new Date(),
                psp: 'x402',
                txHash,
            }
        }),
        prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                cumulativePaid: newPaid.toString(),
                status: newStatus
            }
        })
    ]);

    // Emit WebSocket event
    emitInvoiceEvent(invoiceId, {
        type: 'invoice.payment_recorded',
        payload: {
            invoiceId,
            externalId: invoice.externalId,
            paymentAmount: amount,
            cumulativePaid: newPaid.toString(),
            status: newStatus,
            correlationId,
        },
    });

    if (newStatus === 'PAID') {
        emitPoolEvent({
            type: 'pool.utilization_changed',
            payload: {},
        });
    }

    return { payment, invoice: updatedInvoice };
}

const PayConfirmSchema = z.object({
    sessionId: z.string().uuid(),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
});

export async function registerX402Routes(app: FastifyInstance) {
    // POST /invoices/:invoiceId/pay
    app.post('/:invoiceId/pay', async (req, reply) => {
        const { invoiceId } = req.params as { invoiceId: string };
        const correlationId = `pay-${Date.now()}`;

        try {
            // Check if x402 is enabled
            if (!x402Config.enabled) {
                return reply.code(200).send({
                    message: 'x402 payment is disabled',
                    invoiceId,
                });
            }

            // Rate limiting
            checkRateLimit(invoiceId);

            // Find invoice
            const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
            if (!invoice) {
                return reply.code(404).send({ error: 'Invoice not found' });
            }

            // Check if invoice is payable
            if (!isInvoicePayable(invoice.status)) {
                return reply.code(400).send({
                    error: 'Invoice is not payable via x402',
                    invoiceId,
                    status: invoice.status,
                });
            }

            // Check if already paid
            if (invoice.status === 'PAID') {
                return reply.code(200).send({
                    message: 'Invoice already paid',
                    invoice: {
                        id: invoice.id,
                        status: invoice.status,
                        cumulativePaid: invoice.cumulativePaid,
                    },
                });
            }

            // Calculate payment amount
            const amountRequested = calculatePaymentAmount(invoice);

            // Create session (always USER_INITIATED for manual payments)
            const session = await createSession({
                invoiceId,
                amountRequested,
                currency: x402Config.currency,
                chain: x402Config.chain,
                recipient: x402Config.recipient,
                metadata: {
                    correlationId,
                    invoiceExternalId: invoice.externalId,
                },
                executionMode: 'USER_INITIATED',
            });

            console.log(`[x402:${session.sessionId}] Created payment session for invoice ${invoiceId}`);

            // Build and return 402 response
            const response = buildX402Response(session, {
                id: invoice.id,
                externalId: invoice.externalId,
                status: invoice.status,
                amount: invoice.amount,
                cumulativePaid: invoice.cumulativePaid,
            });

            return reply.code(402).send(response);
        } catch (error: any) {
            if (error instanceof X402Error) {
                return reply.code(error.statusCode).send({
                    error: error.code,
                    message: error.message,
                    correlationId,
                });
            }
            console.error(`[x402:${correlationId}] Error in /pay:`, error);
            return reply.code(500).send({
                error: 'Internal server error',
                message: error.message,
                correlationId,
            });
        }
    });

    // POST /invoices/:invoiceId/pay/confirm
    app.post('/:invoiceId/pay/confirm', async (req, reply) => {
        const { invoiceId } = req.params as { invoiceId: string };
        const correlationId = `confirm-${Date.now()}`;

        try {
            // Validate request body
            const body = PayConfirmSchema.parse(req.body);
            const { sessionId, txHash } = body;

            // Check if x402 is enabled
            if (!x402Config.enabled) {
                return reply.code(503).send({
                    error: 'x402 payment is disabled',
                });
            }

            // Find session
            const session = await findSessionBySessionId(sessionId);
            if (!session) {
                return reply.code(404).send({
                    error: 'Payment session not found',
                    sessionId,
                });
            }

            // Verify session belongs to invoice
            if (session.invoiceId !== invoiceId) {
                return reply.code(400).send({
                    error: 'Session does not belong to this invoice',
                    sessionId,
                    invoiceId,
                });
            }

            // Check idempotency: if txHash already processed
            const existingSession = await findSessionByTxHash(txHash);
            if (existingSession) {
                // Return the same result (idempotent)
                const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
                if (!invoice) {
                    return reply.code(404).send({ error: 'Invoice not found' });
                }

                return reply.code(200).send({
                    message: 'Payment already confirmed',
                    session: {
                        sessionId: existingSession.sessionId,
                        status: existingSession.status,
                        txHash: existingSession.txHash,
                    },
                    invoice: {
                        id: invoice.id,
                        status: invoice.status,
                        cumulativePaid: invoice.cumulativePaid,
                    },
                });
            }

            // Verify transaction
            const verifier = getVerifier();
            const expectedPayment: PaymentDetails = {
                amount: session.amountRequested,
                currency: session.currency,
                chain: session.chain,
                recipient: session.recipient,
                reference: `invoice:${invoiceId}`,
            };

            console.log(`[x402:${session.sessionId}] Verifying transaction ${txHash}`);
            const verification = await verifier.verify(txHash, expectedPayment);

            if (!verification.success) {
                console.error(`[x402:${session.sessionId}] Verification failed:`, verification.error);
                return reply.code(400).send({
                    error: 'Transaction verification failed',
                    message: verification.error,
                    sessionId,
                    txHash,
                });
            }

            // Confirm session
            await confirmSession(sessionId, txHash);
            console.log(`[x402:${session.sessionId}] Session confirmed with txHash ${txHash}`);

            // Process payment using existing logic
            const { payment, invoice: updatedInvoice } = await confirmPaymentInternal(
                invoiceId,
                verification.verifiedAmount,
                verification.verifiedCurrency,
                txHash,
                session.sessionId
            );

            return reply.code(200).send({
                message: 'Payment confirmed',
                session: {
                    sessionId: session.sessionId,
                    status: 'CONFIRMED',
                    txHash,
                },
                payment: {
                    id: payment.id,
                    amount: payment.amount,
                    currency: payment.currency,
                    txHash: payment.txHash,
                },
                invoice: {
                    id: updatedInvoice.id,
                    status: updatedInvoice.status,
                    cumulativePaid: updatedInvoice.cumulativePaid,
                },
            });
        } catch (error: any) {
            if (error instanceof X402Error) {
                return reply.code(error.statusCode).send({
                    error: error.code,
                    message: error.message,
                    correlationId,
                });
            }
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    error: 'Invalid request body',
                    details: error.errors,
                    correlationId,
                });
            }
            console.error(`[x402:${correlationId}] Error in /pay/confirm:`, error);
            return reply.code(500).send({
                error: 'Internal server error',
                message: error.message,
                correlationId,
            });
        }
    });
}

