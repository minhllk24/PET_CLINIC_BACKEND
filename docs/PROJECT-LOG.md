# 📋 PROJECT LOG – Dr. Pet's House (WEB-2 Backend)

> **Dự án:** Dr. Pet's House – Pet Clinic Management System
> **Repository BE:** github.com/minhllk24/PET_CLINIC_BACKEND (branch: `feat/foundation-v6`)
> **Repository FE:** github.com/minhllk24/BE_A_PET_CLINIC-FRONTEND (branch: `build-init`)
> **Production URL:** https://www.drpetshouse.lat/
> **Backend Render:** https://pet-clinic-backend-a4lj.onrender.com/
> **Cập nhật bởi:** An Thai | **File này dành cho:** Project Manager (PM)

---

## HƯỚNG DẪN SỬ DỤNG FILE NÀY

File này ghi nhận toàn bộ tiến độ phát triển Backend theo từng ngày. Mỗi entry bao gồm:
- **Ngày** – Thời điểm thực hiện
- **Người thực hiện** – Ai commit/push
- **Task** – Task nào trong backlog
- **Nội dung thay đổi** – Chi tiết kỹ thuật
- **Files thay đổi** – Danh sách file bị ảnh hưởng
- **Trạng thái test** – Kết quả kiểm thử tự động
- **Ghi chú cho FE** – Những gì FE cần biết/cập nhật

---

## LOG ENTRIES

---

### 📅 2026-10-23 | Người thực hiện: An Thai

**Task:** Pull & Đồng bộ toàn diện Base Foundation v6 + PM Feedback Resolution (Render Keep-Alive, Only-Text Admin, Demo Passwords & Flexible Staff Creation)

**Nội dung:**
1. ✅ Pull và tích hợp thành công 6 commits lớn từ `origin/feat/foundation-v6`:
   - Task 3.14 Inventory Stock (`thresholdConfigured`, snapshot branch/actor, inventory summary).
   - Capacity Slot Engine & Blocked Windows (`includeFull=true`, `occupancy`, `operation-slots`).
   - Atomic Service Creation kèm `autoEnableActiveBranches` trong 1 MongoDB Transaction.
   - Core Appointment Management, Voucher/Promotion Engine, Order Lifecycle & Return/Refund Engine.
2. ✅ Tái lập và tối ưu Render Keep-Alive cron job:
   - Cập nhật `src/worker/cronjobs.js` tự động self-ping `/healthz` mỗi 10 phút, ngăn Render free tier sleep.
3. ✅ Chuẩn hóa tài khoản Admin thành Only-Text 100%:
   - Trong `src/seeds/demoUsersSeed.js`: gỡ bỏ số điện thoại và email của `admin`, chỉ dùng text `username: 'admin'`.
   - Cơ chế `$unset: { phone: 1, email: 1 }` tự động dọn sạch số điện thoại và email cũ trong MongoDB khi seed chạy.
   - Đảm bảo việc bàn giao chuyển nhượng hệ thống an toàn, không bị kẹt OTP hay phụ thuộc liên lạc cá nhân.
4. ✅ Nâng cấp cơ chế tạo nhân viên mới (`POST /api/v1/staff`):
   - Trong `src/modules/staff/staff.service.js`: trường `email` và `phone` là tùy chọn.
   - Nếu Admin nhập: nhân viên đăng nhập được bằng cả 3 cách (Username Text, SĐT, Email).
   - Nếu Admin bỏ trống: nhân viên đăng nhập bằng Username Text tự sinh an toàn.
   - Tự động sinh mật khẩu ngẫu nhiên phức tạp 16+ ký tự và trả về credentials cho Admin.
   - Cập nhật schema `StaffCreate` trong `07-openapi-v6.yaml` và `07-openapi-v7.yaml` (loại bỏ `email` khỏi `required`, thêm `credentials` vào `StaffProfile`).
5. ✅ Cập nhật toàn bộ mật khẩu Demo ngẫu nhiên phức tạp:
   - Cập nhật `src/seeds/demoUsersSeed.js` với chuỗi mật khẩu mạnh 16 ký tự thực tế.
   - Tự động so khớp `bcrypt.compare` và rehash cập nhật vào MongoDB.
   - Đồng bộ credentials admin vào `scripts/test-cloudinary-live.js`.
