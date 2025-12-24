import { provider, loadContract } from '../onchain/provider';
import { ethers } from 'ethers';
import { env } from '../env';

// Types
export type PoolTruthSnapshot = {
    blockNumber: number;
    timestamp: number;
    nav: string;
    sharePriceWad: string;
    utilizationBps: number;
    totalPrincipalOutstanding: string;
    totalInterestAccrued: string;
    totalLosses: string;
    reserveBalance?: string;
    protocolFeesAccrued?: string;
    totalLiquidity: string;
    totalBorrowed: string;
};

export type PoolIndexedSnapshot = PoolTruthSnapshot & {
    indexedBlockNumber: number;
    indexedAt: number;
    subgraphLagBlocks: number;
};

export type Mismatch = {
    field: string;
    onchain: string | number;
    indexed: string | number;
    diff: string | number;
};

export type ReconciledSnapshot = {
    modeUsed: 'reconciled' | 'onchain-only' | 'subgraph-only';
    onchain: PoolTruthSnapshot;
    indexed?: PoolIndexedSnapshot;
    mismatches: Mismatch[];
    freshness: {
        subgraphLagBlocks: number;
        lastIndexedAt?: number;
        lastOnchainBlock: number;
    };
};

// Tolerances
const TOLERANCE_WAD = BigInt('1000000000000'); // 1e12
const TOLERANCE_WEI = BigInt('1');
const TOLERANCE_BPS = 1;

/**
 * Mode 1: Direct On-chain Read
 * Query contract methods directly via RPC
 */
export async function readOnchainTruth(): Promise<PoolTruthSnapshot> {
    const FinancingPool = loadContract("FinancingPool");
    const currentBlock = await provider.getBlockNumber();
    const currentBlockData = await provider.getBlock(currentBlock);
    
    const [
        nav,
        sharePriceWad,
        utilization,
        totalPrincipalOutstanding,
        totalInterestAccrued,
        totalLosses,
        reserveBalance,
        protocolFeesAccrued,
        totalLiquidity,
        totalBorrowed,
    ] = await Promise.all([
        FinancingPool.getNAV(),
        FinancingPool.sharePriceWad(),
        FinancingPool.utilization(),
        FinancingPool.totalPrincipalOutstanding(),
        FinancingPool.totalInterestAccrued(),
        FinancingPool.totalLosses(),
        FinancingPool.reserveBalance().catch(() => ethers.BigNumber.from(0)),
        FinancingPool.protocolFeesAccrued().catch(() => ethers.BigNumber.from(0)),
        FinancingPool.totalLiquidity(),
        FinancingPool.totalBorrowed(),
    ]);
    
    return {
        blockNumber: currentBlock,
        timestamp: currentBlockData.timestamp,
        nav: nav.toString(),
        sharePriceWad: sharePriceWad.toString(),
        utilizationBps: Number(utilization.toString()),
        totalPrincipalOutstanding: totalPrincipalOutstanding.toString(),
        totalInterestAccrued: totalInterestAccrued.toString(),
        totalLosses: totalLosses.toString(),
        reserveBalance: reserveBalance.toString(),
        protocolFeesAccrued: protocolFeesAccrued.toString(),
        totalLiquidity: totalLiquidity.toString(),
        totalBorrowed: totalBorrowed.toString(),
    };
}

/**
 * Mode 2: Subgraph Indexed Truth
 * Query subgraph for PoolMetrics entity
 */
