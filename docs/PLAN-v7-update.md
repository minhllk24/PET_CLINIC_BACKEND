# PLAN: Backend Version 7 Update

## Goal Description
Update the existing Foundation V6 backend to comply with the new V7 Business Decisions and schema requirements outlined in `Task-2.8-v7-confirmed`. This involves critical updates to the booking payment flow, cancellation penalty rules, medical service execution reviews, and inventory management.

## Proposed Changes

---
### 1. Catalog & Service Schema Updates
**Goal**: Remove deprecated deposit config and clean up schemas.
- **MODIFY** `src/modules/catalog/models/Service.js`
  - Remove `depositConfig` field completely.
- **MODIFY** `src/modules/booking/models/Appointment.js`
  - Add `depositAmount` and `balanceAmount` inside `pricing`.
  - Add `holdExpiresAt` (Date).
  - Add `reviewerStaffId` (ObjectId, ref StaffProfile).
- **MODIFY** `src/modules/inventory/models/InventoryStock.js`
  - Add `threshold` (Number, default 0).
  - Add `version` (Number, default 1) for optimistic concurrency on threshold updates.

---
### 2. Booking Payment Flow (ADR-09, ADR-43)
**Goal**: Implement the strict 30% deposit rule for `PAY_AT_STORE` and 100% for `ONLINE_MOCK`.
- **MODIFY** `src/modules/booking/booking.service.js` (in `createAppointment`)
  - Remove logic reading `depositConfig` from `Service`.
  - If `ONLINE_MOCK`: `paymentAmount = finalAmount` (100%), `depositAmount = 0`, `balanceAmount = 0`. Payment created as `PAID`. Appointment -> `PENDING_CONFIRMATION`.
  - If `PAY_AT_STORE`: `depositAmount = Math.round(finalAmount * 0.30)`. Payment created for `depositAmount` as `PENDING`. Appointment -> `PENDING_PAYMENT`. Return `prepaymentId = payment._id`.
  - Set `holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000)` (10 mins) for both PENDING states.

- **NEW/MODIFY** `src/modules/payment/payment.controller.js` & `payment.service.js`
  - Add `mockCompletePayment(prepaymentId)` endpoint. 
  - Finds Payment, sets `PAID`. Updates associated Appointment `paidAmount += payment.amount` and moves status from `PENDING_PAYMENT` to `PENDING_CONFIRMATION`.

---
### 3. Booking Cancellation & Refund (TA-30)
**Goal**: Implement strict refund/penalty rules based on cancellation time.
- **MODIFY** `src/modules/booking/booking.service.js` (in `cancelAppointment`)
  - Calculate `hoursBeforeStart = (scheduledStart - now) / 3600000`.
  - If canceled by Store/System (e.g. `req.actor.systemRole == 'STAFF'`): `penalty = 0`.
  - If canceled by Customer/Guest AND (`hoursBeforeStart < 24` or reason == `NO_SHOW`): `penalty = Math.round(finalAmount * 0.30)`.
  - Else: `penalty = 0`.
  - `refundAmount = Math.max(0, paidAmount - penalty)`.
  - Update Payment status to `REFUND_PENDING` (or create `BookingRefund` if needed).

---
### 4. Medical Execution Workflow (ADR-13)
**Goal**: Enforce `WAITING_VET_REVIEW` and Vet-only finalize.
- **MODIFY** `src/modules/execution/execution.service.js`
  - In `submitReview`: Nurse sets status to `WAITING_VET_REVIEW`. (Already implemented mostly, just verify logic).
  - In `finalizeRecord`: 
    - Check that the record is in `WAITING_VET_REVIEW`.
    - Check that `req.actor.staffSubRole === 'VETERINARIAN'`.
    - Validate `req.actor.id === appointment.reviewerStaffId`. (If `reviewerStaffId` is missing, reject or allow any Vet? We will strictly check it).

---
### 5. Inventory Threshold & Transfer (ADR-11)
**Goal**: Manage inventory thresholds without directly inputting stock on products.
- **MODIFY** `src/modules/inventory/inventory.service.js`
  - Add `updateThreshold(branchId, inventoryItemId, threshold, expectedVersion)`:
    - Finds `InventoryStock`, checks `version == expectedVersion`.
    - Updates `threshold`, `version++`.
  - In `createTransfer`: Validate that `req.actor` has access to BOTH `sourceBranchId` and `destinationBranchId` if they are a Manager.

## Verification Plan
### Automated Tests
- Run `npm run test` or `npx jest tests/contract.test.js` to ensure the old constraints still pass.

### Manual Verification
1. Create a `PAY_AT_STORE` appointment and verify `prepaymentId` is returned and `depositAmount` is exactly 30% of `finalAmount`.
2. Cancel an appointment `< 24h` and verify `refundAmount` is correct.
3. Call `finalizeRecord` as a `NURSE` and verify it gets rejected with `403 Forbidden`.
