# 06 MongoDB Index + Workload v7

Tan suat la uoc luong, chua co so lieu production. Moi index phuc vu mot query trong bang.

| # | Query | Freq | Filter | Sort | Pagination | Consistency | Index | Collection |
|---|---|---|---|---|---|---|---|---|
| Q1 | Login | cao | email/phone | -- | -- | strong | users email, phone (unique partial) | users |
| Q2 | Product list/search | rat cao | status=ACTIVE, categoryId, q, price range | NEWEST, PRICE, NAME | cursor | eventual | text(name, description); (status, categoryId, createdAt -1); (status, variants.price) | products |
| Q3 | Product detail | cao | _id | -- | -- | strong | _id | products |
| Q4 | outOfStock (tong ton cac branch) | cao | inventoryItemId in variants | -- | -- | eventual | inventory_stocks (inventoryItemId) | inventory_stocks |
| Q4b | Resolver: ton cua cac item cart tai tung branch uu tien | moi checkout | branchId in priority (ACTIVE), inventoryItemId in cart | -- | -- | strong | inventory_stocks unique (branchId, inventoryItemId) | inventory_stocks |
| Q4c | Doc fulfillmentBranchPriority | moi checkout | key=commerce | -- | -- | strong | system_settings key unique | system_settings |
| Q5 | Category list | cao | status, parentId | name | cursor | eventual | categories (status, parentId); slug unique | categories |
| Q6 | Cart by customer | cao | customerId | -- | -- | strong | carts customerId unique partial | carts |
| Q7 | Cart by guest token | cao | tokenHash | -- | -- | strong | carts tokenHash unique partial; TTL expiresAt | carts |
| Q8 | Voucher by code | cao | code | -- | -- | strong | vouchers code unique | vouchers |
| Q9 | Voucher quota consume | cao | _id, usedCount<quota | -- | -- | strong | _id (conditional update) | vouchers |
| Q10 | Order by customer | cao | customerId | createdAt -1 | cursor | strong | orders (customerId, createdAt -1) | orders |
| Q11 | Orders by branch/status | cao | fulfillmentBranchId, status | createdAt -1 | cursor | strong | orders (fulfillmentBranchId, status, createdAt -1) | orders |
| Q12 | Order by code | trung | code | -- | -- | strong | orders code unique | orders |
| Q13 | Guest orders by contact | trung | guestContactId | createdAt -1 | -- | strong | orders (guestContactId, createdAt -1) | orders |
| Q14 | Customers for Manager | trung | activityBranchIds in assignedBranchIds, search | createdAt -1 | cursor | strong | customers (activityBranchIds) multikey | customers |
| Q15 | Customer detail | trung | _id | -- | -- | strong | customers.userId unique partial | customers |
| Q16 | Returns by order / queue | trung | orderId; status | createdAt | cursor | strong | order_returns (orderId, status); (status, createdAt) | order_returns |
| Q17 | Refund by return | trung | orderReturnId | -- | -- | strong | order_refunds orderReturnId unique partial | order_refunds |
| Q18 | Staff shifts | cao | staffId, range | startAt | -- | strong | shifts (staffId, startAt) | shifts |
| Q19 | Branch/day availability (tim staff theo tung segment) | rat cao | branchId, date, requiredStaffRole cua tung segment | -- | -- | strong | shifts (branchId, staffSubRole, status, startAt); branch_service_configs unique (branchId, serviceId); appointments (branchId, scheduledStart); slot_reservations (branchId, slotStartUnit) | nhieu |
| Q20 | Appointments by customer | cao | customerId | scheduledStart -1 | cursor | strong | appointments (customerId, scheduledStart -1) | appointments |
| Q21 | Appointments by branch/date | cao | branchId, range, status | scheduledStart | cursor | strong | appointments (branchId, scheduledStart) | appointments |
| Q22 | Services by bookingMode/serviceType/role | trung | status + field | name | offset | eventual | services (status, bookingMode); (status, serviceType); (requiredStaffRole, status) | services |
| Q23 | Inventory by branch | trung | branchId | name | cursor | strong | inventory_stocks unique (branchId, inventoryItemId) | inventory_stocks |
| Q24 | Inventory history | trung | branchId, item | createdAt -1 | cursor | strong | inventory_transactions (branchId, inventoryItemId, createdAt -1) | inventory_transactions |
| Q25 | Records by pet / revisions | trung | petId; serviceRecordId | createdAt; recordVersion | cursor | strong | service_records (petId, createdAt -1); revisions unique (serviceRecordId, recordVersion) | service_records |
| Q26 | Payment status | trung | target | -- | -- | strong | payments (target.type, target.id) | payments |
| Q27 | Booking refund queue | trung | status, branch | createdAt | cursor | strong | booking_refunds (status, createdAt) | booking_refunds |
| Q28b | Payment timeout job (pending payments with deadlines) | dinh ky | payments status=PENDING, expiresAt<now | applies to Order ONLINE_MOCK and Appointment PAY_AT_STORE DEPOSIT; no balance payment timeout | -- | batch | strong | payments (status, expiresAt) partial PENDING | payments |
| Q28 | Hold expiry job / reminder job | dinh ky | status, holdExpiresAt; scheduledStart window | -- | batch | strong | appointments (status, holdExpiresAt) partial; (status, scheduledStart) | appointments |
| Q29 | Notifications | cao | userId, read | createdAt -1 | cursor | strong | notifications (userId, read, createdAt -1) | notifications |
| Q30 | Idempotency, OTP, refresh | cao | key; expiresAt | -- | -- | strong | idempotency (key, scope) unique + TTL; TTL otp/refresh | -- |

