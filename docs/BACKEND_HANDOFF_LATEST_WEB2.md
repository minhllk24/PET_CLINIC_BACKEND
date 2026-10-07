# WEB 2 — BACKEND HANDOFF & CANONICAL BUSINESS LOGIC
## Bản tổng hợp mới nhất để Backend/AI Backend đối chiếu implementation

> **Mục tiêu của file này**
>
> File này dành cho một người/AI Backend **mới hoàn toàn**, không biết các đoạn chat trước. Nó tổng hợp những quyết định nghiệp vụ, thiết kế dữ liệu, authorization, state machine, payment, booking, kho và Service Record đã được thảo luận/chốt trong quá trình review Task 2.8.
>
> Hãy dùng tài liệu này như **handoff + checklist đối chiếu code hiện tại**. Nếu code backend khác tài liệu này, **đừng tự sửa âm thầm**: hãy đánh dấu mismatch, ghi impact và hỏi Team Lead/Product Owner khi mismatch liên quan business rule.
>
> **Phạm vi:** Web 2 — Customer/Admin/Staff/Manager + commerce + booking/service + inventory + mock payment/refund.
>
> **Lưu ý:** đây là **contract/design handoff**, không phải bằng chứng runtime. Các invariant bên dưới vẫn phải được chứng minh bằng test khi code được triển khai.

---

# 1. Bức tranh tổng thể

Kiến trúc target đơn giản:

```text
Customer/Admin Angular
        |
        v
NodeJS / Express REST API
        |
        +---- MongoDB
        |
        +---- Email/SMS/OTP provider (nếu khả thi)
        |
        +---- Payment MOCK (không dùng gateway thật)
```

Các nguyên tắc lớn:

- Backend là **source of truth** cho:
  - authorization;
  - branch scope;
  - giá;
  - voucher;
  - payment state;
  - inventory;
  - appointment state;
  - service execution;
  - refund;
  - fulfillment branch;
  - material consumption.
- Không tin dữ liệu authority do FE gửi, ví dụ:
  - `actorId`;
  - `actorRole`;
  - `approvedBy`;
  - `branchScope`;
  - `paymentStatus`;
  - `orderStatus`;
  - `accountStatus`;
  - staff ngoài quyền;
  - giá/discount/refund amount tự tính từ client.
- Các business state-changing POST cần **idempotency**.
- Các operation sửa record nhạy cảm phải dùng **optimistic concurrency / version check**.

---

# 2. Actor và role canonical

## 2.1 Guest

Guest:

- không có User account;
- có thể mua hàng/đặt/request lịch theo flow Guest;
- có `guest_contact`;
- không được tự động tạo account sau giao dịch;
- chỉ truy cập transaction của chính mình sau OTP verify.

Hai token Guest khác nhau:

### `X-Guest-Lookup-Token`

Dùng cho:

- tra transaction Guest;
- xem/cancel/reschedule appointment Guest;
- xem payment/refund/return thuộc Guest;
- xem/cancel AppointmentRequest Guest.

Token này:

- cấp sau OTP verify;
- short-lived;
- không phải JWT Staff/Customer;
- chỉ chứng minh ownership của Guest contact đã verify;
- không bao giờ grant quyền nội bộ.

### `X-Guest-Cart-Token`

Dùng riêng cho:

- guest cart;
- guest checkout.

Không dùng Guest Lookup Token thay Cart Token và ngược lại.

---

## 2.2 Customer

Customer là người có account đã activate.

Customer chỉ được:

- quản lý profile của mình;
- pet của mình;
- cart/order của mình;
- appointment/request của mình;
- refund/return của transaction mình;
- review/notification của mình.

**Không có `Customer.branchId`.**

Customer được xem là liên quan đến branch dựa trên **activity**:

- `Order.fulfillmentBranchId`;
- `Appointment.branchId`.

---

## 2.3 Staff

Staff có `staffSubRole`.

Canonical staff sub-role:

```text
RECEPTIONIST
CARE_STAFF_GROOMER
VETERINARIAN
NURSE
```

Nhưng **không được dùng toàn bộ StaffSubRole làm execution role**.

---

## 2.4 ServiceExecutionRole

Role có thể thực hiện một service segment chỉ gồm:

```text
CARE_STAFF_GROOMER
NURSE
VETERINARIAN
```

`RECEPTIONIST` **không phải ServiceExecutionRole**.

Đây là điểm rất quan trọng.

Backend không được cho phép:

```text
Service.requiredStaffRole = RECEPTIONIST
```

---

## 2.5 Receptionist

Receptionist:

- vận hành appointment/order ở branch được phép;
- confirm/reject/cancel tại cửa hàng theo permission;
- process/receive return;
- có thể đặt lịch hộ;
- không quản lý global catalog;
- không được finalize medical;
- không phải execution role của Service.

---

## 2.6 Care Staff / Groomer

Groomer:

- thực hiện GROOMING segment được assign;
- update actual material cho GROOMING;
- finalize GROOMING segment theo workflow.

---

## 2.7 Nurse

Nurse:

- thực hiện MEDICAL segment được assign;
- nhập actual materials cho MEDICAL;
- có thể submit segment cho Vet review;
- **không finalize Medical encounter một mình**.

---

## 2.8 Veterinarian

Veterinarian:

- thực hiện MEDICAL;
- ghi diagnosis/treatment/result/professional note;
- review/finalize MEDICAL encounter theo rule.

Một Appointment MEDICAL phải có **ít nhất một segment VETERINARIAN** để đảm bảo có luồng professional review/finalization.

---

## 2.9 Manager

Manager có:

```text
assignedBranchIds[]
```

Manager:

- quản lý vận hành branch được assign;
- xem customer có activity trong branch;
- quản lý tồn kho branch;
- approve/reject return/refund theo scope;
- reopen ServiceRecord trong branch;
- không tự động có quyền sửa global master data.

---

## 2.10 Admin

Admin:

- toàn hệ thống;
- quản lý global master data;
- block/unblock Customer;
- quản lý setting global;
- có quyền cross-branch.

---

# 3. Global data vs Branch data

Đây là một decision rất quan trọng.

## 3.1 Global master data

Các entity sau là **global**:

- Product;
- Category;
- Service;
- Voucher/Promotion.

Quyền:

```text
Admin    -> write
Manager  -> read
Public/Customer -> read phần ACTIVE phù hợp
```

