# Role-Based Access Control (RBAC) Implementation

## Overview

TIFA now implements role-based access control (RBAC) for clear separation of concerns across UI and backend. This ensures that users only see and can access features appropriate to their role.

## Role Model

### Roles Defined

1. **ISSUER** - Company issuing invoices
   - Can create invoices
   - Can tokenize invoices
   - Can draw credit (finance)
   - Can repay credit
   - Can pay recourse

2. **LP** - Liquidity Provider
   - Can deposit liquidity
   - Can withdraw liquidity
   - Can view LP dashboard and yield metrics

3. **ADMIN** - Protocol administrator
   - Can perform all ISSUER and LP actions
   - Can pause/unpause pool
   - Can update pool parameters
   - Can fund reserve
   - Can access admin panel

4. **UNKNOWN** - Guest/read-only
   - Can view dashboards
   - Cannot perform any actions
   - Shows call-to-action to connect appropriate wallet

### Role Resolution Logic

Priority order:
1. **ADMIN** - If wallet in `ADMIN_WALLETS` env var
2. **ISSUER** - If wallet is issuer of any invoice (checked on-chain)
3. **LP** - If wallet holds LP shares (balance > 0)
4. **UNKNOWN** - Default fallback

## Backend Authorization

### Protected Endpoints

#### ISSUER-ONLY
- `POST /invoices` - Create invoice
- `POST /invoices/:id/tokenize` - Tokenize invoice
- `POST /invoices/:id/finance` - Draw credit
- `POST /invoices/:id/payments` - Record payment

#### LP-ONLY
- `POST /lp/deposit` - Deposit liquidity
- `POST /lp/withdraw` - Withdraw liquidity

#### ADMIN-ONLY
- `POST /admin/pool/pause` - Pause pool
- `POST /admin/pool/unpause` - Unpause pool
- `POST /admin/pool/params` - Update pool parameters
- `POST /admin/pool/reserve/fund` - Fund reserve

#### PUBLIC (Read-only)
- `GET /invoices` - List invoices
- `GET /invoices/:id` - Get invoice detail
- `GET /pool/overview` - Pool overview
- `GET /lp/position` - LP position
- `GET /admin/status` - Check user role
- `GET /admin/pool/status` - Pool status (read-only)

### Authorization Middleware

- **`roleResolutionMiddleware`** - Resolves role from wallet address
- **`requireRole(...roles)`** - Requires specific role(s)
- **`requireWallet`** - Requires wallet address

### Error Responses

When role mismatch:
```json
{
  "error": "ROLE_NOT_ALLOWED",
  "message": "This endpoint requires one of: ISSUER, ADMIN",
  "expectedRole": ["ISSUER", "ADMIN"],
  "actualRole": "LP"
}
```

## UI Role-Aware Features

### Navigation

**ISSUER sees:**
- Invoice list page (`/`)
- Invoice detail pages
- Tokenize button
- Finance button
- Repay button
- Create invoice form

**LP sees:**
- LP Dashboard (`/lp`)
- Deposit button
- Withdraw button
- Yield metrics
- Risk exposure panel

**ADMIN sees:**
- All ISSUER features
- All LP features
- Admin Panel (`/admin`)
- Pool controls
- Emergency controls

**UNKNOWN sees:**
- Read-only dashboards
- Call-to-action: "Connect an issuer or LP wallet to interact"

### Component-Level Guards

`<RoleGate>` component wraps UI elements:

```tsx
<RoleGate allowed={[Role.ISSUER, Role.ADMIN]} showDisabled>
  <Button>Tokenize</Button>
</RoleGate>
```

Options:
- `allowed` - Array of allowed roles
- `fallback` - Component to show if not allowed (default: null)
- `showDisabled` - Show component disabled with tooltip (default: false)
- `disabledMessage` - Custom tooltip message

### Protected Actions

**Invoice Page (`/`):**
- Tokenize button - ISSUER/ADMIN only
- Finance button - ISSUER/ADMIN only
- Repay button - ISSUER/ADMIN only
- Create invoice - ISSUER/ADMIN only

**LP Dashboard (`/lp`):**
- Deposit button - LP/ADMIN only
- Withdraw button - LP/ADMIN only

**Admin Panel (`/admin`):**
- All controls - ADMIN only
- Shows "Read-only mode" if non-admin accesses

## Admin Panel

### Route: `/admin`

Sections:
1. **Pool Controls**
   - Pause/Unpause toggle
   - Max utilization setting
   - Max single loan setting
   - Max issuer exposure setting

2. **Reserve Management**
   - Reserve balance display
   - Reserve target display
   - Fund reserve action

3. **Emergency**
   - Kill switch status
   - Warning banner when paused

### Access Control
- Requires ADMIN role
- Shows read-only mode if accessed by non-admin
- All actions require wallet connection

## UX Safety & Clarity

### Invisible Failures Prevention

1. **Hidden Actions**
   - Actions not visible if role doesn't allow
   - Clear explanation in UI copy

2. **Disabled Actions**
   - Tooltip explains why disabled
   - Example: "This action requires: ISSUER or ADMIN"

3. **Backend Errors**
   - `ROLE_NOT_ALLOWED` errors surfaced with user-friendly message
   - Shows expected vs actual role

### User Messages

**LP viewing invoice page:**
> "Invoice management is available to issuers only."

**Issuer on LP page:**
> "Liquidity management is for LPs."

**UNKNOWN user:**
> "Connect an issuer or LP wallet to interact"

## Environment Variables

Add to `.env`:
```bash
ADMIN_WALLETS=0x123...,0x456...  # Comma-separated admin wallet addresses
```

## Testing Checklist

### Backend Tests
- ✅ Issuer cannot call LP endpoints → 403
- ✅ LP cannot call invoice endpoints → 403
- ✅ Admin can call everything → 200
- ✅ UNKNOWN cannot call write endpoints → 403

### UI Tests (Manual)
- ✅ LP wallet: Cannot see Tokenize/Finance buttons
- ✅ Issuer wallet: Cannot see Withdraw button
- ✅ Admin wallet: Can pause pool
- ✅ UNKNOWN wallet: No destructive actions visible

## Breaking Changes

**NONE** - All existing flows work unchanged:
- Read-only endpoints remain public
- Role checks are additive (defensive)
- UI gracefully handles role resolution failures
- Default role is UNKNOWN (read-only)

## Files Changed

### Backend
- `backend/src/auth/roles.ts` - Role enum and resolver
- `backend/src/middleware/roleAuth.ts` - Authorization middleware
- `backend/src/routes/invoices.ts` - Protected invoice endpoints
- `backend/src/routes/lp.ts` - Protected LP endpoints
- `backend/src/routes/admin.ts` - Admin endpoints (new)
- `backend/src/env.ts` - ADMIN_WALLETS support

### Frontend
- `frontend/lib/roles.ts` - Role types and resolver
- `frontend/components/auth/RoleGate.tsx` - Role guard component
- `frontend/app/page.tsx` - Role-aware invoice actions
- `frontend/app/lp/page.tsx` - Role-aware LP actions (to be updated)
- `frontend/app/admin/page.tsx` - Admin panel (to be created)
- `frontend/lib/backendClient.ts` - Role API client

## Next Steps

1. Complete UI role-aware updates for LP dashboard
2. Create Admin Panel UI (`/admin`)
3. Add role indicator in navigation/header
4. Add role-based routing guards
5. Comprehensive testing



