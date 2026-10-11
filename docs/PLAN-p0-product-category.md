# PLAN: Priority P0 – Product/Category Master Global & Inventory Isolation

## 1. Goal
Hoàn thành task Priority P0 – Product/Category Backend: Admin CRUD Product/Category master global không lưu stock trực tiếp; tồn theo branch khởi tạo = 0 và chỉ tăng qua `InventoryTransaction` (RECEIPT, INITIAL_STOCK); Customer xem đúng dữ liệu và không thể chọn/mua sản phẩm hết hàng hoặc vượt tồn; tuân thủ chuẩn contract OpenAPI V7 và RFC 9457 Problem Details.

## 2. Core Decisions & Mapping
- **OpenAPI Version**: Cập nhật runtime sang `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` với routing root `/api/v1/products` và `/api/v1/categories`.
- **Product Model (Master Global)**: Không chứa bất kỳ trường branchStock/quantity nào. Variants được embed trong Product, mỗi variant liên kết với 1 `InventoryItem` (kind `PRODUCT`).
- **Initial Stock Isolation**: Khi tạo Product, tự động sinh `InventoryItem` cho variant nhưng không ghi số lượng tồn. Tồn tại mọi branch = 0 cho đến khi Admin/Manager thực hiện `POST /api/v1/inventory/receive` với reason `INITIAL_STOCK`.
- **Customer Stock Shield**: Server tự tính trường `outOfStock` (dựa trên tổng tồn trên các chi nhánh ACTIVE) khi trả về dữ liệu Product list/detail. Cart add/update kiểm tra tồn khả dụng toàn hệ thống và chặn với mã 422 `PRODUCT_NOT_PURCHASABLE` hoặc `INSUFFICIENT_INVENTORY`.
- **Idempotency**: Áp dụng middleware kiểm tra header `Idempotency-Key` trên các endpoint POST/PATCH mutation theo contract v7.

## 3. Tasks Breakdown

- [ ] Task 1: Cập nhật config & OpenAPI spec path sang V7 (`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`) → Verify: `npm test` chạy không lỗi đường dẫn spec.
- [ ] Task 2: Hoàn thiện Schema Mongoose cho `Category`, `Product` (variants, không stock), `InventoryItem`, `InventoryStock`, `InventoryTransaction` → Verify: Schemas compile hợp lệ, có đủ index cần thiết theo V7.
- [ ] Task 3: Tạo `idempotencyMiddleware.js` hỗ trợ header `Idempotency-Key` (dùng model `IdempotencyKey`) → Verify: Cùng key+body replay kết quả cũ, khác body trả 409 `IDEMPOTENCY_KEY_REUSED`.
- [ ] Task 4: Xây dựng `catalog.service.js` (Category CRUD, Product CRUD, pagination cursor, server-side search/filter/sort) và tự sinh `InventoryItem` khi tạo variant → Verify: Unit/Integration test tạo Product không có stock field trong document.
- [ ] Task 5: Xây dựng `stockAvailability.service.js` tính toán `outOfStock` cho catalog và kiểm tra tính khả dụng khi mua hàng → Verify: Sản phẩm mới tạo trả về `outOfStock: true`.
- [ ] Task 6: Hoàn thiện endpoint `POST /api/v1/inventory/receive` trong `inventory.service.js` và `inventory.routes.js` (hỗ trợ nhập `INITIAL_STOCK`) → Verify: Giao dịch RECEIPT ghi nhận đúng ledger trước/sau và tăng tồn trong `InventoryStock`.
- [ ] Task 7: Cập nhật Cart & Order validation để chặn mua hàng hết tồn hoặc vượt tồn kho (mã lỗi 422 Problem Details) → Verify: Thêm vào Cart số lượng lớn hơn tồn bị từ chối với 422 `INSUFFICIENT_INVENTORY`.
- [ ] Task 8: Tinh chỉnh `catalog.routes.js` và mount vào `src/app.js` tại `/api/v1/products` và `/api/v1/categories` theo đúng OpenAPI v7 → Verify: Supertest gọi các endpoint trả về định dạng chuẩn.
- [ ] Task 9: Viết bộ test tự động (`tests/catalog.test.js` & cập nhật `tests/contract.test.js`) phủ toàn bộ luồng nghiệp vụ P0 → Verify: Toàn bộ test `npm test` PASS 100%.

## 4. Done When
- [ ] Admin CRUD được Category & Product master global.
- [ ] Không có trường stock/quantity nào được lưu trong document `Product`.
- [ ] Tạo Product mới có tồn tại các branch mặc định = 0.
- [ ] Nhập hàng đầu kỳ thực hiện thành công qua `POST /api/v1/inventory/receive` và tạo đúng `InventoryTransaction` (RECEIPT).
- [ ] Customer xem Product thấy cờ `outOfStock` phản ánh đúng thực tế tồn kho.
- [ ] Chặn triệt để hành vi chọn/mua sản phẩm hết hàng hoặc mua vượt quá số lượng tồn khả dụng (422 Problem Details).
- [ ] Toàn bộ automated tests pass.