Manager branch **không sửa global Product/Category/Service/Voucher**.

Lý do:

> nếu Manager sửa master data global thì thay đổi sẽ ảnh hưởng toàn hệ thống.

---

## 3.2 Branch-level configuration

Dữ liệu theo branch được tách riêng.

Ví dụ Service:

```text
Service (global)
    |
    +-- BranchServiceConfig
          branchId
          serviceId
          enabled
          capacity
          availability...
```

Không để:

```text
Service.contactInfo.branchId
```

Không để:

```text
Branch.slotCapacity
```

Capacity của service nằm ở:

```text
BranchServiceConfig
```

---

# 4. Product và Inventory — phải tách master data khỏi tồn kho

## 4.1 Product

Admin tạo Product global:

```text
Product
- name
- SKU
- category
- description
- images
- variants
- global status
...
```

Manager chỉ đọc Product master.

---

## 4.2 Inventory theo branch

Manager quản lý tồn kho branch mình.

Ví dụ:

> Royal Canin Poodle 2kg là Product global do Admin tạo.
>
> Branch Q10 nhận 20 bao hàng thực tế.
>
> Manager Q10 ghi Inventory RECEIPT +20.

Manager **không gõ trực tiếp**:

```text
currentQty = 20
```

Tất cả biến động phải qua ledger/transaction.

Canonical transaction types gồm:

```text
RECEIPT
ISSUE
ADJUSTMENT
TRANSFER
```

`TRANSFER` ở đây là **inventory transfer**, vẫn hợp lệ.

Đừng nhầm với booking-money-transfer — booking money transfer đã bỏ.

---

## 4.3 Procurement nằm ngoài scope

Ai quyết định:

> Q10 sẽ nhận 20 Royal Canin?

Trong scope hiện tại, quyết định đó có thể là:

```text
out-of-system procurement / quản lý vận hành
```

Web 2 không cần xây Purchase Order / Supplier Procurement module.

Backend chỉ cần ghi nhận **movement đã xảy ra**.

---

# 5. Material Catalog

Material Catalog là:

> **seed-only**

Không phải một module CRUD riêng.

Ý nghĩa:

- backend có các material/inventory item seed để service reference;
- `Service.defaultMaterials` trỏ tới các item đó;
- không xây luồng Material Catalog CRUD phức tạp riêng.

Material vẫn tham gia Inventory Ledger.

---

# 6. Service Catalog

## 6.1 Service fields chính

Một Service cần các field kiểu:

```text
serviceType
bookingMode
durationMinutes
requiredStaffRole
defaultMaterials[]
depositRequired
...
```

---

## 6.2 `serviceType`

Canonical:

```text
GROOMING
MEDICAL
```

`Service.serviceType` là source of truth.

Trong ServiceRecord:

```text
recordType
```

là **snapshot** của Service.serviceType tại thời điểm thực hiện.

Không dùng `recordType` thay `serviceType` trong Service/Appointment.

---

## 6.3 `requiredStaffRole`

Phải dùng:

```text
ServiceExecutionRole
```

Không dùng generic StaffSubRole.

Rule:

```text
GROOMING -> CARE_STAFF_GROOMER
MEDICAL  -> NURSE hoặc VETERINARIAN
```

Receptionist không được xuất hiện.

---

## 6.4 Booking mode

Service có thể có các booking mode kiểu:

```text
BOOKABLE
REQUEST_ONLY
CONTACT_ONLY
```

Ý nghĩa:

### BOOKABLE

Customer/Guest có thể đặt trực tiếp.

### REQUEST_ONLY

Customer gửi request.

Staff review rồi approve/reject.

### CONTACT_ONLY

Không tạo appointment trực tiếp.

Dùng cho case không hợp lý khi đặt trước online.

Ví dụ đã thống nhất theo hướng:

- emergency/cấp cứu không phải online booking bình thường;
- surgery/phẫu thuật không được coi như service tự đặt online đơn giản.

Không mở rộng surgery workflow trong Web 2 core.

---

# 7. Multi-service Appointment — logic mới nhất

Đây là một trong những thay đổi quan trọng nhất.

## 7.1 Một Appointment được nhiều Service

Cho phép:

```text
Appointment
  services[
    service A
    service B
    service C
  ]
```

Nhưng tất cả phải:

```text
cùng serviceType
```

Ví dụ hợp lệ:

```text
MEDICAL + MEDICAL + MEDICAL
```

hoặc:

```text
GROOMING + GROOMING
```

Không hợp lệ:

```text
MEDICAL + GROOMING
```

---

## 7.2 Không bắt cùng requiredStaffRole

Decision cũ từng có hướng:

> các service trong một appointment phải cùng requiredStaffRole.

Decision đó **đã bỏ**.

Ví dụ hợp lệ:

```text
MEDICAL service A -> VETERINARIAN
MEDICAL service B -> NURSE
MEDICAL service C -> VETERINARIAN
```

Không cần tách thành nhiều Appointment chỉ vì role khác nhau.

---

## 7.3 Mỗi Service là một segment

Appointment phải model thành sequence.

Ví dụ:

```text
Appointment.services[] = [
  {
    serviceId,
    durationMinutes,
    requiredStaffRole,
    assignedStaffId,
    sequence,
    scheduledStart,
    scheduledEnd,
    executionStatus
  }
]
```

