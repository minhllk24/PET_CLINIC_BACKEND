# Kế hoạch Triển khai: Bổ sung API "Khả dụng" & Hoàn thiện Service Catalog cho Frontend

## 1. Bối cảnh & Mục tiêu (Context & Objective)
Frontend Angular (`https://www.drpetshouse.lat/admin/services`) đã dựng xong giao diện quản trị Danh mục dịch vụ (Service Catalog) nhưng một số trường dữ liệu đang hiển thị placeholder (ví dụ: cột **"Khả dụng"** đang hiển thị badge *"Chờ BE"*).
Mục tiêu của task là hoàn thiện các trường dữ liệu và API filter để FE kết nối trơn tru:
1. Bổ sung trường **`code`** (`Mã dịch vụ`, e.g. `GRM01`, `MED01`) vào response chi tiết và danh sách Service.
2. Hỗ trợ tìm kiếm theo cả mã dịch vụ `code` trong ô tìm kiếm ("Tên hoặc mã dịch vụ...").
3. Bổ sung **`totalBranchCount`** bên cạnh `enabledBranchCount` để FE dễ dàng render hiển thị tỉ lệ chi nhánh (ví dụ: `2/3 bật`, `1/3 bật`).
4. Bổ sung thông tin tính toán cột **"Khả dụng"**:
   - `isAvailable`: boolean (`true` / `false`)
   - `availabilityStatus`: enum (`AVAILABLE`, `UNAVAILABLE`, `INACTIVE`, `BRANCH_DISABLED`)
   - `availabilityText`: text tiếng Việt trực quan (`"Khả dụng"`, `"Không khả dụng"`, `"Tạm ngưng"`, `"Tắt tại chi nhánh"`)
5. Bổ sung tham số lọc `branchId` trong `GET /api/v1/services` để khi admin chọn dropdown *"Tất cả chi nhánh"*, Backend tự tính toán trạng thái khả dụng tương ứng của dịch vụ tại chi nhánh đó.
6. Cập nhật seed data chuẩn hóa đủ 3 chi nhánh và 12 dịch vụ mẫu theo đúng màn hình thực tế của Frontend.

---

## 2. Thiết kế Kỹ thuật (Technical Design)

### A. Định dạng Response mở rộng của Service (`formatServiceResponse`)
```json
{
  "id": "670da1...",
  "code": "GRM01",
  "name": "Tắm & Sấy khô",
  "serviceType": "GROOMING",
  "category": "Vệ sinh cơ bản",
  "description": "Tắm sạch bằng dầu tắm chuyên dụng và sấy chải bông lông",
  "basePrice": 100000,
  "durationMinutes": 60,
  "requiredStaffRole": "CARE_STAFF_GROOMER",
  "bookingMode": "BOOKABLE",
  "status": "ACTIVE",
  "enabledBranchCount": 2,
  "totalBranchCount": 3,
  "isAvailable": true,
  "availabilityStatus": "AVAILABLE",
  "availabilityText": "Khả dụng",
  "branchConfig": {
    "enabled": true,
    "capacity": 2
  }
}
```

### B. Logic Tính Toán Cột "Khả dụng"
1. **Trong ngữ cảnh Toàn hệ thống (Không truyền `branchId`):**
   - Nếu `service.status === 'INACTIVE'`:
     - `isAvailable = false`, `availabilityStatus = 'INACTIVE'`, `availabilityText = 'Tạm ngưng'`
   - Nếu `service.status === 'ACTIVE'`:
     - Nếu `enabledBranchCount > 0`: `isAvailable = true`, `availabilityStatus = 'AVAILABLE'`, `availabilityText = 'Khả dụng'`
     - Nếu `enabledBranchCount === 0`: `isAvailable = false`, `availabilityStatus = 'UNAVAILABLE'`, `availabilityText = 'Chưa có CN bật'`

2. **Trong ngữ cảnh Lọc theo Chi nhánh (Có truyền `branchId`):**
   - Lấy cấu hình `BranchServiceConfig` tương ứng với `{ branchId, serviceId }`.
   - Nếu `service.status === 'ACTIVE'` VÀ `config?.enabled === true`:
     - `isAvailable = true`, `availabilityStatus = 'AVAILABLE'`, `availabilityText = 'Khả dụng'`, `branchConfig = { enabled: true, capacity: config.capacity }`
   - Nếu `service.status === 'ACTIVE'` NHƯNG `config?.enabled === false` (hoặc chưa cấu hình):
     - `isAvailable = false`, `availabilityStatus = 'BRANCH_DISABLED'`, `availabilityText = 'Tắt tại chi nhánh'`, `branchConfig = { enabled: false, capacity: config?.capacity || 1 }`
   - Nếu `service.status === 'INACTIVE'`:
     - `isAvailable = false`, `availabilityStatus = 'INACTIVE'`, `availabilityText = 'Dịch vụ tạm ngưng'`

### C. Mở Rộng API `GET /api/v1/services`
- Thêm query param `branchId` (ObjectId string) để lọc / tính toán theo chi nhánh.
- Thêm query param `isAvailable` (boolean `true`/`false`) để lọc dịch vụ theo tính khả dụng.
- Thêm `code` vào bộ lọc tìm kiếm regex `$or: [{ name: ... }, { code: ... }, { description: ... }]`.

---

## 3. Danh sách Tệp tin Cần Chỉnh sửa & Bổ sung
1. `docs/PLAN-service-availability-api.md`: Tài liệu lưu vết kế hoạch chi tiết.
2. `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` & `docs/07-openapi-v6.yaml`:
   - Bổ sung `code`, `totalBranchCount`, `isAvailable`, `availabilityStatus`, `availabilityText`, `branchConfig` vào schema `Service`.
   - Bổ sung query parameters `branchId`, `isAvailable` vào endpoint `GET /services`.
3. `src/modules/catalog/serviceCatalog.service.js`:
   - Cập nhật `formatServiceResponse`, `listServices`, `getServiceById`.
4. `src/seeds/serviceCatalogSeed.js`:
   - Bổ sung chi nhánh thứ 3 (`BR-000003` - Chi nhánh Bình Thạnh).
   - Seed đầy đủ 12 dịch vụ mẫu và cấu hình `BranchServiceConfig` khớp với demo tỉ lệ `2/3 bật`, `1/3 bật`, `0/3 bật`.
5. `tests/service-branch.test.js`:
   - Viết test suites kiểm tra `isAvailable`, `availabilityStatus`, `totalBranchCount`, `branchId` filter.

---

## 4. Kế hoạch Kiểm thử & Xác minh (Verification Plan)
- Chạy `npm test` đảm bảo 100% test cases (cũ + mới) đạt PASS.
- Chạy `npm run build` đảm bảo không có lỗi cú pháp.
- Seed dữ liệu vào cơ sở dữ liệu và gọi API `GET /api/v1/services` kiểm tra thực tế.
- Git commit và push lên remote `feat/foundation-v6`.