export async function readSubgraphTruth(): Promise<PoolIndexedSnapshot | null> {
    const subgraphUrl = env.SUBGRAPH_URL || process.env.SUBGRAPH_URL;
    if (!subgraphUrl) {
        console.warn('[TruthService] SUBGRAPH_URL not configured, skipping subgraph query');
        return null;
    }
    
    try {
        const query = `
            query {
                poolMetrics(id: "POOL") {
                    id
                    nav
                    sharePriceWad
                    utilization
                    totalPrincipalOutstanding
                    totalInterestAccrued
                    totalLosses
                    reserveBalance
                    protocolFeesAccrued
                    totalLiquidity
                    totalBorrowed
                    lastEventBlock
                    lastEventTimestamp
                }
                _meta {
                    block {
                        number
                    }
                }
            }
        `;
        
        const response = await fetch(subgraphUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        
        if (!response.ok) {
            throw new Error(`Subgraph query failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.errors) {
            throw new Error(`Subgraph errors: ${JSON.stringify(data.errors)}`);
        }
        
        const metrics = data.data?.poolMetrics;
        if (!metrics) {
            return null; // No indexed data yet
        }
        
        const currentBlock = await provider.getBlockNumber();
        const indexedBlock = Number(metrics.lastEventBlock || data.data?._meta?.block?.number || 0);
        const subgraphLagBlocks = currentBlock - indexedBlock;
        
        return {
            blockNumber: indexedBlock,
            timestamp: Number(metrics.lastEventTimestamp || 0),
            nav: metrics.nav || '0',
            sharePriceWad: metrics.sharePriceWad || '0',
            utilizationBps: Number(metrics.utilization || 0),
            totalPrincipalOutstanding: metrics.totalPrincipalOutstanding || '0',
            totalInterestAccrued: metrics.totalInterestAccrued || '0',
            totalLosses: metrics.totalLosses || '0',
            reserveBalance: metrics.reserveBalance || '0',
            protocolFeesAccrued: metrics.protocolFeesAccrued || '0',
            totalLiquidity: metrics.totalLiquidity || '0',
            totalBorrowed: metrics.totalBorrowed || '0',
            indexedBlockNumber: indexedBlock,
            indexedAt: Number(metrics.lastEventTimestamp || 0),
            subgraphLagBlocks,
        };
    } catch (e: any) {
        console.error('[TruthService] Subgraph query failed:', e.message);
        return null;
    }
}

/**
 * Compare two snapshots and detect mismatches
 */
function compareSnapshots(
    onchain: PoolTruthSnapshot,
    indexed: PoolIndexedSnapshot
): Mismatch[] {
    const mismatches: Mismatch[] = [];
    
    // Compare NAV (WAD tolerance)
    const navDiff = BigInt(onchain.nav) - BigInt(indexed.nav);
    if (navDiff < 0n ? -navDiff > TOLERANCE_WAD : navDiff > TOLERANCE_WAD) {
        mismatches.push({
            field: 'nav',
            onchain: onchain.nav,
            indexed: indexed.nav,
            diff: navDiff.toString(),
        });
    }
    
    // Compare Share Price (WAD tolerance)
    const sharePriceDiff = BigInt(onchain.sharePriceWad) - BigInt(indexed.sharePriceWad);
    if (sharePriceDiff < 0n ? -sharePriceDiff > TOLERANCE_WAD : sharePriceDiff > TOLERANCE_WAD) {
        mismatches.push({
            field: 'sharePriceWad',
            onchain: onchain.sharePriceWad,
            indexed: indexed.sharePriceWad,
            diff: sharePriceDiff.toString(),
        });
    }
    
    // Compare Utilization (BPS tolerance)
    const utilDiff = Math.abs(onchain.utilizationBps - indexed.utilizationBps);
    if (utilDiff > TOLERANCE_BPS) {
        mismatches.push({
            field: 'utilizationBps',
            onchain: onchain.utilizationBps,
            indexed: indexed.utilizationBps,
            diff: utilDiff,
        });
    }
    
    // Compare Principal Outstanding (wei tolerance)
    const principalDiff = BigInt(onchain.totalPrincipalOutstanding) - BigInt(indexed.totalPrincipalOutstanding);
    if (principalDiff < 0n ? -principalDiff > TOLERANCE_WEI : principalDiff > TOLERANCE_WEI) {
        mismatches.push({
            field: 'totalPrincipalOutstanding',
            onchain: onchain.totalPrincipalOutstanding,
            indexed: indexed.totalPrincipalOutstanding,
            diff: principalDiff.toString(),
        });
    }
    
    // Compare Interest Accrued (wei tolerance)
    const interestDiff = BigInt(onchain.totalInterestAccrued) - BigInt(indexed.totalInterestAccrued);
    if (interestDiff < 0n ? -interestDiff > TOLERANCE_WEI : interestDiff > TOLERANCE_WEI) {
        mismatches.push({
            field: 'totalInterestAccrued',
            onchain: onchain.totalInterestAccrued,
            indexed: indexed.totalInterestAccrued,
            diff: interestDiff.toString(),
        });
    }
    
    // Compare Losses (wei tolerance)
    const lossesDiff = BigInt(onchain.totalLosses) - BigInt(indexed.totalLosses);
    if (lossesDiff < 0n ? -lossesDiff > TOLERANCE_WEI : lossesDiff > TOLERANCE_WEI) {
        mismatches.push({
            field: 'totalLosses',
            onchain: onchain.totalLosses,
            indexed: indexed.totalLosses,
            diff: lossesDiff.toString(),
        });
    }
    
    return mismatches;
}

/**
 * Mode 3: Reconciled Snapshot (Preferred)
 * Fetch both on-chain and subgraph, compare, and return reconciled result
 */
export async function getReconciledSnapshot(): Promise<ReconciledSnapshot> {
    const onchain = await readOnchainTruth();
    const indexed = await readSubgraphTruth();
    
    // If subgraph unavailable, return on-chain only
    if (!indexed) {
        return {
            modeUsed: 'onchain-only',
            onchain,
            mismatches: [],
            freshness: {
                subgraphLagBlocks: -1, // Unknown
                lastOnchainBlock: onchain.blockNumber,
            },
        };
    }
    
    // Check subgraph lag threshold
    const SUBGRAPH_LAG_THRESHOLD = 100; // blocks
    if (indexed.subgraphLagBlocks > SUBGRAPH_LAG_THRESHOLD) {
        // Subgraph too lagged, prefer on-chain
        return {
            modeUsed: 'onchain-only',
            onchain,
            indexed,
            mismatches: [],
            freshness: {
                subgraphLagBlocks: indexed.subgraphLagBlocks,
                lastIndexedAt: indexed.indexedAt,
                lastOnchainBlock: onchain.blockNumber,
            },
        };
    }
    
    // Compare and detect mismatches
    const mismatches = compareSnapshots(onchain, indexed);
    
    // Log mismatches if any
    if (mismatches.length > 0) {
        console.warn('[TruthService] Mismatches detected:', mismatches);
    }
    
    return {
        modeUsed: 'reconciled',
        onchain,
        indexed,
        mismatches,
        freshness: {
            subgraphLagBlocks: indexed.subgraphLagBlocks,
            lastIndexedAt: indexed.indexedAt,
            lastOnchainBlock: onchain.blockNumber,
        },
    };
}

/**
 * Get invoice truth from on-chain
 */
export async function getInvoiceTruth(invoiceIdOnChain: string): Promise<{
    onchain: any;
    dbOutOfSync?: boolean;
}> {
    const FinancingPool = loadContract("FinancingPool");
    
    try {
        const position = await FinancingPool.getPosition(invoiceIdOnChain);
        
        return {
            onchain: {
                exists: position.exists,
                usedCredit: position.usedCredit.toString(),
                interestAccrued: position.interestAccrued.toString(),
                maxCreditLine: position.maxCreditLine.toString(),
                isInDefault: position.isInDefault,
                recourseMode: Number(position.recourseMode),
                dueDate: position.dueDate.toString(),
            },
        };
    } catch (e: any) {
        throw new Error(`Failed to fetch invoice truth: ${e.message}`);
    }
}

/**
 * Get LP position truth
 */
export async function getLPPositionTruth(wallet: string): Promise<{
    lpShares: string;
    underlyingValue: string;
    sharePriceWad: string;
    nav: string;
}> {
    const FinancingPool = loadContract("FinancingPool");
    const LPShareToken = loadContract("LPShareToken");
    
    const [lpShares, sharePriceWad, nav] = await Promise.all([
        LPShareToken.balanceOf(wallet),
        FinancingPool.sharePriceWad(),
        FinancingPool.getNAV(),
    ]);
    
    // Compute underlying value: shares * sharePriceWad / 1e18
    // This is allowed because sharePriceWad is canonical
    const underlyingValue = (lpShares.mul(sharePriceWad)).div(ethers.BigNumber.from('1000000000000000000'));
    
    return {
        lpShares: lpShares.toString(),
        underlyingValue: underlyingValue.toString(),
        sharePriceWad: sharePriceWad.toString(),
        nav: nav.toString(),
    };
}

/**
 * Calculate APR/APY from InterestPaid events only
 * Uses on-chain NAV queries at event blocks
 */
export async function calculateYieldFromEvents(windowDays: number = 7): Promise<{
    windowDays: number;
    windowStartTimestamp: number;
    windowEndTimestamp: number;
    startBlock: number;
    endBlock: number;
    lpInterestPaid: string;
    avgNav: string;
    apr: string;
    apy: string;
    method: string;
    eventCount: number;
}> {
    const subgraphUrl = env.SUBGRAPH_URL || process.env.SUBGRAPH_URL;
    if (!subgraphUrl) {
        throw new Error('SUBGRAPH_URL not configured');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const windowStartTimestamp = now - (windowDays * 24 * 3600);
    const windowEndTimestamp = now;
    
    // Get block numbers for window boundaries
    const currentBlock = await provider.getBlockNumber();
    const endBlock = currentBlock;
    
    // Estimate start block (approximate: 1 block per 2 seconds)
    const blocksPerSecond = 2;
    const blocksInWindow = windowDays * 24 * 3600 * blocksPerSecond;
    const startBlock = Math.max(0, currentBlock - blocksInWindow);
    
    // Query InterestPaid events from subgraph
    const query = `
        query {
            interestPaidEvents(
                where: { timestamp_gte: "${windowStartTimestamp}", timestamp_lte: "${windowEndTimestamp}" }
                orderBy: timestamp
                orderDirection: asc
            ) {
                id
                invoiceId
                interestPaid
                lpInterest
                protocolFee
                timestamp
                blockNumber
            }
        }
    `;
    
    let events: any[] = [];
    try {
        const response = await fetch(subgraphUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        
        if (response.ok) {
            const data = await response.json();
            events = data.data?.interestPaidEvents || [];
        }
    } catch (e) {
        console.warn('[TruthService] Failed to fetch InterestPaid events:', e);
    }
    
    // Sum LP interest paid
    let lpInterestPaid = ethers.BigNumber.from(0);
    for (const event of events) {
        lpInterestPaid = lpInterestPaid.add(ethers.BigNumber.from(event.lpInterest || '0'));
    }
    
    // Get NAV at start and end blocks
    const FinancingPool = loadContract("FinancingPool");
    const [navStart, navEnd] = await Promise.all([
        FinancingPool.getNAV({ blockTag: startBlock }).catch(() => FinancingPool.getNAV()),
        FinancingPool.getNAV({ blockTag: endBlock }),
    ]);
    
    // Average NAV
    const avgNav = navStart.add(navEnd).div(2);
    
    // Calculate APR
    // APR = (lpInterestPaid / avgNAV) * (secondsPerYear / windowSeconds)
    const windowSeconds = windowDays * 24 * 3600;
    const secondsPerYear = 365 * 24 * 3600;
    
    let apr = '0';
    if (avgNav.gt(0) && lpInterestPaid.gt(0)) {
        // APR in basis points: (lpInterestPaid * 10000 * secondsPerYear) / (avgNav * windowSeconds)
        const aprBps = lpInterestPaid.mul(10000).mul(secondsPerYear).div(avgNav.mul(windowSeconds));
        apr = (Number(aprBps.toString()) / 100).toFixed(4);
    }
    
    // Calculate APY (compounded daily)
    // APY = (1 + APR/365)^365 - 1
    let apy = '0';
    if (apr !== '0') {
        const aprDecimal = Number(apr) / 100;
        const dailyRate = aprDecimal / 365;
        const apyDecimal = Math.pow(1 + dailyRate, 365) - 1;
        apy = (apyDecimal * 100).toFixed(4);
    }
    
    return {
        windowDays,
        windowStartTimestamp,
        windowEndTimestamp,
        startBlock,
        endBlock,
        lpInterestPaid: lpInterestPaid.toString(),
        avgNav: avgNav.toString(),
        apr,
        apy,
        method: 'InterestPaidEvents+OnchainNAV',
        eventCount: events.length,
    };
}

