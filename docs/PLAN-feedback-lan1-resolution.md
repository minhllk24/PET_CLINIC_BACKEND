# KẾ HOẠCH TRIỂN KHAI XỬ LÝ PHẢN HỒI FRONTEND LẦN 1 (FEEDBACK_LAN1.MD)

> **Mục tiêu:** Giải quyết triệt để và toàn diện 9 điểm phản hồi từ team Frontend tại `docs/feedback_lan1.md`, đảm bảo tính toàn vẹn dữ liệu, hiệu năng truy vấn, và trải nghiệm tích hợp hoàn hảo cho cả Admin & Customer UI.

---

## 1. Danh sách các hạng mục & Giải pháp đề xuất (Recommended Solutions)

| # | Hạng mục | Mức độ | Phân tích & Giải pháp tối ưu nhất (Recommended) |
|---|---|:---:|---|
| **1** | **Giá khuyến mại trong Cart** | **Cao** | Cập nhật `src/modules/cart/cart.controller.js`: Khi thêm sản phẩm (`addItem`), lưu `price = variant.finalPrice ?? variant.price`. Khi `getCart` hoặc `checkout`, đồng bộ giá theo `finalPrice` của variant. |
| **2** | **Vật tư dịch vụ (`SERVICE_SUPPLY`)** | **Cao** | Cập nhật `src/modules/catalog/stockAvailability.service.js`: Trong `checkVariantPurchasable()`, chặn nếu `product.usageType === 'SERVICE_SUPPLY'`, ném lỗi `422 PRODUCT_NOT_PURCHASABLE` với thông báo "Sản phẩm phục vụ dịch vụ không thể bán lẻ cho khách hàng". |
| **3** | **Sinh SKU đồng thời (Atomic SKU)** | **Cao** | Trong `catalog.service.js`, sử dụng `Product.findOneAndUpdate({ _id: productId }, { $inc: { nextSkuSeq: 1 } }, { new: false })` để lấy sequence SKU tăng nguyên tử, loại trừ 100% rủi ro tranh chấp khi nhiều request thêm biến thể cùng lúc. |
| **4** | **Bảo toàn biến thể khi `updateProduct`** | **Cao** | Cập nhật logic `updateProduct`: Không xóa các biến thể cũ không có trong request. Thay vào đó, khớp các biến thể cũ theo `_id` để cập nhật, giữ nguyên các biến thể cũ còn lại trong database để bảo toàn lịch sử và liên kết kho. Các biến thể mới sẽ được push thêm vào. |
| **5** | **Ảnh chính (`isPrimary`) duy nhất** | **Trung bình** | Cập nhật setter `images` trong `Product.js`: Đảm bảo luôn luôn chỉ có **DUY NHẤT 1 ảnh** có `isPrimary: true` (ảnh đầu tiên có `isPrimary: true`, hoặc mặc định là ảnh ở vị trí 0 nếu không có ảnh nào được đánh dấu). |
| **6** | **Phân trang, bộ lọc tồn kho & tổng tồn** | **Trung bình** | - **Lọc `inStockOnly`:** Truy vấn trực tiếp các `inventoryItemId` có số lượng `> 0` từ `InventoryStock` để lọc ngay ở tầng MongoDB `Product.find()` & `countDocuments()`, đảm bảo `totalItems` chính xác 100%.<br>- **Tổng tồn kho:** `totalStock` tính tổng tồn tất cả biến thể cho Admin và biến thể active cho Customer. |
| **7** | **Ngày tạo & ngày cập nhật** | **Trung bình** | Bổ sung `createdAt` và `updatedAt` (dạng ISO String) vào `formatProduct()`, đồng thời khai báo vào schema `Product` trong `07-openapi-v7.yaml` và `07-openapi-v6.yaml`. |
| **8** | **SKU chuẩn hóa & snapshot đơn hàng** | **Trung bình** | - **Sinh SKU 100% tự động:** Backend luôn tự sinh `productCode` và `sku` chuẩn hóa, không phụ thuộc FE gửi SKU thủ công.<br>- **Order snapshot:** Thêm `skuSnapshot` vào schema `OrderItem` trong `Order.js` và lưu `item._resolvedSku` trong `order.service.js`. |
| **9** | **Tương thích & Migration SP cũ** | **Trung bình** | Thêm hàm `migrateMissingProductCodes()` chạy tự động lúc khởi động server hoặc khi thao tác trên sản phẩm cũ: Nếu sản phẩm chưa có `productCode`, Backend tự động cấp phát `SP-xxxxxx` và cập nhật an toàn. |

---

## 2. Kế hoạch triển khai chi tiết từng file (Implementation Plan)

### Bước 1: Schema Updates & Migration
- [ ] **`src/modules/catalog/models/Product.js`**:
  - Chuẩn hóa setter `images` đảm bảo duy nhất 1 ảnh `isPrimary: true`.
- [ ] **`src/modules/order/models/Order.js`**:
  - Thêm trường `skuSnapshot: { type: String, trim: true }` vào `orderItemSchema`.
- [ ] **`src/modules/catalog/catalog.service.js`**:
  - Viết hàm `migrateMissingProductCodes()` tự động kiểm tra và cấp `productCode` cho các sản phẩm cũ thiếu mã.

### Bước 2: Business Logic Updates
- [ ] **`src/modules/catalog/stockAvailability.service.js`**:
  - Thêm kiểm tra `product.usageType === 'SERVICE_SUPPLY'` trong `checkVariantPurchasable()`.
- [ ] **`src/modules/cart/cart.controller.js`**:
  - Lưu `variant.finalPrice ?? variant.price` vào CartItem.
- [ ] **`src/modules/order/order.service.js`**:
  - Lưu `skuSnapshot: item._resolvedSku` khi tạo Đơn hàng.
- [ ] **`src/modules/catalog/catalog.service.js`**:
  - Cập nhật `listProducts()`: lọc `inStockOnly` trực tiếp từ database bằng `inventoryItemId` để `totalItems` chính xác.
  - Cập nhật `formatProduct()`: trả thêm `createdAt`, `updatedAt`.
  - Cập nhật `updateProduct()`: bảo toàn các biến thể cũ không bị mất khi FE gửi danh sách không đầy đủ.
  - Cập nhật `addVariant()` & `createProduct()`: sinh SKU nguyên tử (`$inc: { nextSkuSeq: 1 }`).

### Bước 3: OpenAPI Contract Updates
- [ ] Cập nhật `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` và `docs/07-openapi-v6.yaml`:
  - Thêm `createdAt`, `updatedAt` vào `Product`.
  - Thêm `skuSnapshot` vào `OrderItem`.

### Bước 4: Verification & Automated Tests
- [ ] Viết thêm unit & integration test cases trong `tests/catalog.test.js`:
  - Test Cart lưu `finalPrice`.
  - Test chặn mua sản phẩm `SERVICE_SUPPLY`.
  - Test duy nhất 1 ảnh `isPrimary`.
  - Test `updateProduct` không làm mất biến thể cũ.
  - Test `listProducts` với `inStockOnly` tính đúng `totalItems`.
  - Test `formatProduct` trả `createdAt`, `updatedAt`.
- [ ] Chạy toàn bộ test suite `npm test` đạt 100% PASS.
- [ ] Chạy `npm run build` xác nhận Babel biên dịch thành công.
- [ ] Commit và push lên `origin feat/foundation-v6`.
