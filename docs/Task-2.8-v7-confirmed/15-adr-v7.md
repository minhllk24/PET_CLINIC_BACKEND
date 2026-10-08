# 15 ADR v7 (current decisions through final Task 2.8 review)

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
| ADR-08 | Appointment = cac service segment doc lap ve Staff (thay ADR-08 cu, bo rang buoc dong nhat role) | review feedback V7 | mot serviceType; moi segment co requiredStaffRole, duration, assignedStaffId rieng; noi tiep; backend tu tim va reserve staff; chi kha dung khi moi segment tim duoc staff | availability phuc tap hon (tim staff tung segment) | rang buoc dong nhat role; customer chon staff |
| ADR-09 | Thanh toan lich hen: ONLINE_MOCK 100% / PAY_AT_STORE coc 30% | review feedback V7 | deposit 30% chi cho PAY_AT_STORE tren final amount sau voucher; ghi nhan ngay; APPLIED tu dong khi COMPLETED; balance chi thu phan con lai | online khong co deposit | deposit cho ca online; APPLIED gan voi balance payment |
| ADR-10 | Payment mock, state that | sheet | PaymentProvider + Mock; status khop sheet | -- | gateway that |
| ADR-11 | Inventory ledger append-only + stocks projection | rule 2 | transactions bat bien; mot vi tri ton kho moi branch | hoan hang khong tu dong nhap kho | them vi tri ton kho phu |
| ADR-12 | Service record revision + inventory delta | sheet 4.4 | revision collection, delta | them collection | overwrite ledger |
| ADR-13 | Medical: Nurse submit, Vet finalize | sheet | WAITING_VET_REVIEW | them buoc | Nurse duoc finalize |
| ADR-14 | `serviceType` la ten chinh thuc | sheet freeze Service.serviceType | mot ten duy nhat; snapshot sang Appointment va ServiceRecord | doi ten so voi v2 | serviceType |
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
| ADR-29 | FulfillmentBranchResolver = priority list | review feedback, dong blocker FULFILLMENT_BRANCH_SOURCE | `system_settings.commerce.fulfillmentBranchPriority`; branch ACTIVE dau tien du ton cho toan bo cart; khong tach don; khong geolocation | khong toi uu khoang cach/ton | Customer chon, branch gan nhat, branch mac dinh, tach don |
| ADR-30 | Mot field state canonical `x-authz.stateTransition` | review feedback (hai field lech nhau) | bo `transition`; audit so khop voi 09 | -- | giu hai field |
| ADR-31 | Cart chi validate purchasable + ton tong quat | review feedback | validation branch o checkoutValidate/Quote/Create | khach co the them vao cart roi moi biet khong fulfill | kiem tra branch tai add item |
| ADR-32 | Reject sau RECEIVED khong refund, khong nhap stock | review feedback, TA-24 | hang xu ly thu cong ngoai he thong | mat dau vet he thong cho hang tra lai | tu dong nhap kho/hoan tien |
| ADR-33 | Assign staff khong phai CONFIRMED | review feedback V7 | confirm la action rieng cho moi nguon tao (tu dat, dat ho, duyet request) | them mot buoc | assign = CONFIRMED |
| ADR-34 | Reassign theo segment | review feedback V7 | Manager/Receptionist doi staff trung requiredStaffRole va available | -- | gan staff khac role |
| ADR-35 | COD gan voi delivery | review feedback V7 | COD chi PAID khi Mark Delivered; record-at-store chi Appointment PAY_AT_STORE | -- | dung chung flow thanh toan tai cua hang |
| ADR-36 | CONFIRMED TA-30 | User confirmed on 08/10/2026 (Asia/Saigon) | Retain 30% finalAmount for late cancel/no-show; refund prepaid remainder | Equal penalty across options | Full forfeiture ONLINE is not an accepted rule |
| ADR-37 | CustomerDetail `accountStatus` nullable trước khi có User | activation lifecycle | `customers` không lưu accountStatus; API trả null khi `activationStatus=NO_ACCOUNT/PENDING_ACTIVATION` | FE phải xử lý null | tạo User giả sớm |
| ADR-38 | Service và Branch tách global/branch | scope consistency | Service global không chứa `contactInfo.branchId`; capacity chỉ ở BranchServiceConfig, bỏ `branches.slotCapacity` | lookup Branch khi cần | field branch trên Service / slotCapacity trên Branch |
| ADR-39 | ServiceRecord encounter-level aggregate | scope/time | Một ServiceRecord cho toàn Appointment; actualMaterials aggregate; không tách record theo service segment | precision thấp hơn segment-level | thêm nhiều ServiceRecord |
| ADR-40 | Material Catalog seed-only | scope/time | MATERIAL inventory items là seed data, không mở CRUD Material; Admin chỉ cấu hình defaultMaterials | phải seed trước môi trường demo | module Material Management |
| ADR-41 | Appointment hold expiry | booking integrity | `PENDING_PAYMENT` và `PENDING_CONFIRMATION` đều phải có `holdExpiresAt`; hết hạn auto-cancel + release reservation; thời gian hold là config. Nếu timeout tại PENDING_CONFIRMATION mà đã có prepayment, tạo BookingRefund 100%. | cần job | giữ slot vô hạn hoặc để mất prepayment do system timeout |


