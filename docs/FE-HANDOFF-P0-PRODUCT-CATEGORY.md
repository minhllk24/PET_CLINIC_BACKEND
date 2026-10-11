# 📘 TÀI LIỆU BÀN GIAO BACKEND CHO FRONTEND: PRIORITY P0 (PRODUCT, CATEGORY & STOCK ISOLATION)

> **Dành cho:** Frontend Developer  
> **Nhánh Backend:** `feat/foundation-v6`  
> **Base URL:** `http://localhost:8080/api/v1`  
> **Đặc tả OpenAPI:** `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`

---

## 🎯 1. NGUYÊN TẮC NGHIỆP VỤ CỐT LÕI (FE CẦN LƯU Ý)

Theo quy định mới nhất từ Business và Nhóm trưởng:
1. **Product Master KHÔNG có trường tồn kho (`stock` / `quantity`)**:
   - Form tạo/sửa Product trên trang Admin **tuyệt đối không có ô nhập số lượng tồn kho theo chi nhánh**.
   - Mọi sản phẩm khi mới tạo tự động có tồn kho = 0 trên tất cả các chi nhánh.
2. **Nhập hàng chỉ thực hiện qua Module Kho (Inventory Receipt)**:
   - Muốn có hàng để bán, Admin/Thủ kho phải vào trang Quản lý Kho lập phiếu nhập (`POST /api/v1/inventory/receive`).
3. **Hiển thị trạng thái bán hàng phía Khách hàng (Customer)**:
   - Backend tự động tính toán và trả về trường **`outOfStock: boolean`** ở danh sách và chi tiết sản phẩm.
   - Nếu `outOfStock: true`: FE hiển thị badge *"Hết hàng"*, disable nút *"Thêm vào giỏ hàng"* / *"Mua ngay"*.
4. **Guardrail Giỏ hàng (Bảo vệ tồn kho)**:
   - Khi khách thêm vào giỏ hoặc tăng số lượng vượt quá số lượng tồn khả dụng, Backend sẽ trả mã lỗi **`422 Unprocessable Entity`** với `code: "INSUFFICIENT_INVENTORY"`.
   - FE chỉ cần bắt lỗi 422 và hiển thị thông báo (toast notification) cho khách hàng: `error.detail` (ví dụ: *"Số lượng yêu cầu vượt quá tồn kho khả dụng"*).

---

## 📡 2. DANH SÁCH ENDPOINT & CHI TIẾT CONTRACT

### 2.1. Quản Lý Danh Mục (Category)

| Method | Endpoint | Quyền (Role) | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Public / Customer / Admin | Lấy danh sách danh mục (hỗ trợ query `q`, `parentId`, `limit`, `cursor`) |
| `POST` | `/api/v1/categories` | Admin | Tạo danh mục mới |
| `GET` | `/api/v1/categories/:id` | Public / Customer / Admin | Chi tiết danh mục |
| `PATCH`| `/api/v1/categories/:id` | Admin | Cập nhật danh mục |

#### Headers khi gọi POST / PATCH:
- `Authorization: Bearer <Admin_Access_Token>`
- `Content-Type: application/json`
- `Idempotency-Key: <unique_uuid>` *(chuỗi ngẫu nhiên chống gửi trùng request)*

#### Body mẫu tạo Category (`POST /api/v1/categories`):
```json
{
  "name": "Thức Ăn Hạt Cho Mèo",
  "parentId": null,
  "status": "ACTIVE"
}
```
*(Lưu ý: Không gửi trường `description` vì contract OpenAPI v7 không có trường này)*.

---

### 2.2. Quản Lý Sản Phẩm (Product Master Global)

| Method | Endpoint | Quyền (Role) | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Public / Customer / Admin | Danh sách sản phẩm (có cờ `outOfStock`, lọc `categoryId`, `q`, `minPrice`, `maxPrice`, `inStockOnly`) |
| `POST` | `/api/v1/products` | Admin | Tạo sản phẩm Master (bắt buộc có ít nhất 1 variant) |
| `GET` | `/api/v1/products/:id` | Public / Customer / Admin | Chi tiết sản phẩm kèm danh sách biến thể |
| `PATCH`| `/api/v1/products/:id` | Admin | Cập nhật thông tin chung sản phẩm |

#### Body mẫu tạo Product (`POST /api/v1/products`):
```json
{
  "name": "Hạt Royal Canin Fit 32",
  "categoryId": "6acba95be989140ea233cf12",
  "description": "Thức ăn hạt cao cấp duy trì thể trạng lý tưởng cho mèo",
  "origin": "Pháp",
  "images": ["https://example.com/image.jpg"],
  "variants": [
    {
      "sku": "RC-FIT32-2KG",
      "label": "Túi 2kg",
      "price": 350000,
      "status": "ACTIVE"
    }
  ]
}
```

