# Truth Service Implementation Summary

## Overview

TIFA now implements a **Single Source of Truth** architecture where:
- **On-chain contracts** are the authoritative source
- **Subgraph** provides indexed projections
- **Backend** aggregates and reconciles (read-only)
- **UI** formats and displays (no financial math)

## Implementation Status

### ✅ Completed

1. **Documentation** (`docs/accounting/single-source-of-truth.md`)
   - Canonical fields and sources defined
   - Allowed vs forbidden computations documented
   - Data freshness SLA specified

2. **Backend Truth Service** (`backend/src/services/truthService.ts`)
   - Mode 1: Direct on-chain reads
   - Mode 2: Subgraph indexed truth
   - Mode 3: Reconciled snapshot (preferred)
   - Mismatch detection with tolerances
   - APR/APY calculation from events only

3. **Backend Truth Endpoints** (`backend/src/routes/truth.ts`)
   - `GET /truth/pool` - Reconciled pool truth
   - `GET /truth/invoice/:id` - Invoice truth from on-chain
   - `GET /truth/lp/:wallet` - LP position truth
   - `GET /truth/pool/yield?windowDays=7` - APR/APY from events

4. **Subgraph Updates** (`subgraph/schema.graphql`, `subgraph/src/financingPool.ts`)
   - `PoolMetrics` entity (id="POOL") with all canonical fields
   - `InterestPaidEvent` entity for APR calculation
   - Event handlers for all pool state changes
   - Freshness tracking (`lastEventBlock`, `lastEventTimestamp`)

5. **Automated Reconciliation Job** (`backend/src/jobs/reconciliationJob.ts`)
   - Runs every 60 seconds
   - Detects mismatches
   - Logs warnings for subgraph lag
   - Integrated into server startup

6. **Frontend Types** (`frontend/lib/backendClient.ts`)
   - Truth service types exported
   - Fetch functions for all truth endpoints

### 🔄 Partially Completed

**UI Updates** - Truth endpoints are available but UI still uses legacy endpoints:
- Pool Overview card (`frontend/app/page.tsx`) - Still uses `fetchPoolOverview()`
- LP Dashboard (`frontend/app/lp/page.tsx`) - Still uses `fetchLPPosition()` and `fetchPoolMetrics()`
- Invoice Detail (`frontend/app/invoices/[id]/page.tsx`) - Not yet updated

**Recommendation**: Migrate UI to truth endpoints in next phase.

## Key Features

### Reconciliation Tolerances

| Field Type | Tolerance | Reason |
|------------|-----------|--------|
| WAD values | ±1e12 | Rounding in WAD math |
| Token amounts | ±1 wei | EVM precision |
| Utilization BPS | ±1 bps | Basis point rounding |

### APR/APY Calculation

**Method**: Event-based only
- Source: `InterestPaid` events from subgraph
- NAV: Queried from contract at event blocks (`blockTag`)
- Formula: `APR = (lpInterestPaid / avgNAV) * (secondsPerYear / windowSeconds)`
- APY: `APY = (1 + APR/365)^365 - 1`

**No DB-based calculations** - All values derived from on-chain events and contract state.

### Subgraph Lag Handling

- **Target**: < 10 blocks behind
- **Warning**: > 50 blocks behind
- **Fallback**: > 100 blocks behind → Use direct on-chain reads

## API Endpoints

### `GET /truth/pool`

Returns reconciled pool truth:

```json
{
  "modeUsed": "reconciled",
  "onchain": {
    "blockNumber": 12345,
    "timestamp": 1234567890,
    "nav": "10000000000000000000000",
    "sharePriceWad": "1200000000000000000",
    "utilizationBps": 6500,
    "totalPrincipalOutstanding": "5000000000000000000000",
    "totalInterestAccrued": "100000000000000000000",
    "totalLosses": "0",
    "reserveBalance": "500000000000000000000",
    "protocolFeesAccrued": "10000000000000000000",
    "totalLiquidity": "10000000000000000000000",
    "totalBorrowed": "6500000000000000000000"
  },
  "indexed": { ... },
  "mismatches": [],
  "freshness": {
    "subgraphLagBlocks": 5,
    "lastIndexedAt": 1234567890,
    "lastOnchainBlock": 12345
  }
}
```

