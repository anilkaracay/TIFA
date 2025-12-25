# LP Yield Mathematics & Accounting

## Overview

This document defines the mathematical model for Liquidity Provider (LP) yield, share pricing, and Net Asset Value (NAV) accounting in the TIFA Financing Pool.

---

## Section A: Key Quantities

### Core State Variables

- **`totalLiquidity`**: Cash balance in the pool (stablecoin units)
- **`totalBorrowed`**: Principal outstanding across all loans
- **`totalPrincipalOutstanding`**: Same as `totalBorrowed` (for clarity)
- **`totalInterestAccrued`**: Interest earned but not yet paid (accrued interest)
- **`totalLosses`**: Realized losses from defaults (principal written down)
- **`protocolFeesAccrued`**: Protocol fees accumulated (portion of interest)
- **`totalShares`**: Total LP token supply (TIFA-LP tokens)
- **`NAV`**: Net Asset Value of the pool
- **`sharePrice`**: Price per LP share (NAV / totalShares)

### Derived Metrics

- **`utilization`**: `totalBorrowed / totalLiquidity` (in basis points)
- **`availableLiquidity`**: `totalLiquidity - totalBorrowed`
- **`LP APR`**: Annual Percentage Rate for LPs (net of protocol fees)
- **`LP APY`**: Annual Percentage Yield (compounded estimate)

---

## Section B: NAV Definition

### Formula

```
NAV = cashBalance + totalPrincipalOutstanding + totalInterestAccrued - totalLosses - protocolFeesAccrued
```

Where:
- `cashBalance` = `totalLiquidity` (stablecoin balance in pool)
- `totalPrincipalOutstanding` = Sum of all loan principals
- `totalInterestAccrued` = Sum of accrued but unpaid interest
- `totalLosses` = Realized defaults/write-downs
- `protocolFeesAccrued` = Fees allocated to protocol (reduces LP NAV)

**Rationale**: 
- NAV represents the total value available to LPs
- Interest accrues over time, increasing NAV
- Losses reduce NAV
- Protocol fees are segregated and reduce LP NAV

---

## Section C: Share Price Definition

### Formula

```
sharePrice = NAV / totalShares
```

**Special Cases**:
- If `totalShares == 0`: `sharePrice = 1.0` (scaled to WAD: 1e18)
- Share price increases as NAV grows (interest accrues)
- Share price decreases if losses occur

**Units**: WAD (1e18 fixed point)
- `sharePriceWad = (NAV * 1e18) / totalShares`

---

## Section D: LP Deposit Mint Formula

### Formula

```
sharesMinted = depositAmount * 1e18 / sharePriceWad
```

**Special Case** (First Deposit):
```
if (totalShares == 0) {
    sharesMinted = depositAmount
    sharePriceWad = 1e18  // 1.0 in WAD
}
```

**Example**:
- NAV = 1000, totalShares = 1000 → sharePrice = 1.0
- Deposit 100 → sharesMinted = 100
- New NAV = 1100, new totalShares = 1100 → sharePrice still 1.0

**After Interest Accrual**:
- NAV = 1100, totalShares = 1000 → sharePrice = 1.1
- Deposit 100 → sharesMinted = 100 / 1.1 = 90.909 shares
- New NAV = 1200, new totalShares = 1090.909 → sharePrice = 1.1

---

## Section E: LP Withdraw Redeem Formula

### Formula

```
underlyingOut = sharesBurned * sharePriceWad / 1e18
```

**Example**:
- NAV = 1100, totalShares = 1000 → sharePrice = 1.1
- Burn 100 shares → underlyingOut = 100 * 1.1 = 110
- New NAV = 990, new totalShares = 900 → sharePrice = 1.1

**Constraints**:
- Must satisfy utilization constraints (e.g., utilization < maxUtilization)
- `underlyingOut <= availableLiquidity` (or check utilization)

---

## Section F: Interest Model

### Interest Accrual Formula

```
interestDelta = principal * borrowAprWad * dt / secondsPerYear
```

Where:
- `principal`: Loan principal amount
- `borrowAprWad`: Borrow APR in WAD (e.g., 0.15e18 = 15%)
- `dt`: Time elapsed since last accrual (seconds)
- `secondsPerYear`: 365 * 24 * 3600 = 31,536,000

### Accrual Mechanism

Interest accrues continuously:
- On `drawCredit`: Set `lastAccrualTs = block.timestamp`
- On `repayCredit`: Call `_accrue(positionId)` first
- On `deposit`/`withdraw`: Use current NAV (includes accrued interest)

### Per-Position Tracking

Each `CollateralPosition` tracks:
- `principal`: Original loan amount
- `interestAccrued`: Accumulated interest (not yet paid)
- `lastAccrualTs`: Timestamp of last accrual

### Global Totals

- `totalInterestAccrued`: Sum of all `position.interestAccrued`
- Updated on each accrual: `totalInterestAccrued += interestDelta`

---

## Section G: APR/APY Reporting

### APR Definition

```
APR = (feesToLP / avgNAV) * (secondsPerYear / windowSeconds)
```

Where:
- `feesToLP`: Interest paid to LPs (after protocol fees) over window
- `avgNAV`: Time-weighted average NAV over window
- `windowSeconds`: Observation period (e.g., 7 days = 604,800 seconds)

### APY Definition (Compounded)

