# TÀI LIỆU BÀN GIAO BACKEND CHO FRONTEND — MODULE QUẢN LÝ SẢN PHẨM (TASK 3.6 - WEB-2)

> **Dành cho:** Team Frontend (Angular Admin & Angular Customer)  
> **Phiên bản API Contract:** OpenAPI v7 Canonical (`/api/v1`)  
> **Trạng thái:** ✅ Đã hoàn tất triển khai & kiểm thử 100% trên nhánh `feat/foundation-v6`.

---

## I. TỔNG QUAN CÁC NÂNG CẤP MỚI

1. **Tự động sinh mã sản phẩm & SKU (Quy tắc SKU-01 -> SKU-09):**
   - Backend tự động cấp `productCode` theo định dạng `SP-000123`.
   - Backend tự động cấp SKU cho từng variant theo định dạng `SP-000123-001`, `SP-000123-002`, ...
   - Frontend **không bắt buộc** phải nhập SKU khi tạo mới. Nếu Admin muốn tự đặt SKU riêng vẫn hỗ trợ (Backend kiểm tra trùng lặp toàn hệ thống, trả mã `409 CONFLICT` nếu trùng).
   - **Bất biến SKU (SKU-05):** Khi cập nhật sản phẩm/biến thể, SKU của biến thể đã tạo không được phép sửa (Backend sẽ trả lỗi `422 Unprocessable Entity`).

2. **Loại sản phẩm (`productType`) & Mục đích sử dụng (`usageType`):**
   - `productType`: `'SIMPLE'` (Sản phẩm đơn giản) hoặc `'VARIANT'` (Sản phẩm nhiều biến thể).
     - Ràng buộc: `productType` là **bất biến** sau khi tạo (không thể chuyển đổi giữa SIMPLE và VARIANT).
   - `usageType`: `'SALE'` (Chỉ bán lẻ), `'SHARED'` (Vừa bán vừa dùng dịch vụ), `'SERVICE_SUPPLY'` (Chỉ dùng nội bộ phòng khám).
     - **Quan trọng:** Phía trang Khách hàng (Customer Site) tuyệt đối không bao giờ hiển thị sản phẩm loại `SERVICE_SUPPLY`.

3. **Khuyến mại & Tính giá tự động:**
   - Mỗi biến thể hỗ trợ nhập `discountPercent` (từ `0` đến `100`).
   - Backend tự động tính và trả về `finalPrice = Math.round(price * (100 - discountPercent) / 100)`.

4. **Quản lý Hình ảnh (Cloudinary & Local Disk Fallback):**
   - Đã có API upload multipart: `POST /api/v1/uploads/products`.
   - Hỗ trợ lưu cấu trúc ảnh object chuẩn: `[{ id, url, isPrimary, sortOrder }]`, đồng thời vẫn tương thích nếu Frontend gửi mảng chuỗi URL `['https://...']`.
   - Hỗ trợ trường `image` riêng cho từng biến thể variant.

5. **Danh sách, Phân trang & Tồn kho:**
   - API `GET /api/v1/products` trả thêm trường `totalItems` (tổng số bản ghi) để FE dễ dàng hiển thị số trang.
   - Trả `totalStock` (tổng tồn kho toàn hệ thống tính từ kho) và `availableStock` cho từng variant.
   - Hỗ trợ lọc theo `usageType`, `categoryId` (hỗ trợ nhiều ID ngăn cách bằng dấu phẩy), `createdWithinDays` (ví dụ: `7`, `30`, `90`), và tìm kiếm `q` mở rộng theo Tên sản phẩm, Mã sản phẩm (`SP-xxxxxx`) và SKU.

6. **Vòng đời Biến thể & Khôi phục Sản phẩm:**
   - Soft-delete variant có điều kiện: Khi gọi `POST /products/:id/variants/:variantId/deactivate`, Backend sẽ kiểm tra nếu có Đơn hàng đang xử lý (`PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`) có chứa variant đó thì sẽ chặn lại và trả `422 Unprocessable Entity`.
   - Endpoint kích hoạt lại biến thể: `POST /api/v1/products/:id/variants/:variantId/activate`.
   - Endpoint khôi phục sản phẩm: `POST /api/v1/products/:id/restore` (chuyển từ `ARCHIVED` về `INACTIVE`).

