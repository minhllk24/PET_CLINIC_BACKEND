# 01 Requirement Traceability Matrix v6

Thu tu uu tien: Team Lead/Boss decisions > Feature > Business Rule/Flow > domain consistency > security > feasibility > legacy. Log la bang chung phu tro (thap hon sheet). FE dich: **Customer Angular + Admin Angular**. BE dich: **greenfield Node.js + Express + MongoDB**. Figma: FIGMA_AVAILABLE_BUT_NOT_FROZEN (Task 2.4 chưa freeze).
Tat ca module P0 co trace day du; **M05, M06, M07, M08 la critical E2E commerce, P0 day du.**

## P0 trace: Feature > Rule > API > Domain > MongoDB > Authorization > State > Angular > Test
| Req | Feature / Rule | API (operationId) | Domain | MongoDB | Authz resolver (08) | State (09) | Customer Angular | Admin Angular | Test (14) |
|---|---|---|---|---|---|---|---|---|---|
| M01 | Auth & Account, BF01, password 8+ chu hoa + so | authLogin, authRegister, authRefresh, authLogout, authForgotPassword, authResetPassword, authOtpResend, authMe | Identity | users, otp_challenges, refresh_sessions | Identity/Self | 9.1, 9.2 | login, register | login | Auth |
| M02 | Guest transaction, OTP lookup, activation (rule 1, 12) | guestLookup*, guestTransactionsList, activationInviteSend, activationComplete | Guest, Activation | guest_contacts, customers | contact verified | 9.1 | tra cuu OTP, kich hoat | activation support | Guest/activation |
| M04 | Pet | pets*, adminCustomerPets | Pet | pets | pet.customerId; Staff qua Appointment/ServiceRecord; Manager qua Customer activity | -- | pet profile | customer detail | Authz |
| **M05** | Product & Category | categoriesList/Get/Create/Update/Archive; productsList/Get/Create/Update/Archive; productVariantsCreate/Update/Deactivate | Catalog (GLOBAL) | categories, products(variants) | GLOBAL: Admin CRUD, Manager doc, public ACTIVE | ProductStatus | catalog, product detail | product/category CRUD | Catalog |
| **M06** | Inventory | inventoryStockList, inventoryTxList, inventoryItemsList, inventoryReceive/Issue/Adjust/Transfer | Inventory ledger | inventory_items, inventory_stocks, inventory_transactions | stock/transaction.branchId; Manager assignedBranchIds | 9.11 | -- | inventory | Inventory |
| **M07** | Cart & Checkout, BF02 | cartsCreate, cartsGet, cartsAddItem, cartsUpdateItem, cartsRemoveItem, checkoutQuote, checkoutValidate, checkoutCreateOrder, vouchersValidate, settingsCommerceGet, settingsCommerceAdminGet/Update (fulfillmentBranchPriority) | Cart, Pricing, Voucher | carts, vouchers, voucher_usages, system_settings | cart owner / cartToken (khong branch scope) | -- | cart, checkout | settings | Cart, Checkout |
| **M08** | Order | ordersList/Get/Cancel/StaffCancel/Confirm/Process/Ship/MarkDelivered, paymentRecordAtStore, paymentsCancel, paymentMockComplete | Order, Payment | orders, payments | order.fulfillmentBranchId; order.customerId | 9.3, 9.4 | order history/detail, cancel | order board | Order, Payment failure |
| M09 | Return/Refund | ordersReturnableItems, ordersReturnQuote, orderReturnCreate/List/Get/Process/Receive/Approve/Reject/Cancel, orderRefundGet/Process | OrderReturn, OrderRefund | order_returns, order_refunds | orderId > Order.fulfillmentBranchId | 9.8, 9.9 | return request | return queue | Refund formula, Return |
| M10 | Voucher | vouchersValidate/List/Create/Update | Voucher (GLOBAL) | vouchers | GLOBAL: Admin ghi, Manager doc | 9.12 | voucher field | voucher CRUD | Checkout |
| M11 | Service catalog | servicesList/Get/Create/Update/Archive | Service (GLOBAL) | services | GLOBAL: Admin | ServiceStatus | service list/detail | service CRUD | Service |
| M12 | Branch & BranchServiceConfig | branches*, branchServiceConfigsList/Upsert | Branch, BranchServiceConfig | branches, branch_service_configs | BranchServiceConfig.branchId; Manager assignedBranchIds | -- | -- | branch config | Authz |
| M13 | Staff / Role / Shift | staff*, managerAssignBranches, shifts* | Staff, Shift | users, staff_profiles, shifts | shift.branchId; Manager assignedBranchIds | 9.9 shift | -- | staff, shift | Authz |
| M15 | Appointment & slot, BF04-07 | availabilityGet, appointmentsCreate (tu tim staff theo segment), **internalAppointmentsCreate**, appointmentRequests*, appointmentsConfirm (action rieng)/Reject/Reschedule/RescheduleOverride/Cancel/StoreCancel/CancelOverride/MarkNoShow/Start | Booking | appointments, slot_reservations, appointment_requests | appointment.branchId; appointment.customerId; assignedStaffId | 9.5, 9.6 | booking | appointment board, dat ho | Booking |
| M16 | Deposit/payment/refund | (payment tao trong booking tx: FULL online / DEPOSIT pay-at-store), bookingBalancePaymentCreate, paymentRecordAtStore (Appointment PAY_AT_STORE), paymentMockComplete, paymentsCancel, bookingRefund* | Payment, Deposit | payments, booking_refunds | Payment: target APPOINTMENT > Appointment.branchId | 9.4, 9.6, 9.7 | payment | refund queue | Booking |
| M17 | Service record | serviceRecords* | ServiceRecord | service_records, service_record_revisions | serviceRecord.branchId + assigned | 9.10 | xem ket qua | record | Medical |
Ngoai P0: M03 (adminCustomersList/Get/Pets, Block/Unblock Admin-only), M18 (reviews), M23 (dashboardSummary), notifications da co contract. M14, M24, M25: theo sheet la mockup/optional, khong thiet ke. M19: tham so q/filter/sort tren productsList/ordersList. M20, M21, M22: P1 ngoai critical path, chua co OpenAPI.

