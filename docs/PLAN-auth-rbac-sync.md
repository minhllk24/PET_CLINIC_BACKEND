# Kế Hoạch Triển Khai: Đồng Bộ Auth & RBAC Vào Nhánh Foundation (P0 Product/Category)

> **File:** `docs/PLAN-auth-rbac-sync.md`  
> **Task Slug:** `auth-rbac-sync`  
> **Mục tiêu:** Đồng bộ toàn diện hệ thống Authentication & Role-Based Access Control (RBAC) từ nhánh `feat/p0-auth-rbac` vào nhánh hiện tại `feat/foundation-v6`, giải quyết triệt để lỗi `400 VALIDATION_ERROR` của FE và đảm bảo hợp đồng OpenAPI v7.

---

## 1. Tổng Quan & Bối Cảnh (Overview)

### 1.1 Vấn đề hiện tại
- Phía Frontend (FE) gửi request đăng nhập `POST /api/v1/auth/login` với body `{ identifier, password }` trên nhánh `feat/foundation-v6` và bị chặn bởi lỗi **`400 Request validation failed`**.
- Nguyên nhân:
  1. Nhánh `feat/foundation-v6` hiện tại chỉ có module khung `src/modules/identity` cũ, trong đó controller mong đợi `{ username, password }` thay vì `{ identifier, password }` theo chuẩn OpenAPI v7.
  2. Chưa tích hợp middleware `cookieParser` trong `src/app.js`, khiến cơ chế HttpOnly Cookie cho Refresh Token chưa hoạt động.
  3. Response của `login` ở module cũ chỉ trả `{ accessToken, refreshToken, expiresIn }`, thiếu object `user` (`Me`) mà FE đang cần để lưu thông tin phiên làm việc và hiển thị giao diện Admin/Customer.
  4. Mọi tài khoản demo mẫu (Admin `0900000000`, Manager, Staff, Customer) và cơ chế lưu trữ MongoDB (`User`, `OtpChallenge`, `RefreshSession`, `AuditLog`) đều đã được hoàn thiện trên nhánh `feat/p0-auth-rbac` nhưng chưa được hợp nhất (merge/cherry-pick) sang nhánh `feat/foundation-v6`.

### 1.2 Mục tiêu đạt được
- Chuyển giao toàn bộ tính năng Auth đã hoàn thiện từ `feat/p0-auth-rbac` sang `feat/foundation-v6`.
- Đảm bảo 100% tương thích với hợp đồng OpenAPI v7 (`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`):
  - Request login: `{ identifier, password }` (minLength: 8, `additionalProperties: false`).
  - Response login & refresh: Trả về HTTP 200 `{ accessToken, refreshToken, expiresIn, user: Me }` VÀ đồng thời set HttpOnly cookie `refreshToken`.
  - Endpoint `/api/v1/auth/me`: Trả về đúng schema `Me`.
  - Endpoint `/api/v1/auth/refresh`: Hỗ trợ lấy refresh token từ Cookie hoặc body fallback.
- Giữ nguyên vẹn 100% tính năng Catalog & Kho độc lập (P0) đã hoàn thành và đã pass toàn bộ tests.

---

## 2. Tiêu Chí Nghiệm Thu (Success Criteria)

1. **API `/api/v1/auth/login`:**
   - [ ] Nhận body `{ identifier: "0900000000", password: "Admin@1234" }` (hoặc email).
   - [ ] Trả về mã HTTP `200 OK`.
   - [ ] Response body chứa `accessToken`, `refreshToken`, `expiresIn: 900`, và object `user` (id, fullName, email, phone, systemRole: "ADMIN", staffSubRole, accountStatus: "ACTIVE", activationStatus: "ACTIVATED", lastLogin, branchScope).
   - [ ] Header `Set-Cookie` chứa cookie `refreshToken` với thuộc tính `HttpOnly`, `SameSite: strict`, `Path: /api/v1/auth`.
2. **API `/api/v1/auth/refresh`:**
   - [ ] Nhận refresh token từ Cookie hoặc body.
   - [ ] Cấp mới access token và rotate refresh token an toàn.
3. **API `/api/v1/auth/me`:**
   - [ ] Nhận header `Authorization: Bearer <accessToken>`.
   - [ ] Trả về schema `Me` chuẩn xác.
4. **Bảo Mật & OpenAPI Validator Strictness:**
   - [ ] Không rò rỉ các trường nhạy cảm (`passwordHash`, `__v`) nhờ hàm serializer chuẩn hóa `formatMe()`.
   - [ ] Vượt qua kiểm tra `additionalProperties: false` của validator.