#### Response mẫu (Product Object):
```json
{
  "id": "6acbae6aca9881f3ac3bbe65",
  "name": "Hạt Royal Canin Fit 32",
  "description": "Thức ăn hạt cao cấp duy trì thể trạng lý tưởng cho mèo",
  "categoryId": "6acba95be989140ea233cf12",
  "origin": "Pháp",
  "expiryInfo": null,
  "images": ["https://example.com/image.jpg"],
  "variants": [
    {
      "id": "6acbae6aca9881f3ac3bbe64",
      "sku": "RC-FIT32-2KG",
      "label": "Túi 2kg",
      "price": 350000,
      "status": "ACTIVE"
    }
  ],
  "status": "ACTIVE",
  "outOfStock": false
}
```

---

### 2.3. Nhập Hàng Tồn Kho Ban Đầu (Inventory Receipt)

| Method | Endpoint | Quyền (Role) | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/inventory/receive` | Admin / Manager / Warehouse | Nhập kho khởi tạo / nhập thêm hàng cho chi nhánh |

#### Headers:
- `Authorization: Bearer <Admin_Access_Token>`
- `Content-Type: application/json`
- `Idempotency-Key: <unique_uuid>`

#### Body mẫu:
```json
{
  "branchId": "507f1f77bcf86cd799439011",
  "inventoryItemId": "6acbae6aca9881f3ac3bbe62",
  "quantity": 50,
  "reason": "INITIAL_STOCK"
}
```
*(Lưu ý: `inventoryItemId` là ID của mặt hàng trong kho, tương ứng với variant của sản phẩm)*.

---

### 2.4. Giỏ Hàng (Cart Items Guardrail)

| Method | Endpoint | Quyền (Role) | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/cart/items` | Customer / Guest | Thêm sản phẩm vào giỏ (chặn mua vượt tồn) |
| `GET`  | `/api/v1/cart`       | Customer / Guest | Xem giỏ hàng hiện tại |

#### Body thêm vào giỏ:
```json
{
  "productId": "6acbae6aca9881f3ac3bbe65",
  "variantId": "6acbae6aca9881f3ac3bbe64",
  "quantity": 2
}
```

#### Xử lý lỗi trả về (FE lưu ý):
Nếu sản phẩm hết hàng hoặc số lượng thêm vượt quá tồn kho khả dụng, Backend trả mã **`422 Unprocessable Entity`**:
```json
{
  "type": "https://httpstatuses.com/422",
  "title": "Unprocessable Entity",
  "status": 422,
  "code": "INSUFFICIENT_INVENTORY",
  "detail": "Requested quantity (250) exceeds available stock (200)",
  "correlationId": "..."
}
```
👉 FE hiển thị toast cảnh báo: `res.data.detail`.

---

## 🧪 3. KỊCH BẢN PHỐI HỢP TEST LIÊN THÔNG (E2E) ĐỂ CHẤM ĐẠT

Nhóm trưởng sẽ nghiệm thu khi giao diện Web chạy đúng luồng sau:
1. **Bước 1 (Admin):** Đăng nhập Admin ➔ Vào trang Quản lý Danh mục ➔ Tạo danh mục mới.
2. **Bước 2 (Admin):** Vào trang Sản phẩm ➔ Tạo sản phẩm Master mới (không có trường nhập stock).
3. **Bước 3 (Customer):** Mở trang Khách hàng (trang chủ/shop) ➔ Thấy sản phẩm mới xuất hiện nhưng hiển thị badge *"Hết hàng"* và không thể bấm mua (do tồn = 0).
4. **Bước 4 (Admin/Kho):** Vào trang Quản lý Kho ➔ Tạo phiếu nhập hàng (ví dụ nhập 50 cái cho chi nhánh).
5. **Bước 5 (Customer):** F5 lại trang shop ➔ Sản phẩm chuyển sang trạng thái Còn hàng.
6. **Bước 6 (Customer):** Thêm vào giỏ 10 cái ➔ Thành công. Thử gõ mua 100 cái (vượt quá 50 cái tồn kho) ➔ Web hiện thông báo lỗi: *"Số lượng yêu cầu vượt quá tồn kho khả dụng"*.

---
Nếu FE có bất kỳ vướng mắc gì trong quá trình nối API, cứ ping mình hỗ trợ trực tiếp nhé!
