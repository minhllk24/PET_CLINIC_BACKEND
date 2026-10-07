# 14 API Contract Test Strategy v6

Muc tieu: OpenAPI v6 == Customer Angular == Admin Angular == Backend. Hai chieu: requirement > OpenAPI > BE/FE va BE/FE > OpenAPI.

## Pipeline
1 Lint + validate `07-openapi-v6.yaml` (OpenAPI 3.1.1; operation count regenerated from current package). 2 Sinh Angular client (openapi-generator `typescript-angular` hoac `ng-openapi-gen`) theo `x-audience` cho `api-customer` va `api-admin`. 3 BE validator middleware doc cung file. 4 Contract tests CI. 5 oasdiff chan breaking change. 6 Audit nhat quan (script, ket qua o 16).

## Lop test
| Lop | Noi dung |
|---|---|
| Spec | operationId duy nhat, ref hop le, moi op co x-authz va x-audience, 401 cho op khong public, khong schema thua, khong hai enum cung tap gia tri, khong co field/enum ngoai scope (xem audit 16) |
| Angular clients | Customer app khong goi op chi audience admin; hai client compile voi cung spec |
| **Catalog (M05)** | Public/CUSTOMER chi thay ACTIVE; MANAGER/ADMIN duoc read moi status; write catalog chi ADMIN; INACTIVE/ARCHIVED khong vao cart/checkout (422 PRODUCT_NOT_PURCHASABLE); Admin CRUD, Manager 403; search/filter/sort server-side loc toan dataset roi phan trang; outOfStock theo branch |
| Catalog read authorization | GET list/detail Product/Category/Service hỗ trợ public + optional bearer; public/CUSTOMER chỉ ACTIVE, Manager/Admin xem mọi status |
| **Cart (M07)** | Customer chi thay cart cua minh; Guest chi truy cap bang X-Guest-Cart-Token (sai token 404); them vuot ton 422; doi branch kiem tra lai ton |
| **Checkout** | Backend tinh lai gia (gui gia gia vao body bi 400); voucher het han/het quota/sai scope tra reason; toi da 1 voucher; freeship dung nguong 500000 (499,999 co phi, 500,000 mien phi); Guest checkout khong tao users; Idempotency-Key tra cung order |
| **Order (M08)** | Moi cap (state, action) sai => 409 INVALID_STATE_TRANSITION (sinh tu 09); Receptionist/Manager/Admin dung branch, branch khac 404; Customer huy PENDING/CONFIRMED OK, PROCESSING 422/409; huy hoan ton qua ledger va restore voucher; COD PAID khi Mark Delivered; khong hard delete |
| Stock concurrency | 20 checkout song song vao ton 1 => dung 1 thanh cong, ton khong am, ledger afterQty lien tuc; checkout loi giua tx => khong ISSUE, khong tru voucher |
| Customer scope (M03) | Manager chi thay Customer co activity tai assignedBranches (Customer khong mang truong branch); assignedBranchIds rong => khong thay; Manager goi block/unblock => 403; Admin block/unblock OK, reason bat buoc, audit |
| **Refund formula** | Vi du: 2 san pham 100k, voucher lam line net 180k, tra 1/2 => 90,000; line net 180,001 qty 3 tra 3 lan 1 don vi => 60,000 + 60,000 + 60,001; tong phan bo discount = orderDiscountTotal; shipping khong hoan; client gui so tien bi 400; Manager khong nhap tay |
| Return window | deliveredAt+7d bien (ngay 7 OK, sau 7 => RETURN_WINDOW_EXPIRED); qty vuot => RETURN_QTY_EXCEEDS_RETURNABLE; hai return dong thoi khong vuot ordered; receive KHONG doi ton kho |
| Service/BranchService | Manager sua global Service 403; Manager upsert BranchService trong BR OK , ngoai BR 404/403 |
| Booking | multi-service cung serviceType (GROOMING+MEDICAL => MIXED_SERVICE_TYPES); cac service co the khac requiredStaffRole; moi segment co staff rieng, noi tiep, duration = tong; backend tu tim va reserve staff (Customer gui staff => 400); khong tim duoc staff cho TOAN BO Appointment => slot khong tra trong availability va tao => 409 SLOT_UNAVAILABLE (rollback tat ca segment); reschedule <24h 422, lan 3 422; cancel >=24h hoan 100% khoan tra truoc, <24h khong hoan; chi luu DB khi xac nhan; pet moi tu luu; nhac lich tao notification |
| Availability contract | `branchId` và `date` là query bắt buộc; availability luôn theo một branch và một ngày |
| Booking hold | PENDING_PAYMENT và PENDING_CONFIRMATION đều có holdExpiresAt; HELD reservations mirror deadline; timeout giải phóng reservation và xử lý Payment/BookingRefund theo state machine |
| ServiceRecord write guard | actualMaterials chỉ Care/Groomer hoặc Nurse và chỉ IN_PROGRESS/REOPENED; professional chỉ Vet và không sửa FINALIZED nếu chưa reopen; sai state => 409 |
| Medical | Nurse goi finalize 403; submit => WAITING_VET_REVIEW; chi Vet finalize; revision/delta (0>5 ISSUE -5, 5>3 ADJUSTMENT +2, 5>8 ISSUE -3) |
| Auth | mat khau yeu (thieu chu hoa/so) 422; lastLogin chi tang khi login ok; Guest khong co users truoc activation |
| Idempotency | cung key => 1 order/payment/refund/finalize; khac body => 409 |
| Payment cancellation synchronization | Target CANCELLED => Payment PENDING tự CANCELLED trong cùng compensating tx; callback/mock-complete sau đó không được chuyển PAID; target terminal => PAYMENT_STATE_ERROR |
| Appointment prepayment failure | PAY_AT_STORE deposit FAILED/CANCELLED/EXPIRED => Appointment CANCELLED, Payment terminal, release staff/capacity; không retry |
| **Payment failure compensation (V5 s.47)** | Checkout + payment success (Order PENDING, ton da tru); checkout + FAILED; checkout + CANCELLED (paymentsCancel); checkout + EXPIRED (timeout job); retry checkout cung Idempotency-Key tra cung Order; callback loi lap lai. Ky vong voi failed/cancelled/expired: Order CANCELLED, ton duoc hoan (RECEIPT dung 1 lan), voucher quota restore, Payment o terminal state, khong RECEIPT trung |
| **Authorization V5 (s.48)** | Customer A xem Order cua Customer B: khong duoc; Customer vao data branch Manager: khong duoc; Manager Branch A sang Branch B: khong duoc; Manager ghi global Product, Category, Service: 403; Manager Inventory branch duoc gan: OK; branch khong gan: khong duoc; Admin block/unblock Customer: OK; Manager block/unblock: 403 |
| Scope resolver | moi resource trong bang 08 co test: Payment resolve qua target (ORDER > Order.fulfillmentBranchId, APPOINTMENT > Appointment.branchId); Pet qua Customer/Appointment/ServiceRecord; Cart khong co branch scope |
| Internal appointment | Receptionist/Manager/Admin dat ho Customer (customerId) va Guest (contact); gui ca hai hoac thieu ca hai => 400; Guest khong tao account; Receptionist/Manager ngoai branch => 404/403; Customer goi internal => 403; public AppointmentCreate khong nhan customerId |
| Payment method | Appointment nhan ONLINE_MOCK/PAY_AT_STORE, COD bi 400; Order nhan ONLINE_MOCK/COD, PAY_AT_STORE bi 400 |
| Return state | REQUESTED > PROCESSING > RECEIVED > APPROVED > COMPLETED; approve khi chua RECEIVED bi 409; Receptionist approve/reject 403; reject tu PROCESSING va RECEIVED |
| Deposit | service bat coc: 30% finalAmount sau voucher (1,000,000 > 300,000); khong override; nhieu service: 30% toan appointment |
| Commerce coverage | productVariants*, checkoutValidate, ordersReturnQuote ton tai; cart/checkout khong nhan hay tra branch lua chon |
| **Payment flow Appointment** | ONLINE_MOCK: FULL=PAID ngay khi create Appointment (cung tx), 100% finalAmount sau voucher (kind FULL), depositAmount=0, balance=0; PAY_AT_STORE co service bat coc: coc 30% (kind DEPOSIT) giu slot, phan con lai 70% thu tai cua hang (kind BALANCE); PAY_AT_STORE khong service bat coc: khong coc, vao PENDING_CONFIRMATION; deposit 30% khong ap dung cho online; paymentMethod thieu => 400; COD cho lich hen => 400 |
| **Ghi nhan coc ngay** | hoa don 1,000,000, coc 300,000 thanh cong => paidAmount=300,000 va deposit HELD ngay (khong cho balance); COMPLETED => deposit APPLIED tu dong; balance payment chi thu 700,000 va khong doi trang thai deposit; balance payment cho ONLINE_MOCK hoac Appointment chua COMPLETED => 422 |
| **Internal booking khong CONFIRMED** | dat ho voi/khong staffAssignments => PENDING_PAYMENT hoac PENDING_CONFIRMATION; chi appointmentsConfirm => CONFIRMED; confirm khi chua dat tra truoc => 409/422; duyet request cung khong CONFIRMED |
| **Reassign segment** | trung requiredStaffRole va available => OK, khong doi trang thai; khac role (du ranh) => 422 STAFF_ROLE_MISMATCH; trung lich/ngoai shift/khong authorized => 409 STAFF_UNAVAILABLE; segment da bat dau => 409; Customer goi => 403; Receptionist/Manager ngoai branch => 404 |
| **COD** | Order COD khong goi duoc record-at-store (422); payment COD chi PAID khi ordersMarkDelivered; record-at-store chi chap nhan Payment Appointment PAY_AT_STORE |
| **Fulfillment resolver** | `fulfillmentBranchPriority=[Q10,Q7]`: Q10 du => Order.fulfillmentBranchId=Q10; Q10 thieu, Q7 du => Q7; branch INACTIVE bi bo qua; khong branch nao du toan bo cart => 422 INSUFFICIENT_INVENTORY (khong tach don); danh sach rong => 422 FULFILLMENT_NOT_CONFIGURED; Q10=3 va Q7=3 mua 5 (tong 6) => `fulfillable=false` o checkoutValidate va 422 o checkout; dua tranh decrement => thu branch ke tiep; Customer khong gui branch (gui thi 400) |
| **Cart validation layering** | cartsAddItem chi kiem tra purchasable + ton tong quat (them 5 khi tong 6 van duoc); khong tra loi branch; checkoutValidate/checkoutQuote moi tra NOT_FULFILLABLE_BY_SINGLE_BRANCH |
| **Return reject sau RECEIVED** | reject tu RECEIVED: Return REJECTED, khong OrderRefund, khong ledger, returnReservedQty duoc tra lai; reject tu PROCESSING tuong tu |
| **stateTransition canonical** | moi operation chi co `x-authz.stateTransition` (khong co `transition`); gia tri khop dong tuong ung trong bang 09 cho moi operation Order, Return, Payment, Appointment; lech => CI fail |
| CustomerDetail accountStatus null | NO_ACCOUNT/PENDING_ACTIVATION => accountStatus=null; có User => ACTIVE/BLOCKED |
| Global Service contact | Service.contactInfo không nhận branchId; gửi branchId => 400; branch contact lấy từ Branch |
| Branch capacity | không có branches.slotCapacity; capacity chỉ ở BranchServiceConfig |
| Material catalog | MATERIAL inventory item là seed-only; không có CRUD Material |
| ServiceRecord aggregate | một ServiceRecord cho toàn Appointment; actualMaterials aggregate, assignedStaffIds derived |
| Error | moi loi la application/problem+json co code va correlationId |
Tieu chi qua: spec lint 0 loi; moi op co >= 1 happy va >= 1 authz test; moi cap (state, action) co test; concurrency xanh 20 lan lien tiep.


