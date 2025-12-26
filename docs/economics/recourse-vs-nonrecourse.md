# Recourse vs Non-Recourse Risk Models

## Overview

TIFA Financing Pool supports two distinct risk models at the position level:
- **RECOURSE**: Issuer is obligated to repay pool if debtor defaults
- **NON_RECOURSE**: Pool bears the loss if debtor defaults

This document explains the business logic, parameters, and implementation details.

---

## Section A: Recourse Model

### Definition

**Recourse** means that if the debtor fails to pay the invoice, the **issuer** (invoice creator) is obligated to repay the pool (principal + agreed interest) after a grace period.

### Key Characteristics

1. **Pool Protection**: LPs are protected from losses; issuer bears the credit risk
2. **Issuer Obligation**: Issuer must repay even if debtor defaults
3. **Requires**: 
   - Issuer credit line / guarantee
   - Or issuer collateral
   - Higher trust in issuer creditworthiness

### Flow

```
1. Invoice tokenized → Locked → Credit drawn
2. Due date passes → Invoice unpaid
3. Grace period starts (e.g., 7 days)
4. After grace period → Default declared
5. Issuer must repay:
   - Principal outstanding
   - Accrued interest
   - Any penalties (if applicable)
6. If issuer pays → No LP loss → Share price stable/increases
7. If issuer fails to pay → Can liquidate issuer collateral (v2) or pursue legal action
```

### Use Cases

- Established companies with strong credit
- Invoice factoring with issuer guarantee
- Lower risk for LPs
- Higher LTV allowed (e.g., 70-80%)

---

## Section B: Non-Recourse Model

### Definition

**Non-Recourse** means that if the debtor fails to pay, the **pool** (LPs) bears the loss. The issuer has no obligation to repay.

### Key Characteristics

1. **LP Risk**: LPs take the hit if debtor defaults
2. **Issuer Protection**: Issuer is not liable for debtor default
3. **Requires**:
   - Lower LTV (e.g., 50-60%)
   - Reserve / first-loss buffer
   - Optional insurance
   - Stronger due diligence on debtor

### Loss Waterfall

When a loss is realized:

```
1. Interest buffer (if any accrued but unpaid)
2. Reserve / First-loss buffer
   - If reserve >= loss: Reserve absorbs loss → LP NAV unchanged
   - If reserve < loss: Reserve exhausted → Remaining loss hits LP NAV
3. LP NAV reduction
   - Share price decreases
   - All LPs share loss proportionally
```

### Flow

```
1. Invoice tokenized → Locked → Credit drawn
2. Due date passes → Invoice unpaid
3. Grace period starts
4. After grace period → Default declared
5. Recovery window starts (attempt off-chain collection)
6. After recovery window → Write down loss
7. Loss waterfall applied:
   - Reserve absorbs (if sufficient)
   - LP NAV reduced (if reserve insufficient)
```

### Use Cases

- New companies without credit history
- Higher-risk debtors
- True sale / invoice purchase
- Lower LTV required
- Higher yield potential for LPs (compensates risk)

---

## Section C: Parameters

### Core Parameters

| Parameter | Description | Typical Values |
|-----------|-------------|----------------|
| `gracePeriodSeconds` | Time after due date before default can be declared | 7 days (604,800s) |
| `recoveryWindowSeconds` | Time to attempt collection after default | 30 days (2,592,000s) |
| `writeDownBps` | Percentage of principal to write down if default final | 10000 (100%) or partial |
| `firstLossBps` | Reserve size target as % of NAV | 500 (5%) |
| `maxLTV_Recourse` | Maximum LTV for recourse positions | 8000 (80%) |
| `maxLTV_NonRecourse` | Maximum LTV for non-recourse positions | 6000 (60%) |

### Position-Level Parameters

Each position tracks:
- `recourseMode`: RECOURSE or NON_RECOURSE
- `dueDate`: Invoice due date (from registry)
- `defaultDeclaredAt`: Timestamp when default was declared (0 if not defaulted)
- `isInDefault`: Boolean flag
- `graceEndsAt`: Timestamp when grace period ends

### Pool-Level Parameters

- `reserveBalance`: Current reserve amount (segregated)
- `reserveTargetBps`: Target reserve size (basis points of NAV)
- `defaultLtvBps`: Default LTV (can be overridden per mode)

---

## Section D: Risk Assessment

### Recourse Risk Factors

1. **Issuer Creditworthiness**
   - Credit score / rating
   - Financial statements
   - Payment history
   - Collateral available

2. **Debtor Quality** (still matters, but less critical)
   - Payment history
   - Industry risk
   - Concentration risk

### Non-Recourse Risk Factors

