# TÀI LIỆU BÀN GIAO FRONTEND: HỆ THỐNG BE FINAL UAT & BỔ SUNG (FLASH SALE, CONTENT STUDIO, MODERATION)

> **Ngày cập nhật:** 06/11/2026  
> **Phiên bản API:** `v7.0` (Canonical REST API & RFC 9457)  
> **Tài liệu đặc tả nguồn:**  
> 1. `WEB2_YEU_CAU_BE_FINAL_E2E_UAT_2026-11-05 (1).docx` (30 Requirement IDs: `AUTH-01..04`, `OPS-01..05`, `ORD-01..05`, `RET-01..03`, `APT-01..07`, `SR-01..05`, `DATA-01..03`, 8 Release Gates `RG-01..08`, 36 UAT Scenarios).  
> 2. `WEB2_BE_HANDOFF_FLASH_CONTENT_MODERATION_2026-11-06.docx` (35 Requirement IDs: `FS-01..08`, `CM-01..15`, `MOD-01..12`, 28 UAT Scenarios).

---

## 1. Tổng Quan Triển Khai Phía Backend (Đã Hoàn Tất 100%)

Phía Backend đã hoàn tất triển khai và vượt qua toàn bộ các bộ kiểm thử tích hợp (100% green tests):

1. **Phase 1 (Auth, RBAC & Ingress):**
   - Đã mount CRUD Quản trị User tại `/api/v1/admin/users`.
   - Lưu giữ cờ `rememberMe` (cookie 30 ngày cho `rememberMe: true`, session cookie khi `false`).
   - Trả đúng mã lỗi domain 403 (`ACCOUNT_BLOCKED`, `ACCOUNT_NOT_ACTIVATED`, `BRANCH_SCOPE_EMPTY`, `BRANCH_ACCESS_DENIED`).
   - Cho phép xóa email tùy chọn trên `PATCH /api/v1/auth/me` (`email: null` hoặc `""`).
   - Tự động đồng bộ và hoán chuyển linh hoạt giữa `User._id` và `StaffProfile._id`.

2. **Phase 2 (Vận Hành, Đơn Hàng, Đổi Trả & Kho):**
   - CRUD Ca làm việc mẫu theo chi nhánh (`/api/v1/branches/:branchId/shift-templates` và `/api/v1/shift-templates/:id`).
   - Xóa an toàn sản phẩm (`DELETE /api/v1/products/:id`) chặn xóa khi có tham chiếu lịch sử (`409 PRODUCT_IN_USE`).
   - Sửa hợp đồng chữ ký hàm tính giảm giá Voucher (linh hoạt nhận cả object lẫn tham số truyền).
   - Hợp đồng đổi trả 4 số lượng độc lập (`requestedQty`, `receivedQty`, `approvedQty`, `restockedQty`, `quality`).
   - Tra cứu khách hàng theo SĐT nhanh cho Lễ tân (`GET /api/v1/customers/lookup?phone=...`).
   - Mở quyền đọc lịch sử giao dịch kho (`GET /api/v1/inventory/transactions`) cho `VET`, `NURSE`, `GROOMER` theo hồ sơ phụ trách.

3. **Phase 3 (Lịch Hẹn Đa Pet & Khám Chữa Bệnh):**
   - Hỗ trợ lịch hẹn nhiều thú cưng (`petId` theo segment) và kết hợp `MEDICAL` + `GROOMING` (`serviceType: 'MIXED'`).
   - Check-in độc lập theo từng pet (`checkInStatus: 'ARRIVED'`).
   - Service Record compound unique index `{ appointmentId, petId, recordType, segmentGroupKey }`.
   - Phân quyền chuẩn: `NURSE` tạo nháp, `VET` duyệt y tế, `GROOMER` duyệt spa/grooming.
   - Chỉ chuyển Appointment sang `COMPLETED` khi **tất cả** Service Record đã `FINALIZED`.