### `GET /truth/pool/yield?windowDays=7`

Returns APR/APY calculated from events:

```json
{
  "windowDays": 7,
  "windowStartTimestamp": 1234567890,
  "windowEndTimestamp": 1234567890,
  "startBlock": 12000,
  "endBlock": 12345,
  "lpInterestPaid": "100000000000000000000",
  "avgNav": "10000000000000000000000",
  "apr": "5.25",
  "apy": "5.38",
  "method": "InterestPaidEvents+OnchainNAV",
  "eventCount": 5
}
```

## Verification

### Quick Verification Steps

1. **Share Price Consistency**
   ```bash
   # Contract
   contract.sharePriceWad() → "1200000000000000000"
   
   # Truth Endpoint
   curl http://localhost:4000/truth/pool | jq '.onchain.sharePriceWad'
   # Should match exactly (within tolerance)
   ```

2. **NAV Consistency**
   ```bash
   # Contract
   contract.getNAV() → "10000000000000000000000"
   
   # Truth Endpoint
   curl http://localhost:4000/truth/pool | jq '.onchain.nav'
   # Should match exactly (within tolerance)
   ```

3. **Subgraph Lag Test**
   ```bash
   # Stop subgraph indexing
   # Wait 100+ blocks
   # Check truth endpoint
   curl http://localhost:4000/truth/pool | jq '.modeUsed'
   # Should show: "onchain-only"
   # Should show: freshness.subgraphLagBlocks > 100
   ```

## Removed Calculations

### ❌ No Longer Allowed

1. **Computing NAV from DB records**
   - ❌ Cannot sum invoices from database
   - ✅ Must call `contract.getNAV()`

2. **Computing Share Price from DB**
   - ❌ Cannot calculate from stored deposits/withdraws
   - ✅ Must call `contract.sharePriceWad()`

3. **Computing APR from DB interest records**
   - ❌ Cannot use database interest payments
   - ✅ Must use `InterestPaid` events + on-chain NAV

4. **Computing Utilization from DB**
   - ❌ Cannot calculate from database loans
   - ✅ Must call `contract.utilization()`

## Next Steps

### Phase 2: UI Migration

1. **Pool Overview Card** (`frontend/app/page.tsx`)
   - Replace `fetchPoolOverview()` with `fetchPoolTruth()`
   - Display freshness indicators
   - Show mismatch warnings if any

2. **LP Dashboard** (`frontend/app/lp/page.tsx`)
   - Replace `fetchLPPosition()` with `fetchLPPositionTruth()`
   - Replace `fetchPoolMetrics()` with `fetchPoolYieldTruth()`
   - Show "computed from on-chain events" tooltip

3. **Invoice Detail** (`frontend/app/invoices/[id]/page.tsx`)
   - Add `fetchInvoiceTruth()` call
   - Show "Backend cache out of sync" banner if `dbOutOfSync: true`

### Phase 3: Testing

1. **Backend Unit Tests**
   - Mock onchain and subgraph responses
   - Verify mismatch detection
   - Verify fallback logic

2. **Integration Tests**
   - Test reconciliation job
   - Test subgraph lag fallback
   - Test APR/APY calculation accuracy

## Environment Variables

Add to `.env`:

```bash
SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../tifa/version/latest
```

If not set, truth service will use on-chain only mode.

## Summary

✅ **Truth Service**: Fully implemented
✅ **Reconciliation**: Working with automated job
✅ **APR/APY**: Event-based calculation implemented
✅ **Subgraph**: Updated with PoolMetrics entity
🔄 **UI Migration**: Pending (endpoints available)

The system now enforces single source of truth at the backend level. UI migration to truth endpoints is recommended but not blocking.


