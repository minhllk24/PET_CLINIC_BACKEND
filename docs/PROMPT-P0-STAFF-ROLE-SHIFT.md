# 🧠 PROMPT NÂNG CAO – P0: STAFF / ROLE / SHIFT MANAGEMENT

> **Dự án:** Dr. Pet's House – Pet Clinic Backend (Node.js/Express/MongoDB/Mongoose)
> **Branch:** `feat/foundation-v6` | **Spec:** OpenAPI v6.0.0 (file `docs/07-openapi-v6.yaml`)
> **Ngày tạo prompt:** 2026-10-19 | **Tác giả prompt:** An Thai
> **Mục tiêu:** Hoàn thiện task P0 – Staff/Role/Shift Management để Admin quản lý Staff/Role/Shift, Manager làm việc theo assignedBranches, và Appointment/Availability đọc được Shift thật tại đúng branch để tính slot.

---

## I. BỐI CẢNH DỰ ÁN (CONTEXT)

### 1.1 Kiến trúc Backend hiện tại

```
BE/src/
├── app.js                          # Express app, CORS, OpenAPI Validator, Routes mount
├── server.js                       # MongoDB connect + app.listen
├── models/
│   ├── User.js                     # Core user model (ADMIN|MANAGER|STAFF|CUSTOMER)
│   ├── AuditLog.js                 # Audit trail
│   ├── OtpChallenge.js             # OTP cho registration/reset password
│   ├── RefreshSession.js           # Stateful refresh tokens
│   └── Counter.js                  # Auto-increment counters
├── modules/
│   ├── auth/                       # ✅ DONE: Login/Register/Refresh/Logout/OTP/ChangePassword
│   │   ├── auth.service.js         # Login logic tìm user bằng username|email|phone
│   │   ├── auth.controller.js      # HTTP handlers
│   │   ├── auth.serializer.js      # formatMe(), formatAuthTokens() – OpenAPI compliance
│   │   ├── auth.routes.js
│   │   └── auth.constants.js
│   ├── staff/                      # ⚠️ SKELETON – Cần hoàn thiện
│   │   ├── models/
│   │   │   ├── StaffProfile.js     # userId, staffSubRole, authorizedBranchIds, homeBranchId, status
│   │   │   └── Shift.js            # staffId→StaffProfile, branchId, startAt, endAt, status
│   │   └── staff.routes.js         # Placeholder routes (GET /, POST /, GET /:staffId/shifts, POST /:staffId/shifts)
│   ├── booking/                    # ✅ Availability engine đã sẵn
│   │   ├── availability.service.js # ĐỌC Shift + StaffProfile để tính slot (đã hoàn chỉnh)
│   │   ├── booking.service.js      # Appointment booking logic
│   │   └── models/Appointment.js   # services[].assignedStaffId → StaffProfile
│   ├── branch/                     # ✅ DONE: Branch CRUD + BranchServiceConfig
│   ├── catalog/                    # ✅ DONE: Product/Category/Service CRUD
│   └── ...                         # customer, order, cart, upload, etc.
├── shared/
│   ├── authorizeRequest.js         # Middleware đọc x-authz từ OpenAPI spec → check role
│   ├── config.js                   # ENV config (mongoUri, jwt secrets, etc.)
│   ├── errorHandler.js             # RFC 9457 error format
│   └── logger.js                   # Pino logger
├── middleware/
│   ├── authMiddleware.js           # JWT verify
│   └── idempotencyMiddleware.js    # Idempotency-Key support
├── seeds/
│   └── demoUsersSeed.js            # 9 demo accounts (admin, manager, doctor, receptionist, groomer, nurse, customer, pending_user, blocked_user)
└── utils/
    ├── AppError.js                 # Custom error class
    ├── auditLogger.js              # recordAuditLog()
    ├── otpHelpers.js               # OTP generation/verification
    └── tokenHelpers.js             # Opaque token generation
```

### 1.2 Hệ thống phân quyền (RBAC) hiện tại