| ADR-42 | Catalog read scope | final review | Public/CUSTOMER chỉ đọc ACTIVE; MANAGER/ADMIN đọc mọi status; write chỉ ADMIN | optional bearer trên GET catalog | public nhìn thấy inactive |
| ADR-43 | Appointment ONLINE_MOCK auto-PAID | final review | Khi create, Payment FULL = PAID ngay trong transaction; Appointment vào PENDING_CONFIRMATION | không có payment step riêng cho Appointment online | tạo PENDING_PAYMENT không cần thiết |
| ADR-44 | Payment-target synchronization on cancellation | final review | Target CANCELLED + Payment PENDING => Payment CANCELLED cùng tx; callback sau đó không được PAID | terminal target trả PAYMENT_STATE_ERROR | target/payment lệch trạng thái |
| ADR-45 | ServiceRecord mutation guards | final review | actualMaterials chỉ role thực hiện và state IN_PROGRESS/REOPENED; professional chỉ Veterinarian và không sửa FINALIZED trước reopen | reopen tạo revision trước khi sửa | inventory/professional data bị sửa sau finalize |


| ADR-46 | ServiceExecutionRole tách khỏi StaffSubRole | final consistency review | Service.requiredStaffRole chi CARE_STAFF_GROOMER/NURSE/VETERINARIAN; RECEPTIONIST khong execute service | them enum ServiceExecutionRole | dung StaffSubRole tong quat |
| ADR-47 | Segment execution state | final consistency review | Appointment.services[].executionStatus NOT_STARTED->IN_PROGRESS->COMPLETED; record/inventory chi finalize overall khi tat ca segment xong | them state field | mot finalize dong ca truoc khi segment khac xong |
| ADR-48 | Booking timeout ap dung ca hai hold states | final consistency review | PENDING_PAYMENT va PENDING_CONFIRMATION cung co holdExpiresAt; Payment PENDING cua prepayment/Order online cung expiresAt khi ap dung; reservation HELD mirror deadline | job timeout | timeout mot phan flow lam slot treo |
| ADR-49 | Guest token schemes | final security review | `X-Guest-Lookup-Token` cho transaction lookup; `X-Guest-Cart-Token` cho cart/checkout | them security schemes | dung bearer/anonymous mo rong |
| ADR-50 | Reservation time units | final consistency review | slotMinutes=15 technical default; reserve moi unit de chong overlap day du | them time-unit reservations | unique chi theo segment start |
| ADR-51 | Booking cancellation has no TRANSFER outcome | final scope cleanup | refund/forfeit only; no money transfer workflow in Web 2 | giam scope | transfer ngoai pham vi |
| ADR-52 | OTP challenge one-time | final security review | OTP request tra challengeId; verify challengeId+OTP; success one-time | ngan replay | verify chi bang OTP |

| ADR-53 | AppointmentRequest operational lifecycle | completeness | Add list/get/cancel for Customer/Guest and staff review; Guest uses lookup token | request-only flow otherwise orphaned |
| ADR-54 | Segment execution status | data integrity | `executionStatus` per Appointment service; overall completion only after all segments + encounter finalize | first segment finalize could close appointment early |
| ADR-55 | Guest token protected resource access | security | `X-Guest-Lookup-Token` is required for guest-owned Appointment/Payment/Request/Refund/Return lookups | guest ownership leakage |

## V7 correction contract

PAY_AT_STORE luôn cọc round(finalAmount * 0.30) bằng ONLINE_MOCK; tạo Payment DEPOSIT/PENDING và Appointment PENDING_PAYMENT; Customer/Guest hoàn tất qua paymentMockComplete trong hold 10 phút; thành công sang PENDING_CONFIRMATION. BALANCE thu tại quầy sau COMPLETED. ONLINE_MOCK giữ flow mock FULL/PAID tại create của v6.

TA-30 (CONFIRMED 08/10/2026): hủy >=24h hoàn 100%; hủy <24h/no-show giữ round(finalAmount * 0.30), hoàn phần đã trả còn lại. ONLINE_MOCK hoàn 70%; PAY_AT_STORE mất cọc 30%. Store/system cancel hoàn 100%; reschedule-override giữ payment trên cùng Appointment.

MEDICAL (CONFIRMED 08/10/2026): Appointment có thể gồm service do NURSE và/hoặc VETERINARIAN thực hiện, không bắt buộc Vet execution segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole = VETERINARIAN. ServiceRecord MEDICAL bắt buộc được Veterinarian review và finalize. Nurse chỉ hoàn tất phần thực hiện và submit; khi mọi segment COMPLETED, hồ sơ sang WAITING_VET_REVIEW. reviewerStaffId là Vet được Receptionist/Manager/Admin giao riêng theo branch; chỉ reviewer Vet ghi professional và finalize encounter. Review không phải service segment và không tạo reservation lịch.

Product global chỉ Admin CRUD, không nhập stock trong Product form. Stock mặc định 0 (row có thể lazy-created); initial stock qua RECEIPT reason INITIAL_STOCK. Procurement/PO/supplier approval ngoài scope. Quantity chỉ đổi qua ledger transaction; threshold nằm ở inventory_stocks theo (branchId, inventoryItemId), default 0; Manager assigned branches/Admin ALL cập nhật threshold, không tạo movement stock. Transfer Manager cần cả hai branch trong scope.
