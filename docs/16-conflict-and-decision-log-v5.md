# 16 Conflict and Decision Log v5 + Final Report (review fixes)

V5 = V4 + 10 muc review feedback. Khong mo rong scope. Uu tien: Team Lead/Boss > Feature > Business Rule/Flow > domain > security > feasibility > legacy.

## 16.1 Xu ly 10 muc feedback
| Muc | Van de | Xu ly | Noi sua |
|---|---|---|---|
| 🟡 Return edge case | RECEIVED > REJECTED thieu disposition hang vat ly | TA-24 giu. Ghi ro: reject sau khi da nhan => **khong refund, khong nhap stock, khong tao OrderRefund; hang tra lai Customer xu ly thu cong/out-of-system**. Them vao `x-authz.sideEffects` cua `orderReturnReject`, 04, 09, 14, ADR-32 | 04, 07, 09, 14, 15 |
| 🔴 Blocker | FULFILLMENT_BRANCH_SOURCE chua chot | **Dong blocker**: `FulfillmentBranchResolver` theo priority list (xem hang ke tiep). Checkout biet branch de ISSUE stock; Order co `fulfillmentBranchId` cho scope Manager/Receptionist | 03, 04, 05, 06, 07, 08, 09, 14, 15 |
| 🔴 Contract bug | `orderReturnApprove` ghi PROCESSING>APPROVED; `orderReturnReceive` ghi APPROVED>RECEIVED, trong khi `transition` dung | Nguyen nhan: moi op co hai field (`stateTransition` va `transition`) lech nhau. Da dua ve mot field (hang duoi). Gia tri hien tai: Receive PROCESSING->RECEIVED, Approve RECEIVED->APPROVED | 07 |
| 🟠 Contract cleanup | `internalAppointmentsCreate` con ghi "cung recordType" | Doi thanh serviceType (cung serviceType + requiredStaffRole). Audit them check cho text nay | 07 |
| 🟠 Doc mismatch | 05 ghi deposit "override duoc" | Sua: bat coc => PERCENTAGE 30 khoa cung, khong override, dong nhat moi branch. Cung phat hien cau tuong tu trong 14 ("override NONE/FIXED/PERCENTAGE; max khi nhieu config") va da sua | 05, 14 |
| 🔴 Contract bug | Hai field transition khac nhau trong cung operation; 68/68 PASS khong bat duoc | **Chi giu `x-authz.stateTransition`**. Audit cu con doc key `transition` (nen khong thay lech). V5 audit: (1) cam key `transition`, (2) tap key x-authz co dinh, (3) so khop gia tri mong doi cho 11 operation Order/Return/Payment, (4) so khop tung operation voi bang trong 09 (13 operation duoc doi chieu). Tong 83/83 PASS | 07, 09, 14, 15 (ADR-30) |
| 🔴 Blocker | Cach chon branch | **FulfillmentBranchResolver = PriorityListResolver**: Admin cau hinh `system_settings.commerce.fulfillmentBranchPriority=[Q10,Q7,...]`; checkout duyet theo thu tu, chi xet branch ACTIVE; **branch dau tien du ton cho TOAN BO cart** => gan `Order.fulfillmentBranchId`; khong branch nao du => `422 INSUFFICIENT_INVENTORY`; danh sach rong => `422 FULFILLMENT_NOT_CONFIGURED`; khong tach don, khong geolocation/delivery zone. Dua tranh decrement => thu branch ke tiep. Doc/ghi qua `/admin/settings/commerce` (ADMIN), khong public | 04, 05, 07, 08, 10, 14 |
| 🟡 Validation gap | Cart chua co branch nhung Add Item kiem tra stock tong | Add item/update item chi kiem tra product/variant purchasable + ton tong quat. Kiem tra branch that o `checkoutValidate`/`checkoutQuote` (tra `fulfillable`, `fulfillmentIssue`) va `checkoutCreateOrder`. Vi du Q10=3, Q7=3, mua 5 => tong 6 nhung `fulfillable=false` | 04, 07, 14, ADR-31 |
| 🟠 Source-of-truth | serviceType vs recordType lech checklist | **Dong bo ve phia spec**: serviceType tren Service/Appointment, recordType chi la snapshot ServiceRecord (V4). Checklist/feature trong sheet con ghi Service.recordType (va deposit "default 30% + override"): da lap danh sach 15 cell can sua trong `17-sheet-sync-serviceType-deposit-v5.csv`. **Khong tu sua file xlsx cua Boss** | 17 (moi), 16 |