```
User.systemRole ∈ ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']
User.staffSubRole ∈ ['RECEPTIONIST', 'CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'] (chỉ khi systemRole='STAFF')
User.assignedBranchIds[] → Dành cho MANAGER (phạm vi chi nhánh được gán)

StaffProfile.authorizedBranchIds[] → Dành cho STAFF (các chi nhánh được phép làm việc)
StaffProfile.homeBranchId → Chi nhánh chính của nhân viên

Authorization flow:
  1. JWT verify (app.js:156-173) → req.actor = { id, systemRole, staffSubRole, assignedBranchIds }
  2. authorizeRequest.js → đọc x-authz.roles từ OpenAPI spec → check systemRole/staffSubRole
  3. Service layer → Resource Scope Resolver (kiểm tra branch/ownership/assignment)
```

### 1.3 Tài khoản Demo hiện tại (trong demoUsersSeed.js)

| Username (Text) | systemRole | staffSubRole | Phone | Password | Status |
|---|---|---|---|---|---|
| `admin` | ADMIN | — | 0900000000 | Admin@1234 | ACTIVE |
| `manager` | MANAGER | — | 0901234567 | Manager@1234 | ACTIVE |
| `doctor` | STAFF | VETERINARIAN | 0903333333 | Doctor@1234 | ACTIVE |
| `receptionist` | STAFF | RECEPTIONIST | 0904444444 | Staff@1234 | ACTIVE |
| `groomer` | STAFF | CARE_STAFF_GROOMER | 0908888888 | Staff@1234 | ACTIVE |
| `nurse` | STAFF | NURSE | 0909999999 | Staff@1234 | ACTIVE |
| `customer` | CUSTOMER | — | 0905555555 | Customer@1234 | ACTIVE |
| `pending_user` | CUSTOMER | — | 0907777777 | Customer@1234 | PENDING |
| `blocked_user` | CUSTOMER | — | 0906666666 | Customer@1234 | BLOCKED |

### 1.4 Frontend hiện tại (React + Vite)

- **Repo:** `FE/` trên branch `build-init`
- **Stack:** React, Vite, Redux, Axios (apiClient.js gọi /api/v1/...)
- **Chú ý:** FE hiện CHƯA có trang Admin/Staff Management → Đây là Customer-facing app
- **Admin App:** Là dự án Angular riêng biệt (được reference trong docs nhưng KHÔNG nằm trong workspace)
- **FE authService.js:** Đang gửi `login_id` thay vì `identifier` → CẦN FIX FE hoặc bridge BE

### 1.5 Availability Engine (CRITICAL – Đã hoạt động)

File `availability.service.js` HIỆN ĐÃ ĐỌC Shift và StaffProfile để tính slot:
1. Query Shift theo `branchId + date + status='ACTIVE'` → `.populate('staffId')` (staffId → StaffProfile)
2. Lọc staff có `profile.status === 'ACTIVE'` và `profile.staffSubRole` khớp `service.requiredStaffRole`
3. Kiểm tra staff không bị trùng lịch hẹn tại thời điểm đó
4. → **Kết luận: Chỉ cần tạo đúng Shift data thật là Availability engine tự hoạt động**

---

## II. YÊU CẦU TASK – CHỨC NĂNG CẦN XÂY DỰNG

### 2.1 Module Staff Management (CRUD + Internal Account)

#### A. POST /api/v1/staff – Tạo hồ sơ nhân viên + Internal Account

**Business logic:**
1. Chỉ ADMIN được gọi (theo OpenAPI spec x-authz.roles: [ADMIN])
2. Tạo User với:
   - `systemRole: 'STAFF'`
   - `staffSubRole`: từ request body (RECEPTIONIST | CARE_STAFF_GROOMER | VETERINARIAN | NURSE)
   - `username`: tự động generate dạng text gợi nhớ (ví dụ: vet_nguyenvana, nurse_tranthib)
   - `password`: random mạnh (16+ ký tự, mix upper/lower/digit/special), KHÔNG dùng pattern cố định
   - `phone` và `email`: KHÔNG BẮT BUỘC cho tài khoản nội bộ (internal account chỉ dùng username)
   - `accountStatus: 'ACTIVE'`
3. Tạo StaffProfile liên kết userId với:
   - `staffSubRole` từ body
   - `authorizedBranchIds` từ body (≥1 branch)
   - `homeBranchId` từ body (optional, phải nằm trong authorizedBranchIds)
4. Return StaffProfile + thông tin tài khoản (bao gồm password raw để Admin copy giao cho nhân viên – chỉ trả 1 lần duy nhất)