---

## II. DANH SÁCH ENDPOINTS CHI TIẾT

### 1. Upload hình ảnh sản phẩm
- **Endpoint:** `POST /api/v1/uploads/products`
- **Headers:** `Authorization: Bearer <ADMIN_OR_MANAGER_TOKEN>`, `Content-Type: multipart/form-data`
- **Form-data:** Field name là `files` (chọn 1 hoặc tối đa 10 file ảnh JPG, PNG, WEBP, tối đa 5MB/file).
- **Response 201 Created:**
```json
{
  "items": [
    {
      "id": "pet_clinic/products/1791960666137_sp_test",
      "url": "https://res.cloudinary.com/.../sp_test.png",
      "size": 245100,
      "mimeType": "image/png",
      "originalName": "product.png",
      "isPrimary": true,
      "sortOrder": 0
    }
  ],
  "total": 1
}
```

---

### 2. Tạo sản phẩm mới
- **Endpoint:** `POST /api/v1/products`
- **Headers:** `Authorization: Bearer <ADMIN_TOKEN>`, `Idempotency-Key: <UUID>`
- **Request Body (Không cần gửi `sku` và `productCode`):**
```json
{
  "name": "Thức ăn hạt cho mèo trưởng thành Royal Canin Fit 32",
  "description": "Dinh dưỡng cân bằng cho mèo từ 1 đến 7 tuổi",
  "categoryId": "651f1f77bcf86cd799439001",
  "productType": "VARIANT",
  "usageType": "SALE",
  "origin": "Pháp",
  "expiryInfo": "24 tháng kể từ ngày sản xuất",
  "images": [
    {
      "id": "img-1",
      "url": "https://res.cloudinary.com/.../fit32.png",
      "isPrimary": true,
      "sortOrder": 0
    }
  ],
  "variants": [
    {
      "label": "Túi 400g",
      "price": 95000,
      "discountPercent": 10,
      "image": "https://res.cloudinary.com/.../fit32-400g.png"
    },
    {
      "label": "Túi 2kg",
      "price": 380000,
      "discountPercent": 0,
      "image": "https://res.cloudinary.com/.../fit32-2kg.png"
    }
  ]
}
```
- **Response 201 Created:**
```json
{
  "id": "670cfa54bcf86cd799439123",
  "productCode": "SP-000001",
  "name": "Thức ăn hạt cho mèo trưởng thành Royal Canin Fit 32",
  "description": "Dinh dưỡng cân bằng cho mèo từ 1 đến 7 tuổi",
  "categoryId": "651f1f77bcf86cd799439001",
  "productType": "VARIANT",
  "usageType": "SALE",
  "origin": "Pháp",
  "expiryInfo": "24 tháng kể từ ngày sản xuất",
  "images": [
    {
      "id": "img-1",
      "url": "https://res.cloudinary.com/.../fit32.png",
      "isPrimary": true,
      "sortOrder": 0
    }
  ],
  "variants": [
    {
      "id": "670cfa54bcf86cd799439124",
      "sku": "SP-000001-001",
      "label": "Túi 400g",
      "price": 95000,
      "discountPercent": 10,
      "finalPrice": 85500,
      "image": "https://res.cloudinary.com/.../fit32-400g.png",
      "status": "ACTIVE",
      "availableStock": 0
    },
    {
      "id": "670cfa54bcf86cd799439125",
      "sku": "SP-000001-002",
      "label": "Túi 2kg",
      "price": 380000,
      "discountPercent": 0,
      "finalPrice": 380000,
      "image": "https://res.cloudinary.com/.../fit32-2kg.png",
      "status": "ACTIVE",
      "availableStock": 0
    }
  ],
  "status": "ACTIVE",
  "totalStock": 0,
  "outOfStock": true
}
```

---

