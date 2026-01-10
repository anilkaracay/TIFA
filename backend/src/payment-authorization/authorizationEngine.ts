import { prisma } from '../db';
import { X402Error, X402ErrorCode } from '../x402/errors';

export type AuthorizationResult = 
    | { allowed: true }
    | { allowed: false; reason: string };

export interface AuthorizationCheckParams {
    companyId: string;
    invoiceId: string;
    invoiceStatus: string;
    amount: string;
    currency: string;
    chain: string;
}

/**
 * AuthorizationEngine: Determines if agent can execute payment for an invoice
 * under the constraints defined in PaymentAuthorization.
 */
export class AuthorizationEngine {
    /**
     * Check if agent is authorized to execute payment for given invoice
     */
    static async checkAuthorization(params: AuthorizationCheckParams): Promise<AuthorizationResult> {
        const { companyId, invoiceId, invoiceStatus, amount, currency, chain } = params;

        // Find active authorization for company
        const authorization = await prisma.paymentAuthorization.findFirst({
            where: {
                companyId,
                active: true,
                mode: 'AGENT_AUTHORIZED',
                revokedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });

        // No authorization found → agent cannot execute
        if (!authorization) {
            return {
                allowed: false,
                reason: 'No active agent authorization found for this company',
            };
        }

        // Check invoice status is allowed
        const allowedStatuses = JSON.parse(authorization.allowedInvoiceStatuses || '[]') as string[];
        if (!allowedStatuses.includes(invoiceStatus)) {
            return {
                allowed: false,
                reason: `Invoice status ${invoiceStatus} is not allowed. Allowed statuses: ${allowedStatuses.join(', ')}`,
            };
        }

        // Check currency is allowed
        const allowedCurrencies = JSON.parse(authorization.allowedCurrencies || '[]') as string[];
        if (!allowedCurrencies.includes(currency)) {
            return {
                allowed: false,
                reason: `Currency ${currency} is not allowed. Allowed currencies: ${allowedCurrencies.join(', ')}`,
            };
        }

        // Check chain is allowed
        const allowedChains = JSON.parse(authorization.allowedChains || '[]') as string[];
        if (!allowedChains.includes(chain)) {
            return {
                allowed: false,
                reason: `Chain ${chain} is not allowed. Allowed chains: ${allowedChains.join(', ')}`,
            };
        }

        // Check per-invoice amount limit
        const amountBig = BigInt(amount);
        const maxAmountPerInvoice = BigInt(authorization.maxAmountPerInvoice || '0');
        if (maxAmountPerInvoice > BigInt(0) && amountBig > maxAmountPerInvoice) {
            return {
                allowed: false,
                reason: `Amount ${amount} exceeds per-invoice limit of ${authorization.maxAmountPerInvoice}`,
            };
        }

        // Check daily limit
        const dailyLimit = BigInt(authorization.dailyLimit || '0');
        if (dailyLimit > BigInt(0)) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const todayExecutions = await prisma.agentPaymentExecution.findMany({
                where: {
                    authorizationId: authorization.id,
                    executionStatus: 'EXECUTED',
                    createdAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
            });

            const todaySpent = todayExecutions.reduce((sum, exec) => {
                return sum + BigInt(exec.amount);
            }, BigInt(0));

            if (todaySpent + amountBig > dailyLimit) {
                return {
                    allowed: false,
                    reason: `Daily limit would be exceeded. Today spent: ${todaySpent}, limit: ${dailyLimit}, requested: ${amount}`,
                };
            }
        }

        // Check monthly limit
        const monthlyLimit = BigInt(authorization.monthlyLimit || '0');
        if (monthlyLimit > BigInt(0)) {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const monthExecutions = await prisma.agentPaymentExecution.findMany({
                where: {
                    authorizationId: authorization.id,
                    executionStatus: 'EXECUTED',
                    createdAt: {
                        gte: firstDayOfMonth,
                    },
                },
            });

            const monthSpent = monthExecutions.reduce((sum, exec) => {
                return sum + BigInt(exec.amount);
            }, BigInt(0));

            if (monthSpent + amountBig > monthlyLimit) {
                return {
                    allowed: false,
                    reason: `Monthly limit would be exceeded. Month spent: ${monthSpent}, limit: ${monthlyLimit}, requested: ${amount}`,
                };
            }
        }

        // All checks passed
        return { allowed: true };
    }

    /**
     * Get active authorization for a company
     */
    static async getActiveAuthorization(companyId: string) {
        return prisma.paymentAuthorization.findFirst({
            where: {
                companyId,
                active: true,
                mode: 'AGENT_AUTHORIZED',
                revokedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Record audit log entry
     */
    static async logAudit(
        authorizationId: string,
        action: string,
        actor: 'USER' | 'AGENT' | 'SYSTEM',
        metadata?: Record<string, any>
    ) {
        return prisma.authorizationAuditLog.create({
            data: {
                authorizationId,
                action,
                actor,
                metadata: metadata ? JSON.stringify(metadata) : null,
            },
        });
    }
}