**Validation rules:**
- `fullName`: required, 2-100 ký tự
- `staffSubRole`: required, must be in STAFF_SUB_ROLES enum
- `authorizedBranchIds`: required, ≥1, tất cả phải là Branch._id tồn tại và ACTIVE
- `homeBranchId`: nếu có, phải nằm trong authorizedBranchIds
- `email`: nếu có, phải unique trong collection User
- `phone`: nếu có, phải unique và đúng format 0xxxxxxxxx

#### B. GET /api/v1/staff – Danh sách nhân viên

**Business logic:**
- ADMIN: Xem tất cả staff
- MANAGER: Chỉ xem staff có authorizedBranchIds giao với req.actor.assignedBranchIds
- Query params: branchId, staffSubRole, limit, cursor (cursor-based pagination)

#### C. PATCH /api/v1/staff/{id} – Sửa thông tin staff

**Business logic:**
- Chỉ ADMIN (theo spec)
- Có thể sửa: staffSubRole, status (ACTIVE/INACTIVE)
- Khi sửa staffSubRole → đồng bộ sang User.staffSubRole
- Khi sửa status: INACTIVE → cancel tất cả Shift ACTIVE tương lai của staff đó

#### D. PUT /api/v1/staff/{id}/branches – Gán branch cho staff

**Business logic:**
- Chỉ ADMIN
- Cập nhật authorizedBranchIds và homeBranchId
- Validate tất cả branchIds tồn tại và ACTIVE
- homeBranchId phải nằm trong authorizedBranchIds

#### E. PUT /api/v1/managers/{id}/assigned-branches – Gán branch cho Manager

**Business logic:**
- Chỉ ADMIN
- Cập nhật User.assignedBranchIds (User có systemRole='MANAGER')
- Validate tất cả branchIds tồn tại

### 2.2 Module Shift Management (Ca làm việc)

#### A. POST /api/v1/shifts – Tạo ca

**Business logic:**
- ADMIN hoặc MANAGER (Manager chỉ tạo ca cho staff tại branch thuộc assignedBranchIds)
- Validate:
  - staffId phải là StaffProfile._id tồn tại và ACTIVE
  - branchId phải nằm trong StaffProfile.authorizedBranchIds
  - startAt < endAt
  - Ca tối thiểu 30 phút, tối đa 12 giờ
  - **KHÔNG TRÙNG CA:** Kiểm tra overlap với Shift ACTIVE khác của cùng staffId:
    `409 SHIFT_OVERLAP nếu: existing.startAt < newShift.endAt AND existing.endAt > newShift.startAt`
  - startAt phải nằm trong giờ mở cửa của Branch (theo Branch.openingHours[dayOfWeek])
  - startAt không được trong quá khứ

#### B. GET /api/v1/shifts – Query ca

**Business logic:**
- ADMIN: Xem tất cả
- MANAGER: Chỉ xem ca tại branch thuộc assignedBranchIds
- STAFF: Chỉ xem ca của chính mình
- Query params: staffId, branchId, dateFrom, dateTo, status, limit, cursor

#### C. PATCH /api/v1/shifts/{id} – Sửa ca

**Business logic:**
- ADMIN hoặc MANAGER (scoped by branch)
- Có thể sửa: startAt, endAt, branchId
- Re-validate overlap + branch authorization
- Optimistic concurrency via version field

#### D. POST /api/v1/shifts/{id}/cancel – Hủy ca

**Business logic:**
- ADMIN hoặc MANAGER (scoped by branch)
- State transition: ACTIVE → CANCELLED
- Body: { "reason": "..." }
- Side effect: Cảnh báo (log/audit) nếu có Appointment CONFIRMED overlapping với ca bị hủy
- Idempotency-Key required

### 2.3 Thay đổi tài khoản Demo (Account Policy)

#### A. Internal Accounts (ADMIN, MANAGER, STAFF) – Chỉ dùng Username Text
- Tài khoản nội bộ đăng nhập bằng USERNAME TEXT duy nhất
- KHÔNG gán phone/email cho các tài khoản này (hoặc optional)
- Login chấp nhận: identifier = username

