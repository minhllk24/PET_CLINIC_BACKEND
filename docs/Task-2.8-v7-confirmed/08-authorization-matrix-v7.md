# 08 Authorization Matrix v7 + Resource Scope Resolver

Thu tu: Authentication > systemRole + staffSubRole > Ownership/Branch/Assignment (resolver, filter ngay trong query) > State > Field. Khong du quyen doc => 404; du quyen doc nhung khong du quyen action => 403 voi code cu the. Actor, role, branch scope, assignment luon do server suy ra tu token + DB; client khong gui `actorId`, `actorRole`, `approvedBy`, `cancelledBy`, `override`, `branchScope`, `stockAfter`, `refundAmount`, `paymentStatus`, `orderStatus`, `accountStatus`, `lastLogin`.
Moi operation trong OpenAPI co `x-authz.resolver` va `x-authz.scope` theo bang duoi.

## RESOURCE SCOPE RESOLVER TABLE (bat buoc)
| Resource | Branch Resolver | Ownership Resolver | Assignment Resolver |
|---|---|---|---|
| Customer | Activity: Order.fulfillmentBranchId / Appointment.branchId lien quan | Customer: chinh minh | Manager qua assignedBranchIds |
| Product | NONE / GLOBAL | -- | Admin global |
| Category | NONE / GLOBAL | -- | Admin global |
| Service Catalog | NONE / GLOBAL | -- | Admin global |
| BranchServiceConfig | `branchId` | -- | Manager: assignedBranchIds |
| Shift | `shift.branchId` | Staff: shift cua minh | Manager: assignedBranchIds |
| AppointmentRequest | `preferredBranchId` / target branch | Customer own; Guest via verified lookup token | Staff/Manager reviews by branch scope |
| Appointment | `appointment.branchId` | Customer: `appointment.customerId`; Guest: verified `guestContactId` via `X-Guest-Lookup-Token` | staff duoc giao: `services[].assignedStaffId` cua it nhat mot segment |
| ServiceRecord | `serviceRecord.branchId` | Customer qua pet/appointment cua minh; Guest lookup token qua Appointment | staff thuoc `assignedStaffIds` (cac segment) |
| InventoryStock | `inventoryStock.branchId` | -- | Manager: assignedBranchIds |
| InventoryTransaction | `inventoryTransaction.branchId` | -- | Manager/Staff theo role |
| Order | `order.fulfillmentBranchId` | `order.customerId`; Guest: verified guestContactId via lookup token | Manager/Receptionist theo branch |
| OrderReturn | `orderId` > `Order.fulfillmentBranchId` | Customer cua Order; Guest via lookup token -> guest order | Manager/Receptionist theo branch |
| OrderRefund | `orderId` > `Order.fulfillmentBranchId` | Customer cua Order; Guest via lookup token -> guest order | Manager/Admin |
| Payment | target ORDER: `Order.fulfillmentBranchId`; target APPOINTMENT: `Appointment.branchId` | owner of target; Guest via lookup token | branch cua target |
| Pet | NONE | `pet.customerId`; Guest pet only via its appointment/request token flow | Staff qua Appointment/ServiceRecord; Manager qua Customer activity |
| Cart | NONE (khong co branch scope) | cart owner / `cartToken` | -- |
| Voucher | GLOBAL | -- | Admin |
Payment, Pet, Customer, Cart khong co truong branch rieng. Order dung duy nhat `fulfillmentBranchId` (khong co truong branch khac).
`BR`: Manager = `assignedBranchIds`; Receptionist/Staff = `authorizedBranchIds`. `ACT`: Customer activity qua Order/Appointment. `CustomerDetail.accountStatus` chỉ có giá trị ACTIVE/BLOCKED khi đã có User; chưa có User thì API trả null.

