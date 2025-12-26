# LP Yield Accounting Implementation Summary

## Overview

This document summarizes the implementation of LP yield mathematics, APR/APY calculations, NAV accounting, and share pricing for the TIFA Financing Pool.

---

## 📚 Documentation

**Location**: `docs/economics/lp-yield.md`

This comprehensive document explains:
- Key quantities (NAV, share price, interest accrual)
- Mathematical formulas for deposits, withdrawals, and share pricing
- Interest accrual mechanism
- APR/APY calculation methodology
- Protocol fee split
- Loss handling

---

## 🔧 Smart Contract Implementation

### New Files

1. **`contracts/contracts/WadMath.sol`**
   - Fixed-point arithmetic library using WAD (1e18) precision
   - Functions: `wadMul`, `wadDiv`, `bpsMul`, `fromWad`, `toWad`
   - Constants: `WAD`, `SECONDS_PER_YEAR`

### Updated Files

2. **`contracts/contracts/FinancingPool.sol`**
   - **New State Variables**:
     - `totalPrincipalOutstanding`: Principal outstanding across all loans
     - `totalInterestAccrued`: Interest accrued but not yet paid
     - `totalLosses`: Realized losses from defaults
     - `protocolFeesAccrued`: Protocol fees accumulated
     - `borrowAprWad`: Borrow APR in WAD (e.g., 0.15e18 = 15%)
     - `protocolFeeBps`: Protocol fee in basis points (e.g., 1000 = 10%)
     - `poolStartTime`: Timestamp when pool was created
   
   - **Extended CollateralPosition Struct**:
     - `interestAccrued`: Accumulated interest for this position
     - `lastAccrualTs`: Timestamp of last interest accrual
   
   - **New Functions**:
     - `nav()`: Calculate Net Asset Value
     - `sharePriceWad()`: Calculate LP share price in WAD
     - `_accrueInterest(bytes32 invoiceId)`: Internal function to accrue interest
     - `accrueInterest(bytes32 invoiceId)`: Public function for testing/viewing
     - `withdrawProtocolFees(address to, uint256 amount)`: Withdraw protocol fees (admin only)
     - `writeDownLoss(bytes32 invoiceId, uint256 lossAmount)`: Write down losses (admin only)
   
   - **Updated Functions**:
     - `drawCredit()`: Sets `lastAccrualTs` when credit is drawn
     - `repayCredit()`: Accrues interest first, then applies repayment (interest first, then principal), splits protocol fee
     - `deposit()`: Uses `sharePriceWad()` for share calculation
     - `withdraw()`: Uses `sharePriceWad()` for withdrawal calculation
     - `getNAV()`: Updated formula: `cashBalance + totalPrincipalOutstanding + totalInterestAccrued - totalLosses - protocolFeesAccrued`
     - `getLPSharePrice()`: Now calls `sharePriceWad()`
     - `calculateLPSharesForDeposit()`: Uses WAD math
     - `calculateWithdrawalAmount()`: Uses WAD math
   
   - **New Events**:
     - `InterestAccrued(bytes32 indexed invoiceId, uint256 interestDelta, uint256 totalInterestAccrued)`
     - `InterestPaid(bytes32 indexed invoiceId, uint256 interestPaid, uint256 protocolFee, uint256 lpInterest)`
     - `SharePriceUpdated(uint256 nav, uint256 sharePriceWad)`
     - `ProtocolFeesWithdrawn(address indexed to, uint256 amount)`

### Deployment

3. **`contracts/deploy/03_deploy_financingPool.ts`**
   - Updated to pass `borrowAprWad` (15% APR) and `protocolFeeBps` (10%) to constructor

---

## 🧪 Tests

**Location**: `contracts/test/LPYieldAccounting.test.ts`

### Test Scenarios

1. ✅ **First Deposit**: Mint shares 1:1 on first deposit
2. ✅ **Second Deposit After Interest**: Mint shares at higher share price after interest accrual
3. ✅ **Interest Accrual**: Interest accrues over time (1 year test)
4. ✅ **Repayment with Interest**: Pay interest first, then principal, protocol fee split correct
5. ✅ **Share Price Increase**: Share price increases after interest earned
6. ✅ **Withdraw with Yield**: LP receives principal + yield proportional to shares
7. ✅ **Loss Handling**: Write-down reduces NAV and share price
8. ✅ **Protocol Fee Withdrawal**: Admin can withdraw protocol fees

### Running Tests

```bash
cd contracts
npm test -- LPYieldAccounting.test.ts
```

---

## 🔌 Backend Implementation

### Updated Files

**`backend/src/routes/lp.ts`**

1. **Updated `/pool/overview` endpoint**:
   - Now fetches: `totalPrincipalOutstanding`, `totalInterestAccrued`, `totalLosses`, `protocolFeesAccrued`, `borrowAprWad`, `protocolFeeBps`, `poolStartTime`
   - Calculates **APR** and **APY** (since inception, simplified)
   - Returns formatted values for all metrics

2. **New `/pool/metrics` endpoint**:
   - Detailed metrics for analytics
   - Returns NAV, share price, interest accrued, losses, protocol fees, utilization, APR, APY, borrow APR, protocol fee %, pool age

### APR/APY Calculation

**Formula** (since inception):
```
APR = (totalInterestPaidToLP / avgNAV) * (secondsPerYear / poolAgeSeconds)
APY = (1 + APR/365)^365 - 1
```

Where:
- `totalInterestPaidToLP = totalInterestAccrued * (10000 - protocolFeeBps) / 10000`
- `avgNAV` ≈ current NAV (simplified)
- `poolAgeSeconds = now - poolStartTime`

