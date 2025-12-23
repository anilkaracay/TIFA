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
import { provider, signer, loadContract } from '../onchain/provider';

// Helper for status mapping
const STATUS_MAP: Record<string, number> = {
    NONE: 0,
    ISSUED: 1,
    TOKENIZED: 2,
    FINANCED: 3,
    PARTIALLY_PAID: 4,
    PAID: 5,
    DEFAULTED: 6
};

export async function registerInvoiceRoutes(app: FastifyInstance) {

    // POST /invoices
    app.post('/', async (req, reply) => {
        const body = InvoiceCreateSchema.parse(req.body);

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

        // Build where clause
        const where: any = {};
        if (query.companyId && query.companyId !== 'all') { // Handle 'all' if passed by frontend
            where.companyId = query.companyId;
        }
        if (query.status && query.status !== 'all') {
            where.status = query.status;
        }

        const invoices = await prisma.invoice.findMany({
            where,
            take: query.limit,
            orderBy: { createdAt: 'desc' },
            include: { payments: true }
        });

        // Fetch debt information from contract for financed invoices
        const FinancingPool = loadContract("FinancingPool");
        const invoicesWithDebt = await Promise.all(
            invoices.map(async (inv) => {
                if (inv.invoiceIdOnChain && inv.isFinanced) {
                    try {
                        const position = await FinancingPool.getPosition(inv.invoiceIdOnChain);
                        if (position.exists) {
                            return {
                                ...inv,
                                usedCredit: position.usedCredit.toString(), // Debt amount in cents
                                maxCreditLine: position.maxCreditLine.toString()
                            };
                        }
                    } catch (e) {
                        console.error(`Error fetching debt for invoice ${inv.id}:`, e);
                    }
                }
                return {
                    ...inv,
                    usedCredit: "0",
                    maxCreditLine: "0"
                };
            })
        );

        return invoicesWithDebt;
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

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        // On-chain status update if status is changing and invoice is on-chain
        if (body.status && body.status !== invoice.status && invoice.invoiceIdOnChain) {
            try {
                console.log(`Updating status on-chain for ${invoice.externalId} to ${body.status}...`);
                const InvoiceRegistry = loadContract("InvoiceRegistry");
                const statusEnum = STATUS_MAP[body.status];

                if (statusEnum !== undefined) {
                    const tx = await InvoiceRegistry.setStatus(invoice.invoiceIdOnChain, statusEnum);
                    console.log(`Tx sent: ${tx.hash}`);
                    await tx.wait();
                    console.log(`Status updated on-chain.`);
                }
            } catch (err: any) {
                console.error("On-chain status update failed:", err);
                // Optionally make this fatal, but for now log and proceed to DB update
            }
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                status: body.status
            }
        });

        return updated;
    });

    // POST /invoices/:id/tokenize
    app.post('/:id/tokenize', async (req, reply) => {
        const { id } = req.params as { id: string };
        console.log(`[Tokenize] Request for ${id}`);
        const invoice = await prisma.invoice.findUnique({ where: { id } });

        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });
        if (invoice.status !== 'ISSUED') return reply.code(400).send({ error: 'Invoice must be ISSUED' });

        try {
            console.log(`Tokenizing invoice ${invoice.externalId}...`);

            // MOCK MODE: If no private key or explicitly enabled
            if (!process.env.PRIVATE_KEY) {
                console.log("⚠️ Mock Mode: Simulating tokenization...");
                await new Promise(r => setTimeout(r, 2000)); // Simulate simplified delay

                const mockTokenId = Math.floor(Math.random() * 10000).toString();
                const mockTxHash = "0x" + Math.random().toString(16).slice(2).repeat(4); // Fake hash

                const updated = await prisma.invoice.update({
                    where: { id },
                    data: {
                        status: 'TOKENIZED',
                        tokenId: mockTokenId,
                        invoiceIdOnChain: ethers.utils.id(invoice.externalId),
                        tokenAddress: "0xMockInvoiceTokenAddress"
                    }
                });
                return { ...updated, txHash: mockTxHash };
            }

            const InvoiceToken = loadContract("InvoiceToken");
            // ... Real logic ...
            const invoiceIdOnChain = ethers.utils.id(invoice.externalId);
            const issuerAddress = signer.address;
            const debtorAddress = signer.address;

            // Convert amount to cents (2 decimals)
            // invoice.amount is in TRY units (e.g., "50000"), convert to cents (5000000)
            const amountInCents = BigInt(Math.floor(parseFloat(invoice.amount) * 100));

            const invoiceData = {
                invoiceId: invoiceIdOnChain,
                issuer: issuerAddress,
                debtor: debtorAddress,
                amount: amountInCents.toString(),
                dueDate: Math.floor(new Date(invoice.dueDate).getTime() / 1000),
                currency: "0x0000000000000000000000000000000000000000"
            };

            const tx = await InvoiceToken.mintInvoice(invoiceData, "ipfs://placeholder");
            console.log(`Mint tx sent: ${tx.hash}`);
            const receipt = await tx.wait();

            const event = receipt.events?.find((e: any) => e.event === "InvoiceMinted");
            const tokenId = event?.args?.tokenId.toString();

            if (!tokenId) throw new Error("Token ID not found in events");

            const updated = await prisma.invoice.update({
                where: { id },
                data: {
                    status: 'TOKENIZED',
                    tokenId: tokenId,
                    invoiceIdOnChain: invoiceIdOnChain,
                    tokenAddress: InvoiceToken.address
                }
            });

            return { ...updated, txHash: receipt.transactionHash };

        } catch (e: any) {
            console.error("Tokenization failed:", e);
            return reply.code(500).send({ error: e.message || "Tokenization failed" });
        }
    });

    // POST /invoices/:id/finance
    app.post('/:id/finance', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = FinancingRequestSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        if (invoice.status !== 'TOKENIZED') return reply.code(400).send({ error: 'Invoice must be TOKENIZED' });
        if (invoice.isFinanced) return reply.code(400).send({ error: 'Already financed' });
        if (!invoice.invoiceIdOnChain || !invoice.tokenId) return reply.code(400).send({ error: 'Missing on-chain data' });

        // Calculate requested amount: 60% of invoice amount (matching LTV rate)
        // Convert invoice.amount (string like "100000") to cents and apply 60% LTV
        const invoiceAmountInCents = BigInt(Math.floor(parseFloat(invoice.amount) * 100));
        const requestedAmount = body.amount ? BigInt(body.amount) : invoiceAmountInCents * 6000n / 10000n; // 60% LTV

        try {
            console.log(`Financing invoice ${invoice.externalId}...`);

            // MOCK MODE: If no private key or explicitly enabled
            if (!process.env.PRIVATE_KEY) {
                console.log("⚠️ Mock Mode: Simulating financing...");
                await new Promise(r => setTimeout(r, 2000));

                const mockTxHash = "0x" + Math.random().toString(16).slice(2).repeat(4);

                await prisma.invoice.update({
                    where: { id },
                    data: { isFinanced: true, status: 'FINANCED' }
                });

                return {
                    invoiceId: id,
                    approved: true,
                    approvedAmount: requestedAmount.toString(),
                    txHash: mockTxHash
                };
            }

            const InvoiceToken = loadContract("InvoiceToken");
            const FinancingPool = loadContract("FinancingPool");

            // Check current owner and position status
            const currentOwner = await InvoiceToken.ownerOf(invoice.tokenId);
            const position = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
            
            let positionExists = position.exists;

            if (currentOwner === FinancingPool.address) {
                // NFT is already in Pool
                if (!positionExists) {
                    // Recovery needed: NFT in Pool but no position
                    console.log("NFT is in Pool but position doesn't exist. Recovering...");
                    const txRecover = await FinancingPool.recoverLockCollateral(
                        invoice.invoiceIdOnChain,
                        invoice.tokenId,
                        signer.address
                    );
                    await txRecover.wait();
                    console.log("Position recovered successfully.");
                    positionExists = true;
                } else {
                    console.log("NFT already in Pool with existing position.");
                }
            } else {
                // Normal flow: Transfer and lock
                // 1. Approve/Transfer NFT to Financing Pool
                console.log("Transferring NFT to Pool...");
                const txTransfer = await InvoiceToken["safeTransferFrom(address,address,uint256)"](
                    signer.address,
                    FinancingPool.address,
                    invoice.tokenId
                );
                await txTransfer.wait();

                // 2. Lock Collateral
                console.log("Locking Collateral...");
                const txLock = await FinancingPool.lockCollateral(
                    invoice.invoiceIdOnChain,
                    invoice.tokenId,
                    signer.address // company receives excess? or who receives credit?
                );
                await txLock.wait();
                positionExists = true;
            }

            // Verify position exists before drawing credit
            if (!positionExists) {
                const finalCheck = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
                if (!finalCheck.exists) {
                    throw new Error("Failed to create position. NFT may be in invalid state.");
                }
            }

            // 3. Draw Credit
            console.log(`Drawing Credit (${requestedAmount.toString()})...`);
            // This function is defined as: drawCredit(bytes32 invoiceId, uint256 amount, address to)
            const txDraw = await FinancingPool.drawCredit(
                invoice.invoiceIdOnChain,
                requestedAmount.toString(),
                signer.address // funds go to signer for this demo
            );
            const receipt = await txDraw.wait();
            console.log(`Credit drawn. Tx: ${receipt.transactionHash}`);

            await prisma.invoice.update({
                where: { id },
                data: { isFinanced: true, status: 'FINANCED' }
            });

            return {
                invoiceId: id,
                approved: true,
                approvedAmount: requestedAmount.toString(),
                txHash: receipt.transactionHash
            };

        } catch (e: any) {
            console.error("Financing failed:", e);
            return reply.code(500).send({ error: e.message || "Financing failed" });
        }
    });

    // POST /invoices/:id/payments
    app.post('/:id/payments', async (req, reply) => {
        // ... (Payment logic remains mostly same, optionally add on-chain recording if Registry supports it)
        const { id } = req.params as { id: string };
        const body = PaymentNotificationSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        const oldPaid = BigInt(invoice.cumulativePaid);
        const paymentAmt = BigInt(body.amount);
        const newPaid = oldPaid + paymentAmt;
        const totalAmt = BigInt(invoice.amount);

        let newStatus = invoice.status;
        if (newPaid >= totalAmt) {
            newStatus = 'PAID';
        } else if (newPaid > 0n && newStatus !== 'PAID') {
            newStatus = 'PARTIALLY_PAID';
        }

        // TODO: On-chain update? Registry emits payment events? 
        // For now, if status changes, the PATCH logic or explicit update here could handle it.
        // But we just update DB here and let the agent or admin sync status if needed.
        // Or we can blindly call Registry.setStatus() if we want consistency.

        if (newStatus !== invoice.status && invoice.invoiceIdOnChain) {
            const InvoiceRegistry = loadContract("InvoiceRegistry");
            const statusEnum = STATUS_MAP[newStatus];
            if (statusEnum) {
                // Async update (fire and forget for latency?)
                InvoiceRegistry.setStatus(invoice.invoiceIdOnChain, statusEnum)
                    .then((tx: any) => tx.wait())
                    .catch((e: any) => console.error("Payment status update failed", e));
            }
        }

        const [payment, updatedInvoice] = await prisma.$transaction([
            prisma.invoicePayment.create({
                data: {
                    invoiceId: id,
                    amount: body.amount,
                    currency: body.currency,
                    paidAt: new Date(body.paidAt),
                    psp: body.psp,
                    txHash: null
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
}
