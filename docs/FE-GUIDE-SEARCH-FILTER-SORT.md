# HƯỚNG DẪN TÍCH HỢP FRONTEND: SERVER-SIDE SEARCH, FILTER & SORT (PRIORITY P1)

Tài liệu này chuẩn hóa quy tắc giao tiếp giữa Frontend (Customer Web / Admin Portal) và Backend Pet Clinic cho tính năng Tìm kiếm, Lọc và Sắp xếp hoàn toàn ở Server-side.

---

## 1. NGUYÊN TẮC VÀNG DÀNH CHO FRONTEND (FE RULES)

> [!IMPORTANT]
> **Quy tắc 1: URL Query Params là Single Source of Truth (SSOT)**
> - Mọi trạng thái filter (`q`, `categoryId`, `minPrice`, `maxPrice`, `sort`, `page`) **PHẢI** được sync trực tiếp lên URL (ví dụ: `/products?category=cat-1&sort=PRICE_ASC&page=1`).
> - Khi user reload trang hoặc copy link gửi người khác, cùng một URL query parameters **luôn** hiển thị cùng một tập dữ liệu và phân trang chính xác.

> [!IMPORTANT]
> **Quy tắc 2: Luôn Reset `page = 1` khi thay đổi Filter / Sort / Search**
> - Bất cứ khi nào user chọn category khác, kéo slider khoảng giá, gõ từ khóa mới, hoặc đổi tiêu chí sắp xếp $\rightarrow$ FE **BẮT BUỘC** gán lại `page = 1` trên URL và request.
> - Nếu không reset về page 1, user đang ở page 5 mà filter mới chỉ có 2 trang kết quả $\rightarrow$ sẽ bị nhận trang rỗng (`items: []`).

> [!IMPORTANT]
> **Quy tắc 3: Debounce khi người dùng gõ phím**
> - Áp dụng `debounce(300ms - 500ms)` trước khi gọi API Search Suggestions hoặc API danh sách sản phẩm/dịch vụ khi người dùng đang nhập text vào ô tìm kiếm.

> [!IMPORTANT]
> **Quy tắc 4: Search Suggestions không sinh keyword giả khi input rỗng**
> - Khi ô tìm kiếm rỗng (`q=""` hoặc chỉ có khoảng trắng) $\rightarrow$ API `/api/v1/search/suggestions` trả về `suggestions: []`.
> - Tuyệt đối không fallback sang từ khóa giả (mock keywords). FE có thể hiển thị lịch sử tìm kiếm gần đây lưu ở `localStorage` của trình duyệt.

---

## 2. CHI TIẾT CÁC ENDPOINT TÌM KIẾM & LỌC

### 2.1. Search Suggestions (Gợi ý từ khóa tự động)
- **Endpoint:** `GET /api/v1/search/suggestions` (hoặc `/api/v1/products/suggestions`, `/api/v1/services/suggestions`)
- **Query Params:**
  - `q` (string, required): Từ khóa đang gõ (ví dụ: `tam`, `cho`, `meo`).
  - `limit` (integer, optional, mặc định 10, tối đa 50).
- **Response mẫu:**
  ```json
  {
    "query": "tam",
    "total": 3,
    "suggestions": [
      {
        "keyword": "Tắm spa và vệ sinh toàn diện chó mèo",
        "type": "service",
        "id": "673f8a...",
        "code": "SRV-SPA-01",
        "category": "Grooming",
        "serviceType": "GROOMING",
        "basePrice": 250000
      },
      {
        "keyword": "Sữa tắm trị ve rận Bio-Care",
        "type": "product",
        "id": "673f8b...",
        "code": "PROD-BIO-01",
        "category": "Vệ sinh thú cưng",
        "price": 115000
      },
      {
        "keyword": "Sữa tắm dưỡng lông",
        "type": "category",
        "id": "673f8c...",
        "slug": "sua-tam-duong-long"
      }
    ]
  }
  ```
- **Hành vi khi click vào suggestion item:**
  - `type: "product"` $\rightarrow$ Router chuyển sang trang chi tiết: `/products/${item.id}`
  - `type: "service"` $\rightarrow$ Router chuyển sang trang đặt lịch/chi tiết dịch vụ: `/services/${item.id}`
  - `type: "category"` $\rightarrow$ Router lọc theo danh mục: `/products?categoryId=${item.id}&page=1`
  - Nhấn Enter $\rightarrow$ Gọi Unified Search: `/search?q=${input}&page=1`

---

### 2.2. Product Catalog Filter & Sort (Trang Cửa hàng / Shop)
- **Endpoint:** `GET /api/v1/products` (hoặc `/api/v1/catalog/products`)
- **Query Params hỗ trợ:**
  - `q`: Từ khóa tìm kiếm theo tên, mã SKU, mô tả.
  - `categoryId`: Lọc theo danh mục. Hỗ trợ multi-category ngăn cách bởi dấu phẩy (`catId1,catId2`).
  - `minPrice`: Giá tối thiểu (VND).
  - `maxPrice`: Giá tối đa (VND).
  - `inStockOnly`: `true` (chỉ hiển thị sản phẩm còn tồn kho khả dụng > 0 trên hệ thống).
  - `sort`:
    - `NEWEST` (Mặc định: mới nhất)
    - `PRICE_ASC` (Giá tăng dần)
    - `PRICE_DESC` (Giá giảm dần)
    - `NAME_ASC` (Tên A $\rightarrow$ Z)
    - `NAME_DESC` (Tên Z $\rightarrow$ A)
  - `page`: Số thứ tự trang (1-indexed, mặc định 1).
  - `limit`: Số item trên mỗi trang (mặc định 20, tối đa 100).