## Unique/idempotency index quan trong
| Index | Muc dich |
|---|---|
| slot_reservations unique partial (staffId, slotStartUnit) kind STAFF | chong trung lich staff (moi segment) |
| slot_reservations unique partial (branchId, serviceId, slotStartUnit, unitIndex) kind CAPACITY | chong vuot capacity cua BranchServiceConfig |
| inventory_stocks unique (branchId, inventoryItemId) | mot dong ton moi branch/item |
| inventory_transactions unique partial (ORDER, sourceId, inventoryItemId, transactionType) | khong tru/hoan ton don hang 2 lan |
| inventory_transactions unique partial (SERVICE_RECORD_REVISION, sourceId, recordVersion, inventoryItemId) | khong ghi revision 2 lan |
| voucher_usages unique (voucherId, targetType, targetId) | khong consume 2 lan |
| order_refunds unique partial orderReturnId | 1 refund / return |
| booking_refunds unique partial paymentId where status in REQUESTED, PROCESSING, APPROVED, REFUNDED | 1 active/terminal refund per payment; a REJECTED request may be re-submitted |

## Concurrency
| Race | Co che |
|---|---|
| Checkout dong thoi het hang | tx + `findOneAndUpdate({quantity:{$gte:q}}, {$inc:{quantity:-q}})` + unique ledger; thieu => abort tx, 422 INSUFFICIENT_INVENTORY |
| Voucher quota | conditional `usedCount < quota` trong cung tx voi order |
| Payment fail/cancel/expire lap lai | conditional update payment status PENDING->terminal + unique ledger (ORDER, orderId, item, RECEIPT) => khong hoan ton 2 lan |
| Cancel/Confirm song song | conditional update `status` hien tai (CAS) |
| Return vuot so luong | conditional `returnReservedQty + q <= quantity` trong tx |
| Slot booking nhieu segment | tx: reserve STAFF cho tung segment + CAPACITY; duplicate key => thu staff ung vien ke tiep; het ung vien => rollback toan bo, 409 SLOT_UNAVAILABLE; Idempotency-Key |
| Reassign staff segment | tx: giai phong STAFF cu + giu STAFF moi (unique (staffId, slotStartUnit)); trung => 409 STAFF_UNAVAILABLE |
| Finalize/reopen | CAS status + version + unique (record, version, item) |
| Shift overlap | tx tim overlap roi insert |
| Branch config / manager assignment | version optimistic |


## Hold expiry consistency
`slot_reservations.expiresAt` của reservation HELD phải lấy cùng deadline với `appointments.holdExpiresAt`. Job expiry xử lý idempotent: CAS Appointment -> CANCELLED rồi release STAFF/CAPACITY reservations. Không để reservation HELD tồn tại quá deadline.


## Technical booking granularity
- `booking.slotMinutes` = 15 (technical default, configurable). Availability/reservation chia moi segment thanh cac time units 15 phut.
- `booking.holdDurationMinutes` = 10 (technical default, configurable). Ap dung ca `PENDING_PAYMENT` va `PENDING_CONFIRMATION`; `appointments.holdExpiresAt` va HELD reservation dung cung deadline.

| OrderRefund failed retry | reuse the same order_refunds document; Payment returns PAID after failed provider call; next retry re-enters REFUND_PENDING | avoids unique-index conflict and duplicate refunds |

## Slot reservation granularity
`slotMinutes=15` is the technical default/config. Every staff/capacity reservation occupies every 15-minute unit intersecting the segment interval; unique indexes use `slotStartUnit`.

## V7 correction contract

PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.

TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.

Product global chỉ Admin CRUD, không nhập stock trong Product form. Stock mặc định 0 (row có thể lazy-created); initial stock qua RECEIPT reason INITIAL_STOCK. Procurement/PO/supplier approval ngoài scope. Quantity chỉ đổi qua ledger transaction; threshold nằm ở inventory_stocks theo (branchId, inventoryItemId), default 0; Manager assigned branches/Admin ALL cập nhật threshold, không tạo movement stock. Transfer Manager cần cả hai branch trong scope.

Threshold configuration uses unique inventory_stocks(branchId,inventoryItemId) + version CAS. Notification (userId,read,createdAt); OTP/session TTL and unique hashes; request branch/status queue and unique partial appointmentId; outbox unique eventId + (status,nextAttemptAt); idempotency unique(actorScope,operationId,key); see 05 supplementary table for full definitions. Reviewer queue index appointments(branchId,reviewerStaffId,status).
