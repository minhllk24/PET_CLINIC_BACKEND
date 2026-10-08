# 16 Conflict and Decision Log v7 + Final Report (appointment staffing + payment flow)

V7 review revision based on the 17-file V6 package retrieved from the supplied source folder. Khong mo rong scope; chi lam ro contract va data-integrity rules. Uu tien: Team Lead/Boss > Feature > Business Rule/Flow > domain > security > feasibility > legacy.

## 16.1 Xu ly 7 muc feedback
| Muc | Van de | Xu ly | Noi sua |
|---|---|---|---|
| 🔴 Business rule | Internal booking: assign staff = CONFIRMED | **Go bo.** `internalAppointmentsCreate` ket thuc o `PENDING_PAYMENT` hoac `PENDING_CONFIRMATION` ke ca khi co `staffAssignments`; chi `appointmentsConfirm` (action rieng) sang `CONFIRMED`. Ap dung ca duyet appointment-request. `AppointmentConfirm` (body gan staff) bi xoa. Audit kiem tra transition khong chua CONFIRMED | 04, 07, 09, 14, ADR-33 |
| 🔴 Business rule | Payment Appointment chua tach online va pay-at-store | **ONLINE_MOCK = tra 100% finalAmount sau voucher ngay khi dat** (payments.kind `FULL`, depositAmount = 0, balance = 0). **PAY_AT_STORE = coc 30% finalAmount de giu slot** (kind `DEPOSIT`), 70% thu tai cua hang (kind `BALANCE`). **Deposit 30% chi ap dung cho PAY_AT_STORE.** `paymentMethod` bat buoc o tu dat, dat ho, duyet request. `bookingPaymentCreate` bi bo (payment duoc tao trong transaction booking) | 04, 05, 07, 09, 10, 14, ADR-09 |
| 🟠 Payment lifecycle | Deposit chi hop le khi thanh toan balance | **Ghi nhan ngay khi coc thanh cong:** `pricing.paidAmount` tang ngay (vd hoa don 1,000,000, coc 300,000 => paidAmount 300,000, deposit HELD). Khi COMPLETED deposit `APPLIED` **tu dong (system)**, chi thu them 700,000. Transition cua `bookingBalancePaymentCreate` khong con lien quan deposit; chi Receptionist/Manager/Admin tao | 04, 07, 09, 14 |
| 🔴 Business rule | COD Order dung chung flow ghi nhan tai cua hang | `paymentRecordAtStore` **chi cho Payment Appointment PAY_AT_STORE** (BALANCE); Order COD khong dung duoc (422). **COD chi PAID khi Mark Delivered.** Go "record-at-store" khoi quyen Order trong ma tran 08 | 07, 08, 09, 14, ADR-35 |
| 🟠 Contract cleanup | Rule tat ca service phai cung requiredStaffRole | **Go bo hoan toan.** Xoa `INCOMPATIBLE_STAFF_ROLES`, `suggestedGroups`. Mot Appointment: cung `serviceType`, moi service giu `requiredStaffRole`, duration, `assignedStaffId` rieng | 04, 07, 14, ADR-08 |
| 🔴 Scheduling logic | Customer bi buoc chon Staff / chi ho tro mot role | Customer **khong chon staff** (schema public khong co truong staff, audit kiem tra). Backend tu tim va reserve staff **cho tung segment**; segment **noi tiep** theo thu tu. Slot **chi kha dung neu tat ca segment tim duoc staff**; khong thi khong tra trong availability va tao => `409 SLOT_UNAVAILABLE` (rollback tat ca). `Appointment.assignedStaffId` (cap appointment) bi xoa, thay bang `services[].assignedStaffId`. `slot_reservations` tach STAFF (unique staff+slot) va CAPACITY. ServiceRecord dung `assignedStaffIds` | 03, 04, 05, 06, 07, 08, 10 |
| 🟠 Staff reassignment | Chua dinh nghia cach Manager/Receptionist doi staff | Them `appointmentSegmentReassign` (PUT `/appointments/{id}/segments/{serviceId}/staff`): Receptionist (authorizedBranchIds), Manager (assignedBranchIds), Admin. Staff moi phai **trung requiredStaffRole** cua segment (`422 STAFF_ROLE_MISMATCH`), thuoc authorizedBranchIds, co shift, khong trung lich (`409 STAFF_UNAVAILABLE`). Khong gan khac role chi vi con trong lich. Khong doi trang thai Appointment | 03, 07, 08, 09, 14, ADR-34 |

Rule chot: **Appointment = nhieu service segment doc lap ve Staff.** Moi segment: serviceType + requiredStaffRole + duration + assignedStaff. Backend tu tim va reserve theo segment; customer khong chon staff; toan bo Appointment chi available khi moi segment tim duoc staff.
Cac diem da bo khoi spec: (1) "service trong Appointment phai cung requiredStaffRole"; (2) assign staff = CONFIRMED; (3) deposit 30% cho online; (4) flow "ghi nhan thanh toan tai cua hang" cho COD.

