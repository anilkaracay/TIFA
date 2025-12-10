import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import {
    InvoiceCreateSchema,
    InvoiceUpdateSchema,
    PaymentNotificationSchema,
    FinancingRequestSchema
} from '../schemas/invoices';
import { ethers } from 'ethers';

export async function registerInvoiceRoutes(app: FastifyInstance) {

    // POST /invoices
    app.post('/', async (req, reply) => {
        const body = InvoiceCreateSchema.parse(req.body);

        // Ensure company and debtor exist (simple upsert or find/create logic)
        // For simplicity, we assume they might not exist, so we connect or create
        await prisma.company.upsert({
            where: { id: body.companyId },
            update: {},
            create: { id: body.companyId, name: `Company ${body.companyId}` }
        });

        await prisma.company.upsert({
            where: { id: body.debtorId },
            update: {},
            create: { id: body.debtorId, name: `Company ${body.debtorId}` }
        });

        const invoice = await prisma.invoice.create({
            data: {
                externalId: body.externalId,
                companyId: body.companyId,
                debtorId: body.debtorId,
                currency: body.currency,
                amount: body.amount,
                dueDate: new Date(body.dueDate),
                status: 'ISSUED',
                isFinanced: false,
                cumulativePaid: '0'
            }
        });

        return invoice;
    });

    // GET /invoices
    app.get('/', async (req, reply) => {
        const query = z.object({
            companyId: z.string().optional(),
            status: z.string().optional(),
            limit: z.coerce.number().optional().default(50)
        }).parse(req.query);

        const invoices = await prisma.invoice.findMany({
            where: {
                companyId: query.companyId,
                status: query.status
            },
            take: query.limit,
            orderBy: { createdAt: 'desc' }
        });

        return invoices;
    });

    // GET /invoices/:id
    app.get('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { payments: true }
        });

        if (!invoice) {
            return reply.code(404).send({ error: 'Invoice not found' });
        }
        return invoice;
    });

    // PATCH /invoices/:id
    app.patch('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = InvoiceUpdateSchema.parse(req.body);

        const invoice = await prisma.invoice.update({
            where: { id },
            data: {
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                status: body.status
            }
        });

        return invoice;
    });

    // POST /invoices/:id/tokenize
    app.post('/:id/tokenize', async (req, reply) => {
        const { id } = req.params as { id: string };
        const invoice = await prisma.invoice.findUnique({ where: { id } });

        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        // TODO: Connect to Hardhat/Ethers to mint actual NFT
        // Stub implementation:
        const mockTokenId = BigInt(Date.now()).toString(); // Random token ID
        const mockBytes32 = ethers.id(invoice.externalId); // Correct way to hash string in ethers v6

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                status: 'TOKENIZED',
                tokenId: mockTokenId,
                invoiceIdOnChain: mockBytes32,
                // tokenAddress: '0x...' 
            }
        });

        return { ...updated, simulated: true };
    });

    // POST /invoices/:id/payments
    app.post('/:id/payments', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = PaymentNotificationSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        // Compute new cumulative paid
        const oldPaid = BigInt(invoice.cumulativePaid);
        const paymentAmt = BigInt(body.amount);
        const newPaid = oldPaid + paymentAmt;

        // Check if fully paid
        const totalAmt = BigInt(invoice.amount);
        let newStatus = invoice.status;
        if (newPaid >= totalAmt) {
            newStatus = 'PAID';
        } else if (newPaid > 0n && newStatus !== 'PAID') {
            newStatus = 'PARTIALLY_PAID';
        }

        const [payment, updatedInvoice] = await prisma.$transaction([
            prisma.invoicePayment.create({
                data: {
                    invoiceId: id,
                    amount: body.amount,
                    currency: body.currency,
                    paidAt: new Date(body.paidAt),
                    psp: body.psp,
                    txHash: null // TODO: if on-chain payment
                }
            }),
            prisma.invoice.update({
                where: { id },
                data: {
                    cumulativePaid: newPaid.toString(),
                    status: newStatus
                }
            })
        ]);

        return { payment, invoice: updatedInvoice };
    });

    // POST /invoices/:id/finance
    app.post('/:id/finance', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = FinancingRequestSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        // Check eligibility logic (Stub)
        if (invoice.status !== 'TOKENIZED') {
            return reply.code(400).send({ error: 'Invoice must be tokenized first' });
        }
        if (invoice.isFinanced) {
            return reply.code(400).send({ error: 'Already financed' });
        }

        // 70% LTV default
        const ltvBps = 7000n;
        const totalAmt = BigInt(invoice.amount);
        const approvedAmt = (totalAmt * ltvBps) / 10000n;

        // Simulate financing
        // TODO: Call FinancingPool.lockCollateral() + drawCredit() via Ethers

        await prisma.invoice.update({
            where: { id },
            data: { isFinanced: true, status: 'FINANCED' }
        });

        return {
            invoiceId: id,
            approved: true,
            approvedAmount: approvedAmt.toString(),
            ltvBps: Number(ltvBps),
            poolAddress: null, // Placeholder
            txHash: null,
            reason: 'Automated approval'
        };
    });
}