Canonical execution status:

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
```

---

## 7.4 Appointment chỉ COMPLETED khi toàn bộ segment xong

Sai:

```text
segment 1 finalize
=> Appointment COMPLETED
```

Đúng:

```text
segment 1 COMPLETED
segment 2 COMPLETED
segment 3 COMPLETED
ServiceRecord overall finalized
=> Appointment COMPLETED
```

---

## 7.5 Staff assignment

Customer/Guest:

> không chọn staff.

Backend tự tìm staff phù hợp dựa trên:

- branch;
- staff role;
- shift;
- availability;
- overlap;
- segment schedule.

Internal booking:

Receptionist/Manager/Admin có thể gửi `staffAssignments` nếu muốn.

Nhưng:

- role phải đúng;
- staff phải available;
- staff assignment **không làm Appointment tự CONFIRMED**.

---

# 8. Booking availability và reservation

## 8.1 Slot granularity

Technical default:

```text
slotMinutes = 15
```

Một segment 60 phút phải reserve:

```text
4 time units
```

Ví dụ:

```text
10:00
10:15
10:30
10:45
```

Không chỉ unique theo segment start.

Nếu chỉ unique:

```text
(staffId, scheduledStart)
```

thì sẽ lọt overlap.

Do đó reservation phải dựa trên:

```text
slotStartUnit
```

---

## 8.2 Reservation types

Có thể có:

```text
STAFF
CAPACITY
```

STAFF:

```text
staffId + slotStartUnit
```

CAPACITY:

```text
branchId + serviceId + slotStartUnit + unitIndex
```

---

## 8.3 HELD và CONFIRMED reservation

Trong khi Appointment chưa confirm:

```text
reservation.status = HELD
```

sau confirm:

```text
reservation.status = CONFIRMED
expiresAt = null
```

---

# 9. Booking hold / timeout

Cả hai state:

```text
PENDING_PAYMENT
PENDING_CONFIRMATION
```

đều phải có:

```text
holdExpiresAt
```

Technical default hiện dùng hướng:

```text
holdDurationMinutes = 10
```

nhưng đây là technical config, không phải business override per service.

HELD reservations:

```text
slot_reservations.expiresAt
=
appointments.holdExpiresAt
```

Không tạo hai deadline độc lập.

---

## 9.1 Timeout PENDING_PAYMENT

Trường hợp:

```text
PAY_AT_STORE
có deposit
Payment vẫn chưa PAID
```

Hết hạn:

```text
Payment PENDING -> CANCELLED/EXPIRED
Appointment -> CANCELLED
release reservations
```

Không giữ slot vô hạn.

---

## 9.2 Timeout PENDING_CONFIRMATION

Nếu hết hold trước khi cửa hàng confirm:

```text
Appointment -> CANCELLED
release reservations
```

Nếu đã có prepayment:

> system-side failure → hoàn 100% khoản trả trước.

Không áp dụng rule “khách hủy trễ” cho system timeout.

---

# 10. Appointment state — cách hiểu backend

Core state nên phản ánh:

```text
PENDING_PAYMENT
PENDING_CONFIRMATION
CONFIRMED
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW (nếu enum hiện có)
```

Các transition quan trọng:

```text
create ONLINE_MOCK
-> PENDING_CONFIRMATION

create PAY_AT_STORE + deposit
-> PENDING_PAYMENT

deposit paid
-> PENDING_CONFIRMATION

create PAY_AT_STORE không deposit
-> PENDING_CONFIRMATION

confirm
-> CONFIRMED

start first segment
-> IN_PROGRESS

all segments completed + ServiceRecord finalized
-> COMPLETED
```

---

# 11. AppointmentRequest

Dùng cho service:

```text
REQUEST_ONLY
```

Lifecycle canonical:

```text
SUBMITTED
-> UNDER_REVIEW
-> APPROVED

hoặc

-> REJECTED

Customer/Guest có thể CANCELLED khi request chưa terminal
```

Backend cần hỗ trợ tối thiểu:

- create;
- list;
- get;
- cancel;
- approve;
- reject.

Approve:

> tạo Appointment theo payment/staff rule.

Approve **không tự CONFIRMED**.

---

# 12. Reschedule và policy cũ

Có một policy text cũ từng ghi:

- reschedule tối đa 2 lần;
- báo trước 3 giờ;
- cancel trước 24 giờ.

Nhưng chính chủ đã nói:

> các rule reschedule/cancel đó ban đầu chỉ đang ghi trên policy, **chưa được áp rule ở FE/BE**, nên không nên tự coi policy text cũ là implementation truth.

Vì vậy:

> **Không tự hard-code 2 lần / 3 giờ chỉ vì thấy policy cũ.**

Nếu code hiện tại có rule reschedule window cụ thể, AI Backend phải:

1. đối chiếu OpenAPI/state contract mới nhất;
2. nếu không có decision owner rõ → flag để xác nhận;
3. không suy diễn từ policy website cũ.

Rule refund 24h bên dưới là decision riêng đã được chốt cho tiền.

---

# 13. Payment — toàn bộ là MOCK

Không dùng payment gateway thật.

Canonical implementation:

```text
Payment provider execution = MOCK
```

Nhưng:

- state;
- transition;
- idempotency;
- refund;
- cancel;
- failure compensation;

phải làm đúng như hệ thống thật.

---

# 14. Appointment payment

## 14.1 ONLINE_MOCK

Customer chọn:

```text
ONLINE_MOCK
```

=> thanh toán:

```text
100% finalAmount
```

ngay lúc create Appointment.

Trong cùng logical transaction:

```text
Payment kind = FULL
Payment = PAID
Appointment = PENDING_CONFIRMATION
```

Không tạo một màn/process PENDING_PAYMENT giả cho ONLINE_MOCK.

---

## 14.2 PAY_AT_STORE

Có hai trường hợp.

### Có service yêu cầu deposit

Deposit:

```text
30%
```

hard-lock.

Công thức:

```text
depositAmount
=
30% * finalAmount
```

Trong đó:

```text
finalAmount = amount sau voucher
```

Deposit được áp cho **Appointment tổng**, không tính max candidate từng service.

Không còn:

```text
FIXED
PERCENTAGE override
NONE override
branch override
service override %
```

Tắt deposit bằng:

```text
depositRequired = false
```

chứ không thay %.

---

### Không service nào yêu cầu deposit

```text
deposit = 0
```

Appointment vào:

```text
PENDING_CONFIRMATION
```

và customer trả:

```text
100% tại cửa hàng
```

sau đó.

---

## 14.3 Balance

Nếu deposit 30%:

```text
balance = 70%
```

Nếu không deposit:

```text
balance = 100%
```

PAY_AT_STORE được ghi nhận ở cửa hàng.

---

# 15. Payment endpoint boundaries

Đây là check rất quan trọng.

## `paymentMockComplete`

Chỉ dùng cho:

```text
Order + ONLINE_MOCK
```

Không dùng cho Appointment ONLINE_MOCK vì Appointment Online đã PAID lúc create.

Không dùng cho:

```text
PAY_AT_STORE
COD
```

---

## `paymentRecordAtStore`

Chỉ dùng cho:

```text
Appointment
method = PAY_AT_STORE
kind = DEPOSIT hoặc BALANCE
```

---

## COD

Order COD:

```text
Payment = PAID
```

chỉ khi:

```text
Order = DELIVERED
```

Không mock-complete COD.

---

# 16. Payment valid combinations

Chỉ có bốn tổ hợp canonical:

| Target | Method | Kind |
|---|---|---|
| Appointment | ONLINE_MOCK | FULL |
| Appointment | PAY_AT_STORE | DEPOSIT |
| Appointment | PAY_AT_STORE | BALANCE |
| Order | ONLINE_MOCK | ORDER |
| Order | COD | ORDER |

Có thể hiểu nhóm Order là hai method cùng `kind=ORDER`.

Mọi tổ hợp khác phải reject.

Ví dụ invalid:

```text
Appointment + COD
Order + PAY_AT_STORE
Order + FULL
Appointment ONLINE_MOCK + DEPOSIT
```

---

# 17. Payment cancellation/failure consistency

Không được để:

```text
Target CANCELLED
Payment callback về sau -> PAID
```

Phải chặn.

Nếu Payment của target đã terminal hoặc target đã CANCELLED:

```text
callback/mock complete
=> reject / no-op idempotent
```

tùy cùng outcome hay conflicting outcome.

---

# 18. Voucher / Promotion

Voucher/Promotion là global master data.

Quyền:

```text
Admin -> write
Manager -> read
```

Manager không CRUD voucher global.

---

## 18.1 Voucher consume/restore

Backend phải đảm bảo quota consistent.

Ví dụ payment fail/cancel:

```text
Order CANCELLED
inventory restored
voucher quota restored
```

exactly-once.

Appointment cancellation khi voucher đã consume:

> restore quota theo cancellation transaction, exactly-once.

---

# 19. Giá và VAT/tax

Scope Web 2 không cần xây tax engine riêng.

Hướng đã chốt phù hợp scope:

- giá user thấy là giá cuối;
- không hiển thị/đòi VAT field riêng trong checkout;
- không tạo một tax/refund formula phức tạp riêng.

Backend nên sử dụng:

```text
finalAmount
```

là số tiền thực thanh toán sau voucher.

Không tự thêm:

```text
taxAmount
VAT line
tax refund
```

nếu contract cuối không yêu cầu.

---

# 20. Order fulfillment branch

Customer **không chọn branch fulfill**.

Không có:

```text
cart.branchId
customer fulfillmentBranchId
product availability branch query làm source of truth
```

Backend dùng:

```text
system_settings.commerce.fulfillmentBranchPriority
```

Algorithm:

```text
for branch in priority:
    if branch ACTIVE
       and branch đủ stock cho TOÀN BỘ cart:
           chọn branch
           stop
