# 📋 PROJECT LOG – Dr. Pet's House (WEB-2 Backend)

> **Dự án:** Dr. Pet's House – Pet Clinic Management System
> **Repository BE (Chính thức):** https://github.com/minhllk24/PET_CLINIC_BACKEND (branch: `feat/foundation-v6`)
> **Repository FE (Chính thức - Angular 22):** https://github.com/chungvinhhung/DR_PETS_HOUSE_ANGULAR (branch: `main`)
> **Repository FE (Legacy - React cũ chỉ dùng tham khảo UI):** https://github.com/minhllk24/BE_A_PET_CLINIC-FRONTEND (branch: `build-init`)
> **Production Frontend URL:** https://www.drpetshouse.lat/ (Angular App - Admin & Customer)
> **Production Backend API:** https://pet-clinic-backend-a4lj.onrender.com/api/v1
> **Cập nhật bởi:** An Thai | **File này dành cho:** Project Manager (PM)

---

## NGUYÊN TẮC PHÂN ĐỊNH RANH GIỚI & QUY TRÌNH GIT (SCOPE BOUNDARY & WORKFLOW)

1. **Ranh giới công việc (Scope Boundary):**
   - **Backend Team (An Thai & Minh):** Tập trung **100% vào Backend** (Node.js/Express, MongoDB Atlas, Mongoose, Jest Tests, OpenAPI V7 spec trên branch `feat/foundation-v6`). **TUYỆT ĐỐI KHÔNG CAN THIỆP / CHỈNH SỬA MÃ NGUỒN FRONTEND.**
   - **Frontend Team (Hưng & Linh):** Chịu trách nhiệm toàn diện trên repository chính thức **`DR_PETS_HOUSE_ANGULAR`** (Angular 22, branch `main`). Hưng phụ trách Admin, Linh phụ trách Customer.
2. **Quy trình kết nối & Bàn giao Kỹ thuật (Handoff Protocol):**
   - Backend cung cấp API Contract qua tài liệu Markdown trong thư mục `BE/docs/` (ví dụ: `BAO-CAO-HUONG-DAN-FIX-FE.md`, OpenAPI V7 YAML).
   - Frontend độc lập cập nhật tầng Service và Adapter (`CustomerHttpService` / `assertSuccess`) để tiêu thụ API mà không làm xáo trộn mã nguồn hai bên.
3. **Quy chuẩn Git Commit & Push:**
   - Mọi thay đổi Backend phải chạy toàn bộ bài kiểm thử tự động `npm test` (đạt 100% PASS) trước khi push.
   - Commit theo chuẩn Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).
   - Đẩy trực tiếp lên nhánh làm việc chính thức: `origin/feat/foundation-v6`.

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

### 📅 2026-10-28 (Phiên 3) | Người thực hiện: An Thai & Minh Le Ly

**Task:** Triển khai Feedback PM - Chuẩn hóa Only-Text Credentials Nhân sự Nội bộ, Ma trận Phân bổ 3 Chi nhánh Toàn diện & Ràng buộc Chống trùng ca (Anti-Overlap Guardrail)

**Nội dung:**
1. ✅ **Chuẩn hóa Cơ chế Only-Text Credentials cho toàn bộ nhân sự nội bộ:**
   - Phân biệt rõ rệt hai phân hệ: Khách hàng (`CUSTOMER`) bắt buộc giữ SĐT / Email thực tế để nhận mã OTP SMS, hóa đơn điện tử; Toàn bộ nhân sự nội bộ (`ADMIN`, `MANAGER`, và `STAFF: VETERINARIAN, CARE_STAFF_GROOMER, RECEPTIONIST, NURSE`) chuyển sang định danh **Username Plain-Text thuần túy**, **HOÀN TOÀN KHÔNG YÊU CẦU SĐT / EMAIL**.
   - Cập nhật đồng bộ `BE/src/seeds/productionUatSeed.js` và `BE/src/seeds/demoUsersSeed.js`: Loại bỏ `phone` và `email`, thiết lập cơ chế `$unset: { phone: 1, email: 1 }` khi nạp seed để dọn sạch dữ liệu cũ trong MongoDB.
   - Thống nhất mật khẩu kiểm thử chuẩn cho toàn bộ tài khoản nội bộ: `K9#mQ$8xL!2vW*7z`.

