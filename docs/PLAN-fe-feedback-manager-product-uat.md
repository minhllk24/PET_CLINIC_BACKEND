# KẾ HOẠCH CHI TIẾT XỬ LÝ FEEDBACK FRONTEND (ĐỢT 2)
## Quản Lý Nhiều Chi Nhánh, Fail-Closed Live Sync, Hồ Sơ Dịch Vụ Thật, Biến Thể Sản Phẩm (Angular) & Bàn Giao UAT

> **Ngày lập:** 06/11/2026  
> **Trạng thái:** PLANNING (Chờ phê duyệt thực thi)  
> **Nhánh mục tiêu:** `feat/foundation-v6`

---

## 1. Mục Tiêu (Goal)

Giải quyết triệt để **5 nhóm phản hồi kỹ thuật từ team Frontend WEB 2 (Angular)**, bao gồm:
1. Chuẩn hóa validate nghiêm ngặt `assignedBranchIds`, CSPRNG password, đồng bộ cấu trúc phân trang & sửa phân trang hợp nhất Nhân sự + Quản lý.
2. Chuyển cơ chế **Dynamic Live Sync** sang **Fail-Closed** (tuyệt đối không fallback về quyền chi nhánh cũ trong JWT khi DB lỗi).
3. Chạy kiểm thử trên **dữ liệu thật MongoDB Atlas** cho `ServiceRecord` (List & Detail) với đầy đủ liên kết `Pet`, `Service`, `Staff`, `Branch`, `Customer`.
4. Cung cấp payload thực tế của sản phẩm (5–10 ảnh + nhiều biến thể SKU + giỏ hàng) và cập nhật tài liệu hướng dẫn sang **Angular (TypeScript + HTML Template)**.
5. Cung cấp bảng thông tin môi trường chuẩn (Branch, Commit SHA, Base URL, Database, OpenAPI) kèm bằng chứng PASS UAT cho từng hạng mục.

---

## 2. Phân Tích Phương Án Kiến Trúc (Brainstorming)

### Vấn đề A: Phân trang hợp nhất Nhân sự (`StaffProfile`) và Quản lý (`User: MANAGER`) tại `GET /api/v1/staff`

* **Option A (In-Memory Merge & Sort trên Stream ID/Timestamp):**
  - Truy vấn song song `StaffProfile` và `User (systemRole: 'MANAGER')` với cùng bộ lọc (`branchId`, `search`, `status`, `cursor`).
  - Chuẩn hóa cả 2 danh sách về cùng DTO, gộp và sắp xếp theo `createdAt` / `_id` giảm dần (`-1`), sau đó cắt lát (`slice`) chính xác theo `page` + `limit` hoặc `cursor`.
  - ✅ **Ưu điểm:** Không phụ thuộc cấu trúc collection vật lý, hỗ trợ cả mock test lẫn MongoDB thật, tính toán chính xác `totalCount = staffTotal + managerTotal`, `totalPages`, và `nextCursor` mà không bỏ sót hay trùng lặp Quản lý ở các trang sau.
  - ❌ **Nhược điểm:** Với phân trang theo `page` sâu cần lấy `(page * limit)` bản ghi từ mỗi bên trước khi cắt lát.

* **Option B (MongoDB `$unionWith` Aggregation Pipeline):**
  - Sử dụng `StaffProfile.aggregate([{ $unionWith: { coll: 'users', pipeline: [...] } }])`.
  - ✅ **Ưu điểm:** Gộp trực tiếp ở tầng Database.
  - ❌ **Nhược điểm:** Phức tạp khi populate `userId` của `StaffProfile` và không tương thích tốt với các unit test dùng Jest mock.

* 💡 **Khuyến nghị:** Chọn **Option A** (kết hợp cursor `_id < cursor` cho cả 2 bảng và offset slice chuẩn xác) để vừa đảm bảo phân trang chính xác tuyệt đối khi số lượng lớn, vừa giữ 100% khả năng tương thích với hệ thống test hiện hữu.

---

### Vấn đề B: Quyền xem chi tiết Quản lý (`GET /api/v1/managers/:id`) đối với vai trò `MANAGER`

* **Option 1 (Strict Self-Scope / Scoped Branch Visibility - Khuyên dùng):**
  - `ADMIN`: Xem toàn bộ thông tin của mọi Manager.
  - `MANAGER`:
    - Chỉ được xem hồ sơ của chính mình (`actor.id === manager.id`) **HOẶC** đồng nghiệp Manager có giao thoa chi nhánh phụ trách, **NHƯNG** danh sách `assignedBranchIds` và `assignedBranches` trả về sẽ được lọc (mask) chỉ hiển thị những chi nhánh nằm trong `actor.assignedBranchIds` của người gọi (không lộ các chi nhánh ngoài phạm vi quản lý).
    - Nếu không có chi nhánh nào giao thoa → Trả `403 AUTHORIZATION_ERROR`.
