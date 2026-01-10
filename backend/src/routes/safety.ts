import { FastifyInstance } from 'fastify';
import { getProvider, loadContract } from '../onchain/provider';

export async function registerSafetyRoutes(app: FastifyInstance) {
    // GET /limits - Get all safety limits and current state (registered with /pool prefix)
    app.get('/limits', async (req, reply) => {
        try {
            const FinancingPool = loadContract("FinancingPool");

            // Fetch all safety parameters
            const [
                paused,
                utilization,
                maxUtilizationBps,
                nav,
                maxLoanBpsOfTVL,
                maxIssuerExposureBps,
                totalLiquidity,
                totalBorrowed,
            ] = await Promise.all([
                (typeof FinancingPool.paused === 'function' ? FinancingPool.paused() : Promise.resolve(false)).catch(() => false),
                FinancingPool.utilization(),
                (typeof FinancingPool.maxUtilizationBps === 'function' ? FinancingPool.maxUtilizationBps() : Promise.resolve(8000n)),
                FinancingPool.getNAV(),
                (typeof FinancingPool.maxLoanBpsOfTVL === 'function' ? FinancingPool.maxLoanBpsOfTVL() : Promise.resolve(1000n)).catch(() => 1000n),
                (typeof FinancingPool.maxIssuerExposureBps === 'function' ? FinancingPool.maxIssuerExposureBps() : Promise.resolve(2500n)).catch(() => 2500n),
                FinancingPool.totalLiquidity(),
                FinancingPool.totalBorrowed(),
            ]);

            const utilizationBps = Number(utilization.toString());
            const navValue = Number(nav.toString());
            const maxSingleLoan = (navValue * Number(maxLoanBpsOfTVL.toString())) / 10000;
            const maxIssuerExposure = (navValue * Number(maxIssuerExposureBps.toString())) / 10000;

            return {
                paused: Boolean(paused),
                utilization: utilizationBps,
                utilizationPercent: utilizationBps / 100,
                maxUtilization: Number(maxUtilizationBps.toString()),
                maxUtilizationPercent: Number(maxUtilizationBps.toString()) / 100,
                nav: navValue.toString(),
                navFormatted: (navValue / 1e18).toFixed(2),
                maxSingleLoan: maxSingleLoan.toString(),
                maxSingleLoanFormatted: (maxSingleLoan / 1e18).toFixed(2),
                maxSingleLoanBps: Number(maxLoanBpsOfTVL.toString()),
                maxIssuerExposure: maxIssuerExposure.toString(),
                maxIssuerExposureFormatted: (maxIssuerExposure / 1e18).toFixed(2),
                maxIssuerExposureBps: Number(maxIssuerExposureBps.toString()),
                totalLiquidity: totalLiquidity.toString(),
                totalBorrowed: totalBorrowed.toString(),
            };
        } catch (e: any) {
            reply.code(500);
            return { error: `Failed to fetch pool limits: ${e.message}` };
        }
    });

    // GET /issuer/:address/exposure - Get issuer exposure and limits (registered with /pool prefix)
    app.get<{ Params: { address: string } }>('/issuer/:address/exposure', async (req, reply) => {
        try {
            const { address } = req.params;
            const FinancingPool = loadContract("FinancingPool");

            const [
                currentExposure,
                nav,
                maxIssuerExposureBps,
            ] = await Promise.all([
                FinancingPool.totalIssuerOutstanding(address),
                FinancingPool.getNAV(),
                FinancingPool.maxIssuerExposureBps().catch(() => 2500n), // Default 25%
            ]);

            const navValue = Number(nav.toString());
            const maxAllowed = (navValue * Number(maxIssuerExposureBps.toString())) / 10000;
            const currentExposureValue = Number(currentExposure.toString());

            return {
                issuer: address,
                currentExposure: currentExposure.toString(),
                currentExposureFormatted: (currentExposureValue / 1e18).toFixed(2),
                maxAllowed: maxAllowed.toString(),
                maxAllowedFormatted: (maxAllowed / 1e18).toFixed(2),
                maxAllowedBps: Number(maxIssuerExposureBps.toString()),
                utilizationPercent: navValue > 0 ? (currentExposureValue / navValue) * 100 : 0,
                remainingCapacity: Math.max(0, maxAllowed - currentExposureValue).toString(),
                remainingCapacityFormatted: Math.max(0, (maxAllowed - currentExposureValue) / 1e18).toFixed(2),
            };
        } catch (e: any) {
            reply.code(500);
            return { error: `Failed to fetch issuer exposure: ${e.message}` };
        }
    });
}