## 16.2 Open decisions
**Khong con.** FULFILLMENT_BRANCH_SOURCE da dong theo quy tac priority list. Luu y nguon goc: quy tac nay den tu **review feedback**, khong phai Team Lead decision ghi trong Master Prompt; neu Boss muon thu tu uu tien khac, chi can doi `fulfillmentBranchPriority`. Gia tri danh sach branch la du lieu cau hinh, khong phai quy tac.

## 16.3 Gia tri cau hinh va TA con lai
TA-01, 02, 04, 05, 08, 09, 10, 11, 12, 19-22, 24-29 giu nhu V4 (xem ban V4 muc 16.9). TA-24 duoc ghi them disposition (muc tren). Cau hinh Admin: `freeShippingThreshold` (mac dinh 500000), `shippingFlatFee`, `fulfillmentBranchPriority`.

## 16.4 Rui ro con lai
1. Resolver chon branch theo thu tu uu tien, khong toi uu ton hay khoang cach: khach co the nhan hang tu branch xa. Chap nhan theo thiet ke. 2. Figma moi chua co: FE chua handoff. 3. Chua co code: test tu dong chua chay. 4. Tong ton du nhung khong branch nao du => khach khong mua duoc don lon (khong tach don, theo thiet ke). 5. Danh sach uu tien phai duoc Admin cau hinh truoc khi vao van hanh, nguoc lai checkout tra FULFILLMENT_NOT_CONFIGURED. 6. Sheet chua duoc sua (15 cell can dong bo) cho den khi Boss ap dung. 7. M20-M22 (P1) chua co contract.

