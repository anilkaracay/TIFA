import { loadContract } from "./onchain/provider";

const UTILIZATION_THRESHOLD_BPS = 7500; // 75% - stop auto-financing above this
const MAX_UTILIZATION_BPS = 8000; // 80% - hard limit

export interface PoolState {
    totalLiquidity: bigint;
    totalBorrowed: bigint;
    availableLiquidity: bigint;
    utilization: number; // in basis points (0-10000)
    utilizationPercent: number; // 0-100
    maxUtilization: number;
    paused: boolean;
    nav: bigint;
    maxSingleLoan: bigint;
    maxIssuerExposure: bigint;
}

/**
 * Fetch current pool state from contract
 */
export async function getPoolState(): Promise<PoolState> {
    try {
        const Pool = loadContract("FinancingPool");

        const totalLiquidity = await Pool.totalLiquidity();
        const totalBorrowed = await Pool.totalBorrowed();
        const availableLiquidity = await Pool.availableLiquidity();
        const utilization = await Pool.utilization();
        const maxUtilization = await Pool.maxUtilizationBps();

        // Check if pool is paused
        let paused = false;
        try {
            paused = await Pool.paused();
        } catch (e) {
            // If paused() doesn't exist in ABI, assume not paused
            console.warn("[PoolGuard] paused() not available in ABI");
        }

        // Get NAV and safety limits
        let nav = 0n;
        let maxSingleLoan = 0n;
        let maxIssuerExposure = 0n;
        try {
            nav = BigInt((await Pool.getNAV()).toString());
            const maxLoanBps = await Pool.maxLoanBpsOfTVL();
            const maxIssuerBps = await Pool.maxIssuerExposureBps();
            maxSingleLoan = (nav * BigInt(maxLoanBps.toString())) / 10000n;
            maxIssuerExposure = (nav * BigInt(maxIssuerBps.toString())) / 10000n;
        } catch (e) {
            console.warn("[PoolGuard] Safety limits not available:", e);
        }

        return {
            totalLiquidity: BigInt(totalLiquidity.toString()),
            totalBorrowed: BigInt(totalBorrowed.toString()),
            availableLiquidity: BigInt(availableLiquidity.toString()),
            utilization: Number(utilization.toString()),
            utilizationPercent: Number(utilization.toString()) / 100,
            maxUtilization: Number(maxUtilization.toString()),
            paused,
            nav,
            maxSingleLoan,
            maxIssuerExposure,
        };
    } catch (e: any) {
        console.error("[PoolGuard] Failed to fetch pool state:", e.message);
        // Return safe defaults if contract call fails
        // Don't assume paused on network errors - let agent continue but log warning
        // const isNetworkError = e.message?.includes("network") || e.message?.includes("NETWORK_ERROR");
        return {
            totalLiquidity: 0n,
            totalBorrowed: 0n,
            availableLiquidity: 0n,
            utilization: 0,
            utilizationPercent: 0,
            maxUtilization: MAX_UTILIZATION_BPS,
            paused: false, // Don't block on network errors - assume unpaused
            nav: 0n,
            maxSingleLoan: 0n,
            maxIssuerExposure: 0n,
        };
    }
}

/**
 * Check if pool has sufficient liquidity for a financing request
 * @param requestedAmount Amount requested in wei/cents
 * @param issuerAddress Issuer address for exposure check (optional)
 */
export async function canFinance(requestedAmount: bigint, issuerAddress?: string): Promise<{
    canFinance: boolean;
    reason?: string;
    poolState?: PoolState;
}> {
    const poolState = await getPoolState();

    // SAFETY CHECK 0: Pool paused
    if (poolState.paused) {
        return {
            canFinance: false,
            reason: "POOL_PAUSED",
            poolState,
        };
    }

    // Check 1: Available liquidity
    if (poolState.availableLiquidity < requestedAmount) {
        return {
            canFinance: false,
            reason: `Insufficient liquidity. Available: ${poolState.availableLiquidity.toString()}, Requested: ${requestedAmount.toString()}`,
            poolState,
        };
    }

    // Check 2: Utilization threshold (75%)
    if (poolState.utilization >= UTILIZATION_THRESHOLD_BPS) {
        return {
            canFinance: false,
            reason: `UTILIZATION_LIMIT: ${poolState.utilizationPercent.toFixed(2)}% (threshold: 75%)`,
            poolState,
        };
    }

    // Check 3: Would exceed max utilization after this loan?
    const newBorrowed = poolState.totalBorrowed + requestedAmount;
    const newUtilization = poolState.totalLiquidity > 0n
        ? (Number(newBorrowed) * 10000) / Number(poolState.totalLiquidity)
        : 0;

    if (newUtilization >= poolState.maxUtilization) {
        return {
            canFinance: false,
            reason: `UTILIZATION_LIMIT: Loan would exceed max utilization: ${(newUtilization / 100).toFixed(2)}% (max: ${poolState.maxUtilization / 100}%)`,
            poolState,
        };
    }

    // Check 4: Max single loan size
    if (poolState.maxSingleLoan > 0n && requestedAmount > poolState.maxSingleLoan) {
        return {
            canFinance: false,
            reason: `MAX_SINGLE_LOAN_EXCEEDED: Requested ${requestedAmount.toString()}, Max: ${poolState.maxSingleLoan.toString()}`,
            poolState,
        };
    }

    // Check 5: Issuer exposure limit (if issuer address provided)
    if (issuerAddress && poolState.maxIssuerExposure > 0n) {
        try {
            const Pool = loadContract("FinancingPool");
            const currentExposure = BigInt((await Pool.totalIssuerOutstanding(issuerAddress)).toString());
            const newExposure = currentExposure + requestedAmount;

            if (newExposure > poolState.maxIssuerExposure) {
                return {
                    canFinance: false,
                    reason: `ISSUER_EXPOSURE_LIMIT_EXCEEDED: Current ${currentExposure.toString()}, Requested ${requestedAmount.toString()}, Max: ${poolState.maxIssuerExposure.toString()}`,
                    poolState,
                };
            }
        } catch (e) {
            console.warn("[PoolGuard] Could not check issuer exposure:", e);
        }
    }

    return {
        canFinance: true,
        poolState,
    };
}

/**
 * Check if pool is in protection mode (utilization too high)
 */
export async function isPoolProtected(): Promise<boolean> {
    const poolState = await getPoolState();
    return poolState.utilization >= UTILIZATION_THRESHOLD_BPS;
}

