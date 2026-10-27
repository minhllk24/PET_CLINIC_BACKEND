# KẾ HOẠCH TRIỂN KHAI: SERVER-SIDE SEARCH / FILTER / SORT (PRIORITY P1)

## 1. MỤC TIÊU VÀ ĐIỀU KIỆN DONE
- **Mục tiêu:** Xây dựng cơ chế tìm kiếm, lọc đa tiêu chí (multi-filter), sắp xếp (sort) và phân trang (pagination) 100% tại tầng Database (MongoDB) trước khi áp dụng `skip/limit`. Cung cấp API gợi ý tìm kiếm (search suggestions) từ dữ liệu thật.
- **Tiêu chí DONE:** 
  1. Cùng một query parameters luôn cho ra tập kết quả và phân trang nhất quán, không phụ thuộc vào dữ liệu client đã tải trước đó.
  2. Không có bất kỳ logic filter nào diễn ra trong bộ nhớ sau khi đã phân trang (loại bỏ hoàn toàn bug filter RAM trên page đã slice).
  3. Search suggestions khi input rỗng (`q=""`) trả về `[]` rỗng, không sinh keyword giả/mock. Khi có `q`, query dữ liệu thật từ Product & Service.
  4. Đầy đủ MongoDB index cho các trường filter/sort tần suất cao.
  5. Đạt 100% unit tests pass, không vỡ bất kỳ test suite nào sẵn có.

---

## 2. PHÂN TÍCH HIỆN TRẠNG & CÁC VẤN ĐỀ CẦN KHẮC PHỤC

### 2.1. Product Catalog (`/api/v1/products` & `/api/v1/catalog/products`)
- **Hiện trạng:**
  - Đã có query params: `q`, `categoryId`, `status`, `usageType`, `minPrice`, `maxPrice`, `inStockOnly`, `sort`, `page`, `limit`, `cursor`.
- **Lỗ hổng / Điểm cần sửa:**
  - **Bug tồn kho sau phân trang:** `attachOutOfStockFlag` đang tính toán tồn kho sau query, và dòng `if (filterInStock) enriched = enriched.filter((p) => !p.outOfStock)` đang loại bỏ sản phẩm sau khi đã `limit(parsedLimit + 1)`. Điều này khiến trang hiện tại bị hụt số lượng item và `totalItems` không khớp!
  - **Khắc phục:** Query trực tiếp tồn kho khả dụng từ `InventoryStock` để lấy tập `inventoryItemId` > 0, inject vào filter Mongo `{ 'variants.inventoryItemId': { $in: inStockItemIds } }` và `countDocuments(query)` trước khi phân trang.
  - **Chuẩn hóa Sort:** Hỗ trợ rõ ràng 5 options:
    - `NEWEST` $\rightarrow$ `{ createdAt: -1, _id: -1 }`
    - `NAME_ASC` $\rightarrow$ `{ name: 1, _id: 1 }`
    - `NAME_DESC` $\rightarrow$ `{ name: -1, _id: -1 }`
    - `PRICE_ASC` $\rightarrow$ `{ 'variants.price': 1, _id: 1 }`
    - `PRICE_DESC` $\rightarrow$ `{ 'variants.price': -1, _id: -1 }`
  - **Multi-filter:** Hỗ trợ nhiều `categoryId` (comma-separated: `cat1,cat2`), khoảng giá (`minPrice`, `maxPrice`), `createdWithinDays`.

### 2.2. Service Catalog (`/api/v1/services` & `/api/v1/catalog/services`)
- **Hiện trạng:**
  - Query params: `bookingMode`, `requiredStaffRole`, `category`, `status`, `search`, `branchId`, `isAvailable`, `limit`, `page`, `cursor`.
- **Lỗ hổng kiến trúc nghiêm trọng:**
  - `isAvailable` hiện đang filter trong RAM:
    ```javascript
    formattedItems = formattedItems.filter((item) => item.isAvailable === targetAvailable);
    ```
    Điều này khiến `totalItems` sai lệch và nếu trang có 20 items mà chỉ 2 items available tại chi nhánh, client chỉ nhận được 2 items dù các trang sau còn rất nhiều items thỏa mãn!
  - `listServices` đang sort cố định `{ _id: 1 }`, chưa có tham số `sort` để người dùng sắp xếp theo giá, tên hoặc thời lượng.
