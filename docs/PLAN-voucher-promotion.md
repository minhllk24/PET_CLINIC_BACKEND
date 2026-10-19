# Plan: Voucher & Promotion Engine (Priority P1)

## 1. Overview
Hệ thống Voucher / Promotion là dữ liệu dùng chung (Global Data) cho cả 2 luồng thương mại điện tử (Orders) và dịch vụ phòng khám (Appointments). 
Mục tiêu là cung cấp giải pháp quản lý khuyến mãi tập trung, phân quyền chặt chẽ (Admin CRUD, Manager Read-only, Customer/Guest Validate), đảm bảo quota nhất quán tuyệt đối trong môi trường concurrency cao, không cho phép gộp voucher (chỉ 1 voucher/giao dịch), và xử lý chính xác bài toán đặt cọc 30% lịch hẹn theo đúng chuẩn kiến trúc Canonical v7.

---

## 2. Project Type & Context
- **Project Type:** BACKEND (API & Database Module)
- **Primary Agent:** `backend-specialist` + `security-auditor`
- **Supporting Agent:** `project-planner`
- **Canonical Contracts:**
  - `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` & `docs/07-openapi-v6.yaml`
  - `docs/Task-2.8-v7-confirmed/05-mongodb-schema-v7.md`
  - `docs/Task-2.8-v7-confirmed/08-authorization-matrix-v7.md`
  - `docs/Task-2.8-v7-confirmed/09-state-machines-v7.md`

---

## 3. Success Criteria (Definition of Done)
1. **Admin CRUD & Manager Read-only:**
   - Admin toàn quyền tạo (`POST /api/v1/vouchers`), cập nhật (`PATCH /api/v1/vouchers/:id`), tra cứu (`GET /api/v1/vouchers`).
   - Manager chỉ có quyền xem danh sách (`GET /api/v1/vouchers`), gọi POST/PATCH bị chặn `403 Forbidden`.
   - Customer / Guest chỉ có quyền kiểm tra tính hợp lệ (`POST /api/v1/vouchers/validate`).
2. **Không Stack Voucher:**
   - Mọi request checkout và booking chỉ nhận tối đa 1 mã voucher duy nhất (`voucherCode` / `code`).
3. **Validate & Reason Minh Bạch cho FE:**
   - `POST /api/v1/vouchers/validate` trả về `{ code, valid, reason, discount }`.
   - Reason chuẩn enum OpenAPI: `NOT_FOUND`, `EXPIRED`, `NOT_STARTED`, `QUOTA_EXCEEDED`, `INACTIVE`, `SCOPE_MISMATCH`, `MIN_CONDITION_NOT_MET`.
4. **Quota Atomicity & Lifecycle Hoàn Chỉnh:**
   - Validate / Quote: **KHÔNG** trừ quota.
   - Checkout / Booking Transaction: Chỉ trừ quota khi transaction COMMIT thành công thông qua atomic operation `findOneAndUpdate({ _id, usedCount: { $lt: quota }, status: 'ACTIVE' }, { $inc: { usedCount: 1 } })`.
   - Transaction Rollback: Tự động rollback, không rò rỉ quota.
   - Cancel / Payment Failure Compensation: Khôi phục quota chính xác, chống khôi phục trùng lặp (idempotent) qua bản ghi `VoucherUsage`.
5. **Nghiệp Vụ Appointment Payment Flow:**
   - Voucher giảm trừ trực tiếp trên `subtotal` → tính ra `finalAmount`.
   - `ONLINE_MOCK`: Khách thanh toán 100% `finalAmount` ngay khi đặt.
   - `PAY_AT_STORE`: Khách cọc 30% `finalAmount` (làm tròn số nguyên) và thanh toán khoản cọc này qua cổng `ONLINE_MOCK` upfront; 70% còn lại thu tại quầy khi hoàn thành.
6. **Kiểm Thử & Build:**
   - 100% unit tests và integration tests pass (`npm test`).
   - Biên dịch Babel (`npm run build`) thành công 100%.

---

## 4. Architectural Decisions & Key Rules

### 4.1 Schema Definition
- **Voucher Model (`src/modules/order/models/Voucher.js`):**
  - `code`: String, uppercase, trimmed, unique index.
  - `name`: String, required.
  - `discountType`: 'PERCENTAGE' | 'FIXED', required.
  - `discountValue`: Number (>= 0), required.
  - `scope`: 'ORDER' | 'PRODUCT' | 'SERVICE', required.
  - `effectiveFrom`: Date, required.
  - `effectiveTo`: Date, required.
  - `quota`: Number (integer >= 1), required.
  - `usedCount`: Number (default 0).
  - `status`: 'ACTIVE' | 'INACTIVE', default 'ACTIVE'.
  - `minOrderAmount`: Number (optional, min spending threshold).
  - `maxDiscountAmount`: Number (optional, cap for percentage discount).
  - `version`: Number (optimistic locking).

