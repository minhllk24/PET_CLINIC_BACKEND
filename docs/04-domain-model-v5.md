# 04 Domain Model v5 (scope lock)

Nguon: Team Lead/Boss decisions > Feature > Business Rule/Flow > domain consistency. Khong them feature, role, workflow ngoai Feature/Rule. Khi thieu chi tiet ky thuat: phuong an toi gian.

## Role model
`systemRole`: ADMIN, MANAGER, STAFF, CUSTOMER. `staffSubRole`: RECEPTIONIST, CARE_STAFF_GROOMER, VETERINARIAN, NURSE. Khong co DOCTOR.

## Branch fields (moi field mot nghia)
| Field | Nghia |
|---|---|
| `staff_profiles.homeBranchId` | hien thi, khong dung cho availability |
| `staff_profiles.authorizedBranchIds[]` | Staff duoc lam o branch nao |
| `shifts.branchId` | branch cua ca lam, nguon thuc cho availability |
| `users.assignedBranchIds[]` | scope van hanh cua Manager (rong = khong quyen) |
| `appointments.branchId` | branch cua lich hen |
| `inventory_stocks.branchId`, `inventory_transactions.branchId` | branch cua ton kho |
| `orders.fulfillmentBranchId` | **truong van hanh do server gan** luc checkout bang `FulfillmentBranchResolver` (xem muc Fulfillment), dung de tru ton va xac dinh scope xu ly don. Customer khong chon |
Customer, Pet, Product, Category, Service (global), Voucher, Payment, Cart: **khong co truong branch**. Scope branch cua chung duoc suy ra qua Resource Scope Resolver (08).

## Customer la global entity
Customer khong co truong branch. Manager xem Customer qua activity: Order.fulfillmentBranchId / Appointment.branchId thuoc `assignedBranchIds`. `customers.activityBranchIds[]` chi la projection do server cap nhat de truy van nhanh, khong phai quan he branch cua Customer va khong ai ghi. Chi Admin Block/Unblock (global, reason, audit); Manager khong. Khong them blacklist hay han che nao khac.
activationStatus: NO_ACCOUNT > PENDING_ACTIVATION > ACTIVATED. accountStatus: ACTIVE | BLOCKED. `lastLogin` chi khi login thanh cong.

## Du lieu global va du lieu branch
Global (Admin ghi, Manager chi doc): Product, Category, Service Catalog, Voucher. Branch (Manager thao tac trong `assignedBranchIds`): Inventory Stock/Transaction, BranchServiceConfig, Shift, Appointment, du lieu van hanh branch.

## Service Catalog va BranchServiceConfig
Service (Admin): name, description, `serviceType` (GROOMING|MEDICAL), durationMinutes, requiredStaffRole, bookingMode, basePrice/priceVariants, defaultMaterials, depositConfig, status.
BranchServiceConfig (Manager trong assignedBranchIds, Admin ALL): `enabled`, `capacity`, `availability`. Khong co deposit override. Manager khong sua Service global.
`ServiceRecord.recordType` chi la snapshot cua `services.serviceType` luc thuc hien.

## Deposit (khoa cung)
Service bat deposit: `depositType = PERCENTAGE`, `depositValue = 30`. Tat deposit: `NONE`. Chi mot gia tri co dinh, ap dung dong nhat cho moi branch va moi service co bat coc. Tinh: service price > voucher/discount > `finalAmount` > `depositAmount = round(finalAmount * 30 / 100)`. Vi du final 1,000,000 > coc 300,000, balance 700,000. Appointment co nhieu service: deposit ap dung tren **toan Appointment** neu co it nhat mot service bat deposit. Khi COMPLETED deposit APPLIED, tru vao tong.

## Multi-service appointment
Mot Appointment: mot `serviceType`, nhieu `services[]` cung serviceType va **cung requiredStaffRole**; khac => `422 INCOMPATIBLE_STAFF_ROLES` + `suggestedGroups` de dat thanh cac lich doc lap/lien ke. GROOMING + MEDICAL khong hop le (`MIXED_SERVICE_TYPES`). Cung bookingMode. `scheduledDurationMinutes = sum(durationMinutes)`. Moi dong snapshot serviceId, name, serviceType, variant, unitPrice, durationMinutes, requiredStaffRole, bookingMode, depositConfig.
Customer khong chon Staff cu the; he thong/Manager gan.

