import { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { z } from 'zod';

export async function registerCompanyRoutes(app: FastifyInstance) {

    // GET /companies/:id/cashflow
    app.get('/:id/cashflow', async (req, reply) => {
        const { id } = req.params as { id: string };

        // Default 90 days horizon
        const horizonDays = 90;
        const now = new Date();
        const future = new Date();
        future.setDate(now.getDate() + horizonDays);

        const invoices = await prisma.invoice.findMany({
            where: {
                companyId: id,
                status: { in: ['ISSUED', 'TOKENIZED', 'FINANCED', 'PARTIALLY_PAID'] },
                dueDate: {
                    gte: now,
                    lte: future
                }
            }
        });

        // Bucket by day
        const bucketsMap = new Map<string, bigint>();

        for (const inv of invoices) {
            const dateKey = inv.dueDate.toISOString().split('T')[0];
            const outstanding = BigInt(inv.amount) - BigInt(inv.cumulativePaid);

            const current = bucketsMap.get(dateKey) || 0n;
            bucketsMap.set(dateKey, current + outstanding);
        }

        const buckets = [];
        let totalInflow = 0n;

        for (const [date, val] of bucketsMap.entries()) {
            buckets.push({
                date,
                expectedInflow: val.toString(),
                expectedOutflow: '0',
                net: val.toString()
            });
            totalInflow += val;
        }

        // Sort buckets
        buckets.sort((a, b) => a.date.localeCompare(b.date));

        return {
            companyId: id,
            horizonDays,
            generatedAt: now.toISOString(),
            buckets,
            summary: {
                totalExpectedInflow: totalInflow.toString(),
                totalExpectedOutflow: '0',
                totalNet: totalInflow.toString()
            }
        };
    });
}