2. ✅ **Phủ toàn diện Ma trận Phân bổ tối thiểu 3 Chi nhánh & 4 Roles Đa chi nhánh:**
   - 3 cơ sở chính: `BR-000001` (Trụ sở Quận 1), `BR-000002` (Phú Mỹ Hưng Quận 7), `BR-000003` (Bình Thạnh).
   - 4 role nội bộ (`MANAGER`, `VET`, `CARE`, `RECEPTIONIST` và `NURSE`) đều có đầy đủ tài khoản phục vụ mọi trường hợp phân công công tác:
     - **Single-branch (Đơn chi nhánh):** Cố định tại từng cơ sở (Q1, Q7, Bình Thạnh).
     - **Dual-branch (Đa chi nhánh / Kép):** Luân phiên giữa 2 cơ sở (Q1-Q7, Q1-BT, Q7-BT).
     - **Tri-branch / All (Toàn hệ thống):** Bao quát cả 3 cơ sở (General Manager, Bác sĩ trưởng hội chẩn liên viện, Trưởng nhóm Grooming/Spa toàn chuỗi).
     - **Admin (Global):** Quản trị tối cao, phạm vi toàn cục unconstrained.

3. ✅ **Thực thi Ràng buộc Chống trùng ca (Anti-Overlap Shift Constraint):**
   - Thuật toán tạo ca trực (Shifts) đảm bảo nhân sự làm việc đa chi nhánh luân phiên ngày công tác, mỗi ngày trực tối đa 1 ca (Sáng hoặc Chiều), loại bỏ 100% rủi ro trùng khung giờ giữa các chi nhánh (`startAt < other.endAt && endAt > other.startAt` luôn sai).
   - Bổ sung bộ kiểm thử chuyên biệt `tests/multi-branch-credentials.test.js` kiểm tra 8 ca kiểm thử: Schema User không cần SĐT/email, xác thực đăng nhập qua username, lưu trữ `authorizedBranchIds`, chặn `SHIFT_OVERLAP` (409) và chặn `BRANCH_SCOPE_ERROR` (422).

4. ✅ **Kết quả kiểm thử tự động:**
   - Bộ test mới `tests/multi-branch-credentials.test.js`: **8/8 tests PASS (100%)**.
   - Các suite cốt lõi (`auth`, `staff`, `shift`, `voucher`): **Pass 100%**.

---

### 📅 2026-10-28 (Phiên 2) | Người thực hiện: An Thai & Minh Le Ly

**Task:** Triển khai Hoàn tất Kết nối API Customer (Angular 22) Cho Linh, Bàn Giao Kỹ thuật & Khóa Ranh giới Backend (Scope Boundary Lock)

**Nội dung:**
1. ✅ Triển khai thực tế trên repo Frontend chính thức `DR_PETS_HOUSE_ANGULAR` (Angular 22) theo chỉ đạo đặc biệt của PM:
   - Nâng cấp `src/app/core/customer/services/customer-http.service.ts`:
     - Tích hợp `assertSuccess` đa hình xử lý REST V7 `{ success, data }`, Direct REST (object/array), và Legacy `{ EC, EM, DT }`. Giải quyết dứt điểm lỗi ném ngoại lệ `"Request failed"` khi Backend trả 200 OK.
     - Auto `Idempotency-Key` Injection (crypto.randomUUID) cho mọi mutating request (`POST`/`PUT`/`PATCH`/`DELETE`).
     - Bảo vệ phiên đăng nhập: bắt 401 phát sự kiện `petclinic:auth-expired`, mở form login tại chỗ, loại bỏ hoàn toàn việc bị chuyển hướng sang `/admin/login`.
   - Nâng cấp đồng bộ 14 API services (`src/app/core/customer/services/api/`):
     - `auth-api.service.ts`: Chuẩn hóa `/auth/login`, `/auth/register`, `/auth/refresh-token`, bổ sung OTP và kích hoạt tài khoản khách vãng lai (`/auth/guest-otp`, `/auth/activate-guest`).
     - `order-api.service.ts`: Hợp nhất checkout thành `POST /orders/checkout`, hỗ trợ Member lẫn Guest (`customerId: null`, `contactSnapshot`), hủy đơn `POST /orders/:id/cancel`.
     - `booking-api.service.ts`: Lấy chi nhánh `GET /branches?status=ACTIVE`, dịch vụ `GET /catalog/services`, báo giá `POST /appointments/quote`, đặt lịch `POST /appointments`, hủy lịch `POST /appointments/:id/cancel`.
     - `pet-api.service.ts`: Quản lý thú cưng qua `GET/POST /customers/:customerId/pets`, ánh xạ ảnh đại diện từ `photoUrl` (CDN) và `pet_images`.
     - `user-api.service.ts`: Lấy và cập nhật hồ sơ khách hàng `GET/PUT /customers/:id`.
     - `loyalty-api.service.ts`: Kiểm tra voucher qua `POST /vouchers/validate`.
     - `cart-api.service.ts`, `product-api.service.ts`, `service-pricing-api.service.ts`, `search-api.service.ts`, `rescue-api.service.ts`, `content-api.service.ts`, `notification-api.service.ts`, `contact-api.service.ts`: Chuẩn hóa normalizer và an toàn dữ liệu mảng.