| Role | Resource | R | C | U | P | A | Scope |
|---|---|---|---|---|---|---|---|
| Guest | Product, Category, Service, Branch, Voucher validate | R | - | - | - | - | public |
| Guest | Cart (cartToken), Checkout, Order cua minh | R (token/OTP) | C | - | cancel (state som), return request, cancel payment | - | token / contact verified |
| Customer | Profile, Pet | R | C | U | - | - | OWN |
| Customer | Cart, Order | R | C (checkout) | cart edit | cancel (PENDING/CONFIRMED), cancel payment | - | OWN |
| Customer | Order return | R | C | - | cancel (truoc RECEIVED) | - | OWN |
| Customer | Appointment | R | C (tu dat) | reschedule | cancel | - | OWN |
| Guest | Appointment, AppointmentRequest | R (lookup token) | C request/booking | reschedule | cancel | - | verified lookup token owns guest contact |
| Customer | Payment, Booking refund, Review, Notification | R | C | - | - | - | OWN |
| Customer | AppointmentRequest | R | C | - | cancel | - | OWN |
| Guest | Payment, Booking refund, OrderReturn/OrderRefund, AppointmentRequest | R (lookup token) | - | - | cancel/review request | - | verified lookup token |
| Receptionist | Order | R | - | - | confirm, process, ship, mark-delivered, staff-cancel (COD PAID khi mark-delivered; khong co record-at-store cho Order) | - | BR |
| Receptionist | Order return | R | - | - | **process, receive** | **KHONG approve/reject** | BR |
| Receptionist | Appointment, request | R | **C (dat ho Customer/Guest; co the chi dinh staff tung segment)** | U | confirm (action rieng), reject, no-show, store-cancel, approve/reject request, **reassign staff tung segment (trung requiredStaffRole, available)**, record-at-store (Appointment PAY_AT_STORE: coc, balance) | - | BR |
| Receptionist | Booking refund | R | - | - | receive/check | KHONG | BR |
| Receptionist | Customer (qua Order/Appointment dang xu ly) | R need-to-know | - | - | activation invite | - | BR |
| Receptionist | BranchServiceConfig, Inventory stock | R | - | - | - | - | BR |
| Care Staff/Groomer | Appointment (segment duoc giao), Service record GROOMING | R | - | U actual materials | start, finalize | - | BR + assigned |
| Care Staff/Groomer | Service record MEDICAL | KHONG | KHONG | KHONG | KHONG | - | - |
| Nurse | Service record MEDICAL | R | - | U actual materials | start, submit-review segment | KHONG finalize | BR + assigned |
| Veterinarian | Service record MEDICAL | R | - | U diagnosis/treatment/result | start, finalize segment/overall | - | BR + assigned |
| Manager | **Customer** (list/detail/search, Pets, Orders, Appointments, Reviews) | R | - | - | **KHONG Block/Unblock** | - | **ACT** |
| Manager | **Product, Category, Service Catalog, Voucher (global)** | **R only** | KHONG | KHONG | KHONG | - | GLOBAL |
| Manager | BranchServiceConfig (enabled, capacity, availability) | R | C | U | - | - | BR |
| Manager | Branch | R | - | U thong tin | - | - | BR |
| Manager | Staff, Shift | R | C shift | U shift | cancel shift | - | BR |
| Manager | Order | R | - | - | confirm, process, ship, mark-delivered, staff-cancel | - | BR |
| Manager | Order return / refund | R | - | - | process refund (mock) | **approve, reject** | BR |
| Manager | Appointment | R | **C (dat ho)** | U | confirm (action rieng), reject, no-show, store-cancel, reschedule-override, cancel-override, **reassign staff tung segment (trung requiredStaffRole, available)**, record-at-store | - | BR |
| Manager | Booking refund | R | - | - | receive | approve, reject, override | BR |
| Manager | **Inventory** | R | RECEIPT, ISSUE, ADJUSTMENT, TRANSFER (khong sua quantity truc tiep) | - | - | - | BR (transfer: ca hai branch) |
| Manager | Service record | R | - | - | reopen | - | BR |
| Manager | Review, Dashboard | R | - | hide/show | - | - | BR |
| Admin | **Customer** | R | - | - | **block, unblock (reason, audit)** | - | ALL |
| Admin | Product (gom variant), Category, Service Catalog, Voucher, commerce settings (gom `fulfillmentBranchPriority`, chi doc/ghi qua `/admin/settings/commerce`) | R | C | U, archive | - | - | GLOBAL |
| Admin | Branch | R | C | U | activate, deactivate | - | ALL |
| Admin | Account, systemRole, staffSubRole, authorizedBranchIds, assignedBranchIds | R | C | U | - | - | ALL |
| Admin | Moi resource van hanh khac | R | C | U | P | A | ALL (van qua state + field) |

