import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../env';
import { requireWallet, roleResolutionMiddleware } from '../middleware/roleAuth';
import { Role } from '../auth/roles';

export async function registerCustodyRoutes(app: FastifyInstance) {
    app.addHook('onRequest', roleResolutionMiddleware);

    // GET /custody/vault - Public vault info
    app.get('/vault', async (req, reply) => {
        // Aggregate all deposits (simulated by summing ledgers)
        // Prisma _sum on string is not supported, so fetching all for demo
        const allLedgers = await prisma.omnibusLedger.findMany();
        let totalShares = BigInt(0);
        for (const l of allLedgers) {
            totalShares += BigInt(l.shareBalance);
        }

        return {
            vaultAddress: env.OMNIBUS_VAULT_ADDRESS,
            totalSharesCustodied: totalShares.toString(),
            poolId: "DEFAULT_POOL"
        };
    });

    // GET /custody/ledger - My ledger entries
    app.get('/ledger', { preHandler: [requireWallet] }, async (req, reply) => {
        const poolId = "DEFAULT_POOL"; // or from query
        const wallet = req.wallet!;

        const ledger = await prisma.omnibusLedger.findUnique({
            where: { wallet_poolId: { wallet, poolId } }
        });

        return {
            poolId,
            wallet,
            shareBalance: ledger?.shareBalance || "0",
            status: "ACTIVE"
        };
    });
}