2. ✅ Kiểm tra chất lượng & Biên dịch:
   - Frontend Angular: `npm run build` $\rightarrow$ **Application bundle generation complete, 0 Lỗi (Exit code 0)**.
   - Backend MongoDB: `npm test` $\rightarrow$ **20/20 Test suites passed, 282/282 tests passed (100% PASS)**.
3. ✅ Bàn giao Git:
   - Frontend: Commit `80ecafa`, merge vào `main` (`22327e5`, `ce404af`), push thành công lên `origin/main` và `origin/feat/customer-api-v7-integration`.
   - Backend: Commit tài liệu kỹ thuật `KE-HOACH-NOI-API-CUSTOMER-ANGULAR-LINH.md` và `BAO-CAO-KET-NOI-API-CUSTOMER-FRONTEND-LINH.md`.
4. 🔒 **KHÓA RANH GIỚI PHẠM VI (SCOPE BOUNDARY ENFORCEMENT):**
   - Nhiệm vụ hỗ trợ Frontend hoàn tất 100%. Phân hệ Frontend (`DR_PETS_HOUSE_ANGULAR` và `FE/`) chính thức chuyển sang chế độ **READ-ONLY (CHỈ ĐỌC)**.
   - Nhóm kỹ sư cam kết tiếp tục tập trung **100% vào phát triển và hoàn thiện các tính năng Backend (`BE/`)**.

---

### 📅 2026-10-28 (Phiên 1) | Người thực hiện: An Thai & Minh Le Ly

**Task:** Task 2.8 - UAT Production Realistic Seed, Full Guest Scenarios, PM Feedback Resolution & Comprehensive Frontend Fix Guide

**Nội dung:**
1. ✅ Giải quyết triệt để phản hồi của PM & Phân tích nguyên nhân gốc rễ:
   - Ca làm việc & Nhân sự: Phân bổ 12 nhân viên chia đều cho cả 3 chi nhánh (Q1, Q7, Bình Thạnh). Thiết lập lịch trực xoay ca thực tế (Ca Sáng 08:00–14:00, Ca Chiều 14:00–20:00), mỗi nhân viên chỉ trực 1 ca/ngày và có ngày nghỉ cố định 1-2 ngày/tuần theo Luật Lao động.
   - Dọn dẹp dữ liệu rác: Tự động xóa sạch 100% sản phẩm và ca trực test cũ (`SP-000555`, `SP-000888`, `SP-000999`, tên chứa `test`, `thử nghiệm`).
   - Chuẩn hóa 4 Danh mục và 10 Sản phẩm thực tế có ảnh Unsplash CDN chất lượng cao (1200x1200px), đầy đủ biến thể, giá bán, giá vốn và phân bổ tồn kho đa chi nhánh (`InventoryStock`).
