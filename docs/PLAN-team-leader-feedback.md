# Kế hoạch Xử lý Feedback Nhóm Trưởng (NT_FEEDBACK.pdf)

> **Tài liệu nguồn:** `docs/NT_FEEDBACK.pdf` (5 trang phản hồi kiểm thử Web ngày 15/10)  
> **Phạm vi:** Phân loại toàn bộ các mục phản hồi, xác định các lỗi và yêu cầu thuộc Backend, lập kế hoạch chi tiết khắc phục và hướng dẫn phối hợp với Frontend.

---

## 1. Bảng Phân Loại Toàn Bộ 12 Phản Hồi Trong `NT_FEEDBACK.pdf`

| Trang | Nội dung phản hồi của Nhóm trưởng | Phân loại | Trách nhiệm | Giải pháp đề xuất |
|:---:|---|:---:|:---:|---|
| **P.1** | `Sửa tài khoản admin là text, k phải sđt hay email` | **Backend & Frontend** | **BE + FE** | • **BE:** Bổ sung trường `username` vào `User`, cho phép đăng nhập bằng `username` (ví dụ `admin`), seed tài khoản admin `username: 'admin'`.<br>• **FE:** Chuyển input từ `type="email"` sang `type="text"`, bỏ validate định dạng sđt/email. |
| **P.1** | `xóa chữ trên thanh tìm kiếm ko tự load lại danh sách` | **Frontend** | **FE** | • **FE:** Bắt sự kiện `(input)` / `(ngModelChange)` với debounce 300ms; khi giá trị rỗng (`""`), tự động gọi lại API tải danh sách không kèm query `search`/`q`.<br>• **BE:** Đã hỗ trợ khi param rỗng thì bỏ qua filter. |
| **P.1** | `báo lỗi vượt quá 10 hình ở trên đầu quá khó thấy á nếu lướt xuống dưới => user ko biết lỗi gì` | **Frontend (UX)** | **FE** | • **FE:** Thay alert tĩnh cố định ở đầu form bằng Toast message nổi hoặc hiển thị lỗi ngay tại khu vực upload ảnh. |
| **P.2** | `=> Đổi toàn bộ tbao lỗi thành kiểu thông báo toast, chỉ xuất hiện vài s ngay giữa màn hình. ví dụ ở hình dưới` | **Frontend (UX)** | **FE** | • **FE:** Xây dựng component Toast Service chung hiển thị ở giữa màn hình (hoặc top-center), tự biến mất sau 3 giây. |
| **P.3** | `chưa nhập giá bán vẫn cho lưu => thêm rule vào` | **Backend & Frontend** | **BE + FE** | • **BE:** Thêm rule chặn `price <= 0` trong model `Product.variants.price` và các API `createProduct`, `updateProduct`, `addVariant`, trả lỗi `422 UnprocessableEntity` (*"Giá bán phải lớn hơn 0 VND"*).<br>• **FE:** Thêm form validator `[Validators.required, Validators.min(1)]`. |
| **P.3** | `ko lưu được sp` & `những cái thông báo lỗi unauthorized/failed to fetch có cho hiện trên FE cho user thấy ko => nghiên cứu lại` | **Backend & Frontend** | **BE + FE** | • **BE:** Tối ưu hiệu năng, đảm bảo CORS và Cookie refresh hoạt động mượt mà.<br>• **FE:** Dùng `HttpInterceptor` bắt lỗi 401 để tự refresh token hoặc hiển thị toast thân thiện (*"Phiên đăng nhập đã hết hạn"*), không in raw string `"unauthorized"` hay `"Failed to fetch"`. |
| **P.4** | `sao thoát thêm sp/chỉnh sửa thì nó chỉ hiện thị 2 sp thôi, reload lại thì xổ ra 8, nghi ngờ 2 cái này là mock data` | **Backend & Frontend** | **BE + FE** | • **Làm rõ:** Không phải mock data! DB có 2 sp `ACTIVE` và 6 sp `INACTIVE` (do toggle tạo sp để mặc định tắt).<br>• **BE:** Chuẩn hóa `listProducts` cho Admin: mặc định trả về toàn bộ sản phẩm đang lưu hành (`status: { $ne: 'ARCHIVED' }` -> đủ cả 8 sp), chỉ riêng tab "Đã lưu trữ" mới lọc `ARCHIVED`.<br>• **FE:** Đảm bảo khi redirect sau khi thêm/sửa, luôn gửi kèm Bearer token và không gán cứng `status=ACTIVE`. |
| **P.4** | `để nút khôi phục ở đây luôn` (Trang Chỉnh sửa sản phẩm lưu trữ) | **Frontend** | **FE** | • **FE:** Thêm nút "Khôi phục" gọi API đã có sẵn của Backend: `POST /api/v1/products/:id/restore`.<br>• **BE:** Endpoint đã sẵn sàng và hoạt động tốt. |
| **P.4** | `từ chỉnh sửa sp lưu trữ -> bấm hủy bỏ -> direct trang sp hiện tại chứ ko phảu trang sp lưu trữ` | **Frontend** | **FE** | • **FE:** Sửa router navigation của nút Hủy: nếu đang ở sản phẩm lưu trữ, điều hướng về `/admin/products?tab=archived`. |
| **P.4** | `chốt 1 cách thể hiện sidebar` | **Frontend (UI)** | **FE** | • **FE:** Đồng bộ cấu hình style và active class của Sidebar layout. |
| **P.4** | `pagination k phân trang` | **Backend & Frontend** | **BE + FE** | • **BE:** Bổ sung tham số `page` (1-indexed) song song với `cursor` trong `listProducts`, `listCategories`, `listServices`; trả về metadata `{ items, totalItems, total, page, totalPages, limit }`.<br>• **FE:** Kết nối Paginator với `page` và `totalPages` từ response. |
| **P.5** | `cái thông báo này k tự biến mất sau x giây à` | **Frontend (UX)** | **FE** | • **FE:** Thêm `setTimeout(() => this.message = null, 3000)` cho các banner thông báo thành công / thất bại. |

