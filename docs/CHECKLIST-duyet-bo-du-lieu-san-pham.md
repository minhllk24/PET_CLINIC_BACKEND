# Checklist duyệt bộ dữ liệu 100–200 sản phẩm

> [!IMPORTANT]
> **Trạng thái:** ĐỀ XUẤT ĐỂ NHÓM TRƯỞNG DUYỆT. Chưa tạo sản phẩm, chưa ghi database.
>
> **Căn cứ:** repository `minhllk24/PET_CLINIC_BACKEND`, nhánh `feat/foundation-v6`, commit `0a7e4a35ae23a9d3fa332ea7d958c21daaa63731`. Đối chiếu tĩnh code Mongoose, catalog service, inventory service, OpenAPI v7 và `docs/QLSP.md`; chưa xác minh dữ liệu hay index thực tế trong database đích.

---

## 1. Phạm vi và cách đếm — cần duyệt

- **Đề xuất 150 Product master; biến thể/SKU đếm riêng.** Một sản phẩm có ba trọng lượng là một Product và ba SKU.
- **Quy ước gom/tách sản phẩm:** Cùng thương hiệu, dòng hàng, công dụng và đối tượng: gom khác biệt dung lượng/kích cỡ/màu/mùi thành variants nếu phù hợp. Khác công thức/công dụng/đối tượng rõ rệt: tách Product. Đây là quy ước biên tập cần duyệt, không phải validation hiện có.
- **Phân loại sử dụng:** Đề xuất ban đầu chỉ gồm hàng bán lẻ `SALE`. `SHARED` và `SERVICE_SUPPLY` lập danh sách riêng nếu nhóm trưởng yêu cầu; không tính dịch vụ khám, tiêm phòng, spa thành Product.
- **Cơ cấu tham khảo (chưa phải taxonomy hiện có trong DB):**

| Nhóm hàng | Số Product |
|---|---:|
| Thức ăn chó | 30 |
| Thức ăn mèo | 30 |
| Bánh thưởng / snack | 20 |
| Vệ sinh, cát vệ sinh, khử mùi | 20 |
| Chăm sóc lông, tắm, răng miệng | 15 |
| Đồ chơi | 15 |
| Phụ kiện sinh hoạt, bát ăn, dây dắt, vận chuyển | 20 |
| **Tổng cộng** | **150** |

- **Tính xác thực của dữ liệu:** Dữ liệu sản phẩm thật hay dữ liệu demo, nguồn tham khảo, quyền sử dụng ảnh và tính chất giá phải được duyệt. Không trình bày thông số hoặc xuất xứ chưa kiểm chứng như dữ kiện thật.

---

## 2. Rule đã xác nhận từ code/contract

