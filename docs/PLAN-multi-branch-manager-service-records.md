# PLAN: Multi-Branch Manager APIs & Service Record Data Enrichment

## 1. Overview
Giải quyết phản hồi mới nhất từ đội Frontend gồm 2 hạng mục trọng tâm:
1. **Quản lý Đa Chi Nhánh (Multi-Branch Manager Module):** Cung cấp đầy đủ API tạo mới, lấy danh sách, xem chi tiết, cập nhật thông tin & danh sách chi nhánh phụ trách (`assignedBranchIds`), hiển thị chung trong danh sách Nhân sự Admin, kèm cơ chế đồng bộ phạm vi quyền (`assignedBranchIds`) tức thời cho `MANAGER` mà không cần phân ca hay `homeBranchId`.
2. **Làm giàu dữ liệu Hồ sơ Dịch vụ (`ServiceRecord` Data Enrichment & UAT Seed):** Khắc phục triệt để tình trạng hiển thị mã ObjectId thô (`6ae5e54bae...`) ở cột **Thú cưng**, **Dịch vụ** và dấu gạch ngang `—` ở cột **Nhân viên chính** trên trang `/admin/service-records`.

- **Project Type:** `BACKEND` (Node.js / Express / Mongoose / OpenAPI v7)

---

## 2. Brainstorm Options (Kiến trúc API Quản lý Đa Chi Nhánh)

### Option A: Chỉ mở rộng `/api/v1/staff` để nhận `systemRole = MANAGER`
- **Pros:** FE tái sử dụng 100% endpoint `/api/v1/staff` sẵn có.
- **Cons:** Schema OpenAPI v7 của `/staff` đang ràng buộc chặt `StaffCreate` (`staffSubRole` bắt buộc thuộc 4 role nhân viên), dễ gây nhầm lẫn ngữ nghĩa giữa Nhân viên vận hành (cần phân ca, có `homeBranchId`) và Quản lý chi nhánh.
- **Effort:** Low.

### Option B: Chỉ tách riêng cụm endpoint `/api/v1/managers`
- **Pros:** Rõ ràng về mặt domain model (`User` với `systemRole = MANAGER`, `assignedBranchIds`, không tạo `StaffProfile` ảo).
- **Cons:** Trang "Vận hành → Nhân sự" bên FE đang gọi `GET /api/v1/staff` sẽ phải gọi 2 API rồi tự gộp (merge) ở client.
- **Effort:** Medium.

### Option C (Recommended - Hybrid): Cung cấp cụm `/api/v1/managers` chuẩn OpenAPI v7 KẾT HỢP hỗ trợ hiển thị & điều phối đa năng tại `/api/v1/staff`
- **Pros:**
  - Có đầy đủ bộ API chuyên biệt `/api/v1/managers` (`POST /managers`, `GET /managers`, `GET /managers/:id`, `PATCH /managers/:id`, `PUT /managers/:id/assigned-branches`, `POST /managers/:id/reset-password`).
  - Đồng thời hỗ trợ tạo/cập nhật/hiển thị `MANAGER` ngay trong `/api/v1/staff` (khi FE gọi `GET /api/v1/staff` sẽ thấy cả Quản lý và Nhân viên kèm tên chi nhánh đầy đủ; nếu FE gửi `POST /api/v1/staff` với `systemRole: 'MANAGER'` hoặc `staffSubRole: 'MANAGER'` hệ thống tự động điều hướng sang logic tạo Quản lý).
  - Không phá vỡ bất kỳ test hay luồng phân ca hiện hữu nào.
- **Cons:** Cần viết thêm lớp adapter đồng bộ DTO giữa `User (MANAGER)` và `StaffProfile`.
- **Effort:** Medium.

---

## 3. Success Criteria
- [ ] `ADMIN` tạo thành công tài khoản `MANAGER` phụ trách 1 hoặc nhiều chi nhánh (`assignedBranchIds`), không bắt buộc `homeBranchId`, tự sinh `username` (`mgr_...`) + mật khẩu mạnh và trả về `credentials` (hoặc nhận `password` tùy chọn).
- [ ] Tài khoản `MANAGER` đăng nhập thành công với `systemRole: 'MANAGER'` và `assignedBranchIds` đầy đủ.
- [ ] Khi `ADMIN` thêm/xóa chi nhánh của `MANAGER`, quyền truy cập của `MANAGER` được cập nhật tức thời ở ngay request kế tiếp (nhờ cơ chế đồng bộ `assignedBranchIds` từ DB trong middleware xác thực).
- [ ] `MANAGER` bị chặn (`403 Forbidden`) khi truy cập dữ liệu chi nhánh ngoài `assignedBranchIds`, và không thể tự tạo/cập nhật/cấp quyền cho `MANAGER` khác.
- [ ] Danh sách Nhân sự (`GET /api/v1/staff` và `GET /api/v1/managers`) hiển thị đầy đủ thông tin Quản lý cùng mảng `assignedBranches: [{ id, name, code }]`.
- [ ] API `GET /api/v1/service-records` và `GET /api/v1/service-records/:id` trả về đầy đủ tên thú cưng (`petName`, `pet`), tên dịch vụ (`serviceName`, `serviceNames`, `services`), tên chi nhánh (`branchName`, `branch`), nhân viên chính (`staffName`, `primaryStaffName`, `assignedStaff`), bác sĩ duyệt (`reviewerName`, `reviewerStaff`) và tên vật tư (`inventoryItemName`).
- [ ] Dữ liệu seed UAT cho `ServiceRecord` đa dạng, đẹp mắt, có đủ tên thú cưng, dịch vụ, nhân viên chính ở cả 3 chi nhánh.