```

Không split order.

Một Order chỉ có:

```text
1 fulfillmentBranchId
```

---

# 21. Order payment

Order chỉ có:

```text
ONLINE_MOCK
COD
```

Không có:

```text
PAY_AT_STORE
```

ONLINE_MOCK:

- payment mock;
- nếu payment failed/cancelled/expired → cancel Order;
- restore inventory;
- restore voucher;
- idempotent.

COD:

- không PAID lúc create;
- PAID khi `Delivered`.

---

# 22. Inventory reserve/issue/restore cho Order

Checkout phải đảm bảo:

- server recalculate giá;
- server chọn fulfillment branch;
- stock đủ toàn cart;
- transaction không oversell.

Khi Order consume inventory:

> dùng ledger.

Nếu Order cancel sau ISSUE:

> tạo RECEIPT compensating transaction.

Không:

```text
delete old ledger
```

---

# 23. Return

Return flow:

```text
REQUESTED
-> PROCESSING
-> RECEIVED
-> APPROVED
-> COMPLETED
```

Reject là terminal alternate path.

Permission:

```text
Receptionist:
  process
  receive

Manager/Admin:
  approve
  reject
```

---

## 23.1 Partial return

Hệ thống hỗ trợ return theo line/quantity.

Không giới hạn chỉ full-order return.

Backend phải validate:

```text
requestedQty
<= returnableQty
```

và không return trùng quantity đã return.

---

## 23.2 Return window

Không tự hard-code số ngày nếu implementation hiện tại chưa có canonical config rõ.

Nếu code đã có:

```text
returnWindowDays
```

hãy kiểm tra nó nằm trong:

```text
commerce settings
```

và không hard-code rải rác nhiều nơi.

---

# 24. Order refund

Refund amount:

> dựa trên item amount sau discount.

Không hoàn:

```text
shipping fee
```

Không thêm tax refund riêng.

Return và refund là hai concept:

```text
OrderReturn = physical goods flow
OrderRefund = money flow
```

Khi return được approve:

- tạo/process refund mock;
- refund document phải idempotent.

Nếu refund provider mock fail:

> retry **cùng refund document**, không tạo refund document thứ hai.

---

# 25. Booking refund / cancellation money rule

## 25.1 TA-30 — customer cancellation/no-show

Canonical:

```text
>= 24h trước appointment
=> refund 100% khoản đã trả trước

< 24h
=> không refund