## Field-level
| Field | Customer | Staff | Manager | Admin | Ghi chu |
|---|---|---|---|---|---|
| accountStatus, activationStatus, lastLogin | R own | - | R (ACT) | R | chi Admin doi accountStatus qua block/unblock |
| passwordHash, failedLoginCount | - | - | - | - | khong tra ve |
| systemRole, staffSubRole, authorizedBranchIds, assignedBranchIds | R own | R own | R (BR) | RW | chi Admin ghi |
| order.status, payment.status, return.status, refund.status, deposit.status | R | R | R | R | chi doi qua action |
| order.pricing, lineNet, allocatedDiscount, refundBreakdown | R own | R (BR) | R | R | server tinh |
| fulfillmentBranchId | R | R | R | R | readOnly, server gan theo resolver priority list |
| fulfillmentBranchPriority | - | - | - | RW | cau hinh Admin, khong public |
| inventory_stocks.quantity | - | R han che | R | R | khong endpoint ghi |
| professional.* | R result khi FINALIZED | Vet RW, Nurse R | R | R | |

## Test authorization (V5 s.48)
Customer A xem Order cua B: 404. Customer vao data branch Manager: 403/404. Manager Branch A sang Branch B: 404. Manager ghi global Product/Category/Service: 403. Manager Inventory branch duoc gan: OK; branch khong gan: 404. Admin block/unblock Customer: OK. Manager block/unblock: 403.

## Ghi chu staffing
Customer/Guest khong chon va khong thay lua chon staff. Phan cong staff (tu dong luc tao, `staffAssignments` khi dat ho, hoac `appointmentSegmentReassign` khong doi trang thai Appointment; chuyen sang CONFIRMED chi bang `appointmentsConfirm`. Doi staff phai cung `requiredStaffRole` cua segment; khac role => `STAFF_ROLE_MISMATCH`.


## Execution-role rule
`requiredStaffRole` cua Service/Appointment segment dung `ServiceExecutionRole = CARE_STAFF_GROOMER | NURSE | VETERINARIAN`; RECEPTIONIST khong the la requiredStaffRole va khong duoc start/finalize service.

## Guest token invariant
`X-Guest-Lookup-Token` can prove ownership of the specific verified guest contact only. It never grants staff/manager/admin actions and cannot be substituted for bearer authentication on internal endpoints.

## V7 correction contract

PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.

TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.

Product global chỉ Admin CRUD, không nhập stock trong Product form. Stock mặc định 0 (row có thể lazy-created); initial stock qua RECEIPT reason INITIAL_STOCK. Procurement/PO/supplier approval ngoài scope. Quantity chỉ đổi qua ledger transaction; threshold nằm ở inventory_stocks theo (branchId, inventoryItemId), default 0; Manager assigned branches/Admin ALL cập nhật threshold, không tạo movement stock. Transfer Manager cần cả hai branch trong scope.

| Role | Action | Scope |
|---|---|---|
| Customer/verified Guest | paymentMockComplete DEPOSIT | OWN, ONLINE_MOCK, unexpired PENDING hold |
| Manager/Admin | inventoryThresholdUpdate | assigned branch / ALL |
| Receptionist/Manager/Admin | appointmentReviewerAssign | branch / ALL; Vet authorized in branch |
| Assigned reviewer Vet | Medical professional/finalize | reviewerStaffId + branch; all execution segments complete |