1. **Debtor Creditworthiness** (primary)
   - Credit score / rating
   - Payment history
   - Industry risk
   - Financial stability

2. **Invoice Quality**
   - Authenticity
   - Dispute risk
   - Concentration risk

3. **Reserve Adequacy**
   - Reserve size vs. expected defaults
   - Reserve funding rate
   - Historical loss rates

---

## Section E: Loss Waterfall Details

### Reserve Mechanism

The reserve acts as a first-loss buffer:

1. **Funding Sources**:
   - Protocol fees (routed to reserve until target met)
   - Direct funding by protocol admin
   - Optional: LP contributions (v2)

2. **Target Calculation**:
   ```
   reserveTarget = NAV * reserveTargetBps / 10000
   ```

3. **Loss Absorption**:
   ```
   if (lossAmount <= reserveBalance):
       reserveBalance -= lossAmount
       totalLosses += lossAmount
       LP NAV unchanged (loss absorbed by reserve)
   else:
       remainingLoss = lossAmount - reserveBalance
       reserveBalance = 0
       totalLosses += lossAmount
       LP NAV -= remainingLoss (share price drops)
   ```

### Example Scenarios

**Scenario 1: Reserve Sufficient**
- Loss: 1000 TRY
- Reserve: 2000 TRY
- Result: Reserve → 1000 TRY, LP NAV unchanged

**Scenario 2: Reserve Insufficient**
- Loss: 1000 TRY
- Reserve: 300 TRY
- Result: Reserve → 0, LP NAV reduced by 700 TRY

---

## Section F: Implementation Considerations

### Position-Level vs Pool-Level Mode

**Position-Level (Recommended)**:
- Same pool can support both modes
- More flexible
- Different LTVs per mode
- Requires tracking mode per position

**Pool-Level**:
- Simpler implementation
- Less flexible
- All positions same mode
- Easier to reason about

**TIFA Implementation**: Position-level (recommended)

### Default Declaration

1. **Who can declare**: Agent or Admin (after grace period)
2. **When**: After `dueDate + gracePeriodSeconds`
3. **Effect**: 
   - Position marked as defaulted
   - Timer starts for recovery window
   - If RECOURSE: Issuer obligation triggered
   - If NON_RECOURSE: Recovery window starts

### Recovery Window

- Time to attempt off-chain collection
- After window expires: Write down loss
- Can be extended by admin if recovery in progress

### Write-Down

- Can be partial (e.g., 50% if partial recovery expected)
- Or full (100% if no recovery expected)
- Applied via `writeDownLoss()` function

---

## Section G: Economic Incentives

### Recourse Model

**For Issuers**:
- ✅ Higher LTV possible
- ✅ Lower interest rates (less risk for LPs)
- ❌ Must bear debtor default risk
- ❌ Requires creditworthiness

**For LPs**:
- ✅ Lower risk
- ✅ More predictable returns
- ❌ Lower yield (compensates lower risk)

### Non-Recourse Model

**For Issuers**:
- ✅ No obligation if debtor defaults
- ✅ True sale of receivables
- ❌ Lower LTV required
- ❌ Higher interest rates

**For LPs**:
- ✅ Higher yield potential
- ✅ Diversification across debtors
- ❌ Higher risk
- ❌ Losses hit NAV/share price

---

## Section H: Best Practices

### For Issuers

1. **Choose Recourse if**:
   - Strong credit profile
   - Need higher LTV
   - Can bear debtor default risk
   - Established business

2. **Choose Non-Recourse if**:
   - New business
   - Cannot bear default risk
   - True sale preferred
   - Accept lower LTV

### For LPs

1. **Diversify**:
   - Mix of recourse and non-recourse
   - Different debtors
   - Different industries

2. **Monitor**:
   - Reserve adequacy
   - Default rates
   - Recovery rates
   - Utilization

3. **Risk Management**:
   - Understand loss waterfall
   - Monitor share price
   - Track reserve balance

---

## Section I: Future Enhancements

1. **Insurance Integration**: Optional insurance for non-recourse positions
2. **Tranching**: Senior/junior tranches for non-recourse
3. **Dynamic LTV**: Adjust LTV based on debtor/issuer credit
4. **Automated Recovery**: Smart contract-based recovery mechanisms
5. **Credit Scoring**: On-chain or oracle-based credit scores

---

## Conclusion

The recourse vs non-recourse choice provides flexibility for different risk profiles:

- **Recourse**: Lower risk, higher LTV, issuer bears risk
- **Non-Recourse**: Higher risk, lower LTV, pool bears risk

Both models are production-ready and provide clear risk/return trade-offs for all participants.




