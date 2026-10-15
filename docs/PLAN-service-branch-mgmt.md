# Kế hoạch Triển khai: Service Catalog & Branch Management (Priority P0)

> **Cập nhật đối soát (Double-Check):** Toàn bộ kế hoạch đã được đối chiếu và khớp 100% với tài liệu nguồn:
> - `docs/catalog.xlsx` (Sheet: *Catalog*)
> - `docs/business_rule-flow.xlsx` (Sheet: *business ruleflow* - Quy tắc M11, M12 và Luồng BF10)
> - `docs/features_new.xlsx` (Sheet: *feature* - Module M11, M12, M13, M15)

---

## Mục tiêu (Goal)
Tách bạch tuyệt đối giữa **Service Catalog** (master global, chỉ Admin CRUD definition) và **BranchServiceConfig** (cấu hình vận hành theo từng chi nhánh, do Manager trong `assignedBranches` và Admin quản trị). Xây dựng cơ chế tính toán lịch trống (`GET /availability`) tự động dựa trên Opening Hours, Holidays, BranchServiceConfig (enabled, capacity, temporary blocked windows), Staff Shift (`Shift.branchId`) và các cuộc hẹn hiện có. Loại bỏ hoàn toàn cấu hình slot mơ hồ; capacity là số segment tối đa chạy đồng thời (`maxConcurrentSegments`), không cho phép cấu hình theo từng khung giờ ở v1.

---

## 1. Bảng đối chiếu Nghiệp vụ cốt lõi (Source-of-Truth Mapping)

| Tiêu chí | Quy định trong `catalog.xlsx` & `business_rule-flow.xlsx` | Thiết kế triển khai Backend |
|---|---|---|
| **Phân định Master vs Branch** | **M11, M12:** Service Catalog là dữ liệu global do Admin quản lý; Manager không sửa định nghĩa global. BranchService là cấu hình vận hành theo branch, Manager chỉ thao tác trong `assignedBranches[]`. | • Service Catalog: `GET /services`, `POST /services`, `PATCH /services/:id`, `POST /services/:id/archive` (Chỉ ADMIN ghi; Manager chỉ đọc).<br>• BranchServiceConfig: `/branches/:branchId/service-configs` (Manager kiểm tra `req.actor.assignedBranchIds.includes(branchId)`). |
| **Bảng giá Grooming & Weight Tiers** | **catalog.xlsx - I3:** Grooming có 5 tiers cố định:<br>• XS: `<5kg`<br>• S: `5 <= weightKg < 10`<br>• M: `10 <= weightKg < 20`<br>• L: `20 <= weightKg <= 30`<br>• XL: `>30kg` (REQUIRES_QUOTE: không có numeric price). | Schema `Service.priceVariants` lưu mảng `{ label, minWeightKg, maxWeightKg, price }` khớp đúng 4 numeric tiers (XS, S, M, L). Tier XL (>30kg) được đánh dấu quote-only. |
| **Vai trò nhân sự (requiredStaffRole)** | **BF10, catalog.xlsx:**<br>• GROOMING: bắt buộc `CARE_STAFF_GROOMER`.<br>• MEDICAL: `VETERINARIAN` (Khám, Tiêm, Test, Siêu âm, Phẫu thuật, Cấp cứu) hoặc `NURSE` (Thay băng/chăm sóc `MED05`). Không bao giờ là `RECEPTIONIST`. | Ràng buộc `oneOf` trong model `Service`: GROOMING chỉ nhận `CARE_STAFF_GROOMER`; MEDICAL chỉ nhận `NURSE` hoặc `VETERINARIAN`. |
| **Booking Mode & Ràng buộc bảo vệ** | **M15, catalog.xlsx:**<br>• `BOOKABLE`: Khách tự book slot online.<br>• `REQUEST_ONLY`: Phẫu thuật (`MED06`).<br>• `CONTACT_ONLY`: Cấp cứu 24/7 (`MED07`). | Dual-layer Guardrail: Backend kiểm tra category / name, chặn lỗi 422 nếu dịch vụ phẫu thuật/cấp cứu bị set sai `bookingMode`. |
| **Deposit Config** | **catalog.xlsx (rule 9), business_rule-flow (A56):** Tuyệt đối KHÔNG có cấu hình deposit riêng theo Service hay BranchService. Cọc 30% chỉ áp dụng khi Appointment chọn `PAY_AT_STORE`. | Model `Service` và `BranchServiceConfig` tuyệt đối không có trường `deposit`/`depositPercentage`. |
| **Capacity Semantics** | **M12, ADR-38:** `capacity` là số lượng segment cùng service được overlap đồng thời tại branch; là số nguyên cố định `>= 1`, không chia theo khung giờ. Bỏ `branches.slotCapacity`. | Model `BranchServiceConfig` lưu `capacity` (min: 1, default: 1). `Branch` không lưu `slotCapacity`. |
| **Cơ chế tính Slot (Availability)** | **BF10:** Slot phụ thuộc `openingHours + holiday + capacity + Shift (Shift.branchId, không dùng homeBranch) + existing bookings/holds`. Các segment mặc định thực hiện nối tiếp. | Thuật toán `GET /api/v1/availability`: Query `Shift` theo `branchId` + `staffSubRole`, trừ đi các booking/hold trùng khung giờ, bảo đảm `overlap < capacity` và còn staff rảnh cho từng segment. |
| **Shortcut / Aggregate** | **features_new (M11):** Service Catalog có thể hiển thị số branch đang bật và shortcut. | Bổ sung `enabledBranchCount` vào schema `Service` và cung cấp endpoint shortcut `GET /api/v1/services/:id/branches`. |