| ID | Rule chi tiết |
|:---:|---|
| **R01** | Catalog hiện tại dùng MongoDB/Mongoose; không dùng seed Prisma/MySQL của nhánh `dev`. |
| **R02** | Product master toàn hệ thống, không thuộc riêng chi nhánh. |
| **R03** | `name`, `categoryId`, `variants` bắt buộc; mỗi variant gửi `label` và `price` theo OpenAPI. Trim chuỗi trước khi import. |
| **R04** | `categoryId` phải là ObjectId hợp lệ và trỏ tới Category đang `ACTIVE` khi tạo Product. |
| **R05** | `SIMPLE` đúng một variant/SKU; `VARIANT` có ít nhất một variant. Không suy ra `productType` từ số lượng variants. |
| **R06** | Không đổi `SIMPLE` ↔ `VARIANT` sau khi tạo. Phải chọn đúng trước khi import. |
| **R07** | `usageType`: `SALE` = bán lẻ; `SHARED` = bán và dùng dịch vụ; `SERVICE_SUPPLY` = vật tư dịch vụ, không bán cho khách. |
| **R08** | `Product.status`: `ACTIVE`, `INACTIVE`, `ARCHIVED`. `Variant.status`: `ACTIVE`, `INACTIVE`. |
| **R09** | Public/customer chỉ xem Product `ACTIVE` thuộc `SALE` hoặc `SHARED`. Hết hàng vẫn có thể xuất hiện; không đồng nghĩa `INACTIVE`. |
| **R10** | Mặc định để backend cấp `productCode` dạng `SP-000123`; `createProduct` cấp SKU dạng `SP-000123-001`. Không tự gán SKU từ tên/trọng lượng. |
| **R11** | SKU giữ nguyên sau khi tạo; biến thể mới dùng số tiếp theo. Không tái sử dụng mã của biến thể đã ngừng dùng. |
| **R12** | `price` là số nguyên VNĐ, ít nhất 1. Không gửi chuỗi có dấu phân cách hoặc ký hiệu tiền. |
| **R13** | `discountPercent` trong khoảng 0–100; mặc định 0. `finalPrice` do BE tính: `Math.round(price × (100 − discountPercent) / 100)`. |
| **R14** | `images` lưu object `{ id, url, isPrimary, sortOrder }`; backend cũng nhận string nhưng bộ dữ liệu mới nên dùng object thống nhất. Nếu có ảnh, setter giữ một ảnh chính, mặc định ảnh đầu. |
| **R15** | Upload hỗ trợ JPEG/PNG/WEBP, tối đa 5 MiB/file và 10 file/lần upload. Giới hạn tổng số ảnh trên Product cần được importer kiểm tra riêng. |
| **R16** | Variant có thể có image riêng; quy ước FE dùng ảnh chính khi không có ảnh riêng cần kiểm tra khi nghiệm thu. |
| **R17** | Mỗi variant liên kết `inventoryItemId`; `createProduct` tạo/tái sử dụng InventoryItem theo SKU, kind `PRODUCT`, unit mặc định `"cái"`. |
| **R18** | Product không lưu stock/quantity. Tạo Product không tạo số dư kho; phải nhập riêng qua Inventory. |
| **R19** | `InventoryStock` duy nhất theo cặp `branchId` + `inventoryItemId`. Nhập kho `quantity > 0`, `reason` ít nhất 3 ký tự. |
| **R20** | Tổng tồn hiển thị được tính từ `InventoryStock`; `totalStock` chỉ cộng biến thể `ACTIVE`. Chủ đích là tính trên chi nhánh `ACTIVE`; xem lưu ý fallback ở mục 6. |
| **R21** | API tạo/sửa catalog chỉ dành cho `ADMIN`. API receive hiện có role gate `ADMIN`/`MANAGER`; `MANAGER` bị giới hạn theo chi nhánh được gán. |
| **R22** | Restore Product `ARCHIVED` đưa về `INACTIVE`, không tự mở bán lại. |

---

## 3. Metadata đưa vào bộ dữ liệu

### 3.1 Category

| Field | Bắt buộc | Quy ước |
|---|:---:|---|
| `name` | Có | Tên tiếng Việt thống nhất |
| `slug` | Nên cung cấp | ASCII không dấu, chữ thường, dấu gạch ngang; duy nhất |
| `parentId` | Không | Map từ mã danh mục trong sheet sang ObjectId; category gốc bỏ field khi gọi API |
| `status` | Có trong bộ dữ liệu | `ACTIVE` cho danh mục dùng import |

### 3.2 Product

| Field | Mức yêu cầu | Quy ước |
|---|:---:|---|
| `name` | Bắt buộc | Loại hàng + thương hiệu + dòng hàng + đối tượng; trọng lượng riêng đặt ở variant nếu có nhiều quy cách |
| `description` | Bắt buộc theo đề xuất chất lượng | Công dụng, đối tượng, quy cách/hướng dẫn/bảo quản theo nguồn; không bịa tính năng y tế |
| `categoryId` | Bắt buộc | Resolve từ categoryKey/slug, không hardcode ID từ môi trường khác |
| `productType` | Bắt buộc trong file | `SIMPLE` hoặc `VARIANT`; chọn trước khi tạo |
| `usageType` | Bắt buộc trong file | Đề xuất `SALE` mặc định |
| `origin` | Không bắt buộc schema | Nước sản xuất đã xác minh; không suy ra từ nước của thương hiệu. Bỏ field nếu chưa biết |
| `expiryInfo` | Không bắt buộc schema | Chuỗi mô tả hạn dùng/bảo quản nếu có căn cứ; không phải hạn dùng thực tế của lô hàng |
| `images[]` | Đề xuất ít nhất 1, tối đa 10 | `id`, `url`, `isPrimary`, `sortOrder`; đúng sản phẩm, URL truy cập được, không dùng placeholder cho bản nghiệm thu |
| `variants[]` | Bắt buộc | Ít nhất một; `SIMPLE` chỉ một |
| `status` | Bắt buộc trong file | Đề xuất `INACTIVE` lúc import, chuyển `ACTIVE` sau khi kiểm tra nội dung và ảnh |