4. **Phase 4 (Flash Sale Module & Authoritative Checkout):**
   - Model FlashSale, banner công khai `GET /api/v1/flash-sales/active` (tính sẵn `discountPercent`, `remainingQuantity`, `soldPercent`).
   - 5 trạng thái suy diễn động: `DRAFT`, `UPCOMING`, `RUNNING`, `PAUSED`, `ENDED`.
   - Kiểm tra trùng SKU trong chiến dịch và giao thoa thời gian (`409 FLASH_SALE_ITEM_OVERLAP`).
   - Áp giá server-side authoritative và trừ quota nguyên tử trong `checkoutCreateOrder`.

5. **Phase 5 (Content Studio, First Aid, Community & Đối Tác Cứu Trợ):**
   - Sanitizer HTML lọc mã độc phía server (`<script>`, `onerror`, `javascript:`).
   - Slug conflict trả đúng `409 SLUG_ALREADY_EXISTS`.
   - Cẩm nang sơ cứu: Hotline thật `0901234567`, 4 danh mục chuẩn (`tai-nan`, `ngo-doc`, `kho-tho`, `chan-thuong`), các bước có số thứ tự chuẩn.
   - Diễn đàn cộng đồng: 4 thẻ loại bài viết (`KHOANH_KHAC`, `HOI_DAP`, `MEO_VAT`, `KINH_NGHIEM`), bình luận lồng nhau (`POST /community/posts/:id/comments`), phản hồi (`POST /community/comments/:id/replies`), like/unlike.
   - Mạng lưới 6 trạm cứu hộ đối tác (`GET /api/v1/rescue/partners`).
   - Dedicated upload endpoints: `POST /api/v1/uploads/content`, `POST /api/v1/uploads/community`, `POST /api/v1/uploads/rescue`.

6. **Phase 6 (Kiểm Duyệt — Đánh Giá, Góp Ý & Báo Cáo Vi Phạm):**
   - Đánh giá (Review): làm giàu DTO (`targetName`, `sourceType`, `sourceCode`), ẩn/hiện (`PATCH /api/v1/reviews/:id/visibility` hoặc `/hide`, `/show` với conflict check 409), nhân viên phản hồi công khai (`POST /api/v1/reviews/:id/reply`).
   - Góp ý (Feedback): hỗ trợ `gender`, `sourceCode: 'CONTACT_FORM'`, trả `allowedActions`, gửi phản hồi qua email/outbox (`POST /api/v1/feedback/:id/reply`).
   - Báo cáo vi phạm: Khách gửi report (`POST /api/v1/community/posts/:id/reports`, chặn spam trùng 409), Quản trị viên xử lý (`GET /api/v1/admin/reports`, `PATCH /api/v1/admin/reports/:id/resolve` ẩn bài viết và đồng bộ các report trùng lặp).

---

## 2. Hướng Dẫn Chi Tiết Triển Khai Dành Cho Frontend (FE Checklist)

### 2.1. Quản Trị Người Dùng & Đăng Nhập (Admin Users & Auth)
- **API tương tác:**
  - `GET /api/v1/admin/users?role=&status=&search=&page=&limit=`
  - `POST /api/v1/admin/users` (Payload: `{ fullName, email, phone, systemRole, password, branchIds, primaryBranchId }`)
  - `GET /api/v1/admin/users/:id`
  - `PUT /api/v1/admin/users/:id`
  - `PATCH /api/v1/admin/users/:id/status` (Payload: `{ status: 'ACTIVE' | 'LOCKED', lockReason?: string }`)
  - `PATCH /api/v1/admin/users/:id/role` (Payload: `{ systemRole: string, branchIds?: string[] }`)
- **FE cần làm:**
  - Trên màn hình Đăng nhập: Khi người dùng tích checkbox "Ghi nhớ đăng nhập", gửi `rememberMe: true` trong payload login.
  - Xử lý mã lỗi 403 chuyên biệt: Hiển thị đúng thông báo "Tài khoản của bạn đã bị khóa: [lý do]" khi nhận `ACCOUNT_BLOCKED`, "Tài khoản chưa được kích hoạt" khi nhận `ACCOUNT_NOT_ACTIVATED`.
  - Trên trang Quản trị Users: Thêm modal tạo/sửa User, nút Khóa/Mở khóa tài khoản (có popup nhập lý do khóa), chọn Chi nhánh phụ trách cho nhóm nhân sự vận hành.

