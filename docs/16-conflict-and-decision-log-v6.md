# 16 Conflict and Decision Log v6 + Final Report (appointment staffing + payment flow)

V6 = V5 + 7 muc feedback ve Appointment va thanh toan. Khong mo rong scope. Uu tien: Team Lead/Boss > Feature > Business Rule/Flow > domain > security > feasibility > legacy.

## 16.1 Xu ly 7 muc feedback
| Muc | Van de | Xu ly | Noi sua |
|---|---|---|---|
| 🔴 Business rule | Internal booking: assign staff = CONFIRMED | **Go bo.** `internalAppointmentsCreate` ket thuc o `PENDING_PAYMENT` hoac `PENDING_CONFIRMATION` ke ca khi co `staffAssignments`; chi `appointmentsConfirm` (action rieng) sang `CONFIRMED`. Ap dung ca duyet appointment-request. `AppointmentConfirm` (body gan staff) bi xoa. Audit kiem tra transition khong chua CONFIRMED | 04, 07, 09, 14, ADR-33 |
| 🔴 Business rule | Payment Appointment chua tach online va pay-at-store | **ONLINE_MOCK = tra 100% finalAmount sau voucher ngay khi dat** (payments.kind `FULL`, depositAmount = 0, balance = 0). **PAY_AT_STORE = coc 30% finalAmount de giu slot** (kind `DEPOSIT`), 70% thu tai cua hang (kind `BALANCE`). **Deposit 30% chi ap dung cho PAY_AT_STORE.** `paymentMethod` bat buoc o tu dat, dat ho, duyet request. `bookingPaymentCreate` bi bo (payment duoc tao trong transaction booking) | 04, 05, 07, 09, 10, 14, ADR-09 |
| 🟠 Payment lifecycle | Deposit chi hop le khi thanh toan balance | **Ghi nhan ngay khi coc thanh cong:** `pricing.paidAmount` tang ngay (vd hoa don 1,000,000, coc 300,000 => paidAmount 300,000, deposit HELD). Khi COMPLETED deposit `APPLIED` **tu dong (system)**, chi thu them 700,000. Transition cua `bookingBalancePaymentCreate` khong con lien quan deposit; chi Receptionist/Manager/Admin tao | 04, 07, 09, 14 |
| 🔴 Business rule | COD Order dung chung flow ghi nhan tai cua hang | `paymentRecordAtStore` **chi cho Payment Appointment PAY_AT_STORE** (DEPOSIT/BALANCE); Order COD khong dung duoc (422). **COD chi PAID khi Mark Delivered.** Go "record-at-store" khoi quyen Order trong ma tran 08 | 07, 08, 09, 14, ADR-35 |
| 🟠 Contract cleanup | Rule tat ca service phai cung requiredStaffRole | **Go bo hoan toan.** Xoa `INCOMPATIBLE_STAFF_ROLES`, `suggestedGroups`. Mot Appointment: cung `serviceType`, moi service giu `requiredStaffRole`, duration, `assignedStaffId` rieng | 04, 07, 14, ADR-08 |
| 🔴 Scheduling logic | Customer bi buoc chon Staff / chi ho tro mot role | Customer **khong chon staff** (schema public khong co truong staff, audit kiem tra). Backend tu tim va reserve staff **cho tung segment**; segment **noi tiep** theo thu tu. Slot **chi kha dung neu tat ca segment tim duoc staff**; khong thi khong tra trong availability va tao => `409 SLOT_UNAVAILABLE` (rollback tat ca). `Appointment.assignedStaffId` (cap appointment) bi xoa, thay bang `services[].assignedStaffId`. `slot_reservations` tach STAFF (unique staff+slot) va CAPACITY. ServiceRecord dung `assignedStaffIds` | 03, 04, 05, 06, 07, 08, 10 |
| 🟠 Staff reassignment | Chua dinh nghia cach Manager/Receptionist doi staff | Them `appointmentSegmentReassign` (PUT `/appointments/{id}/segments/{serviceId}/staff`): Receptionist (authorizedBranchIds), Manager (assignedBranchIds), Admin. Staff moi phai **trung requiredStaffRole** cua segment (`422 STAFF_ROLE_MISMATCH`), thuoc authorizedBranchIds, co shift, khong trung lich (`409 STAFF_UNAVAILABLE`). Khong gan khac role chi vi con trong lich. Khong doi trang thai Appointment | 03, 07, 08, 09, 14, ADR-34 |

