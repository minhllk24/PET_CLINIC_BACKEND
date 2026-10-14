# TÀI LIỆU BÀN GIAO BACKEND CHO FRONTEND (HANDOFF ĐỢT 1)
**V/v: Giải quyết toàn bộ 9 điểm phản hồi kỹ thuật trong `feedback_lan1.md`**

---

Chào anh em team Frontend! 👋

Cảm ơn team FE đã review và test rất kỹ lưỡng module Quản lý Sản phẩm, Giỏ hàng và Đơn hàng. Toàn bộ 9 điểm góp ý trong file `feedback_lan1.md` đều rất xác đáng và chuẩn thực tế. 

Phía Backend đã tiếp thu, hoàn thiện logic và triển khai toàn bộ lên nhánh `feat/foundation-v6`. Tài liệu này được viết theo văn phong tự nhiên, ngắn gọn và trực quan nhất để anh em FE nắm rõ các điểm mới, cách dùng và các lưu ý khi tích hợp UI.

---

## 📌 TÓM TẮT NHANH CÁC THAY ĐỔI DÀNH CHO FE

Tin vui là: **Hầu hết các logic phức tạp đã được Backend xử lý ngầm (tự động 100%)**. Phía FE không cần sửa đổi lớn mà chỉ cần lưu ý hiển thị các trường mới trả về:
1. **Giá giỏ hàng**: Đã tự động áp dụng giá sau giảm (`finalPrice`), khách đặt hàng không còn bị tính giá gốc.
2. **Vật tư dịch vụ**: Đã chặn ở cấp độ giỏ hàng/thanh toán; FE yên tâm hiển thị thông báo nếu người dùng lỡ bấm mua.
3. **Mã SKU**: Backend tự sinh chuẩn chỉnh 100% (`SP-XXXXXX-YYY`), FE không cần nhọc công tạo mã SKU thủ công nữa.
4. **Cập nhật biến thể**: FE có thể gửi cập nhật một vài biến thể mà **không lo bị mất các biến thể cũ**.
5. **Ảnh chính**: Gửi mảng ảnh thoải mái, Backend tự đảm bảo luôn có duy nhất một ảnh đại diện `isPrimary: true`.
6. **Bộ lọc & Phân trang**: Lọc sản phẩm còn hàng (`inStockOnly=true`) trả về `totalItems` chuẩn xác 100%, không bị lệch trang.
7. **Thời gian**: Đã bổ sung `createdAt`, `updatedAt` định dạng chuẩn ISO để FE hiển thị ngày tạo, ngày sửa trên bảng quản trị.
8. **Đơn hàng**: Đã lưu kèm `skuSnapshot` để xem lại lịch sử đơn hàng mà không phụ thuộc vào sản phẩm sau này có đổi hay xóa.
9. **Sản phẩm cũ**: Backend tự động nâng cấp và cấp mã `productCode` ngầm, không gây lỗi hệ thống.

---

## 🔍 CHI TIẾT TỪNG MỤC VÀ HƯỚNG DẪN DÀNH CHO FE

---

### 1. Giá khuyến mại trong Giỏ hàng (Cart)
* **Trước đây**: Khi thêm sản phẩm vào giỏ, hệ thống chỉ lấy `variant.price` (giá gốc), khiến khách hàng không được hưởng mức giá ưu đãi đã cấu hình.
* **Hiện tại Backend đã xử lý**: 
  * Khi gọi API `POST /api/v1/cart/items` (hoặc sửa số lượng), Backend ưu tiên dùng `variant.finalPrice` (nếu không có giảm giá thì mới dùng `variant.price`).
* **Lưu ý cho FE**:
  * FE hiển thị giỏ hàng không cần phải tự tính lại `finalPrice` ở client nữa. Tiền món hàng trong Cart đã là giá chuẩn sau ưu đãi.

---

### 2. Vật tư dịch vụ nội bộ (`SERVICE_SUPPLY`)
* **Trước đây**: Sản phẩm có `usageType: 'SERVICE_SUPPLY'` (chỉ dùng nội bộ ở phòng khám như kim tiêm, cồn sát khuẩn, thuốc gây mê) đã bị ẩn khỏi danh sách bán lẻ, nhưng nếu ai đó biết ID và gọi API mua hàng thì hệ thống vẫn cho mua.
* **Hiện tại Backend đã xử lý**:
  * Backend bổ sung tầng bảo vệ: Nếu cố tình gọi thêm sản phẩm `SERVICE_SUPPLY` vào Cart hoặc mua trực tiếp, Backend sẽ trả về lỗi:
    * **HTTP Status**: `422 Unprocessable Entity`
    * **Error Code**: `PRODUCT_NOT_PURCHASABLE`
    * **Message**: *"Vật tư dịch vụ nội bộ (SERVICE_SUPPLY) không được phép bán lẻ hoặc thêm vào giỏ hàng"*.
