# 08 Authorization Matrix v5 + Resource Scope Resolver

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
| Appointment | `appointment.branchId` | `appointment.customerId` | staff duoc giao (`assignedStaffId`) |
| ServiceRecord | `serviceRecord.branchId` | Customer qua pet/appointment cua minh | staff duoc giao |
| InventoryStock | `inventoryStock.branchId` | -- | Manager: assignedBranchIds |
| InventoryTransaction | `inventoryTransaction.branchId` | -- | Manager/Staff theo role |
| Order | `order.fulfillmentBranchId` | `order.customerId` | Manager/Receptionist theo branch |
| OrderReturn | `orderId` > `Order.fulfillmentBranchId` | Customer cua Order | Manager/Receptionist theo branch |
| OrderRefund | `orderId` > `Order.fulfillmentBranchId` | Customer cua Order | Manager/Admin |
| Payment | target ORDER: `Order.fulfillmentBranchId`; target APPOINTMENT: `Appointment.branchId` | chu cua target | branch cua target |
| Pet | NONE | `pet.customerId` | Staff qua Appointment/ServiceRecord; Manager qua Customer activity |
| Cart | NONE (khong co branch scope) | cart owner / `cartToken` | -- |
| Voucher | GLOBAL | -- | Admin |
Payment, Pet, Customer, Cart khong co truong branch rieng. Order dung duy nhat `fulfillmentBranchId` (khong co truong branch khac).
`BR`: Manager = `assignedBranchIds`; Receptionist/Staff = `authorizedBranchIds`. `ACT`: Customer activity qua Order/Appointment.

| Role | Resource | R | C | U | P | A | Scope |
|---|---|---|---|---|---|---|---|
| Guest | Product, Category, Service, Branch, Voucher validate | R | - | - | - | - | public |
| Guest | Cart (cartToken), Checkout, Order cua minh | R (token/OTP) | C | - | cancel (state som), return request, cancel payment | - | token / contact verified |
| Customer | Profile, Pet | R | C | U | - | - | OWN |
| Customer | Cart, Order | R | C (checkout) | cart edit | cancel (PENDING/CONFIRMED), cancel payment | - | OWN |
| Customer | Order return | R | C | - | cancel (truoc RECEIVED) | - | OWN |
| Customer | Appointment | R | C (tu dat) | reschedule | cancel | - | OWN |
| Customer | Payment, Booking refund, Review, Notification | R | C | - | - | - | OWN |
| Receptionist | Order | R | - | - | confirm, process, ship, mark-delivered, staff-cancel, record-at-store | - | BR |
| Receptionist | Order return | R | - | - | **process, receive** | **KHONG approve/reject** | BR |
| Receptionist | Appointment, request | R | **C (dat ho Customer/Guest)** | U | confirm, reject, no-show, store-cancel, approve/reject request | - | BR |
| Receptionist | Booking refund | R | - | - | receive/check | KHONG | BR |
| Receptionist | Customer (qua Order/Appointment dang xu ly) | R need-to-know | - | - | activation invite | - | BR |
| Receptionist | BranchServiceConfig, Inventory stock | R | - | - | - | - | BR |
| Care Staff/Groomer | Service record GROOMING | R | - | U actual materials | start, finalize | - | BR + assigned |
| Care Staff/Groomer | Service record MEDICAL | KHONG | KHONG | KHONG | KHONG | - | - |
| Nurse | Service record MEDICAL | R | - | U actual materials | start, submit-review | KHONG finalize | BR + assigned |
| Veterinarian | Service record MEDICAL | R | - | U diagnosis/treatment/result | start, finalize | - | BR + assigned |
| Manager | **Customer** (list/detail/search, Pets, Orders, Appointments, Reviews) | R | - | - | **KHONG Block/Unblock** | - | **ACT** |
| Manager | **Product, Category, Service Catalog, Voucher (global)** | **R only** | KHONG | KHONG | KHONG | - | GLOBAL |
| Manager | BranchServiceConfig (enabled, capacity, availability) | R | C | U | - | - | BR |
| Manager | Branch | R | - | U thong tin | - | - | BR |
| Manager | Staff, Shift | R | C shift | U shift | cancel shift | - | BR |
| Manager | Order | R | - | - | confirm, process, ship, mark-delivered, staff-cancel, record-at-store | - | BR |
| Manager | Order return / refund | R | - | - | process refund (mock) | **approve, reject** | BR |
| Manager | Appointment | R | **C (dat ho)** | U | confirm, reject, no-show, store-cancel, reschedule-override, cancel-override | - | BR |
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