- **VoucherUsage Model (`src/modules/order/models/VoucherUsage.js`):**
  - `voucherId`: ObjectId ref Voucher.
  - `targetType`: 'ORDER' | 'APPOINTMENT'.
  - `targetId`: ObjectId (Order ID hoặc Appointment ID).
  - `discountApplied`: Number.
  - `consumedAt`: Date (thời điểm commit).
  - `restoredAt`: Date (thời điểm hoàn quota nếu cancel).
  - Index: `{ voucherId: 1, targetType: 1, targetId: 1 }` (unique).

### 4.2 Endpoint Mapping & Strict Schema Match
| Method | Endpoint | Role | Idempotency | Response Schema |
|--------|----------|------|-------------|-----------------|
| `POST` | `/api/v1/vouchers/validate` | Public (Customer/Guest) | No | `VoucherCheck` |
| `GET` | `/api/v1/vouchers` | MANAGER, ADMIN | No | `VoucherPage` |
| `POST` | `/api/v1/vouchers` | ADMIN only | Idempotency-Key Required | `Voucher` (201 Created) |
| `PATCH`| `/api/v1/vouchers/:id` | ADMIN only | No | `Voucher` (200 OK) |

*Lưu ý:* `additionalProperties: false` bắt buộc các object trả về phải chuẩn xác từng trường theo schema OpenAPI.

---

## 5. Detailed Task Breakdown

### Task 1: Voucher & VoucherUsage Data Models
- **Agent:** `backend-specialist`
- **Skill:** `database-design`, `clean-code`
- **Priority:** P0 (Foundation)
- **Dependencies:** None
- **Actions:**
  - Hoàn thiện schema Mongoose trong `src/modules/order/models/Voucher.js` và `src/modules/order/models/VoucherUsage.js`.
  - Khai báo compound index unique chống double-restore và double-consume.
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* Specification từ `05-mongodb-schema-v7.md` và `07-openapi-v7.yaml`.
  - *Output:* Hai file model Mongoose chuẩn hóa đầy đủ getters/setters, timestamps và indexes.
  - *Verify:* Model khởi tạo thành công không lỗi cú pháp, sync indexes script pass.

### Task 2: Core Voucher Validation & Calculation Utility
- **Agent:** `backend-specialist`
- **Skill:** `clean-code`, `api-patterns`
- **Priority:** P1
- **Dependencies:** Task 1
- **Actions:**
  - Tạo `src/modules/order/voucher.service.js` với các helper thuần túy (pure functions) để tính toán và validate:
    - `validateVoucherEligibility({ voucher, scope, subtotal, customerId })` -> trả `{ valid, reason, discount }`.
    - `calculateDiscount({ voucher, subtotal })`.
    - `consumeQuotaInSession({ voucherId, targetType, targetId, discountApplied, session })`.
    - `restoreQuotaInSession({ voucherId, targetType, targetId, session })`.
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* Mã voucher, giỏ hàng/lịch hẹn, thời gian thực.
  - *Output:* Service function xử lý triệt để 7 lý do invalid enum, trả mức giảm giá chuẩn.
  - *Verify:* Unit test tính toán độc lập cho cả FIXED và PERCENTAGE, có trần `maxDiscountAmount` và sàn `minOrderAmount`.

### Task 3: Voucher Admin & Public API Endpoints
- **Agent:** `backend-specialist` + `security-auditor`
- **Skill:** `api-patterns`, `vulnerability-scanner`
- **Priority:** P1
- **Dependencies:** Task 2
- **Actions:**
  - Tạo `src/modules/order/voucher.controller.js` và `src/modules/order/voucher.routes.js`.
  - Cấu hình phân quyền `requireRole(['ADMIN'])` cho create/update; `requireRole(['MANAGER', 'ADMIN'])` cho list.
  - Mount router tại `app.use('/api/v1/vouchers', voucherRoutes)` trong `src/app.js`.
  - Hỗ trợ phân trang cursor-based theo OpenAPI `VoucherPage`.
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* Request payloads từ Admin/Manager/Customer.
  - *Output:* Controller trả đúng response codes (200, 201, 400, 401, 403, 404, 409, 422).
  - *Verify:* OpenAPI validator pass không chặn thuộc tính thừa/thiếu.

