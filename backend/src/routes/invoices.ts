import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import {
    InvoiceCreateSchema,
    InvoiceUpdateSchema,
    PaymentNotificationSchema,
    FinancingRequestSchema,
    RecoursePaymentSchema,
    DefaultDeclarationSchema,
    RepayNotificationSchema
} from '../schemas/invoices';
import { ethers } from 'ethers';
import { provider, signer, loadContract } from '../onchain/provider';
import { roleResolutionMiddleware, requireRole, requireWallet } from '../middleware/roleAuth';
import { Role } from '../auth/roles';
import { emitInvoiceEvent, emitPoolEvent } from '../websocket/server';

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
    // Apply role resolution to all routes
    app.addHook('onRequest', roleResolutionMiddleware);

    // POST /invoices - ISSUER only
    app.post('/', { preHandler: [requireWallet, requireRole(Role.ISSUER, Role.ADMIN)] }, async (req, reply) => {
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

        // Emit WebSocket event
        emitInvoiceEvent(invoice.id, {
            type: 'invoice.created',
            payload: { invoiceId: invoice.id, externalId: invoice.externalId, status: invoice.status },
        });

        return invoice;
    });

    // GET /invoices
    app.get('/', async (req, reply) => {
        const query = z.object({
            companyId: z.string().optional(),
            status: z.string().optional(),
            limit: z.coerce.number().optional().default(100) // Increased default limit
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

        // Fetch debt information: Use DB first, then on-chain as fallback
        const FinancingPool = loadContract("FinancingPool");
        const invoicesWithDebt = await Promise.all(
            invoices.map(async (inv) => {
                // Use DB value if exists, otherwise read from on-chain
                if (inv.invoiceIdOnChain && inv.isFinanced) {
                    let usedCredit = inv.usedCredit || "0";
                    let maxCreditLine = inv.maxCreditLine || "0";
                    
                    // If DB doesn't have values, read from on-chain and sync
                    if (!inv.usedCredit || inv.usedCredit === "0" || !inv.maxCreditLine || inv.maxCreditLine === "0") {
                        try {
                            const position = await FinancingPool.getPosition(inv.invoiceIdOnChain);
                            if (position.exists) {
                                usedCredit = position.usedCredit.toString();
                                maxCreditLine = position.maxCreditLine.toString();
                                
                                // Sync to DB
                                await prisma.invoice.update({
                                    where: { id: inv.id },
                                    data: {
                                        usedCredit: usedCredit,
                                        maxCreditLine: maxCreditLine,
                                    }
                                });
                            }
                        } catch (e) {
                            console.error(`Error fetching debt for invoice ${inv.id}:`, e);
                        }
                    }
                    
                    return {
                        ...inv,
                        usedCredit: usedCredit,
                        maxCreditLine: maxCreditLine
                    };
                }
                
                return {
                    ...inv,
                    usedCredit: inv.usedCredit || "0",
                    maxCreditLine: inv.maxCreditLine || "0"
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
        
        // If financed, ensure usedCredit is populated
        if (invoice.isFinanced && invoice.invoiceIdOnChain) {
            if (!invoice.usedCredit || invoice.usedCredit === "0" || !invoice.maxCreditLine || invoice.maxCreditLine === "0") {
                try {
                    const FinancingPool = loadContract("FinancingPool");
                    const position = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
                    if (position.exists) {
                        // Sync to DB
                        await prisma.invoice.update({
                            where: { id },
                            data: {
                                usedCredit: position.usedCredit.toString(),
                                maxCreditLine: position.maxCreditLine.toString(),
                            }
                        });
                        invoice.usedCredit = position.usedCredit.toString();
                        invoice.maxCreditLine = position.maxCreditLine.toString();
                    }
                } catch (e) {
                    console.error(`Error fetching debt for invoice ${id}:`, e);
                }
            }
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

        // Emit WebSocket event if status changed
        if (body.status && body.status !== invoice.status) {
            emitInvoiceEvent(id, {
                type: 'invoice.status_changed',
                payload: { 
                    invoiceId: id, 
                    externalId: invoice.externalId,
                    previousStatus: invoice.status, 
                    newStatus: body.status 
                },
            });
        }

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

            // Emit WebSocket event
            emitInvoiceEvent(id, {
                type: 'invoice.tokenized',
                payload: { 
                    invoiceId: id, 
                    externalId: invoice.externalId,
                    tokenId, 
                    invoiceIdOnChain,
                    txHash: receipt.transactionHash 
                },
            });

            return { ...updated, txHash: receipt.transactionHash };

        } catch (e: any) {
            console.error("Tokenization failed:", e);
            return reply.code(500).send({ error: e.message || "Tokenization failed" });
        }
    });

    // POST /invoices/:id/finance
    // POST /invoices/:id/finance - ISSUER only
    app.post('/:id/finance', { preHandler: [requireWallet, requireRole(Role.ISSUER, Role.ADMIN)] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = FinancingRequestSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

        if (invoice.status !== 'TOKENIZED') return reply.code(400).send({ error: 'Invoice must be TOKENIZED' });
        if (invoice.isFinanced) {
            // Already financed - check if this is a notification for an existing transaction
            if (body.txHash) {
                console.log(`[Finance] Notification for already-financed invoice ${invoice.externalId}, txHash: ${body.txHash}`);
                return {
                    invoiceId: id,
                    approved: true,
                    approvedAmount: body.amount || invoice.amount,
                    txHash: body.txHash,
                    message: 'Invoice already financed, notification received'
                };
            }
            return reply.code(400).send({ error: 'Already financed' });
        }
        if (!invoice.invoiceIdOnChain || !invoice.tokenId) return reply.code(400).send({ error: 'Missing on-chain data' });

        // Calculate requested amount: 60% of invoice amount (matching LTV rate)
        // Convert invoice.amount (string like "100000") to cents and apply 60% LTV
        const invoiceAmountInCents = BigInt(Math.floor(parseFloat(invoice.amount) * 100));
        const requestedAmount = body.amount ? BigInt(body.amount) : invoiceAmountInCents * 6000n / 10000n; // 60% LTV

        try {
            // If txHash is provided, on-chain transaction was already completed by frontend
            if (body.txHash) {
                console.log(`[Finance] On-chain transaction already completed for ${invoice.externalId}, txHash: ${body.txHash}`);
                
                // Verify the transaction on-chain and get position data
                let usedCredit = requestedAmount.toString();
                let maxCreditLine = requestedAmount.toString();
                try {
                    const FinancingPool = loadContract("FinancingPool");
                    const position = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
                    
                    if (position.exists) {
                        usedCredit = position.usedCredit.toString();
                        maxCreditLine = position.maxCreditLine.toString();
                    } else {
                        console.warn(`[Finance] Position not found for invoice ${invoice.externalId} after on-chain transaction`);
                        // Still update DB as transaction was successful
                    }
                } catch (verifyError) {
                    console.warn(`[Finance] Could not verify position on-chain:`, verifyError);
                    // Continue anyway as transaction hash is provided
                }

                // Update database to reflect financing
                const updated = await prisma.invoice.update({
                    where: { id },
                    data: { 
                        isFinanced: true, 
                        status: 'FINANCED',
                        usedCredit: usedCredit,
                        maxCreditLine: maxCreditLine,
                    }
                });

                // Emit WebSocket events
                emitInvoiceEvent(id, {
                    type: 'invoice.financed',
                    payload: { 
                        invoiceId: id, 
                        externalId: invoice.externalId,
                        approvedAmount: requestedAmount.toString(),
                        txHash: body.txHash 
                    },
                });
                emitPoolEvent({
                    type: 'pool.utilization_changed',
                    payload: {},
                });

                return {
                    invoiceId: id,
                    approved: true,
                    approvedAmount: requestedAmount.toString(),
                    txHash: body.txHash
                };
            }

            console.log(`Financing invoice ${invoice.externalId}...`);

            // MOCK MODE: If no private key or explicitly enabled
            if (!process.env.PRIVATE_KEY) {
                console.log("⚠️ Mock Mode: Simulating financing...");
                await new Promise(r => setTimeout(r, 2000));

                const mockTxHash = "0x" + Math.random().toString(16).slice(2).repeat(4);

                const updated = await prisma.invoice.update({
                    where: { id },
                    data: { 
                        isFinanced: true, 
                        status: 'FINANCED',
                        usedCredit: requestedAmount.toString(),
                        maxCreditLine: requestedAmount.toString(),
                    }
                });

                // Emit WebSocket event
                emitInvoiceEvent(id, {
                    type: 'invoice.financed',
                    payload: { 
                        invoiceId: id, 
                        externalId: invoice.externalId,
                        approvedAmount: requestedAmount.toString(),
                        txHash: mockTxHash 
                    },
                });
                emitPoolEvent({
                    type: 'pool.utilization_changed',
                    payload: {},
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

            // Read position after credit draw to get actual usedCredit and maxCreditLine
            const finalPosition = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
            const updated = await prisma.invoice.update({
                where: { id },
                data: { 
                    isFinanced: true, 
                    status: 'FINANCED',
                    usedCredit: finalPosition.usedCredit.toString(),
                    maxCreditLine: finalPosition.maxCreditLine.toString(),
                }
            });

            // Emit WebSocket events
            emitInvoiceEvent(id, {
                type: 'invoice.financed',
                payload: { 
                    invoiceId: id, 
                    externalId: invoice.externalId,
                    approvedAmount: requestedAmount.toString(),
                    txHash: receipt.transactionHash 
                },
            });
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
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
    // POST /invoices/:id/payments - ISSUER only
    app.post('/:id/payments', { preHandler: [requireWallet, requireRole(Role.ISSUER, Role.ADMIN)] }, async (req, reply) => {
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

        // Emit WebSocket event
        emitInvoiceEvent(id, {
            type: 'invoice.payment_recorded',
            payload: { 
                invoiceId: id, 
                externalId: invoice.externalId,
                paymentAmount: body.amount,
                cumulativePaid: newPaid.toString(),
                status: newStatus 
            },
        });
        if (newStatus === 'PAID') {
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
            });
        }

        return { payment, invoice: updatedInvoice };
    });

    // POST /invoices/:id/recourse-payment - ISSUER only (for RECOURSE invoices)
    app.post('/:id/recourse-payment', { preHandler: [requireWallet, requireRole(Role.ISSUER, Role.ADMIN)] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = RecoursePaymentSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });
        if (!invoice.invoiceIdOnChain) return reply.code(400).send({ error: 'Invoice not on-chain' });
        if (!invoice.isFinanced) return reply.code(400).send({ error: 'Invoice not financed' });

        try {
            const FinancingPool = loadContract("FinancingPool");
            const position = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
            
            if (!position.exists) {
                return reply.code(404).send({ error: 'Position not found on-chain' });
            }

            // Check if invoice is in RECOURSE mode
            // RecourseMode enum: 0 = RECOURSE, 1 = NON_RECOURSE
            const recourseMode = Number(position.recourseMode);
            if (recourseMode !== 0) {
                return reply.code(400).send({ error: 'Invoice is not in RECOURSE mode' });
            }

            // Check if invoice is in default
            if (!position.isInDefault) {
                return reply.code(400).send({ error: 'Invoice is not in default' });
            }

            // Calculate total debt (principal + interest)
            const totalDebt = position.usedCredit.add(position.interestAccrued);
            const paymentAmount = ethers.BigNumber.from(body.amount);

            // Pay recourse on-chain
            const TestToken = loadContract("TestToken");
            const amountWei = ethers.utils.parseUnits(body.amount, 18);

            // Check allowance
            const allowance = await TestToken.allowance(signer.address, FinancingPool.address);
            if (allowance.lt(amountWei)) {
                const approveTx = await TestToken.approve(FinancingPool.address, amountWei);
                await approveTx.wait();
            }

            // Execute recourse payment
            const tx = await FinancingPool.payRecourse(invoice.invoiceIdOnChain, amountWei);
            const receipt = await tx.wait();

            // Update invoice status if fully paid
            const updatedPosition = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
            let newStatus = invoice.status;
            if (updatedPosition.usedCredit.eq(0) && updatedPosition.interestAccrued.eq(0)) {
                newStatus = 'PAID';
            }

            const updatedInvoice = await prisma.invoice.update({
                where: { id },
                data: {
                    status: newStatus,
                    cumulativePaid: totalDebt.toString(), // Update cumulative paid
                }
            });

            // Emit WebSocket event
            emitInvoiceEvent(id, {
                type: 'invoice.recourse_paid',
                payload: {
                    invoiceId: id,
                    externalId: invoice.externalId,
                    amount: body.amount,
                    txHash: receipt.transactionHash,
                    status: newStatus,
                },
            });
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
            });

            return {
                success: true,
                invoice: updatedInvoice,
                txHash: receipt.transactionHash,
            };
        } catch (e: any) {
            console.error("Recourse payment failed:", e);
            return reply.code(500).send({ error: e.message || "Recourse payment failed" });
        }
    });

    // POST /invoices/:id/declare-default - ADMIN only
    app.post('/:id/declare-default', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = DefaultDeclarationSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });
        if (!invoice.invoiceIdOnChain) return reply.code(400).send({ error: 'Invoice not on-chain' });
        if (!invoice.isFinanced) return reply.code(400).send({ error: 'Invoice not financed' });

        try {
            const FinancingPool = loadContract("FinancingPool");
            const position = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
            
            if (!position.exists) {
                return reply.code(404).send({ error: 'Position not found on-chain' });
            }

            if (position.usedCredit.eq(0)) {
                return reply.code(400).send({ error: 'No outstanding debt' });
            }

            // Check if grace period has ended
            const graceEndsAt = position.graceEndsAt;
            if (graceEndsAt.eq(0)) {
                return reply.code(400).send({ error: 'Grace period not started. Call markOverdueAndStartGrace first.' });
            }

            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime < graceEndsAt.toNumber()) {
                return reply.code(400).send({ 
                    error: 'Grace period not ended',
                    graceEndsAt: graceEndsAt.toString(),
                    currentTime: currentTime.toString(),
                });
            }

            if (position.isInDefault) {
                return reply.code(400).send({ error: 'Already in default' });
            }

            // Declare default on-chain
            const tx = await FinancingPool.declareDefault(invoice.invoiceIdOnChain);
            const receipt = await tx.wait();

            // Calculate loss amount
            const totalDebt = position.usedCredit.add(position.interestAccrued);
            const recourseMode = Number(position.recourseMode);
            const lossAmount = recourseMode === 0 ? "0" : totalDebt.toString(); // Loss only for NON_RECOURSE

            // Update invoice status
            const updatedInvoice = await prisma.invoice.update({
                where: { id },
                data: {
                    status: 'DEFAULTED',
                }
            });

            // Emit WebSocket event
            emitInvoiceEvent(id, {
                type: 'invoice.default_declared',
                payload: {
                    invoiceId: id,
                    externalId: invoice.externalId,
                    totalDebt: totalDebt.toString(),
                    lossAmount: body.lossAmount || lossAmount,
                    recourseMode: recourseMode === 0 ? 'RECOURSE' : 'NON_RECOURSE',
                    txHash: receipt.transactionHash,
                    reason: body.reason,
                },
            });
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
            });

            return {
                success: true,
                invoice: updatedInvoice,
                totalDebt: totalDebt.toString(),
                lossAmount: body.lossAmount || lossAmount,
                recourseMode: recourseMode === 0 ? 'RECOURSE' : 'NON_RECOURSE',
                txHash: receipt.transactionHash,
            };
        } catch (e: any) {
            console.error("Default declaration failed:", e);
            return reply.code(500).send({ error: e.message || "Default declaration failed" });
        }
    });

    // POST /invoices/:id/repay-notification - Notification after on-chain repayCredit transaction
    app.post('/:id/repay-notification', { preHandler: [requireWallet] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = RepayNotificationSchema.parse(req.body);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });
        if (!invoice.invoiceIdOnChain) return reply.code(400).send({ error: 'Invoice not on-chain' });
        if (!invoice.isFinanced) return reply.code(400).send({ error: 'Invoice not financed' });

        try {
            const FinancingPool = loadContract("FinancingPool");
            const position = await FinancingPool.getPosition(invoice.invoiceIdOnChain);
            
            if (!position.exists) {
                return reply.code(404).send({ error: 'Position not found on-chain' });
            }

            // Read current usedCredit from on-chain (after repayment)
            const currentUsedCredit = position.usedCredit;
            const interestAccrued = position.interestAccrued;
            const totalDebt = currentUsedCredit.add(interestAccrued);

            // Determine if invoice is fully paid
            let newStatus = invoice.status;
            if (currentUsedCredit.eq(0) && interestAccrued.eq(0)) {
                newStatus = 'PAID';
            } else if (currentUsedCredit.lt(BigInt(invoice.usedCredit || "0"))) {
                // Partial repayment
                if (newStatus !== 'PAID') {
                    newStatus = 'PARTIALLY_PAID';
                }
            }

            // Update invoice with new usedCredit
            const updatedInvoice = await prisma.invoice.update({
                where: { id },
                data: {
                    usedCredit: currentUsedCredit.toString(),
                    status: newStatus,
                }
            });

            // Emit WebSocket event
            emitInvoiceEvent(id, {
                type: 'invoice.repaid',
                payload: {
                    invoiceId: id,
                    externalId: invoice.externalId,
                    repaidAmount: body.amount || (BigInt(invoice.usedCredit || "0").sub(currentUsedCredit).toString()),
                    remainingDebt: currentUsedCredit.toString(),
                    totalDebt: totalDebt.toString(),
                    status: newStatus,
                    txHash: body.txHash,
                },
            });

            // Emit pool utilization change event
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
            });

            return {
                success: true,
                invoice: updatedInvoice,
                remainingDebt: currentUsedCredit.toString(),
                totalDebt: totalDebt.toString(),
                status: newStatus,
            };
        } catch (e: any) {
            console.error("Repay notification failed:", e);
            return reply.code(500).send({ error: e.message || "Repay notification failed" });
        }
    });

    // Register x402 payment routes
    const { registerX402Routes } = await import('../x402/routes');
    await registerX402Routes(app);
}