---

## 2. Kế Hoạch Triển Khai Backend Chi Tiết (Action Plan)

### Task 1: Hỗ trợ Đăng Nhập Admin bằng Tài Khoản Text (`username: 'admin'`)
- **Tệp tin ảnh hưởng:**
  - `src/models/User.js`
  - `src/modules/auth/auth.service.js`
  - `src/seeds/demoUsersSeed.js`
  - `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` & `docs/07-openapi-v6.yaml`
- **Chi tiết kỹ thuật:**
  1. Trong `User.js`: Bổ sung field `username`: `{ type: String, unique: true, sparse: true, trim: true, lowercase: true }`. Điều chỉnh validation của `phone` để không bắt buộc nếu user có `username` hoặc là Admin/Staff.
  2. Trong `auth.service.js` (`login`): Mở rộng truy vấn xác thực:
     ```javascript
     const user = await User.findOne({
       $or: [
         { username: loginId.toLowerCase() },
         { email: loginId.toLowerCase() },
         { phone: loginId }
       ]
     });
     ```
  3. Trong `demoUsersSeed.js`: Cập nhật tài khoản Admin có `username: 'admin'`, password: `'Admin@1234'`.
  4. Cập nhật OpenAPI spec cho `LoginRequest`: mô tả `identifier` có thể là username, email hoặc số điện thoại.

---

### Task 2: Chặn Triệt Để Lưu Sản Phẩm Khi Giá Bán `<= 0` (Thêm Rule Giá)
- **Tệp tin ảnh hưởng:**
  - `src/modules/catalog/models/Product.js`
  - `src/modules/catalog/catalog.service.js`
  - `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` & `docs/07-openapi-v6.yaml`
- **Chi tiết kỹ thuật:**
  1. Trong `Product.js` (`variantSchema`):
     ```javascript
     price: { type: Number, required: [true, 'Giá bán là bắt buộc'], min: [1, 'Giá bán phải lớn hơn 0'] }
     ```
  2. Trong `catalog.service.js`:
     - Tại `createProduct`: Kiểm tra từng biến thể, nếu `v.price === undefined || isNaN(v.price) || parseInt(v.price, 10) <= 0` -> Ném `AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Giá bán của biến thể phải lớn hơn 0 VND')`.
     - Tại `updateProduct`, `addVariant`, `updateVariant`: Áp dụng cùng rule kiểm tra `price > 0`.
  3. Cập nhật OpenAPI spec: Thêm `minimum: 1` cho `price` trong schema `ProductVariantWrite` và `ProductVariant`.

---