- **Khắc phục:**
  - Nếu query có `branchId` và `isAvailable !== undefined`:
    - Pre-query từ `BranchServiceConfig`: tìm danh sách `serviceId` có `{ branchId, enabled: isAvailable === 'true' || isAvailable === true }`.
    - Gán điều kiện `{ _id: { $in: matchedServiceIds } }` (hoặc `$nin` nếu `isAvailable=false` và không có config) vào Mongo `filter`.
    - Thực hiện `countDocuments(filter)` và `Service.find(filter)` sau khi đã lọc đầy đủ điều kiện!
  - Bổ sung tham số `sort` cho Service:
    - `NAME_ASC` $\rightarrow$ `{ name: 1, _id: 1 }`
    - `NAME_DESC` $\rightarrow$ `{ name: -1, _id: -1 }`
    - `PRICE_ASC` $\rightarrow$ `{ basePrice: 1, _id: 1 }`
    - `PRICE_DESC` $\rightarrow$ `{ basePrice: -1, _id: -1 }`
    - `DURATION_ASC` $\rightarrow$ `{ durationMinutes: 1, _id: 1 }`
    - `DURATION_DESC` $\rightarrow$ `{ durationMinutes: -1, _id: -1 }`

### 2.3. Search Suggestions Endpoint (`/api/v1/search/suggestions`)
- **Yêu cầu cốt lõi:**
  - **Input rỗng (`!q || !q.trim()`):** Trả về `[]` (mảng rỗng), tuyệt đối **không fake keyword mặc định**!
  - **Input có text:**
    - Tìm kiếm sản phẩm thật: `Product.find({ name: regex, status: 'ACTIVE' }).select('name productCode')` (tối đa N kết quả).
    - Tìm kiếm dịch vụ thật: `Service.find({ name: regex, status: 'ACTIVE' }).select('name code serviceType')` (tối đa N kết quả).
    - Tìm kiếm danh mục thật: `Category.find({ name: regex, status: 'ACTIVE' }).select('name slug')`.
    - Ghép danh sách không trùng lặp, trả về cấu trúc gợi ý chi tiết:
      ```json
      {
        "suggestions": [
          { "keyword": "Cắt tỉa lông chó mèo", "type": "service", "id": "...", "category": "Grooming" },
          { "keyword": "Sữa tắm cho chó lông trắng", "type": "product", "id": "...", "price": 120000 }
        ]
      }
      ```

### 2.4. Unified Search Endpoint (`/api/v1/search`)
- Cung cấp endpoint tìm kiếm tổng hợp:
  - Params: `keyword` (hoặc `q`), `scope` (`all` | `product` | `service`), `page`, `limit`, `sort`, `minPrice`, `maxPrice`, `categoryId`.
  - Phân trang chuẩn xác và trả về facet counts thật từ DB (`counts: { product, service }`).

---

## 3. CHI TIẾT CÁC GIAI ĐOẠN THỰC THI (ACTION PLAN)

### Giai đoạn 1: Database Indexing & Optimization
- **File:** `src/modules/catalog/models/Product.js`
  - Thêm index: `{ status: 1, 'variants.price': 1 }`
  - Thêm index: `{ status: 1, name: 1 }`
- **File:** `src/modules/catalog/models/Service.js`
  - Thêm index: `{ status: 1, name: 1 }`
  - Thêm index: `{ status: 1, basePrice: 1 }`
  - Thêm index: `{ status: 1, durationMinutes: 1 }`
  - Thêm index: `{ status: 1, category: 1 }`
- **File:** `src/modules/branch/models/BranchServiceConfig.js`
  - Đảm bảo compound index: `{ branchId: 1, enabled: 1, serviceId: 1 }`

### Giai đoạn 2: Refactor `listProducts` Server-Side Filtering & Sorting
- **File:** `src/modules/catalog/catalog.service.js`
  - Đảm bảo toàn bộ filter (`inStockOnly`, `categoryId`, `price`, `status`, `q`) được resolve thành MongoDB query filter hoàn chỉnh.
  - Loại bỏ hoàn toàn memory filter sau `limit()`.
  - Đồng bộ `countDocuments(query)` chuẩn xác 100%.
  - Chuẩn hóa sort order theo 5 options đã chốt.