5. **Kiểm Thử & Dữ Liệu:**
   - [ ] Chạy `npm test` vượt qua 100% các bộ test (catalog, health, auth).
   - [ ] Chạy `npm run seed:demo` thành công trên database cloud.

---

## 3. Kiến Trúc & Danh Sách Tệp Cần Đồng Bộ (File Structure)

### 3.1 Tệp mới được sao chép/tích hợp từ nhánh `feat/p0-auth-rbac`
```
src/
├── models/
│   ├── User.js                     <-- Model User đầy đủ (phone, email, passwordHash, systemRole...)
│   ├── OtpChallenge.js             <-- Quản lý mã OTP
│   ├── RefreshSession.js           <-- Quản lý phiên refresh token xoay vòng
│   ├── AuditLog.js                 <-- Nhật ký bảo mật đăng nhập/đăng xuất
│   └── index.js
├── modules/
│   └── auth/
│       ├── auth.constants.js       <-- TTL token, cookie name, lockout rules
│       ├── auth.controller.js      <-- Controller xử lý HTTP & Cookie
│       ├── auth.routes.js          <-- Routes /login, /refresh, /me, /logout, /register...
│       └── auth.service.js         <-- Logic nghiệp vụ, hash, JWT, rotate session
├── utils/
│   ├── passwordHelpers.js          <-- Bcrypt hash & policy validator
│   ├── otpHelpers.js               <-- Sinh & verify OTP
│   ├── tokenHelpers.js             <-- Sinh opaque token & SHA-256 hash
│   └── auditLogger.js              <-- Helper ghi log audit
└── seeds/
    └── demoUsersSeed.js            <-- Script seed tài khoản demo Admin, Manager, Staff, Customer
```

### 3.2 Tệp cần cập nhật trong `feat/foundation-v6`
```
src/
├── app.js                          <-- Thêm cookieParser(), route /api/v1/auth trỏ sang auth.routes.js
├── shared/
│   └── config.js                   <-- Bổ sung jwt.resetSecret nếu cần
tests/
└── auth.test.js                    <-- Bổ sung test suite xác thực login, cookie và RBAC
```

---

## 4. Kế Hoạch Triển Khai Từng Bước (Task Breakdown)

### Task 1: Chuẩn bị Thư Viện & Cấu Trúc Model (P0 - Foundation)
- **Agent:** `backend-specialist` | **Skills:** `clean-code`, `database-design`
- **Mô tả:** 
  1. Thêm middleware `cookie-parser` vào [src/app.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/app.js) trước các routes.
  2. Đồng bộ các Model `User.js`, `OtpChallenge.js`, `RefreshSession.js`, `AuditLog.js` vào thư mục `src/models/`.
  3. Đồng bộ các helpers `passwordHelpers.js`, `otpHelpers.js`, `tokenHelpers.js`, `auditLogger.js` vào `src/utils/`.
- **INPUT → OUTPUT → VERIFY:**
  - *INPUT:* Source code từ nhánh `feat/p0-auth-rbac`.
  - *OUTPUT:* Các file model và helper hiện diện đầy đủ trong project.
  - *VERIFY:* `node -e "require('./src/models/User')"` không báo lỗi thiếu module.

---

### Task 2: Xây Dựng Serializer Chuẩn Hóa Theo OpenAPI v7 (P0 - Contract Compliance)
- **Agent:** `backend-specialist` | **Skills:** `api-patterns`
- **Mô tả:**
  1. Tạo hàm `formatMe(user)` để định dạng object `user` chính xác theo schema `#/components/schemas/Me` trong OpenAPI v7 (id, fullName, email, phone, systemRole, staffSubRole, accountStatus, activationStatus, lastLogin, branchScope).
  2. Tạo hàm `formatAuthTokens(tokens)` trả về `{ accessToken, refreshToken, expiresIn, user }`.
  3. Đảm bảo mọi trường `_id`, `passwordHash`, `__v` đều bị loại bỏ triệt để.
- **INPUT → OUTPUT → VERIFY:**
  - *INPUT:* Schema OpenAPI v7 tại `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`.
  - *OUTPUT:* File `src/modules/auth/auth.serializer.js`.
  - *VERIFY:* Serializer test trả về đúng các trường required của OpenAPI v7.

---

