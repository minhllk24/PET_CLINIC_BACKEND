Minh với Thái ơi, t tổng hợp lại toàn bộ các yêu cầu Backend cần bổ sung và hoàn thiện cho **Task 3.6 – Product / Category Management của WEB-2** nhé.

Hiện tại bên FE Angular đã triển khai các màn theo Figma:

* Quản lý danh mục sản phẩm.  
* Danh sách sản phẩm hiện tại.  
* Danh sách sản phẩm đã lưu trữ.  
* Thêm sản phẩm (không có biến thể / có biến thể).  
* Chỉnh sửa sản phẩm.  
* Lưu trữ và khôi phục sản phẩm.  
* Giao diện tải ảnh, xem trước, chọn ảnh chính, thay và xóa ảnh.

Các API CRUD cơ bản đã được tích hợp. Tuy nhiên, một số chức năng hiện chưa thể lưu dữ liệu thực tế hoặc chưa có đủ contract từ BE.

Dưới đây là các yêu cầu để hoàn thiện chức năng Product Management. Những API đã có thì chỉ cần hoàn thiện phần còn thiếu, không cần xây dựng lại.

---

# **I. ƯU TIÊN CAO – CÁC CHỨC NĂNG CẦN BỔ SUNG**

## **1\. Tự động sinh mã sản phẩm và SKU**

### **A. Quy tắc sinh mã**

Sử dụng cấu trúc:

`SP-{Mã sản phẩm}-{Số thứ tự SKU}`

Ví dụ:

Sản phẩm: Royal Canin Poodle

Mã sản phẩm: `SP-000123`

| Biến thể | SKU |
| ----- | ----- |
| 500g | `SP-000123-001` |
| 1.5kg | `SP-000123-002` |
| 2.5kg | `SP-000123-003` |

Với sản phẩm không có biến thể, hệ thống vẫn tạo một SKU có hậu tố `001`.

Ví dụ:

* Không biến thể: `SP-000124-001`.  
* Có biến thể: `SP-000125-001`, `SP-000125-002`, ...

### **B. Business Rules**

**SKU-01:** BE tự động sinh mã sản phẩm và SKU khi tạo Product thành công. FE không tự sinh SKU chính thức.

**SKU-02:** Mỗi SKU phải duy nhất trên toàn hệ thống, không phân biệt chi nhánh.

**SKU-03:** Sản phẩm `SIMPLE` có đúng một SKU.

**SKU-04:** Sản phẩm `VARIANT` có SKU riêng cho từng biến thể.

**SKU-05:** Không cho phép chỉnh sửa SKU thủ công sau khi đã tạo.

**SKU-06:** Thêm biến thể mới sẽ cấp số thứ tự tiếp theo, không đánh lại các SKU cũ.

**SKU-07:** SKU đã ngừng sử dụng hoặc lưu trữ không được tái sử dụng.

**SKU-08:** Đổi tên sản phẩm, danh mục, giá hoặc thuộc tính biến thể không làm đổi SKU.

**SKU-09:** SKU đã liên kết với Kho, Đơn hàng hoặc giao dịch lịch sử phải được giữ nguyên.

Ví dụ:

Sản phẩm `SP-000123` đã có SKU `001`, `002`, `003`.

Sau khi ngừng sử dụng biến thể `002`, nếu thêm biến thể mới thì SKU phải là `SP-000123-004`, không được cấp lại `002`.

### **C. Yêu cầu kỹ thuật/API**

1. `POST /api/v1/products`: Không bắt FE gửi SKU, BE tự sinh `productCode` và SKU.  
2. `POST /api/v1/products/:id/variants`: Tự động cấp SKU tiếp theo.  
3. `GET /api/v1/products`: Trả mã sản phẩm và thông tin SKU.  
4. `GET /api/v1/products/:id`: Trả `productCode` và đầy đủ SKU từng biến thể.  
5. Lưu mã đã cấp và số thứ tự tiếp theo để không tái sử dụng SKU.  
6. Đảm bảo cấp mã an toàn khi nhiều request thực hiện đồng thời.  
7. Không lấy tên, danh mục hoặc trọng lượng để tạo SKU.  
8. Đảm bảo InventoryItem liên kết đúng SKU được cấp.  
9. Những SKU cũ như `PDF-2KG`, `RCP-500G` vẫn giữ nguyên, không tự động đổi mã nếu đã tồn tại.