2. ✅ Nâng cấp Schema `src/modules/customer/models/Pet.js`:
   - Hoàn thiện schema Mongoose đầy đủ (`customerId`, `name`, `species`, `breed`, `gender`, `ageYears`, `weightKg`, `healthStatus`, `medicalNotes`, `photoUrl`, `isArchived`).
3. ✅ Xây dựng kịch bản seed toàn diện `src/seeds/productionUatSeed.js` (1.090 lines) bao phủ 100% tất cả các trường hợp dữ liệu nghiệp vụ:
   - **Member Profile (Có tài khoản):** Khách hàng Lê Văn Cường, 2 thú cưng (Buddy, Luna), 4 đơn hàng đa trạng thái (`COMPLETED`, `SHIPPED`, `PROCESSING`, `CANCELLED`), 1 lịch hẹn kèm Bệnh án điện tử `ServiceRecord` đã được Bác sĩ ký duyệt (`FINALIZED`).
   - **Khách vãng lai mua hàng (`Guest Order - NO ACCOUNT`):** Đơn `ORD-GUEST-HOT-01`, thanh toán COD, `customerId: null`, gắn kết qua `guestContactId`, snapshot thông tin đầy đủ.
   - **Khách vãng lai đặt lịch khám (`Guest Booking - NO ACCOUNT`):** Lịch hẹn `APT-GUEST-CLINIC-01`, `customerId: null`, cọc 30% tại quầy (`PAY_AT_STORE`), lưu `contactSnapshot` và `petSnapshot` (Mèo Miu Miu).
   - **Khách vãng lai chờ kích hoạt tài khoản (`PENDING_ACTIVATION`):** Mã mời `INVITE-ACT-778899` để kiểm thử luồng kích hoạt.
   - **Voucher khuyến mãi:** Tích hợp 9 mã voucher đa dạng bao phủ toàn bộ use-case.
4. ✅ Biên soạn 2 tài liệu kỹ thuật hoàn chỉnh:
   - `docs/BAO-CAO-TRIEN-KHAI-BACKEND-MONGO.md`: Báo cáo kỹ thuật chi tiết BE/Mongo, phân tích nguyên nhân gốc rễ, kiến trúc đa chi nhánh, toàn bộ data scenarios và hướng dẫn mở IP whitelist nạp dữ liệu lên Atlas qua `npm run seed:uat-prod`.
   - `docs/BAO-CAO-HUONG-DAN-FIX-FE.md`: Báo cáo hướng dẫn kỹ thuật chi tiết cho team FE (Hưng & Linh) giải quyết lỗi ảnh `[object Object]`, lặp nhãn role, drop-down chi nhánh ca làm, xử lý đơn/lịch hẹn khách vãng lai, và Axios Interceptor Silent Refresh Token 15 phút.
5. ✅ Kiểm thử Tự động Hồi quy:
   - Chạy toàn bộ test suites: **20/20 suites passed, 282/282 tests passed (100% PASS)**.

**Files thay đổi:**
- `src/modules/customer/models/Pet.js` – Hoàn thiện schema Pet
- `src/seeds/productionUatSeed.js` – Script nạp dữ liệu thực tế UAT đa chi nhánh & guest cases
- `package.json` – Bổ sung script `seed:uat-prod`
- `docs/BAO-CAO-TRIEN-KHAI-BACKEND-MONGO.md` – Báo cáo kỹ thuật triển khai BE và MongoDB Atlas
- `docs/BAO-CAO-HUONG-DAN-FIX-FE.md` – Báo cáo hướng dẫn kỹ thuật hoàn thiện Frontend
- `docs/PROJECT-LOG.md` – Cập nhật log tiến độ dự án 2026-10-28

**Trạng thái test:** 282/282 PASS (20 suites, 100%)

**Ghi chú cho FE:** Đọc kỹ `docs/BAO-CAO-HUONG-DAN-FIX-FE.md` để triển khai code snippets cho ảnh sản phẩm, role hiển thị, drop-down chi nhánh, badge khách vãng lai và Axios refresh token.

---

### 📅 2026-10-26 | Người thực hiện: An Thai & Minh Le Ly

**Task:** Đồng bộ Remote & Nghiệm thu Order E2E Test Suite, Return Net Refund Allocation, Unified Branches và FE Integration Guides

