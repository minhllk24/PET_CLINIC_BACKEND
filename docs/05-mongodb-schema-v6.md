# 05 MongoDB Schema v6

Quy uoc: `_id` ObjectId; UTC; tien integer VND; `version` cho collection co canh tranh; khong hard delete du lieu giao dich. Thiet ke theo workload (06), khong convert 1:1 tu SQL.
Khac v3 (scope lock): `serviceType` la ten chinh thuc tren Service/Appointment, `recordType` chi la snapshot trong service_records; cart khong mang branch; deposit khoa PERCENTAGE 30 cho moi branch; payment target APPOINTMENT|ORDER; return state RECEIVED truoc APPROVED.

## Identity va Customer
users `{systemRole, fullName, email?, phone?, passwordHash, accountStatus, blockedReason?, blockedAt?, blockedBy?, failedLoginCount, lockedUntil?, lastLogin?, assignedBranchIds[], version}` (unique partial email, phone). Mat khau validate o app: 8+ ky tu, co chu hoa va so.
customers `{userId?, activationStatus, contactPhone?, contactEmail?, phoneVerifiedAt?, emailVerifiedAt?, activityBranchIds[] (derived, multikey index), createdAt}`. **Khong co branchId.** `activityBranchIds` do server `$addToSet` khi tao Order/Appointment.
guest_contacts, otp_challenges, refresh_sessions: nhu v2.

## Catalog thuong mai (M05)
categories `{name, slug (unique), parentId?, status: ACTIVE|INACTIVE}`.
products `{name, description, categoryId, origin?, expiryInfo?, images[], variants[{id, sku (unique toan collection), label, price, status, inventoryItemId}], status: ACTIVE|INACTIVE|ARCHIVED, createdAt}`. Embed variants (so luong nho, luon doc cung product).
Text index (name, description) cho `q`; index (status, categoryId, createdAt) va (status, variants.price).

## Cart va Order (M07, M08)
carts `{customerId? (unique partial), tokenHash? (unique partial), items[{itemId, productId, variantId, quantity}], updatedAt, expiresAt (TTL cho cart Guest)}`. Khong co branch scope generic. Khong luu gia: gia lay luc quote/checkout.
orders
```
{_id, code (unique), customerId?, guestContactId?, contactSnapshot, shippingAddress,
 fulfillmentBranchId (server gan luc checkout bang FulfillmentBranchResolver: branch ACTIVE dau tien trong system_settings.fulfillmentBranchPriority du ton cho toan bo cart; Customer khong chon), status, paymentMethod, payment{paymentId, status},
 items[{orderItemId, productId, variantId, nameSnapshot, unitPrice, quantity, lineSubtotal, allocatedDiscount, lineNet,
        returnReservedQty, returnedQty, refundedNet}],
 pricing{merchandiseSubtotal, voucherDiscount, shippingFee, totalAmount},
 voucher{voucherId, code}?, deliveredAt?, statusHistory[{status, at, actorId?, note?}], version, createdAt}
```
Embed items va statusHistory (bounded). `totalAmount = merchandiseSubtotal - voucherDiscount + shippingFee`. Khong update gia sau khi tao.
vouchers `{code (unique), name, discountType, discountValue, scope, scopeRefs?, effectiveFrom, effectiveTo, quota, usedCount, status, version}`. voucher_usages `{voucherId, targetType: ORDER|APPOINTMENT, targetId, consumedAt, restoredAt?}` unique (voucherId, targetType, targetId). Consume: `findOneAndUpdate({usedCount:{$lt:quota}}, {$inc:{usedCount:1}})` trong tx.
system_settings `{key:"commerce", value:{freeShippingThreshold:500000, shippingFlatFee, fulfillmentBranchPriority:[branchId,...]}, updatedBy}`. `fulfillmentBranchPriority` do Admin cau hinh, thu tu = do uu tien; khong luu o Cart hay Customer; khong expose tren API public.

## Tra hang / hoan tien (M09)
order_returns
```
{code, orderId, customerRef, status, reason, evidenceUrls[],
 items[{orderItemId, productName, orderedQty, alreadyReturnedQty, requestedQty, refundAmount}],
 refundBreakdown{merchandiseNet, shippingRefunded:0, total}, refundId?, history[], version}
```
`alreadyReturnedQty` va `refundAmount` do server tinh luc tao. Conditional update `orders.items[].returnReservedQty + q <= quantity` trong tx chong 2 return dong thoi vuot. Reject/Cancel tra lai reserved.
order_refunds (tao khi OrderReturn APPROVED hoac khi huy don da PAID) `{cause: RETURN|CANCELLATION, orderReturnId?, orderId, amount, provider: MOCK, status: PENDING|REFUNDED|FAILED, refundedAt?, idempotencyKey}`; unique partial `orderReturnId`.

## Service Catalog va BranchService
services `{code, name, description, serviceType, category, basePrice, priceVariants[], durationMinutes, requiredStaffRole, bookingMode, depositConfig{depositRequired, depositType, depositValue}, defaultMaterials[], contactInfo?, status, version}`. Bat coc => `depositType = PERCENTAGE`, `depositValue = 30` (khoa cung boi validator, khong override, dong nhat moi branch); tat coc => `NONE`. Chi Admin ghi. Khong chua field theo branch.
branch_service_configs `{branchId, serviceId, enabled, capacity>=1, availability[], updatedBy, version}` unique (branchId, serviceId). Reference (tich branch x service, Manager ghi rieng le).

