import { getReconciledSnapshot } from '../services/truthService';

const RECONCILIATION_INTERVAL_MS = 60000; // 60 seconds
const MISMATCH_THRESHOLD = 1; // Any mismatch is logged
const SUBGRAPH_LAG_THRESHOLD = 100; // blocks

let reconciliationInterval: NodeJS.Timeout | null = null;

export function startReconciliationJob() {
    console.log('[ReconciliationJob] Starting reconciliation job (every 60s)');
    
    reconciliationInterval = setInterval(async () => {
        try {
            const reconciled = await getReconciledSnapshot();
            
            // Check for mismatches
            if (reconciled.mismatches.length > MISMATCH_THRESHOLD) {
                console.warn('[ReconciliationJob] ⚠️  Mismatches detected:', {
                    count: reconciled.mismatches.length,
                    mismatches: reconciled.mismatches,
                    modeUsed: reconciled.modeUsed,
                });
            }
            
            // Check subgraph lag
            if (reconciled.freshness.subgraphLagBlocks > SUBGRAPH_LAG_THRESHOLD) {
                console.warn('[ReconciliationJob] ⚠️  Subgraph lagging:', {
                    lagBlocks: reconciled.freshness.subgraphLagBlocks,
                    lastIndexedAt: reconciled.freshness.lastIndexedAt,
                    lastOnchainBlock: reconciled.freshness.lastOnchainBlock,
                });
            }
            
            // Log successful reconciliation
            if (reconciled.modeUsed === 'reconciled' && reconciled.mismatches.length === 0) {
                console.log('[ReconciliationJob] ✅ Reconciliation OK:', {
                    blockNumber: reconciled.onchain.blockNumber,
                    subgraphLagBlocks: reconciled.freshness.subgraphLagBlocks,
                });
            }
        } catch (e: any) {
            console.error('[ReconciliationJob] Error:', e.message);
        }
    }, RECONCILIATION_INTERVAL_MS);
}

export function stopReconciliationJob() {
    if (reconciliationInterval) {
        clearInterval(reconciliationInterval);
        reconciliationInterval = null;
        console.log('[ReconciliationJob] Stopped');
    }
}