**Nội dung:**
1. ✅ Pull và đồng bộ toàn bộ codebase Backend (`feat/foundation-v6`) và Frontend (`build-init`):
   - Cả 2 repository đã được cập nhật hoàn toàn trùng khớp với remote github.
   - Nhận 2 commits mới từ Minh: `696a5e6` (Order Return Net Refund & Docs) và `6a6e382` (Order E2E Test Suite & FE Integration Guide).
2. ✅ Nghiệm thu Cơ chế Tính Tiền Hoàn Trả Ròng (Net Refund with Voucher Allocation):
   - Nâng cấp `src/modules/order/order.service.js` và `src/modules/order/return.service.js`: Phân bổ giá trị voucher giảm giá theo tỷ lệ từng dòng sản phẩm khi thanh toán đơn hàng.
   - Khi khách hàng yêu cầu hoàn trả (Return / Refund), số tiền hoàn trả được tính theo giá ròng thực trả (`netPrice = lineTotal - allocatedVoucherDiscount`), không hoàn lại phần chiết khấu của voucher.
   - Phí vận chuyển (shipping fee) là không hoàn lại (`non-refundable shipping fee`).
   - Kiểm soát trần hoàn tiền (`refund ceiling`): Tổng số tiền hoàn qua các đợt không vượt quá số tiền thực thanh toán (`paidAmount`).
   - Tự động hoàn kho nguyên tử (`atomic stock compensation`) và cập nhật trạng thái đơn hàng.
3. ✅ Nghiệm thu Bộ Test Suite Toàn Diện E2E Đơn Hàng (`tests/order-e2e.test.js`):
   - Tích hợp 16 test cases kiểm thử 12 kịch bản nghiệp vụ khắt khe (SC-01 đến SC-12) với fixture dữ liệu đa loài (Chó, Mèo, Động vật nhỏ, Chim) và 3 chi nhánh.
   - SC-01: Định giá hai tầng (Áp dụng giảm giá sản phẩm trước, voucher sau).
   - SC-02: Cơ chế điều phối chi nhánh `FulfillmentBranchResolver` (Ưu tiên branch chỉ định, fallback branch mặc định, từ chối tách giỏ 422 `INSUFFICIENT_INVENTORY`).
   - SC-03: Chuyển đổi trạng thái thanh toán COD khi giao hàng thành công (`PENDING` -> `PAID`).
   - SC-04: Tự động hủy đơn khi thanh toán `ONLINE_MOCK` thất bại, hoàn kho nguyên tử và hoàn quota voucher idempotent.
   - SC-05: Cửa sổ đổi trả 7 ngày (từ chối yêu cầu ngoài 7 ngày).
   - SC-06: Chống bypass RBAC (khách hàng không tự hoàn tiền nếu chưa duyệt, nhân viên không vượt quyền chi nhánh).
   - SC-07: Đổi trả nhiều phần / nhiều đợt (`partial / multistage return`).
   - SC-08 -> SC-12: Giới hạn phí vận chuyển, trần hoàn tiền và kiểm soát tính toàn vẹn dữ liệu.
4. ✅ Bàn giao Tài liệu Tích hợp cho Frontend (FE Handoff):
   - `docs/FE-GUIDE-ORDER-E2E-RETURN-REFUND.md`: Hướng dẫn chi tiết luồng tích hợp Đơn hàng & Đổi trả, sơ đồ trạng thái, payloads mẫu và bảng mã lỗi RFC 9457.
   - `docs/FE-HANDOFF-SERVICE-BRANCH-ORDER-RETURN.md`: Tài liệu đặc tả dịch vụ, chi nhánh và vòng đời đơn hàng phục vụ FE team.
5. ✅ Kiểm thử Tự động:
   - Tổng số test suites tăng lên **13 suites**, **184/184 tests passed (100% PASS)**.
   - Bao gồm: `appointment`, `auth`, `catalog`, `contract`, `health`, `inventory-api`, `inventory`, `order-e2e`, `order-return`, `service-branch`, `shift`, `staff`, `voucher`.