6. ✅ Automated Tests:
   - Bổ sung test case trong `tests/staff.test.js` kiểm tra tạo staff only-text không cần email/sđt.
   - Chạy toàn bộ test suites: **164/164 PASS (12/12 suites, 100%)**.
7. ✅ Tích hợp và Hướng dẫn Mock Data Nhân sự & Ca trực phục vụ Test trên Vercel:
   - Toàn bộ mock data nhân viên (`doctor`, `receptionist`, `groomer`, `nurse`, `manager`) đã được chuẩn bị sẵn sàng trong `src/seeds/demoUsersSeed.js`.
   - Khi chạy `npm run seed:demo`, hệ thống tự động sinh hồ sơ `StaffProfile` và **7 ca làm việc mẫu (`Shift`)** từ 08:00 – 17:00 trong 7 ngày liên tục gắn vào chi nhánh 1 (`60c72b2f9b1d8b2bad000001`).
   - Để hiển thị dữ liệu này trên Vercel/Render, chỉ cần chạy lệnh `npm run seed:demo` một lần vào cơ sở dữ liệu MongoDB chung. Ngoài ra, Admin có thể tự thêm nhân viên mới trực tiếp qua giao diện hoặc API `POST /api/v1/staff`.

**Files thay đổi:**
- `src/worker/cronjobs.js` – Bổ sung Render Keep-Alive cron job
- `src/seeds/demoUsersSeed.js` – Admin only-text, mật khẩu ngẫu nhiên mạnh, auto-rehash DB
- `src/modules/staff/staff.service.js` – createStaff hỗ trợ optional email/phone + credentials generator
- `scripts/test-cloudinary-live.js` – Đồng bộ thông tin đăng nhập admin
- `docs/07-openapi-v6.yaml` & `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` – Cập nhật schema StaffProfile & StaffCreate
- `docs/FE-HANDOFF-P0-AUTH-RBAC.md` – Cập nhật bảng tài khoản mẫu
- `tests/staff.test.js` – Thêm test case tạo staff only-text
- `docs/PROJECT-LOG.md` – Cập nhật log tiến độ dự án

**Trạng thái test:** 164/164 PASS (12 suites: appointment, auth, catalog, contract, health, inventory-api, inventory, order-return, service-branch, shift, staff, voucher)

---

### 📅 2026-10-19 | Người thực hiện: An Thai

**Task:** P0 – Staff/Role/Shift Management + PM Feedback Resolution (Render Keep-Alive & Demo Passwords) + Availability Engine Integration

**Nội dung:**
1. ✅ Hoàn thiện module Staff Management:
   - `POST /api/v1/staff`: Tạo internal account (chỉ dùng username text + password random mạnh 16+ ký tự) + `StaffProfile`. Trả về credentials 1 lần duy nhất cho Admin. Hỗ trợ `Idempotency-Key`.
   - `GET /api/v1/staff`: Danh sách staff hỗ trợ cursor-based pagination, filter theo `branchId` và `staffSubRole`. Scope resolution: ADMIN thấy tất cả, MANAGER chỉ thấy staff thuộc `assignedBranchIds`.
   - `PATCH /api/v1/staff/{id}`: Sửa vai trò `staffSubRole` (đồng bộ User) và `status` (ACTIVE/INACTIVE; khi chuyển INACTIVE tự động hủy các ca ACTIVE tương lai).
   - `PUT /api/v1/staff/{id}/branches`: Gán danh sách `authorizedBranchIds` và `homeBranchId` cho staff.
   - `PUT /api/v1/managers/{id}/assigned-branches`: Gán `assignedBranchIds` cho Manager.
