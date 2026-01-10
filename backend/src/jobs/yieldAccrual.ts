import { prisma } from '../db';

export async function yieldAccrualJob() {
    console.log('[YieldJob] Starting yield accrual cycle...');

    // Config: 5% APY mock
    // Run this daily ideally, but for demo maybe every minute with tiny amount?
    // Let's assume this job runs every minute and accrues (5% / 365 / 24 / 60) per share.
    // 5% = 0.05.
    // Per minute rate = 0.05 / 525600 ~= 9.5e-8

    const RATE_PER_MINUTE = 0.0000001;

    try {
        const ledgers = await prisma.omnibusLedger.findMany();

        for (const account of ledgers) {
            const shareBalance = BigInt(account.shareBalance);
            if (shareBalance <= 0) continue;

            // Calculate accrual
            // shareBalance is in wei 18 decimals usually.
            // yield is also in wei.
            // yield = shareBalance * RATE
            const yieldAmount = Number(shareBalance) * RATE_PER_MINUTE; // precision loss acceptable for demo
            const yieldWei = BigInt(Math.floor(yieldAmount));

            if (yieldWei > 0) {
                await prisma.yieldAccount.upsert({
                    where: { wallet_poolId: { wallet: account.wallet, poolId: account.poolId } },
                    update: {
                        accruedYield: (yieldWei).toString()
                        // Note: Prisma needs string manipulation if existing value > 0.
                        // Ideally we read, add, update. Or raw query.
                        // Let's read-add-update.
                    },
                    create: {
                        wallet: account.wallet,
                        poolId: account.poolId,
                        accruedYield: yieldWei.toString()
                    }
                });

                // Proper atomic generic update
                // Since this is a loop, concurrency is low for demo.
                const existing = await prisma.yieldAccount.findUnique({
                    where: { wallet_poolId: { wallet: account.wallet, poolId: account.poolId } }
                });
                if (existing) {
                    const current = BigInt(existing.accruedYield);
                    await prisma.yieldAccount.update({
                        where: { id: existing.id },
                        data: { accruedYield: (current + yieldWei).toString() }
                    });
                }
            }
        }
        console.log(`[YieldJob] Accrued yield for ${ledgers.length} accounts.`);
    } catch (e) {
        console.error('[YieldJob] Failed:', e);
    }
}

export function startYieldAccrualJob() {
    // Run every 60 seconds
    setInterval(yieldAccrualJob, 60000);
}