### **D. Hiển thị FE**

* Thêm sản phẩm: `Tự động tạo khi lưu`.  
* Biến thể chưa lưu: `Chưa tạo`.  
* Chỉnh sửa sản phẩm: Hiển thị SKU thực tế, chỉ đọc.  
* Danh sách: Hiển thị SKU hoặc số biến thể và danh sách SKU tương ứng.

BE chịu trách nhiệm sinh mã và bảo đảm tính duy nhất.

---

## **2\. Upload và quản lý hình ảnh sản phẩm**

Hiện tại FE đã có đầy đủ giao diện chọn ảnh từ máy theo Figma, nhưng chưa có API upload để lưu ảnh thực tế.

### **A. Yêu cầu upload**

1. Hỗ trợ JPG và PNG.  
2. Tối đa 10 ảnh/sản phẩm.  
3. Tối đa 5MB/ảnh.  
4. Cho phép tải nhiều ảnh.  
5. Trả về URL hoặc ID ảnh sau khi upload thành công.  
6. Hỗ trợ thêm, thay thế và xóa ảnh.  
7. Chỉ có duy nhất một ảnh chính (Primary Image).  
8. Lưu thứ tự hiển thị ảnh.  
9. Ảnh phải tồn tại sau khi reload trang hoặc deploy lại hệ thống.  
10. Trả lỗi rõ ràng khi sai định dạng, quá dung lượng hoặc upload thất bại.

### **B. Quản lý ảnh**

BE cần hỗ trợ:

* Thêm ảnh mới vào sản phẩm đã tồn tại.  
* Thay thế ảnh hiện tại.  
* Xóa hoặc bỏ liên kết ảnh khỏi sản phẩm.  
* Chọn ảnh chính.  
* Cập nhật thứ tự ảnh.  
* Trả danh sách ảnh khi GET Product.

Thông tin ảnh cần có tối thiểu:

* `id`  
* `url`  
* `isPrimary`  
* `sortOrder`

Nếu vẫn sử dụng `images: string[]` như API hiện tại thì BE cần bổ sung contract phù hợp để FE xác định ảnh chính và thứ tự.

### **C. API**

Có thể sử dụng API upload dùng chung hoặc bổ sung các endpoint như:

* `POST /api/v1/uploads/products`  
* `DELETE /api/v1/uploads/products/:imageId`

Đây chỉ là gợi ý endpoint. Team BE có thể sử dụng kiến trúc lưu trữ ảnh hiện tại.

Yêu cầu quan trọng là FE upload được file thật, nhận kết quả và lưu ảnh vào Product.

---

## **3\. Hình ảnh riêng cho từng biến thể**

Hiện trên Figma, mỗi biến thể có một ô tải ảnh riêng nhưng BE chưa có trường ảnh tương ứng.

### **A. Yêu cầu**

1. Mỗi biến thể có thể sử dụng một ảnh riêng.  
2. Cho phép upload, thay và xóa ảnh biến thể.  
3. Ảnh phải liên kết đúng `variantId`.  
4. API tạo biến thể nhận thông tin ảnh.  
5. API cập nhật biến thể cho phép đổi ảnh.  
6. GET Product trả ảnh riêng của từng biến thể.  
7. Thay đổi giá, tên, trạng thái không được làm mất ảnh đã lưu.  
8. Nếu biến thể không có ảnh riêng thì FE có thể dùng ảnh chính của Product.

### **B. API cần hỗ trợ**