## Final review additions
| Security token | Guest lookup endpoints require `X-Guest-Lookup-Token`; cart/checkout endpoints require `X-Guest-Cart-Token`; missing/expired/wrong token => 401/404 theo endpoint scope |
| OTP challenge | request OTP returns challengeId; verify requires challengeId+OTP; OTP one-time; replay rejected |
| Hold expiry | both PENDING_PAYMENT and PENDING_CONFIRMATION require holdExpiresAt; PENDING_PAYMENT timeout cancels unpaid prepayment and appointment; PENDING_CONFIRMATION timeout cancels appointment and refunds any prepayment 100%; all reservations released |
| Segment execution | each segment NOT_STARTED->IN_PROGRESS->COMPLETED; starting later segment does not reset Appointment; Appointment COMPLETED only after every segment completed and record finalizes |
| Execution role | requiredStaffRole cannot be RECEPTIONIST; GROOMING=CARE_STAFF_GROOMER; MEDICAL=NURSE/VETERINARIAN; MEDICAL Appointment has >=1 Vet segment |
| Inventory finalize | no inventory ledger on individual segment completion; only overall encounter finalization creates revision/delta exactly once |
| ServiceRecord concurrency | materials/professional/reopen/finalize require expectedVersion; stale version => 409 CONFLICT |
| Payment combinations | Appointment ONLINE_MOCK/FULL; Appointment PAY_AT_STORE/DEPOSIT or BALANCE; Order ONLINE_MOCK/COD/ORDER; invalid combinations rejected |
| Payment mock boundaries | mock/complete only ONLINE_MOCK Order; PAY_AT_STORE DEPOSIT/BALANCE use record-at-store; COD uses Mark Delivered |
| Cancel/refund | Store cancel needs only reason; server applies TA-30; no TRANSFER. Override optional REFUND_100/FORFEIT with reason |
| Reservation granularity | slotMinutes=15 technical config; a 60-minute segment occupies four staff time units and overlapping units are blocked |