## Commerce E2E (M05 > M06 > M07 > M08 > Return > Refund)
| Buoc | Actor | Action | Rule/validation | State | Persistence | Authz |
|---|---|---|---|---|---|---|
| 1 | Guest/Customer | productsList/Get | chi ACTIVE; outOfStock server tinh | -- | products | public |
| 2 | Guest/Customer | cartsCreate, cartsAddItem | product ACTIVE, ton du; khong chon branch | -- | carts | owner / cartToken |
| 3 | Guest/Customer | checkoutQuote, checkoutValidate, vouchersValidate | server tinh gia, toi da 1 voucher, freeship theo cau hinh | -- | khong ghi | -- |
| 4 | Guest/Customer | checkoutCreateOrder | 1 tx: Order PENDING + consume voucher + ISSUE + Payment PENDING | PENDING | orders, ledger, payments | owner / cartToken |
| 4b | system | payment FAILED/CANCELLED/EXPIRED | compensating tx: Order CANCELLED, RECEIPT, restore voucher | CANCELLED | ledger, vouchers | system |
| 5 | Receptionist/Manager/Admin | ordersConfirm, Process, Ship | ONLINE_MOCK can payment PAID | CONFIRMED > PROCESSING > SHIPPED | orders | order.fulfillmentBranchId |
| 6 | nt | ordersMarkDelivered | ghi deliveredAt | COMPLETED | orders | nt |
| 7 | Customer/Guest | ordersReturnQuote, orderReturnCreate | 7 ngay tu deliveredAt; qty <= returnableQty; refund tinh san | REQUESTED | order_returns | Order.customerId |
| 8 | Receptionist | orderReturnProcess, orderReturnReceive | khong approve/reject | PROCESSING > RECEIVED | order_returns | orderId > Order.fulfillmentBranchId |
| 9 | Manager/Admin | orderReturnApprove / Reject | 1 cap, khong nhap tien | APPROVED / REJECTED | order_returns, order_refunds | nt |
| 10 | Manager/Admin | orderRefundProcess | mock refund | REFUNDED; return COMPLETED | order_refunds, payments | nt |

## Field traceability (moi field mot nghia)
| Field | Meaning duy nhat | Owner | DB | API |
|---|---|---|---|---|
| fulfillmentBranchId | truong van hanh server cua Order; resolver: branch ACTIVE dau tien trong fulfillmentBranchPriority du ton cho toan bo cart | server | orders.fulfillmentBranchId | Order (readOnly) |
| branchId | branch cua resource co branch (Appointment, Shift, Inventory, BranchServiceConfig) | theo resource | cac collection tuong ung | request/response |
| assignedBranchIds | scope van hanh Manager | Admin | users.assignedBranchIds | managerAssignBranches |
| serviceType | GROOMING hoac MEDICAL cua Service/Appointment | Admin | services.serviceType | Service, Appointment |
| recordType | snapshot cua serviceType trong ServiceRecord | system | service_records.recordType | ServiceRecord |
| bookingMode | BOOKABLE/REQUEST_ONLY/CONTACT_ONLY | Admin | services.bookingMode | Service |
| durationMinutes / scheduledDurationMinutes | cau hinh / tong da dat | Admin / server | services / appointments | Service / Appointment |
| requiredStaffRole | staffSubRole bat buoc cua service | Admin | services.requiredStaffRole | Service |
| depositType / depositValue | NONE hoac PERCENTAGE / 30 | Admin | services.depositConfig | Service |
| defaultMaterials | template du kien | Admin | services.defaultMaterials | Service |
| actualMaterials | luong dung thuc te (nguon tru kho) | Care/Nurse | service_records.actualMaterials | ServiceRecord |
| recordVersion | so lan finalize | server | service_records.recordVersion | ServiceRecord |
| returnableQty | orderedQty - alreadyReturnedQty | server | tinh tu orders + order_returns | ReturnableLine |
| refundAmount / refundBreakdown | phan tien thuc tra sau discount cho item/qty | server | order_returns | OrderReturn |
| payment.status / order.status | trang thai thanh toan / don hang | action | payments / orders | Payment / Order |