* `POST /products`  
* `PATCH /products/:id`  
* `POST /products/:id/variants`  
* `PATCH /products/:id/variants/:variantId`  
* `GET /products/:id`

Các API trên cần hỗ trợ hoặc trả về dữ liệu ảnh phù hợp.

---

## **4\. Loại sử dụng (`usageType`) và loại sản phẩm (`productType`)**

### **A. Loại sử dụng (`usageType`)**

**Thống nhất quản lý cả ba loại trong Product Master.**

Module Kho chịu trách nhiệm quản lý tồn kho theo SKU và chi nhánh.

| Giá trị | Nghiệp vụ | Customer Site |
| ----- | ----- | ----- |
| `SALE` | Hàng bán cho khách hàng | Được phép hiển thị và bán |
| `SHARED` | Hàng vừa bán vừa sử dụng trong dịch vụ | Được phép hiển thị và bán |
| `SERVICE_SUPPLY` | Vật tư phục vụ vận hành/dịch vụ | Không hiển thị |

### **Quy tắc hiển thị**

1. `SALE` và `SHARED` chỉ hiển thị trên Customer Site khi Product đang `ACTIVE` và được phép công khai.  
2. `SERVICE_SUPPLY` chỉ sử dụng trong Admin/Kho/Dịch vụ, không hiển thị trên Customer Site.  
3. Hết hàng là trạng thái tồn kho, không đồng nghĩa với việc Product phải `INACTIVE` hoặc bị ẩn.  
4. Tồn kho của cả ba loại đều được quản lý tại module Inventory.

### **Quy tắc chỉnh sửa**

1. Admin được chọn `usageType` khi tạo Product.  
2. Admin có thể chỉnh sửa `usageType` nếu không gây xung đột với các nghiệp vụ đang sử dụng sản phẩm.  
3. Thay đổi `usageType` không được làm sai lệch lịch sử Order, InventoryTransaction hoặc tiêu hao vật tư.  
4. Nếu có xung đột, BE phải chặn thao tác và trả lỗi nghiệp vụ cụ thể.

### **B. Loại sản phẩm (`productType`)**

Sử dụng hai giá trị:

* `SIMPLE`: Không có biến thể, sản phẩm có đúng một SKU.  
* `VARIANT`: Có biến thể, mỗi biến thể có SKU riêng.

**Quy tắc bắt buộc:**

1. Admin chọn loại sản phẩm khi tạo mới.  
2. BE lưu `productType` tường minh trong Product Master.  
3. Không suy luận `productType` từ số lượng SKU.  
4. Product `VARIANT` vẫn là `VARIANT` ngay cả khi hiện chỉ có một biến thể.  
5. Mỗi biến thể có SKU, giá, khuyến mại và trạng thái riêng.  
6. **Không cho phép chuyển đổi `SIMPLE` ↔ `VARIANT` sau khi sản phẩm đã tạo thành công.**  
7. BE phải từ chối request thay đổi `productType` của Product đã tồn tại.  
8. FE sẽ khóa trường Loại sản phẩm ở màn Chỉnh sửa.

### **C. API cần cập nhật**

1. `POST /products`: Nhận `usageType` và `productType`.  
2. `GET /products`: Trả cả hai trường.  
3. `GET /products/:id`: Trả cả hai trường.  
4. `PATCH /products/:id`: Cho phép sửa `usageType` theo ràng buộc nghiệp vụ, không cho sửa `productType`.  
5. `GET /products`: Hỗ trợ lọc theo `usageType`.  
6. API Customer chỉ trả những Product đủ điều kiện hiển thị.  
7. Trả lỗi cụ thể khi yêu cầu cập nhật không hợp lệ.

Nhờ BE triển khai đúng các quy tắc trên và cập nhật schema, validation, OpenAPI.

---

## **5\. Khuyến mại và giá sau khuyến mại**

Hiện FE có giao diện nhập:

* Giá bán gốc.  
* Khuyến mại (%).  
* Giá sau khuyến mại.

