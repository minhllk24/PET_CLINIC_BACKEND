# 04 Domain Model v7 (scope lock)

Nguon: Team Lead/Boss decisions > Feature > Business Rule/Flow > domain consistency. Khong them feature, role, workflow ngoai Feature/Rule. Khi thieu chi tiet ky thuat: phuong an toi gian.

## Role model
`systemRole`: ADMIN, MANAGER, STAFF, CUSTOMER. `staffSubRole`: RECEPTIONIST, CARE_STAFF_GROOMER, VETERINARIAN, NURSE. `ServiceExecutionRole`: CARE_STAFF_GROOMER, NURSE, VETERINARIAN; RECEPTIONIST khong phai role thuc hien service. Khong co DOCTOR.

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
Service (Admin): name, description, `serviceType` (GROOMING|MEDICAL), durationMinutes, requiredStaffRole, bookingMode, basePrice/priceVariants, defaultMaterials, status.
BranchServiceConfig (Manager trong assignedBranchIds, Admin ALL): `enabled`, `capacity`, `availability`. Khong co deposit override. `capacity` là capacity của từng service tại từng branch; không dùng `branches.slotCapacity`. Manager khong sua Service global. Service global không chứa `branchId` trong `contactInfo`; hotline/address theo chi nhánh lấy từ Branch.
`ServiceRecord.recordType` chi la snapshot cua `services.serviceType` luc thuc hien.

## Thanh toan lich hen: ONLINE_MOCK va PAY_AT_STORE (hai luong tach biet)
| | ONLINE_MOCK | PAY_AT_STORE |
|---|---|---|
| Khach tra khi dat | **100% finalAmount** (sau voucher), `payments.kind = FULL` | **coc 30% finalAmount** de giu slot, `payments.kind = DEPOSIT` |
| Phan con lai | 0 | 70% thu tai cua hang sau khi hoan thanh, `kind = BALANCE`, Receptionist/Manager/Admin ghi nhan |
| `pricing.depositAmount` | 0 | 30% finalAmount |
| `pricing.balanceAmount` | 0 | finalAmount - depositAmount |
| Appointment sau khi tao | **PENDING_CONFIRMATION ngay sau create; Payment FULL = PAID trong cung transaction** | **PENDING_PAYMENT va cho den khi DEPOSIT PAID** |
PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.
**Ghi nhan ngay**: khi khach coc thanh cong (hoac thanh toan 100%), he thong ghi nhan `pricing.paidAmount` ngay. Vi du hoa don 1,000,000, coc 300,000 => `paidAmount = 300,000`, deposit `HELD`. Khong cho balance payment moi xac nhan deposit. Khi dich vu hoan thanh (Appointment COMPLETED), deposit chuyen `APPLIED` tu dong (system) va chi thu them 700,000 (BALANCE).
- TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

## Appointment = nhieu service segment doc lap ve Staff
Mot Appointment co mot `serviceType` (GROOMING hoac MEDICAL; GROOMING + MEDICAL => `MIXED_SERVICE_TYPES`) va cung bookingMode. Moi service trong Appointment la mot **segment** rieng: `serviceType` + `requiredStaffRole` + `durationMinutes` + `assignedStaffId` **rieng**, snapshot day du (serviceId, name, variant, unitPrice, requiredStaffRole, bookingMode, sequence, scheduledStart/End). Cac service **khong can trung requiredStaffRole** (Bath, Nail Trim co the do staff khac nhau; exam do Vet, tiem do Nurse).
- Cac segment mac dinh thuc hien **noi tiep theo thu tu** (`sequence`). `scheduledDurationMinutes = sum(durationMinutes)`.
- **Customer khong chon Staff.** Khi tao Appointment backend tu tim va reserve staff phu hop cho **tung segment**: staff co `staffSubRole` trung `requiredStaffRole` cua segment, `authorizedBranchIds` chua branch, shift phu khoang cua segment, khong trung lich khac.
- **Toan bo Appointment chi kha dung khi tat ca segment deu tim duoc staff.** Neu khong tim duoc to hop cho ca Appointment thi slot do **khong kha dung** (availability khong tra; tao => `409 SLOT_UNAVAILABLE`).
- **Doi staff**: Manager/Receptionist doi tung segment qua `appointmentSegmentReassign` sang staff **trung requiredStaffRole** va dang available (authorizedBranchIds, shift, khong trung). Khong duoc gan staff khac role chi vi con trong lich (`STAFF_ROLE_MISMATCH`; khong ranh `STAFF_UNAVAILABLE`). Khong doi trang thai Appointment.
- Giua cac service trong cung Appointment khong co rang buoc ve role: moi segment tu xac dinh staff theo `requiredStaffRole` cua minh.

