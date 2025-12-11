
import { FastifyInstance } from 'fastify';
import { prisma } from '../db';

export async function registerAnalyticsRoutes(app: FastifyInstance) {

    app.get('/', async (req, reply) => {
        try {
            const invoices = await prisma.invoice.findMany({
                orderBy: { createdAt: 'desc' },
                include: { company: true }
            });

            // Derive financed positions
            const financed = invoices.filter(i => i.isFinanced).map(i => ({
                id: i.id,
                invoice: { id: i.id },
                timestamp: Math.floor(i.updatedAt.getTime() / 1000).toString()
            }));

            // Derive simplified events from invoice updates
            const recentDecisions = await prisma.agentDecision.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' }
            });

            const events = recentDecisions.map(d => ({
                id: d.id,
                eventType: d.actionType,
                invoiceId: d.invoiceExternalId || d.invoiceId,
                txHash: d.txHash || "0x...",
                timestamp: Math.floor(d.createdAt.getTime() / 1000).toString(),
                amount: "0"
            }));

            return {
                invoices,
                financed,
                events
            };
        } catch (error) {
            console.error("Analytics Error:", error);
            return reply.code(500).send({ error: "Failed to fetch analytics" });
        }
    });

}