### Task 3: Tích Hợp Module Auth (Service, Controller, Routes) (P0 - Core API)
- **Agent:** `backend-specialist` | **Skills:** `clean-code`, `api-patterns`
- **Mô tả:**
  1. Đồng bộ `auth.service.js`, `auth.controller.js`, `auth.routes.js`, `auth.constants.js` vào `src/modules/auth/`.
  2. Cập nhật `auth.controller.js`:
     - Khi `login` thành công: Set HttpOnly Cookie `refreshToken` VÀ trả về JSON body `{ accessToken, refreshToken, expiresIn: 900, user: formatMe(user) }`.
     - Khi `refreshToken`: Nhận token từ cookie `req.cookies.refreshToken` hoặc `req.body.refreshToken`, set cookie mới và trả về JSON tokens.
     - Khi `getMe`: Trả về `formatMe(user)`.
     - Khi `logout`: Xóa HttpOnly Cookie và revoke session trong DB.
  3. Cập nhật [src/app.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/app.js) để `app.use('/api/v1/auth', authRoutes)` thay thế cho skeleton `identityRoutes`.
- **INPUT → OUTPUT → VERIFY:**
  - *INPUT:* Các file auth service/controller từ `feat/p0-auth-rbac` + serializer từ Task 2.
  - *OUTPUT:* Endpoints `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/me` sẵn sàng hoạt động.
  - *VERIFY:* Gửi POST `/api/v1/auth/login` với `{ identifier, password }` nhận 200 OK + Set-Cookie + user object.

---

### Task 4: Đồng Bộ Script Seed & Thêm Test Tự Động (P0 - Verification)
- **Agent:** `backend-specialist` | **Skills:** `testing-patterns`
- **Mô tả:**
  1. Đưa `src/seeds/demoUsersSeed.js` vào dự án và thêm lệnh script `"seed:demo": "babel-node src/seeds/demoUsersSeed.js"` vào `package.json`.
  2. Viết test suite `tests/auth.test.js` bao quát:
     - Login thành công với identifier (phone hoặc email) + nhận cookie và user object.
     - Login thất bại khi sai mật khẩu hoặc thiếu trường (báo 400 hoặc 401).
     - Refresh token thông qua Cookie.
     - Gọi `/api/v1/auth/me` với Bearer token hợp lệ.
  3. Chạy toàn bộ test: `npm test` (đảm bảo catalog, health và auth cùng PASS).
- **INPUT → OUTPUT → VERIFY:**
  - *INPUT:* Test cases Jest + supertest.
  - *OUTPUT:* Test suite `tests/auth.test.js`.
  - *VERIFY:* `npm test` đạt 100% PASS (tất cả các test suites).

---

### Task 5: Triển Khai Lên Render & Bàn Giao FE (P1 - Delivery)
- **Agent:** `backend-specialist` | **Skills:** `deployment-procedures`
- **Mô tả:**
  1. Commit và push code lên remote branch `feat/foundation-v6`.
  2. Chạy `npm run seed:demo` để đảm bảo MongoDB Atlas có đầy đủ tài khoản demo.
  3. Kiểm tra log trên Render: Xác nhận server reload êm đẹp, không còn lỗi 400 validation error.
  4. Thông báo cho FE để test login liên thông.
- **INPUT → OUTPUT → VERIFY:**
  - *INPUT:* Code hoàn chỉnh trên Git.
  - *OUTPUT:* Server Render cập nhật phiên bản mới.
  - *VERIFY:* FE gọi API `POST /api/v1/auth/login` trên Render thành công.

---

## 5. Phase X: Kế Hoạch Xác Minh (Verification Checklist)

Trước khi đóng task, bắt buộc phải hoàn thành các bước kiểm tra sau:
- [ ] **Lint & Cú pháp:** Mã nguồn không có lỗi import hoặc cú pháp Babel/ESM.
- [ ] **OpenAPI Validator:** Request và Response của `/auth/login`, `/auth/refresh`, `/auth/me` không vướng lỗi schema.
- [ ] **Kiểm thử tự động:** Chạy `npm test` -> Toàn bộ Test Suites (Health, Catalog, Auth) đều xanh lá (PASS).
- [ ] **HttpOnly Cookie:** Postman / curl kiểm tra có header `set-cookie: refreshToken=...; HttpOnly; SameSite=Strict`.
- [ ] **Không ảnh hưởng Catalog:** Module Category, Product, Inventory vẫn hoạt động 100% độc lập và đúng chuẩn P0.

---

## 6. Socratic Gate (Câu Hỏi Cần Xác Nhận Với Người Dùng Trước Khi Thực Thi)

1. **Phạm vi thay thế skeleton `identity`:** Bạn có đồng ý thay thế hoàn toàn module cũ `src/modules/identity` bằng `src/modules/auth` (được tối ưu theo OpenAPI v7) không?
2. **Body response của `/auth/login`:** Chuẩn OpenAPI v7 yêu cầu trả về cả `accessToken`, `refreshToken`, `expiresIn` và `user`. Để FE vừa dùng được cookie vừa dùng được biến JS, chúng ta sẽ trả `refreshToken` ở **cả trong response body LẪN trong HttpOnly cookie**. Bạn có nhất trí phương án này không?
