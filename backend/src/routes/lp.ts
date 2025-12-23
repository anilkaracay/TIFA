import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { provider, signer, loadContract } from '../onchain/provider';
import { ethers } from 'ethers';

export async function registerLPRoutes(app: FastifyInstance) {
    
    // POST /lp/deposit
    app.post('/deposit', async (req, reply) => {
        const body = z.object({
            amount: z.string(), // Amount in liquidityToken units (e.g., "1000000" for 10,000 tokens with 2 decimals)
        }).parse(req.body);

        try {
            const FinancingPool = loadContract("FinancingPool");
            const TestToken = loadContract("TestToken");
            
            // TestToken uses 18 decimals (standard ERC20)
            const amount = ethers.utils.parseUnits(body.amount, 18);
            
            // 1. Approve if needed
            const allowance = await TestToken.allowance(signer.address, FinancingPool.address);
            if (allowance.lt(amount)) {
                const approveTx = await TestToken.approve(FinancingPool.address, amount);
                await approveTx.wait();
            }
            
            // 2. Deposit
            const tx = await FinancingPool.deposit(amount);
            const receipt = await tx.wait();
            
            // 3. Sync LP position
            const lpPosition = await FinancingPool.getLPPosition(signer.address);
            await prisma.lPPosition.upsert({
                where: { wallet: signer.address },
                update: {
                    shares: lpPosition.lpShares.toString(),
                    updatedAt: new Date(),
                },
                create: {
                    wallet: signer.address,
                    shares: lpPosition.lpShares.toString(),
                },
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

    // POST /lp/withdraw
    app.post('/withdraw', async (req, reply) => {
        const body = z.object({
            lpShares: z.string(), // LP shares to burn
        }).parse(req.body);

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
            
            // Withdraw
            const tx = await FinancingPool.withdraw(lpShares);
            const receipt = await tx.wait();
            
            // Sync LP position
            const lpPosition = await FinancingPool.getLPPosition(signer.address);
            await prisma.lPPosition.upsert({
                where: { wallet: signer.address },
                update: {
                    shares: lpPosition.lpShares.toString(),
                    updatedAt: new Date(),
                },
                create: {
                    wallet: signer.address,
                    shares: lpPosition.lpShares.toString(),
                },
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
            const lpSharePrice = await FinancingPool.sharePriceWad();
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
            const sharePriceWad = await FinancingPool.sharePriceWad();
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
}

