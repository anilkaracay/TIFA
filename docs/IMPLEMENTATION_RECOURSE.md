# Recourse vs Non-Recourse Implementation Summary

## Overview

This document summarizes the implementation of recourse and non-recourse risk models for the TIFA Financing Pool.

---

## 📚 Documentation

**Location**: `docs/economics/recourse-vs-nonrecourse.md`

Comprehensive documentation explaining:
- Recourse model: Issuer obligation, pool protection
- Non-recourse model: Pool bears loss, loss waterfall
- Parameters: grace period, recovery window, write-down, reserve targets
- Risk assessment and economic incentives

---

## 🔧 Smart Contract Implementation

### New Enums (`contracts/contracts/TifaTypes.sol`)

```solidity
enum RecourseMode {
    RECOURSE,      // 0
    NON_RECOURSE   // 1
}

enum DefaultResolution {
    NONE,              // 0
    RECOVERED,         // 1
    WRITTEN_DOWN,      // 2
    RECOURSE_CLAIMED   // 3
}
```

### Updated CollateralPosition Struct

Added fields:
- `recourseMode`: RECOURSE or NON_RECOURSE
- `dueDate`: Invoice due date
- `graceEndsAt`: Grace period end timestamp
- `defaultDeclaredAt`: Default declaration timestamp
- `isInDefault`: Default status flag
- `resolution`: Default resolution status

### New State Variables

- `reserveBalance`: First-loss buffer
- `reserveTargetBps`: Reserve target (basis points)
- `gracePeriodSeconds`: Grace period duration (default: 7 days)
- `recoveryWindowSeconds`: Recovery window duration (default: 30 days)
- `writeDownBps`: Write-down percentage (default: 10000 = 100%)
- `maxLtvRecourseBps`: Max LTV for recourse (default: 8000 = 80%)
- `maxLtvNonRecourseBps`: Max LTV for non-recourse (default: 6000 = 60%)

### New Functions

1. **`setPositionRecourseMode(bytes32 invoiceId, RecourseMode mode)`**
   - Set recourse mode for a position
   - Can only be called before credit is drawn
   - Adjusts maxCreditLine based on mode

2. **`markOverdueAndStartGrace(bytes32 invoiceId)`**
   - Mark position as overdue
   - Start grace period timer
   - Only callable by admin/operator

3. **`declareDefault(bytes32 invoiceId)`**
   - Declare position in default
   - Only after grace period ended
   - Emits DefaultDeclared event

4. **`payRecourse(bytes32 invoiceId, uint256 amount)`**
   - Pay recourse obligation (RECOURSE mode)
   - Callable by issuer
   - Pays interest first, then principal

5. **`resolveDefault(bytes32 invoiceId, DefaultResolution resolutionType)`**
   - Resolve default (NON_RECOURSE)
   - Can mark as RECOVERED or WRITTEN_DOWN

6. **`writeDownLoss(bytes32 invoiceId, uint256 lossAmount)`**
   - Write down loss (NON_RECOURSE only)
   - Applies loss waterfall
   - Uses reserve first, then LP NAV

7. **`fundReserve(uint256 amount)`**
   - Fund reserve (admin only)

8. **`setReserveTarget(uint256 bps)`**
   - Set reserve target (admin only)

9. **`routeProtocolFeesToReserve()`**
   - Route protocol fees to reserve until target met

### Loss Waterfall Implementation

When loss is written down:

```solidity
if (reserveBalance >= lossAmount) {
    reserveBalance -= lossAmount;
    // LP NAV unchanged (loss absorbed by reserve)
} else {
    reserveUsed = reserveBalance;
    lpLoss = lossAmount - reserveBalance;
    reserveBalance = 0;
    // LP NAV reduced by lpLoss (share price drops)
}
```

### Events

- `GraceStarted(bytes32 indexed invoiceId, uint256 dueDate, uint256 graceEndsAt)`
- `DefaultDeclared(bytes32 indexed invoiceId, RecourseMode mode, uint256 principal, uint256 interest, uint256 timestamp)`
- `RecoursePaid(bytes32 indexed invoiceId, address indexed issuer, uint256 amount, bytes32 txHash)`
- `LossWrittenDown(bytes32 indexed invoiceId, uint256 lossAmount, uint256 reserveUsed, uint256 lpLoss)`
- `ReserveFunded(uint256 amount, uint256 newBalance)`
- `ReserveTargetUpdated(uint256 bps)`
- `PositionRecourseModeSet(bytes32 indexed invoiceId, RecourseMode mode)`

---

## 🧪 Tests

**Location**: `contracts/test/RecourseNonRecourse.test.ts`

### Test Scenarios

1. ✅ **RECOURSE: Issuer pays recourse after default**
   - Borrow → Default → Issuer pays → No LP loss

