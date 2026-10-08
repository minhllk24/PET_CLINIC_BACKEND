# 05 MongoDB Schema v7

Quy uoc: `_id` ObjectId; UTC; tien integer VND; `version` cho collection co canh tranh; khong hard delete du lieu giao dich. Thiet ke theo workload (06), khong convert 1:1 tu SQL.
Khac v3 (scope lock): `serviceType` la ten chinh thuc tren Service/Appointment, `recordType` chi la snapshot trong service_records; cart khong mang branch; deposit khoa PERCENTAGE 30 cho moi branch; payment target APPOINTMENT|ORDER; return state RECEIVED truoc APPROVED.

## Identity va Customer
users `{systemRole, fullName, email?, phone?, passwordHash, accountStatus, blockedReason?, blockedAt?, blockedBy?, failedLoginCount, lockedUntil?, lastLogin?, assignedBranchIds[], version}` (unique partial email, phone). Mat khau validate o app: 8+ ky tu, co chu hoa va so.
customers `{userId?, activationStatus, contactPhone?, contactEmail?, phoneVerifiedAt?, emailVerifiedAt?, activityBranchIds[] (derived, multikey index), createdAt}`. **Khong co branchId.** `activityBranchIds` do server `$addToSet` khi tao Order/Appointment. `accountStatus` không nằm trong `customers`; API CustomerDetail trả `accountStatus=null` khi chưa có User.

## Catalog thuong mai (M05)
categories `{name, slug (unique), parentId?, status: ACTIVE|INACTIVE}`.
products `{name, description, categoryId, origin?, expiryInfo?, images[], variants[{id, sku (unique toan collection), label, price, status, inventoryItemId}], status: ACTIVE|INACTIVE|ARCHIVED, createdAt}`. Embed variants (so luong nho, luon doc cung product).
Text index (name, description) cho `q`; index (status, categoryId, createdAt) va (status, variants.price).