```
APY = (1 + APR / compoundingPeriods)^compoundingPeriods - 1
```

For daily compounding:
```
APY = (1 + APR / 365)^365 - 1
```

For continuous compounding:
```
APY = e^(APR) - 1 ≈ APR + APR²/2 + ... (for small APR)
```

### Implementation Strategy

**MVP (Since Inception)**:
```
APR = totalInterestPaidToLP / avgNAVApprox * annualizationFactor
```

Where:
- `totalInterestPaidToLP`: Cumulative interest paid to LPs
- `avgNAVApprox`: Average of initial NAV and current NAV
- `annualizationFactor`: `secondsPerYear / (now - poolStartTime)`

**Future (Rolling Window)**:
- Store NAV snapshots daily or per-event
- Compute time-weighted average NAV
- Track interest paid in rolling window
- More accurate but requires storage

---

## Section H: Fee Split

### Protocol Fee

```
protocolFeeBps = 1000  // 10% of interest
interestToProtocol = interestPaid * protocolFeeBps / 10000
interestToLP = interestPaid - interestToProtocol
```

**Example**:
- Interest paid: 100
- Protocol fee (10%): 10
- LP interest: 90

### Protocol Fee Accumulation

```
protocolFeesAccrued += interestToProtocol
```

Protocol fees reduce NAV (segregated from LP funds).

---

## Section I: Avoiding Per-LP Accounting

### Share Price Mechanism

LP yields are reflected **automatically** in share price:
- Interest accrues → NAV increases → share price increases
- No distributions needed
- Each LP's value = `shares * sharePrice`

**Benefits**:
- No per-LP loops
- Gas efficient
- Fair (proportional to shares)

**Example**:
- LP A: 1000 shares, sharePrice = 1.0 → value = 1000
- Interest accrues → sharePrice = 1.1
- LP A: 1000 shares, sharePrice = 1.1 → value = 1100
- No transfer needed, value increased automatically

---

## Section J: Loss Handling

### Write-Down Mechanism

When a loan defaults:
```
totalLosses += writeDownAmount
NAV decreases by writeDownAmount
sharePrice decreases proportionally
```

**Example**:
- NAV = 1000, totalShares = 1000 → sharePrice = 1.0
- Default: writeDown 50
- New NAV = 950, totalShares = 1000 → sharePrice = 0.95
- All LPs share the loss proportionally

---

## Section K: Future Improvements

### 1. Utilization Curve
- Variable borrow APR based on utilization
- Higher utilization → higher APR → more LP yield

### 2. Time-Weighted APR
- Store NAV snapshots
- Compute accurate time-weighted averages
- More precise APR reporting

### 3. Tranching
- Senior/junior tranches
- Different risk/return profiles
- Separate NAV/share price per tranche

### 4. Compounding Frequency
- Daily/weekly/monthly compounding
- More accurate APY calculations

### 5. Reserve Buffer
- Segregated reserve for first-loss protection
- Reduces NAV but protects LPs

---

## Section L: Implementation Notes

### Fixed Point Math (WAD)

All calculations use WAD (1e18 fixed point):
- `1.0` = `1e18`
- `0.15` (15%) = `0.15e18`
- Multiplication: `(a * b) / 1e18`
- Division: `(a * 1e18) / b`

### Precision Considerations

- Interest accrual uses `block.timestamp` (seconds)
- Avoid overflow: use `SafeMath` or Solidity 0.8+ checks
- Rounding: favor LPs (round down on withdrawals, round up on deposits)

### Gas Optimization

- Accrue interest only when needed (on repay, not on every view call)
- Cache NAV/sharePrice if unchanged
- Avoid loops over positions

---

## Section M: Example Scenarios

### Scenario 1: First Deposit
1. Pool empty: NAV = 0, totalShares = 0
2. Deposit 1000 → sharesMinted = 1000, sharePrice = 1.0
3. NAV = 1000, totalShares = 1000

### Scenario 2: Borrow & Accrue Interest
1. Borrow 500 (principal)
2. After 1 year (15% APR): interestAccrued = 75
3. NAV = 1000 + 500 + 75 = 1575
4. sharePrice = 1575 / 1000 = 1.575

### Scenario 3: Repay Interest
1. Repay 75 (interest)
2. Protocol fee (10%): 7.5 → protocolFeesAccrued
3. LP interest: 67.5 → increases NAV (already in NAV via accrual)
4. After repayment: totalInterestAccrued decreases, NAV stays same (cash increases)

### Scenario 4: Second Deposit After Interest
1. NAV = 1575, totalShares = 1000, sharePrice = 1.575
2. Deposit 100 → sharesMinted = 100 / 1.575 = 63.49
3. New NAV = 1675, new totalShares = 1063.49, sharePrice = 1.575

### Scenario 5: Withdraw After Yield
1. LP has 1000 shares, sharePrice = 1.575
2. Withdraw 100 shares → underlyingOut = 100 * 1.575 = 157.5
3. LP receives 157.5 (original 100 + yield 57.5)

---

## Conclusion

This model provides:
- ✅ Deterministic share pricing
- ✅ On-chain verifiable NAV
- ✅ No per-LP loops
- ✅ Fair yield distribution
- ✅ Protocol fee segregation
- ✅ Loss handling

The implementation follows DeFi best practices and is production-ready.



