import { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { z } from 'zod';

export async function registerCompanyRoutes(app: FastifyInstance) {

    // POST /companies - Create a new company
    app.post('/', async (req, reply) => {
        const body = z.object({
            id: z.string().optional(), // Optional, will generate if not provided
            externalId: z.string().optional(),
            name: z.string(),
        }).parse(req.body);

        const company = await prisma.company.create({
            data: {
                id: body.id || undefined, // Prisma will generate cuid if not provided
                externalId: body.externalId || undefined,
                name: body.name,
            }
        });

        return company;
    });

    // GET /companies
    app.get('/', async (req, reply) => {
        try {
            const query = z.object({
                q: z.string().optional(),
                limit: z.coerce.number().optional().default(100) // Increased default limit
            }).parse(req.query);

            const where = query.q ? {
                OR: [
                    { name: { contains: query.q } }, // SQLite/Prisma typically insensitive by default or needs mode: 'insensitive'
                    { id: { contains: query.q } }
                ]
            } : {};

            const companies = await prisma.company.findMany({
                where,
                take: query.limit,
                orderBy: { createdAt: 'desc' } // or whatever order
            });

            return companies;
        } catch (error: any) {
            console.error('[Companies] Error fetching companies:', error);
            return reply.code(500).send({ 
                error: 'Failed to fetch companies', 
                message: error.message 
            });
        }
    });

    // GET /companies/:id/cashflow
    app.get('/:id/cashflow', async (req, reply) => {
        const { id } = req.params as { id: string };
        const query = z.object({
            days: z.coerce.number().optional().default(90)
        }).parse(req.query);

        const horizonDays = query.days;
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
