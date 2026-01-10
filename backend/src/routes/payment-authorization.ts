import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { roleResolutionMiddleware, requireWallet } from '../middleware/roleAuth';
import { AuthorizationEngine } from '../payment-authorization/authorizationEngine';

const CreateAuthorizationSchema = z.object({
    companyId: z.string(),
    maxAmountPerInvoice: z.string(),
    dailyLimit: z.string(),
    monthlyLimit: z.string(),
    allowedCurrencies: z.array(z.string()),
    allowedChains: z.array(z.string()),
    allowedInvoiceStatuses: z.array(z.string()),
    autoApproveFinancedInvoices: z.boolean().default(false),
    autoApproveTokenizedInvoices: z.boolean().default(false),
});

const UpdateAuthorizationSchema = CreateAuthorizationSchema.partial();

export async function registerPaymentAuthorizationRoutes(app: FastifyInstance) {
    // Apply role resolution to all routes
    app.addHook('onRequest', roleResolutionMiddleware);

    // GET /payment-authorization/:companyId - Get active authorization
    app.get('/:companyId', async (req, reply) => {
        const { companyId } = req.params as { companyId: string };

        try {
            const authorization = await AuthorizationEngine.getActiveAuthorization(companyId);
            
            if (!authorization) {
                return reply.code(404).send({ error: 'No active authorization found' });
            }

            return reply.send({
                ...authorization,
                allowedCurrencies: JSON.parse(authorization.allowedCurrencies || '[]'),
                allowedChains: JSON.parse(authorization.allowedChains || '[]'),
                allowedInvoiceStatuses: JSON.parse(authorization.allowedInvoiceStatuses || '[]'),
            });
        } catch (e: any) {
            app.log.error(e, 'Error fetching authorization');
            return reply.code(500).send({ error: 'Failed to fetch authorization' });
        }
    });

    // POST /payment-authorization - Create new authorization
    app.post('/', { preHandler: [requireWallet] }, async (req, reply) => {
        try {
            const body = CreateAuthorizationSchema.parse(req.body);
            const wallet = (req as any).wallet;

            // Check if company exists
            const company = await prisma.company.findUnique({
                where: { id: body.companyId },
            });

            if (!company) {
                return reply.code(404).send({ error: 'Company not found' });
            }

            // Revoke any existing active authorization
            await prisma.paymentAuthorization.updateMany({
                where: {
                    companyId: body.companyId,
                    active: true,
                },
                data: {
                    active: false,
                    revokedAt: new Date(),
                },
            });

            // Create new authorization
            const authorization = await prisma.paymentAuthorization.create({
                data: {
                    companyId: body.companyId,
                    mode: 'AGENT_AUTHORIZED',
                    maxAmountPerInvoice: body.maxAmountPerInvoice,
                    dailyLimit: body.dailyLimit,
                    monthlyLimit: body.monthlyLimit,
                    allowedCurrencies: JSON.stringify(body.allowedCurrencies),
                    allowedChains: JSON.stringify(body.allowedChains),
                    allowedInvoiceStatuses: JSON.stringify(body.allowedInvoiceStatuses),
                    autoApproveFinancedInvoices: body.autoApproveFinancedInvoices,
                    autoApproveTokenizedInvoices: body.autoApproveTokenizedInvoices,
                    active: true,
                },
            });

            // Log audit
            await AuthorizationEngine.logAudit(
                authorization.id,
                'CREATED',
                'USER',
                { wallet, companyId: body.companyId }
            );

            return reply.code(201).send({
                ...authorization,
                allowedCurrencies: body.allowedCurrencies,
                allowedChains: body.allowedChains,
                allowedInvoiceStatuses: body.allowedInvoiceStatuses,
            });
        } catch (e: any) {
            if (e instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Invalid request body', issues: e.issues });
            }
            app.log.error(e, 'Error creating authorization');
            return reply.code(500).send({ error: 'Failed to create authorization' });
        }
    });

    // PATCH /payment-authorization/:id - Update authorization
    app.patch('/:id', { preHandler: [requireWallet] }, async (req, reply) => {
        const { id } = req.params as { id: string };

        try {
            const body = UpdateAuthorizationSchema.parse(req.body);
            const wallet = (req as any).wallet;

            const authorization = await prisma.paymentAuthorization.findUnique({
                where: { id },
            });

            if (!authorization) {
                return reply.code(404).send({ error: 'Authorization not found' });
            }

            const updateData: any = {};
            if (body.maxAmountPerInvoice !== undefined) updateData.maxAmountPerInvoice = body.maxAmountPerInvoice;
            if (body.dailyLimit !== undefined) updateData.dailyLimit = body.dailyLimit;
            if (body.monthlyLimit !== undefined) updateData.monthlyLimit = body.monthlyLimit;
            if (body.allowedCurrencies !== undefined) updateData.allowedCurrencies = JSON.stringify(body.allowedCurrencies);
            if (body.allowedChains !== undefined) updateData.allowedChains = JSON.stringify(body.allowedChains);
            if (body.allowedInvoiceStatuses !== undefined) updateData.allowedInvoiceStatuses = JSON.stringify(body.allowedInvoiceStatuses);
            if (body.autoApproveFinancedInvoices !== undefined) updateData.autoApproveFinancedInvoices = body.autoApproveFinancedInvoices;
            if (body.autoApproveTokenizedInvoices !== undefined) updateData.autoApproveTokenizedInvoices = body.autoApproveTokenizedInvoices;

            const updated = await prisma.paymentAuthorization.update({
                where: { id },
                data: updateData,
            });

            // Log audit
            await AuthorizationEngine.logAudit(
                id,
                'UPDATED',
                'USER',
                { wallet, changes: body }
            );

            return reply.send({
                ...updated,
                allowedCurrencies: JSON.parse(updated.allowedCurrencies || '[]'),
                allowedChains: JSON.parse(updated.allowedChains || '[]'),
                allowedInvoiceStatuses: JSON.parse(updated.allowedInvoiceStatuses || '[]'),
            });
        } catch (e: any) {
            if (e instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Invalid request body', issues: e.issues });
            }
            app.log.error(e, 'Error updating authorization');
            return reply.code(500).send({ error: 'Failed to update authorization' });
        }
    });

    // POST /payment-authorization/:id/revoke - Revoke authorization
    app.post('/:id/revoke', { preHandler: [requireWallet] }, async (req, reply) => {
        const { id } = req.params as { id: string };

        try {
            const wallet = (req as any).wallet;

            const authorization = await prisma.paymentAuthorization.findUnique({
                where: { id },
            });

            if (!authorization) {
                return reply.code(404).send({ error: 'Authorization not found' });
            }

            const updated = await prisma.paymentAuthorization.update({
                where: { id },
                data: {
                    active: false,
                    revokedAt: new Date(),
                },
            });

            // Log audit
            await AuthorizationEngine.logAudit(
                id,
                'REVOKED',
                'USER',
                { wallet }
            );

            return reply.send({
                ...updated,
                allowedCurrencies: JSON.parse(updated.allowedCurrencies || '[]'),
                allowedChains: JSON.parse(updated.allowedChains || '[]'),
                allowedInvoiceStatuses: JSON.parse(updated.allowedInvoiceStatuses || '[]'),
            });
        } catch (e: any) {
            app.log.error(e, 'Error revoking authorization');
            return reply.code(500).send({ error: 'Failed to revoke authorization' });
        }
    });

    // GET /payment-authorization/:id/executions - Get execution history
    app.get('/:id/executions', async (req, reply) => {
        const { id } = req.params as { id: string };
        const limit = Number((req.query as any).limit) || 50;

        try {
            const executions = await prisma.agentPaymentExecution.findMany({
                where: { authorizationId: id },
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    invoice: {
                        select: {
                            id: true,
                            externalId: true,
                            status: true,
                        },
                    },
                },
            });

            return reply.send(executions);
        } catch (e: any) {
            app.log.error(e, 'Error fetching executions');
            return reply.code(500).send({ error: 'Failed to fetch executions' });
        }
    });

    // GET /payment-authorization/:id/audit - Get audit log
    app.get('/:id/audit', async (req, reply) => {
        const { id } = req.params as { id: string };
        const limit = Number((req.query as any).limit) || 100;

        try {
            const logs = await prisma.authorizationAuditLog.findMany({
                where: { authorizationId: id },
                orderBy: { timestamp: 'desc' },
                take: limit,
            });

            return reply.send(
                logs.map(log => ({
                    ...log,
                    metadata: log.metadata ? JSON.parse(log.metadata) : null,
                }))
            );
        } catch (e: any) {
            app.log.error(e, 'Error fetching audit log');
            return reply.code(500).send({ error: 'Failed to fetch audit log' });
        }
    });
}