#### B. External Accounts (CUSTOMER) – Giữ nguyên
- Khách hàng đăng nhập bằng: Phone / Email / Username (nếu có)

#### C. Password Policy – Random mạnh, không pattern cố định
- Mật khẩu phải random, KHÔNG theo cấu trúc "Role@1234"
- Dùng crypto.randomBytes() tạo password 16+ ký tự
- Mix: uppercase + lowercase + digits + special chars
- Lưu vào console log khi seed để DevOps copy

### 2.4 Attendance/Chấm công – Chỉ Mockup
- KHÔNG build biometric/timekeeping/payroll thật
- Chỉ tạo model skeleton với status: CHECKED_IN | CHECKED_OUT | ABSENT
- Route placeholder: GET /api/v1/attendance?staffId=&date=
- Trả mock data hardcoded

---

## III. QUY TẮC KỸ THUẬT BẮT BUỘC (CONSTRAINTS)

### 3.1 Pattern tuân thủ từ codebase hiện tại

1. **Module pattern:** modules/{name}/ chứa *.controller.js, *.service.js, *.routes.js, *.serializer.js, models/
2. **Error format:** RFC 9457 Problem Details – sử dụng AppError(status, title, code, detail)
3. **Serializer:** Mọi response phải qua serializer → additionalProperties: false trong OpenAPI
4. **Audit trail:** Mọi mutation phải gọi recordAuditLog()
5. **Optimistic concurrency:** Dùng { version: Number, optimisticConcurrency: true, versionKey: 'version' }
6. **Cursor-based pagination:** Trả { items: [], nextCursor: string|null } (KHÔNG dùng skip/offset)
7. **Idempotency:** POST endpoints mutation phải support Idempotency-Key header
8. **Index design:** Mọi query pattern phải có compound index hỗ trợ
9. **OpenAPI spec:** PHẢI cập nhật docs/07-openapi-v6.yaml đồng bộ với code

### 3.2 Permission Scope Resolution (Critical)

```javascript
// Manager chỉ thao tác trên staff/shift thuộc branch được gán:
if (actor.systemRole === 'MANAGER') {
  const actorBranches = new Set(actor.assignedBranchIds.map(String));
  const targetBranches = staffProfile.authorizedBranchIds.map(String);
  const hasOverlap = targetBranches.some(b => actorBranches.has(b));
  if (!hasOverlap) throw new AppError(403, 'Forbidden', 'SCOPE_VIOLATION', '...');
}

// Staff chỉ xem/thao tác shift của mình:
if (actor.systemRole === 'STAFF') {
  const myProfile = await StaffProfile.findOne({ userId: actor.id });
  if (shift.staffId.toString() !== myProfile._id.toString()) {
    throw new AppError(403, 'Forbidden', 'SCOPE_VIOLATION', '...');
  }
}
```

### 3.3 Tích hợp với Availability Engine

```
availability.service.js đã hoàn chỉnh và ĐỌC từ:
- Shift.find({ branchId, status: 'ACTIVE', startAt < endOfDay, endAt > startOfDay }).populate('staffId')
- StaffProfile: profile.status === 'ACTIVE' && profile.staffSubRole === service.requiredStaffRole

→ CHỈ CẦN:
1. Tạo StaffProfile records đúng schema
2. Tạo Shift records đúng schema (staffId → StaffProfile._id, KHÔNG phải User._id)
3. Cập nhật demoUsersSeed.js để seed StaffProfile + Shift sample data
→ Availability engine sẽ TỰ ĐỘNG tính đúng slot
```

### 3.4 Test Coverage yêu cầu

Test mới cần thêm (file tests/staff-shift.test.js):
1. POST /api/v1/staff → tạo internal account + StaffProfile
2. GET /api/v1/staff → pagination, filter by branchId/staffSubRole
3. PATCH /api/v1/staff/:id → update staffSubRole, status
4. PUT /api/v1/staff/:id/branches → assign branches
5. POST /api/v1/shifts → tạo shift, validate overlap → 409
6. GET /api/v1/shifts → filter by staffId/branchId/date
7. PATCH /api/v1/shifts/:id → update shift time
8. POST /api/v1/shifts/:id/cancel → cancel shift
9. Permission tests: Manager scope restriction, Staff self-only
10. Integration: Sau khi tạo shift → GET /api/v1/availability trả slot đúng

