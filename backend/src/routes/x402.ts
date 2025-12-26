import { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { x402Config } from '../x402/config';
import { roleResolutionMiddleware } from '../middleware/roleAuth';

export async function registerX402DashboardRoutes(app: FastifyInstance) {
    // Apply role resolution to all routes
    app.addHook('onRequest', roleResolutionMiddleware);

    // GET /x402/sessions - Get active payment sessions
    app.get('/sessions', async (req, reply) => {
        try {
            if (!x402Config.enabled) {
                return reply.code(400).send({ error: 'x402 is not enabled' });
            }

            const sessions = await prisma.x402PaymentSession.findMany({
                where: {
                    status: 'PENDING',
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 50,
            });

            return reply.send(
                sessions.map((s) => ({
                    sessionId: s.sessionId,
                    invoiceId: s.invoiceId,
                    amountRequested: s.amountRequested,
                    currency: s.currency,
                    chain: s.chain,
                    recipient: s.recipient,
                    status: s.status,
                    expiresAt: s.expiresAt,
                    createdAt: s.createdAt,
                    metadata: s.metadata ? JSON.parse(s.metadata as string) : null,
                }))
            );
        } catch (e: any) {
            app.log.error(e, 'Error fetching x402 sessions');
            return reply.code(500).send({ error: 'Failed to fetch sessions' });
        }
    });

    // GET /x402/history - Get payment history
    app.get('/history', async (req, reply) => {
        try {
            if (!x402Config.enabled) {
                return reply.code(400).send({ error: 'x402 is not enabled' });
            }

            const limit = Number((req.query as any).limit) || 50;
            const sessions = await prisma.x402PaymentSession.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
            });

            return reply.send(
                sessions.map((s) => ({
                    sessionId: s.sessionId,
                    invoiceId: s.invoiceId,
                    amountRequested: s.amountRequested,
                    currency: s.currency,
                    chain: s.chain,
                    status: s.status,
                    txHash: s.txHash,
                    executionMode: s.executionMode,
                    authorizationId: s.authorizationId,
                    createdAt: s.createdAt,
                    expiresAt: s.expiresAt,
                }))
            );
        } catch (e: any) {
            app.log.error(e, 'Error fetching x402 history');
            return reply.code(500).send({ error: 'Failed to fetch history' });
        }
    });

    // GET /x402/stats - Get x402 statistics
    app.get('/stats', async (req, reply) => {
        try {
            if (!x402Config.enabled) {
                return reply.code(400).send({ error: 'x402 is not enabled' });
            }

            const [totalSessions, confirmedSessions, activeSessions, confirmedSessionsData] = await Promise.all([
                prisma.x402PaymentSession.count(),
                prisma.x402PaymentSession.count({
                    where: { status: 'CONFIRMED' },
                }),
                prisma.x402PaymentSession.count({
                    where: {
                        status: 'PENDING',
                        expiresAt: {
                            gt: new Date(),
                        },
                    },
                }),
                prisma.x402PaymentSession.findMany({
                    where: { status: 'CONFIRMED' },
                    select: { amountRequested: true },
                }),
            ]);

            // Calculate total volume by summing confirmed payments
            const totalVolume = confirmedSessionsData.reduce((sum, session) => {
                return sum + BigInt(session.amountRequested);
            }, BigInt(0));

            return reply.send({
                totalPayments: totalSessions,
                confirmedPayments: confirmedSessions,
                activeSessions: activeSessions,
                totalVolume: totalVolume.toString(),
            });
        } catch (e: any) {
            app.log.error(e, 'Error fetching x402 stats');
            return reply.code(500).send({ error: 'Failed to fetch stats' });
        }
    });
}