* **Option 2 (Self-Only cho Manager):**
  - `MANAGER` chỉ được xem duy nhất hồ sơ của chính mình (`actor.id === manager.id`), xem Manager khác bị chặn `403`.

---

## 3. Danh Sách Công Việc Chi Tiết (Tasks)

### Phase 1: Nâng cấp API Quản lý nhiều chi nhánh (`manager.service.js`, `staff.service.js`)
- [ ] **Task 1.1 (Validate nghiêm ngặt `assignedBranchIds`):**
  - Viết hàm `validateActiveBranches(rawBranches)` dùng chung cho `createManager`, `updateManager`, `updateManagerBranches`.
  - Kiểm tra mảng không rỗng; **mọi phần tử** phải là ObjectId hợp lệ (nếu có bất kỳ phần tử nào sai định dạng như `"invalid-id"`, lập tức ném lỗi `400 VALIDATION_ERROR`, tuyệt đối không tự lọc bỏ).
  - Loại bỏ trùng lặp (deduplicate) nhưng nếu truyền trùng hoặc thiếu chi nhánh thật trong DB thì kiểm tra: Truy vấn `Branch.find({ _id: { $in: uniqueIds }, isActive: { $ne: false }, status: { $nin: ['INACTIVE', 'CLOSED'] } })`. Nếu số lượng branch hợp lệ tìm thấy `< uniqueIds.length` → Ném lỗi `400 VALIDATION_ERROR` ("One or more assignedBranchIds do not exist or are inactive").
- [ ] **Task 1.2 (Sinh mật khẩu & mã bằng CSPRNG `crypto`):**
  - Sử dụng `crypto.randomInt` từ module `node:crypto` thay thế hoàn toàn `Math.random()` khi sinh mật khẩu tự động (16 ký tự đủ chữ hoa, chữ thường, chữ số, ký tự đặc biệt) trong cả `createManager` và `resetManagerPassword` (khi không truyền `newPassword`).
- [ ] **Task 1.3 (Đồng bộ cấu trúc Response & Phân trang):**
  - Chuẩn hóa phản hồi của `listManagers` và `listStaff` bao gồm đầy đủ: `items`, `totalCount`, `total`, `page`, `limit`, `totalPages`, `nextCursor`, kèm `success: true` và `data` (chứa `{ items, totalCount, total, page, limit, totalPages, nextCursor }`) hoặc top-level tương thích kép để FE đọc theo `res.items` hay `res.data.items` đều hoạt động 100%.
- [ ] **Task 1.4 (Sửa phân trang hợp nhất Nhân sự + Quản lý tại `GET /api/v1/staff`):**
  - Hỗ trợ cả `cursor` lẫn `page`/`limit` khi hợp nhất `StaffProfile` và `User(MANAGER)`.
  - Áp dụng bộ lọc `_id < cursor` cho cả hai truy vấn, gộp và sắp xếp theo `_id` giảm dần, cắt đúng `parsedLimit` phần tử cho trang hiện tại và tính `nextCursor` từ phần tử cuối cùng của trang gộp.
- [ ] **Task 1.5 (Siết quyền xem chi tiết Quản lý `getManagerById`):**
  - Kiểm tra nếu `actor.systemRole === 'MANAGER'`: bắt buộc `actor.assignedBranchIds` không rỗng; chỉ cho phép xem khi có chi nhánh nằm trong phạm vi quản lý và lọc `assignedBranchIds`/`assignedBranches` chỉ trả về các chi nhánh thuộc phạm vi của `actor`.

---

### Phase 2: Dynamic Live Sync — Fail-Closed Khi Lỗi DB (`authMiddleware.js`, `app.js`)
- [ ] **Task 2.1 (Fail-Closed trong `src/shared/authMiddleware.js` & `src/app.js`):**
  - Không khởi tạo trước `assignedBranchIds` từ JWT cho `MANAGER`/`STAFF` trước khi đồng bộ DB.
  - Khi thực hiện truy vấn `User.findById(decoded.id)`:
    - Nếu không tìm thấy user (`!liveUser`) → Chặn ngay với `401 AUTHENTICATION_ERROR`.
    - Nếu tài khoản bị khóa/chưa kích hoạt → Chặn ngay với `403 ACCOUNT_BLOCKED` / `ACCOUNT_NOT_ACTIVATED`.
    - Nếu truy vấn DB ném lỗi (catch error) hoặc DB mất kết nối khi đang ở môi trường chạy thật → **Tuyệt đối không fallback về `decoded.assignedBranchIds` trong JWT**. Thay vào đó, gán `req.actor.assignedBranchIds = []` và trả lỗi `503 SERVICE_UNAVAILABLE` (`DATABASE_SYNC_ERROR`) trong `authenticate` (hoặc `return false` trong `bearerAuth`).