Rule chot: **Appointment = nhieu service segment doc lap ve Staff.** Moi segment: serviceType + requiredStaffRole + duration + assignedStaff. Backend tu tim va reserve theo segment; customer khong chon staff; toan bo Appointment chi available khi moi segment tim duoc staff.
Cac diem da bo khoi spec: (1) "service trong Appointment phai cung requiredStaffRole"; (2) assign staff = CONFIRMED; (3) deposit 30% cho online; (4) flow "ghi nhan thanh toan tai cua hang" cho COD.

## 16.2 Open decisions
**Khong co.**

## 16.3 Gia dinh ky thuat moi/doi (can Boss biet)
| ID | Noi dung |
|---|---|
| TA-30 | Quy tac huy/no-show (>=24h hoan 100%, <24h va no-show khong hoan) ap dung cho **khoan tra truoc**: coc 30% voi PAY_AT_STORE, **100% voi ONLINE_MOCK**. Sheet chi viet rule cho "deposit"; ap dung cho online la suy dien |
| TA-31 | Segment noi tiep theo thu tu `serviceIds`; chon staff ung vien theo thu tu co dinh (staffId) cho den khi het ung vien (greedy du vi cac segment noi tiep, khong chong thoi gian) |
| TA-32 | Duyet appointment-request nhan `paymentMethod` bat buoc va `staffAssignments` tuy chon; `supportStaffIds` (phau thuat, theo sheet BF06) giu o cap Appointment, khong thuoc segment |
| TA-33 | PAY_AT_STORE ma khong service nao bat coc: khong coc, vao thang PENDING_CONFIRMATION, thu het tai cua hang |
TA cu con hieu luc: TA-01, 02, 04, 05, 08, 09, 10, 11, 12, 19-22, 24-29 (xem v4/v5). TA-07 va CD-14 (cung requiredStaffRole) bi huy.

## 16.4 Rui ro con lai
1. **TA-30:** huy <24h mot don ONLINE_MOCK se mat 100% khoan da tra. Dung theo rule hien co nhung co the nang; Boss nen xac nhan. 2. Nhieu role trong mot Appointment (Vet + Nurse) lam slot kho kha dung hon; khong co fallback tach lich. 3. Dat PAY_AT_STORE khong service bat coc khong can coc: rui ro no-show (khong phai rule moi). 4. Cac segment cua mot ServiceRecord co nhieu staff: quyen theo sub-role va viec duoc giao (assignedStaffIds), chua co phan quyen rieng theo segment. 5. Figma moi chua co: FE chua handoff. 6. Chua co code: test tu dong chua chay. 7. Resolver fulfillment theo thu tu uu tien (V5) khong toi uu khoang cach. 8. Sheet chua duoc sua (file 17, 18 dong).