Nhưng API Product/Variant chưa hỗ trợ đầy đủ các trường khuyến mại này.

### **A. Yêu cầu**

1. Hỗ trợ mức khuyến mại phù hợp với từng SKU/variant.  
2. Cho phép tạo và cập nhật mức giảm giá.  
3. Validate phần trăm giảm trong khoảng `0–100`.  
4. BE tính giá sau khuyến mại, FE chỉ tính tạm để hiển thị.  
5. Thống nhất sử dụng số nguyên VNĐ và quy tắc làm tròn.  
6. Giá sau khuyến mại không được nhỏ hơn 0\.  
7. Cart/Order phải lấy giá được BE xác nhận, không tin giá từ FE.  
8. Khi giá hoặc khuyến mại thay đổi, không cập nhật ngược dữ liệu đơn hàng lịch sử.  
9. Trả đủ dữ liệu để FE hiển thị giá gốc, mức giảm và giá cuối cùng.

### **B. Công thức**

`finalPrice = round(basePrice × (100 - discountPercent) / 100)`

BE chịu trách nhiệm tính và trả kết quả chính thức.

Nếu hệ thống đã có module Promotion/Voucher thì tích hợp với module đó, tránh tạo hai nguồn dữ liệu khuyến mại độc lập.

### **C. API**

Các API Product/Variant cần nhận hoặc trả thông tin giá và khuyến mại theo contract được cập nhật.

Nhờ BE bảo đảm cách tính giá thống nhất giữa Product, Cart và Order.

---

# **II. HOÀN THIỆN API VÀ DỮ LIỆU HIỂN THỊ**

## **6\. Danh sách sản phẩm, bộ lọc và tồn kho**

### **A. Dữ liệu màn danh sách**

FE cần nhận:

* `id`  
* `productCode`  
* `name`  
* `categoryId`  
* Tên danh mục.  
* `usageType`  
* `productType`  
* Ảnh chính.  
* SKU / danh sách SKU.  
* Số lượng biến thể.  
* Giá hoặc khoảng giá.  
* Tổng tồn kho.  
* `createdAt`  
* `updatedAt`  
* `archivedAt`  
* `status`

Hiện một số trường chưa có trong Product response.

Nhờ BE bổ sung để FE không cần hiển thị placeholder hoặc tính toán dựa trên dữ liệu thiếu.

### **B. Tổng tồn kho**

1. Tổng tồn kho phải lấy từ Inventory, không lưu số lượng trực tiếp vào Product Master.  
2. Hỗ trợ tổng tồn của Product.  
3. Hỗ trợ tồn theo từng SKU/variant.  
4. Hỗ trợ tồn theo chi nhánh khi người dùng có quyền.  
5. Có thông tin để phân biệt `Đủ hàng`, `Sắp hết`, `Hết hàng` theo ngưỡng Kho.  
6. Không tự chuyển Product thành `INACTIVE` khi hết hàng.  
7. Các dữ liệu tồn trên màn Product chỉ đọc; thao tác thay đổi tồn thực hiện trong module Kho.

### **C. Search và bộ lọc**

Cần hỗ trợ tìm kiếm theo:

* Tên sản phẩm.  
* SKU.  
* Mã sản phẩm nếu có.

Bộ lọc:

* Một hoặc nhiều danh mục.  
* Trạng thái `ACTIVE`, `INACTIVE`, `ARCHIVED`.  
* `usageType`.  
* Khoảng giá.  
* Ngày tạo: 7, 30 hoặc 90 ngày gần nhất.

Quy tắc lọc:

* Các nhóm khác nhau kết hợp AND.  
* Nhiều giá trị trong cùng nhóm kết hợp OR.  
* Kết quả phải được lọc ở BE trước khi phân trang.

BE hiện đã có `minPrice`, `maxPrice`, `sort`, `cursor`, nên có thể tái sử dụng và bổ sung các tham số cần thiết.

### **D. Phân trang và sắp xếp**