2. ✅ Hoàn thiện module Shift Management:
   - `POST /api/v1/shifts`: Tạo ca làm việc gắn `staffId` + `branchId` + ngày/giờ + `staffSubRole`. Validate ca nằm trong giờ mở cửa của chi nhánh, thời lượng 30 phút - 12 giờ. Validate overlap (chống trùng ca: 409 `SHIFT_OVERLAP`). Scope: Manager chỉ tạo ca cho branch được gán.
   - `GET /api/v1/shifts`: Query ca theo `staffId`, `branchId`, `dateFrom`, `dateTo`, `status` với cursor pagination. Scope: ADMIN xem tất cả; MANAGER xem các branch được gán; STAFF chỉ xem ca của chính mình (403 nếu truy cập ca nhân viên khác).
   - `PATCH /api/v1/shifts/{id}`: Cập nhật giờ ca/chi nhánh và re-validate overlap + branch authorization.
   - `POST /api/v1/shifts/{id}/cancel`: Hủy ca (ACTIVE → CANCELLED) yêu cầu `reason` và `Idempotency-Key`. Cảnh báo/ghi nhận audit log các lịch hẹn bị ảnh hưởng.
3. ✅ Attendance / Chấm công Mockup:
   - Tạo model skeleton `Attendance` (`staffId`, `date`, `status: CHECKED_IN|CHECKED_OUT|ABSENT`).
   - Endpoint `GET /api/v1/attendance?staffId=&date=` trả mockup data chuẩn P0.
4. ✅ Tích hợp Availability Engine:
   - Cập nhật `demoUsersSeed.js` tự động seed `StaffProfile` và 7 ca làm việc mẫu (08:00 - 17:00) cho Bác sĩ, Groomer, Y tá.
   - Engine `/api/v1/availability` đọc trực tiếp ca thật từ MongoDB để tính slot trống chính xác.
5. ✅ Xử lý Feedback PM (18/10 & 19/10):
   - **Mục 1 (Render sleep / cold start):** Thêm cronjob Render Keep-Alive trong `src/worker/cronjobs.js` tự động ping endpoint `/healthz` mỗi 10 phút, ngăn Render free-tier sleep khi idle, chấm dứt tình trạng FE bị đơ hoặc lỗi kết nối khi tải trang.
   - **Mục 2 (Mật khẩu tài khoản demo):** Thay thế toàn bộ mật khẩu dễ đoán (`Role@1234`) sang mật khẩu ngẫu nhiên độ phức tạp cao (16 ký tự gồm chữ hoa, chữ thường, số, ký tự đặc biệt). Nâng cấp cơ chế seed trong `src/seeds/demoUsersSeed.js` tự động so khớp `bcrypt.compare` và rehash cập nhật trực tiếp vào MongoDB nếu mật khẩu thay đổi. Đồng bộ mật khẩu admin mới vào `scripts/test-cloudinary-live.js`.
   - **Quy chuẩn tài khoản Admin (Only Text) & Staff (Linh hoạt 3 cách):** Chuẩn hóa tài khoản `admin` thành tài khoản thuần Text (Only Text - không gắn số điện thoại hay email cá nhân để đảm bảo an toàn tuyệt đối khi chuyển giao quyền sở hữu hệ thống phòng khám, tránh kẹt OTP). Các tài khoản nhân viên khác (Manager, Doctor, Nurse,...) hỗ trợ đầy đủ cả 3 cách đăng nhập: Username Text, SĐT, Email. Khi Admin tạo tài khoản nhân viên mới (`POST /staff`), nếu nhập Email/SĐT thì nhân viên đăng nhập được bằng cả 3 cách, nếu bỏ trống thì đăng nhập bằng Username Text an toàn.
   - **Cập nhật OpenAPI Schema:** Loại bỏ `email` khỏi trường bắt buộc (`required`) trong schema `StaffCreate` của cả `07-openapi-v6.yaml` và `07-openapi-v7.yaml` để cho phép tạo tài khoản nhân viên thuần text.
6. ✅ Idempotency & Serializer OpenAPI v6/v7:
   - Gắn `idempotencyMiddleware` vào tất cả mutation routes.
   - Response serializers chuẩn RFC 9457 & OpenAPI `additionalProperties: false`.
   - Cập nhật schema `StaffProfile` hỗ trợ trường `credentials` tùy chọn cho `POST /staff`.
7. ✅ Automated Tests:
   - Tạo bộ test toàn diện `tests/staff-shift.test.js` (20 test cases, bổ sung test tạo staff only-text không cần email/sđt).
   - Chạy toàn bộ test suites: **116/116 PASS (6/6 suites, 100%)**.

