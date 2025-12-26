import { prisma } from '../db';
import { AuthorizationEngine } from '../payment-authorization/authorizationEngine';
import { createSession } from '../x402/sessionStore';
import { x402Config } from '../x402/config';
import { getVerifier } from '../x402/verifier';
import { confirmSession } from '../x402/sessionStore';
import { loadContract } from '../onchain/provider';
import { provider, signer } from '../onchain/provider';
import { ethers } from 'ethers';

const STATUS_MAP: Record<string, number> = {
    NONE: 0,
    ISSUED: 1,
    TOKENIZED: 2,
    FINANCED: 3,
    PARTIALLY_PAID: 4,
    PAID: 5,
    DEFAULTED: 6,
};

/**
 * AutoPaymentAgent: Automatically executes x402 payments for authorized companies
 * 
 * This job runs periodically and:
 * 1. Scans invoices that are ready for payment
 * 2. Checks if company has active agent authorization
 * 3. Verifies authorization constraints
 * 4. Executes payment via agent-controlled wallet
 * 5. Confirms and settles payment
 */
export class AutoPaymentAgent {
    private static intervalId: NodeJS.Timeout | null = null;
    private static readonly POLL_INTERVAL_MS = 60000; // 1 minute

    /**
     * Start the auto-payment agent
     */
    static start() {
        if (this.intervalId) {
            console.log('[AutoPaymentAgent] Already running');
            return;
        }

        console.log('[AutoPaymentAgent] Starting auto-payment agent (polling every 60s)');
        
        // Run immediately, then on interval
        this.executeCycle();
        
        this.intervalId = setInterval(() => {
            this.executeCycle();
        }, this.POLL_INTERVAL_MS);
    }