## Booking, Staff, Shift, Payment, Refund
branches, staff_profiles, shifts, appointment_requests: nhu v2. appointment_requests co the chua `staffAssignments` tuy chon khi duyet.
slot_reservations `{appointmentId, branchId, kind: STAFF|CAPACITY, staffId? (STAFF), serviceId? (CAPACITY), segmentServiceId, slotStart, unitIndex?, status: HELD|CONFIRMED|RELEASED, expiresAt?}`. Moi segment cua Appointment tao 1 reservation STAFF theo tung don vi slot (unique partial `(staffId, slotStart)` voi HELD/CONFIRMED) va reservation CAPACITY (unique partial `(branchId, serviceId, slotStart, unitIndex)`). Tao het trong 1 tx; trung key => thu staff ung vien khac cua segment, het ung vien => rollback va `409 SLOT_UNAVAILABLE`. Doi staff giai phong reservation STAFF cu va tao moi trong 1 tx.
appointments `{code, customerId?, guestContactId?, petId?, petSnapshot, customerSnapshot, branchId, serviceType, paymentMethod: ONLINE_MOCK|PAY_AT_STORE, services[{serviceId, serviceName, serviceType, variantLabel?, unitPrice, durationMinutes, requiredStaffRole, bookingMode, depositConfig, sequence, scheduledStart, scheduledEnd, assignedStaffId}], scheduledStart, scheduledEnd, scheduledDurationMinutes, pricing{subtotal, voucherId?, voucherDiscount, finalAmount, depositAmount (30% chi PAY_AT_STORE co service bat coc; ONLINE_MOCK = 0), balanceAmount, paidAmount}, deposit{status, paymentId?}, status, supportStaffIds[], rescheduleCount, cancel{by, at, actorId, reason, hoursBeforeStart, prepaidOutcome}?, holdExpiresAt?, source, version, createdAt, updatedAt}`. Embed `services[]` la cac **segment doc lap ve Staff**: moi segment co requiredStaffRole, duration, khoang thoi gian va `assignedStaffId` rieng (khong co assignedStaffId o cap Appointment). `paidAmount` cap nhat ngay khi payment PAID, khong cho balance. Pet auto-save: `petId` tro toi pet moi khi Customer nhap pet khac.
payments `{code, target{type: APPOINTMENT|ORDER, id}, kind: DEPOSIT|BALANCE|FULL|ORDER (APPOINTMENT: ONLINE_MOCK => FULL 100%; PAY_AT_STORE => DEPOSIT 30% roi BALANCE; ORDER: kind ORDER), method: ONLINE_MOCK|PAY_AT_STORE|COD (target APPOINTMENT dung ONLINE_MOCK|PAY_AT_STORE; target ORDER dung ONLINE_MOCK|COD), expiresAt? (timeout ONLINE_MOCK), amount, refundedAmount, provider: MOCK, providerRef, status: PENDING|PAID|FAILED|CANCELLED|EXPIRED|REFUND_PENDING|REFUNDED, paidAt?, idempotencyKey, version}`.
booking_refunds: nhu v2.

## Service execution va Inventory
service_records `{appointmentId (unique), petId, serviceIds[], branchId, assignedStaffIds[] (derived tu cac segment), recordType (snapshot cua services.serviceType), status, recordVersion, actualStartAt, actualEndAt?, professional?, plannedMaterials[], actualMaterials[], lastFinalizedActual[], version}`; service_record_revisions append-only unique (serviceRecordId, recordVersion).
inventory_items `{sku, name, kind: PRODUCT|MATERIAL, unit, lowStockThreshold, status}`. inventory_stocks `{branchId, inventoryItemId, quantity>=0, version}` unique (branchId, inventoryItemId): projection. Mot vi tri ton kho moi (branch, item).
inventory_transactions (append-only) `{branchId, inventoryItemId, transactionType, beforeQty, changeQty, afterQty, actorId, reason, createdAt, sourceType: MANUAL|SERVICE_RECORD_REVISION|ORDER|TRANSFER, sourceId?, recordVersion?, transferId?, transferLeg?, idempotencyKey}`. Unique partial: (SERVICE_RECORD_REVISION, sourceId, recordVersion, item) va (ORDER, sourceId, item, transactionType).
Source of truth cua ton: ledger. Hoan hang tra khong tao giao dich tu dong.

## Con lai
reviews, notifications `{userId, type, title, body, read, refType, refId, createdAt}`, outbox, audit_logs, idempotency_keys: nhu v2.

## Source of truth
| Concept | Master | Derived | Snapshot |
|---|---|---|---|
| Customer | users+customers | activityBranchIds | order/appointment contactSnapshot |
| Product | products | outOfStock | orders.items nameSnapshot, unitPrice |
| Service | services | -- | appointments.services[] |
| BranchService | branch_service_configs | availability | -- |
| Order | orders | -- | lineNet, allocatedDiscount |
| Inventory | inventory_transactions | inventory_stocks | -- |
| Payment/Refund | payments, order_refunds, booking_refunds | order/appointment status | -- |