### 3.3 Variant

| Field | Mức yêu cầu | Quy ước |
|---|:---:|---|
| `label` | Bắt buộc contract | “Túi 2 kg”, “Chai 250 ml”, “Size M”; `SIMPLE` dùng “Mặc định” |
| `price` | Bắt buộc | Số nguyên VNĐ > 0, có nguồn/ngày tham khảo hoặc ghi rõ giá demo |
| `discountPercent` | Nên có | 0 mặc định; chỉ tạo khuyến mại nếu được duyệt |
| `image` | Không | URL ảnh đúng biến thể; bỏ field nếu dùng ảnh chung |
| `status` | Nên có | `ACTIVE` cho SKU sử dụng; không đồng nghĩa Product phải `ACTIVE` |

> [!NOTE]
> **Không gửi các field backend tự quản lý khi tạo mới:** `_id`/`id`, `productCode` (theo quy ước import đề xuất), `sku`, `inventoryItemId`, `finalPrice`, `nextSkuSeq`, `createdAt`, `updatedAt`, `archivedAt`, `deactivatedAt`, `availableStock`, `totalStock`, `outOfStock`. Không gửi `stock`/`quantity` trong Product payload.

### 3.4 Metadata kiểm duyệt — lưu sheet/manifest riêng

Các field sau chưa có trong Product schema/API; **không đưa trực tiếp vào `ProductWrite`** vì `additionalProperties: false`:

- `batchId`, `sourceProductKey`, `sourceVariantKey`: nhận diện lô và đối soát khi chạy lại.
- `categoryKey`/`categorySlug`: khóa mapping danh mục trước khi resolve ObjectId.
- `brand`, `targetSpecies`, `lifeStage`, `sizeOrWeight`, `flavorOrColor`, `ingredients`, `usageInstructions`, `storageInstructions`: thông tin biên tập; nội dung phù hợp có thể đưa vào `name`/`description`/`label` sau duyệt. Muốn lọc theo từng field cần phát triển schema/API riêng.
- `sourceUrl`, `sourceCheckedAt`, `priceSource`, `priceCheckedAt`, `isDemoPrice`.
- `imageSourceUrl`, `imageRightsNote`: phân biệt URL nguồn tham khảo với URL ảnh phục vụ ứng dụng.
- `reviewStatus`, `reviewer`, `reviewedAt`, `reviewNote`, `duplicateCheckKey`.
- `productId`, `variantId`, `generatedSku`, `inventoryItemId` sau import: lưu mapping kết quả, không dùng để giả lập ID trước khi tạo.
- `branchKey`, `initialQuantity`, `receiptReason`: sheet nhập kho riêng nếu phạm vi có khởi tạo tồn.

---

## 4. Quy ước chất lượng đề xuất để duyệt

- **Chống trùng lặp:** Không trùng Product theo tên đã chuẩn hóa + thương hiệu + dòng hàng + đối tượng; không trùng tổ hợp thuộc tính variants trong cùng Product. DB không tự bảo đảm hai điều này.
- **Tính hợp lệ của số liệu:** Số lượng, giá, giảm giá phải hữu hạn; không nhận NaN/Infinity, giá âm, số lượng âm hoặc giá có phần thập phân. Đề xuất `initialQuantity` là số nguyên theo đơn vị bán.
- **Tiêu chuẩn hình ảnh:** Đề xuất mỗi Product có 1–4 ảnh thực, tối đa 10, đúng một ảnh chính; variant khác màu/quy cách dùng ảnh tương ứng nếu có.
- **Tính trung thực:** Không bịa đánh giá, số đã bán, tồn kho, ưu đãi, chứng nhận hoặc thông số dinh dưỡng. Schema mới không có trường `rating`/`sold` để đưa vào payload.
- **Chính sách giá:** Giá tham khảo/demo không được hiểu là bảng giá đã xác nhận. Đề xuất không dùng giảm 100% trong bộ hàng thường; đây là quy ước dữ liệu, schema vẫn cho phép 100%.
- **Ngôn ngữ và đơn vị:** Dùng tiếng Việt nhất quán; giữ đúng tên thương hiệu. Đơn vị label thống nhất g, kg, ml, l, cái, bộ; không nhầm quy cách đóng gói với đơn vị tồn kho.
- **Giới hạn phạm vi quản lý hạn dùng/lô:** Hàng hết hạn dùng theo lô, nhiều đơn vị quy đổi và quản lý batch/lot chưa được thể hiện trong các model `Product`/`InventoryStock` đã đọc; không hứa hỗ trợ bằng `expiryInfo`.