NO_SHOW
=> không refund
```

“Khoản đã trả trước” nghĩa:

### PAY_AT_STORE có deposit

```text
30% deposit
```

### ONLINE_MOCK

```text
100% finalAmount
```

---

## 25.2 System/store rejection khác customer cancel

Nếu lỗi/decision từ store/system, ví dụ:

- cửa hàng reject;
- confirmation timeout do system;
- system không confirm được;

và customer đã prepaid:

```text
refund 100%
```

Không dùng <24h forfeiture cho lỗi phía hệ thống/store.

---

## 25.3 Không có booking money TRANSFER

Không còn outcome:

```text
TRANSFER
TRANSFERRED
```

trong booking deposit/refund.

Lưu ý:

> Inventory `TRANSFER` vẫn tồn tại.

---

# 26. ServiceRecord — design quan trọng nhất cho medical/grooming

Một Appointment chỉ có:

```text
1 ServiceRecord
```

Đây là:

> **encounter-level aggregate**

Không tạo:

```text
1 ServiceRecord / service segment
```

---

## 26.1 recordType

```text
ServiceRecord.recordType
```

là snapshot của:

```text
Service.serviceType
```

Canonical:

```text
GROOMING
MEDICAL
```

---

## 26.2 Planned/default materials

Service Catalog có:

```text
defaultMaterials[]
```

Đây là planned/template consumption.

Không tự trừ kho chỉ vì default material tồn tại.

---

## 26.3 Actual materials

Khi thực hiện:

```text
actualMaterials[]
```

phải phản ánh vật tư thực tế.

Ví dụ:

Service mặc định:

```text
5 gauze
```

Nurse thực tế dùng:

```text
7
```

thì actual = 7.

Hoặc thực tế dùng:

```text
3
```

thì actual = 3.

---

# 27. Ai được nhập actual materials?

GROOMING:

```text
CARE_STAFF_GROOMER
```

MEDICAL:

```text
NURSE
```

Vet không cần được dùng như role chính để update actual material nếu workflow đã giao phần đó cho Nurse.

State được sửa:

```text
IN_PROGRESS
REOPENED
```

Không sửa:

```text
FINALIZED
```

trừ khi Manager/Admin reopen trước.

---

# 28. Professional data

MEDICAL professional fields:

- diagnosis;
- treatment;
- result;
- professional note;
- related medical data.

Role:

```text
VETERINARIAN
```

Phải là Vet phù hợp/assigned theo scope.

Không sửa một record FINALIZED trực tiếp.

Phải:

```text
reopen
-> correction
-> finalize lại
```

---

# 29. Segment execution vs ServiceRecord finalization

Mỗi Appointment service segment có execution status.

Nurse có thể:

```text
segment MEDICAL IN_PROGRESS
-> submit review
-> segment COMPLETED
```

Nhưng:

> chưa chắc ServiceRecord overall FINALIZED.

Vet finalize segment/final encounter khi đủ điều kiện.

Grooming tương tự:

> complete từng segment trước.

Chỉ khi toàn bộ segment completed:

```text
overall ServiceRecord FINALIZED
Appointment COMPLETED
```

---

# 30. Inventory consumption của ServiceRecord

Inventory chỉ ghi ledger khi **overall finalize**.

Không tạo ledger mỗi lần:

- user chỉnh actual material;
- Nurse submit review;
- Groomer complete intermediate segment.

Lý do:

> tránh trừ kho nhiều lần khi record còn thay đổi.

---

# 31. Reopen ServiceRecord và inventory delta

Đây là business rule đã chốt rõ.

Ví dụ lần đầu:

```text
actualMaterials = 5
finalize
=> stock -5
```

Sau đó Manager reopen:

```text
actualMaterials sửa thành 3
```

Khi finalize lại:

```text
delta = 3 - 5 = -2 consumption difference
```

Về stock:

> cần trả lại 2 đơn vị.

Backend tạo compensating InventoryTransaction tương ứng.

Không:

```text
delete ISSUE -5
```

Ledger cũ phải còn.

Audit trail phải thể hiện:

```text
initial finalize
revision
reopen
correction
new finalize
delta
```

---

## 31.1 Nếu sửa 5 -> 7

Lần đầu:

```text
stock -5
```

Sau reopen:

```text
actual = 7
```

delta consumption:

```text
+2
```

=> ISSUE thêm 2.

---

# 32. ServiceRecord revision/version

ServiceRecord phải có:

```text
version
recordVersion/revision history
```

Các mutation quan trọng cần:

```text
expectedVersion
```

Ví dụ:

- update materials;
- update professional;
- reopen;
- finalize.

Nếu:

```text
expectedVersion != currentVersion
```

=> `409 CONFLICT`.

Mục tiêu:

> tránh Nurse và Vet ghi đè dữ liệu của nhau.

---

# 33. User activation / Customer account

Customer business profile có thể tồn tại trước khi User account được tạo.

Cần phân biệt:

```text
activationStatus
accountStatus
lastLogin
```

Important:

```text
accountStatus = null
```

khi:

```text
NO_ACCOUNT
```

Không ép:

```text
ACTIVE/BLOCKED
```

khi User chưa tồn tại.

---

## 33.1 Block/Unblock Customer

Chỉ:

```text
ADMIN
```

Manager không block Customer toàn hệ thống.

---

## 33.2 Manager xem Customer nào?

Manager không dựa trên:

```text
Customer.branchId
```

Manager được xem Customer có activity trong branch được assign.

Ví dụ Customer có:

```text
Appointment.branchId = Q10
```

hoặc:

```text
Order.fulfillmentBranchId = Q10
```

Manager Q10 có thể xem thông tin cần cho vận hành.

---

# 34. OTP / activation security

OTP provider:

> dùng provider thật nếu khả thi; nếu không dùng controlled mock.

Không để SMS integration trở thành blocker của core.

Security expectation:

- OTP hash;
- TTL ngắn;
- limit attempt;
- resend control;
- one-time use;
- success phải consume challenge/token;
- replay bị reject.

Guest lookup OTP cũng nên dùng challengeId để tránh ambiguity/replay.

---

# 35. Idempotency policy

Business state-changing POST:

> dùng `Idempotency-Key`.

Ví dụ:

- create order;
- create appointment;
- approve/reject;
- payment state transition;
- refund processing;
- inventory mutation;
- finalize/reopen;
- return process.

Same key + same body:

```text
return original result
```

Same key + different body:

```text
409 IDEMPOTENCY_KEY_REUSED
```

Auth/OTP và quote/validate read-like operation có rule riêng.

---

# 36. Những thứ đã bỏ / KHÔNG được re-introduce

Đây là section quan trọng nhất khi audit code cũ.

Nếu code hiện tại có các logic sau, phải flag.

---

## 36.1 Không cho Customer chọn fulfillment branch

Bỏ:

```text
cart.fulfillmentBranchId
customer chooses branch
```

Backend tự chọn.

---

## 36.2 Không split order

Một Order:

```text
1 fulfillmentBranchId
```

Không chia một cart thành nhiều branch.

---

## 36.3 Không fixed deposit

Bỏ:

```text
FIXED
custom %
branch override
service override %
```

Deposit canonical:

```text
30%
```

nếu applicable.

---

## 36.4 Deposit không áp cho ONLINE_MOCK

ONLINE_MOCK:

```text
100% upfront
```

30% deposit chỉ có ý nghĩa trong:

```text
PAY_AT_STORE
```

---

## 36.5 Không bắt multi-service cùng requiredStaffRole

Chỉ bắt:

```text
same serviceType
```

Role được khác nhau theo segment.

---

## 36.6 Không Service.contactInfo.branchId

Service là global.

---

## 36.7 Không Branch.slotCapacity

Capacity nằm ở:

```text
BranchServiceConfig
```

---

## 36.8 Không Manager CRUD global catalog

Manager:

```text
read
```

Admin:

```text
write
```

---

## 36.9 Manager không block/unblock Customer

Only Admin.

---

## 36.10 Không INSPECTION warehouse state

Inspection warehouse flow từng được nhắc nhưng đã bỏ.

---

## 36.11 Không Material Catalog CRUD module

Seed-only.

---

## 36.12 Không supportStaffIds surgery scope

Không kéo lại một surgery support-staff model phức tạp nếu chưa có decision mới.

Staff nằm theo:

```text
Appointment.services[].assignedStaffId
```

---

## 36.13 Không booking money transfer

Không:

```text
TRANSFER deposit
TRANSFERRED
```

---

## 36.14 Không tax engine riêng

Không thêm VAT/refund formula nếu scope không yêu cầu.

---

## 36.15 Không payment gateway thật

Mock state only.

---

## 36.16 Không direct stock editing

Không:

```text
currentQty = 100
```

Phải ledger.

---

# 37. Figma status

Figma đã được review nhưng:

```text
FIGMA_AVAILABLE_BUT_NOT_FROZEN
```

Nghĩa là:

- có thể tham khảo;
- chưa nên coi layout hiện tại là API authority;
- Backend contract/business logic ưu tiên spec canonical hơn Figma draft.

Nếu Figma hiện khác backend rule:

> flag FE mismatch, không làm backend sai theo wireframe cũ.

---

# 38. Các module P1 không nằm critical path

Các phần như:

- Blog / First Aid;
- Community;
- Rescue;
- một số content/search/feedback;

là P1/non-critical so với:

- auth;
- customer;
- catalog;
- commerce;
- booking;
- inventory;
- ServiceRecord;
- payment/refund.

Nếu Backend chưa implement sâu các module content P1:

> không tự kết luận core Task 2.8 sai.

---

# 39. Checklist AI Backend phải chạy khi đối chiếu code

Hãy yêu cầu AI Backend trả một bảng:

```text
Rule
Expected
Actual code
PASS/FAIL/PARTIAL
Evidence
Risk
Suggested fix
Need owner confirmation?
```

Dùng checklist sau.

---

## A. Authorization

- [ ] Customer chỉ access OWN.
- [ ] Guest resource dùng `X-Guest-Lookup-Token`.
- [ ] Guest cart dùng `X-Guest-Cart-Token`.
- [ ] Manager scope qua assignedBranchIds.
- [ ] Receptionist scope qua authorized branch.
- [ ] Admin ALL.
- [ ] Manager không block/unblock Customer.
- [ ] Manager không write global Product.
- [ ] Manager không write global Category.
- [ ] Manager không write global Service.
- [ ] Manager không write global Voucher.
- [ ] Receptionist không execute Service.
- [ ] Customer không chọn Staff.

---

## B. Customer / Account

- [ ] Customer không có `branchId`.
- [ ] accountStatus nullable khi NO_ACCOUNT.
- [ ] activationStatus riêng accountStatus.
- [ ] lastLogin tồn tại/update đúng.
- [ ] Guest không auto-create account.
- [ ] Admin-only block/unblock.

---

## C. Catalog

- [ ] Service global.
- [ ] Product global.
- [ ] Category global.
- [ ] Voucher global.
- [ ] BranchServiceConfig tách khỏi Service.
- [ ] Không có Service.contactInfo.branchId.
- [ ] Không có Branch.slotCapacity.
- [ ] Material seed-only.

---

## D. Appointment model

- [ ] Multi-service same serviceType.
- [ ] Không bắt same requiredStaffRole.
- [ ] Mỗi service segment có assignedStaffId.
- [ ] Mỗi segment có executionStatus.
- [ ] Segment order/sequence tồn tại.
- [ ] GROOMING role = Groomer.
- [ ] MEDICAL role = Nurse hoặc Vet.
- [ ] MEDICAL có ít nhất một Vet segment.
- [ ] Customer/Guest không chọn staff.
- [ ] Internal booking staffAssignments optional.

---

## E. Reservation

- [ ] slotMinutes technical config.
- [ ] Reservation theo slotStartUnit.
- [ ] Segment dài reserve toàn bộ time units.
- [ ] STAFF overlap được chặn.
- [ ] CAPACITY được chặn.
- [ ] PENDING_PAYMENT có holdExpiresAt.
- [ ] PENDING_CONFIRMATION có holdExpiresAt.
- [ ] HELD reservation dùng cùng deadline.
- [ ] CONFIRMED reservation hết expiresAt.

---

## F. Appointment state

- [ ] ONLINE_MOCK create -> PAID + PENDING_CONFIRMATION.
- [ ] PAY_AT_STORE + deposit -> PENDING_PAYMENT.
- [ ] Deposit paid -> PENDING_CONFIRMATION.
- [ ] PAY_AT_STORE no deposit -> PENDING_CONFIRMATION.
- [ ] Confirm -> CONFIRMED.
- [ ] Start segment -> IN_PROGRESS.
- [ ] Segment completion không đóng Appointment sớm.
- [ ] All segments + overall finalize -> COMPLETED.

---

## G. Appointment Request

- [ ] REQUEST_ONLY không tạo booking trực tiếp.
- [ ] Guest/Customer create request.
- [ ] List/Get request có ownership.
- [ ] Cancel khi request chưa terminal.
- [ ] Staff review.
- [ ] Approve tạo Appointment.
- [ ] Approve không tự CONFIRMED.
- [ ] Reject terminal.

---

## H. Payment

- [ ] Payment execution mock only.
- [ ] Appointment ONLINE_MOCK = 100%.
- [ ] PAY_AT_STORE deposit = 30%.
- [ ] 30% tính trên finalAmount sau voucher.
- [ ] Không FIXED deposit.
- [ ] Không override percentage.
- [ ] No deposit nếu mọi service depositRequired=false.
- [ ] PAY_AT_STORE balance đúng.
- [ ] Order chỉ ONLINE_MOCK/COD.
- [ ] COD PAID khi Delivered.
- [ ] paymentMockComplete không dùng PAY_AT_STORE.
- [ ] paymentMockComplete không dùng COD.
- [ ] target cancelled không được callback thành PAID.
- [ ] Payment target/method/kind invalid bị reject.

---

## I. Fulfillment / Order

- [ ] Cart không có fulfillmentBranchId do customer chọn.
- [ ] Backend dùng fulfillmentBranchPriority.
- [ ] Branch phải ACTIVE.
- [ ] Branch phải đủ toàn bộ cart.
- [ ] Không split order.
- [ ] Order chỉ có một fulfillmentBranchId.
- [ ] Payment failure cancel Order.
- [ ] Inventory restored exactly once.
- [ ] Voucher restored exactly once.

---

## J. Inventory

- [ ] Manager quản lý inventory branch.
- [ ] Không direct currentQty write.
- [ ] RECEIVE/ISSUE/ADJUST/TRANSFER qua transaction.
- [ ] Audit actor/reason.
- [ ] Branch low-stock threshold nếu có.
- [ ] Material dùng chung inventory ledger.

---

## K. Return/Refund

- [ ] Partial return supported.
- [ ] REQUESTED -> PROCESSING -> RECEIVED -> APPROVED -> COMPLETED.
- [ ] Receptionist process/receive.
- [ ] Manager/Admin approve/reject.
- [ ] Refund amount server computed.
- [ ] Không refund shipping fee.
- [ ] Không client gửi arbitrary refund amount.
- [ ] Refund mock.
- [ ] Retry same refund doc.

---

## L. Booking refund

- [ ] Customer cancel >=24h => 100% prepayment refund.
- [ ] Customer cancel <24h => no refund.
- [ ] No-show => no refund.
- [ ] Store/system rejection prepaid => 100%.
- [ ] PENDING_CONFIRMATION system timeout prepaid => 100%.
- [ ] Không booking TRANSFER.
- [ ] PAY_AT_STORE refund scope = paid deposit.
- [ ] ONLINE_MOCK refund scope = amount prepaid/full.

---

## M. ServiceRecord

- [ ] 1 ServiceRecord / Appointment.
- [ ] recordType snapshot serviceType.
- [ ] planned/default materials separate actual materials.
- [ ] Groomer nhập actual GROOMING.
- [ ] Nurse nhập actual MEDICAL.
- [ ] Vet professional data.
- [ ] Không sửa FINALIZED trực tiếp.
- [ ] Reopen trước correction.
- [ ] expectedVersion CAS.
- [ ] finalize creates inventory delta.
- [ ] intermediate segment completion không tạo ledger.
- [ ] reopen không delete ledger cũ.
- [ ] finalize lại tạo compensating delta.
- [ ] revision history đầy đủ.

---

## N. Idempotency

- [ ] Business-changing POST có Idempotency-Key.
- [ ] same key + same body = original result.
- [ ] same key + different body = 409.
- [ ] compensation exactly once.
- [ ] voucher restore exactly once.
- [ ] inventory restore exactly once.
- [ ] refund document không duplicate.

---

# 40. Các mismatch cần coi là HIGH RISK

Nếu AI Backend phát hiện một trong các lỗi sau, đánh HIGH:

```text
1. Product/Service/Voucher Manager được global CRUD.
2. Customer có branchId.
3. Customer chọn fulfillment branch.
4. Order split nhiều branch.
5. Service requiredStaffRole = RECEPTIONIST.
6. Appointment nhiều service bắt cùng role.
7. Appointment complete ngay segment đầu.
8. ServiceRecord tạo theo từng segment.
9. Reopen xóa ledger cũ.
10. Direct stock overwrite.
11. Online appointment chỉ trả 30%.
12. PAY_AT_STORE đi qua mockComplete chung.
13. COD PAID trước Delivered.
14. Branch.slotCapacity.
15. Service.contactInfo.branchId.
16. Booking refund có TRANSFER.
17. Guest endpoint chỉ dùng bearer/anonymous mà không guest lookup token.
18. Material có CRUD module riêng ngoài seed scope.
19. Target CANCELLED vẫn có callback Payment -> PAID.
20. Manager block Customer.
```

---

# 41. Những chỗ không nên tự đoán nếu code khác

Khi audit backend, nếu gặp những điểm sau thì **flag owner review** thay vì tự sửa:

### Reschedule exact timing rule

Policy cũ từng có 2 lần / 3 giờ nhưng không được coi là canonical implementation rule chỉ vì website policy ghi vậy.

### Return window exact number of days

Nếu contract/settings code hiện tại có một số cụ thể, báo số đó. Không tự chọn 7/14/30 ngày từ “best practice”.

### Shipping fee dưới 500k

Freeship threshold 500k đã được dùng theo hướng config.

Nhưng shipping fee cụ thể dưới threshold từng là OPEN-BIZ/config.

Không tự bịa số phí nếu chưa có setting.

### Content modules P1

Không ép Blog/Community/Rescue phải có full contract như critical modules.

---

# 42. Suggested backend collection/model map

Không bắt buộc phải giống tên collection 100%, nhưng semantics phải tương đương.

```text
users
customers
guest_contacts
staff_profiles
branches
shifts

