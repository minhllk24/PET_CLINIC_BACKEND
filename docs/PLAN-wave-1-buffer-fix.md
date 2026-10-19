# Kế hoạch Triển khai: BUFFER – Fix Wave 1

> **Mục tiêu:** Rà soát và giải quyết triệt để toàn bộ các lỗi Blocker / High-Risk từ Checkpoint Wave 1; sửa dứt điểm các điểm mismatch giữa UI (Figma/Wireframe) ↔ API (OpenAPI 3.1) ↔ DB (MongoDB Mongoose); khóa chặt lỗ hổng phân quyền (RBAC) và xác thực dữ liệu (RFC 9457 Problem Details); smoke-test toàn bộ các module Wave 1 để đảm bảo nền tảng tuyệt đối ổn định trước khi mở rộng Order/Appointment. Không mở feature mới trong thời gian buffer.

---

## 1. Bảng Đối Soát 20 Rủi Ro High-Risk (Checkpoint Audit Matrix)

*Đối chiếu theo Mục 40 tài liệu `BACKEND_HANDOFF_LATEST_WEB2.md`:*

| # | Rủi ro High-Risk | Kiểm tra Hiện trạng Code | Trạng thái | Hành động khắc phục |
|---|---|---|:---:|---|
| **1** | Product/Service/Voucher Manager được global CRUD | Đã gán `requireRole(['ADMIN'])` cho mọi mutation tại `catalog.routes.js` và `voucher.routes.js`. Manager chỉ có quyền `GET`. | ✅ ĐẠT | Giữ nguyên và bổ sung test case RBAC Manager cố tình POST/PATCH/DELETE. |
| **2** | Customer có `branchId` | Model `Customer.js` chỉ lưu `activityBranchIds[]` (lịch sử hoạt động), không có trường `branchId` cố định. | ✅ ĐẠT | Đảm bảo không API nào cho phép gán `branchId` vào hồ sơ Customer. |
| **3** | Customer chọn fulfillment branch | Đơn hàng chọn `fulfillmentBranchId` tự động theo thứ tự ưu tiên từ `SystemSetting` (`commerce.fulfillmentBranchPriority`). | ✅ ĐẠT | Xác nhận customer payload không có trường `fulfillmentBranchId`. |
| **4** | Order split nhiều branch | Toàn bộ cart chỉ chuyển giao cho 1 branch ACTIVE đầu tiên đủ tồn toàn bộ items. | ✅ ĐẠT | Duy trì invariant không tách đơn. |
| **5** | Service `requiredStaffRole = RECEPTIONIST` | Model `Service.js` giới hạn enum `['CARE_STAFF_GROOMER', 'NURSE', 'VETERINARIAN']`. | ✅ ĐẠT | Chặn hoàn toàn role lễ tân trong danh mục dịch vụ kỹ thuật. |
| **6** | Appointment nhiều service bắt cùng role | Segment độc lập: mỗi service line có `requiredStaffRole` và `assignedStaffId` riêng. | ✅ ĐẠT | Đã hoàn thành tại P0 Appointment. |
| **7** | Appointment complete ngay segment đầu | Appointment chỉ `COMPLETED` khi toàn bộ segments đã hoàn thành. | ✅ ĐẠT | Đã hoàn thành tại P0 Appointment. |
| **8** | ServiceRecord tạo theo từng segment | 1 ServiceRecord tổng cho toàn bộ Appointment, quản lý bằng CAS `version`. | ✅ ĐẠT | Đã hoàn thành. |
| **9** | Reopen xóa ledger cũ | Khi hoàn trả/hủy kho, luôn tạo transaction đảo chiều (`RETURN`, `ADJUST`), không xóa ledger. | ✅ ĐẠT | Đã tuân thủ sổ cái bất biến. |
| **10** | Direct stock overwrite | Mọi thay đổi tồn kho đều bắt buộc ghi nhận qua `InventoryTransaction` trong session transaction. | ✅ ĐẠT | Kiểm tra lại toàn bộ file `inventory.service.js`. |
| **11** | Online appointment chỉ trả 30% | `ONLINE_MOCK` bắt buộc thu đủ 100% `finalAmount`. Chỉ `PAY_AT_STORE` mới cọc 30%. | ✅ ĐẠT | Đã hoàn thành và test pass. |
| **12** | `PAY_AT_STORE` đi qua mockComplete chung | Tách biệt endpoint `POST /appointments/{id}/pay-prepayment` (cọc 30%) và hoàn tất tại quầy. | ✅ ĐẠT | Đã hoàn thành. |
| **13** | COD PAID trước Delivered | COD chỉ chuyển trạng thái `PAID` khi Order chuyển `DELIVERED`. | ✅ ĐẠT | Đã hoàn thành trong P0 Order. |
| **14** | `Branch.slotCapacity` | Schema `Branch.js` không lưu `slotCapacity`. Capacity quản lý độc lập tại `BranchServiceConfig.capacity`. | ✅ ĐẠT | Đã tuân thủ ADR-38. |
| **15** | `Service.contactInfo.branchId` | `Service.contactInfo` chỉ có `hotline` và `instruction`, không chứa `branchId`. | ✅ ĐẠT | Đã tuân thủ chuẩn Catalog. |
| **16** | Booking refund có TRANSFER | Refund chỉ dùng `PAYMENT_GATEWAY_REVERSAL` hoặc `CASH_AT_STORE`, không hỗ trợ chuyển khoản thủ công. | ✅ ĐẠT | Đã chuẩn hóa enum `RefundMethod`. |
| **17** | Guest endpoint chỉ dùng bearer/anonymous thiếu token | Đã tách biệt Header `X-Guest-Cart-Token` và `X-Guest-Lookup-Token`. | ✅ ĐẠT | Middleware `authorizeRequest.js` / `guestTokenMiddleware.js`. |
| **18** | Material có CRUD module riêng ngoài seed scope | Vật tư dùng chung collection `InventoryItem` (loại `MATERIAL`), không sinh module riêng. | ✅ ĐẠT | Đã khớp với schema. |
| **19** | Target CANCELLED vẫn có callback Payment $\rightarrow$ PAID | Check status trước khi xử lý callback, hủy thanh toán nếu appointment/order đã CANCELLED. | ✅ ĐẠT | Đã có guardrail chặn callback mồ côi. |
| **20** | Manager block Customer | Manager không có quyền khóa tài khoản Customer (chỉ ADMIN). | ⚠️ CẦN RÀ SOÁT | Bổ sung kiểm tra RBAC trên các router Auth / Customer. |