### 2.2. Quản Trị Ca Làm Việc Mẫu (Shift Templates)
- **API tương tác:**
  - `GET /api/v1/branches/:branchId/shift-templates`
  - `POST /api/v1/branches/:branchId/shift-templates` (Payload: `{ code, name, startTime: '08:00', endTime: '12:00', daysOfWeek: [1,2,3,4,5] }`)
  - `PATCH /api/v1/shift-templates/:id`
  - `DELETE /api/v1/shift-templates/:id`
- **FE cần làm:**
  - Thêm tab "Ca làm việc mẫu" trong trang Cấu hình chi nhánh / Lịch làm việc.
  - Cho phép quản lý ca sáng, ca chiều, ca tối, chọn các ngày trong tuần (2 đến Chủ nhật) để tự động sinh lịch trực tuần.

### 2.3. Quy Trình Trả Hàng 4 Số Lượng (Order Returns)
- **Hợp đồng dữ liệu `items[]`:**
  - `requestedQty`: Số lượng khách hàng đề nghị trả.
  - `receivedQty`: Số lượng kho thực nhận (Lễ tân/Kho kiểm đếm).
  - `approvedQty`: Số lượng Quản lý duyệt hoàn tiền.
  - `restockedQty`: Số lượng hàng đủ điều kiện nhập lại kho kinh doanh (`quality: 'RESELLABLE'`).
  - `damageReason`: Lý do hư hỏng nếu `quality: 'DAMAGED' | 'EXPIRED'`.
- **FE cần làm:**
  - Trên form tiếp nhận trả hàng của Kho/Lễ tân: Hiển thị 2 ô nhập: "Số lượng nhận thực tế" và "Đánh giá chất lượng" (`Nguyên vẹn` / `Hư hỏng` / `Hết hạn`).
  - Trên màn hình Quản lý duyệt: Hiển thị số lượng duyệt hoàn và số lượng nhập lại kho; chỉ nhân sự `MANAGER` hoặc `ADMIN` mới hiển thị các nút Duyệt (`approve`), Từ chối (`reject`), Hoàn tiền (`refund`).

### 2.4. Đặt Lịch Hẹn Đa Pet & Khám Chữa Bệnh (Appointments & Medical Records)
- **API tương tác:**
  - Tra cứu thú cưng của khách: `GET /api/v1/customers/:customerId/pets`
  - Báo giá lịch hẹn hộ (stateless): `POST /api/v1/admin/appointments/quote`
  - Tạo lịch hẹn hộ: `POST /api/v1/admin/appointments` (hỗ trợ nhiều pet, segment gắn `petId`, loại dịch vụ `MIXED`)
  - Check-in từng bé: `PATCH /api/v1/appointments/:id/segments/:segmentId/check-in`
- **FE cần làm:**
  - Trên form Đặt lịch tại quầy (Receptionist): Cho phép chọn nhiều bé thú cưng trong 1 lần đặt. Mỗi dịch vụ có thể gắn với 1 bé cụ thể (ví dụ: Bé Miu khám bệnh, Bé Vàng tắm spa).
  - Màn hình tiếp đón: Có nút "Đã đến" (Check-in) cho từng bé. Bác sĩ/Groomer chỉ bắt đầu thực hiện (`Start`) khi bé đã được check-in `ARRIVED`.
  - Màn hình Hồ sơ dịch vụ (`ServiceRecord`): Bảng "Vật tư tiêu hao thực tế" mặc định để trống (0 dòng), có nút "Lấy từ định mức dự kiến" hoặc thêm từng dòng vật tư phát sinh. Y tá chỉ có quyền lưu nháp; Bác sĩ chuyên môn duyệt `Finalize` cho ca y tế; Groomer duyệt `Finalize` cho ca spa.