categories
products
product_variants
services
branch_service_configs
vouchers
voucher_usages

carts
orders
payments

appointments
appointment_requests
slot_reservations
service_records
service_record_revisions

inventory_items
inventory_stocks
inventory_transactions

order_returns
order_refunds
booking_refunds

notifications
reviews

system_settings
otp_challenges / activation_tokens
```

---

# 43. Suggested invariants cho MongoDB/index

Backend AI nên kiểm tra có equivalent constraints.

## Customer

```text
email/phone uniqueness theo account/business requirement
```

## ServiceRecord

```text
appointmentId unique
```

=> one record per appointment.

## Staff reservation

Equivalent logic:

```text
unique active reservation
(staffId, slotStartUnit)
```

## Capacity

Equivalent:

```text
branchId
serviceId
slotStartUnit
unitIndex
```

## Refund

Không cho duplicate active/terminal refund cùng source.

Rejected refund request có thể re-request nếu business rule cho phép.

## Version

ServiceRecord:

```text
version
```

Appointment:

```text
version
```

cần cho CAS ở critical mutations.

---

# 44. Error semantics Backend nên có

Tên exact có thể khác nếu contract hiện tại khác, nhưng cần semantic tương đương:

```text
401 UNAUTHENTICATED
403 FORBIDDEN
404 NOT_FOUND
409 CONFLICT
409 INVALID_STATE_TRANSITION
409 IDEMPOTENCY_KEY_REUSED
409 PAYMENT_STATE_ERROR
422 VALIDATION / business rule error
422 SLOT_UNAVAILABLE
422 STAFF_ROLE_MISMATCH
422 SERVICE_NOT_ENABLED_AT_BRANCH
422 MIXED_SERVICE_TYPES
```

Không trả `200` cho một invalid business transition rồi âm thầm ignore.

---

# 45. Transaction boundaries quan trọng

Backend nên dùng MongoDB transaction/atomic equivalent cho các flow sau.

## Checkout

```text
validate cart
select fulfillment branch
calculate totals
consume voucher
issue/reserve inventory
create Order
create Payment
```

---

## Appointment create

```text
validate services
validate same serviceType
resolve staff per segment
reserve staff/capacity
calculate price/voucher
create Appointment
create Payment if needed
```

---

## Order payment failure

```text
Payment terminal
Order CANCELLED
inventory compensation
voucher restore
```

exactly once.

---

## Appointment cancel

```text
Appointment CANCELLED
Payment PENDING -> CANCELLED
release reservations
refund creation if eligible
voucher restore if applicable
```

---

## ServiceRecord overall finalize

```text
CAS version
validate all segments completed
create revision
compute material delta
write inventory ledger
update stock projection
mark FINALIZED
Appointment COMPLETED
```

---

## ServiceRecord re-finalize

```text
CAS
new revision
delta vs last finalized actual
compensating ISSUE/RECEIPT
do not delete old ledger
```

---

# 46. Cách AI Backend nên báo kết quả

Đừng chỉ trả:

> “Backend mostly correct.”

Hãy trả theo format:

```markdown
# Overall verdict
- PASS:
- PARTIAL:
- FAIL:
- HIGH-RISK mismatches:
- Requires owner confirmation:

# 1. Authorization
## Rule A01
Expected:
Actual:
Evidence:
Verdict:
Risk:
Fix:

# 2. Appointment
...

# Database mismatches
...

# API mismatches
...

# State-machine mismatches
...

# Missing tests
...

# Migration impact
...

# Recommended fix order
P0:
P1:
P2:
```

---

# 47. Prompt có thể đưa thẳng cho AI Backend

Copy nguyên prompt sau cùng repo/code backend:

```text
Bạn đang audit backend Web 2.

Hãy đọc file BACKEND_HANDOFF_LATEST_WEB2.md này như canonical business/design handoff.
Sau đó đọc toàn bộ backend source, DB schemas/models, routes/controllers/services,
authorization middleware, state machines và tests.

Nhiệm vụ:

1. Không tự sửa code trước.
2. Lập mapping:
   handoff rule -> source code implementation -> PASS/PARTIAL/FAIL.
3. Mỗi mismatch phải có:
   - file/path;
   - function/class/schema;
   - code evidence;
   - business impact;
   - severity P0/P1/P2;
   - cách sửa đề xuất.
4. Đặc biệt kiểm tra:
   - global vs branch data;
   - Manager/Admin permission;
   - Customer branch ownership;
   - Guest token security;
   - multi-service segment execution;
   - ServiceExecutionRole;
   - appointment hold/reservation;
   - 30% deposit;
   - ONLINE_MOCK/PAY_AT_STORE/COD boundaries;
   - fulfillment branch priority/no split;
   - inventory ledger;
   - order return/refund;
   - ServiceRecord encounter aggregate;
   - reopen inventory delta;
   - expectedVersion/CAS;
   - idempotency.