---

## 2. Danh mục Công việc Cụ thể (Actionable Tasks)

### Task 1: Rà soát & Khóa chặt RBAC / Scope Kiểm soát Chi nhánh
- **Mục tiêu:** Đảm bảo tính bảo mật và đúng phạm vi quản lý:
  - Manager chỉ có quyền xem/sửa chi nhánh trong mảng `assignedBranchIds`.
  - Khóa quyền thao tác Customer: Manager không được phép block/deactivate Customer.
  - Phân quyền rõ ràng trên route `/api/v1/shifts`: Quản lý ca làm việc chỉ dành cho Admin và Manager của chi nhánh tương ứng.
- **File tác động:**
  - `src/modules/customer/customer.routes.js`
  - `src/modules/staff/staff.routes.js`
  - `src/shared/authMiddleware.js`
- **Xác thực:** Supertest gửi token Manager thao tác ngoài phạm vi branch $\rightarrow$ Trả về `403 Forbidden` (`AUTHORIZATION_ERROR`).

### Task 2: Chuẩn hóa Chuẩn Lỗi RFC 9457 Problem Details & Validation
- **Mục tiêu:** Rà soát tất cả các route của Wave 1 (Auth, Catalog, Branch, Staff, Inventory, Cart), đảm bảo:
  - Toàn bộ lỗi trả về định dạng chuẩn: `{ type, title, status, code, detail, instance }`.
  - Không lộ stack trace hay cấu trúc database thô ra phía client.
  - Strict payload validation: Không chấp nhận các trường thừa khi gọi API POST/PATCH (`additionalProperties: false`).
- **File tác động:**
  - `src/middleware/errorHandler.js`
  - `src/shared/errorCodes.js`
- **Xác thực:** Gửi request sai định dạng hoặc thiếu trường bắt buộc $\rightarrow$ Nhận phản hồi `400` hoặc `422` chuẩn Problem Details.