## Dat lich: tu dat va dat ho
- **Customer/Guest tu dat**: `appointmentsCreate`. Chi luu DB khi khach bam Dat lich cuoi. Khach chon pet khac thi luu ho so pet moi. Payment: ONLINE_MOCK hoac PAY_AT_STORE (khong COD).
- **Dat ho (noi bo)**: `internalAppointmentsCreate`, Receptionist (authorizedBranchIds) / Manager (assignedBranchIds) / Admin (ALL). Chon **mot trong hai**: `customerId` (Customer co san) hoac `contact` phone/email (Guest). Khong tao account/mat khau cho Guest. Cho BOOKABLE va REQUEST_ONLY (da xu ly yeu cau); CONTACT_ONLY khong tao. Request schema tach rieng khoi tu dat de khong lan lon authorization; actor va source do server gan.
- Availability: Branch opening + holiday + BranchServiceConfig + tong duration + requiredStaffRole + Staff Shift + appointments hien co + capacity. Chong double booking: tx + conditional write + unique reservation + Idempotency-Key.

## Commerce P0: Product > Cart > Checkout > Order > Return > Refund
- **Product/Category**: global, Admin CRUD (gom variant), Manager doc, public chi thay ACTIVE. `outOfStock` do server tinh (tong ton kha dung = 0). Khong tinh ton theo branch tren public API.
- **Cart** (khong co branch): Customer: cart cua minh. Guest: `cartToken`. Cart khong mang thong tin branch va Customer khong lua chon branch nao.
- **Checkout**: `checkoutQuote`, `checkoutValidate`, `checkoutCreateOrder`. Backend tinh lai gia, validate voucher (toi da 1), validate ton. Khong giu ton luc mo checkout. Shipping: 0 neu (merchandiseSubtotal - voucherDiscount) >= freeShippingThreshold (cau hinh Admin, mac dinh 500000), nguoc lai shippingFlatFee (cau hinh, khong phai business rule moi).
- **Tao Order (1 transaction)**: Order PENDING + pricing + consume voucher + ISSUE inventory + Payment PENDING. Order snapshot moi dong: `orderedQty`, `returnedQty`, `lineSubtotal`, `allocatedDiscount`, `lineNet` (= so tien thuc tra cua dong).
- **Payment that bai (ONLINE_MOCK)**: FAILED, CANCELLED hoac EXPIRED => compensating transaction: Order CANCELLED, ledger RECEIPT hoan ton, restore voucher quota, Payment o trang thai terminal. Idempotent (callback lap lai khong hoan ton 2 lan). Timeout ONLINE_MOCK tu huy (thoi han la cau hinh ky thuat). Khong co retry thanh toan, khong queue, khong doi soat.
- **Order**: PENDING > CONFIRMED > PROCESSING > SHIPPED > COMPLETED; PENDING/CONFIRMED > CANCELLED (Customer); Staff huy den PROCESSING. Order ONLINE_MOCK chi confirm khi payment PAID. COD: payment PAID khi Mark Delivered. Receptionist/Manager/Admin van hanh trong scope.
- **Guest**: khong account/mat khau; tra cuu bang OTP.

## Fulfillment branch (FulfillmentBranchResolver, dong blocker FULFILLMENT_BRANCH_SOURCE)
Quy tac xac dinh branch tru ton va xu ly Order, deterministic, khong can geolocation hay delivery zone:
1. Admin cau hinh `system_settings.commerce.fulfillmentBranchPriority = [branchA, branchB, ...]` (danh sach branch theo uu tien).
2. Luc checkout, resolver duyet danh sach theo thu tu, **chi xet branch ACTIVE**. Branch **dau tien du ton cho TOAN BO cart** (moi dong du so luong tai chinh branch do) duoc gan vao `Order.fulfillmentBranchId`.
3. Khong tach don. Khong branch nao du => `422 INSUFFICIENT_INVENTORY`. Danh sach rong => `422 FULFILLMENT_NOT_CONFIGURED`.
4. Neu conditional decrement that bai do dua tranh, thu branch ke tiep theo thu tu trong cung lan checkout.
5. Vi du: Q10 co 3, Q7 co 3, khach mua 5: tong ton = 6 nhung khong branch nao du 5 => khong fulfill duoc (checkoutValidate tra `fulfillable=false`, `NOT_FULFILLABLE_BY_SINGLE_BRANCH`).
Nguon goc: de xuat cua review feedback; Boss/Team Lead co the doi danh sach, khong doi quy tac.