---

## 2. Chi tiết các Task triển khai (Actionable Tasks)

### Task 1: Chuẩn hóa Branch Model & Branch Endpoints
- **Tệp tin**: `src/modules/branch/models/Branch.js`, `src/modules/branch/branch.routes.js`, `src/modules/branch/branch.controller.js`
- **Nội dung**:
  1. Cập nhật schema `Branch.js`: `code` (unique, tự sinh `BR-XXXXXX`), `name`, `address`, `phone`, `status` (`ACTIVE`/`INACTIVE`), `openingHours` (array dayOfWeek 0..6, open HH:mm, close HH:mm), `holidays` (array date YYYY-MM-DD, note), `version`. Tuyệt đối không có `slotCapacity`.
  2. Endpoints trong `branch.routes.js`:
     - `GET /branches`: Cursor pagination (`BranchPage`), public chỉ xem `ACTIVE`, Manager/Admin xem tất cả.
     - `POST /branches`: Chỉ ADMIN, Idempotency-Key, tự sinh mã `BR-XXXXXX`.
     - `GET /branches/:id`: Chi tiết branch.
     - `PATCH /branches/:id`: ADMIN (toàn quyền) hoặc MANAGER (`id` nằm trong `assignedBranchIds`).
- **Xác minh**: Test CRUD branch, verify `status` filtering và RBAC.

---

### Task 2: Hoàn thiện Service Catalog Master Global
- **Tệp tin**: `src/modules/catalog/models/Service.js`, `src/modules/catalog/catalog.routes.js`, `src/modules/catalog/catalog.controller.js`
- **Nội dung**:
  1. Cập nhật schema `Service.js`:
     - `name`, `serviceType` (`GROOMING` | `MEDICAL`), `category`, `description`, `basePrice`, `priceVariants` (`[{ label, minWeightKg, maxWeightKg, price }]`), `durationMinutes`, `requiredStaffRole`, `bookingMode` (`BOOKABLE` | `REQUEST_ONLY` | `CONTACT_ONLY`), `defaultMaterials` (`[{ materialId, defaultQuantity, unit }]`), `contactInfo`, `status`, `version`.
     - Ràng buộc:
       - GROOMING -> `CARE_STAFF_GROOMER`.
       - MEDICAL -> `NURSE` hoặc `VETERINARIAN`.
       - Phẫu thuật -> `REQUEST_ONLY`.
       - Cấp cứu -> `CONTACT_ONLY`.
       - Không có cấu hình deposit.
  2. API endpoints:
     - `GET /services`: Lọc query `bookingMode`, `requiredStaffRole`, `category`, `status`, `search`, phân trang cursor `ServicePage`. Customer chỉ thấy `ACTIVE`. Trả về `enabledBranchCount`.
     - `POST /services`: ADMIN only, Idempotency-Key.
     - `GET /services/:id`: Chi tiết service.
     - `PATCH /services/:id`: ADMIN only.
     - `POST /services/:id/archive`: ADMIN only, chuyển `INACTIVE`, tự động disable toàn bộ `BranchServiceConfig` liên quan.
     - `GET /services/:id/branches`: Shortcut endpoint trả về danh sách chi nhánh và trạng thái bật/tắt của service này.
- **Xác minh**: Chạy test kiểm tra Manager bị 403 Forbidden khi ghi; Admin thao tác thành công; response khớp OpenAPI v7.

---

### Task 3: Triển khai BranchServiceConfig (Branch Context)
- **Tệp tin**: `src/modules/branch/models/BranchServiceConfig.js`, `src/modules/branch/branchServiceConfig.controller.js`, `src/modules/branch/branch.routes.js`
- **Nội dung**:
  1. Xây dựng schema `BranchServiceConfig.js`:
     - `branchId`: ObjectId ref `Branch`, required.
     - `serviceId`: ObjectId ref `Service`, required.
     - `enabled`: Boolean, default true.
     - `capacity`: Number (integer >= 1, default 1) - max concurrent segments.
     - `availability`: Array `{ dayOfWeek, open, close }` - khung giờ phục vụ tại chi nhánh.
     - `updatedBy`: ObjectId ref `User`.
     - Compound unique index: `{ branchId: 1, serviceId: 1 }`.
  2. Triển khai API ngữ cảnh Branch:
     - `GET /branches/:branchId/service-configs`:
       - Quyền: ADMIN (mọi branch), MANAGER (`branchId` trong `assignedBranchIds`), RECEPTIONIST (`branchId` trong `authorizedBranchIds`).
       - Query: `enabled`, `serviceType`, `limit`, `cursor`.
       - Trả về `BranchServiceConfigPage`.
     - `PUT /branches/:branchId/service-configs/:serviceId`:
       - Quyền: ADMIN hoặc MANAGER (`branchId` trong `assignedBranchIds`).
       - Body: `{ enabled, capacity, availability }`.
       - Cập nhật upsert cấu hình vận hành tại chi nhánh.