**Files thay đổi:**
- `src/modules/order/order.service.js` – Tính toán phân bổ voucher theo tỷ lệ (voucher allocation)
- `src/modules/order/return.service.js` – Tính toán hoàn tiền ròng (net refund), trần hoàn tiền, hoàn kho
- `src/seeds/serviceCatalogSeed.js` – Chuẩn hóa tên các chi nhánh đồng nhất
- `tests/order-return.test.js` – Bổ sung test case phân bổ voucher và net refund
- `tests/fixtures/orderE2EData.js` – Bộ fixture đa loài và chi nhánh phục vụ E2E
- `tests/order-e2e.test.js` – Bộ test suite E2E đơn hàng 12 kịch bản (964 lines)
- `docs/PLAN-order-e2e.md` – Kế hoạch kiểm thử E2E đơn hàng
- `docs/FE-GUIDE-ORDER-E2E-RETURN-REFUND.md` – Cẩm nang tích hợp Đơn hàng & Hoàn trả cho Frontend
- `docs/FE-HANDOFF-SERVICE-BRANCH-ORDER-RETURN.md` – Tài liệu bàn giao dịch vụ chi nhánh và đơn hàng
- `docs/PROJECT-LOG.md` – Nghiệm thu và ghi nhận log phiên làm việc 2026-10-26

**Trạng thái test:** 184/184 PASS (13 suites, 100%)

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

## BẢNG TRIỂN KHAI HOÀN TẤT: TASKS 4.3 - 4.6 (FOUNDATION V6 / V7 CONFIRMED)

### 1. Task 4.3: Appointment E2E & Booking Refund Lifecycle
- **Cronjob Hold Expiries (`processAppointmentHoldExpiries`)**: Quét định kỳ các lịch hẹn giữ chỗ quá hạn (`holdExpiresAt < now`), tự động chuyển trạng thái `CANCELLED_PAYMENT_TIMEOUT`, hoàn trả slot thời gian (`SlotReservation.deleteMany`) theo chuẩn ADR-41.
- **Phân công Bác sĩ đánh giá (`assignReviewer`)**: Endpoint `POST /api/v1/appointments/:id/assign-reviewer` hỗ trợ CAS Optimistic Locking (`version`), bắt buộc role `VETERINARIAN`.
- **Vòng đời Hoàn tiền Đặt lịch (`BookingRefund`)**:
  - `POST /api/v1/booking-refunds`: Yêu cầu hoàn tiền (Customer/Staff/Admin).
  - `POST /api/v1/booking-refunds/:id/approve`: Quản lý/Admin phê duyệt (Idempotency).
  - `POST /api/v1/booking-refunds/:id/complete`: Hoàn tất chuyển tiền hoàn cọc (Idempotency).
  - `POST /api/v1/booking-refunds/:id/reject`: Từ chối hoàn tiền với lý do cụ thể.
- **Test suite**: `tests/appointment-e2e.test.js` (13/13 PASS).

### 2. Task 4.4: Service Record & Vật tư tiêu hao (Execution Module)
- **Mount alias**: Hỗ trợ song song cả `/api/v1/service-records` (chuẩn OpenAPI v7) và `/api/v1/execution`.
- **Quản lý Vật tư tiêu hao (`updateMaterials`)**: Hỗ trợ `PUT`/`PATCH`, bắt buộc đầy đủ `materialId`, `quantity`, `unit`, `notes`, đồng thời lưu snapshot phiên bản (`revisions`).
- **Ghi chú chuyên môn (`updateProfessional`)**: Cho phép Bác sĩ/Nhân viên cập nhật chẩn đoán, diễn tiến bệnh án và hướng điều trị.
- **Quy trình hoàn tất (`finalizeRecord`) & Mở lại hồ sơ (`reopenRecord`)**: Đóng hồ sơ dịch vụ, quản lý lý do và lịch sử kiểm toán khi mở lại.
- **Lịch sử sửa đổi (`getRevisions`)**: Xem toàn bộ lịch sử chỉnh sửa từng lần của hồ sơ.
- **Test suite**: `tests/execution.test.js` (15/15 PASS).