### Giai đoạn 3: Refactor `listServices` Server-Side Filtering & Sorting
- **File:** `src/modules/catalog/serviceCatalog.service.js`
  - Xử lý filter `isAvailable` và `branchId` trước khi gọi `countDocuments` và `Service.find`.
  - Hỗ trợ tham số `sort` (`NAME_ASC`, `NAME_DESC`, `PRICE_ASC`, `PRICE_DESC`, `DURATION_ASC`, `DURATION_DESC`).
  - Đảm bảo số lượng item mỗi page nhất quán và phản ánh đúng `totalItems`.

### Giai đoạn 4: Triển khai Module Search & Suggestions
- **Tạo mới:** `src/modules/search/search.service.js`
  - Hàm `getSearchSuggestions({ q, limit })`:
    - Kiểm tra `!q?.trim()` $\rightarrow$ trả về `[]` ngay lập tức.
    - Chạy song song query DB thật trên `Product`, `Service`, `Category`.
    - Format kết quả và giới hạn `limit`.
  - Hàm `unifiedSearch(params)`:
    - Tìm kiếm tổng hợp theo `scope` (`all`, `product`, `service`).
    - Tính facet count thật từ DB.
- **Tạo mới:** `src/modules/search/search.controller.js`
- **Tạo mới:** `src/modules/search/search.routes.js`
- **Mount vào App:** Gắn `/api/v1/search` vào `src/app.js`.

### Giai đoạn 5: Frontend Synchronization Protocol (FE Sync Guidelines)
- Tạo tài liệu hướng dẫn FE: `docs/FE-GUIDE-SEARCH-FILTER-SORT.md`:
  - Quy tắc đồng bộ Query Parameters lên URL Router.
  - Quy tắc **Reset Page = 1** khi thay đổi bất kỳ filter / sort nào.
  - Xử lý debounce khi gõ search (300ms - 500ms).
  - Không fallback hay hardcode từ khóa giả khi ô tìm kiếm rỗng.

### Giai đoạn 6: Testing & Verification
- **Tạo mới test suite:** `tests/search-filter-sort.test.js`:
  - Test 1: Lọc Product theo multi-category và price range $\rightarrow$ phân trang đồng nhất, `totalItems` đúng.
  - Test 2: Sắp xếp Product (`PRICE_ASC`, `PRICE_DESC`, `NEWEST`, `NAME_ASC`) $\rightarrow$ thứ tự đúng từ DB.
  - Test 3: Lọc Service theo `branchId` + `isAvailable=true/false` $\rightarrow$ lọc hoàn toàn trước pagination, không hụt item giữa trang.
  - Test 4: Sắp xếp Service theo giá và tên.
  - Test 5: Search Suggestions với input rỗng $\rightarrow$ trả về `[]`, không có keyword giả.
  - Test 6: Search Suggestions với từ khóa thực $\rightarrow$ trả về danh sách thực từ DB.
  - Chạy full suite `npm test` đảm bảo toàn bộ 20/20 test suites pass.

---

## 4. SOCRATIC QUESTIONS & CÁC ĐIỂM CẦN XÁC NHẬN
Trước khi bắt đầu viết code, hãy cùng chốt 3 điểm kỹ thuật sau:
1. **Search Suggestions Response Format:** M muốn format trả về là mảng string đơn giản `["Sữa tắm", "Cắt tỉa"]` hay mảng object chi tiết `[{ keyword: "Sữa tắm", type: "product", id: "..." }]`? (Khuyến nghị: Object chi tiết để FE vừa hiển thị vừa có thể click chuyển thẳng đến trang chi tiết sản phẩm/dịch vụ).
2. **Unified Search vs Separate Catalog Search:** M muốn FE dùng 1 thanh search chung toàn trang gọi vào `GET /api/v1/search` (ra cả Product và Service), hay mỗi trang (Shop / Booking) gọi vào endpoint riêng (`/api/v1/products?q=...` và `/api/v1/services?search=...`)? (Khuyến nghị: Hỗ trợ cả 2 để đáp ứng mọi component của FE).
3. **Product Price Sort:** Sản phẩm có nhiều biến thể (`variants`), trường giá hiện tại là `variants.price`. Khi sort `PRICE_ASC` / `PRICE_DESC`, MongoDB sẽ lấy giá trị min/max trong mảng variants của sản phẩm. Cách này đã hoàn toàn khớp với nghiệp vụ của m chưa?