* Phân trang server-side.  
* Không lặp hoặc bỏ sót sản phẩm khi phân trang theo kiểu sắp xếp được hỗ trợ.  
* Reset cursor khi thay đổi filter/search.  
* Hỗ trợ `NEWEST`, `NAME_ASC`, `NAME_DESC`, `PRICE_ASC`, `PRICE_DESC`.  
* Trả `totalItems` để FE hiển thị tổng số bản ghi.  
* Giữ dữ liệu đúng với tab Hiện tại hoặc Đã lưu trữ.

---

## **7\. Quản lý biến thể và bảo toàn dữ liệu Kho/Đơn hàng**

### **A. Tạo và quản lý biến thể**

Áp dụng các quy tắc sau:

1. Thêm biến thể mới: BE tự sinh SKU theo `SP-{Mã SP}-{STT}`.  
2. Được sửa tên/nhãn, giá, khuyến mại và trạng thái.  
3. Không cho sửa SKU sau khi đã cấp.  
4. Biến thể chưa lưu có thể xóa trực tiếp khỏi form FE.  
5. Biến thể đã lưu dùng cơ chế **ngừng sử dụng (soft delete)**, không hard-delete.  
6. Biến thể đã ngừng sử dụng có thể kích hoạt lại nếu đáp ứng điều kiện nghiệp vụ.  
7. SKU đã ngừng sử dụng không được tái sử dụng.  
8. Không cho tạo hai biến thể có cùng tổ hợp thuộc tính trong một Product.

### **B. Điều kiện ngừng sử dụng**

**Trường hợp 1 – Chưa có giao dịch, tồn kho bằng 0**

Cho phép ngừng sử dụng.

**Trường hợp 2 – Đã có giao dịch hoàn tất**

Cho phép ngừng sử dụng nhưng vẫn bảo toàn toàn bộ lịch sử và liên kết dữ liệu.

**Trường hợp 3 – Có đơn hàng chưa hoàn tất hoặc tồn kho đang giữ chỗ**

Không cho ngừng sử dụng cho đến khi các nghiệp vụ liên quan được xử lý.

BE phải trả lỗi rõ ràng để FE thông báo cho Admin.

**Trường hợp 4 – Còn tồn kho thực tế nhưng không có đơn hàng đang xử lý**

Cho phép ngừng sử dụng.

BE cần cung cấp thông tin cảnh báo còn tồn kho để FE hiển thị trước khi xác nhận.

### **C. Khi biến thể ngừng sử dụng**

1. Không cho chọn SKU này tạo đơn hàng mới.  
2. Không hiển thị như biến thể có thể mua trên Customer Site.  
3. Vẫn giữ SKU trong các giao dịch lịch sử và module Kho.  
4. Không tự động đưa tồn kho về 0\.  
5. Không xóa InventoryItem.  
6. Không xóa InventoryStock.  
7. Không xóa InventoryTransaction.  
8. Admin vẫn được xử lý tồn kho theo nghiệp vụ Kho.

**Ví dụ:**

Royal Canin Poodle 500g có SKU `SP-000123-001`, hiện còn tồn 20 sản phẩm.

Khi Admin ngừng sử dụng biến thể:

* Customer không được mua mới.  
* Kho vẫn ghi nhận tồn 20 sản phẩm.  
* Admin vẫn có thể thực hiện nghiệp vụ Kho hợp lệ.  
* Các đơn hàng cũ vẫn giữ tên, SKU và giá tại thời điểm mua.

Ngừng kinh doanh một biến thể và xóa dữ liệu tồn kho là hai nghiệp vụ khác nhau.

### **D. Chuyển đổi loại sản phẩm**

**Không cho chuyển `SIMPLE` ↔ `VARIANT` sau khi Product đã được tạo.**

Không thực hiện chuyển đổi bằng cách thay đổi `productType` đơn thuần.

FE sẽ hiển thị loại sản phẩm đã lưu và không cho chỉnh sửa.

### **E. Bảo toàn dữ liệu lịch sử**