### Task 3: Bổ Sung Phân Trang Theo Trang (`page`) Khắc Phục Lỗi `pagination k phân trang`
- **Tệp tin ảnh hưởng:**
  - `src/modules/catalog/catalog.service.js` (`listProducts`, `listCategories`)
  - `src/modules/catalog/serviceCatalog.service.js` (`listServices`)
  - `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` & `docs/07-openapi-v6.yaml`
- **Chi tiết kỹ thuật:**
  1. Hỗ trợ query parameter `page` (số nguyên >= 1) song song với `cursor`.
  2. Nếu có `page`:
     ```javascript
     const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
     const skip = (parsedPage - 1) * parsedLimit;
     const items = await Model.find(query).sort(sortCriteria).skip(skip).limit(parsedLimit);
     ```
  3. Trả về metadata đầy đủ:
     ```json
     {
       "items": [...],
       "total": 8,
       "totalItems": 8,
       "page": 1,
       "totalPages": 1,
       "limit": 10,
       "nextCursor": null
     }
     ```
  4. Giữ nguyên 100% khả năng tương thích ngược cho các client sử dụng `cursor`.

---

### Task 4: Chuẩn Hóa Danh Sách Sản Phẩm Admin (Giải Quyết Hiện Tượng 2 sp vs 8 sp)
- **Tệp tin ảnh hưởng:**
  - `src/modules/catalog/catalog.service.js` (`listProducts`)
- **Chi tiết kỹ thuật:**
  1. Đối với người dùng nội bộ (`ADMIN`, `MANAGER`):
     - Nếu không truyền `status` (mặc định tab "Sản phẩm hiện tại"): Trả về tất cả sản phẩm đang lưu hành (`query.status = { $ne: 'ARCHIVED' }` -> đủ cả sản phẩm `ACTIVE` và `INACTIVE`).
     - Nếu truyền `status=ARCHIVED` (tab "Đã lưu trữ"): Trả về các sản phẩm đã lưu trữ.
     - Nếu truyền `status=ACTIVE` hoặc `status=INACTIVE`: Lọc đúng theo trạng thái được chọn.
  2. Đối với khách hàng (`CUSTOMER` / `public`): Giữ nguyên chỉ thấy `status: 'ACTIVE'` và `usageType: ['SALE', 'SHARED']`.

---

### Task 5: Kiểm Thử Tự Động & Hậu Kiểm Toàn Bộ (Verification)
- **Tệp tin ảnh hưởng:**
  - `tests/auth.test.js` (Thêm test login bằng username `admin`).
  - `tests/catalog.test.js` (Thêm test chặn giá bán `<= 0`, test phân trang bằng `page`).
  - `tests/service-branch.test.js` (Thêm test phân trang services bằng `page`).
- **Kịch bản kiểm thử:**
  1. `POST /api/v1/auth/login` với `{ identifier: 'admin', password: 'Admin@1234' }` -> 200 OK.
  2. `POST /api/v1/products` với `price: 0` -> 422 Unprocessable Entity.
  3. `GET /api/v1/products?page=2&limit=2` -> Trả đúng 2 sản phẩm trang 2 cùng `totalPages`, `total`, `page: 2`.
  4. `GET /api/v1/products` với Admin token -> Trả đủ 8 sản phẩm không phân biệt ACTIVE/INACTIVE.
  5. Chạy `npm test` đạt 100% PASS tất cả các test suites.
  6. Chạy `npm run build` thành công.

---

## 3. Tài Liệu Bàn Giao & Hướng Dẫn Phối Hợp Cho Frontend (FE Handoff)

Sau khi BE triển khai xong, bàn giao cho team FE các điểm cần cập nhật ở Client:
1. **Form Đăng nhập:** Đổi ô nhập từ email/phone sang text, cho phép admin nhập `admin` và mật khẩu `Admin@1234`.
2. **Form Thêm/Sửa Sản phẩm:** Thêm validator `min(1)` cho trường Giá bán.
3. **Phân trang Paginator:** Truyền param `page` lên API và đọc `res.totalPages`, `res.total` để render phân trang.
4. **Toast Notification:** Chuyển đổi các thông báo lỗi/thành công sang Toast message 3 giây biến mất.
5. **Nút Khôi phục:** Gắn sự kiện gọi `POST /api/v1/products/:id/restore` cho nút khôi phục tại trang sửa sản phẩm lưu trữ.
