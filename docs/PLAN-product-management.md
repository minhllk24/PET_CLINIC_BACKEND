# PLAN-product-management.md — Kế hoạch Nâng cấp Toàn diện Module Quản lý Sản phẩm (Task 3.6 - WEB-2)

## 1. Mục tiêu (Goal)
Hoàn thiện toàn bộ chức năng Backend cho module **Product & Category Management (Task 3.6)** theo yêu cầu đặc tả chi tiết từ `docs/QLSP.md`, khớp 100% với giao diện Figma của Frontend Angular, bảo đảm tính toàn vẹn dữ liệu với Module Kho (Inventory), Đơn hàng (Order) và OpenAPI Contract.

---

## 2. Đánh giá Hiện trạng & Phân tích Khoảng cách (Gap Analysis)

| Hạng mục nghiệp vụ | Hiện trạng Backend | Yêu cầu theo `docs/QLSP.md` | Độ ưu tiên |
| :--- | :--- | :--- | :---: |
| **1. Mã SP & SKU** | Bắt buộc FE gửi `sku` thủ công. Dễ bị trùng lặp. | BE tự sinh `productCode` (`SP-000123`) & SKU (`SP-000123-001`, `002`...). Sequence bất biến, không tái sử dụng. | **P0** |
| **2. Upload ảnh sản phẩm** | Chỉ lưu mảng URL `images: string[]`, chưa có API upload file thật. | Thêm endpoint `POST /api/v1/uploads/products` (Multer), validate JPG/PNG, max 5MB, max 10 ảnh, hỗ trợ ảnh chính & sortOrder. | **P0** |
| **3. Ảnh riêng cho biến thể** | Variant chỉ có `label`, `price`, `sku`. | Thêm trường `image` (URL) cho từng variant, cập nhật qua create/update variant. | **P0** |
| **4. usageType & productType** | Chưa có 2 trường này trên model `Product`. | Thêm `productType` (`SIMPLE`, `VARIANT` - bất biến) & `usageType` (`SALE`, `SHARED`, `SERVICE_SUPPLY`). Khách hàng không thấy `SERVICE_SUPPLY`. | **P0** |
| **5. Khuyến mại & Giá sau giảm** | Chỉ có `price` gốc. | Bổ sung `discountPercent` (0–100%) và tự động tính `finalPrice = round(price * (100 - discountPercent) / 100)`. | **P0** |
| **6. Danh sách, Lọc & Tổng tồn** | Phân trang cursor đơn giản, thiếu metadata và tổng tồn kho. | Bổ sung `totalItems`, tính `totalStock` từ `InventoryStock`, lọc theo `usageType`, ngày tạo (7/30/90 ngày), danh mục. | **P1** |
| **7. Quản lý Biến thể** | Chỉ có `deactivateVariant` cơ bản. | Soft-delete variant, chặn nếu có Order đang xử lý, thêm API `activate` (khôi phục biến thể), bảo toàn snapshot lịch sử. | **P1** |
| **8. Lưu trữ & Khôi phục** | Đã có `archiveProduct`. Khôi phục dùng chung PATCH. | Chuẩn hóa `archivedAt`, bổ sung endpoint khôi phục `POST /products/:id/restore` (đưa về `INACTIVE`). | **P1** |
| **9. OpenAPI & Validator** | Schema v7 còn thiếu các trường mới. | Cập nhật `07-openapi-v7.yaml` và `07-openapi-v6.yaml` tránh lỗi `additionalProperties: false`. | **P0** |

---

## 3. Kế hoạch Triển khai Chi tiết theo Từng Giai đoạn

### Giai đoạn 1: Database Schemas & Sequence Counter (P0)
- **Task 1.1: Tạo Model `Counter` cho Atomic Sequence**
  - File: `src/models/Counter.js`
  - Quản lý tự tăng an toàn: `productCode` sequence (ví dụ: `SP-000001`).
- **Task 1.2: Cập nhật Schema `Product`**
  - File: `src/modules/catalog/models/Product.js`
  - Thêm fields:
    - `productCode`: `{ type: String, unique: true, sparse: true }`
    - `productType`: `{ type: String, enum: ['SIMPLE', 'VARIANT'], default: 'SIMPLE' }`
    - `usageType`: `{ type: String, enum: ['SALE', 'SHARED', 'SERVICE_SUPPLY'], default: 'SALE', index: true }`
    - `nextSkuSeq`: `{ type: Number, default: 1 }`
    - `images`: Cấu trúc mảng object `{ id, url, isPrimary, sortOrder }` (hoặc adapter linh hoạt)
    - `archivedAt`: `{ type: Date, default: null }`
    - `variants`: Bổ sung `image: String`, `discountPercent: { type: Number, min: 0, max: 100, default: 0 }`, `finalPrice: Number`

### Giai đoạn 2: Cơ chế Tự sinh Mã Sản phẩm & SKU (P0)
- **Task 2.1: Hàm tiện ích sinh mã `productCode` và `SKU`**
  - File: `src/modules/catalog/skuGenerator.service.js`
  - Format: `productCode = SP-${String(seq).padStart(6, '0')}` (e.g. `SP-000123`).
  - Format SKU: `${productCode}-${String(skuIndex).padStart(3, '0')}` (e.g. `SP-000123-001`).