| Refund retry same document | OrderRefund FAILED -> retry reuses same refund record; BookingRefund REJECTED may be re-requested, terminal refund remains unique per payment | state machine + DB index tests |
| Reject/confirmation timeout prepaid | system/store rejection or confirmation-hold-timeout with prepaid amount creates BookingRefund REQUESTED for 100%; no prepayment => no refund record | state + contract + concurrency tests |

## Final cross-document tests
| Guest ownership | verified guest token can list/get/cancel own AppointmentRequest, get/cancel/reschedule own Appointment, and read own Payment/BookingRefund/OrderReturn/OrderRefund; wrong guest token => 404/403 by resolver |
| Appointment request lifecycle | create -> SUBMITTED; staff review; approve/reject; customer/guest cancel only SUBMITTED/UNDER_REVIEW; approve/reject/cancel are CAS/idempotent |
| Segment lifecycle | segment 1 completion does not close Appointment; later segment starts only after previous COMPLETED; all segments + overall finalize required for COMPLETED |
| Slot overlap | 60-minute segment reserves 4 x 15-minute units; another segment overlapping any unit for same staff => SLOT_UNAVAILABLE |
| Payment target matrix | all 4 valid target/method/kind combinations pass; every other combination rejected by schema/application validator |
| Store payment boundary | PAY_AT_STORE DEPOSIT/BALANCE only via record-at-store; paymentMockComplete rejects; COD only paid via mark-delivered |
| ServiceRecord CAS | materials/professional/reopen/finalize require expectedVersion; stale version => 409; FINALIZED mutation without reopen => 409 |
| Material Catalog | no Material CRUD operation exists; seed items only; defaultMaterials references inventory seed |

| Idempotency-Key consistency | All business state-changing POST operations require Idempotency-Key and return the original result for same key+same body; auth/OTP and quote/validate operations are explicitly excluded | contract audit + replay tests |
