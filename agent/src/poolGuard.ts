import { loadContract } from "./onchain/provider";
import { ethers } from "ethers";

const UTILIZATION_THRESHOLD_BPS = 7500; // 75% - stop auto-financing above this
const MAX_UTILIZATION_BPS = 8000; // 80% - hard limit

export interface PoolState {
    totalLiquidity: bigint;
    totalBorrowed: bigint;
    availableLiquidity: bigint;
    utilization: number; // in basis points (0-10000)
    utilizationPercent: number; // 0-100
    maxUtilization: number;
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
        
        return {
            totalLiquidity: BigInt(totalLiquidity.toString()),
            totalBorrowed: BigInt(totalBorrowed.toString()),
            availableLiquidity: BigInt(availableLiquidity.toString()),
            utilization: Number(utilization.toString()),
            utilizationPercent: Number(utilization.toString()) / 100,
            maxUtilization: Number(maxUtilization.toString()),
        };
    } catch (e: any) {
        console.error("[PoolGuard] Failed to fetch pool state:", e.message);
        // Return safe defaults if contract call fails
        return {
            totalLiquidity: 0n,
            totalBorrowed: 0n,
            availableLiquidity: 0n,
            utilization: 0,
            utilizationPercent: 0,
            maxUtilization: MAX_UTILIZATION_BPS,
        };
    }
}

/**
 * Check if pool has sufficient liquidity for a financing request
 * @param requestedAmount Amount requested in wei/cents
 */
export async function canFinance(requestedAmount: bigint): Promise<{
    canFinance: boolean;
    reason?: string;
    poolState?: PoolState;
}> {
    const poolState = await getPoolState();
    
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
            reason: `Utilization too high: ${poolState.utilizationPercent.toFixed(2)}% (threshold: 75%)`,
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
            reason: `Loan would exceed max utilization: ${(newUtilization / 100).toFixed(2)}% (max: ${poolState.maxUtilization / 100}%)`,
            poolState,
        };
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

