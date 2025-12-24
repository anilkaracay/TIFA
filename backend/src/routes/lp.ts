import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { provider, signer, loadContract } from '../onchain/provider';
import { ethers } from 'ethers';
import { roleResolutionMiddleware, requireRole, requireWallet } from '../middleware/roleAuth';
import { Role } from '../auth/roles';
import { emitLPEvent, emitPoolEvent } from '../websocket/server';

export async function registerLPRoutes(app: FastifyInstance) {
    // Apply role resolution to all routes
    app.addHook('onRequest', roleResolutionMiddleware);
    
    // POST /lp/deposit - LP only
    app.post('/deposit', { preHandler: [requireWallet, requireRole(Role.LP, Role.ADMIN)] }, async (req, reply) => {
        const body = z.object({
            amount: z.string(), // Amount in liquidityToken units (e.g., "1000000" for 10,000 tokens with 2 decimals)
        }).parse(req.body);

        // Get wallet address from request (set by roleResolutionMiddleware)
        const userWallet = req.wallet || signer.address;

        try {
            const FinancingPool = loadContract("FinancingPool");
            const TestToken = loadContract("TestToken");
            
            // TestToken uses 18 decimals (standard ERC20)
            const amount = ethers.utils.parseUnits(body.amount, 18);
            
            // 1. Approve if needed (using user's wallet, not signer)
            const userSigner = provider.getSigner(userWallet);
            const allowance = await TestToken.allowance(userWallet, FinancingPool.address);
            if (allowance.lt(amount)) {
                const approveTx = await TestToken.connect(userSigner).approve(FinancingPool.address, amount);
                await approveTx.wait();
            }
            
            // 2. Deposit (using user's wallet)
            const tx = await FinancingPool.connect(userSigner).deposit(amount);
            const receipt = await tx.wait();
            
            // 3. Sync LP position (for user's wallet) - MUST be done first for foreign key
            const lpPosition = await FinancingPool.getLPPosition(userWallet);
            const sharePrice = await FinancingPool.sharePriceWad();
            
            await prisma.lPPosition.upsert({
                where: { wallet: userWallet },
                update: {
                    shares: lpPosition.lpShares.toString(),
                    updatedAt: new Date(),
                },
                create: {
                    wallet: userWallet,
                    shares: lpPosition.lpShares.toString(),
                },
            });

            // 4. Record transaction (for user's wallet) - AFTER position exists
            await prisma.lPTransaction.create({
                data: {
                    wallet: userWallet,
                    type: 'Deposit',
                    amount: ethers.utils.formatUnits(amount, 18),
                    lpShares: ethers.utils.formatUnits(lpPosition.lpShares, 18),
                    sharePrice: ethers.utils.formatUnits(sharePrice, 18),
                    balanceImpact: `+${ethers.utils.formatUnits(amount, 18)}`,
                    txHash: receipt.transactionHash,
                    blockNumber: receipt.blockNumber.toString(),
                    status: 'Settled',
                },
            });

            // Emit WebSocket events
            emitLPEvent(userWallet, {
                type: 'lp.deposited',
                payload: {
                    wallet: userWallet,
                    amount: body.amount,
                    lpShares: lpPosition.lpShares.toString(),
                    txHash: receipt.transactionHash,
                },
            });
            emitPoolEvent({
                type: 'pool.liquidity_changed',
                payload: {},
            });

            return {
                success: true,
                txHash: receipt.transactionHash,
                lpShares: lpPosition.lpShares.toString(),
                underlyingValue: lpPosition.underlyingValue.toString(),
            };
        } catch (e: any) {
            console.error("LP deposit failed:", e);
            return reply.code(500).send({ error: e.message || "Deposit failed" });
        }
    });

    // POST /lp/withdraw - LP only
    app.post('/withdraw', { preHandler: [requireWallet, requireRole(Role.LP, Role.ADMIN)] }, async (req, reply) => {
        const body = z.object({
            lpShares: z.string(), // LP shares to burn
        }).parse(req.body);

        // Get wallet address from request (set by roleResolutionMiddleware)
        const userWallet = req.wallet || signer.address;

        try {
            const FinancingPool = loadContract("FinancingPool");
            
            const lpShares = ethers.BigNumber.from(body.lpShares);
            
            // Check utilization
            const utilization = await FinancingPool.utilization();
            const maxUtilization = await FinancingPool.maxUtilizationBps();
            
            if (utilization.gte(maxUtilization)) {
                return reply.code(400).send({ 
                    error: "Utilization too high. Withdrawals disabled.",
                    utilization: utilization.toString(),
                    maxUtilization: maxUtilization.toString(),
                });
            }
            
            // Withdraw (using user's wallet)
            const userSigner = provider.getSigner(userWallet);
            const tx = await FinancingPool.connect(userSigner).withdraw(lpShares);
            const receipt = await tx.wait();
            
            // Sync LP position (for user's wallet) - MUST be done first for foreign key
            const lpPosition = await FinancingPool.getLPPosition(userWallet);
            const sharePrice = await FinancingPool.sharePriceWad();
            const withdrawalAmount = await FinancingPool.calculateWithdrawalAmount(lpShares);
            
            await prisma.lPPosition.upsert({
                where: { wallet: userWallet },
                update: {
                    shares: lpPosition.lpShares.toString(),
                    updatedAt: new Date(),
                },
                create: {
                    wallet: userWallet,
                    shares: lpPosition.lpShares.toString(),
                },
            });

            // Record transaction (for user's wallet) - AFTER position exists
            await prisma.lPTransaction.create({
                data: {
                    wallet: userWallet,
                    type: 'Withdrawal',
                    amount: ethers.utils.formatUnits(withdrawalAmount, 18),
                    lpShares: ethers.utils.formatUnits(lpShares, 18),
                    sharePrice: ethers.utils.formatUnits(sharePrice, 18),
                    balanceImpact: `-${ethers.utils.formatUnits(withdrawalAmount, 18)}`,
                    txHash: receipt.transactionHash,
                    blockNumber: receipt.blockNumber.toString(),
                    status: 'Settled',
                },
            });

            // Emit WebSocket events
            emitLPEvent(userWallet, {
                type: 'lp.withdrawn',
                payload: {
                    wallet: userWallet,
                    lpShares: body.lpShares,
                    remainingShares: lpPosition.lpShares.toString(),
                    txHash: receipt.transactionHash,
                },
            });
            emitPoolEvent({
                type: 'pool.liquidity_changed',
                payload: {},
            });

            return {
                success: true,
                txHash: receipt.transactionHash,
                lpShares: lpPosition.lpShares.toString(),
                underlyingValue: lpPosition.underlyingValue.toString(),
            };
        } catch (e: any) {
            console.error("LP withdraw failed:", e);
            return reply.code(500).send({ error: e.message || "Withdraw failed" });
        }
    });

    // GET /lp/position
    app.get('/position', async (req, reply) => {
        const query = z.object({
            wallet: z.string().optional(),
        }).parse(req.query);

        const wallet = query.wallet || signer.address;

        try {
            const FinancingPool = loadContract("FinancingPool");
            const position = await FinancingPool.getLPPosition(wallet);
            
            // Also get from DB if exists
            const dbPosition = await prisma.lPPosition.findUnique({
                where: { wallet },
            });

            return {
                wallet,
                lpShares: position.lpShares.toString(),
                underlyingValue: position.underlyingValue.toString(),
                sharePrice: position.sharePrice.toString(),
                // Convert from wei/18 decimals to readable format
                lpSharesFormatted: ethers.utils.formatUnits(position.lpShares, 18),
                underlyingValueFormatted: ethers.utils.formatUnits(position.underlyingValue, 18),
                sharePriceFormatted: ethers.utils.formatUnits(position.sharePrice, 18),
                dbShares: dbPosition?.shares || "0",
            };
        } catch (e: any) {
            console.error("Failed to fetch LP position:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch position" });
        }
    });

    // GET /pool/overview (when registered with /pool prefix)
    // GET /overview (when registered with /lp prefix)
    app.get('/overview', async (req, reply) => {
        try {
            const FinancingPool = loadContract("FinancingPool");
            const LPShareToken = loadContract("LPShareToken");
            
            const totalLiquidity = await FinancingPool.totalLiquidity();
            const totalBorrowed = await FinancingPool.totalBorrowed();
            const totalPrincipalOutstanding = await FinancingPool.totalPrincipalOutstanding();
            const totalInterestAccrued = await FinancingPool.totalInterestAccrued();
            const totalLosses = await FinancingPool.totalLosses();
            const protocolFeesAccrued = await FinancingPool.protocolFeesAccrued();
            const reserveBalance = await FinancingPool.reserveBalance();
            const utilization = await FinancingPool.utilization();
            const maxUtilization = await FinancingPool.maxUtilizationBps();
            const availableLiquidity = await FinancingPool.availableLiquidity();
            const lpTokenSupply = await LPShareToken.totalSupply();
            const nav = await FinancingPool.getNAV();
            const lpSharePrice = await FinancingPool.getLPSharePrice(); // Use public function instead of internal sharePriceWad()
            const borrowAprWad = await FinancingPool.borrowAprWad();
            const protocolFeeBps = await FinancingPool.protocolFeeBps();
            const poolStartTime = await FinancingPool.poolStartTime();

            // Calculate APR (since inception, simplified)
            const now = Math.floor(Date.now() / 1000);
            const poolAgeSeconds = now - Number(poolStartTime.toString());
            let apr = "0";
            let apy = "0";
            
            if (poolAgeSeconds > 0 && totalInterestAccrued.gt(0)) {
                // APR = (totalInterestPaidToLP / avgNAV) * (secondsPerYear / poolAgeSeconds)
                // Simplified: use current NAV as avgNAV
                const navValue = Number(ethers.utils.formatUnits(nav, 18));
                if (navValue > 0) {
                    const interestPaidToLP = Number(ethers.utils.formatUnits(totalInterestAccrued.mul(10000 - protocolFeeBps).div(10000), 18));
                    const secondsPerYear = 365 * 24 * 3600;
                    apr = ((interestPaidToLP / navValue) * (secondsPerYear / poolAgeSeconds) * 100).toFixed(2);
                    
                    // APY (daily compounding)
                    const aprDecimal = parseFloat(apr) / 100;
                    apy = ((Math.pow(1 + aprDecimal / 365, 365) - 1) * 100).toFixed(2);
                }
            }

            return {
                totalLiquidity: totalLiquidity.toString(),
                totalBorrowed: totalBorrowed.toString(),
                totalPrincipalOutstanding: totalPrincipalOutstanding.toString(),
                totalInterestAccrued: totalInterestAccrued.toString(),
                totalLosses: totalLosses.toString(),
                protocolFeesAccrued: protocolFeesAccrued.toString(),
                reserveBalance: reserveBalance.toString(),
                availableLiquidity: availableLiquidity.toString(),
                utilization: utilization.toString(), // in basis points
                utilizationPercent: (Number(utilization.toString()) / 100).toFixed(2),
                maxUtilization: maxUtilization.toString(),
                maxUtilizationPercent: (Number(maxUtilization.toString()) / 100).toFixed(2),
                lpTokenSupply: lpTokenSupply.toString(),
                nav: nav.toString(),
                lpSharePrice: lpSharePrice.toString(),
                borrowAprWad: borrowAprWad.toString(),
                protocolFeeBps: protocolFeeBps.toString(),
                poolStartTime: poolStartTime.toString(),
                apr: apr,
                apy: apy,
                // Formatted values
                totalLiquidityFormatted: ethers.utils.formatUnits(totalLiquidity, 18),
                totalBorrowedFormatted: ethers.utils.formatUnits(totalBorrowed, 18),
                totalPrincipalOutstandingFormatted: ethers.utils.formatUnits(totalPrincipalOutstanding, 18),
                totalInterestAccruedFormatted: ethers.utils.formatUnits(totalInterestAccrued, 18),
                totalLossesFormatted: ethers.utils.formatUnits(totalLosses, 18),
                protocolFeesAccruedFormatted: ethers.utils.formatUnits(protocolFeesAccrued, 18),
                availableLiquidityFormatted: ethers.utils.formatUnits(availableLiquidity, 18),
                lpTokenSupplyFormatted: ethers.utils.formatUnits(lpTokenSupply, 18),
                navFormatted: ethers.utils.formatUnits(nav, 18),
                lpSharePriceFormatted: ethers.utils.formatUnits(lpSharePrice, 18),
            };
        } catch (e: any) {
            console.error("Failed to fetch pool overview:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch pool overview" });
        }
    });

    // GET /pool/metrics - Detailed metrics for analytics
    app.get('/metrics', async (req, reply) => {
        try {
            const FinancingPool = loadContract("FinancingPool");
            const LPShareToken = loadContract("LPShareToken");
            
            const nav = await FinancingPool.getNAV();
            const sharePriceWad = await FinancingPool.getLPSharePrice(); // Use public function instead of internal sharePriceWad()
            const totalPrincipalOutstanding = await FinancingPool.totalPrincipalOutstanding();
            const totalInterestAccrued = await FinancingPool.totalInterestAccrued();
            const totalLosses = await FinancingPool.totalLosses();
            const protocolFeesAccrued = await FinancingPool.protocolFeesAccrued();
            const utilization = await FinancingPool.utilization();
            const poolStartTime = await FinancingPool.poolStartTime();
            const borrowAprWad = await FinancingPool.borrowAprWad();
            const protocolFeeBps = await FinancingPool.protocolFeeBps();

            // Calculate APR/APY
            const now = Math.floor(Date.now() / 1000);
            const poolAgeSeconds = now - Number(poolStartTime.toString());
            let apr = "0";
            let apy = "0";
            
            if (poolAgeSeconds > 0 && totalInterestAccrued.gt(0)) {
                const navValue = Number(ethers.utils.formatUnits(nav, 18));
                if (navValue > 0) {
                    const interestPaidToLP = Number(ethers.utils.formatUnits(totalInterestAccrued.mul(10000 - protocolFeeBps).div(10000), 18));
                    const secondsPerYear = 365 * 24 * 3600;
                    apr = ((interestPaidToLP / navValue) * (secondsPerYear / poolAgeSeconds) * 100).toFixed(4);
                    
                    const aprDecimal = parseFloat(apr) / 100;
                    apy = ((Math.pow(1 + aprDecimal / 365, 365) - 1) * 100).toFixed(4);
                }
            }

            return {
                nav: nav.toString(),
                navFormatted: ethers.utils.formatUnits(nav, 18),
                sharePriceWad: sharePriceWad.toString(),
                sharePriceFormatted: ethers.utils.formatUnits(sharePriceWad, 18),
                totalPrincipalOutstanding: totalPrincipalOutstanding.toString(),
                totalPrincipalOutstandingFormatted: ethers.utils.formatUnits(totalPrincipalOutstanding, 18),
                totalInterestAccrued: totalInterestAccrued.toString(),
                totalInterestAccruedFormatted: ethers.utils.formatUnits(totalInterestAccrued, 18),
                totalLosses: totalLosses.toString(),
                totalLossesFormatted: ethers.utils.formatUnits(totalLosses, 18),
                protocolFeesAccrued: protocolFeesAccrued.toString(),
                protocolFeesAccruedFormatted: ethers.utils.formatUnits(protocolFeesAccrued, 18),
                utilization: utilization.toString(),
                utilizationPercent: (Number(utilization.toString()) / 100).toFixed(2),
                apr: apr,
                apy: apy,
                borrowApr: (Number(ethers.utils.formatUnits(borrowAprWad, 18)) * 100).toFixed(2),
                protocolFeePercent: (Number(protocolFeeBps.toString()) / 100).toFixed(2),
                poolStartTime: poolStartTime.toString(),
                poolAgeDays: (poolAgeSeconds / 86400).toFixed(2),
            };
        } catch (e: any) {
            console.error("Failed to fetch pool metrics:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch pool metrics" });
        }
    });

    // POST /lp/record-transaction - Record a transaction from frontend (when deposit/withdraw happens on-chain)
    app.post('/record-transaction', async (req, reply) => {
        try {
            console.log('[LP Transaction] Received request:', {
                headers: req.headers,
                body: req.body,
            });

            const body = z.object({
                type: z.enum(['Deposit', 'Withdrawal']),
                amount: z.string(),
                lpShares: z.string(),
                sharePrice: z.string(),
                txHash: z.string(),
                blockNumber: z.string(),
            }).parse(req.body);

            // Get wallet from request (set by roleResolutionMiddleware or from header)
            const userWallet = req.wallet || req.headers['x-wallet-address'] as string || (req.body as any).wallet;
            
            console.log('[LP Transaction] Extracted wallet:', userWallet);
            
            if (!userWallet) {
                console.error('[LP Transaction] No wallet address found in request');
                return reply.code(400).send({ error: 'Wallet address is required' });
            }

            // Calculate balance impact
            const balanceImpact = body.type === 'Deposit' 
                ? `+${body.amount}` 
                : `-${body.amount}`;

            // CRITICAL: First ensure LPPosition exists (required for foreign key)
            await prisma.lPPosition.upsert({
                where: { wallet: userWallet },
                update: {
                    shares: body.lpShares,
                    updatedAt: new Date(),
                },
                create: {
                    wallet: userWallet,
                    shares: body.lpShares,
                },
            });

            // Now record transaction (LPPosition must exist first for foreign key)
            await prisma.lPTransaction.create({
                data: {
                    wallet: userWallet,
                    type: body.type,
                    amount: body.amount,
                    lpShares: body.lpShares,
                    sharePrice: ethers.utils.formatUnits(ethers.BigNumber.from(body.sharePrice), 18),
                    balanceImpact: balanceImpact,
                    txHash: body.txHash,
                    blockNumber: body.blockNumber,
                    status: 'Settled',
                },
            });

            // Emit WebSocket event
            emitLPEvent(userWallet, {
                type: body.type === 'Deposit' ? 'lp.deposited' : 'lp.withdrawn',
                payload: {
                    wallet: userWallet,
                    amount: body.amount,
                    lpShares: body.lpShares,
                    txHash: body.txHash,
                },
            });

            console.log(`[LP Transaction] Successfully recorded ${body.type} for wallet ${userWallet}:`, {
                amount: body.amount,
                lpShares: body.lpShares,
                txHash: body.txHash,
            });
            return reply.send({ success: true });
        } catch (e: any) {
            console.error("[LP Transaction] Failed to record LP transaction:", e);
            console.error("[LP Transaction] Error details:", {
                headers: req.headers,
                body: req.body,
                error: e.message,
                stack: e.stack,
            });
            return reply.code(500).send({ error: e.message || "Failed to record transaction" });
        }
    });

    // GET /lp/transactions - Get transaction history for LP
    app.get('/transactions', async (req, reply) => {
        const query = z.object({
            wallet: z.string().optional(),
            limit: z.coerce.number().optional().default(50),
            offset: z.coerce.number().optional().default(0),
        }).parse(req.query);

        // Use wallet from query, request, or fallback to signer
        const wallet = query.wallet || req.wallet || signer.address;

        console.log('[LP Transactions] Fetching transactions for wallet:', wallet);

        try {
            const transactions = await prisma.lPTransaction.findMany({
                where: { wallet },
                orderBy: { createdAt: 'desc' },
                take: query.limit,
                skip: query.offset,
            });

            const total = await prisma.lPTransaction.count({
                where: { wallet },
            });

            console.log('[LP Transactions] Found', transactions.length, 'transactions for wallet', wallet);

            return {
                transactions: transactions.map(tx => ({
                    id: tx.id,
                    date: tx.createdAt.toISOString(),
                    type: tx.type,
                    amount: tx.amount,
                    sharePrice: tx.sharePrice,
                    balanceImpact: tx.balanceImpact,
                    status: tx.status,
                    txHash: tx.txHash,
                })),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        } catch (e: any) {
            console.error("Failed to fetch LP transactions:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch transactions" });
        }
    });
}

