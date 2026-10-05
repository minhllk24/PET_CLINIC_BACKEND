# 03 Target System Architecture v6 (Greenfield, 2 Angular apps, scope lock)

Node.js + Express + MongoDB (replica set). Modular monolith. OpenAPI-first `/api/v1`.

## Context
```mermaid
flowchart TD
  G[Guest] --> CA
  C[Customer] --> CA
  S[Staff: Receptionist / Care-Groomer / Nurse / Veterinarian] --> AA
  M[Manager] --> AA
  A[Admin] --> AA
  CA[Customer Angular app] -->|/api/v1 x-audience customer| API[API Server Express]
  AA[Admin Angular app] -->|/api/v1 x-audience admin| API
  API --> DB[(MongoDB replica set)]
  API --> EXT[Email / SMS / Payment adapters]
```

## Container
```mermaid
flowchart LR
  CA[Customer Angular] --> HTTP
  AA[Admin Angular] --> HTTP
  HTTP[helmet, CORS allowlist 2 origin, rate limit, correlationId, OpenAPI validator] --> AUTHN[JWT access 15m + refresh rotation]
  AUTHN --> POL[Policy: systemRole + staffSubRole + ownership + branch + assignment + state + field]
  POL --> APP[Application services per module]
  APP --> DOM[Domain: pricing, voucher allocation, slot engine, state machines, inventory delta]
  APP --> MDB[(MongoDB)]
  APP --> OB[(outbox)] --> PROV[EmailProvider / SmsProvider]
  APP --> PAY[PaymentProvider -> MockPaymentProvider]
  JOBS[Jobs: hold expiry, reminder, outbox dispatcher, low-stock] --> MDB
```

## Hop dong FE: mot OpenAPI, hai Angular
- `07-openapi-v6.yaml` la nguon duy nhat. Moi operation co `x-audience` (customer, admin, hoac ca hai) de sinh hai goi: `api-customer` va `api-admin` (openapi-generator `typescript-angular` hoac `ng-openapi-gen`) hoac mot goi chung co tag.
- Customer app khong duoc goi operation chi co audience admin (kiem tra CI).
- Admin Angular IA theo sheet task 2.4: Dashboard; User Management/Customers; Sales/Product/Order/Refund; Service/Branch/Appointment/Service Records; Inventory; Staff/Role/Shift; Voucher; Feedback/Review; Content.
- Loi theo Problem Details; hanh dong hien thi theo `allowedActions[]` do server tra.

## Modules
| Module | Collections |
|---|---|
| identity | users, otp_challenges, refresh_sessions |
| customer | customers, guest_contacts |
| pet | pets |
| branch | branches |
| serviceCatalog (ADMIN) | services |
| branchService (MANAGER trong assignedBranches) | branch_service_configs |
| staff, shift | staff_profiles, shifts |
| catalog (ADMIN) | categories, products |
| cart | carts |
| order | orders, order_returns, order_refunds |
| voucher | vouchers, voucher_usages |
| booking | appointments, slot_reservations, appointment_requests |
| serviceExecution | service_records, service_record_revisions |
| inventory | inventory_items, inventory_stocks, inventory_transactions (append-only) |
| payment, refund | payments, booking_refunds |
| settings | system_settings |
| notification | notifications, outbox |
| audit | audit_logs, idempotency_keys |
| review | reviews |