## Booking E2E (M11 > M12 > M13 > M15 > M16 > M17)
| Buoc | Actor | Action | Rule | State | Persistence |
|---|---|---|---|---|---|
| 1 | Guest/Customer | availabilityGet | slot kha dung chi khi moi segment (noi tiep) tim duoc staff dung requiredStaffRole; khong lo staff | -- | khong ghi |
| 2 | Guest/Customer | appointmentsCreate (paymentMethod) | khong chon staff; backend reserve staff tung segment; ONLINE_MOCK 100% va PAID ngay khi tao; PAY_AT_STORE co service bat coc thi coc 30%, khong bat coc thi khong coc | PENDING_CONFIRMATION (ONLINE_MOCK / PAY_AT_STORE khong coc) / PENDING_PAYMENT (PAY_AT_STORE co coc) | appointments, reservations, payments |
| 2b | Receptionist/Manager/Admin | internalAppointmentsCreate | dat ho; staffAssignments tuy chon; **khong CONFIRMED** | nt | nt |
| 3 | system | payment PAID | ONLINE_MOCK da PAID ngay khi create; PAY_AT_STORE co coc chi chuyen sau khi DEPOSIT PAID | PENDING_CONFIRMATION | payments |
| 4 | Receptionist/Manager/Admin | appointmentsConfirm | action rieng | CONFIRMED | appointments |
| 4b | Receptionist/Manager | appointmentSegmentReassign | trung requiredStaffRole, available | khong doi | reservations |
| 5 | staff duoc giao | appointmentsStart, serviceRecords*, finalize | sub-role + segment | IN_PROGRESS > COMPLETED | service_records, ledger |
| 6 | system / Receptionist | deposit APPLIED (system); balance (PAY_AT_STORE) paymentRecordAtStore | chi thu phan con lai (vd 700,000) | COMPLETED | payments |


## Final Task 2.8 closure notes
- TA-30 is closed and applies consistently to all prepayments.
- `CustomerDetail.accountStatus` is nullable before a User exists.
- Global Service has no branch-specific contact field; branch capacity/contact are modeled by branch resources.
- ServiceRecord is encounter-level for the Appointment; Material Catalog is seed-only.
- `PENDING_PAYMENT` and `PENDING_CONFIRMATION` both use `holdExpiresAt`; timeout cancels the target/payment as applicable and releases reservations. A system confirmation timeout with prepayment creates a full BookingRefund request regardless of elapsed-hour policy.


## Final closure requirements
| Requirement | Canonical implementation | Verification |
|---|---|---|
| Guest token security | X-Guest-Lookup-Token / X-Guest-Cart-Token security schemes | OpenAPI + auth tests |
| Booking hold timeout | holdExpiresAt on PENDING_PAYMENT/PENDING_CONFIRMATION | state machine + index/workload + tests |
| Segment execution | executionStatus on Appointment.services[] | state machine + service record tests |
| Execution role | ServiceExecutionRole | enum registry + authz + OpenAPI |
| Encounter aggregate | one ServiceRecord per Appointment | Mongo schema + execution flow |
| Exact inventory delta | overall finalize only, once per recordVersion | index + concurrency tests |
| Payment combinations | target/method/kind matrix | OpenAPI + tests |
| Final consistency | confirmation timeout with prepayment | BookingRefund 100% system-side fault | state + refund tests |
| Final consistency | Guest transaction/request ownership | X-Guest-Lookup-Token required after OTP; token-scoped lookup/actions | OpenAPI/Authz/Security |
| Final consistency | Appointment multi-segment execution | executionStatus per segment; all segments complete before overall finalize | Domain/State/OpenAPI |
| Final consistency | Payment boundaries | mock-complete only Order ONLINE_MOCK; PAY_AT_STORE at store; COD at delivery | State/OpenAPI/Test |
| Final consistency | Reservation overlap | 15-minute time units reserved across full segment range | Architecture/DB/Index |