- **Task 2.2: Tích hợp vào `createProduct` và `addVariant`**
  - File: `src/modules/catalog/catalog.service.js`
  - Nếu FE không gửi `sku`, BE tự cấp.
  - Cập nhật `nextSkuSeq` sau mỗi lần cấp để không bao giờ tái sử dụng SKU cũ.

### Giai đoạn 3: Upload & Quản lý Hình ảnh (P0)
- **Task 3.1: Cấu hình Static File Serving cho Express**
  - File: `src/app.js`
  - Cấu hình `app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')))` để phục vụ ảnh tĩnh trực tiếp.
- **Task 3.2: Endpoint Upload ảnh sản phẩm**
  - File: `src/modules/upload/upload.routes.js`, `src/modules/upload/upload.controller.js`
  - Endpoint: `POST /api/v1/uploads/products` (hỗ trợ single & multiple files, validate max 5MB, JPG/PNG).
  - Trả về danh sách `{ id, url, originalName, size, mimeType }`.

### Giai đoạn 4: Nghiệp vụ `usageType`, `productType`, Khuyến mại & Giá (P0)
- **Task 4.1: Ràng buộc `productType` bất biến & validation `usageType`**
  - File: `src/modules/catalog/catalog.service.js`
  - Chặn sửa `productType` trong `updateProduct` (ném HTTP 422 nếu có ý định đổi `SIMPLE` ↔ `VARIANT`).
  - Lọc `usageType !== 'SERVICE_SUPPLY'` khi public/CUSTOMER gọi `GET /api/v1/products`.
- **Task 4.2: Tự động tính `finalPrice` cho từng biến thể**
  - File: `src/modules/catalog/catalog.service.js`
  - `finalPrice = Math.round(price * (100 - discountPercent) / 100)`.

### Giai đoạn 5: Danh sách, Bộ lọc Nâng cao & Tính Tồn kho (P1)
- **Task 5.1: Bổ sung bộ lọc & tìm kiếm**
  - Tìm kiếm mở rộng: Theo `name`, `sku`, `productCode`.
  - Bộ lọc: `usageType`, `categoryId` (hỗ trợ nhiều category), `createdWithinDays` (7, 30, 90).
  - Sắp xếp: `NEWEST`, `NAME_ASC`, `NAME_DESC`, `PRICE_ASC`, `PRICE_DESC`.
- **Task 5.2: Tổng hợp tồn kho & đếm tổng số bản ghi (`totalItems`)**
  - Join với `InventoryStock` để trả `totalStock` theo sản phẩm / SKU.
  - Trả `totalItems` cho phân trang số trang ở Frontend.

### Giai đoạn 6: Quản lý Vòng đời Biến thể & Khôi phục Sản phẩm (P1)
- **Task 6.1: Soft-delete biến thể có điều kiện**
  - Chặn `deactivateVariant` nếu có Order đang xử lý liên quan đến biến thể đó (HTTP 422).
  - Thêm endpoint `POST /api/v1/products/:id/variants/:variantId/activate` để kích hoạt lại biến thể.
- **Task 6.2: Khôi phục sản phẩm đã lưu trữ**
  - Endpoint `POST /api/v1/products/:id/restore` chuyển trạng thái từ `ARCHIVED` về `INACTIVE`.

### Giai đoạn 7: Cập nhật OpenAPI Contract & Test Suite Toàn diện (P0 & P1)
- **Task 7.1: Cập nhật `07-openapi-v7.yaml` và `07-openapi-v6.yaml`**
  - Cập nhật `Product`, `ProductWrite`, `ProductVariant`, `ProductVariantWrite`, `ProductPage`.
  - Khai báo các endpoint mới: Upload, Restore, Activate Variant.
- **Task 7.2: Viết Unit & Contract Tests**
  - Kiểm thử 100% các kịch bản: sinh SKU tự động, tính giá khuyến mại, lọc `usageType`, upload ảnh, ngăn chặn đổi `productType`, và xử lý lỗi 400/403/409/422.

---

## 4. Kế hoạch Kiểm thử & Xác minh (Verification Plan)
1. **Automated Tests:**
   - Chạy `npm test tests/catalog.test.js` xác nhận các luồng nghiệp vụ mới.
   - Chạy toàn bộ test suite `npm test` (đảm bảo không ảnh hưởng tới Auth hay Inventory).
2. **Contract Validation:**
   - Chạy `npm run build` xác nhận Babel biên dịch sạch không lỗi.
   - Kiểm tra OpenAPI validator không báo lỗi `additionalProperties`.
3. **Manual Flow Verification:**
   - Tạo sản phẩm mới từ FE Admin và kiểm tra SKU tự động sinh định dạng `SP-xxxxxx-001`.
   - Upload ảnh JPG/PNG và xác nhận ảnh hiển thị được trên trình duyệt qua URL tĩnh.