**Files thay đổi:**
- `src/modules/staff/models/StaffProfile.js` – Model hồ sơ nhân viên
- `src/modules/staff/models/Shift.js` – Model ca làm việc (thêm `staffSubRole`, compound indexes)
- `src/modules/staff/models/Attendance.js` (MỚI) – Model chấm công mockup
- `src/modules/staff/staff.service.js` (MỚI) – Business logic CRUD nhân viên + Manager branch assignment + generator username/password
- `src/modules/staff/shift.service.js` (MỚI) – Business logic ca làm việc + overlap validation + scope resolution
- `src/modules/staff/staff.controller.js` (MỚI) – HTTP controllers cho Staff, Shift, Manager, Attendance
- `src/modules/staff/staff.serializer.js` (MỚI) – Formatters tuân thủ OpenAPI schema
- `src/modules/staff/staff.routes.js` – Mount staff routes + idempotency
- `src/modules/staff/shift.routes.js` (MỚI) – Mount shift routes + idempotency
- `src/modules/staff/manager.routes.js` (MỚI) – Mount manager assigned branches route
- `src/app.js` – Mount `/api/v1/staff`, `/api/v1/shifts`, `/api/v1/managers`, `/api/v1/attendance`
- `src/worker/cronjobs.js` – Thêm Render Keep-Alive cron job ping `/healthz` mỗi 10 phút
- `src/seeds/demoUsersSeed.js` – Cập nhật mật khẩu demo ngẫu nhiên phức tạp + auto rehash DB + seed StaffProfile & sample Shifts
- `scripts/test-cloudinary-live.js` – Cập nhật credentials admin theo mật khẩu mới
- `docs/07-openapi-v6.yaml` & `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` – Thêm `credentials` schema vào StaffProfile
- `docs/FE-HANDOFF-P0-AUTH-RBAC.md` – Cập nhật bảng tài khoản demo mật khẩu mới
- `tests/staff-shift.test.js` (MỚI) – 19 automated test cases cho Staff/Role/Shift
- `docs/FE-GUIDE-P0-STAFF-SHIFT.md` (MỚI) – Hướng dẫn API chi tiết cho Frontend
- `docs/PROMPT-P0-STAFF-ROLE-SHIFT.md` (MỚI) – Prompt tài liệu kỹ thuật
- `docs/PROJECT-LOG.md` – Cập nhật log tiến độ dự án

**Trạng thái test:** 115/115 PASS (6 suites: auth, catalog, contract, health, service-branch, staff-shift)

**Ghi chú cho FE:**
- Toàn bộ endpoints đã sẵn sàng trên Backend (xem `docs/FE-GUIDE-P0-STAFF-SHIFT.md`).
- Availability Engine `/api/v1/availability` đã đọc ca làm việc thật để tính slot.
- Các request POST `/staff`, `/shifts`, `/shifts/{id}/cancel` yêu cầu header `Idempotency-Key: <uuid>`.
- Danh sách tài khoản demo đã cập nhật mật khẩu mới ở bảng cuối tài liệu này và `docs/FE-HANDOFF-P0-AUTH-RBAC.md`.
- Server Render đã tích hợp tự động ping chống sleep, đảm bảo trải nghiệm FE luôn ổn định.

---

### 📅 2026-10-18 | Người thực hiện: An Thai

**Task:** Bổ sung text username cho tất cả tài khoản demo theo vai trò

**Nội dung:**
1. ✅ Bổ sung `username` text cho toàn bộ tài khoản demo: `manager`, `doctor`, `receptionist`, `groomer`, `nurse`, `customer`, `pending_user`, `blocked_user`
2. ✅ Thêm 2 tài khoản demo mới: Groomer (`groomer`, phone `0908888888`) và Nurse (`nurse`, phone `0909999999`)
3. ✅ Cải tiến logic seed: tìm user theo phone/username/email, tự động cập nhật username nếu thiếu
4. ✅ Thêm test case kiểm tra login bằng role-based text usernames
5. ✅ Cập nhật tài liệu bàn giao (FE_API_HANDOVER_GUIDE.md + FE-HANDOFF-P0-AUTH-RBAC.md)

**Commit:** `958d9ed feat(auth): add role-based text usernames to demo accounts and tests`