### Task 3: Đồng bộ Mismatch UI ↔ API ↔ DB trên Module Catalog & Inventory
- **Mục tiêu:**
  - Kiểm tra trường `images` của Product: Luôn luôn có đúng 1 ảnh `isPrimary: true`.
  - Kiểm tra trường `skuSnapshot` trong đơn hàng và cơ chế sinh SKU tự động không bị trùng lặp.
  - Đảm bảo các trường thời gian `createdAt`, `updatedAt` luôn ở định dạng chuẩn ISO-8601.
  - Đảm bảo `InventoryStock` không bị ghi đè trực tiếp mà phải thông qua `InventoryTransaction`.
- **File tác động:**
  - `src/modules/catalog/models/Product.js`
  - `src/modules/inventory/inventory.service.js`
- **Xác thực:** Chạy lại `tests/catalog.test.js` và `tests/inventory.test.js`.

### Task 4: Khắc phục Mismatch Route Quản lý Ca làm việc (`/api/v1/shifts`)
- **Mục tiêu:** Đồng bộ route `/shifts` theo chuẩn OpenAPI canonical contract (`07-openapi-v7.yaml` và `07-openapi-v6.yaml`):
  - Hỗ trợ `GET /api/v1/shifts` (lọc theo `branchId`, `staffId`, `from`, `to`).
  - Hỗ trợ `POST /api/v1/shifts` (tạo ca làm việc, kiểm tra không trùng lặp ca cùng nhân viên `SHIFT_OVERLAP`).
  - Hỗ trợ `PATCH /api/v1/shifts/{id}` và `POST /api/v1/shifts/{id}/cancel`.
  - Ngăn chặn hủy ca làm việc nếu ca đó đang có lịch hẹn đã xác nhận (`CONFIRMED`).
- **File tác động:**
  - `src/modules/staff/shift.service.js` (hoặc cập nhật `staff.routes.js`)
  - `src/modules/staff/models/Shift.js`
  - `src/app.js`
- **Xác thực:** Viết test case tạo ca trùng giờ $\rightarrow$ Bắn lỗi `409 SHIFT_OVERLAP`.

### Task 5: Smoke-Test & Full Regression Toàn Bộ Hệ Thống (Wave 1 + Wave 2 Foundation)
- **Mục tiêu:** Đảm bảo không xảy ra bất kỳ lỗi hồi quy nào trên 10 test suites:
  1. `tests/auth.test.js`
  2. `tests/contract.test.js`
  3. `tests/catalog.test.js`
  4. `tests/service-branch.test.js`
  5. `tests/inventory.test.js`
  6. `tests/cart.test.js`
  7. `tests/voucher.test.js`
  8. `tests/order.test.js`
  9. `tests/order-return.test.js`
  10. `tests/appointment.test.js`
- **Lệnh thực thi:** `npm test -- --runInBand`
- **Tiêu chí đạt:** 10/10 Test Suites PASS, 100% tests PASS (tối thiểu $\ge 146$ tests).

### Task 6: Biên soạn Biên Bản Nghiệm Thu (Wave 1 Stabilization Report)
- **Mục tiêu:** Bàn giao tài liệu nghiệm thu `docs/REPORT-WAVE-1-BUFFER-STABILIZATION.md` tổng kết toàn bộ quá trình audit, danh sách các blocker/mismatch đã fix, kết quả retest, và tuyên bố kết thúc giai đoạn Buffer.
- **File tác động:**
  - `docs/REPORT-WAVE-1-BUFFER-STABILIZATION.md`
- **Xác thực:** Tài liệu đầy đủ, minh bạch, sẵn sàng làm bệ phóng cho các tính năng tiếp theo.

---

## 3. Tiêu chí Hoàn thành (Done Definition)
- [ ] Không còn bất kỳ lỗi Blocker hoặc High-Risk nào từ Checkpoint Wave 1.
- [ ] Không có mismatch giữa UI Figma, OpenAPI Contract và MongoDB Schema.
- [ ] Manager không thể thao tác ngoài chi nhánh hoặc can thiệp dữ liệu global.
- [ ] Toàn bộ các test suite tự động vượt qua 100% không có cảnh báo nghiêm trọng.
- [ ] Build Babel production (`npm run build`) thành công 100%.
- [ ] Hoàn tất biên bản nghiệm thu `docs/REPORT-WAVE-1-BUFFER-STABILIZATION.md`.
