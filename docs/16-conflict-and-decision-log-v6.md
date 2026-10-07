# 16 Conflict and Decision Log v6 + Final Report (appointment staffing + payment flow)

V6 FINAL UPDATED = V5 + final consistency/security/concurrency fixes. Khong mo rong scope; chi lam ro contract va data-integrity rules. Uu tien: Team Lead/Boss > Feature > Business Rule/Flow > domain > security > feasibility > legacy.

## 16.1 Xu ly 7 muc feedback
| Muc | Van de | Xu ly | Noi sua |
|---|---|---|---|
| 🔴 Business rule | Internal booking: assign staff = CONFIRMED | **Go bo.** `internalAppointmentsCreate` ket thuc o `PENDING_PAYMENT` hoac `PENDING_CONFIRMATION` ke ca khi co `staffAssignments`; chi `appointmentsConfirm` (action rieng) sang `CONFIRMED`. Ap dung ca duyet appointment-request. `AppointmentConfirm` (body gan staff) bi xoa. Audit kiem tra transition khong chua CONFIRMED | 04, 07, 09, 14, ADR-33 |
| 🔴 Business rule | Payment Appointment chua tach online va pay-at-store | **ONLINE_MOCK = tra 100% finalAmount sau voucher ngay khi dat** (payments.kind `FULL`, depositAmount = 0, balance = 0). **PAY_AT_STORE = coc 30% finalAmount de giu slot** (kind `DEPOSIT`), 70% thu tai cua hang (kind `BALANCE`). **Deposit 30% chi ap dung cho PAY_AT_STORE.** `paymentMethod` bat buoc o tu dat, dat ho, duyet request. `bookingPaymentCreate` bi bo (payment duoc tao trong transaction booking) | 04, 05, 07, 09, 10, 14, ADR-09 |
| 🟠 Payment lifecycle | Deposit chi hop le khi thanh toan balance | **Ghi nhan ngay khi coc thanh cong:** `pricing.paidAmount` tang ngay (vd hoa don 1,000,000, coc 300,000 => paidAmount 300,000, deposit HELD). Khi COMPLETED deposit `APPLIED` **tu dong (system)**, chi thu them 700,000. Transition cua `bookingBalancePaymentCreate` khong con lien quan deposit; chi Receptionist/Manager/Admin tao | 04, 07, 09, 14 |
| 🔴 Business rule | COD Order dung chung flow ghi nhan tai cua hang | `paymentRecordAtStore` **chi cho Payment Appointment PAY_AT_STORE** (DEPOSIT/BALANCE); Order COD khong dung duoc (422). **COD chi PAID khi Mark Delivered.** Go "record-at-store" khoi quyen Order trong ma tran 08 | 07, 08, 09, 14, ADR-35 |
| 🟠 Contract cleanup | Rule tat ca service phai cung requiredStaffRole | **Go bo hoan toan.** Xoa `INCOMPATIBLE_STAFF_ROLES`, `suggestedGroups`. Mot Appointment: cung `serviceType`, moi service giu `requiredStaffRole`, duration, `assignedStaffId` rieng | 04, 07, 14, ADR-08 |
| 🔴 Scheduling logic | Customer bi buoc chon Staff / chi ho tro mot role | Customer **khong chon staff** (schema public khong co truong staff, audit kiem tra). Backend tu tim va reserve staff **cho tung segment**; segment **noi tiep** theo thu tu. Slot **chi kha dung neu tat ca segment tim duoc staff**; khong thi khong tra trong availability va tao => `409 SLOT_UNAVAILABLE` (rollback tat ca). `Appointment.assignedStaffId` (cap appointment) bi xoa, thay bang `services[].assignedStaffId`. `slot_reservations` tach STAFF (unique staff+slot) va CAPACITY. ServiceRecord dung `assignedStaffIds` | 03, 04, 05, 06, 07, 08, 10 |
| 🟠 Staff reassignment | Chua dinh nghia cach Manager/Receptionist doi staff | Them `appointmentSegmentReassign` (PUT `/appointments/{id}/segments/{serviceId}/staff`): Receptionist (authorizedBranchIds), Manager (assignedBranchIds), Admin. Staff moi phai **trung requiredStaffRole** cua segment (`422 STAFF_ROLE_MISMATCH`), thuoc authorizedBranchIds, co shift, khong trung lich (`409 STAFF_UNAVAILABLE`). Khong gan khac role chi vi con trong lich. Khong doi trang thai Appointment | 03, 07, 08, 09, 14, ADR-34 |

Rule chot: **Appointment = nhieu service segment doc lap ve Staff.** Moi segment: serviceType + requiredStaffRole + duration + assignedStaff. Backend tu tim va reserve theo segment; customer khong chon staff; toan bo Appointment chi available khi moi segment tim duoc staff.
Cac diem da bo khoi spec: (1) "service trong Appointment phai cung requiredStaffRole"; (2) assign staff = CONFIRMED; (3) deposit 30% cho online; (4) flow "ghi nhan thanh toan tai cua hang" cho COD.

