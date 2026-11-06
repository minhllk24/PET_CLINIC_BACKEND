# 📋 TÀI LIỆU HƯỚNG DẪN BÀN GIAO TRIỂN KHAI PHÍA FRONTEND (FE HANDOFF)
## Tính năng: Hiển thị 5–10 hình ảnh & Bộ chọn Loại (Biến thể) trên Trang Chi tiết Sản phẩm

> **Dành cho:** Đội ngũ Frontend (FE Team)  
> **Phiên bản Backend:** Đã cập nhật & Triển khai thành công trên MongoDB Atlas (`feat/foundation-v6`)  
> **Ngày lập:** 04/11/2026  

---

### 1. BỐI CẢNH & NGUYÊN NHÂN LỖI TRÊN GIAO DIỆN HIỆN TẠI

Khi deploy và kiểm tra trang chi tiết sản phẩm (`ProductDetailsPage.jsx`), giao diện gặp 3 vấn đề:
1. **Nút "Loại" bị trắng, không có chữ:** Nút chọn biến thể hiển thị một ô chữ nhật rỗng không có nhãn.
   - **Nguyên nhân:** Backend tuân theo chuẩn OpenAPI v6/v7 với schema `ProductVariant`, trong đó tên biến thể được đặt là thuộc tính `label` (`sku`, `label`, `price`, `finalPrice`, `discountPercent`, `status`, `availableStock`). Trong khi đó, file `src/services/productService.js` của FE chỉ lấy `name: getFirstValue(variant.name, variant.variant_name)`, **bỏ quên `variant.label`**, khiến `variant.name` trả về `undefined`.
2. **Không đồng bộ giá khi chọn Loại:** Bấm vào các biến thể khác nhau nhưng giá bán trên tiêu đề vẫn giữ nguyên giá cơ sở `product.price`.
3. **Khung ảnh Thumbnail bị vỡ khi có nhiều ảnh:** Cột thumbnail bên trái trước đây dùng `justify-between` với chiều cao cố định `h-[194px]` cho mỗi ảnh (chỉ phù hợp khi có đúng 2 ảnh). Khi backend trả về từ 5 đến 10 ảnh, các ảnh thumbnail sẽ bị tràn khung.

---

### 2. CÁC FILE CẦN CHỈNH SỬA PHÍA FRONTEND

Phía FE chỉ cần cập nhật đúng **2 file** sau:
1. `src/services/productService.js`
2. `src/pages/Product/ProductDetailsPage.jsx`

---

### 3. HƯỚNG DẪN CODE CHI TIẾT

#### 📁 Bước 1: Cập nhật `src/services/productService.js`

##### 1.1 Sửa hàm `normalizeImageUrl` (Hỗ trợ cả String và Object ảnh)
Tìm hàm `normalizeImageUrl` và cập nhật để bóc tách an toàn thuộc tính `.url` nếu backend trả về dạng object:

