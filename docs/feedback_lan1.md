### **Những điểm BE cần sửa hoặc kiểm tra thêm**

Qua kiểm tra code thực tế, mình phát hiện các vấn đề sau:

| Mức độ | Vấn đề | Kết quả kiểm tra |
| ----- | ----- | ----- |
| Cao | Giá khuyến mại trong Cart | Cart đang sử dụng `variant.price`, chưa sử dụng `finalPrice` |
| Cao | Vật tư dịch vụ | API lấy sản phẩm đã ẩn `SERVICE_SUPPLY`, nhưng hàm kiểm tra khi mua chưa chặn loại này |
| Cao | Sinh SKU đồng thời | Counter mã sản phẩm đã dùng thao tác tăng nguyên tử, nhưng số thứ tự SKU của biến thể vẫn cập nhật qua đọc/sửa/lưu Product, có rủi ro tranh chấp khi tạo đồng thời |
| Cao | Cập nhật biến thể | `updateProduct` dựng lại mảng Variant từ request. Nếu gửi thiếu biến thể đã lưu, có nguy cơ làm mất biến thể và liên kết lịch sử |
| Trung bình | Ảnh chính | Logic schema có thể đánh dấu ảnh đầu tiên và một ảnh khác cùng là `isPrimary: true` |
| Trung bình | Phân trang và tổng tồn | Cursor hiện dựa trên `_id` dù sắp xếp theo tên/giá; `totalItems` cũng chưa tính đúng bộ lọc `inStockOnly`. Tổng tồn chỉ cộng Variant ACTIVE |
| Trung bình | Ngày tạo/cập nhật | Model đã có timestamps nhưng `formatProduct` chưa trả `createdAt`, `updatedAt` cho FE |
| Trung bình | SKU và lịch sử | BE vẫn cho truyền SKU thủ công khi tạo mới; OrderItem cũng chưa lưu snapshot SKU rõ ràng như yêu cầu |

Một vấn đề nữa: sản phẩm cũ có thể chưa có `productCode`. BE cần migration hoặc cơ chế tương thích trước khi thêm Variant mới cho các sản phẩm đó.