---

## 4. File Structure & Impact Map

| File | Action | Purpose |
|------|--------|---------|
| `src/modules/staff/manager.service.js` | **NEW** | Logic CRUD Quản lý đa chi nhánh (`createManager`, `listManagers`, `getManagerById`, `updateManager`, `updateManagerBranches`, `resetManagerPassword`) |
| `src/modules/staff/manager.controller.js` | **NEW** | Controller xử lý các request `/api/v1/managers` |
| `src/modules/staff/manager.routes.js` | **NEW** | Định tuyến `/api/v1/managers` (chỉ `ADMIN` cho các thao tác ghi) |
| `src/modules/staff/staff.service.js` | **MODIFY** | Hỗ trợ hiển thị `MANAGER` trong `listStaff`, `getStaffById`, điều hướng `createStaff`/`updateStaff`/`updateStaffBranches` khi đối tượng là `MANAGER`, làm giàu `assignedBranches` |
| `src/shared/authMiddleware.js` & `src/app.js` | **MODIFY** | Đồng bộ động `assignedBranchIds` & `accountStatus` từ DB cho `MANAGER`/`STAFF` khi DB đang kết nối; cấu hình OpenAPI bypass/rewrite cho `/managers` và `/staff` |
| `src/modules/execution/execution.service.js` | **MODIFY** | Populate & làm giàu DTO `formatServiceRecord` với `pet`, `petName`, `customer`, `customerName`, `services`, `serviceName`, `branch`, `branchName`, `assignedStaff`, `primaryStaff`, `staffName`, `reviewerStaff`, `reviewerName`, tên vật tư |
| `src/seeds/productionUatSeed.js` | **MODIFY** | Bổ sung dữ liệu seed `ServiceRecord` và `MANAGER` đa chi nhánh đẹp, chuẩn thực tế |
| `tests/integration/multi-branch-manager.test.js` | **NEW** | Bộ kiểm thử E2E cho toàn bộ yêu cầu Quản lý đa chi nhánh & làm giàu ServiceRecord |
| `docs/FE-HANDOFF-MULTI-BRANCH-MANAGER.md` | **NEW** | Tài liệu API, payload mẫu và hướng dẫn test E2E gửi cho đội FE |

---

## 5. Task Breakdown

| ID | Task | Agent | Skills | Priority | Dependencies | INPUT → OUTPUT → VERIFY |
|----|------|-------|--------|----------|--------------|-------------------------|
| **T1** | Tạo `manager.service.js`, `manager.controller.js`, `manager.routes.js` và mount `/api/v1/managers` | `backend-specialist` | `api-patterns`, `clean-code` | P0 | None | Input: Payload tạo/sửa Manager → Output: Endpoints `/api/v1/managers/*` hoạt động → Verify: Supertest 201/200/403 |
| **T2** | Mở rộng `staff.service.js` hỗ trợ hợp nhất hiển thị & thao tác `MANAGER` trên `/api/v1/staff` | `backend-specialist` | `api-patterns` | P0 | T1 | Input: `GET /api/v1/staff` & `POST /api/v1/staff` → Output: Trả về cả Manager & Staff kèm `assignedBranches` → Verify: Jest test pass |
| **T3** | Đồng bộ tức thời `assignedBranchIds` trong `authMiddleware.js` và `app.js` | `security-auditor` | `clean-code` | P0 | T1 | Input: Admin đổi `assignedBranchIds` của Manager đang giữ token cũ → Output: Request tiếp theo áp dụng ngay danh sách chi nhánh mới → Verify: Test 403/200 tức thời |
| **T4** | Làm giàu dữ liệu `ServiceRecord` trong `execution.service.js` và `productionUatSeed.js` | `backend-specialist` | `database-design` | P1 | None | Input: `GET /api/v1/service-records` → Output: Có đủ `petName`, `serviceName`, `staffName`, `branchName`, `services[]`, `pet`, `primaryStaff` → Verify: Không còn ObjectId thô |
| **T5** | Viết bộ kiểm thử tích hợp `tests/integration/multi-branch-manager.test.js` & tài liệu bàn giao FE | `test-engineer` | `testing-patterns`, `documentation-templates` | P1 | T1, T2, T3, T4 | Input: 6 kịch bản test của FE → Output: 100% test pass + file `docs/FE-HANDOFF-MULTI-BRANCH-MANAGER.md` → Verify: `npx jest` |

---

## 6. Phase X: Verification Checklist
- [ ] Tất cả 6 kịch bản kiểm thử Quản lý đa chi nhánh của FE đều PASS.
- [ ] `GET /api/v1/service-records` trả về đầy đủ tên thú cưng, tên dịch vụ, nhân viên chính, chi nhánh.
- [ ] Toàn bộ 31 test suites trong dự án đạt 100% green.
- [ ] Xuất bản tài liệu `docs/FE-HANDOFF-MULTI-BRANCH-MANAGER.md` kèm payload mẫu và tài khoản test.

