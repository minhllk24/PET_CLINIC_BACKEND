# Sửa gallery trang chi tiết sản phẩm

Repository frontend nằm ngoài workspace backend. Hai thay đổi dưới đây cần được áp dụng tại frontend rồi kiểm thử trên trình duyệt.

Trong `src/services/productService.js`, đầu hàm `normalizeImageUrl`, thay `if (!value) return value;` bằng:

```js
if (value && typeof value === "object") {
  value = value.url || value.imageUrl || value.image_url;
}
if (typeof value !== "string" || !value.trim()) return "";
value = value.trim();
```

Trong nhánh `source.images.map(normalizeImageUrl)`, thêm `.filter(Boolean)` để bỏ URL rỗng. Việc này cho phép frontend đọc cả mảng URL lẫn mảng `{ url, isPrimary, sortOrder }` từ API.

Trong `src/pages/Product/ProductDetailsPage.jsx`:

- Đổi class của cột thumbnail thành `flex h-[626px] w-[145px] shrink-0 flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-[16px]`.
- Thêm `shrink-0` vào class của nút thumbnail; đổi class ảnh thumbnail từ `h-[194px] w-[141px] object-cover` thành `h-[120px] w-[141px] object-contain`.
- Đổi `object-cover` thành `object-contain` trên ảnh lớn, giữ kích thước hiện tại để ảnh sản phẩm không bị cắt.

Kiểm tra sản phẩm có 1, 2 và nhiều hơn 5 ảnh; chọn thumbnail, cuộn trong cột, kiểm tra ảnh lớn và phần mô tả không chồng lấn. Kiểm tra thêm ở kích thước màn hình dự án hỗ trợ. Backend không thể đảm bảo bố cục frontend bằng việc giới hạn số ảnh.
