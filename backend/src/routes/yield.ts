import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { complianceGate } from '../compliance/gate';
import { requireWallet, roleResolutionMiddleware } from '../middleware/roleAuth';
import { Role } from '../auth/roles';

export async function registerYieldRoutes(app: FastifyInstance) {
    app.addHook('onRequest', roleResolutionMiddleware);

    // GET /yield/summary
    app.get('/summary', { preHandler: [requireWallet] }, async (req, reply) => {
        const wallet = req.wallet!;
        const poolId = "DEFAULT_POOL"; // or query

        const account = await prisma.yieldAccount.findUnique({
            where: { wallet_poolId: { wallet, poolId } }
        });

        return {
            wallet,
            poolId,
            accruedYield: account?.accruedYield || "0",
            claimedYield: account?.claimedYield || "0",
            heldYield: account?.heldYield || "0"
        };
    });

    // POST /yield/claim
    app.post('/claim', { preHandler: [requireWallet] }, async (req, reply) => {
        const wallet = req.wallet!;
        const poolId = "DEFAULT_POOL";

        const account = await prisma.yieldAccount.findUnique({
            where: { wallet_poolId: { wallet, poolId } }
        });

        if (!account || BigInt(account.accruedYield) <= 0) {
            return reply.code(400).send({ error: "No yield to claim" });
        }

        // Compliance Check
        const gate = await complianceGate.checkGate(wallet, 'LP', 'CLAIM_YIELD');

        const accrued = BigInt(account.accruedYield);

        if (!gate.allowed) {
            // Move to HELD
            await prisma.yieldAccount.update({
                where: { id: account.id },
                data: {
                    accruedYield: "0",
                    heldYield: (BigInt(account.heldYield) + accrued).toString()
                }
            });

            await prisma.complianceAuditLog.create({
                data: {
                    action: 'YIELD_HELD',
                    actorType: 'SYSTEM',
                    actorId: 'YIELD_SERVICE',
                    targetId: wallet,
                    metadata: JSON.stringify({ amount: accrued.toString(), reason: gate.reason })
                }
            });

            return reply.code(403).send({
                error: "COMPLIANCE_RESTRICTED",
                message: "Yield held due to compliance check failure.",
                heldAmount: accrued.toString()
            });
        }

        // Else Allowed -> Claim
        await prisma.yieldAccount.update({
            where: { id: account.id },
            data: {
                accruedYield: "0",
                claimedYield: (BigInt(account.claimedYield) + accrued).toString()
            }
        });

        // Trigger On-Chain transfer (Mocked for now as we don't have yield token contract in scope)
        // In real app: await Token.transfer(wallet, accrued)

        await prisma.complianceAuditLog.create({
            data: {
                action: 'YIELD_CLAIMED',
                actorType: 'USER',
                actorId: wallet,
                targetId: wallet,
                metadata: JSON.stringify({ amount: accrued.toString() })
            }
        });

        return {
            success: true,
            claimedAmount: accrued.toString(),
            txHash: "0xMOCK_CLAIM_TX_HASH"
        };
    });
}