5. Đừng coi Figma draft hoặc policy text cũ là mạnh hơn canonical handoff.
6. Không tự bịa decision nếu handoff ghi cần owner confirmation.
7. Kết thúc bằng:
   - top 10 backend mismatches;
   - migration/data-fix cần thiết;
   - API-breaking changes;
   - test cases còn thiếu;
   - thứ tự sửa P0 -> P2.
```

---

# 48. TL;DR cho Backend mới tiếp nhận

Nếu chỉ nhớ 20 dòng, nhớ các dòng này:

1. Product/Category/Service/Voucher là global; Admin write, Manager read.
2. Inventory là theo branch; Manager quản lý qua ledger, không direct qty.
3. Customer không có branchId; branch scope từ Order/Appointment activity.
4. Only Admin block/unblock Customer.
5. Service global; BranchServiceConfig giữ enable/capacity/availability.
6. `ServiceExecutionRole` không có Receptionist.
7. Appointment được nhiều service cùng `serviceType`, role có thể khác nhau.
8. Mỗi service là segment có staff riêng + executionStatus.
9. Appointment chỉ COMPLETED khi mọi segment xong và ServiceRecord overall finalize.
10. Một Appointment chỉ có một ServiceRecord encounter-level.
11. Material default là template; actual material do staff nhập.
12. Finalize mới tác động inventory; reopen dùng delta, không xóa ledger.
13. Appointment ONLINE_MOCK trả 100% ngay khi tạo.
14. PAY_AT_STORE nếu cần cọc thì cọc 30% finalAmount sau voucher.
15. Customer không chọn fulfillment branch; backend chọn branch ưu tiên đầu tiên đủ toàn bộ cart.
16. Order không split branch.
17. Order chỉ ONLINE_MOCK/COD; COD PAID khi Delivered.
18. Guest transaction dùng `X-Guest-Lookup-Token`; guest cart dùng token riêng.
19. Customer cancellation >=24h refund 100% prepayment; <24h/no-show không refund; system/store fault refund 100%.
20. Payment, inventory, voucher, refund và ServiceRecord mutation phải idempotent/CAS đúng chỗ.

---

# 49. Trạng thái của tài liệu này

Đây là bản **backend handoff mới nhất trong cuộc review hiện tại**.

Nó cố tình tổng hợp:

- business decisions;
- những decision cũ đã bị thay;
- authorization;
- DB modeling;
- state transitions;
- inventory/refund compensation;
- API invariants;
- technical safety rules.

Khi audit code:

> Nếu code và tài liệu này khác nhau, hãy **flag mismatch trước**. Chỉ sửa sau khi xác định đây là implementation bug chứ không phải một business decision mới chưa được cập nhật vào handoff.