### 3. Danh sách & Lọc sản phẩm
- **Endpoint:** `GET /api/v1/products`
- **Query Params hỗ trợ:**
  - `q`: Tìm kiếm theo tên sản phẩm, mã sản phẩm (`SP-xxxxxx`) hoặc SKU biến thể.
  - `categoryId`: Lọc theo danh mục (hỗ trợ nhiều ID: `?categoryId=id1,id2`).
  - `status`: `ACTIVE` | `INACTIVE` | `ARCHIVED` (Customer luôn chỉ thấy `ACTIVE`).
  - `usageType`: `SALE` | `SHARED` | `SERVICE_SUPPLY` (Customer không bao giờ thấy `SERVICE_SUPPLY`).
  - `createdWithinDays`: `7` | `30` | `90` (Lọc theo số ngày vừa tạo gần đây).
  - `minPrice` / `maxPrice`: Khoảng giá biến thể.
  - `inStockOnly`: `true` | `false` (Chỉ hiển thị sản phẩm còn hàng).
  - `sort`: `NEWEST` | `NAME_ASC` | `NAME_DESC` | `PRICE_ASC` | `PRICE_DESC`.
  - `limit`: Số bản ghi mỗi trang (1-100, mặc định: 20).
  - `cursor`: Chuỗi cursor phân trang.
- **Response 200 OK:**
```json
{
  "items": [ ... ],
  "totalItems": 42,
  "nextCursor": "NjcwY2ZhNTRiY2Y4NmNkNzk5NDM5MTIz"
}
```

---

### 4. Cập nhật sản phẩm
- **Endpoint:** `PATCH /api/v1/products/:id`
- **Lưu ý:** Không thể thay đổi `productType`. Không được sửa mã `sku` của các biến thể đã tồn tại.

---

### 5. Thêm biến thể cho sản phẩm
- **Endpoint:** `POST /api/v1/products/:id/variants`
- **Request Body (Không bắt buộc gửi `sku`):**
```json
{
  "label": "Túi 4kg",
  "price": 720000,
  "discountPercent": 5,
  "image": "https://res.cloudinary.com/.../fit32-4kg.png"
}
```
- Backend sẽ tự động sinh `sku: "SP-000001-003"` và tính `finalPrice: 684000`.

---

### 6. Vô hiệu hóa biến thể (Ngưng kinh doanh)
- **Endpoint:** `POST /api/v1/products/:id/variants/:variantId/deactivate`
- **Ràng buộc:** Nếu có Đơn hàng đang xử lý liên quan đến biến thể này, API sẽ trả lỗi `422 Unprocessable Entity`:
```json
{
  "type": "https://httpstatuses.com/422",
  "title": "Unprocessable Entity",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "Không thể vô hiệu hóa biến thể vì đang có đơn hàng \"ORD-000123\" trong quá trình xử lý"
}
```

---

### 7. Kích hoạt lại biến thể
- **Endpoint:** `POST /api/v1/products/:id/variants/:variantId/activate`
- Chuyển `status` biến thể từ `INACTIVE` về lại `ACTIVE`.

---

### 8. Khôi phục sản phẩm đã lưu trữ
- **Endpoint:** `POST /api/v1/products/:id/restore`
- Chuyển `status` của sản phẩm từ `ARCHIVED` về `INACTIVE` (sau đó Admin có thể kiểm tra và chuyển về `ACTIVE` khi sẵn sàng mở bán).

---

## III. MÃ LỖI THƯỜNG GẶP CẦN XỬ LÝ Ở FRONTEND

| HTTP Status | Code | Lý do | Hành động khuyến nghị ở Frontend |
| :---: | :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Thiếu trường bắt buộc (`name`, `categoryId`, `price`...) | Hiển thị thông báo form lỗi tại trường tương ứng |
| **403** | `AUTHORIZATION_ERROR` | Role CUSTOMER gọi API quản trị | Chuyển hướng về trang đăng nhập hoặc báo không có quyền |
| **409** | `CONFLICT` | Trùng mã sản phẩm hoặc trùng SKU biến thể | Báo đỏ trường SKU / Mã sản phẩm với nội dung `detail` trả về từ BE |
| **422** | `VALIDATION_ERROR` | Cố ý sửa `productType`, sửa `sku` variant cũ, hoặc ngưng bán variant khi đang có đơn hàng xử lý | Hiển thị Toast / Popup cảnh báo với thông điệp chi tiết từ Backend |