1. Mỗi biến thể có `variantId` duy nhất, ổn định.  
2. SKU duy nhất toàn hệ thống và bất biến.  
3. Sửa giá hoặc nhãn không được ghi đè dữ liệu Order đã hoàn tất.  
4. OrderItem cần lưu snapshot tối thiểu gồm tên/nhãn biến thể, SKU, đơn giá tại thời điểm mua.  
5. Giữ nguyên liên kết Variant với OrderItem, InventoryItem và InventoryTransaction.  
6. Không xóa dữ liệu lịch sử khi Variant chuyển sang `INACTIVE`.  
7. Thao tác cập nhật Variant không được vô tình thay đổi định danh biến thể đã tồn tại.

### **F. Đồng bộ với Kho**

1. Tạo Product/Variant không tự phát sinh số lượng tồn.  
2. InventoryItem được liên kết với SKU khi tạo theo nghiệp vụ hiện tại, không tạo trùng.  
3. InventoryStock theo chi nhánh chỉ được khởi tạo/cập nhật qua nghiệp vụ Kho hợp lệ.  
4. Mỗi cặp `(branchId, skuId)` chỉ có một bản ghi tồn kho hiện hành.  
5. Sửa Product, giá hoặc trạng thái không tạo thêm InventoryItem.  
6. Retry API không được tạo trùng Product, Variant, InventoryItem hoặc thực hiện nhập kho hai lần.  
7. Các biến động tồn phải có InventoryTransaction để truy vết.

### **G. Yêu cầu API**

Các API hiện có:

* `POST /products/:id/variants`  
* `PATCH /products/:id/variants/:variantId`  
* `POST /products/:id/variants/:variantId/deactivate`

Nhờ BE hoàn thiện theo các nghiệp vụ trên và bổ sung thao tác kích hoạt lại biến thể.

API GET Product cần trả đủ:

* `variantId`  
* `sku`  
* Tên/nhãn biến thể.  
* Giá bán.  
* Khuyến mại.  
* Giá sau khuyến mại.  
* Trạng thái.  
* Ảnh biến thể.  
* Thông tin tồn kho phù hợp.

### **H. Logic FE sau khi tích hợp**

* SKU mới: `Tự động tạo khi lưu`.  
* SKU đã tồn tại: Chỉ đọc.  
* Biến thể chưa lưu: Được xóa trực tiếp.  
* Biến thể đã lưu: Nút `Ngừng sử dụng`.  
* Ngừng sử dụng: Hiển thị popup xác nhận.  
* Nếu còn tồn: Hiển thị cảnh báo.  
* Nếu có đơn hàng chưa hoàn tất: BE từ chối, FE giữ nguyên trạng thái.  
* Lưu thành công: FE lấy lại dữ liệu canonical từ BE để cập nhật SKU và trạng thái.

---

## **8\. Lưu trữ, khôi phục và trạng thái Product**

Hiện FE đã sử dụng:

* `POST /products/:id/archive` để lưu trữ.  
* `PATCH /products/:id` với `status = INACTIVE` để khôi phục.

### **A. Quy tắc trạng thái**

* `ACTIVE`: Sản phẩm đang hoạt động.  
* `INACTIVE`: Tạm ngưng.  
* `ARCHIVED`: Đã lưu trữ.

Khi khôi phục Product từ `ARCHIVED`, đưa về `INACTIVE`, không tự động kích hoạt bán.

### **B. Yêu cầu**