**Files thay đổi:**
- `src/seeds/demoUsersSeed.js` – Bổ sung username cho tất cả demo accounts + thêm groomer/nurse
- `tests/auth.test.js` – Thêm test case role-based text usernames
- `docs/FE-HANDOFF-P0-AUTH-RBAC.md` – Cập nhật bảng tài khoản demo

**Trạng thái test:** 89/89 PASS (5 suites)

**Ghi chú cho FE:**
- FE có thể đăng nhập bằng các username text: `admin`, `manager`, `doctor`, `receptionist`, `groomer`, `nurse`, `customer`
- Request body: `{ "identifier": "admin", "password": "Admin@1234" }` hoặc `{ "identifier": "doctor", "password": "Doctor@1234" }`
- Tham khảo bảng tài khoản đầy đủ trong `docs/FE-HANDOFF-P0-AUTH-RBAC.md`

---

### 📅 2026-10-18 | Người thực hiện: Minh

**Task:** Task 3.6 – Product/Category Management – FE Feedback Resolution

**Nội dung:**
1. ✅ Bổ sung upload routes cho products (Cloudinary integration)
2. ✅ Resolve FE feedback log – catalog enhancements
3. ✅ Thêm comprehensive handoff document cho Task 3.6

**Commits:**
- `6e19d1f docs: add BE_2_FE_Log_Fix.md comprehensive handoff for Task 3.6`
- `ff2d8a6 feat(catalog,upload): resolve FE feedback log enhancements`

**Files thay đổi:**
- `BE_2_FE_Log_Fix.md` (MỚI) – Tài liệu bàn giao fix log cho FE
- `docs/BE_2_FE_Log_Fix.md` (MỚI) – Bản copy trong docs
- `docs/FE _ Log.md` (MỚI) – Log chi tiết requirements từ FE
- `docs/PLAN-fe-log-review.md` (MỚI) – Plan review FE log
- `src/modules/catalog/catalog.service.js` – Enhancements
- `src/modules/upload/upload.controller.js` – Upload controller updates
- `src/modules/upload/upload.routes.js` – Upload routes updates
- `src/modules/upload/upload.service.js` – Upload service updates
- `tests/catalog.test.js` (MỚI) – 158 test lines cho catalog
- `docs/07-openapi-v6.yaml` – Thêm upload endpoints

**Trạng thái test:** 88/88 → 89/89 PASS (5 suites)

---

### 📅 2026-10-17 | Người thực hiện: An Thai

**Task:** Fix Render deploy healthcheck + Postman collection

**Commits:**
- `468f0e0 fix(health): add root /health and /healthz endpoints for Render deploy healthcheck`
- `cac564c fix(postman): add explicit pm.test assertions to Request 1`
- `675f104 feat(upload): add postman collection and e2e verification script for cloudinary upload`

---

### 📅 Trước 2026-10-17 | Người thực hiện: Minh + An Thai

**Các milestone đã hoàn thành:**
- ✅ Foundation setup: MongoDB/Mongoose, Express, JWT Auth, OpenAPI Validator
- ✅ Auth module hoàn chỉnh: Login, Register, OTP, Refresh, Logout, Change Password
- ✅ CORS fix cho drpetshouse.lat + Vercel deployments
- ✅ Branch + BranchServiceConfig CRUD
- ✅ Service Catalog CRUD
- ✅ Product/Category Management (Task 3.6)
- ✅ Availability engine (đọc Shift + StaffProfile để tính slot)
- ✅ Booking module (Appointment CRUD)
- ✅ Cart, Order, Checkout modules
- ✅ Upload module (Cloudinary)
- ✅ OpenAPI v6 spec compliance
- ✅ 89 automated test cases PASS

---

## TIẾN ĐỘ & TRẠNG THÁI TASK
- ✅ **P0 – Staff/Role/Shift Management**: ĐÃ HOÀN THÀNH (100% DONE, 115/115 tests PASS)
- ⏳ **Bàn giao FE**: Đã có `docs/FE-GUIDE-P0-STAFF-SHIFT.md` sẵn sàng cho team FE tích hợp
- 🔜 **Task tiếp theo**: P0 – Booking / Appointment Execution Flow (ghi nhận hồ sơ khám bệnh, phân công staff vào appointment, payment flow)

---

## BẢNG ENDPOINTS P0 ĐÃ TRIỂN KHAI HOÀN CHỈNH