## 16.2 Confirmed decisions
TA-30 refund rule and Medical Nurse/Vet execution with mandatory Veterinarian review/finalization were confirmed by the user on 08/10/2026 (Asia/Saigon). No pending business approval for these two items.

## 16.3 Gia dinh ky thuat moi/doi (can Boss biet)
| ID | Noi dung |
|---|---|
| TA-30 | TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment. |
| TA-31 | Segment noi tiep theo thu tu `serviceIds`; chon staff ung vien theo thu tu co dinh (staffId) cho den khi het ung vien (greedy du vi cac segment noi tiep, khong chong thoi gian) |
| TA-32 | Duyet appointment-request nhan `paymentMethod` bat buoc va `staffAssignments` tuy chon; khong cho client gui authority fields; staff assignment theo segment |
| TA-33 | PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6. |
Inherited technical assumptions are stated directly in the V7 contract; older versions are not required. No-show grace requires explicit deployment configuration (booking.noShowGraceMinutes >=0); no undeclared historical value is inferred.

## 16.4 Rui ro con lai
- TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

## 16.5 FINAL STATIC AUDIT
This audit is generated from the current package. It validates the design/contract artifacts only; runtime correctness requires implementation tests.

## 16.6 READINESS
- V7 feedback corrections are propagated across the package; bounded static checks and confirmed decisions and validation limits are listed in 18. No exhaustive semantic certification is claimed.
- Guest ownership is represented by a dedicated short-lived lookup token; guest cart/checkout uses a separate cart token.
- All business state-changing POST operations are idempotent; authentication/OTP and quote/validate operations remain separate.

## 16.7 FINAL REVIEW CLOSURE
- TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.
- `CustomerDetail.accountStatus`: nullable before User exists.
- Service is global; `contactInfo.branchId` absent. Branch capacity is only BranchServiceConfig.
- Material Catalog is seed-only.
- One encounter-level ServiceRecord per Appointment; segment execution state lives in Appointment.services[].
- ServiceExecutionRole excludes Receptionist.
- `PENDING_PAYMENT` and `PENDING_CONFIRMATION` both require `holdExpiresAt`; HELD reservation expiry mirrors the same deadline.
- mock/complete: owned Order ONLINE_MOCK/ORDER or Appointment ONLINE_MOCK/DEPOSIT; record-at-store: Appointment PAY_AT_STORE/BALANCE only; COD paid on delivery.
- Booking cancellation has no money TRANSFER outcome.
- AppointmentRequest has operational list/get/cancel lifecycle.

## 16.8 POST-REVIEW AUDIT
V6 PASS claims are superseded. See 18-static-audit-v7.md and the executable 19-contract-check-v7.py for actual checks performed on V7. No runtime/security behavior is claimed tested.

## 16.9 FINAL CLOSURE
Task 2.8 contract = BUSINESS_CONFIRMED / CONTRACT_REVIEW_READY. Both business decisions are accepted; bounded static audit is rerun in file 18. Implementation tests have not run. Task-level DONE requires document handoff criteria and live-Sheet reconciliation; runtime acceptance belongs to implementation validation.

## 16.10 FINAL AUDIT CLOSURE
Current generated counts and bounded static check results are recorded in file 18. Runtime implementation tests have not run.

## V7 correction contract

PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.

TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.

Product global chỉ Admin CRUD, không nhập stock trong Product form. Stock mặc định 0 (row có thể lazy-created); initial stock qua RECEIPT reason INITIAL_STOCK. Procurement/PO/supplier approval ngoài scope. Quantity chỉ đổi qua ledger transaction; threshold nằm ở inventory_stocks theo (branchId, inventoryItemId), default 0; Manager assigned branches/Admin ALL cập nhật threshold, không tạo movement stock. Transfer Manager cần cả hai branch trong scope.

## V7 disposition

Payment Customer deposit path, mandatory 30%, branch threshold + write API, initial Receipt/procurement boundary, store reschedule semantics and self-contained schema are corrected. TA-30 refund policy and Medical execution/review rules were confirmed by the user on 08/10/2026 (Asia/Saigon). File 17 remains a sync proposal; this update does not mutate the live Sheet. No pending business approval remains for these two decisions. Live-Sheet reconciliation and implementation acceptance remain unverified.

## Confirmed rule guard
The legacy CancelOverrideRequest FORFEIT option is limited to PAY_AT_STORE deposit forfeiture. It cannot forfeit 100% ONLINE prepayment; ONLINE uses confirmed TA-30 unless an audited REFUND_100 exception is selected.