### 3.5 Git Commit Convention

```
Author: An Thai <thainak24406h@st.uel.edu.vn>
Branch: feat/foundation-v6
Message format: feat|fix|docs(scope): mô tả ngắn
```

---

## IV. THỨ TỰ THỰC HIỆN (EXECUTION ORDER)

### Phase 1: Foundation (Models + Service)
1. Cập nhật StaffProfile.js nếu cần thêm fields
2. Cập nhật Shift.js nếu cần thêm fields (reason, cancelledBy, etc.)
3. Tạo staff.service.js – full CRUD logic
4. Tạo staff.controller.js – HTTP handlers
5. Tạo staff.serializer.js – OpenAPI compliant formatters
6. Tạo shift.service.js – full CRUD + overlap validation
7. Tạo shift.controller.js + shift.routes.js

### Phase 2: Routing + OpenAPI
8. Cập nhật staff.routes.js với proper middleware chain
9. Tạo shift.routes.js nếu tách riêng
10. Mount routes trong app.js
11. Thêm route /api/v1/shifts và /api/v1/managers/:id/assigned-branches vào app.js
12. Cập nhật 07-openapi-v6.yaml (schemas đã có, chỉ cần verify/sync)

### Phase 3: Seed Data + Account Policy
13. Cập nhật demoUsersSeed.js: Random strong passwords, seed StaffProfile + Shift
14. Internal accounts: username-only (phone/email optional)

### Phase 4: Testing
15. Tạo tests/staff-shift.test.js
16. Chạy npm test – đảm bảo 100% pass

### Phase 5: Documentation + Push
17. Cập nhật docs handoff
18. Commit + Push

---

## V. DONE CRITERIA (TIÊU CHÍ HOÀN THÀNH)

- [ ] Admin CRUD Staff: Tạo internal account, gán role, gán branch, deactivate
- [ ] Admin/Manager CRUD Shift: Tạo ca, sửa ca, hủy ca, validate overlap → 409
- [ ] Manager scope: Chỉ thao tác staff/shift thuộc assignedBranchIds
- [ ] Staff scope: Chỉ xem ca của mình
- [ ] GET /api/v1/availability: Đọc Shift thật tại đúng branch → trả slot chính xác
- [ ] Internal accounts: Chỉ dùng username text, password random mạnh
- [ ] Customer accounts: Giữ nguyên phone/email/username linh hoạt
- [ ] Demo seed: Tạo StaffProfile + Shift sample → Availability engine hoạt động
- [ ] Attendance: Mockup route placeholder (không build thật)
- [ ] npm test: 100% pass (tất cả test cũ + mới)
- [ ] OpenAPI spec: Đồng bộ với code
- [ ] Git: Commit đúng quy trình với author An Thai

---

## VI. REFERENCE FILES

| File | Mục đích |
|---|---|
| `src/models/User.js` | User schema – systemRole, staffSubRole, assignedBranchIds |
| `src/modules/staff/models/StaffProfile.js` | Staff profile – userId, staffSubRole, authorizedBranchIds, homeBranchId |
| `src/modules/staff/models/Shift.js` | Shift – staffId→StaffProfile, branchId, startAt, endAt, status |
| `src/modules/booking/availability.service.js` | Availability engine – ĐỌC Shift+StaffProfile để tính slot |
| `src/modules/booking/models/Appointment.js` | Appointment – services[].assignedStaffId→StaffProfile |
| `src/modules/branch/models/Branch.js` | Branch – openingHours, holidays |
| `src/shared/authorizeRequest.js` | RBAC middleware – đọc x-authz từ OpenAPI spec |
| `src/middleware/idempotencyMiddleware.js` | Idempotency-Key support |
| `src/modules/auth/auth.service.js` | Login logic – findOne({username OR email OR phone}) |
| `src/modules/auth/auth.serializer.js` | formatMe(), formatAuthTokens() |
| `src/seeds/demoUsersSeed.js` | Demo accounts seeding |
| `docs/07-openapi-v6.yaml:1249-1702` | Staff + Shift + Manager endpoints spec |
| `docs/07-openapi-v6.yaml:8459-8626` | Staff + Shift schemas |
| `tests/auth.test.js` | Auth test patterns to follow |