## Lop validation cua Cart va Checkout
- `cartsAddItem` / `cartsUpdateItem`: chi kiem tra product/variant purchasable (ACTIVE) va ton **tong quat** (tong ton cac branch >= so luong). Khong kiem tra branch.
- `checkoutValidate` / `checkoutQuote`: chay resolver, tra `fulfillable` va `fulfillmentIssue`. Day la noi kiem tra branch that.
- `checkoutCreateOrder`: chay resolver va tru ton tai branch duoc chon trong cung transaction.

## Return / Refund
`deliveredAt` ghi khi nhan vien bam Mark Delivered; han tra: `now <= deliveredAt + 7 ngay` (`RETURN_WINDOW_EXPIRED`). `returnableQty = orderedQty - alreadyReturnedQty` (server tinh), `0 < requestedQty <= returnableQty` (`RETURN_QTY_EXCEEDS_RETURNABLE`).
Trang thai: **REQUESTED > PROCESSING > RECEIVED > APPROVED > COMPLETED**; REJECTED tu PROCESSING (va tu RECEIVED, vi Manager/Admin ra quyet dinh cuoi sau khi nhan hang, TA-24). **Reject sau khi da RECEIVED: khong refund, khong nhap stock; hang tra lai cho Customer duoc xu ly thu cong, ngoai he thong (out-of-system).** Khong tao OrderRefund. `APPROVED` nghia la Manager/Admin da final approve sau khi Receptionist da nhan/kiem tra hang.
Quyen: Customer/Guest tao va xem; **Receptionist: process, receive (khong approve/reject)**; **Manager/Admin: approve, reject (mot cap)**.
**Refund = phan tien thuc te Customer da tra cho item/quantity do sau discount**. `refundLine = round(lineNet * q / orderedQty)`; lan tra cuoi cua dong: `lineNet - refundedSoFar`. `total = sum`. Shipping khong hoan. Server tinh; Manager khong nhap tay. `ordersReturnQuote` cho xem truoc. Vi du: 2 san pham 100k, line net 180k, tra 1/2 => 90,000. Phan bo voucher: theo ty le `lineSubtotal` luc tao don, largest remainder (voucher PRODUCT chi phan bo cho dong san pham ap dung, TA-20).
OrderReturn (hang) tach OrderRefund (tien, tao khi APPROVED; refund mock PENDING > REFUNDED, return COMPLETED) tach BookingRefund (hoan coc). Nhan hang tra khong tu dong doi ton kho; nhap lai kho di qua `inventoryReceive`.

## Inventory
Nguon su that cua bien dong ton: `inventory_transactions` (append-only: RECEIPT, ISSUE, ADJUSTMENT, TRANSFER). `inventory_stocks.quantity` la projection, khong ghi truc tiep. Manager quan ly trong assignedBranchIds; Staff chi doc/consumption theo role. Pham vi chi gom bon loai giao dich tren, mot vi tri ton kho moi branch.

## ServiceRecord
GROOMING: Care Staff (actual materials) > finalize. MEDICAL: Nurse (work, actual materials) > submit > WAITING_VET_REVIEW > Veterinarian (diagnosis/treatment/result) > FINALIZED. Nurse khong finalize. Reopen: moi lan finalize tao revision (`recordVersion`, `previousActual`, `newActual`, `delta = newActual - previousActual`, actor, reason, at); delta>0 ISSUE -delta; delta<0 hoan +abs(delta) (ADJUSTMENT); ledger cu khong sua/xoa. Vi du 5>3: +2; 5>8: ISSUE -3.

## Tien (integer VND)
Appointment: subtotal, voucherDiscount, finalAmount, depositAmount, balanceAmount. Order: merchandiseSubtotal, voucherDiscount, shippingFee, totalAmount. Lam tron half up 1 VND.

## Glossary (muc thay doi)
| Term | Dinh nghia | Owner |
|---|---|---|
| serviceType | GROOMING hoac MEDICAL cua Service/Appointment | Admin |
| recordType | snapshot cua serviceType trong ServiceRecord | system |
| BranchServiceConfig | enabled, capacity, availability cua service tai branch | Manager (assigned) |
| fulfillmentBranchId | truong van hanh server cua Order | server |
| lineNet | so tien thuc tra cho dong Order sau discount | order |
| OrderReturn / OrderRefund / BookingRefund | tra hang / hoan tien don / hoan coc | order, refund |
| Customer activity | Order/Appointment lien ket Customer voi branch | derived |