### 2.5. Chiến Dịch Flash Sale (Flash Sale Module)
- **API tương tác:**
  - Trang chủ / Banner: `GET /api/v1/flash-sales/active`
    - Trả về: `{ sale: { code, name, endAt, remainingSeconds }, products: [{ id, productId, sku, productName, imageUrl, originalPrice, salePrice, remainingQuantity, soldPercent }] }`
  - Quản trị chiến dịch:
    - `GET /api/v1/flash-sales?status=&derivedStatus=&page=&limit=`
    - `POST /api/v1/flash-sales` (Payload: `{ name, code, startAt, endAt, items: [{ productId, variantId, sku, originalPrice, salePrice, quantityLimit }], publishNow?: boolean }`)
    - `PATCH /api/v1/flash-sales/:id`
    - `PATCH /api/v1/flash-sales/:id/pause` (Payload: `{ isPaused: boolean }`)
    - `POST /api/v1/flash-sales/:id/publish`
- **FE cần làm:**
  - Trang khách hàng (Web 1): Hiển thị block Flash Sale với đồng hồ đếm ngược (Countdown timer) đến `endAt`, thanh tiến độ "Đã bán X%" (`soldPercent`) và nhãn "Giảm X%".
  - Trang quản trị (Web 2): Bảng danh sách chiến dịch có bộ lọc theo 5 trạng thái (`Bản nháp`, `Sắp diễn ra`, `Đang chạy`, `Tạm dừng`, `Đã kết thúc`), nút Tạm dừng/Tiếp tục, nút Xuất bản ngay. Validate form client-side: `salePrice < originalPrice` và `startAt < endAt`.

### 2.6. Cẩm Nang Sơ Cứu & Diễn Đàn Cộng Đồng (First Aid & Community)
- **API tương tác:**
  - Danh mục sơ cứu: `GET /api/v1/first-aid/categories` (4 danh mục chuẩn: `tai-nan`, `ngo-doc`, `kho-tho`, `chan-thuong`).
  - Danh sách bài sơ cứu: `GET /api/v1/first-aid?category=tai-nan`
  - Đăng bài cộng đồng: `POST /api/v1/community/posts` (Payload: `{ title, content, type: 'KHOANH_KHAC' | 'HOI_DAP' | 'MEO_VAT' | 'KINH_NGHIEM', imageUrls: [] }`)
  - Bình luận bài viết:
    - Danh sách: `GET /api/v1/community/posts/:id/comments`
    - Thêm bình luận: `POST /api/v1/community/posts/:id/comments` (Payload: `{ content: string }`)
    - Phản hồi bình luận: `POST /api/v1/community/comments/:id/replies` (Payload: `{ content: string }`)
  - Thả tim: `POST /api/v1/community/posts/:id/like` và `/unlike`
  - Báo cáo vi phạm bài viết: `POST /api/v1/community/posts/:id/reports` (Payload: `{ reason: 'SPAM' | 'INAPPROPRIATE' | 'HARASSMENT' | 'MISINFORMATION' | 'OTHER', description?: string }`)
  - Đối tác cứu trợ: `GET /api/v1/rescue/partners` (6 trạm cứu hộ liên kết)
  - Upload ảnh: `POST /api/v1/uploads/content`, `POST /api/v1/uploads/community`, `POST /api/v1/uploads/rescue`
- **FE cần làm:**
  - Trang Sơ cứu thú cưng: Hiển thị 4 tab danh mục chuẩn, số Hotline gọi khẩn cấp `0901234567` (nhấp gọi trực tiếp `tel:0901234567`), các bước hướng dẫn định dạng thẻ bước (Step 1, Step 2, Step 3) kèm video hướng dẫn nếu có `videoUrl`.
  - Diễn đàn cộng đồng: Thêm bộ lọc bài viết theo 4 thẻ loại bài (`Khoảnh khắc`, `Hỏi đáp`, `Mẹo vặt`, `Kinh nghiệm`). Dưới mỗi bài viết hiển thị khung bình luận và các phản hồi lồng cấp (nested replies). Nút "Báo cáo bài viết vi phạm" mở modal chọn lý do báo cáo.
  - Trang Nhận nuôi thú cưng: Hiển thị huy hiệu trạm cứu hộ bảo trợ (`supportPartnerName`), thông tin nhu cầu hỗ trợ (`supportNeeds`).