### 3. Task 4.5: Customer & Guest Management
- **Task 4.5 P0 (Guest / OTP / Activation)**:
  - `POST /api/v1/guest/lookup-otp`: Gửi mã OTP xác thực tra cứu cho khách vãng lai (áp dụng rate-limit 60s, mã hóa SHA-256).
  - `POST /api/v1/guest/verify-otp`: Xác thực OTP an toàn (constant-time compare), cấp JWT Token `X-Guest-Lookup-Token`.
  - `GET /api/v1/guest/history`: Tra cứu lịch sử đơn hàng và lịch hẹn bằng Lookup Token.
  - `POST /api/v1/guest/invite-activation`: Nhân viên gửi lời mời kích hoạt tài khoản thành viên.
  - `POST /api/v1/guest/complete-activation`: Khách hoàn tất thiết lập mật khẩu, liên kết Customer record với User account mới.
  - **Test suite**: `tests/guest-activation.test.js` (15/15 PASS).
- **Task 4.5 P1 (Customer Account Management)**:
  - Tách bạch trường trạng thái: `activationStatus` (`NO_ACCOUNT`, `PENDING_ACTIVATION`, `ACTIVATED`) độc lập với `accountStatus` (`ACTIVE`, `BLOCKED`).
  - `GET /api/v1/customers` & `/api/v1/admin/customers`: Phân trang Cursor, tìm kiếm thông minh theo SĐT/Tên/Email, phân quyền theo chi nhánh (Branch scoping).
  - `GET /api/v1/customers/:id`: Xem chi tiết khách hàng và danh sách thú cưng.
  - `POST /api/v1/admin/customers/:id/block`: Admin khóa tài khoản khách hàng (bắt buộc lý do, bảo toàn lịch sử audit).
  - `POST /api/v1/admin/customers/:id/unblock`: Admin mở khóa tài khoản.
  - **Test suite**: `tests/customer-account.test.js` (9/9 PASS).

### 4. Task 4.6: Feedback & Review Module
- **Hệ thống Đánh giá (`Review`)**:
  - `POST /api/v1/reviews`: Tạo đánh giá sản phẩm hoặc dịch vụ. Kiểm tra tự động điều kiện hoàn tất đơn hàng (`Order: COMPLETED/DELIVERED`) hoặc lịch hẹn (`Appointment: COMPLETED`), chống trùng lặp đánh giá.
  - Hỗ trợ chế độ ẩn danh: Khi `anonymous: true`, endpoint public tự động ẩn `displayName: null`.
  - `GET /api/v1/reviews`: Danh sách đánh giá công khai (chỉ hiển thị bản ghi `ACTIVE`, không bị ẩn).
  - `GET /api/v1/reviews/admin`: Quản trị viên/Quản lý xem đầy đủ danh tính và các đánh giá bị ẩn.
  - `POST /api/v1/reviews/:id/hide` & `show`: Quản lý/Admin ẩn đánh giá vi phạm và khôi phục hiển thị.
- **Hệ thống Góp ý (`Feedback`)**:
  - `POST /api/v1/feedback`: Khách hàng/công chúng gửi ý kiến đóng góp, phân loại theo danh mục.
  - `GET /api/v1/feedback` & `GET /:id`: Quản lý/Admin theo dõi và phản hồi.
  - `PATCH /api/v1/feedback/:id/status`: Máy trạng thái nghiêm ngặt (`NEW` -> `READ` -> `PROCESSING` -> `PROCESSED`/`REJECTED`/`NEED_CONTACT`).
  - **Test suite**: `tests/review.test.js` (13/13 PASS).

---

## TỔNG KẾT REGRESSION TEST SUITE TOÀN HỆ THỐNG
```text
Test Suites: 18 passed, 18 total
Tests:       249 passed, 249 total
Snapshots:   0 total
Time:        94.436 s
Ran all test suites with --runInBand.
100% ZERO REGRESSION.
```

---

## LIÊN HỆ

| Thành viên | Vai trò | Phụ trách |
|---|---|---|
| An Thai | Backend Developer | Auth, Staff/Shift, Integration |
| Minh | Backend Developer | Catalog, Product, Upload |
| Hưng | Frontend Developer | Vercel deployment |
| Linh | Frontend Developer | FE logic |