- **Response mẫu:**
  ```json
  {
    "items": [
      {
        "id": "673f...",
        "productCode": "PROD-001",
        "name": "Hạt Cho Chó Con Royal Canin",
        "category": { "id": "...", "name": "Thức ăn chó" },
        "variants": [
          { "id": "...", "sku": "RC-PUPPY-1KG", "price": 180000, "status": "ACTIVE", "availableStock": 15 }
        ],
        "totalStock": 15,
        "outOfStock": false
      }
    ],
    "total": 45,
    "totalItems": 45,
    "page": 1,
    "totalPages": 3,
    "limit": 20,
    "nextCursor": "..."
  }
  ```

---

### 2.3. Service Catalog Filter & Sort (Trang Dịch vụ / Booking)
- **Endpoint:** `GET /api/v1/services` (hoặc `/api/v1/catalog/services`)
- **Query Params hỗ trợ:**
  - `search`: Từ khóa tìm kiếm dịch vụ.
  - `branchId`: ID chi nhánh khách đang chọn.
  - `isAvailable`: `true` (chỉ lấy dịch vụ đang bật và khả dụng tại chi nhánh đã chọn) hoặc `false`.
  - `bookingMode`: `BOOKABLE`, `REQUEST_ONLY`, `CONTACT_ONLY`.
  - `requiredStaffRole`: `CARE_STAFF_GROOMER`, `VETERINARIAN`, `NURSE`.
  - `category`: Nhóm dịch vụ (`Grooming`, `Medical`, `Spa`...).
  - `sort`:
    - `NAME_ASC` / `NAME_DESC`
    - `PRICE_ASC` / `PRICE_DESC`
    - `DURATION_ASC` / `DURATION_DESC`
    - `NEWEST`
  - `page`: Số thứ tự trang (mặc định 1).
  - `limit`: Số item mỗi trang (mặc định 20).
- **Response mẫu:**
  ```json
  {
    "items": [
      {
        "id": "673e...",
        "code": "SRV-GROOM-01",
        "name": "Cắt tỉa lông tạo kiểu thú cưng",
        "serviceType": "GROOMING",
        "basePrice": 300000,
        "durationMinutes": 60,
        "isAvailable": true,
        "availabilityStatus": "AVAILABLE",
        "availabilityText": "Khả dụng",
        "enabledBranchCount": 3,
        "totalBranchCount": 3
      }
    ],
    "total": 12,
    "totalItems": 12,
    "page": 1,
    "totalPages": 1,
    "limit": 20
  }
  ```

---

### 2.4. Unified Search (Thanh tìm kiếm Header toàn trang)
- **Endpoint:** `GET /api/v1/search`
- **Query Params:**
  - `q` (hoặc `keyword`): Từ khóa tìm kiếm.
  - `scope`: `all` (cả sản phẩm và dịch vụ), `product`, hoặc `service`.
  - `sort`: `relevance`, `price_asc`, `price_desc`, `name_asc`, `newest`.
  - `page`: Số trang.
  - `limit`: Giới hạn kết quả.
- **Response mẫu khi `scope=all`:**
  ```json
  {
    "query": "ve rận",
    "scope": "all",
    "totalRows": 6,
    "totalPages": 1,
    "page": 1,
    "limit": 10,
    "counts": {
      "product": 4,
      "service": 2
    },
    "results": {
      "products": [ ... ],
      "services": [ ... ]
    }
  }
  ```

---

## 3. CHECKLIST KIỂM THỬ GIAO DIỆN (FE QA CHECKLIST)

| STT | Kịch bản kiểm thử | Kỳ vọng |
|:---:|---|---|
| 1 | Người dùng đang ở Trang 3, bấm lọc sang Category khác | URL đổi thành `category=...&page=1`, API gọi với `page=1`. |
| 2 | Người dùng đang ở Trang 2, chọn Sort "Giá tăng dần" | URL đổi thành `sort=PRICE_ASC&page=1`, danh sách hiển thị đúng từ rẻ nhất. |
| 3 | Người dùng xóa trắng ô tìm kiếm | Không còn gợi ý fake, dropdown đóng lại hoặc mở lịch sử tìm kiếm gần đây. |
| 4 | Người dùng gõ "tam" | API Suggestions trả về các gợi ý thật (cả sản phẩm lẫn dịch vụ) có chứa chữ "tam". |
| 5 | Chuyển chi nhánh (Branch) và bật "Chỉ xem dịch vụ khả dụng" (`isAvailable=true`) | Danh sách dịch vụ hiển thị đủ 20 items/page (nếu còn dịch vụ), không bị hụt item giữa trang. |