2. ✅ **RECOURSE: LTV adjustment when switching mode**
   - Lock → Set RECOURSE → Max credit line increases

3. ✅ **NON_RECOURSE: Reserve absorbs loss**
   - Borrow → Default → Write down → Reserve covers → LP NAV unchanged

4. ✅ **NON_RECOURSE: Reserve insufficient**
   - Borrow → Default → Write down → Reserve exhausted → LP NAV reduced

5. ✅ **Existing flow compatibility**
   - Tokenize → Lock → Draw → Repay → Release (still works)

6. ✅ **Reserve management**
   - Fund reserve, set target

### Running Tests

```bash
cd contracts
npm test -- test/RecourseNonRecourse.test.ts
```

---

## 📊 Subgraph Updates

### Schema (`subgraph/schema.graphql`)

**TODO**: Add entities:
- `DefaultEvent`
- `ReserveSnapshot`
- `PositionRisk`

### Mappings (`subgraph/src/financingPool.ts`)

**TODO**: Add handlers for:
- `GraceStarted`
- `DefaultDeclared`
- `RecoursePaid`
- `LossWrittenDown`
- `ReserveFunded`

---

## 🔌 Backend Updates

### New Endpoints (TODO)

1. **`GET /pool/risk`**
   - Reserve balance
   - Reserve target
   - Default statistics
   - Loss statistics

2. **`POST /positions/:id/recourse/pay`**
   - Pay recourse obligation
   - Calls `payRecourse()` on-chain

3. **`GET /invoices/:id/risk`**
   - Recourse mode
   - Overdue status
   - Grace end timestamp
   - Default status

### Updated Endpoints

- **`GET /invoices/:id`**: Include risk information
- **`GET /pool/overview`**: Include reserve balance and default stats

---

## 🎨 Frontend Updates

### Invoice Detail Page (TODO)

Add "Risk & Mode" panel:
- Mode: RECOURSE / NON_RECOURSE
- Due date countdown
- Grace period status
- Default status
- Actions:
  - If issuer and RECOURSE: "Pay Recourse" button
  - If admin: "Declare Default" button

### Pool Overview (TODO)

Add metrics:
- Reserve balance
- Reserve target %
- Defaults count
- Losses absorbed by reserve vs LP

---

## 🚀 Deployment Steps

1. **Compile Contracts**:
   ```bash
   cd contracts
   npm run compile
   ```

2. **Run Tests**:
   ```bash
   npm test -- test/RecourseNonRecourse.test.ts
   ```

3. **Deploy Contracts**:
   ```bash
   npm run deploy:base  # or your network
   ```

4. **Update Deployment JSONs**:
   - Update all `deployments.json` files with new contract addresses

5. **Restart Backend**:
   ```bash
   cd backend
   npm run dev
   ```

6. **Update Frontend** (when UI changes ready):
   ```bash
   cd frontend
   npm run dev
   ```

---

## 📈 Key Features

### Recourse Model
- ✅ Issuer obligated to repay
- ✅ Pool protected from losses
- ✅ Higher LTV allowed (80%)
- ✅ Issuer can pay recourse after default

### Non-Recourse Model
- ✅ Pool bears loss
- ✅ Loss waterfall (reserve → LP NAV)
- ✅ Lower LTV required (60%)
- ✅ Reserve absorbs losses first

### Reserve Mechanism
- ✅ Segregated first-loss buffer
- ✅ Protocol fees can route to reserve
- ✅ Protects LP NAV when sufficient
- ✅ Configurable target

---

## ✅ Checklist

- [x] Documentation (`docs/economics/recourse-vs-nonrecourse.md`)
- [x] Contract enums (`RecourseMode`, `DefaultResolution`)
- [x] Position struct updates
- [x] Risk model functions
- [x] Loss waterfall implementation
- [x] Reserve management
- [x] Events
- [x] Test suite (`RecourseNonRecourse.test.ts`)
- [ ] Subgraph schema updates
- [ ] Subgraph mappings
- [ ] Backend endpoints
- [ ] Frontend UI updates

---

## 📝 Notes

- **Position-Level Mode**: Each position can have different recourse mode
- **Default Flow**: Due date → Grace → Default → Resolution
- **Loss Waterfall**: Reserve first, then LP NAV
- **NAV Accounting**: NAV includes totalLosses, but reserve absorption doesn't reduce LP NAV
- **Share Price**: Reflects LP losses when reserve insufficient

---

## 🎯 Summary

The recourse vs non-recourse risk model implementation provides:
- ✅ Flexible risk models per position
- ✅ Clear loss waterfall
- ✅ Reserve protection mechanism
- ✅ Comprehensive test coverage
- ✅ Production-ready contracts

**Next Steps**: Update subgraph, backend, and frontend to expose risk model features.









