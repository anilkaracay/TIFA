# Single Source of Truth - TIFA Accounting Architecture

## Overview

TIFA enforces a **single source of truth** principle across the entire stack:
**On-chain Contracts → Subgraph (Indexed Events) → Backend (Read-only Aggregator) → UI**

## Canonical Fields and Their Source

### Pool-Level Metrics

| Field | Source | Contract Method | Notes |
|-------|--------|----------------|-------|
| NAV | On-chain | `getNAV()` | Net Asset Value = cash + principal + interest - losses - protocol fees |
| Share Price | On-chain | `sharePriceWad()` | NAV / totalShares (WAD format, 1e18) |
| Utilization | On-chain | `utilization()` | totalBorrowed / totalLiquidity (BPS, 0-10000) |
| Total Principal Outstanding | On-chain | `totalPrincipalOutstanding()` | Sum of all active loan principals |
| Total Interest Accrued | On-chain | `totalInterestAccrued()` | Unpaid interest across all positions |
| Total Losses | On-chain | `totalLosses()` | Realized losses from defaults |
| Reserve Balance | On-chain | `reserveBalance()` | First-loss buffer / reserves |
| Protocol Fees Accrued | On-chain | `protocolFeesAccrued()` | Accumulated protocol fees |

### Position-Level Metrics

| Field | Source | Contract Method | Notes |
|-------|--------|----------------|-------|
| Position Principal | On-chain | `getPosition(invoiceId).usedCredit` | Outstanding principal for a position |
| Position Interest | On-chain | `getPosition(invoiceId).interestAccrued` | Accrued interest for a position |
| Position Status | On-chain | `getPosition(invoiceId).isInDefault` | Default status |
| Recourse Mode | On-chain | `getPosition(invoiceId).recourseMode` | RECOURSE or NON_RECOURSE |

### LP Position Metrics

| Field | Source | Contract Method | Notes |
|-------|--------|----------------|-------|
| LP Shares | On-chain | `lpToken.balanceOf(wallet)` | ERC20 balance |
| Underlying Value | Computed | `shares * sharePriceWad / 1e18` | Derived from canonical sharePriceWad |
| PnL | Computed | `underlyingValue - deposits` | Requires deposit history (from events) |

### Default/Recourse Stats

| Field | Source | Notes |
|-------|--------|-------|
| Default Count | Subgraph | Count of `DefaultDeclared` events |
| Recourse Payments | Subgraph | Sum of `RecoursePaid` events |
| Loss Written Down | Subgraph | Sum of `LossWrittenDown` events |

## Allowed Computations

### ✅ Allowed (Derived from Canonical Values)

1. **APR/APY Calculation**
   - **Source**: `InterestPaid` events + `nav()` at event blocks
   - **Method**: Sum LP interest over window, divide by average NAV
   - **Formula**: `APR = (lpInterestPaid / avgNAV) * (secondsPerYear / windowSeconds)`
   - **APY**: `APY = (1 + APR/365)^365 - 1`

2. **LP Underlying Value**
   - **Source**: `shares * sharePriceWad / 1e18`
   - **Allowed** because `sharePriceWad` is canonical

3. **Utilization Percentage**
   - **Source**: `utilization() / 100`
   - **Allowed** because `utilization()` is canonical

4. **Formatted Display Values**
   - **Source**: Canonical values + formatting (decimals, currency symbols)
   - **Allowed** for UI display only

### ❌ Forbidden (No DB-Based Financial Math)

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

## Data Freshness SLA

### Subgraph Indexing

- **Target Lag**: < 10 blocks behind chain head
- **Warning Threshold**: > 50 blocks behind
- **Fallback Threshold**: > 100 blocks behind → Use direct on-chain reads

### UI Indicators

- **Last Indexed**: Show `lastIndexedAt` timestamp
- **Block Lag**: Show `subgraphLagBlocks` count
- **Warning**: If lag > threshold, show "Indexed data lagging — showing on-chain truth"

### Backend Fallback Logic

1. **Primary**: Query subgraph for `PoolMetrics` entity
2. **Check Lag**: Compare `indexedBlockNumber` vs current block
3. **Fallback**: If lag > threshold, query contracts directly
4. **Reconcile**: Compare subgraph vs on-chain, flag mismatches

## Reconciliation Tolerances

| Field Type | Tolerance | Reason |
|------------|-----------|--------|
| WAD values (sharePrice, NAV) | ±1e12 | Rounding in WAD math |
| Token amounts (wei) | ±1 wei | EVM precision |
| Utilization BPS | ±1 bps | Basis point rounding |
| Timestamps | ±60 seconds | Block time variance |

## Architecture Flow

```
┌─────────────────┐
│  On-Chain       │
│  Contracts      │ ← SINGLE SOURCE OF TRUTH
└────────┬────────┘
         │ Events
         ▼
┌─────────────────┐
│  Subgraph       │ ← Indexed Projection
│  (Events)       │
└────────┬────────┘
         │ GraphQL Query
         ▼
┌─────────────────┐
│  Backend        │ ← Read-only Aggregator
│  Truth Service  │   + Reconciliation
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│  UI             │ ← Format & Display Only
│  (Frontend)      │   No Financial Math
└─────────────────┘
```

## Verification Checklist

### Quick Verification

1. **Share Price Consistency**
   ```bash
   # Contract
   contract.sharePriceWad() → "1200000000000000000"
   
   # Truth Endpoint
   GET /truth/pool → sharePriceWad: "1200000000000000000"
   
   # Should match exactly (within tolerance)
   ```

2. **NAV Consistency**
   ```bash
   # Contract
   contract.getNAV() → "10000000000000000000000"
   
   # Truth Endpoint
   GET /truth/pool → nav: "10000000000000000000000"
   
   # Should match exactly (within tolerance)
   ```

3. **Subgraph Lag Test**
   ```bash
   # Stop subgraph indexing
   # Wait 100+ blocks
   # Check /truth/pool
   # Should show: modeUsed: "onchain-only"
   # Should show: freshness.subgraphLagBlocks > 100
   ```

## Implementation Notes

### Backend Truth Service

- **Mode 1**: Direct on-chain reads (fallback)
- **Mode 2**: Subgraph indexed (primary)
- **Mode 3**: Reconciled (preferred, compares both)

### UI Consumption

- **Pool Overview**: `GET /truth/pool`
- **LP Position**: `GET /truth/lp/:wallet`
- **Invoice Status**: `GET /truth/invoice/:id`
- **Yield Metrics**: `GET /truth/pool/yield?windowDays=7`

### Error Handling

- **Subgraph Unavailable**: Fallback to on-chain
- **Contract RPC Error**: Return error, don't compute from DB
- **Mismatch Detected**: Log warning, return both values

## Future Enhancements

1. **Real-time Event Streaming**: WebSocket updates from subgraph
2. **Historical Snapshots**: Time-series data for analytics
3. **Multi-chain Support**: Extend truth service to multiple chains
4. **Automated Alerts**: Webhook notifications on mismatches


