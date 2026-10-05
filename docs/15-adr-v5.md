# 15 ADR v5 (ADR-25..29 la moi cua V4)

ADR v1, v2 giu lam lich su. ADR duoi day la hien hanh; muc "thay the" ghi ro. Research chi dung de chon ky thuat; trang thai xac minh o 16.

| ID | Quyet dinh | Context | Decision | Trade-off | Rejected |
|---|---|---|---|---|---|
| ADR-01 | Greenfield Node.js + Express + MongoDB | Backend cu xoa lam lai | Backend moi, git khong force-push | viet lai | patch BE cu |
| ADR-02 | Modular monolith | tx xuyen module (checkout, finalize) | module theo 03 | scale doc lap kem | microservices |
| ADR-03 | MongoDB theo workload | khong 1:1 tu SQL | 06 | join co chu y | 1:1 |
| ADR-04 | Tach Service Catalog / BranchService | Admin global, Manager chi branch | `services` + `branch_service_configs`  | them collection | field theo branch trong services |
| ADR-05 | Role + sub-role | quyen khac nhau theo sub-role | systemRole + staffSubRole | policy phuc tap | role phang |
| ADR-06 | Multi-branch staff, Manager assignedBranches | sheet | authorizedBranchIds, shifts.branchId, assignedBranchIds | validate them | Manager = ALL |
| ADR-07 | Availability tinh dong | khong time_slots | computed + slot_reservations | tinh moi lan | bang slot |
| ADR-08 | Multi-service cung serviceType va requiredStaffRole | CD-08, CD-14 | services[] snapshot, loi 422 + suggestedGroups | nhieu role phai tach lich | multi-staff 1 appointment |
| ADR-09 | Deposit khoa PERCENTAGE 30 cho service bat coc; tinh tren final amount toan appointment | V5 hard lock, CD-13 | APPLIED khi COMPLETED; cau hinh chi Admin | it linh hoat | cac phuong an nhieu muc coc |
| ADR-10 | Payment mock, state that | sheet | PaymentProvider + Mock; status khop sheet | -- | gateway that |
| ADR-11 | Inventory ledger append-only + stocks projection | rule 2 | transactions bat bien; mot vi tri ton kho moi branch | hoan hang khong tu dong nhap kho | them vi tri ton kho phu |
| ADR-12 | Service record revision + inventory delta | sheet 4.4 | revision collection, delta | them collection | overwrite ledger |
| ADR-13 | Medical: Nurse submit, Vet finalize | sheet | WAITING_VET_REVIEW | them buoc | Nurse duoc finalize |
| ADR-14 | `serviceType` la ten chinh thuc (thay `serviceType`) | sheet freeze Service.serviceType | mot ten duy nhat; snapshot sang Appointment va ServiceRecord | doi ten so voi v2 | serviceType |
| ADR-15 | Tach Order Return / Order Refund / Booking Refund | M09 vs M16 | 3 model; return theo item+qty | nhieu collection | gop |
| ADR-16 | Cong thuc hoan tien don gian (thay ADR-21 v2) | feedback 4 | `refund = round(lineNet * q / orderedQty)`, lan cuoi dung phan du; khong thue; khong shipping; server tinh | khong linh hoat | nhap tay; tinh thue |
| ADR-17 | Block/Unblock Customer chi Admin; Manager xem theo activity | V4, M03 | Customer global, `activityBranchIds` derived | them field derived can giu dong bo | truong branch tren Customer |
| ADR-18 | **Commerce day du M05 > M08 trong contract** | feedback 1, sheet P0 | categories, products, carts (token cho Guest), checkout quote/create, orders state machine | contract lon hon | de commerce ngoai contract |
| ADR-19 | Tru ton khi tao Order; hoan khi huy | sheet BF02 | ledger ISSUE o checkout (1 tx), RECEIPT khi huy; khong giu ton luc mo checkout | huy phai hoan | tru khi confirm |
| ADR-20 | Hai FE Angular tu mot OpenAPI | feedback 2 | `x-audience` customer/admin, client sinh tu spec | can CI kiem audience | client viet tay |
| ADR-21 | OpenAPI 3.1.1, `/api/v1`, RFC 9457, action endpoints, authority tu server | -- | override/store-cancel la endpoint rieng | nhieu endpoint | flag trong body |
| ADR-22 | Idempotency-Key + conditional writes theo thao tac | -- | dung dung cho, khong dung tat ca | -- | -- |
| ADR-23 | ID ObjectId; tien integer VND | -- | -- | -- | float |
| ADR-24 | Freeship nguong cau hinh (500000) trong system_settings | Log | Admin sua duoc, public doc | gia tri phi chua chot | hard-code |
Ghi chu: cac ADR cu ve cong thuc hoan tien co them thanh phan va vi tri kho phu bi huy.
| ADR-25 | Resource Scope Resolver | V5 s.14 | Moi resource co branch/ownership/assignment resolver rieng; Payment, Pet, Customer, Cart khong co truong branch | tra cuu qua target/activity | truong branch chung cho moi resource |
| ADR-26 | Order payment failure: compensating transaction | V5 s.22-24 | FAILED/CANCELLED/EXPIRED => Order CANCELLED, RECEIPT, restore voucher, idempotent, auto-cancel theo timeout | khong co retry | retry thanh toan, queue |
| ADR-27 | Return: REQUESTED > PROCESSING > RECEIVED > APPROVED > COMPLETED | V5 s.25 | APPROVED la final approve sau khi nhan hang | -- | APPROVED truoc RECEIVED |
| ADR-28 | Dat lich noi bo | V5 s.37-39 | internalAppointmentsCreate tach khoi tu dat; customerId XOR contact | them endpoint | mot schema chung |
| ADR-29 | FulfillmentBranchResolver = priority list | review feedback, dong blocker FULFILLMENT_BRANCH_SOURCE | `system_settings.fulfillmentBranchPriority`; branch ACTIVE dau tien du ton cho toan bo cart; khong tach don; khong geolocation | khong toi uu khoang cach/ton | Customer chon, branch gan nhat, branch mac dinh, tach don |
| ADR-30 | Mot field state canonical `x-authz.stateTransition` | review feedback (hai field lech nhau) | bo `transition`; audit so khop voi 09 | -- | giu hai field |
| ADR-31 | Cart chi validate purchasable + ton tong quat | review feedback | validation branch o checkoutValidate/Quote/Create | khach co the them vao cart roi moi biet khong fulfill | kiem tra branch tai add item |
| ADR-32 | Reject sau RECEIVED khong refund, khong nhap stock | review feedback, TA-24 | hang xu ly thu cong ngoai he thong | mat dau vet he thong cho hang tra lai | tu dong nhap kho/hoan tien |