* **Lưu ý cho FE**:
  * Nếu bắt gặp mã lỗi `PRODUCT_NOT_PURCHASABLE`, FE chỉ cần hiển thị Toast thông báo: *"Sản phẩm này là vật tư dùng cho dịch vụ, không bán lẻ trực tiếp"*.

---

### 3. Sinh mã SKU tự động - Chống trùng lặp khi nhiều người thao tác cùng lúc
* **Trước đây**: Nếu hai quản trị viên cùng lúc mở form thêm biến thể cho 1 sản phẩm và bấm Lưu, hệ thống có thể sinh ra cùng một mã SKU khiến người thứ hai bị báo lỗi trùng lặp (Conflict).
* **Hiện tại Backend đã xử lý**:
  * Backend đã chuyển sang cơ chế tăng số thứ tự trực tiếp trên MongoDB (`$inc` nguyên tử).
  * Đảm bảo dù 10 hay 100 người cùng bấm Lưu tại cùng một giây thì mỗi biến thể luôn nhận được một mã SKU riêng biệt và duy nhất.

---

### 4. Cập nhật biến thể không lo mất biến thể cũ (`updateProduct`)
* **Trước đây**: Khi gọi `PATCH /api/v1/products/:id`, nếu FE chỉ gửi mảng `variants` chứa 1 biến thể (ví dụ chỉ muốn sửa giá biến thể Size S), Backend trước đây sẽ ghi đè và làm mất các biến thể còn lại (Size M, Size L).
* **Hiện tại Backend đã xử lý**:
  * Backend áp dụng cơ chế **Merge thông minh theo ID**:
    * Biến thể nào có `id` trùng với biến thể cũ: Backend cập nhật các thông tin mới (giá, giảm giá, tên, ảnh...).
    * Biến thể cũ nào **không có trong danh sách gửi lên**: Backend **giữ nguyên vẹn**, tuyệt đối không xóa.
    * Biến thể nào chưa có `id`: Backend hiểu là biến thể mới và tự động thêm vào.
* **Lưu ý cho FE**:
  * FE có thể gửi toàn bộ hoặc chỉ gửi đúng những biến thể cần cập nhật. Tuy nhiên, lưu ý quy tắc nghiệp vụ: **Mã SKU của biến thể đã tạo là bất biến (không cho phép sửa lại chuỗi SKU)**.

---

### 5. Chuẩn hóa duy nhất 1 ảnh chính (`isPrimary: true`)
* **Trước đây**: Khi gửi danh sách ảnh, có trường hợp xảy ra 2 ảnh cùng mang cờ `isPrimary: true`, khiến giao diện lúng túng không biết ảnh nào là đại diện.
* **Hiện tại Backend đã xử lý**:
  * Backend đặt bộ lọc tự động:
    * Nếu FE gửi nhiều ảnh có `isPrimary: true`, Backend sẽ giữ ảnh đầu tiên là `true`, các ảnh sau tự động chuyển về `false`.
    * Nếu FE không đánh dấu ảnh nào là `true` (toàn bộ là `false`), Backend sẽ tự động lấy ảnh đầu tiên làm ảnh đại diện (`true`).
* **Lưu ý cho FE**:
  * Trên giao diện tải ảnh, FE chỉ cần cho người dùng chọn radio button hoặc click chọn 1 ảnh làm ảnh chính. Backend luôn bảo đảm trong DB chỉ có đúng 1 ảnh chính.

---

### 6. Bộ lọc sản phẩm còn hàng (`inStockOnly`) & Tổng tồn kho
* **Trước đây**: Khi truyền `inStockOnly=true`, Backend đếm tổng sản phẩm trước rồi mới lọc tồn kho sau, dẫn tới trường `totalItems` (tổng số bản ghi) bị đếm cả hàng hết, làm cho thanh phân trang (pagination) hiển thị sai số trang.
* **Hiện tại Backend đã xử lý**:
  * Backend lọc trực tiếp ở tầng Database: Chỉ đếm những sản phẩm đang thực sự còn tồn kho khả dụng (`quantity > 0` tại các chi nhánh đang hoạt động).
  * `totalItems` trả về giờ đây chính xác 100%.
  * Trường `totalStock` (tổng tồn kho) luôn được trả về dưới dạng số nguyên (mặc định là `0` nếu hết hàng).