---

## 5. Cách triển khai sau khi được duyệt

1. **Chuẩn bị môi trường:** Xác nhận DB/môi trường đích, nhánh/commit, phạm vi và số lượng Product so với SKU.
2. **Soạn thảo dữ liệu:** Chuẩn bị các sheet Categories, Products, Variants, Images, Sources/Review; thêm InitialStock nếu cần. Kiểm tra trùng với dữ liệu đang có.
3. **Dry-run kiểm thử:** Validate toàn bộ file, resolve danh mục, kiểm tra nguồn/ảnh/giá, báo số Product, SKU, ảnh, phiếu nhập dự kiến và các lỗi. Chưa ghi DB.
4. **Thử nghiệm quy mô nhỏ:** Thử một batch nhỏ gồm `SIMPLE` và `VARIANT` bằng cùng luồng nghiệp vụ sẽ dùng cho import; đối soát Product–Variant–InventoryItem và khả năng chạy lại.
5. **Thực thi import an toàn:** Import tuần tự hoặc giới hạn đồng thời, có manifest lưu kết quả từng record và payload hash. Dùng `Idempotency-Key` riêng cho từng thao tác, ổn định khi retry cùng payload; không dùng chung key giữa tạo Product và nhập kho. Không dựa riêng vào cache idempotency để chống trùng lâu dài.
6. **Khởi tạo tồn kho đúng quy trình:** Muốn có hàng để mua: nhận diện `inventoryItemId` theo SKU, lập phiếu nhập đúng chi nhánh đang `ACTIVE`, lưu `transactionId`. Không set `InventoryStock`/`quantity` trực tiếp từ file Product.
7. **Nghiệm thu toàn diện:** Đúng số master/SKU; không trùng mã; không orphan; đúng danh mục, ảnh, giá và `finalPrice`; hàng `ACTIVE` hiện đúng; `SERVICE_SUPPLY` bị ẩn; hết hàng bị chặn mua; sau nhập kho mua trong tồn được, vượt tồn bị từ chối.
8. **Chống trùng & Rollback:** Chạy lại batch kiểm chứng không thêm Product hoặc phiếu nhập trùng. Chỉ chuyển trạng thái mở bán sau kiểm tra; rollback dựa manifest, không xóa trắng catalog hay giao dịch.

---

## 6. Điểm kỹ thuật cần lưu ý trước import

