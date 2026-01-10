import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { getProvider, getSigner, loadContract } from '../onchain/provider';
import { getChainIdFromRequest } from '../utils/chain';
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
        const userWallet = req.wallet || getSigner(getChainIdFromRequest(req)).address;

        try {
            const FinancingPool = loadContract("FinancingPool", getChainIdFromRequest(req));
            const TestToken = loadContract("TestToken", getChainIdFromRequest(req));

            // TestToken uses 18 decimals (standard ERC20)
            const amount = ethers.utils.parseUnits(body.amount, 18);

            // 1. Approve if needed (using user's wallet, not signer)
            const userSigner = getProvider(getChainIdFromRequest(req)).getSigner(userWallet);
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
        const userWallet = req.wallet || getSigner(getChainIdFromRequest(req)).address;

        try {
            const FinancingPool = loadContract("FinancingPool", getChainIdFromRequest(req));

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
            const userSigner = getProvider(getChainIdFromRequest(req)).getSigner(userWallet);
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

        const wallet = query.wallet || getSigner(getChainIdFromRequest(req)).address;

        try {
            const FinancingPool = loadContract("FinancingPool", getChainIdFromRequest(req));
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
            const FinancingPool = loadContract("FinancingPool", getChainIdFromRequest(req));
            const LPShareToken = loadContract("LPShareToken", getChainIdFromRequest(req));

            const totalLiquidity = await FinancingPool.totalLiquidity();
            const totalBorrowed = await FinancingPool.totalBorrowed();
            // totalPrincipalOutstanding is an alias for totalBorrowed in the contract
            const totalPrincipalOutstanding = totalBorrowed;
            // Public variables that may not be in ABI - use default values
            const totalInterestAccrued = ethers.BigNumber.from(0); // Will be calculated from positions if needed
            const totalLosses = ethers.BigNumber.from(0);
            const protocolFeesAccrued = ethers.BigNumber.from(0);
            const reserveBalance = await FinancingPool.reserveBalance().catch(() => ethers.BigNumber.from(0));
            const utilization = await FinancingPool.utilization();
            const maxUtilization = ethers.BigNumber.from(8000); // Default 80% (8000 bps)
            const availableLiquidity = await FinancingPool.availableLiquidity();
            const lpTokenSupply = await LPShareToken.totalSupply();
            const nav = await FinancingPool.getNAV();
            const lpSharePrice = await FinancingPool.getLPSharePrice();
            const borrowAprWad = ethers.BigNumber.from(0); // Default 0%
            const protocolFeeBps = ethers.BigNumber.from(1000); // Default 10% (1000 bps)
            const poolStartTime = ethers.BigNumber.from(Math.floor(Date.now() / 1000)); // Use current time as default

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
                    const protocolFeeBpsNum = Number(protocolFeeBps);
                    const interestPaidToLP = Number(ethers.utils.formatUnits(totalInterestAccrued.mul(10000 - protocolFeeBpsNum).div(10000), 18));
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
            const FinancingPool = loadContract("FinancingPool", getChainIdFromRequest(req));
            const LPShareToken = loadContract("LPShareToken", getChainIdFromRequest(req));

            const nav = await FinancingPool.getNAV();
            const sharePriceWad = await FinancingPool.getLPSharePrice();
            const totalBorrowed = await FinancingPool.totalBorrowed();
            // totalPrincipalOutstanding is an alias for totalBorrowed in the contract
            const totalPrincipalOutstanding = totalBorrowed;
            // Public variables that may not be in ABI - use default values
            const totalInterestAccrued = ethers.BigNumber.from(0);
            const totalLosses = ethers.BigNumber.from(0);
            const protocolFeesAccrued = ethers.BigNumber.from(0);
            const utilization = await FinancingPool.utilization();
            const poolStartTime = ethers.BigNumber.from(Math.floor(Date.now() / 1000)); // Use current time as default
            const borrowAprWad = ethers.BigNumber.from(0); // Default 0%
            const protocolFeeBps = ethers.BigNumber.from(1000); // Default 10% (1000 bps)

            // Calculate APR/APY
            const now = Math.floor(Date.now() / 1000);
            const poolAgeSeconds = now - Number(poolStartTime.toString());
            let apr = "0";
            let apy = "0";

            if (poolAgeSeconds > 0 && totalInterestAccrued.gt(0)) {
                const navValue = Number(ethers.utils.formatUnits(nav, 18));
                if (navValue > 0) {
                    const protocolFeeBpsNum = Number(protocolFeeBps);
                    const interestPaidToLP = Number(ethers.utils.formatUnits(totalInterestAccrued.mul(10000 - protocolFeeBpsNum).div(10000), 18));
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
        const wallet = query.wallet || req.wallet || getSigner(getChainIdFromRequest(req)).address;

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

    // GET /lp/risk/snapshot - Risk exposure snapshot
    app.get('/risk/snapshot', async (req, reply) => {
        try {
            const query = z.object({
                poolId: z.string().optional(),
            }).parse(req.query);

            const FinancingPool = loadContract("FinancingPool", getChainIdFromRequest(req));

            // Get all financed invoices
            const invoices = await prisma.invoice.findMany({
                where: {
                    isFinanced: true,
                    invoiceIdOnChain: { not: null },
                },
                include: {
                    company: true,
                    debtor: true,
                },
            });

            // Calculate sector allocations (using company/debtor names as sector proxy for now)
            // TODO: Add sector field to Company model
            const sectorMap: Record<string, { allocation: number; principal: bigint; recourse: bigint; nonRecourse: bigint }> = {};
            let totalPrincipal = 0n;
            let totalRecourse = 0n;
            let totalNonRecourse = 0n;

            for (const inv of invoices) {
                if (!inv.invoiceIdOnChain) continue;

                try {
                    const position = await FinancingPool.getPosition(inv.invoiceIdOnChain);
                    if (!position.exists) continue;

                    const principal = position.usedCredit as bigint;
                    const recourseMode = Number(position.recourseMode || "1");
                    const isRecourse = recourseMode === 0;

                    // Use company name as sector proxy (simplified)
                    const sector = inv.company.name || "Other";

                    if (!sectorMap[sector]) {
                        sectorMap[sector] = { allocation: 0, principal: 0n, recourse: 0n, nonRecourse: 0n };
                    }

                    sectorMap[sector].principal += principal;
                    totalPrincipal += principal;

                    if (isRecourse) {
                        sectorMap[sector].recourse += principal;
                        totalRecourse += principal;
                    } else {
                        sectorMap[sector].nonRecourse += principal;
                        totalNonRecourse += principal;
                    }
                } catch (e) {
                    console.warn(`Failed to fetch position for invoice ${inv.id}:`, e);
                }
            }

            // Calculate sector percentages and risk multipliers
            const sectors = Object.entries(sectorMap).map(([name, data]) => {
                const totalPrincipalNum = Number(totalPrincipal);
                const allocationPct = totalPrincipalNum > 0 ? Number(data.principal) / totalPrincipalNum : 0;
                // Simple risk multiplier based on concentration (higher concentration = higher risk)
                const riskMultiplier = 1.0 + (allocationPct * 0.5); // Max 1.5x for 100% concentration

                return {
                    name,
                    allocationPct,
                    riskMultiplier,
                    drivers: allocationPct > 0.3 ? ["Counterparty concentration"] : [],
                };
            });

            // Calculate structure percentages
            const totalPrincipalNum = Number(totalPrincipal);
            const recoursePct = totalPrincipalNum > 0 ? Number(totalRecourse) / totalPrincipalNum : 0;
            const nonRecoursePct = totalPrincipalNum > 0 ? Number(totalNonRecourse) / totalPrincipalNum : 0;

            // Calculate overall risk score (0-100)
            const concentrationRisk = Math.max(...sectors.map(s => s.allocationPct)) * 50; // Max 50 points
            const nonRecourseRisk = nonRecoursePct * 30; // Max 30 points
            const overdueRisk = 0; // TODO: Calculate from overdue invoices
            const overallScore = Math.min(100, Math.round(concentrationRisk + nonRecourseRisk + overdueRisk + 20));

            let overallLabel: "Low" | "Medium" | "Elevated" = "Low";
            if (overallScore >= 70) overallLabel = "Elevated";
            else if (overallScore >= 35) overallLabel = "Medium";

            // Calculate stress indicators
            const nav = await FinancingPool.getNAV();
            const reserveBalance = await FinancingPool.reserveBalance().catch(() => ethers.BigNumber.from(0));
            const defaultBuffer = nav.gt(0) ? Number(reserveBalance) / Number(nav) : 0;

            // Calculate average tenor (simplified - using days until due date)
            let totalTenorDays = 0;
            let invoiceCount = 0;
            for (const inv of invoices) {
                if (inv.dueDate) {
                    const dueDate = new Date(inv.dueDate);
                    const now = new Date();
                    const daysUntilDue = Math.max(0, Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                    totalTenorDays += daysUntilDue;
                    invoiceCount++;
                }
            }
            const avgTenorDays = invoiceCount > 0 ? Math.round(totalTenorDays / invoiceCount) : 0;

            // Calculate top 5 concentration
            const sortedSectors = [...sectors].sort((a, b) => b.allocationPct - a.allocationPct);
            const top5Concentration = sortedSectors.slice(0, 5).reduce((sum, s) => sum + s.allocationPct, 0);

            // Calculate overdue rate
            const overdueInvoices = invoices.filter(inv => {
                if (!inv.dueDate) return false;
                return new Date(inv.dueDate) < new Date();
            });
            const overdueRate = invoices.length > 0 ? overdueInvoices.length / invoices.length : 0;

            return {
                asOf: new Date().toISOString(),
                overall: {
                    score: overallScore,
                    label: overallLabel,
                    trend: "stable" as const,
                    confidence: 0.91,
                },
                sectors,
                structure: {
                    recoursePct,
                    nonRecoursePct,
                    aiPreference: recoursePct > 0.6 ? "recourse" : null,
                },
                stress: {
                    defaultBuffer: {
                        value: defaultBuffer,
                        status: defaultBuffer >= 2.0 ? "safe" : defaultBuffer >= 1.5 ? "watch" : "critical",
                        thresholds: { watch: 2.0, critical: 1.5 },
                        series: Array(30).fill(defaultBuffer), // Mock series
                    },
                    avgTenorDays: {
                        value: avgTenorDays,
                        status: avgTenorDays <= 60 ? "safe" : avgTenorDays <= 90 ? "watch" : "critical",
                        thresholds: { watch: 60, critical: 90 },
                        series: Array(30).fill(avgTenorDays), // Mock series
                    },
                    top5Concentration: {
                        value: top5Concentration,
                        status: top5Concentration <= 0.5 ? "safe" : top5Concentration <= 0.65 ? "watch" : "critical",
                        thresholds: { watch: 0.5, critical: 0.65 },
                        series: Array(30).fill(top5Concentration), // Mock series
                    },
                    overdueRate: {
                        value: overdueRate,
                        status: overdueRate <= 0.03 ? "safe" : overdueRate <= 0.06 ? "watch" : "critical",
                        thresholds: { watch: 0.03, critical: 0.06 },
                        series: Array(30).fill(overdueRate), // Mock series
                    },
                },
                observations: [
                    {
                        id: "obs_1",
                        severity: "info" as const,
                        text: totalPrincipal > 0n ? "No correlated default patterns detected." : "No active positions.",
                        ts: new Date().toISOString(),
                    },
                ],
                driversTop: sectors.length > 0 ? ["Concentration", "Tenor clustering", "Counterparty risk"] : [],
            };
        } catch (e: any) {
            console.error("Failed to fetch risk snapshot:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch risk snapshot" });
        }
    });

    // GET /lp/risk/history - Risk history
    app.get('/risk/history', async (req, reply) => {
        try {
            const query = z.object({
                poolId: z.string().optional(),
                range: z.string().optional().default("7d"),
            }).parse(req.query);

            // TODO: Implement historical data storage and retrieval
            // For now, return current snapshot as single point
            const snapshot = await app.inject({
                method: 'GET',
                url: '/lp/risk/snapshot',
            });
            const snapshotData = JSON.parse(snapshot.body);

            return {
                points: [
                    {
                        ts: snapshotData.asOf,
                        overallScore: snapshotData.overall.score,
                        sectorAllocations: snapshotData.sectors.reduce((acc: Record<string, number>, s: any) => {
                            acc[s.name] = s.allocationPct;
                            return acc;
                        }, {}),
                    },
                ],
                sectorChanges: snapshotData.sectors.map((s: any) => ({
                    name: s.name,
                    allocationDelta: 0,
                    multiplierDelta: 0,
                })),
            };
        } catch (e: any) {
            console.error("Failed to fetch risk history:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch risk history" });
        }
    });

    // GET /lp/risk/projection - Risk projection
    app.get('/risk/projection', async (req, reply) => {
        try {
            const query = z.object({
                poolId: z.string().optional(),
                horizon: z.string().optional().default("7d"),
            }).parse(req.query);

            // Get current snapshot
            const snapshot = await app.inject({
                method: 'GET',
                url: '/lp/risk/snapshot',
            });
            const snapshotData = JSON.parse(snapshot.body);

            // Simple projection: assume stable (current score continues)
            const currentScore = snapshotData.overall.score;
            const projectedPoints = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i + 1);
                return {
                    ts: date.toISOString(),
                    score: currentScore + (i * 0.5), // Slight upward trend
                };
            });

            return {
                projectedPoints,
                assumptions: ["Inflow stable", "No new defaults", "Tenor distribution constant"],
                explainability: [
                    "A 10% rise in non-recourse exposure would push risk into Elevated.",
                    "Default buffer below 1.8x triggers alerting.",
                ],
            };
        } catch (e: any) {
            console.error("Failed to fetch risk projection:", e);
            return reply.code(500).send({ error: e.message || "Failed to fetch risk projection" });
        }
    });
}