---

### 7. Ngày tạo & Ngày cập nhật (`createdAt`, `updatedAt`)
* **Trước đây**: FE cần hiển thị ngày tạo và ngày sửa đổi trên bảng danh sách Admin nhưng API chưa trả về.
* **Hiện tại Backend đã xử lý**:
  * API chi tiết và danh sách sản phẩm hiện đã trả về đầy đủ:
    ```json
    {
      "id": "670d...",
      "productCode": "SP-000001",
      "name": "Pate cho mèo Royal Canin",
      "totalStock": 150,
      "createdAt": "2026-10-14T08:30:00.000Z",
      "updatedAt": "2026-10-14T12:15:00.000Z"
    }
    ```
  * Cả hai hợp đồng OpenAPI v6 và v7 đều đã được cập nhật nên validator không chặn.

---

### 8. Mã SKU chuẩn hóa tự động & Snapshot lịch sử đơn hàng
* **Cơ chế SKU**:
  * Khi tạo sản phẩm hoặc thêm biến thể, Backend **tự sinh 100%** theo định dạng chuẩn: `SP-XXXXXX-YYY` (Ví dụ: `SP-000025-001`, `SP-000025-002`...).
  * FE không cần dựng form cho người dùng tự gõ SKU (hoặc có thể để trường SKU ở dạng `read-only` để tránh gõ sai định dạng).
* **Lịch sử đơn hàng**:
  * Mỗi dòng sản phẩm trong đơn hàng ([OrderLine](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml#L10625)) hiện đã có trường `skuSnapshot`.
  * Khi xem lại chi tiết đơn hàng cũ, FE có thể hiển thị mã SKU lúc mua mà không sợ sản phẩm trong kho sau này bị sửa hay xóa.

---

### 9. Khả năng tương thích cho sản phẩm cũ (Migration)
* Các sản phẩm cũ trong hệ thống (chưa có mã `productCode`):
  * Backend đã bổ sung cơ chế tự động quét và cấp mã `productCode` khi server khởi động.
  * Đồng thời, nếu người dùng click xem chi tiết hoặc sửa một sản phẩm cũ, Backend sẽ tự động phát hiện và cấp ngay mã `productCode` theo chuẩn `SP-XXXXXX` mà không làm gián đoạn bất kỳ thao tác nào của người dùng.

---

## 🛠️ DANH SÁCH API CẦN NHỚ CHO FE

| Chức năng | Phương thức & URL | Ghi chú cho FE |
|---|---|---|
| Danh sách sản phẩm | `GET /api/v1/products?inStockOnly=true&limit=20` | `totalItems` đã chuẩn xác; có `createdAt`, `updatedAt`, `totalStock`. |
| Chi tiết sản phẩm | `GET /api/v1/products/:id` | Trả về thông tin đầy đủ, đảm bảo luôn có duy nhất 1 ảnh `isPrimary: true`. |
| Tạo sản phẩm mới | `POST /api/v1/products` | Không cần gửi `sku`, Backend tự sinh chuẩn `SP-XXXXXX-YYY`. |
| Cập nhật sản phẩm | `PATCH /api/v1/products/:id` | Có thể gửi một phần danh sách biến thể, biến thể cũ không bị mất. |
| Thêm biến thể mới | `POST /api/v1/products/:id/variants` | Tự động tăng sequence an toàn, không bị xung đột. |
| Thêm vào giỏ hàng | `POST /api/v1/cart/items` | Tự động lưu giá sau giảm (`finalPrice`); chặn mua `SERVICE_SUPPLY`. |
| Xem đơn hàng | `GET /api/v1/orders/:id` | Mỗi item có `skuSnapshot` và `nameSnapshot`. |

---

Team Backend đã chạy toàn bộ **55/55 ca kiểm thử tự động (Unit & Integration Tests)** đều đạt 100% và biên dịch code sạch sẽ.

Anh em FE pull nhánh `feat/foundation-v6` về để ghép nối giao diện nhé. Nếu có bất kỳ câu hỏi nào trong quá trình tích hợp, hãy thông báo lại để Backend hỗ trợ ngay! 🚀