## Dat lich: tu dat va dat ho; assign staff khong phai confirm
- **Customer/Guest tu dat**: `appointmentsCreate`. Chi luu DB khi bam Dat lich cuoi. Khach chon pet khac thi luu ho so pet moi. `paymentMethod` bat buoc: ONLINE_MOCK hoac PAY_AT_STORE (khong COD).
- **Dat ho (noi bo)**: `internalAppointmentsCreate`, Receptionist / Manager / Admin theo branch. `customerId` **hoac** `contact` (Guest), khong ca hai; khong tao account cho Guest. Staff duoc backend tu tim, hoac chi dinh tuy chon qua `staffAssignments` (tung segment). Cho BOOKABLE va REQUEST_ONLY (da xu ly yeu cau); CONTACT_ONLY khong tao.
- **Assign staff khong dong nghia CONFIRMED.** Sau khi tao (tu dat, dat ho, hoac duyet request), Appointment van o `PENDING_PAYMENT` hoac `PENDING_CONFIRMATION`; **phai co action `appointmentsConfirm` rieng** (Receptionist/Manager/Admin) de sang `CONFIRMED`. Viec chon staff chi la phan cong nguoi thuc hien.
- Availability: Branch opening + holiday + BranchServiceConfig (enabled, capacity) + tong duration theo segment noi tiep + staff theo tung segment + appointments hien co. Double booking: tx + unique reservation tren staff va capacity + Idempotency-Key. `PENDING_PAYMENT` va `PENDING_CONFIRMATION` phai co `holdExpiresAt`; het han thi Appointment `CANCELLED`, Payment PENDING -> CANCELLED neu co, va release toan bo reservation. `booking.holdDurationMinutes` la technical config (default 10), khong phai business override.

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
OrderReturn (hang) tach OrderRefund (tien, tao khi APPROVED; refund mock PENDING > REFUNDED, return COMPLETED) tach BookingRefund (hoan khoan tra truoc). Nhan hang tra khong tu dong doi ton kho; nhap lai kho di qua `inventoryReceive`.

**Material Catalog:** `inventory_items` loại MATERIAL là **seed-only** trong Web 2; không mở CRUD Material riêng. Admin dùng material seed để cấu hình `defaultMaterials` của Service.

## Inventory
Nguon su that cua bien dong ton: `inventory_transactions` (append-only: RECEIPT, ISSUE, ADJUSTMENT, TRANSFER). `inventory_stocks.quantity` la projection, khong ghi truc tiep. Manager quan ly trong assignedBranchIds; Staff chi doc/consumption theo role. Pham vi chi gom bon loai giao dich tren, mot vi tri ton kho moi branch.

## ServiceRecord (staff = bat ky staff nao duoc giao mot segment cua Appointment)
Trong Web 2, ServiceRecord là **encounter-level aggregate của toàn Appointment**, không tách record riêng theo từng service segment; `actualMaterials[]` là tổng vật liệu của ca. Quyền cập nhật vẫn dựa role + assignment của staff trên các segment.
GROOMING: Care Staff (actual materials) > finalize. MEDICAL: Nurse (work, actual materials) > submit > WAITING_VET_REVIEW > Veterinarian (diagnosis/treatment/result) > FINALIZED. Nurse khong finalize. Reopen: moi lan finalize tao revision (`recordVersion`, `previousActual`, `newActual`, `delta = newActual - previousActual`, actor, reason, at); delta>0 ISSUE -delta; delta<0 hoan +abs(delta) (ADJUSTMENT); ledger cu khong sua/xoa. Vi du 5>3: +2; 5>8: ISSUE -3.

## Tien (integer VND)
Appointment: subtotal, voucherDiscount, finalAmount, depositAmount (30%, chi PAY_AT_STORE), balanceAmount, paidAmount (ghi nhan ngay khi tra truoc thanh cong). Order: merchandiseSubtotal, voucherDiscount, shippingFee, totalAmount. Lam tron half up 1 VND.

## Glossary (muc thay doi)
| Term | Dinh nghia | Owner |
|---|---|---|
| serviceType | GROOMING hoac MEDICAL cua Service/Appointment | Admin |
| recordType | snapshot cua serviceType trong ServiceRecord | system |
| BranchServiceConfig | enabled, capacity, availability cua service tai branch | Manager (assigned) |
| fulfillmentBranchId | truong van hanh server cua Order | server |
| lineNet | so tien thuc tra cho dong Order sau discount | order |
| OrderReturn / OrderRefund / BookingRefund | tra hang / hoan tien don / hoan khoan tra truoc lich hen | order, refund |
| Customer activity | Order/Appointment lien ket Customer voi branch | derived |


## Execution role invariants
- `Service.requiredStaffRole` dung `ServiceExecutionRole`, khong dung `StaffSubRole` tong quat.
- MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.
- `Appointment.services[].executionStatus`: `NOT_STARTED -> IN_PROGRESS -> COMPLETED`; segment completion khong tao inventory ledger cho den khi overall encounter finalize.

## Timeout and refund consistency
- Both `PENDING_PAYMENT` and `PENDING_CONFIRMATION` use `holdExpiresAt`; HELD reservations mirror the same deadline.
- `PENDING_PAYMENT` timeout cancels the unpaid prepayment and appointment with no refund amount because nothing was paid.
- `PENDING_CONFIRMATION` timeout is a system-side failure: if any prepayment exists, create BookingRefund REQUESTED for 100% of the prepayment; if none exists, no refund document is created.
- OrderRefund provider failure reuses the same refund document for retry; no second refund document is created for the same return.

## Segment execution invariant
- Một Appointment có nhiều segment tuần tự; mỗi segment có `executionStatus`, `assignedStaffId`, `scheduledStart/End`.
- `NOT_STARTED -> IN_PROGRESS -> COMPLETED`; segment sau chỉ start khi segment trước COMPLETED.
- `ServiceRecord` vẫn là **một encounter-level aggregate / Appointment**. `actualMaterials` là aggregate; ServiceRecord không tách theo segment.
- Appointment chỉ COMPLETED sau khi mọi segment COMPLETED và ServiceRecord overall FINALIZED.

## V7 correction contract

PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.

TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.

Product global chỉ Admin CRUD, không nhập stock trong Product form. Stock mặc định 0 (row có thể lazy-created); initial stock qua RECEIPT reason INITIAL_STOCK. Procurement/PO/supplier approval ngoài scope. Quantity chỉ đổi qua ledger transaction; threshold nằm ở inventory_stocks theo (branchId, inventoryItemId), default 0; Manager assigned branches/Admin ALL cập nhật threshold, không tạo movement stock. Transfer Manager cần cả hai branch trong scope.