### 2.7. Bảng Kiểm Duyệt Quản Trị (Moderation Dashboard)
- **API tương tác:**
  - Kiểm duyệt Đánh giá:
    - `GET /api/v1/reviews/admin?status=&targetType=&rating=&search=&page=&limit=`
    - Ẩn/Hiện đánh giá: `PATCH /api/v1/reviews/:id/visibility` (Payload: `{ isVisible: boolean, reason?: string }`)
    - Nhân viên phản hồi: `POST /api/v1/reviews/:id/reply` (Payload: `{ replyText: string }`)
  - Xử lý Góp ý (Feedback):
    - `GET /api/v1/feedback?status=&category=&page=&limit=`
    - Trả lời qua Email: `POST /api/v1/feedback/:id/reply` (Payload: `{ subject?: string, message: string }`)
    - Chuyển trạng thái: `PATCH /api/v1/feedback/:id/status` (Payload: `{ status: string, notes?: string }`)
  - Hàng đợi Báo cáo vi phạm (Reports):
    - Danh sách: `GET /api/v1/admin/reports?status=PENDING`
    - Chi tiết: `GET /api/v1/admin/reports/:id`
    - Xử lý: `PATCH /api/v1/admin/reports/:id/resolve` (Payload: `{ decision: 'HIDE_POST' | 'NO_VIOLATION', moderationNote?: string }`)
- **FE cần làm:**
  - Trang Quản lý Đánh giá: Hiển thị tên sản phẩm / dịch vụ (`targetName`), mã đơn hàng / lịch hẹn (`sourceCode`), nút "Ẩn đánh giá" (bắt buộc nhập lý do), nút "Phản hồi khách hàng".
  - Trang Quản lý Góp ý: Hiển thị nhãn trạng thái và các hành động khả dụng từ mảng `allowedActions` (`MARK_READ`, `START_PROCESSING`, `REPLY`, `RESOLVE`, `REJECT`). Có modal gửi email phản hồi trực tiếp cho khách hàng.
  - Trang Hàng đợi Báo cáo Vi phạm: Xem bài viết bị tố cáo, thông tin người báo cáo, nút "Ẩn bài viết vi phạm" (tự động đổi bài viết sang HIDDEN và đóng tất cả báo cáo liên quan) hoặc "Không vi phạm" (bỏ qua).

---

## 3. Danh Sách Mã Lỗi Phổ Biến Cần Bắt Tại Client

| HTTP Code | Error Code Domain | Ý nghĩa / Hướng xử lý tại giao diện |
| :--- | :--- | :--- |
| `403` | `ACCOUNT_BLOCKED` | Thông báo tài khoản bị khóa và hiển thị lý do khóa. |
| `403` | `ACCOUNT_NOT_ACTIVATED` | Thông báo tài khoản chưa kích hoạt, hướng dẫn kiểm tra email. |
| `403` | `BRANCH_SCOPE_EMPTY` | Thông báo nhân sự chưa được phân quyền vào bất kỳ chi nhánh nào. |
| `409` | `SLUG_ALREADY_EXISTS` | Báo lỗi đường dẫn bài viết bị trùng trên form bài viết. |
| `409` | `FLASH_SALE_ITEM_OVERLAP` | Báo lỗi sản phẩm đã tham gia khung giờ flash sale khác. |
| `409` | `REPORT_ALREADY_SUBMITTED`| Báo thông báo: "Bạn đã gửi báo cáo cho bài viết này rồi". |
| `409` | `REVIEW_ALREADY_HIDDEN` | Đánh giá đã bị ẩn trước đó bởi quản trị viên khác. |
| `409` | `MODERATION_ACTION_REQUIRED`| Không thể xóa cứng bài viết đang chờ duyệt, buộc duyệt hoặc từ chối trước. |
| `422` | `INSUFFICIENT_INVENTORY` | Không có chi nhánh đơn lẻ nào đủ toàn bộ giỏ hàng (chống chia tách đơn). |
| `422` | `RETURN_WINDOW_EXPIRED` | Đã quá thời hạn 7 ngày kể từ khi nhận hàng để gửi yêu cầu đổi trả. |