## 16.5 Kiem tra
OpenAPI 3.1.1 hop le, 143 operation, operationId duy nhat. CSV 110 dong. Audit 83/83 PASS:
| Check | Ket qua | Chi tiet |
|---|---|---|
| operationId unique | PASS | 143 ops |
| all $ref targets exist | PASS |  |
| unused schemas | PASS |  |
| every op has x-authz | PASS |  |
| every op has security key | PASS |  |
| non-public ops declare 401 | PASS |  |
| sensitive POST ops carry Idempotency-Key | PASS |  |
| no server-controlled fields in request schemas | PASS | [] |
| no legacy enum values | PASS | set() |
| no legacy tokens in spec text | PASS |  |
| duplicate enum value-sets | PASS | [] |
| systemRole has no staff sub-roles | PASS |  |
| serviceType only GROOMING|MEDICAL | PASS |  |
| no serviceId (single) in AppointmentCreate | PASS |  |
| Appointment has services[] and no serviceId | PASS |  |
| ServiceRecord statuses include WAITING_VET_REVIEW | PASS |  |
| services write is ADMIN only | PASS |  |
| branch service config write excludes global service edit | PASS |  |
| finalize roles exclude NURSE | PASS | ['CARE_STAFF_GROOMER(GROOMING)', 'VETERINARIAN(MEDICAL)'] |
| submit-review is NURSE only | PASS |  |
| return error codes defined | PASS |  |
| OrderReturn separate from OrderRefund | PASS |  |
| no ledger update/delete endpoints | PASS |  |
| no direct stock write endpoint | PASS |  |
| Manager not in services write | PASS |  |
| shipping never refunded | PASS |  |
| problem exposes suggestedGroups | PASS |  |
| no INSPECTION warehouse anywhere | PASS |  |
| no tax in refund | PASS |  |
| return approve has no client amount | PASS |  |
| block/unblock ADMIN only | PASS |  |
| customer list/detail only MANAGER/ADMIN | PASS |  |
| no customer.branchId in Customer schemas | PASS |  |
| critical path M05->M08 operations present | PASS | [] |
| every op has x-audience | PASS |  |
| both Angular audiences covered | PASS |  |
| password policy pattern on register | PASS |  |
| PaymentStatus has terminal failure states | PASS |  |
| order status matches sheet BF02 | PASS |  |
| checkout request has no server-computed price | PASS |  |
| global catalog writes ADMIN only | PASS |  |
| serviceType canonical on Service and Appointment | PASS |  |
| recordType only on ServiceRecord (snapshot) | PASS |  |
| DepositType NONE|PERCENTAGE, no FIXED | PASS |  |
| deposit locked to 30 | PASS |  |
| no depositOverride anywhere | PASS |  |
| no fulfillmentBranchId selection by client | PASS |  |
| no branchId param on product queries | PASS |  |
| appointment payment methods exclude COD | PASS |  |
| order payment methods exclude PAY_AT_STORE | PASS |  |
| payment target types ORDER|APPOINTMENT | PASS |  |
| payment cancel op present | PASS |  |
| payment failure compensation documented | PASS |  |
| return order PROCESSING->RECEIVED->APPROVED | PASS |  |
| receive is RECEPTIONIST only; approve/reject MANAGER/ADMIN | PASS |  |
| internal appointment create present and scoped | PASS |  |
| internal create: customerId XOR contact | PASS |  |
| public AppointmentCreate has no customerId | PASS |  |
| every authenticated op declares resolver | PASS |  |
| no generic resource.branchId in spec | PASS |  |
| manager cannot write global Product/Category/Service/Voucher | PASS |  |
| variant CRUD present | PASS |  |
| return quote + checkout validate present | PASS |  |
| no TA-17/TA-18/max deposit in spec | PASS |  |
| approve/reject/cancel fields server-authority: no cancelledBy/override flags in bodies | PASS |  |
| x-authz has no 'transition' key (single canonical stateTransition) | PASS |  |
| x-authz keys are within canonical set | PASS |  |
| return/order/payment stateTransition equals expected | PASS | [] |
| stateTransition matches doc 09 tables (13 operations compared) | PASS | [] |
| reject-after-RECEIVED disposition documented (no refund, no stock, manual/out-of-system) | PASS |  |
| internal appointment text uses serviceType | PASS |  |
| recordType appears only in ServiceRecord operations | PASS | [] |
| no 'cung recordType' anywhere | PASS |  |
| fulfillmentBranchPriority only in admin settings schema | PASS |  |
| settings update is ADMIN under /admin/settings | PASS |  |
| quote/validate expose fulfillable | PASS |  |
| cart add-item checks purchasable + general stock only | PASS |  |
| checkout documents priority-list resolver and no split | PASS |  |
| FULFILLMENT_NOT_CONFIGURED error defined | PASS |  |
| docs: no 'deposit override duoc' wording and no stale FULFILLMENT_BRANCH_SOURCE open decision | PASS | [] |
| CSV API fields exist in OpenAPI schemas | PASS | [] |
| CSV enums match OpenAPI enums | PASS | [] |
| core fields present in schema and csv | PASS |  |
Ghi chu trung thuc ve audit: ket qua 68/68 cua V4 la dung voi cac check khi do, nhung cac check do khong dung toi cap key `x-authz` va khong doi chieu voi bang state trong 09, nen khong bat duoc lech `stateTransition`/`transition`. Check V5 bo sung de chan loai loi nay. Lan chay dau cua V5 co 1 FAIL (cau override trong 14 la that; cau trong 09 la false positive ve `bookingRefundOverride`, da dieu chinh heuristic). Chua tu dong hoa: so sanh ma tran 08 voi `x-authz.roles` tung dong.

## 16.6 READINESS
| Status | Ket qua | Ly do |
|---|---|---|
| BUSINESS_SPEC_V5_READY | **DAT** | Khong con open decision; moi quyet dinh Team Lead va feedback da ap dung |
| BACKEND_GREENFIELD_READY | **DAT** | Blocker fulfillment da dong; checkout co the chay E2E sau khi Admin cau hinh priority list |
| FE_HANDOFF_READY | **CHUA DAT** | Chua co UI moi duoc duyet; Figma cu khong truy cap duoc |

| Area | v4 | v5 | Status |
|---|---|---|---|
| Fulfillment branch | open decision, checkout khong E2E | priority list resolver, `fulfillable` o validate/quote | DAT |
| Contract state | hai field lech nhau | `stateTransition` duy nhat + audit doi chieu 09 | DAT |
| Return reject | thieu disposition | no refund, no stock, out-of-system | DAT |
| Cart validation | add item kiem ton tong, chua phan lop | add item: purchasable + ton tong; branch o validate/checkout | DAT |
| Deposit docs | con cau "override duoc" | khoa 30%, khong override | DAT |
| serviceType/recordType | lech checklist | spec dong nhat; 15 cell sheet can sua (file 17) | DAT phia spec, sheet CHUA sua |
| Internal booking text | "cung recordType" | serviceType | DAT |