```javascript
function normalizeImageUrl(value) {
  if (!value) return "";
  // Xử lý an toàn nếu item là object { id, url, isPrimary, ... }
  if (typeof value === "object") {
    value = value.url || value.imageUrl || value.image_url || "";
  }
  if (!value || typeof value !== "string") return "";
  if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!backendUrl) return value;
  return `${backendUrl.replace(/\/$/, "")}/${String(value).replace(/^\//, "")}`;
}
```

##### 1.2 Sửa hàm `normalizeVariant` (Đọc đúng trường `label` từ Backend)
Tìm hàm `normalizeVariant` và cập nhật cả `name` lẫn `label`:

```javascript
function normalizeVariant(variant) {
  if (!variant) return variant;
  // Bổ sung variant.label từ Backend OpenAPI schema
  const name = getFirstValue(variant.name, variant.variant_name, variant.label, "Tiêu chuẩn");
  const label = getFirstValue(variant.label, variant.name, variant.variant_name, "Tiêu chuẩn");
  return {
    ...variant,
    id: getFirstValue(variant.id, variant.variant_id, variant.sku),
    name,
    label,
    price: getFirstValue(variant.price, 0),
    originalPrice: getFirstValue(variant.originalPrice, variant.original_price),
    stockQuantity: getFirstValue(variant.stockQuantity, variant.stock_quantity, variant.availableStock, 0),
    availableStock: getFirstValue(variant.availableStock, variant.stockQuantity, variant.stock_quantity, 0),
    image: normalizeImageUrl(getFirstValue(variant.image, variant.imageUrl, variant.image_url)),
    sizes: Array.isArray(variant.sizes) ? variant.sizes : [],
  };
}
```

---

#### 📁 Bước 2: Cập nhật `src/pages/Product/ProductDetailsPage.jsx`

##### 2.1 Cập nhật Khung Thumbnails cuộn dọc (Hỗ trợ mượt mà từ 5 đến 10 ảnh)
Tìm khối `{/* Thumbnails */}` (khoảng dòng 392) và thay bằng code cuộn dọc với kích thước ô `94x94px`:

```jsx
{/* Thumbnails hỗ trợ 5 - 10 ảnh cuộn dọc mượt mà */}
<div className="flex h-[626px] w-[110px] shrink-0 flex-col gap-[10px] overflow-y-auto pr-1 no-scrollbar scroll-smooth">
  {thumbnails.map((thumb, i) => (
    <button
      key={i}
      type="button"
      onClick={() => setSelectedImageIdx(i)}
      onMouseEnter={() => setThumbHovered(i)}
      onMouseLeave={() => setThumbHovered(null)}
      className={`group relative h-[94px] w-[94px] shrink-0 overflow-hidden rounded-[8px] transition-all duration-micro focus-ring-brand focus-visible:ring-2 focus-visible:ring-[#0D47A1] ${
        i === selectedImageIdx
          ? "border-2 border-[#0D47A1] shadow-[0_0_0_1px_#0D47A1]"
          : thumbHovered === i
            ? "border-2 border-[#90CAF9] shadow-sm"
            : "border border-[#E0E0E0]"
      }`}
      aria-label={`Xem ảnh ${i + 1}`}
      aria-current={i === selectedImageIdx ? "true" : undefined}
    >
      <img
        src={thumb}
        alt=""
        className={`h-full w-full object-cover transition-opacity duration-micro ${
          i !== selectedImageIdx && thumbHovered !== i ? "opacity-70 group-hover:opacity-90" : "opacity-100"
        }`}
      />
    </button>
  ))}
</div>
```

##### 2.2 Đồng bộ hiển thị Giá bán theo Biến thể đang chọn
Tìm khối hiển thị giá (khoảng dòng 441) và tính giá dựa trên `selectedTypeIdx`:

```jsx
{(() => {
  const activeVariant = product?.variants?.[selectedTypeIdx];
  const activePrice = activeVariant?.price ?? product.price;
  const activeOriginalPrice = activeVariant?.originalPrice ?? product.originalPrice;
  const activeDiscountPercent = activeVariant?.discountPercent ?? (activeOriginalPrice > activePrice && activePrice > 0 ? Math.round((1 - activePrice / activeOriginalPrice) * 100) : product.discountPercent);
  
  return (
    <div className="flex items-center gap-[10px]">
      <span className="font-['Roboto'] text-[32px] font-normal leading-[39.52px] tracking-[0.25px] text-[#D32F2F]">
        {formatPrice(activePrice)}
      </span>
      {activeOriginalPrice > activePrice && (
        <>
          <span className="font-['Roboto'] text-[24px] font-normal leading-[32.02px] text-[rgba(0,0,0,0.38)] line-through">
            {formatPrice(activeOriginalPrice)}
          </span>
          <span className="inline-flex h-[21px] w-[50px] items-center justify-center rounded-[40px] bg-[#D32F2F] font-['Roboto'] text-[12px] font-bold leading-[19.92px] tracking-[0.4px] text-white">
            -{activeDiscountPercent}%
          </span>
        </>
      )}
    </div>
  );
})()}
```

##### 2.3 Hiển thị danh sách nút chọn "Loại" (Variants)
Tìm khối `{/* Type selection */}` (khoảng dòng 476) và thay bằng:

```jsx
{/* Type selection - Hiển thị tên biến thể rõ ràng */}
{Array.isArray(product.variants) && product.variants.length > 0 && (
  <div className="flex items-start gap-[20px] pb-7">
    <span className="pt-[8px] font-['Roboto'] text-[18px] font-medium leading-[26px] tracking-[0.15px] text-[#1D2939]">
      Loại
    </span>
    <div className="flex flex-wrap gap-[12px] max-w-[420px]">
      {product.variants.map((variant, i) => {
        const variantLabel = variant.name || variant.label || `Loại ${i + 1}`;
        const isSelected = i === selectedTypeIdx;
        return (
          <button
            key={variant.id ?? variant.sku ?? `${variantLabel}-${i}`}
            type="button"
            onClick={() => {
              setSelectedTypeIdx(i);
              setDropdownValue(variant.sizes?.[0] ?? "");
              if (variant.image) {
                const matchIdx = thumbnails.findIndex((img) => img === variant.image);
                if (matchIdx !== -1) setSelectedImageIdx(matchIdx);
              }
            }}
            className={`group min-h-[44px] min-w-[84px] px-[16px] py-[8px] rounded-[10px] flex items-center justify-center transition-all duration-micro focus-ring-brand active:scale-95 ${
              isSelected
                ? "border-2 border-[#0D47A1] bg-[#E3F2FD] shadow-[0_0_0_1px_#0D47A1]"
                : "border border-[#D7D7D7] bg-[#F8F9FA] hover:border-[#90CAF9] hover:bg-[#F2F4F7]"
            }`}
            aria-pressed={isSelected}
          >
            <span className={`font-['Roboto'] text-[14px] font-semibold leading-[20px] ${
              isSelected ? "text-[#0D47A1]" : "text-[#1D2939]"
            }`}>
              {variantLabel}
            </span>
          </button>
        );
      })}
    </div>
  </div>
)}
```

##### 2.4 Cập nhật trường `type` trong Giỏ hàng
Trong hai hàm `handleAddToCart` và `handleBuyNow`, đảm bảo truyền:
```javascript
type: variant?.name || variant?.label || "Tiêu chuẩn",
```

---

### 4. DỮ LIỆU MẪU TỪ BACKEND API ĐỂ KIỂM THỬ

Khi gọi API `GET /api/v1/products/:id` hoặc `GET /api/v1/products/SP-LEG-099`, Backend sẽ trả về cấu trúc chuẩn:

```json
{
  "productCode": "SP-LEG-099",
  "name": "Thức ăn cho chó hữu cơ NATURAL CORE Multi Protein Chicken Salmon",
  "productType": "VARIANT",
  "images": [
    { "id": "img-1", "url": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-multi-protein-chicken-salmon.jpg", "isPrimary": true, "sortOrder": 0 },
    { "id": "img-2", "url": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-multi-protein-chicken-salmon2.jpg", "isPrimary": false, "sortOrder": 1 },
    { "id": "img-3", "url": "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&q=80", "isPrimary": false, "sortOrder": 2 },
    { "id": "img-4", "url": "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80", "isPrimary": false, "sortOrder": 3 },
    { "id": "img-5", "url": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&q=80", "isPrimary": false, "sortOrder": 4 },
    { "id": "img-6", "url": "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=800&q=80", "isPrimary": false, "sortOrder": 5 }
  ],
  "variants": [
    {
      "sku": "SP-LEG-099-01",
      "label": "Túi 1kg",
      "price": 290000,
      "discountPercent": 0,
      "finalPrice": 290000,
      "status": "ACTIVE"
    },
    {
      "sku": "SP-LEG-099-02",
      "label": "Túi 2.4kg",
      "price": 638000,
      "discountPercent": 5,
      "finalPrice": 606000,
      "status": "ACTIVE"
    },
    {
      "sku": "SP-LEG-099-03",
      "label": "Bao 6kg",
      "price": 1392000,
      "discountPercent": 10,
      "finalPrice": 1253000,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 5. CHECKLIST KIỂM THỬ TRƯỚC KHI BÀN GIAO (FE CHECKLIST)

- [ ] Nút chọn "Loại" hiển thị đúng tên (`Túi 1kg`, `Túi 2.4kg`, `Bao 6kg`...). Không còn nút trắng rỗng.
- [ ] Bấm chọn các biến thể khác nhau: giá trên màn hình thay đổi tương ứng.
- [ ] Cột ảnh thumbnail bên trái hiển thị đủ 6 ảnh, cuộn mượt mà, hover/click đổi ảnh lớn chính xác.
- [ ] Thêm vào giỏ hàng (`Thêm vào giỏ` hoặc `Mua ngay`) nhận đúng biến thể và đơn giá đã chọn.
- [ ] Chạy `npm run build` trên Frontend không phát sinh lỗi cú pháp hay TypeScript/Vite error.