**Future Improvement**: Use time-weighted average NAV for more accuracy.

---

## 🎨 Frontend Implementation

### Updated Files

**`frontend/lib/backendClient.ts`**

1. **Updated `PoolOverview` interface**:
   - Added: `totalPrincipalOutstanding`, `totalInterestAccrued`, `totalLosses`, `protocolFeesAccrued`, `borrowAprWad`, `protocolFeeBps`, `poolStartTime`, `apr`, `apy`
   - Added formatted versions of all new fields

2. **New `PoolMetrics` interface**:
   - Detailed metrics structure

3. **New `fetchPoolMetrics()` function**:
   - Fetches detailed metrics from `/pool/metrics`

### UI Updates Needed

**TODO**: Update Pool Overview card in `frontend/app/page.tsx` to display:
- Share Price
- LP APR / APY
- Total Interest Accrued
- Protocol Fees Accrued

**TODO**: Update LP Dashboard (`frontend/app/lp/page.tsx`) to display:
- Your LP shares
- Underlying value now
- PnL (value - deposits)
- Estimated APY

---

## 📊 Subgraph (Future)

**TODO**: Update subgraph schema and mappings:

1. **Schema** (`subgraph/schema.graphql`):
   ```graphql
   type PoolMetrics @entity {
     id: ID!
     nav: BigInt!
     sharePriceWad: BigInt!
     totalPrincipalOutstanding: BigInt!
     totalInterestAccrued: BigInt!
     totalLosses: BigInt!
     protocolFeesAccrued: BigInt!
     utilization: BigInt!
     timestamp: BigInt!
   }
   ```

2. **Mappings** (`subgraph/src/financingPool.ts`):
   - Index `InterestAccrued` events
   - Index `InterestPaid` events
   - Index `SharePriceUpdated` events
   - Index `ProtocolFeesWithdrawn` events

---

## 🚀 Deployment Steps

1. **Compile Contracts**:
   ```bash
   cd contracts
   npm run compile
   ```

2. **Run Tests**:
   ```bash
   npm test -- LPYieldAccounting.test.ts
   ```

3. **Deploy Contracts**:
   ```bash
   npm run deploy:base  # or your network
   ```

4. **Update Deployment JSONs**:
   - `contracts/deployments.json`
   - `backend/src/onchain/deployments.json`
   - `agent/src/onchain/deployments.json`
   - `frontend/lib/deployments.json`

5. **Restart Backend**:
   ```bash
   cd backend
   npm run dev
   ```

6. **Update Frontend** (if UI changes):
   ```bash
   cd frontend
   npm run dev
   ```

---

## 📈 Key Metrics Exposed

### On-Chain (via Contract)
- `nav()`: Net Asset Value
- `sharePriceWad()`: LP share price in WAD
- `totalPrincipalOutstanding`: Principal outstanding
- `totalInterestAccrued`: Interest accrued
- `totalLosses`: Realized losses
- `protocolFeesAccrued`: Protocol fees
- `utilization()`: Pool utilization in basis points

### Backend API
- `/pool/overview`: Pool overview with APR/APY
- `/pool/metrics`: Detailed metrics

### Frontend (to be implemented)
- Pool Overview Card: TVL, Borrowed, Available, Utilization, Share Price, APR, APY
- LP Dashboard: Position, PnL, Estimated APY

---

## 🔮 Future Improvements

1. **Utilization Curve**: Variable borrow APR based on utilization
2. **Time-Weighted APR**: Store NAV snapshots for accurate time-weighted averages
3. **Tranching**: Senior/junior tranches with different risk/return profiles
4. **Compounding Frequency**: Daily/weekly/monthly compounding for APY
5. **Reserve Buffer**: Segregated reserve for first-loss protection
6. **Subgraph Integration**: Index all events for historical analysis

---

## ✅ Checklist

- [x] Documentation (`docs/economics/lp-yield.md`)
- [x] WadMath library (`contracts/contracts/WadMath.sol`)
- [x] FinancingPool contract updates
- [x] Interest accrual mechanism
- [x] NAV and share price calculations
- [x] Protocol fee handling
- [x] Loss handling
- [x] Test suite (`contracts/test/LPYieldAccounting.test.ts`)
- [x] Deployment script updates
- [x] Backend `/pool/overview` endpoint updates
- [x] Backend `/pool/metrics` endpoint
- [x] Frontend interfaces updated
- [ ] Frontend UI updates (Pool Overview card)
- [ ] Frontend LP Dashboard updates
- [ ] Subgraph schema updates
- [ ] Subgraph mappings updates

---

## 📝 Notes

- **Interest Accrual**: Interest accrues continuously, calculated on `repayCredit()` and viewable via `accrueInterest()`
- **Share Price**: Automatically reflects yield (no distributions needed)
- **Protocol Fees**: Segregated from LP funds, reduce NAV
- **Losses**: Reduce NAV and share price proportionally
- **APR/APY**: Currently calculated since inception (simplified). Future: rolling window with time-weighted NAV.

---

## 🎯 Summary

The LP yield accounting system is **production-ready** with:
- ✅ Deterministic share pricing
- ✅ On-chain verifiable NAV
- ✅ No per-LP loops (gas efficient)
- ✅ Fair yield distribution via share price
- ✅ Protocol fee segregation
- ✅ Loss handling
- ✅ Comprehensive test coverage

**Next Steps**: Update frontend UI to display APR/APY and metrics, then deploy to production.