## 16.2 Open decisions
**Khong co.**

## 16.3 Gia dinh ky thuat moi/doi (can Boss biet)
| ID | Noi dung |
|---|---|
| TA-30 | **Đã chốt:** quy tắc hủy/no-show áp dụng cho **khoản trả trước**: >=24h hoàn 100%; <24h và no-show không hoàn. PAY_AT_STORE áp dụng trên cọc 30%; ONLINE_MOCK áp dụng trên 100% finalAmount. |
| TA-31 | Segment noi tiep theo thu tu `serviceIds`; chon staff ung vien theo thu tu co dinh (staffId) cho den khi het ung vien (greedy du vi cac segment noi tiep, khong chong thoi gian) |
| TA-32 | Duyet appointment-request nhan `paymentMethod` bat buoc va `staffAssignments` tuy chon; khong cho client gui authority fields; staff assignment theo segment |
| TA-33 | PAY_AT_STORE ma khong service nao bat coc: khong coc, vao thang PENDING_CONFIRMATION, thu het tai cua hang |
TA cu con hieu luc: TA-01, 02, 04, 05, 08, 09, 10, 11, 12, 19-22, 24-29 (xem v4/v5). TA-07 va CD-14 (cung requiredStaffRole) bi huy.

## 16.4 Rui ro con lai
1. TA-30 đã đóng và áp dụng thống nhất cho mọi khoản trả trước. 2. Nhiều role trong một Appointment (Vet + Nurse) làm slot khó khả dụng hơn; đây là trade-off đã chấp nhận trong scope. 3. PAY_AT_STORE không có cọc có rủi ro no-show; không mở thêm rule đếm no-show. 4. ServiceRecord là encounter-level aggregate; phân quyền theo role + assignment của Appointment. 5. Figma đã truy cập được nhưng chưa freeze: FE chưa handoff. 6. Chưa có code: test tự động chưa chạy. 7. Resolver fulfillment theo priority list không tối ưu khoảng cách nhưng đã chấp nhận trong scope. 8. File 17 companion sync đã cập nhật các quyết định final.

## 16.5 FINAL STATIC AUDIT
This audit is generated from the current package. It validates the design/contract artifacts only; runtime correctness requires implementation tests.

## 16.6 READINESS
- Business rules, authorization, state machines, MongoDB shape/index intent, OpenAPI and mapping artifacts are synchronized.
- Guest ownership is represented by a dedicated short-lived lookup token; guest cart/checkout uses a separate cart token.
- All business state-changing POST operations are idempotent; authentication/OTP and quote/validate operations remain separate.

## 16.7 FINAL REVIEW CLOSURE
- TA-30: customer cancellation/no-show >=24h refunds 100% prepayment; <24h/no-show no refund. System/store rejection and confirmation-hold timeout refund 100% prepayment.
- `CustomerDetail.accountStatus`: nullable before User exists.
- Service is global; `contactInfo.branchId` absent. Branch capacity is only BranchServiceConfig.
- Material Catalog is seed-only.
- One encounter-level ServiceRecord per Appointment; segment execution state lives in Appointment.services[].
- ServiceExecutionRole excludes Receptionist.
- `PENDING_PAYMENT` and `PENDING_CONFIRMATION` both require `holdExpiresAt`; HELD reservation expiry mirrors the same deadline.
- Payment boundary: Appointment ONLINE_MOCK auto-PAID; PAY_AT_STORE recorded at store; Order COD paid at delivery; mock-complete only Order ONLINE_MOCK.
- Booking cancellation has no money TRANSFER outcome.
- AppointmentRequest has operational list/get/cancel lifecycle.

## 16.8 POST-REVIEW AUDIT
| Check | Result |
|---|---|
| YAML parse | PASS |
| Ref resolution | PASS |
| Unique operationId | PASS |
| Every operation has x-authz/x-audience/security | PASS |
| Guest lookup security | PASS |
| Guest cart security | PASS |
| Payment 4-combination constraint | PASS |
| Appointment segment lifecycle | PASS |
| Reservation time-unit protection | PASS |
| ServiceExecutionRole constraint | PASS |
| ServiceRecord expectedVersion guards | PASS |
| Catalog read/write separation | PASS |
| Figma status normalized | PASS |
| Idempotency policy coverage | PASS |

## 16.9 FINAL CLOSURE
Task 2.8 is **contract/static-audit complete** for the defined Web 2 scope. No known cross-document blocker remains in the reviewed package.

## 16.10 FINAL AUDIT CLOSURE
Authoritative metrics generated from this packaged folder:
- Files: 17
- OpenAPI paths: 128
- OpenAPI operations: 147
- OpenAPI schemas: 178
- Internal $ref occurrences checked: 1424
- Mapping CSV data rows: 130
- Companion sheet-sync data rows: 41
- Unique operationIds: 147
- Business state-changing POST operations with Idempotency-Key: PASS
- Static structural/security/cross-document audit: PASS
- Runtime implementation tests: pending implementation (Task 2.9+)