1. Khi lưu trữ, Product chuyển sang `ARCHIVED`.  
2. Lưu thời điểm `archivedAt`.  
3. Archived không xuất hiện trong danh sách bán hàng Customer.  
4. Archived không được dùng để tạo giao dịch mới.  
5. Không xóa dữ liệu Product, Variant, Inventory hoặc Order.  
6. Khi khôi phục, giữ nguyên SKU và toàn bộ dữ liệu liên quan.  
7. Khôi phục về `INACTIVE`.  
8. Chỉ khi Admin chủ động kích hoạt lại thì Product mới được chuyển sang `ACTIVE`.  
9. Product `INACTIVE` hoặc `ARCHIVED` không được bán, kể cả khi Variant đang `ACTIVE`.  
10. Variant `INACTIVE` không được bán, kể cả khi Product đang `ACTIVE`.  
11. Product/Variant đang hoạt động nhưng tồn kho bằng 0 có thể vẫn hiển thị theo chính sách Customer, nhưng không được xác nhận mua nếu không đủ tồn.

### **C. API**

BE có thể giữ cách khôi phục qua PATCH hiện tại hoặc cung cấp API restore riêng.

Dù sử dụng endpoint nào, cần bảo đảm đúng trạng thái, kiểm tra quyền, ghi nhận thay đổi và giữ nguyên dữ liệu lịch sử.

Không cho phép hard-delete Product đã có giao dịch.

---

# **III. VALIDATION VÀ CHẤT LƯỢNG API**

## **9\. Chuẩn hóa lỗi, bảo toàn dữ liệu và kiểm thử**

### **A. Mã lỗi API**

Trước đây FE từng gặp trường hợp trùng SKU gây lỗi 409 nhưng nhận response 500\.

Nhờ BE kiểm tra OpenAPI validator và môi trường chạy thực tế để bảo đảm mã lỗi nhất quán.

Yêu cầu:

| Mã HTTP | Trường hợp |
| ----- | ----- |
| `400` | Request không hợp lệ |
| `401` | Chưa xác thực |
| `403` | Không có quyền |
| `404` | Không tìm thấy dữ liệu |
| `409` | Xung đột dữ liệu hoặc trạng thái |
| `422` | Vi phạm ràng buộc nghiệp vụ |

Response lỗi cần thống nhất theo Problem Details, có:

* `status`  
* `code`  
* `detail`  
* `correlationId`  
* `errors[]` khi có lỗi theo trường

Các lỗi như trùng SKU, đổi `productType`, ngừng Variant đang có Order xử lý hoặc đổi `usageType` không hợp lệ phải trả thông báo rõ ràng.

### **B. Tính toàn vẹn dữ liệu**

1. Tạo Product và đăng ký InventoryItem không được để dữ liệu tạo dở.  
2. Khi phát sinh lỗi ở bất kỳ bước nào, không được tồn tại Product/Variant không nhất quán.  
3. Xử lý transaction hoặc cơ chế tương đương cho các thao tác nhiều bước.  
4. Sinh SKU phải an toàn khi nhiều người tạo đồng thời.  
5. Retry cùng request không tạo dữ liệu trùng.  
6. Không tự thay đổi SKU/variantId đã tồn tại.  
7. Không làm mất dữ liệu lịch sử khi sửa hoặc ngừng sử dụng Product/Variant.  
8. Không ghi đè cập nhật đồng thời một cách âm thầm; cần cơ chế phát hiện xung đột phù hợp.

### **C. Phân quyền**

* Admin: Được quản lý Product Master theo quyền.  
* Manager: Được xem dữ liệu Product toàn hệ thống, không tự sửa Product Master nếu không có quyền.  
* Staff/Receptionist: Chỉ xem thông tin cần thiết theo phân quyền.  
* Customer/Guest: Chỉ xem Product đủ điều kiện công khai.

BE phải kiểm tra quyền trực tiếp tại API, không phụ thuộc FE ẩn hay hiện nút.

### **D. Các luồng cần test**

Nhờ BE kiểm thử tối thiểu:

1. Tạo Product `SIMPLE`, tự sinh SKU.  
2. Tạo Product `VARIANT` có nhiều SKU.  
3. Thêm Variant và kiểm tra thứ tự SKU tiếp theo.  
4. Nhiều request tạo đồng thời không bị trùng SKU.  
5. Lưu trữ/ngừng Variant rồi thêm mới không tái sử dụng SKU cũ.  
6. Chỉnh sửa Product không làm đổi SKU.  
7. Chặn chuyển `SIMPLE` ↔ `VARIANT`.  
8. Tạo và sửa `usageType` theo nghiệp vụ.  
9. Customer không thấy `SERVICE_SUPPLY`.  
10. Upload, thay, xóa và đặt ảnh chính.  
11. Upload ảnh riêng cho Variant.  
12. Tạo và sửa khuyến mại, tính đúng giá sau giảm.  
13. Lấy tổng tồn và tồn theo SKU/chi nhánh.  
14. Ngừng Variant còn hàng nhưng không có đơn đang xử lý.  
15. Từ chối ngừng Variant đang có đơn chưa hoàn tất hoặc tồn giữ chỗ.  
16. Lưu trữ và khôi phục Product.  
17. Search theo SKU, lọc và phân trang.  
18. Kiểm tra lỗi 400/403/404/409/422.  
19. Retry request không tạo trùng dữ liệu.  
20. Kiểm tra lịch sử Order/Inventory không bị thay đổi sau các thao tác quản lý Product.

---

# **IV. TÀI LIỆU VÀ BÀN GIAO CHO FE**

Sau khi hoàn thiện, nhờ team BE cung cấp:

1. Nhánh/commit Backend mới nhất.  
2. OpenAPI/Swagger cập nhật.  
3. Product/Variant schema và enum mới.  
4. Ví dụ request/response cho API tạo, sửa, thêm biến thể và tự sinh SKU.  
5. Contract upload ảnh sản phẩm và ảnh biến thể.  
6. Contract giá, khuyến mại và giá sau giảm.  
7. Các trường tồn kho và metadata Product.  
8. Contract lưu trữ/khôi phục Product và ngừng/kích hoạt Variant.  
9. Danh sách validation và error code.  
10. Kết quả test các luồng chính.  
11. Hướng dẫn migration dữ liệu nếu có thay đổi schema.  
12. Các thay đổi liên quan tới Inventory, Order và Promotion để FE đồng bộ.

Những API đã có và đang hoạt động đúng thì không cần xây dựng lại. BE chỉ cần bổ sung những chức năng/field còn thiếu và cập nhật contract.

---

# **V. THỨ TỰ ƯU TIÊN TRIỂN KHAI**

### **P0 – Cần để hoàn thiện Phase 5**

1. Tự sinh mã sản phẩm và SKU.  
2. Upload và quản lý ảnh sản phẩm.  
3. Ảnh riêng cho biến thể.  
4. `usageType` và `productType`.  
5. Khuyến mại và giá sau khuyến mại.

### **P1 – Cần trước nghiệm thu Task 3.6**

6. Danh sách, bộ lọc, tổng tồn kho và metadata.  
7. Quy tắc quản lý biến thể và bảo toàn dữ liệu Kho/Order.  
8. Lưu trữ, khôi phục và chuyển trạng thái.  
9. Validation, kiểm thử và tính toàn vẹn dữ liệu.

**Mục tiêu cuối cùng**

Hoàn thiện Backend cho Product / Category Management theo nghiệp vụ WEB-2 và Figma, để FE có thể tích hợp toàn bộ chức năng, thực hiện kiểm thử end-to-end và hoàn thành Task 3.6.

Nhờ Minh và team BE triển khai theo các quy tắc nghiệp vụ đã mô tả, cập nhật schema/API/OpenAPI và phản hồi những vướng mắc kỹ thuật hoặc phụ thuộc giữa các module.

Các quy tắc ở mục 4 và mục 7 là yêu cầu triển khai, không cần chốt lại logic. Nếu có giới hạn kỹ thuật ảnh hưởng đến việc thực hiện thì báo cụ thể để hai bên phối hợp xử lý.

Nhờ team phân chia các hạng mục P0/P1, cho biết phần nào đã đáp ứng, phần nào cần bổ sung và dự kiến thời gian bàn giao để t tiếp tục tích hợp FE nhé.

