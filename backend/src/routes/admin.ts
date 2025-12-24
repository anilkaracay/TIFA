import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loadContract } from '../onchain/provider';
import { ethers } from 'ethers';
import { roleResolutionMiddleware, requireRole, requireWallet } from '../middleware/roleAuth';
import { Role } from '../auth/roles';
import { emitPoolEvent } from '../websocket/server';

export async function registerAdminRoutes(app: FastifyInstance) {
    // Apply role resolution
    app.addHook('onRequest', roleResolutionMiddleware);

    // GET /admin/status - Check admin access
    app.get('/status', async (req, reply) => {
        const wallet = (req.query as any)?.wallet || req.headers['x-wallet-address'];
        if (!wallet) {
            return reply.code(400).send({ error: 'WALLET_REQUIRED' });
        }

        const isAdmin = req.role === Role.ADMIN;
        return {
            wallet,
            role: req.role || Role.UNKNOWN,
            isAdmin,
            readOnly: !isAdmin,
        };
    });

    // POST /admin/pool/pause - ADMIN only
    app.post('/pool/pause', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        try {
            const FinancingPool = loadContract('FinancingPool');
            const tx = await FinancingPool.pause();
            await tx.wait();
            
            // Emit WebSocket event
            emitPoolEvent({
                type: 'pool.paused',
                payload: { txHash: tx.hash },
            });
            
            return { success: true, txHash: tx.hash };
        } catch (e: any) {
            reply.code(500);
            return { error: e.message || 'Failed to pause pool' };
        }
    });

    // POST /admin/pool/unpause - ADMIN only
    app.post('/pool/unpause', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        try {
            const FinancingPool = loadContract('FinancingPool');
            const tx = await FinancingPool.unpause();
            await tx.wait();
            
            // Emit WebSocket event
            emitPoolEvent({
                type: 'pool.unpaused',
                payload: { txHash: tx.hash },
            });
            
            return { success: true, txHash: tx.hash };
        } catch (e: any) {
            reply.code(500);
            return { error: e.message || 'Failed to unpause pool' };
        }
    });

    // POST /admin/pool/params - ADMIN only
    app.post('/pool/params', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        const body = z.object({
            maxUtilizationBps: z.number().optional(),
            maxLoanBpsOfTVL: z.number().optional(),
            maxIssuerExposureBps: z.number().optional(),
        }).parse(req.body);

        try {
            const FinancingPool = loadContract('FinancingPool');
            const txs = [];

            if (body.maxUtilizationBps !== undefined) {
                const tx = await FinancingPool.setMaxUtilizationBps(body.maxUtilizationBps);
                txs.push(tx);
            }
            if (body.maxLoanBpsOfTVL !== undefined) {
                const tx = await FinancingPool.setMaxLoanBpsOfTVL(body.maxLoanBpsOfTVL);
                txs.push(tx);
            }
            if (body.maxIssuerExposureBps !== undefined) {
                const tx = await FinancingPool.setMaxIssuerExposureBps(body.maxIssuerExposureBps);
                txs.push(tx);
            }

            await Promise.all(txs.map(tx => tx.wait()));
            
            // Emit WebSocket event
            emitPoolEvent({
                type: 'pool.params_updated',
                payload: { 
                    params: body,
                    txHashes: txs.map(tx => tx.hash) 
                },
            });
            
            return { success: true, txHashes: txs.map(tx => tx.hash) };
        } catch (e: any) {
            reply.code(500);
            return { error: e.message || 'Failed to update pool params' };
        }
    });

    // POST /admin/pool/reserve/fund - ADMIN only
    app.post('/pool/reserve/fund', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        const body = z.object({
            amount: z.string(),
        }).parse(req.body);

        try {
            const FinancingPool = loadContract('FinancingPool');
            const amount = ethers.utils.parseUnits(body.amount, 18);
            const tx = await FinancingPool.fundReserve(amount);
            await tx.wait();
            
            // Emit WebSocket event
            emitPoolEvent({
                type: 'pool.reserve_funded',
                payload: { 
                    amount: body.amount,
                    txHash: tx.hash 
                },
            });
            
            return { success: true, txHash: tx.hash };
        } catch (e: any) {
            reply.code(500);
            return { error: e.message || 'Failed to fund reserve' };
        }
    });

    // GET /admin/pool/status - Read pool status (public read-only)
    app.get('/pool/status', async (req, reply) => {
        try {
            const FinancingPool = loadContract('FinancingPool');
            const [paused, maxUtilization, maxLoanBps, maxIssuerExposureBps, reserveBalance, reserveTargetBps] = await Promise.all([
                FinancingPool.paused(),
                FinancingPool.maxUtilizationBps(),
                FinancingPool.maxLoanBpsOfTVL(),
                FinancingPool.maxIssuerExposureBps(),
                FinancingPool.reserveBalance(),
                FinancingPool.reserveTargetBps().catch(() => ethers.BigNumber.from(0)),
            ]);

            return {
                paused,
                maxUtilizationBps: maxUtilization.toString(),
                maxLoanBpsOfTVL: maxLoanBps.toString(),
                maxIssuerExposureBps: maxIssuerExposureBps.toString(),
                reserveBalance: reserveBalance.toString(),
                reserveTargetBps: reserveTargetBps.toString(),
            };
        } catch (e: any) {
            reply.code(500);
            return { error: e.message || 'Failed to fetch pool status' };
        }
    });
}