- **Cơ chế cấp SKU:** Tài liệu `FE-HANDOFF-P0-PRODUCT-CATEGORY.md` có ví dụ gửi SKU tự đặt; `createProduct` hiện tự sinh SKU và bỏ qua SKU đầu vào. Dùng code hiện tại làm căn cứ cho importer.
- **Giới hạn OpenAPI:** OpenAPI `ProductWrite` không nhận `brand`, `species`, `ingredients`, `tags`... Không thể đưa metadata mở rộng vào payload tùy ý.
- **Kiểu dữ liệu nullable:** `ProductWrite` `origin`/`expiryInfo` là string khi gửi; không dùng `null` dù model/response có thể là `null`. `CategoryWrite` `parentId` cũng không khai báo nullable: danh mục gốc bỏ field.
- **Kiểm soát số lượng ảnh:** `Product.images` không có `maxItems` ở model/contract. Upload chỉ giới hạn 10 file/lần, không tự chứng minh mỗi Product có tối đa 10 ảnh; importer phải tự kiểm tra tổng.
- **Tính toàn vẹn khi tạo Product:** `createProduct` tạo `InventoryItem` trước khi save Product, chưa bọc chung transaction. Lỗi cuối quá trình có thể để lại `InventoryItem` chưa được Product tham chiếu; phải tiền kiểm tra và đối soát sau lỗi.
- **Ràng buộc chỉ mục SKU:** `variants.sku` trong Product là index thường; `InventoryItem.sku` unique. Không xem truy vấn check trùng của service là bảo đảm an toàn cho mọi trường hợp import đồng thời.
- **Sinh mã dự phòng:** `generateProductCode` có fallback theo thời gian khi counter/connection lỗi. Import phải yêu cầu MongoDB khỏe, không chạy khi mất kết nối.
- **Middleware Idempotency:** Idempotency middleware cho đi tiếp nếu thiếu key, lưu cache bất đồng bộ và đặt hết hạn 24 giờ. Cần manifest/checkpoint để kiểm soát retry và chống trùng dài hạn.
- **Tính toán tồn kho toàn hệ thống:** `getGlobalStockMap` chỉ lọc theo chi nhánh `ACTIVE` khi tìm thấy ít nhất một chi nhánh `ACTIVE`; nếu không có thì code hiện có thể cộng mọi chi nhánh. Cần có chi nhánh `ACTIVE` hợp lệ và kiểm tra tình huống này riêng.
- **Mapping Inventory ID:** `formatProductVariant` không trả `inventoryItemId`; cần bước mapping bằng SKU qua truy vấn phù hợp/quy trình nội bộ trước khi nhập kho. Không giả định API tạo Product trả field này.
- **Yêu cầu MongoDB Transaction:** Inventory movement dùng MongoDB transaction: DB đích phải hỗ trợ transaction, như replica set/Atlas, nếu triển khai nhập tồn.
- **Hiện trạng DB đích:** Catalog index, dữ liệu hiện có, trạng thái chi nhánh và khả năng tạo/nhập kho chưa được kiểm chứng trên DB đích trong lượt rà soát này.

---

## 7. Các quyết định nhóm trưởng cần chốt

- [ ] **1.** 100–200 là Product master hay tổng SKU? Có chốt phương án 150 Product không?
- [ ] **2.** Duyệt phân bổ nhóm hàng; chỉ `SALE` hay có `SHARED`/`SERVICE_SUPPLY`?
- [ ] **3.** Dữ liệu thật hay demo; nguồn nào được dùng cho nội dung, giá và ảnh?
- [ ] **4.** Có chấp nhận giữ brand/species/thuộc tính mở rộng trong sheet + description, hay cần task schema/API trước?
- [ ] **5.** Duyệt quy tắc gom variant, tên, đơn vị, giá và mức giảm mặc định.
- [ ] **6.** Chỉ tạo catalog hay kèm nhập tồn? Nếu kèm: chi nhánh, lượng từng SKU, đơn vị và lý do nhập.
- [ ] **7.** DB đích và cách bảo toàn dữ liệu đang có; người chịu trách nhiệm nghiệm thu.
- [ ] **8.** Import `INACTIVE` rồi mở bán sau duyệt, hay cho `ACTIVE` ngay?

---

## 8. Nguồn trong nhánh đã kiểm tra

- `src/modules/catalog/models/Product.js`; `Category.js`
- `src/modules/catalog/catalog.service.js`; `skuGenerator.service.js`; `stockAvailability.service.js`; `catalog.routes.js`
- `src/modules/inventory/models/InventoryItem.js`; `InventoryStock.js`
- `src/modules/inventory/inventory.service.js`; `inventory.routes.js`
- `src/modules/upload/upload.service.js`
- `src/middleware/idempotencyMiddleware.js`
- `src/shared/config.js`; `src/app.js`
- `docs/QLSP.md`; `docs/FE-HANDOFF-P0-PRODUCT-CATEGORY.md`
- `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`

> [!NOTE]
> `docs/catalog.xlsx` đã được xem thêm để phân biệt catalog dịch vụ với danh sách hàng bán; không dùng các dòng dịch vụ làm Product bán lẻ.
