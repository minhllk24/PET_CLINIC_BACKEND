# 13 Security Review v6 (greenfield baseline, OWASP API Top 10 2023)

## Authentication
argon2id hoac bcrypt cost >= 12. **Mat khau toi thieu 8 ky tu, co chu hoa va so** (Log), validate o schema (`pattern`) va o server. Access JWT 15 phut; refresh opaque, hash, rotation, reuse detection, revoke khi BLOCKED. `lastLogin` chi khi login thanh cong. OTP CSPRNG 6 so, hash, TTL 5 phut, 5 lan, resend 30s, rate limit theo identifier + IP.
## Authorization
Theo 08. Policy tap trung, filter trong query. Manager xem Customer chi qua `activityBranchIds`; Block/Unblock chi Admin. Product, Category, Service, Voucher, settings chi Admin ghi. Client khong gui authority fields.
## Commerce
- Gia luon do server tinh lai tai quote/checkout; Catalog read scope: public/CUSTOMER chi ACTIVE, MANAGER/ADMIN xem moi status; write catalog chi ADMIN. client khong gui gia, discount, shipping, tong.
- Cart: Customer theo ownership; Guest theo `X-Guest-Cart-Token` (server luu hash, TTL, khong doan duoc). Khong liet ke cart.
- Checkout: Idempotency-Key bat buoc; tru ton bang conditional decrement trong tx (khong am, khong oversell); voucher quota consume trong cung tx; mot voucher/giao dich.
- Order: moi transition kiem tra role + scope branch + state; Guest chi xem/gia lap tac vu tren giao dich qua `X-Guest-Lookup-Token` sau OTP; khong hard delete.
- Payment failure/cancel: FAILED/CANCELLED/EXPIRED => compensating tx idempotent; Payment PENDING cua target CANCELLED phai chuyen CANCELLED; callback mock khong duoc dua payment cua target CANCELLED ve PAID (Order CANCELLED, RECEIPT, restore voucher); callback lap lai la no-op; unique ledger + unique voucher_usages chong hoan 2 lan; khong retry/queue.
- Return/refund: window 7 ngay, `returnableQty` va so tien hoan do server tinh; Manager/Admin khong nhap tay; Receptionist chi process/receive; Manager/Admin approve/reject; APPROVED chi sau RECEIVED; unique 1 refund / return; conditional `returnReservedQty`.
- Staffing: Customer/Guest khong gui staff; ServiceRecord materials update chi Care/Groomer hoac Nurse va chi IN_PROGRESS/REOPENED; expectedVersion bat buoc de chong lost update; professional update chi Veterinarian va khong sua FINALIZED truoc reopen; `staffAssignments` va reassign chi cho Receptionist/Manager/Admin theo branch, staff phai trung requiredStaffRole, available (chong gan sai role). Phan cong khong doi trang thai; chi appointmentsConfirm. `PENDING_PAYMENT va PENDING_CONFIRMATION co `holdExpiresAt`; timeout phai cancel Payment PENDING neu co va release reservation.
- Thanh toan lich hen: ONLINE_MOCK 100% va PAID ngay khi tao Appointment; PAY_AT_STORE cọc 30% neu co service bat coc; target cancellation dong bo Payment PENDING -> CANCELLED; record-at-store chi Appointment PAY_AT_STORE; COD chi PAID khi Mark Delivered.
- Dat ho noi bo: Receptionist/Manager/Admin theo branch; customerId XOR contact; Guest khong co account; actor/source do server.
- Resolver: moi resource scope theo bang 08; Payment/Pet/Customer/Cart khong co truong branch.
- Rate limit: login, OTP, guest lookup, voucher validate (chong do ma), checkout, return.
- Settings freeship/shipping chi Admin ghi, co audit. Appointment system timeout/store rejection voi prepayment tao refund 100%; customer <24h/no-show rule khong ap dung cho system fault.
## Input
OpenAPI validation (`additionalProperties:false`), ObjectId pattern, enum, uniqueItems; chan key `$` va `.`; khong spread body; payload limit; tim kiem `q` dung text index, gioi han do dai.
## Data integrity
Ledger, revision, audit append-only; stock >= 0 (validator); khong hard delete Order, appointment, payment, ledger.
## Secrets, logging, transport
Khong secret trong tai lieu; khong log OTP/password/token/cartToken; HTTPS, HSTS, helmet; CORS allowlist cho hai origin (Customer Angular, Admin Angular).
## Provider
Email/SMS/Payment qua interface; mock chi non-production.
## Audit bat buoc
block/unblock (Admin), cap nhat fulfillmentBranchPriority, role/branch assignment, internal appointment create, payment cancel/expire compensation, shift, BranchServiceConfig update, Service/Product/Category/Voucher/settings write, order create/cancel/confirm/process/ship/deliver, return approve/reject/receive, refund process, booking refund/override, appointment override/store-cancel, inventory moi loai, service record submit/finalize/reopen.

- `requiredStaffRole` dung ServiceExecutionRole; RECEPTIONIST khong the execute service. MEDICAL Appointment phai co Vet segment de finalize.

- Payment: schema + application validation constrain target/method/kind combinations; mock-complete chi ONLINE_MOCK Order; PAY_AT_STORE ghi tai quay; COD chi PAID tai delivery.

- Guest ownership: Appointment/Payment/BookingRefund/OrderReturn/OrderRefund/AppointmentRequest lookup endpoints require `X-Guest-Lookup-Token`; token is short-lived and issued only after OTP verification.

- Business state-changing POST operations use `Idempotency-Key`; authentication/OTP and read-only validation/quote operations are excluded because they have separate one-time/CAS semantics.
