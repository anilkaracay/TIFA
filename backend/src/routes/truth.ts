import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import {
    getReconciledSnapshot,
    getInvoiceTruth,
    getLPPositionTruth,
    calculateYieldFromEvents,
} from '../services/truthService';
import { loadContract } from '../onchain/provider';

export async function registerTruthRoutes(app: FastifyInstance) {
    // GET /truth/pool - Reconciled pool truth
    app.get('/pool', async (req, reply) => {
        try {
            const reconciled = await getReconciledSnapshot();
            return reconciled;
        } catch (e: any) {
            reply.code(500);
            return { error: `Failed to fetch pool truth: ${e.message}` };
        }
    });
    
    // GET /truth/invoice/:id - Invoice truth from on-chain
    app.get<{ Params: { id: string } }>('/invoice/:id', async (req, reply) => {
        try {
            const { id } = req.params;
            
            // Get invoice from DB
            const dbInvoice = await prisma.invoice.findUnique({
                where: { id },
                include: { payments: true },
            });
            
            if (!dbInvoice) {
                reply.code(404);
                return { error: 'Invoice not found in database' };
            }
            
            // If no on-chain ID, return DB only
            if (!dbInvoice.invoiceIdOnChain) {
                return {
                    onchain: null,
                    db: {
                        id: dbInvoice.id,
                        externalId: dbInvoice.externalId,
                        status: dbInvoice.status,
                        isFinanced: dbInvoice.isFinanced,
                        amount: dbInvoice.amount,
                        cumulativePaid: dbInvoice.cumulativePaid,
                    },
                    dbOutOfSync: false,
                    note: 'Invoice not yet tokenized on-chain',
                };
            }
            
            // Get on-chain truth
            const onchainTruth = await getInvoiceTruth(dbInvoice.invoiceIdOnChain);
            
            // Compare with DB (simple check)
            const dbOutOfSync = dbInvoice.isFinanced !== (onchainTruth.onchain.exists && Number(onchainTruth.onchain.usedCredit) > 0);
            
            return {
                onchain: onchainTruth.onchain,
                db: {
                    id: dbInvoice.id,
                    externalId: dbInvoice.externalId,
                    status: dbInvoice.status,
                    isFinanced: dbInvoice.isFinanced,
                    amount: dbInvoice.amount,
                    cumulativePaid: dbInvoice.cumulativePaid,
                },
                dbOutOfSync,
            };
        } catch (e: any) {
            reply.code(500);
            return { error: `Failed to fetch invoice truth: ${e.message}` };
        }
    });
    
    // GET /truth/lp/:wallet - LP position truth
    app.get<{ Params: { wallet: string } }>('/lp/:wallet', async (req, reply) => {
        try {
            const { wallet } = req.params;
            
            // Validate address
            if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
                reply.code(400);
                return { error: 'Invalid wallet address' };
            }
            
            const position = await getLPPositionTruth(wallet);
            
            // Optionally compare with subgraph if available
            // For now, return on-chain truth only
            
            return {
                wallet,
                ...position,
                computedFrom: 'onchain',
                note: 'Underlying value computed from canonical sharePriceWad',
            };
        } catch (e: any) {
            reply.code(500);
            return { error: `Failed to fetch LP position truth: ${e.message}` };
        }
    });
    
    // GET /truth/pool/yield - APR/APY from events
    app.get('/pool/yield', async (req, reply) => {
        try {
            const query = z.object({
                windowDays: z.coerce.number().optional().default(7),
            }).parse(req.query);
            
            const yieldData = await calculateYieldFromEvents(query.windowDays);
            return yieldData;
        } catch (e: any) {
            reply.code(500);
            return { error: `Failed to calculate yield: ${e.message}` };
        }
    });
}