## Transaction Boundary Matrix
Single-document la atomic, khong dung transaction. Multi-document dung tx (can replica set).
| Boundary | Tx? | Noi dung | Idempotency |
|---|---|---|---|
| **Checkout** | Co | resolver chon branch, roi tai branch do: Order PENDING (snapshot line, phan bo discount) + N ledger ISSUE + N conditional stock decrement + voucher quota consume + Payment PENDING (1 tx) | Idempotency-Key; unique ledger (ORDER, orderId, item, ISSUE) |
| **Payment failure/cancel/expire (ONLINE_MOCK)** | Co | Payment terminal + Order CANCELLED + N ledger RECEIPT + restore voucher (compensating tx) | callback lap lai = no-op; unique ledger (ORDER, orderId, item, RECEIPT); unique voucher_usages |
| **Order cancel** | Co | status + N ledger RECEIPT hoan ton + voucher restore + payment/refund | key |
| Order transition (confirm, process, ship, deliver) | Khong (1 doc, conditional update status) | orders | tu nhien |
| Order return create | Co | order_returns + conditional `returnReservedQty` tren orders | key |
| Return receive (PROCESSING > RECEIVED) | Khong (1 doc, conditional status) | order_returns | tu nhien |
| Return approve (RECEIVED > APPROVED) | Co | order_returns + order_refunds PENDING | key |
| Order refund process | Co | order_refunds + payments (refundedAmount, status) + order_returns COMPLETED | key |
| Booking | Co | reserve staff + capacity cho tung segment + appointment + snapshots + payment (FULL hoac DEPOSIT) + voucher consume | key + unique reservation |
| Prepayment (FULL/DEPOSIT) mock | Co | payments + appointments.pricing.paidAmount + deposit.status + appointment status (ghi nhan ngay) |
| Balance payment tai cua hang | Co | payments BALANCE + paidAmount |
| Reassign segment staff | Co | giai phong + giu reservation + appointments.services[].assignedStaffId | key + providerRef unique |
| Booking refund | Co | booking_refunds + payments + deposit | key + 1 refund mo/payment |
| Service finalize | Co | revision + ledger delta + stocks + appointment | key + unique (record, version, item) |
| Inventory receive/issue/adjust | Co | 1 ledger + 1 stock | key |
| Inventory transfer | Co | 2 ledger + 2 stocks | key |
| Shift create | Co | overlap check + insert | retry WriteConflict |
| Branch service config / manager assignment | Khong | 1 doc, version | -- |

## Booking: tu dat va dat ho
`appointmentsCreate` (Customer/Guest tu dat) va `internalAppointmentsCreate` (Receptionist/Manager/Admin dat ho Customer hoac Guest) dung chung use case domain, khac request schema va authorization. Guest khong co account/mat khau.

## Availability engine (booking, theo segment)
Branch ACTIVE + openingHours + holidays + slotLocks + BranchServiceConfig(enabled, capacity, availability) cho moi service + cac **segment noi tiep** (moi service mot khoang `scheduledStart/End`, tong = sum duration) + **voi moi segment: tim staff** co `staffSubRole` trung `requiredStaffRole`, `authorizedBranchIds` chua branch, `Shift(branchId)` phu khoang segment, khong trung `slot_reservations`/appointments khac. Slot **chi kha dung neu tat ca segment tim duoc staff** (cac segment doc lap nhau ve staff nen greedy theo thu tu la day du). Computed, khong luu; customer khong chon staff va API public khong tra staff.
Reservation (luu khi tao Appointment, 1 tx): moi segment 1 reservation `STAFF` (unique `(staffId, slotStart)`) + capacity `(branchId, serviceId, slotStart, unitIndex)`. Dua tranh (duplicate key): thu staff ung vien ke tiep cua segment; het ung vien => `409 SLOT_UNAVAILABLE`, rollback tat ca segment.
Doi staff mot segment (`appointmentSegmentReassign`): kiem tra role trung segment, authorized, shift, khong trung; giai phong reservation staff cu va giu staff moi trong 1 tx.

## Providers
`PaymentProvider{createCharge, refund}` -> `MockPaymentProvider`. Email/SMS qua outbox; nhac lich qua email + notification (chuong). OTP: CSPRNG, hash, TTL 5 phut, 5 lan, resend 30s.

## Assumptions: xem 16. Khong con open decision. `FulfillmentBranchResolver` = `PriorityListResolver`: duyet `system_settings.fulfillmentBranchPriority`, chon branch ACTIVE dau tien du ton cho toan bo cart, ISSUE tai branch do (xem 04).
