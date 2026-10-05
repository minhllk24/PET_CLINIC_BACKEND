# 14 API Contract Test Strategy v5

Muc tieu: OpenAPI v5 == Customer Angular == Admin Angular == Backend. Hai chieu: requirement > OpenAPI > BE/FE va BE/FE > OpenAPI.

## Pipeline
1 Lint + validate `07-openapi-v5.yaml` (da validate 3.1.1, 143 operation). 2 Sinh Angular client (openapi-generator `typescript-angular` hoac `ng-openapi-gen`) theo `x-audience` cho `api-customer` va `api-admin`. 3 BE validator middleware doc cung file. 4 Contract tests CI. 5 oasdiff chan breaking change. 6 Audit nhat quan (script, ket qua o 16).

## Lop test
| Lop | Noi dung |
|---|---|
| Spec | operationId duy nhat, ref hop le, moi op co x-authz va x-audience, 401 cho op khong public, khong schema thua, khong hai enum cung tap gia tri, khong co field/enum ngoai scope (xem audit 16) |
| Angular clients | Customer app khong goi op chi audience admin; hai client compile voi cung spec |
| **Catalog (M05)** | Public chi thay ACTIVE; INACTIVE/ARCHIVED khong vao cart/checkout (422 PRODUCT_NOT_PURCHASABLE); Admin CRUD, Manager 403; search/filter/sort server-side loc toan dataset roi phan trang; outOfStock theo branch |
| **Cart (M07)** | Customer chi thay cart cua minh; Guest chi truy cap bang X-Cart-Token (sai token 404); them vuot ton 422; doi branch kiem tra lai ton |
| **Checkout** | Backend tinh lai gia (gui gia gia vao body bi 400); voucher het han/het quota/sai scope tra reason; toi da 1 voucher; freeship dung nguong 500000 (499,999 co phi, 500,000 mien phi); Guest checkout khong tao users; Idempotency-Key tra cung order |
| **Order (M08)** | Moi cap (state, action) sai => 409 INVALID_STATE_TRANSITION (sinh tu 09); Receptionist/Manager/Admin dung branch, branch khac 404; Customer huy PENDING/CONFIRMED OK, PROCESSING 422/409; huy hoan ton qua ledger va restore voucher; COD PAID khi Mark Delivered; khong hard delete |
| Stock concurrency | 20 checkout song song vao ton 1 => dung 1 thanh cong, ton khong am, ledger afterQty lien tuc; checkout loi giua tx => khong ISSUE, khong tru voucher |
| Customer scope (M03) | Manager chi thay Customer co activity tai assignedBranches (Customer khong mang truong branch); assignedBranchIds rong => khong thay; Manager goi block/unblock => 403; Admin block/unblock OK, reason bat buoc, audit |
| **Refund formula** | Vi du: 2 san pham 100k, voucher lam line net 180k, tra 1/2 => 90,000; line net 180,001 qty 3 tra 3 lan 1 don vi => 60,000 + 60,000 + 60,001; tong phan bo discount = orderDiscountTotal; shipping khong hoan; client gui so tien bi 400; Manager khong nhap tay |
| Return window | deliveredAt+7d bien (ngay 7 OK, sau 7 => RETURN_WINDOW_EXPIRED); qty vuot => RETURN_QTY_EXCEEDS_RETURNABLE; hai return dong thoi khong vuot ordered; receive KHONG doi ton kho |
| Service/BranchService | Manager sua global Service 403; Manager upsert BranchService trong BR OK , ngoai BR 404/403 |
| Booking | multi-service cung serviceType + requiredStaffRole; khac role 422 + suggestedGroups; duration = tong; deposit khoa PERCENTAGE 30% tren finalAmount sau voucher (khong override, khong FIXED); nhieu service: 30% toan appointment; reschedule <24h 422, lan 3 422; cancel >=24h hoan 100%, <24h forfeit; chi luu DB sau khi xac nhan; pet moi tu luu; nhac lich tao notification |
| Medical | Nurse goi finalize 403; submit => WAITING_VET_REVIEW; chi Vet finalize; revision/delta (0>5 ISSUE -5, 5>3 ADJUSTMENT +2, 5>8 ISSUE -3) |
| Auth | mat khau yeu (thieu chu hoa/so) 422; lastLogin chi tang khi login ok; Guest khong co users truoc activation |
| Idempotency | cung key => 1 order/payment/refund/finalize; khac body => 409 |
| **Payment failure compensation (V5 s.47)** | Checkout + payment success (Order PENDING, ton da tru); checkout + FAILED; checkout + CANCELLED (paymentsCancel); checkout + EXPIRED (timeout job); retry checkout cung Idempotency-Key tra cung Order; callback loi lap lai. Ky vong voi failed/cancelled/expired: Order CANCELLED, ton duoc hoan (RECEIPT dung 1 lan), voucher quota restore, Payment o terminal state, khong RECEIPT trung |
| **Authorization V5 (s.48)** | Customer A xem Order cua Customer B: khong duoc; Customer vao data branch Manager: khong duoc; Manager Branch A sang Branch B: khong duoc; Manager ghi global Product, Category, Service: 403; Manager Inventory branch duoc gan: OK; branch khong gan: khong duoc; Admin block/unblock Customer: OK; Manager block/unblock: 403 |
| Scope resolver | moi resource trong bang 08 co test: Payment resolve qua target (ORDER > Order.fulfillmentBranchId, APPOINTMENT > Appointment.branchId); Pet qua Customer/Appointment/ServiceRecord; Cart khong co branch scope |
| Internal appointment | Receptionist/Manager/Admin dat ho Customer (customerId) va Guest (contact); gui ca hai hoac thieu ca hai => 400; Guest khong tao account; Receptionist/Manager ngoai branch => 404/403; Customer goi internal => 403; public AppointmentCreate khong nhan customerId |
| Payment method | Appointment nhan ONLINE_MOCK/PAY_AT_STORE, COD bi 400; Order nhan ONLINE_MOCK/COD, PAY_AT_STORE bi 400 |
| Return state | REQUESTED > PROCESSING > RECEIVED > APPROVED > COMPLETED; approve khi chua RECEIVED bi 409; Receptionist approve/reject 403; reject tu PROCESSING va RECEIVED |
| Deposit | service bat coc: 30% finalAmount sau voucher (1,000,000 > 300,000); khong override; nhieu service: 30% toan appointment |
| Commerce coverage | productVariants*, checkoutValidate, ordersReturnQuote ton tai; cart/checkout khong nhan hay tra branch lua chon |
| **Fulfillment resolver** | `fulfillmentBranchPriority=[Q10,Q7]`: Q10 du => Order.fulfillmentBranchId=Q10; Q10 thieu, Q7 du => Q7; branch INACTIVE bi bo qua; khong branch nao du toan bo cart => 422 INSUFFICIENT_INVENTORY (khong tach don); danh sach rong => 422 FULFILLMENT_NOT_CONFIGURED; Q10=3 va Q7=3 mua 5 (tong 6) => `fulfillable=false` o checkoutValidate va 422 o checkout; dua tranh decrement => thu branch ke tiep; Customer khong gui branch (gui thi 400) |
| **Cart validation layering** | cartsAddItem chi kiem tra purchasable + ton tong quat (them 5 khi tong 6 van duoc); khong tra loi branch; checkoutValidate/checkoutQuote moi tra NOT_FULFILLABLE_BY_SINGLE_BRANCH |
| **Return reject sau RECEIVED** | reject tu RECEIVED: Return REJECTED, khong OrderRefund, khong ledger, returnReservedQty duoc tra lai; reject tu PROCESSING tuong tu |
| **stateTransition canonical** | moi operation chi co `x-authz.stateTransition` (khong co `transition`); gia tri khop dong tuong ung trong bang 09 cho moi operation Order, Return, Payment, Appointment; lech => CI fail |
| Error | moi loi la application/problem+json co code va correlationId |
Tieu chi qua: spec lint 0 loi; moi op co >= 1 happy va >= 1 authz test; moi cap (state, action) co test; concurrency xanh 20 lan lien tiep.