    /**
     * Stop the auto-payment agent
     */
    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[AutoPaymentAgent] Stopped');
        }
    }

    /**
     * Execute one cycle of payment processing
     */
    private static async executeCycle() {
        try {
            // Only run if x402 is enabled
            if (!x402Config.enabled) {
                console.log('[AutoPaymentAgent] x402 is disabled, skipping cycle');
                return;
            }

            console.log('[AutoPaymentAgent] Starting execution cycle...');

            // Find all companies with active agent authorizations
            const authorizations = await prisma.paymentAuthorization.findMany({
                where: {
                    active: true,
                    mode: 'AGENT_AUTHORIZED',
                    revokedAt: null,
                },
                include: {
                    company: true,
                },
            });

            console.log(`[AutoPaymentAgent] Found ${authorizations.length} active authorization(s)`);

            if (authorizations.length === 0) {
                console.log('[AutoPaymentAgent] No active authorizations found');
                return; // No active authorizations
            }

            // Process each authorized company
            for (const auth of authorizations) {
                console.log(`[AutoPaymentAgent] Processing company ${auth.companyId} (auth: ${auth.id})`);
                await this.processCompanyInvoices(auth);
            }

            console.log('[AutoPaymentAgent] Execution cycle completed');
        } catch (error: any) {
            console.error('[AutoPaymentAgent] Error in execution cycle:', error);
        }
    }

    /**
     * Process invoices for a specific company authorization
     */
    private static async processCompanyInvoices(authorization: any) {
        try {
            const allowedStatuses = JSON.parse(authorization.allowedInvoiceStatuses || '[]') as string[];
            
            console.log(`[AutoPaymentAgent] Allowed statuses for company ${authorization.companyId}:`, allowedStatuses);
            
            if (allowedStatuses.length === 0) {
                console.log(`[AutoPaymentAgent] No allowed statuses for company ${authorization.companyId}`);
                return; // No allowed statuses
            }

            // Find payable invoices for this company
            // Get all invoices and filter in memory (SQLite doesn't support complex comparisons)
            const allInvoices = await prisma.invoice.findMany({
                where: {
                    debtorId: authorization.companyId,
                    status: {
                        in: allowedStatuses,
                    },
                },
            });

            console.log(`[AutoPaymentAgent] Found ${allInvoices.length} invoice(s) with allowed statuses for company ${authorization.companyId}`);

            // Filter invoices that are not fully paid
            const invoices = allInvoices.filter((inv) => {
                const total = BigInt(inv.amount);
                const paid = BigInt(inv.cumulativePaid || '0');
                return paid < total;
            });

            console.log(`[AutoPaymentAgent] Found ${invoices.length} unpaid invoice(s) for company ${authorization.companyId}`);

            for (const invoice of invoices) {
                console.log(`[AutoPaymentAgent] Processing invoice ${invoice.externalId || invoice.id} (${invoice.status})`);
                await this.processInvoice(invoice, authorization);
            }
        } catch (error: any) {
            console.error(`[AutoPaymentAgent] Error processing company ${authorization.companyId}:`, error);
        }
    }

    /**
     * Process a single invoice for agent payment
     */
    private static async processInvoice(invoice: any, authorization: any) {
        try {
            console.log(`[AutoPaymentAgent] Starting processInvoice for ${invoice.externalId || invoice.id}`);
            
            // Calculate remaining amount
            const totalAmount = BigInt(invoice.amount);
            const paid = BigInt(invoice.cumulativePaid || '0');
            const remaining = totalAmount - paid;

            console.log(`[AutoPaymentAgent] Invoice ${invoice.externalId || invoice.id}: total=${totalAmount}, paid=${paid}, remaining=${remaining}`);

            if (remaining <= BigInt(0)) {
                console.log(`[AutoPaymentAgent] Invoice ${invoice.externalId || invoice.id} already fully paid`);
                return; // Already fully paid
            }

            // Check authorization
            const allowedCurrencies = JSON.parse(authorization.allowedCurrencies || '[]') as string[];
            const allowedChains = JSON.parse(authorization.allowedChains || '[]') as string[];

            console.log(`[AutoPaymentAgent] Checking currency: ${invoice.currency} in [${allowedCurrencies.join(', ')}]`);
            if (!allowedCurrencies.includes(invoice.currency)) {
                console.log(`[AutoPaymentAgent] Currency ${invoice.currency} not allowed`);
                return; // Currency not allowed
            }

            const chain = x402Config.chain;
            console.log(`[AutoPaymentAgent] Checking chain: ${chain} in [${allowedChains.join(', ')}]`);
            if (!allowedChains.includes(chain)) {
                console.log(`[AutoPaymentAgent] Chain ${chain} not allowed`);
                return; // Chain not allowed
            }

            console.log(`[AutoPaymentAgent] Calling AuthorizationEngine.checkAuthorization...`);
            const checkResult = await AuthorizationEngine.checkAuthorization({
                companyId: authorization.companyId,
                invoiceId: invoice.id,
                invoiceStatus: invoice.status,
                amount: remaining.toString(),
                currency: invoice.currency,
                chain: chain,
            });

            console.log(`[AutoPaymentAgent] Authorization check for invoice ${invoice.externalId || invoice.id}:`, checkResult);

            if (!checkResult.allowed) {
                console.log(`[AutoPaymentAgent] Payment BLOCKED for invoice ${invoice.externalId || invoice.id}: ${checkResult.reason}`);
                
                // Log blocked execution
                await prisma.agentPaymentExecution.create({
                    data: {
                        authorizationId: authorization.id,
                        invoiceId: invoice.id,
                        amount: remaining.toString(),
                        currency: invoice.currency,
                        chain: chain,
                        executionStatus: 'BLOCKED',
                        reason: checkResult.reason,
                    },
                });

                await AuthorizationEngine.logAudit(
                    authorization.id,
                    'BLOCKED',
                    'AGENT',
                    { invoiceId: invoice.id, reason: checkResult.reason }
                );

                return;
            }

            console.log(`[AutoPaymentAgent] Payment ALLOWED for invoice ${invoice.externalId || invoice.id}, proceeding with execution...`);

            // Check if invoice is due (optional: can be configured)
            // For now, we'll process all authorized invoices

            // Execute payment
            await this.executePayment(invoice, authorization, remaining.toString());
        } catch (error: any) {
            console.error(`[AutoPaymentAgent] Error processing invoice ${invoice.id}:`, error);
            
            // Log failed execution
            await prisma.agentPaymentExecution.create({
                data: {
                    authorizationId: authorization.id,
                    invoiceId: invoice.id,
                    amount: '0',
                    currency: invoice.currency,
                    chain: x402Config.chain,
                    executionStatus: 'FAILED',
                    reason: error.message || 'Unknown error',
                },
            });
        }
    }

    /**
     * Execute payment for an invoice
     */
    private static async executePayment(invoice: any, authorization: any, amount: string) {
        try {
            // Create x402 session
            const session = await createSession({
                invoiceId: invoice.id,
                amountRequested: amount,
                currency: invoice.currency,
                chain: x402Config.chain,
                recipient: x402Config.recipient,
                metadata: {
                    correlationId: `agent-${Date.now()}`,
                    invoiceExternalId: invoice.externalId,
                    authorizationId: authorization.id,
                    executionMode: 'AGENT_AUTHORIZED',
                },
            });

            // Update session with execution mode
            await prisma.x402PaymentSession.update({
                where: { id: session.id },
                data: {
                    executionMode: 'AGENT_AUTHORIZED',
                    authorizationId: authorization.id,
                },
            });

            // Execute on-chain payment
            // Note: This is a placeholder - in production, you'd use the agent's wallet
            // to send the actual transaction. For now, we'll use a mock transaction hash.
            const txHash = await this.sendPaymentTransaction(amount, invoice.currency);

            if (!txHash) {
                throw new Error('Failed to send payment transaction');
            }

            // Verify payment (ensure txHash is a string)
            const txHashStr = String(txHash);
            const verifier = getVerifier();
            const verification = await verifier.verify(
                txHashStr,
                {
                    amount,
                    currency: invoice.currency,
                    chain: x402Config.chain,
                    recipient: x402Config.recipient,
                    reference: `invoice:${invoice.externalId}`,
                }
            );

            if (!verification.success) {
                throw new Error(`Payment verification failed: ${verification.error || 'Unknown error'}`);
            }

            // Confirm session (ensure txHash is a string)
            await confirmSession(session.sessionId, txHashStr);

            // Use existing payment confirmation logic
            const { confirmPaymentInternal } = await import('../x402/routes');
            await confirmPaymentInternal(
                invoice.id,
                verification.verifiedAmount,
                verification.verifiedCurrency,
                txHashStr,
                `agent-${session.sessionId}`
            );

            // Record successful execution
            await prisma.agentPaymentExecution.create({
                data: {
                    authorizationId: authorization.id,
                    invoiceId: invoice.id,
                    sessionId: session.sessionId,
                    amount,
                    currency: invoice.currency,
                    chain: x402Config.chain,
                    txHash,
                    executionStatus: 'EXECUTED',
                },
            });

            await AuthorizationEngine.logAudit(
                authorization.id,
                'EXECUTED',
                'AGENT',
                { invoiceId: invoice.id, amount, txHash }
            );

            console.log(`[AutoPaymentAgent] Successfully executed payment for invoice ${invoice.externalId}, txHash: ${txHash}`);
        } catch (error: any) {
            console.error(`[AutoPaymentAgent] Payment execution failed:`, error);
            throw error;
        }
    }

    /**
     * Send payment transaction on-chain
     * This is a placeholder - in production, implement actual ERC20 transfer
     */
    private static async sendPaymentTransaction(amount: string, currency: string): Promise<string | null> {
        try {
            // TODO: Implement actual ERC20 transfer using agent wallet
            // For now, return a mock transaction hash for testing
            // In production, this should:
            // 1. Get ERC20 token address for currency
            // 2. Create transfer transaction
            // 3. Sign with agent wallet
            // 4. Send transaction
            // 5. Return real txHash

            // Mock implementation for testing
            const mockTxHash = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
            console.log(`[AutoPaymentAgent] Mock transaction hash: ${mockTxHash}`);
            return mockTxHash;
        } catch (error: any) {
            console.error('[AutoPaymentAgent] Error sending transaction:', error);
            return null;
        }
    }
}