### Task 4: Integrate Voucher Consumption & Rollback into Order Checkout
- **Agent:** `backend-specialist`
- **Skill:** `database-design`, `clean-code`
- **Priority:** P1
- **Dependencies:** Task 2, Task 3
- **Actions:**
  - Cập nhật `src/modules/order/order.service.js`:
    - Thay thế placeholder `voucherDiscount = 0` bằng logic lookup và validate voucher.
    - Trong `session.withTransaction`: gọi `consumeQuotaInSession` cùng lúc với `issueForOrder` và `order.save`.
    - Lưu snapshot voucher vào `order.voucher = { voucherId, code }`.
    - Phân bổ discount theo dòng sản phẩm (`allocatedDiscount` và `lineNet`).
    - Trong các flow hủy đơn (`cancelOrder`, compensation on payment failure): gọi `restoreQuotaInSession`.
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* Payload checkout có `voucherCode`.
  - *Output:* Đơn hàng được giảm giá, quota `usedCount` tăng 1, `VoucherUsage` ghi nhận. Nếu transaction fail, quota nguyên vẹn.
  - *Verify:* Chạy test checkout với voucher hợp lệ, voucher hết hạn, và voucher vượt quota.

### Task 5: Integrate Voucher & Deposit 30% into Appointment Booking
- **Agent:** `backend-specialist`
- **Skill:** `api-patterns`, `clean-code`
- **Priority:** P1
- **Dependencies:** Task 2, Task 3
- **Actions:**
  - Cập nhật `src/modules/booking/booking.service.js`:
    - Nhận `voucherCode` từ booking request.
    - Validate scope `SERVICE` hoặc `ORDER` (nếu cho phép global).
    - Tính `finalAmount = Math.max(0, subtotal - voucherDiscount)`.
    - Nếu `paymentMethod === 'ONLINE_MOCK'`:
      - `paidAmount = finalAmount`, `depositAmount = 0`, `balanceAmount = 0`.
      - Payment record `kind = 'FULL'`, `amount = finalAmount`.
    - Nếu `paymentMethod === 'PAY_AT_STORE'`:
      - `depositAmount = Math.round(finalAmount * 0.30)`.
      - `balanceAmount = finalAmount - depositAmount`.
      - Payment record `kind = 'DEPOSIT'`, `amount = depositAmount` (thu upfront qua ONLINE_MOCK).
    - Thực hiện `consumeQuotaInSession` trong cùng Mongoose transaction với `appointment.save`.
    - Hỗ trợ hoàn quota khi Appointment bị CANCEL trước giờ hẹn hợp lệ.
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* Payload đặt lịch có `paymentMethod` và `voucherCode`.
  - *Output:* Lịch hẹn lưu đúng dải pricing (`subtotal`, `voucherDiscount`, `finalAmount`, `depositAmount`, `balanceAmount`) và payment tương ứng.
  - *Verify:* Unit test tính cọc 30% sau khi đã trừ voucher discount.

### Task 6: Unit & Integration Test Suite for Vouchers
- **Agent:** `test-engineer` (Backend Specialist)
- **Skill:** `testing-patterns`, `tdd-workflow`
- **Priority:** P2
- **Dependencies:** Tasks 1-5
- **Actions:**
  - Tạo `tests/voucher.test.js` bao phủ các ca:
    1. CRUD Voucher: Admin tạo thành công, Manager bị 403 Forbidden.
    2. Validate: Đầy đủ các trường hợp `NOT_FOUND`, `EXPIRED`, `QUOTA_EXCEEDED`, `INACTIVE`, `SCOPE_MISMATCH`.
    3. Concurrency / Quota: Đảm bảo quota chạm giới hạn thì request tiếp theo bị từ chối `QUOTA_EXCEEDED` (không âm/vượt quota).
    4. Order Checkout: Trừ quota khi checkout thành công, không trừ khi checkout fail.
    5. Order Cancel / Failure Compensation: Khôi phục quota và cấm khôi phục 2 lần.
    6. Appointment Deposit: Kiểm tra công thức cọc 30% của `finalAmount` sau voucher.
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* Test scenarios.
  - *Output:* File test `tests/voucher.test.js`.
  - *Verify:* `npm test` đạt 100% pass toàn bộ test suites.

---

## 6. Phase X: Verification Checklist
- [x] Chạy `npm test` → Tất cả 8/8 suites (124/124 tests) đều PASS 100%.
- [x] Chạy `npm run build` → Babel biên dịch toàn bộ thư mục `src/` (113 files) sang `dist/` thành công không có lỗi cú pháp.
- [x] Kiểm tra phản hồi OpenAPI: Mọi response của `/vouchers` và `/vouchers/validate` đều khớp với schema trong cả 2 file OpenAPI (v6 & v7) và tuân thủ `additionalProperties: false`.
- [x] Viết tài liệu bàn giao API cho Frontend (`docs/FE-HANDOFF-P1-VOUCHER-PROMOTION.md`).
- [x] Áp dụng nhất quán 3 lựa chọn Khuyến Nghị A: Hoàn quota lịch hẹn huỷ $\ge 24$h, công thức cọc 30% `Math.round(finalAmount * 0.30)`, và chặn Admin update `quota < usedCount` (422).