- **Xác minh**: Manager A thử sửa branch B -> 403 Forbidden; Manager A sửa branch A -> 200 OK.

---

### Task 4: Triển khai Slot Availability Engine (`GET /availability`)
- **Tệp tin**: `src/modules/booking/availability.service.js`, `src/modules/booking/booking.controller.js`, `src/modules/booking/booking.routes.js`
- **Nội dung**:
  1. Route: `GET /api/v1/availability?serviceIds=...&branchId=...&date=YYYY-MM-DD`
  2. Thuật toán tuân thủ BF10:
     - Bước 1: Validate Branch `status === 'ACTIVE'`, ngày `date` không thuộc `holidays`. Xác định `openingHours` của ngày đó.
     - Bước 2: Validate tất cả `serviceIds`: phải `ACTIVE`, cùng `serviceType`, `bookingMode === 'BOOKABLE'`. Tính tổng thời lượng chuỗi segment nối tiếp.
     - Bước 3: Lấy `BranchServiceConfig` tại `branchId`: tất cả service phải `enabled === true`. Khung giờ phải nằm trong `availability` của từng service (nếu có cấu hình).
     - Bước 4: Lấy danh sách `Shift` của nhân viên tại `branchId` có `status === 'ACTIVE'` và `staffSubRole == requiredStaffRole` của từng segment.
     - Bước 5: Lấy các `slot_reservations` và `appointments` hiện có (`CONFIRMED`, `PENDING_PAYMENT`, `PENDING_CONFIRMATION`).
     - Bước 6: Kiểm tra từng khung giờ (time unit mặc định 15 hoặc 30 phút):
       - Số segment trùng giờ của cùng serviceId < `BranchServiceConfig.capacity`.
       - Có ít nhất 1 staff trống có ca trực bao trọn segment.
     - Bước 7: Trả về `AvailabilityResponse` (`slots: [{ start, end, remaining, segments }]`).
- **Xác minh**: Test trường hợp nghỉ lễ, tắt service tại branch, kín capacity, thiếu nhân viên trực ca -> slot không khả dụng.

---

### Task 5: Đồng bộ OpenAPI Contract & Seed Data Mẫu
- **Tệp tin**: `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`, `src/seeds/serviceCatalogSeed.js`
- **Nội dung**:
  1. Cập nhật `07-openapi-v7.yaml`:
     - Khai báo thuộc tính tùy chọn `enabledBranchCount` trong schema `Service`.
     - Khai báo endpoint `GET /services/{id}/branches` cho tính năng shortcut.
  2. Bổ sung script seed mẫu các dịch vụ chuẩn từ `catalog.xlsx` (`MED01` - `MED07` và `GRM01` - `GRM08`) để phục vụ testing E2E và demo.

---

### Task 6: Kiểm thử Tự động & Hậu kiểm (Testing & Regression Verification)
- **Tệp tin**: `tests/service-branch.test.js`
- **Nội dung**:
  - Viết suite test bao phủ toàn bộ:
    1. RBAC: Admin vs Manager vs Receptionist vs Public.
    2. Guardrails: Phẫu thuật (`REQUEST_ONLY`), Cấp cứu (`CONTACT_ONLY`), Capacity >= 1, Manager branch isolation.
    3. Availability: Tính slot chuẩn xác theo opening hours, holidays, capacity và staff shifts.
  - Chạy `npm test` xác nhận 100% test cases (55 test cũ + test mới) đều PASS.
  - Chạy `npm run build` xác nhận build thành công.

---

## 3. Tiêu chí Hoàn thành (Definition of DONE)
- [ ] Service Catalog global và BranchServiceConfig phân định rõ ràng cả về dữ liệu và API context.
- [ ] Manager không thể sửa định nghĩa Service master; chỉ thao tác trong `assignedBranches[]`.
- [ ] BranchServiceConfig thuộc branch context (`/branches/:branchId/service-configs`), mang ngữ nghĩa `capacity = maxConcurrentSegments` cố định.
- [ ] `GET /availability` tính toán slot tự động chuẩn xác theo `BF10` (`openingHours`, `holidays`, `capacity`, `shifts`, `holds`).
- [ ] 100% khớp các quy định trong `catalog.xlsx` và `business_rule-flow.xlsx`.
- [ ] Bộ kiểm thử tự động xanh 100%, không phát sinh regression.