| Method | Endpoint | Auth | Quyền | Trạng thái |
|---|---|---|---|---|
| POST | `/api/v1/staff` | Bearer | ADMIN | ✅ Hoàn thành (Idempotency) |
| GET | `/api/v1/staff` | Bearer | ADMIN / MANAGER | ✅ Hoàn thành (Cursor pagination, branch scope) |
| PATCH | `/api/v1/staff/{id}` | Bearer | ADMIN | ✅ Hoàn thành (Role sync, auto shift cancel) |
| PUT | `/api/v1/staff/{id}/branches` | Bearer | ADMIN | ✅ Hoàn thành (Branch validation) |
| PUT | `/api/v1/managers/{id}/assigned-branches` | Bearer | ADMIN | ✅ Hoàn thành |
| POST | `/api/v1/shifts` | Bearer | ADMIN / MANAGER | ✅ Hoàn thành (Overlap validation 409) |
| GET | `/api/v1/shifts` | Bearer | ADMIN / MANAGER / STAFF | ✅ Hoàn thành (Role + Staff self-scope) |
| PATCH | `/api/v1/shifts/{id}` | Bearer | ADMIN / MANAGER | ✅ Hoàn thành |
| POST | `/api/v1/shifts/{id}/cancel` | Bearer | ADMIN / MANAGER | ✅ Hoàn thành (Idempotency, appointment check) |
| GET | `/api/v1/attendance` | Public/Bearer | ALL | ✅ Hoàn thành (Mockup tracking) |
| GET | `/api/v1/availability` | Public | ALL | ✅ Đã kết nối Shift thật |

---

## DANH SÁCH TÀI KHOẢN MẪU (MẬT KHẨU MẠNH THỰC TẾ)

| Username | Vai trò | Phone | Mật khẩu (Password) | Trạng thái |
|---|---|---|---|---|
| `admin` | ADMIN | *Không có (Only Text)* | `K9#mQ$8xL!2vW*7z` | ACTIVE |
| `manager` | MANAGER | 0901234567 | `tR5*bY9#fP2!sM7&` | ACTIVE |
| `doctor` | STAFF/VET | 0903333333 | `vE8$dK2#zL6!pQ9@` | ACTIVE |
| `receptionist` | STAFF/RECEP | 0904444444 | `rC4!mZ7#bX9$vT2&` | ACTIVE |
| `groomer` | STAFF/GROOM | 0908888888 | `gM9$kL3@sY7!bN2#` | ACTIVE |
| `nurse` | STAFF/NURSE | 0909999999 | `nS4#yP8!vQ2$kM7@` | ACTIVE |
| `customer` | CUSTOMER | 0905555555 | `cT6$vM2!pL9#zR8&` | ACTIVE |
| `pending_user` | CUSTOMER | 0907777777 | `pU3#zK8!vQ5$mY2@` | PENDING |
| `blocked_user` | CUSTOMER | 0906666666 | `bL9$rM2#vK4!zQ7@` | BLOCKED |

> 🔒 **Ghi chú bảo mật & Chuyển giao hệ thống:**
> - Tài khoản `admin` được chuẩn hóa thành **Only Text** (không gắn số điện thoại hay email cá nhân để đảm bảo quá trình chuyển giao quyền sở hữu hệ thống diễn ra an toàn, không bị kẹt OTP hay phụ thuộc liên lạc cá nhân).
> - Các tài khoản nhân viên khác (Manager, Doctor, Nurse, Groomer, Receptionist) và Khách hàng hỗ trợ linh hoạt **cả 3 hình thức đăng nhập**: Username Text, SĐT, Email.
> - Mật khẩu đã chuyển sang định dạng ngẫu nhiên độ phức tạp cao (16 ký tự, gồm chữ hoa, chữ thường, số, ký tự đặc biệt) theo đúng quy chuẩn thực tế và yêu cầu từ PM. Không áp dụng cú pháp role-based cố định.

---

## LIÊN HỆ

| Thành viên | Vai trò | Phụ trách |
|---|---|---|
| An Thai | Backend Developer | Auth, Staff/Shift, Integration |
| Minh | Backend Developer | Catalog, Product, Upload |
| Hưng | Frontend Developer | Vercel deployment |
| Linh | Frontend Developer | FE logic |