- [ ] **Task 2.2 (Bổ sung Unit & Integration Tests cho Fail-Closed):**
  - Trong `tests/integration/multi-branch-manager.test.js`:
    - Test 1: Admin thu hồi chi nhánh B2 của Manager → Request kế tiếp của Manager (dùng nguyên JWT cũ) vào B2 bị chặn `403` ngay lập tức.
    - Test 2: Giả lập `User.findById` bị lỗi DB (`mockRejectedValue(new Error('DB connection lost'))`) → Request của Manager với JWT cũ có chứa B1, B2 lập tức bị từ chối (`503` / `401`), chứng minh không dùng quyền cũ trong JWT.

---

### Phase 3: Xác Thực & Trích Xuất Bằng Chứng Thật Từ MongoDB Atlas (Service Records & Products)
- [ ] **Task 3.1 (Hồ sơ dịch vụ - Service Records trên DB thật):**
  - Chạy script kiểm tra & đồng bộ dữ liệu trên MongoDB Atlas để đảm bảo toàn bộ `ServiceRecord` có liên kết khóa ngoại thật tới `Pet`, `Service`, `StaffProfile`, `Branch`, `Customer`.
  - Thực hiện gọi thật `GET /api/v1/service-records` (list) và `GET /api/v1/service-records/:id` (detail) trên DB deploy, lưu toàn bộ JSON response thật vào tài liệu bàn giao.
- [ ] **Task 3.2 (Sản phẩm 5–10 ảnh, nhiều biến thể & Giỏ hàng trên DB thật):**
  - Thực hiện gọi thật `GET /api/v1/products/:id` trên DB deploy cho sản phẩm có 5–10 ảnh và nhiều biến thể (`sku`, `label`, `price`, `finalPrice`, `availableStock`, `images`).
  - Thực hiện gọi thật `POST /api/v1/cart/items` với từng `sku` biến thể khác nhau để xác nhận `unitPrice`, `availableStock`, `imageUrl`, `variantLabel` trong giỏ hàng chính xác 100%.

---

### Phase 4: Cập Nhật Tài Liệu Handoff Cho Angular & Bàn Giao Môi Trường
- [ ] **Task 4.1 (Cập nhật `docs/FE-HANDOFF-PRODUCT-IMAGES-AND-VARIANTS.md` sang Angular):**
  - Thay thế toàn bộ code mẫu React (`ProductDetailsPage.jsx`) bằng **Angular TypeScript Models, Service mapper và Angular Component/Template (`@for` / `*ngFor`, `[ngClass]`, `(click)="selectVariant(v)"`)** khớp với repo `DR_PETS_HOUSE_ANGULAR`.
  - Đính kèm JSON response thực tế từ DB cho Product Detail và Cart Item.
- [ ] **Task 4.2 (Cập nhật `docs/FE-HANDOFF-MULTI-BRANCH-MANAGER.md`):**
  - Đồng bộ cấu trúc response thực tế (`items`, `totalCount`, `total`, `page`, `limit`, `totalPages`, `nextCursor`).
  - Đính kèm JSON response thực tế từ DB cho `GET /api/v1/service-records` và `GET /api/v1/service-records/:id`.
  - Bổ sung mục **5. Thông Tin Bàn Giao Môi Trường (Release Gate Evidence)**: Branch, Commit SHA, API Base URL, Database, OpenAPI spec và bảng kết quả PASS UAT cho cả 5 mục.

---

## 4. Tiêu Chí Hoàn Thành (Definition of Done)
- [ ] 100% test suites (`npx jest --maxWorkers=2`) PASS, bao gồm các test mới cho validate `assignedBranchIds`, CSPRNG password, phân trang hợp nhất và Fail-Closed DB error.
- [ ] Có đầy đủ bằng chứng JSON thực tế trích xuất từ MongoDB Atlas cho Service Records, Products (5–10 ảnh + biến thể), Cart SKU và Managers.
- [ ] Hai tài liệu `docs/FE-HANDOFF-MULTI-BRANCH-MANAGER.md` và `docs/FE-HANDOFF-PRODUCT-IMAGES-AND-VARIANTS.md` được cập nhật chuẩn Angular và commit + push lên `feat/foundation-v6`.