## 16.5 Kiem tra
OpenAPI 3.1.1 hop le, 143 operation (bo `bookingPaymentCreate`, them `appointmentSegmentReassign`), CSV 117 dong. Audit 108/108 PASS (V6 them 25 check cho staffing, payment, confirm, COD):
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
| stateTransition matches doc 09 tables (24 operations compared) | PASS | [] |
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
| rule 'same requiredStaffRole' removed (no INCOMPATIBLE_STAFF_ROLES / suggestedGroups in spec) | PASS |  |
| Appointment.services[] segments carry requiredStaffRole, duration, own assignedStaffId, sequence | PASS |  |
| public AppointmentCreate has no staff field | PASS |  |
| internal create: optional per-segment staffAssignments, no single assignedStaffId | PASS |  |
| internal create never transitions to CONFIRMED | PASS |  |
| request approval creates appointment not CONFIRMED | PASS |  |
| confirm is a separate action without staff input | PASS |  |
| reassign op: per segment, role-matched, not Customer | PASS |  |
| error codes STAFF_ROLE_MISMATCH, STAFF_UNAVAILABLE defined | PASS |  |
| availability: slot available only if all segments staffable | PASS |  |
| slot response exposes no staff | PASS |  |
| paymentMethod required for appointment create (online vs pay-at-store explicit) | PASS |  |
| ONLINE_MOCK = 100% FULL payment; PAY_AT_STORE = 30% DEPOSIT, rest at store | PASS |  |
| PaymentKind includes FULL (online appointment) and DEPOSIT | PASS |  |
| deposit amount documented as PAY_AT_STORE only | PASS |  |
| paidAmount recorded immediately (not waiting for balance) | PASS |  |
| balance payment does not drive deposit state | PASS |  |
| deposit APPLIED set by system on COMPLETED | PASS |  |
| balance payment: staff only (no customer self) | PASS |  |
| record-at-store limited to Appointment PAY_AT_STORE; COD excluded | PASS |  |
| COD paid only on Mark Delivered | PASS |  |
| bookingPaymentCreate removed (payment created inside booking tx) | PASS |  |
| prepaid wording on store-cancel/cancel-override | PASS |  |
| ServiceRecord uses assignedStaffIds (segment staff) | PASS |  |
| appointment start scoped to any segment staff | PASS |  |
| Order paymentMethod enum still ONLINE_MOCK|COD | PASS |  |
| CSV API fields exist in OpenAPI schemas | PASS | [] |
| CSV enums match OpenAPI enums | PASS | [] |
| core fields present in schema and csv | PASS |  |
Ghi chu: lan chay dau co 3 FAIL that (spec con ghi INCOMPATIBLE_STAFF_ROLES o mo ta 422 va availability; CSV con field suggestedGroups, enum allowedActions/kind cu); sau do 1 FAIL them tu check doi chieu bang 09: `appointmentsCancelOverride` ghi `->CANCELLED`, `appointmentsReschedule` ghi `(rescheduleCount+1)` vs bang 09 dung `PENDING*`; da sua spec va bang 09 cho khop. Chua tu dong hoa: so sanh ma tran 08 voi `x-authz.roles` tung dong.

## 16.6 READINESS
| Status | Ket qua | Ly do |
|---|---|---|
| BUSINESS_SPEC_V6_READY | **DAT** | Moi feedback ap dung, khong open decision; TA-30 la rui ro can Boss xem |
| BACKEND_GREENFIELD_READY | **DAT** | Domain, schema, API, authz, state, commerce, booking (segment staffing), payment, return, inventory, service record da du |
| FE_HANDOFF_READY | **CHUA DAT** | Chua co UI moi duoc duyet; Figma cu khong truy cap duoc |

| Area | v5 | v6 | Status |
|---|---|---|---|
| Internal booking | assign staff co the = CONFIRMED | PENDING_*; confirm rieng | DAT |
| Appointment payment | deposit 30% chung cho moi payment | ONLINE_MOCK 100% / PAY_AT_STORE coc 30% | DAT |
| Deposit lifecycle | APPLIED gan voi balance payment | ghi nhan ngay; APPLIED tu dong khi COMPLETED | DAT |
| COD | dung chung record-at-store | chi PAID khi Mark Delivered | DAT |
| Staff rule | cac service cung requiredStaffRole | segment doc lap, moi segment staff rieng | DAT |
| Staff selection | backend chon, nhung 1 role | tu tim va reserve theo segment, noi tiep, tat ca segment moi kha dung | DAT |
| Reassign | thieu | per segment, cung role, available | DAT |
| Sheet sync | 15 cell | 18 cell (them rule thanh toan, staffing, COD) | CHUA sua sheet |