## Cart va Order (M07, M08)
carts `{customerId? (unique partial), tokenHash? (unique partial), items[{itemId, productId, variantId, quantity}], updatedAt, expiresAt (TTL cho cart Guest)}`. Khong co branch scope generic. Khong luu gia: gia lay luc quote/checkout.
orders
```
{_id, code (unique), customerId?, guestContactId?, contactSnapshot, shippingAddress,
 fulfillmentBranchId (server gan luc checkout bang FulfillmentBranchResolver: branch ACTIVE dau tien trong system_settings.commerce.fulfillmentBranchPriority du ton cho toan bo cart; Customer khong chon), status, paymentMethod, payment{paymentId, status},
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
services `{code, name, description, serviceType, category, basePrice, priceVariants[], durationMinutes, requiredStaffRole, bookingMode, defaultMaterials[], contactInfo?, status, version}`. Service là global; `contactInfo` không có `branchId`; thông tin chi nhánh lấy từ `branches`. Chi Admin ghi. Khong chua field theo branch.
branch_service_configs `{branchId, serviceId, enabled, capacity>=1, availability[], updatedBy, version}` unique (branchId, serviceId). Reference (tich branch x service, Manager ghi rieng le).

## Booking, Staff, Shift, Payment, Refund
slot_reservations `{appointmentId, branchId, kind: STAFF|CAPACITY, staffId? (STAFF), serviceId? (CAPACITY), segmentServiceId, slotStartUnit, unitIndex?, status: HELD|CONFIRMED|RELEASED, expiresAt?}`. Moi segment cua Appointment tao 1 reservation STAFF theo tung don vi slot (unique partial `(staffId, slotStartUnit)` voi HELD/CONFIRMED) va reservation CAPACITY (unique partial `(branchId, serviceId, slotStartUnit, unitIndex)`). Tao het trong 1 tx; trung key => thu staff ung vien khac cua segment, het ung vien => rollback va `409 SLOT_UNAVAILABLE`. Doi staff giai phong reservation STAFF cu va tao moi trong 1 tx.
appointments `{code, customerId?, guestContactId?, petId?, petSnapshot, customerSnapshot, branchId, serviceType, paymentMethod: ONLINE_MOCK|PAY_AT_STORE (customer option), prepaymentId, reviewerStaffId?, services[{serviceId, serviceName, serviceType, variantLabel?, unitPrice, durationMinutes, requiredStaffRole, bookingMode, sequence, scheduledStart, scheduledEnd, assignedStaffId, executionStatus, executionStartedAt?, executionCompletedAt?}] (executionStatus is required), scheduledStart, scheduledEnd, scheduledDurationMinutes, pricing{subtotal, voucherId?, voucherDiscount, finalAmount, depositAmount (30% chi PAY_AT_STORE; ONLINE_MOCK = 0), balanceAmount, paidAmount}, deposit{status, paymentId?}, status, rescheduleCount, cancel{by, at, actorId, reason, hoursBeforeStart, prepaidOutcome}?, holdExpiresAt?, source, version, createdAt, updatedAt}`. Embed `services[]` la cac **segment doc lap ve Staff**: moi segment co requiredStaffRole, duration, khoang thoi gian va `assignedStaffId` rieng (khong co assignedStaffId o cap Appointment). `paidAmount` cap nhat ngay khi payment PAID, khong cho balance. `PENDING_PAYMENT` va `PENDING_CONFIRMATION` deu phai co `holdExpiresAt`; het han thi auto-cancel Appointment va Payment PENDING, release reservation. Với reservation HELD, `slot_reservations.expiresAt` = `appointments.holdExpiresAt`; không tạo hai loại timeout độc lập. `booking.holdDurationMinutes` technical config default 10. Pet auto-save: `petId` tro toi pet moi khi Customer nhap pet khac.
payments `{code, target{type: APPOINTMENT|ORDER, id}, kind: DEPOSIT|BALANCE|FULL|ORDER (APPOINTMENT: ONLINE_MOCK => FULL 100%; PAY_AT_STORE => DEPOSIT 30% roi BALANCE; ORDER: kind ORDER), method: ONLINE_MOCK|PAY_AT_STORE|COD (target APPOINTMENT dung ONLINE_MOCK|PAY_AT_STORE; target ORDER dung ONLINE_MOCK|COD), expiresAt? (deadline cho PENDING payment khi ap dung; Appointment hold va Order ONLINE_MOCK), amount, refundedAmount, provider: MOCK, providerRef, status: PENDING|PAID|FAILED|CANCELLED|EXPIRED|REFUND_PENDING|REFUNDED, paidAt?, idempotencyKey, version}`.
booking_refunds `{paymentId, appointmentId, amount, rule, status, history[], version, createdAt, updatedAt}`; unique active/terminal refund per payment except REJECTED, which may be re-requested.

## Service execution va Inventory
service_records `{reviewerStaffId?, appointmentId (unique), petId, serviceIds[], branchId, assignedStaffIds[] (derived tu cac segment), recordType (snapshot cua services.serviceType), status, recordVersion, actualStartAt, actualEndAt?, professional?, plannedMaterials[], actualMaterials[], lastFinalizedActual[], version}`. Đây là **encounter-level aggregate theo Appointment** trong Web 2; `actualMaterials[]` là tổng vật liệu của ca, không tách ServiceRecord theo từng segment. service_record_revisions append-only unique (serviceRecordId, recordVersion).
inventory_items `{sku, name, kind: PRODUCT|MATERIAL, unit, status}`. Material Catalog loại MATERIAL là **seed-only**, không có CRUD Material riêng; Admin chỉ tham chiếu material seed qua `services.defaultMaterials`. inventory_stocks `{branchId, inventoryItemId, quantity>=0, lowStockThreshold>=0 (default 0), version}` unique (branchId, inventoryItemId): projection. Mot vi tri ton kho moi (branch, item).
inventory_transactions (append-only) `{branchId, inventoryItemId, transactionType, beforeQty, changeQty, afterQty, actorId, reason, createdAt, sourceType: MANUAL|SERVICE_RECORD_REVISION|ORDER|TRANSFER, sourceId?, recordVersion?, transferId?, transferLeg?, idempotencyKey}`. Unique partial: (SERVICE_RECORD_REVISION, sourceId, recordVersion, item) va (ORDER, sourceId, item, transactionType).
Source of truth cua ton: ledger. Hoan hang tra khong tao giao dich tu dong.

## Con lai

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

## V7 correction contract

PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.

TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.

Product global chỉ Admin CRUD, không nhập stock trong Product form. Stock mặc định 0 (row có thể lazy-created); initial stock qua RECEIPT reason INITIAL_STOCK. Procurement/PO/supplier approval ngoài scope. Quantity chỉ đổi qua ledger transaction; threshold nằm ở inventory_stocks theo (branchId, inventoryItemId), default 0; Manager assigned branches/Admin ALL cập nhật threshold, không tạo movement stock. Transfer Manager cần cả hai branch trong scope.

## Self-contained supplementary collections (V7 canonical design)

These are explicit V7 definitions, not recovered claims about a missing v2 or an implemented DB. API response aliases use `id`; stored references use ObjectId. Fields below are required unless marked `?`; common `_id`, `createdAt`, `updatedAt` are required unless append-only. UTC timestamps. Optional absent values normalize to null only where OpenAPI allows null. Secrets/hashes are never returned. Validate foreign references and ownership in application transactions; MongoDB has no foreign-key enforcement.

| Collection | Required and optional fields | Relationships / constraints / indexes |
|---|---|---|
| guest_contacts | name, normalizedPhone, email?, normalizedEmail?, phoneVerifiedAt?, emailVerifiedAt?, customerId?, activationTokenHash?, activationExpiresAt?, activationUsedAt?, version | Contact snapshot used by Order/Appointment/Request. Unique partial normalizedPhone; normalizedEmail indexed, not assumed unique across unrelated phone identities. Activation links one Customer/User transactionally; raw token never persisted. |
| otp_challenges | identifierHash, identifierType PHONE/EMAIL, purpose LOGIN/RESET/GUEST_LOOKUP/ACTIVATION, otpHash, attempts, maxAttempts, expiresAt, consumedAt?, guestContactId?, userId? | TTL expiresAt; (identifierHash,purpose,createdAt). Atomic consume once; expiry checked in app, rate limit per identifier/IP, attempts < maxAttempts. No plain OTP. |
| guest_lookup_sessions | tokenHash, guestContactId, verifiedIdentifierHash, expiresAt, revokedAt? | Unique tokenHash; TTL expiresAt. Only issued after OTP; verified contact scope resolves owned transactions. Separate from guest cart token. |
| refresh_sessions | userId, tokenHash, familyId, expiresAt, revokedAt?, replacedBySessionId?, lastUsedAt? | Unique tokenHash; TTL expiresAt; (userId,revokedAt). Rotation invalidates old token; reuse revokes family. Blocked User cannot refresh. |
| branches | code, name, address, phone?, status ACTIVE/INACTIVE, openingHours[{dayOfWeek,open,close}], holidays[{date,note?}], version | Unique code. Validate weekday 0..6, open < close, local branch time conversion -> UTC reservations. Referenced by staff, shifts, stocks, bookings. No slotCapacity; BranchService capacity owns that concept. |
| staff_profiles | userId, staffSubRole RECEPTIONIST/CARE_STAFF_GROOMER/VETERINARIAN/NURSE, authorizedBranchIds[], homeBranchId?, status ACTIVE/INACTIVE, version | Unique userId; index (authorizedBranchIds,staffSubRole,status). userId -> User STAFF; home branch must be authorized. fullName is joined from User, not duplicate mutable master. |
| shifts | staffId, branchId, startAt, endAt, status ACTIVE/CANCELLED, version | staffId -> StaffProfile; branch authorized; start < end; no ACTIVE overlapping shift for same staff, enforced under per-staff transaction/concurrency guard; indexes (staffId,status,startAt,endAt), (branchId,status,startAt). Cancellation cannot invalidate existing confirmed reservations silently. |
| appointment_requests | serviceIds[], preferredBranchId, preferredWindow?, customerId?, guestContactId?, contactSnapshot?, petId?, petSnapshot?, note?, status SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED/CANCELLED, appointmentId?, reviewedBy?, reviewedAt?, rejectionReason?, version | Exactly one customerId/guestContactId. One petId or petSnapshot; all services same type and REQUEST_ONLY. No payment/reservation before approval. Atomic APPROVED with linked Appointment once; indexes (preferredBranchId,status,createdAt), (customerId,createdAt), (guestContactId,createdAt), unique partial appointmentId. |
| pets | customerId, name, species, breed?, gender?, birthDate?, weightKg?, imageUrl?, status ACTIVE/INACTIVE, version | customerId -> Customer; (customerId,status). Ownership checked for bookings. Guest uses petSnapshot, not another customer's petId. |
| reviews | customerId, targetType PRODUCT/SERVICE, targetId, rating, comment?, anonymous, hidden, hiddenBy?, hiddenAt?, hideReason?, verifiedSourceId? | rating integer 1..5. targetId valid catalog reference; eligibility per 07. Public anonymous hides identity only; internal owner retained. indexes (targetType,targetId,hidden,createdAt), (customerId,createdAt). |
| notifications | userId, type APPOINTMENT_REMINDER/APPOINTMENT_UPDATE/ORDER_UPDATE/REFUND_UPDATE/SYSTEM, title, body?, read, refType?, refId?, readAt? | userId -> User; (userId,read,createdAt). Only recipient can read/mark read. Reference does not bypass resource authorization. |
| outbox | eventId, eventType, aggregateType, aggregateId, payload, status PENDING/PROCESSING/SENT/FAILED, attempts, nextAttemptAt, lockedUntil?, deliveredAt?, lastError? | Unique eventId; (status,nextAttemptAt). Insert with domain transaction; worker leases and retries; consumer dedup eventId. Payload must minimize PII and contain no auth secrets. |
| audit_logs | actorId?, actorType USER/SYSTEM, action, resourceType, resourceId?, branchIds[], before?, after?, reason?, requestId?, occurredAt | Append-only; (resourceType,resourceId,occurredAt), (actorId,occurredAt). Redact passwords/tokens/OTP; system actor cannot be client supplied. |
| idempotency_keys | actorScope, operationId, key, requestHash, status PROCESSING/COMPLETED, responseStatus?, responseBody?, resourceId?, expiresAt | Unique (actorScope,operationId,key); TTL expiresAt. Hash canonical body; mismatch => 409 IDEMPOTENCY_KEY_REUSED. Persist response only after commit. Guest actorScope is verified contact/cart identity as appropriate, never global anonymous scope. |
| service_record_revisions | serviceRecordId, recordVersion, previousActual[], newActual[], delta[], professionalSnapshot?, actorId, reason?, finalizedAt | Append-only unique (serviceRecordId,recordVersion). Inventory source points to revision; lastFinalizedActual derived from last committed revision. |

Technical expiry values (OTP/session/idempotency) are configurable deployment settings; validate them explicitly during implementation. The accepted Appointment hold remains 10 minutes default. No TTL deletion of active financial/slot records: worker performs compensation first, TTL only cleans disposable security/session records.

### Branch inventory configuration and migration

`inventory_stocks.lowStockThreshold` required, default 0; server materializes absent stock as quantity=0, threshold=0, version=0. PUT `/inventory/stocks/{branchId}/{inventoryItemId}/threshold` updates config via expectedVersion and audit without a stock ledger movement. Existing global threshold values are copied once to each existing branch/item stock as migration initial values, then removed from inventory_items. Missing rows use 0; no inferred inventory or purchase receipt. New Product creates inventory item but no quantity. Stock seed/import must call Receipt (INITIAL_STOCK) with actor/reason/time.
