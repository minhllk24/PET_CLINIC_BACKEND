# Tài liệu Logic Nghiệp vụ Hệ thống (Pet Clinic Backend)

Tài liệu này trình bày chi tiết về cấu trúc dữ liệu, quy trình xử lý và logic nghiệp vụ chính của bốn phân hệ quan trọng trong hệ thống quản lý phòng khám thú y Dr.Pet's House / Pet Clinic:
1. **Đặt lịch (Appointments & Scheduling)**
2. **Mua sắm (Shopping & E-Commerce)**
3. **Quản lý (Management System)**
4. **Blog & Cộng đồng (Blog & Community)**

---

## 1. Đặt lịch (Appointments & Scheduling)

Phân hệ Đặt lịch quản lý việc lên lịch khám và làm đẹp (grooming) cho thú cưng tại các chi nhánh. Quy trình này đảm bảo tính nhất quán của dữ liệu về thời gian biểu của bác sĩ và tính toán chính xác chi phí dịch vụ.

### A. Các bảng cơ sở dữ liệu liên quan
*   [schema.prisma: Lớp Đặt lịch](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma#L726-L802)
    *   `TimeSlot`: Lưu trữ các khung giờ làm việc của bác sĩ tại một chi nhánh cụ thể.
    *   `Appointment`: Lưu thông tin tổng quan của lịch hẹn bao gồm khách hàng, bác sĩ, thú cưng, thời gian và trạng thái.
    *   `AppointmentService`: Bảng liên kết trung gian lưu các dịch vụ được chọn kèm số lượng, đơn giá gốc, phụ thu và tổng tiền.
    *   `AppointmentStatusHistory`: Ghi nhật ký thay đổi trạng thái của lịch hẹn phục vụ mục đích kiểm toán.

### B. Logic nghiệp vụ chi tiết
Các logic này được triển khai chủ yếu trong [appointmentAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/appointmentAPIService.js):

#### 1. Quy trình Tạo Lịch Hẹn (`createAppointment`)
*   **Xác thực đầu vào:** Kiểm tra sự tồn tại của `slot_id`, danh sách `service_ids` và tên khách hàng chụp nhanh (`customer_name_snapshot`). Số điện thoại liên hệ được chuẩn hóa qua biểu thức chính quy (Regex: `/^\+?[0-9]{9,15}$/`).
*   **Kiểm soát giao dịch (Database Transaction):** Toàn bộ quá trình kiểm tra slot và trừ chỗ được bao bọc trong một Prisma Transaction để tránh hiện tượng đặt trùng (overbooking).
    *   **Kiểm tra Khung giờ (TimeSlot):** Hệ thống khóa bản ghi slot và xác nhận trạng thái phải là `'available'` và số lượng đã đặt (`booked_count`) bé hơn số lượng tối đa (`max_booking`).
    *   **Đồng nhất Loại dịch vụ:** 
        *   Các dịch vụ trong một lịch hẹn phải thuộc cùng một nhóm lớn: **Khám & Điều trị** (phân loại thành nhóm `'exam'`) hoặc **Grooming & Spa** (phân loại thành nhóm `'grooming'`). Không được đặt chéo cả hai loại trong cùng một lịch hẹn.
        *   Khung giờ (`TimeSlot.slot_type`) được chọn phải khớp chính xác với loại dịch vụ khách hàng yêu cầu (`exam` hoặc `grooming`).
    *   **Giữ chỗ:** Tăng `booked_count` lên 1. Nếu đạt giới hạn tối đa, trạng thái slot chuyển thành `'full'`.

> [!IMPORTANT]
> **Snapshot dữ liệu:** Để tránh việc thông tin lịch hẹn bị sai lệch khi người dùng cập nhật hồ sơ cá nhân hoặc hồ sơ thú cưng trong tương lai, hệ thống chụp lại thông tin tại thời điểm đặt lịch: `customer_name_snapshot`, `customer_phone_snapshot`, `pet_name_snapshot`, `pet_species_snapshot`, và `pet_breed_snapshot`.

#### 2. Xử lý Hồ sơ Thú cưng tự động
*   Nếu lịch hẹn truyền lên `pet_id` và kèm theo `pet_data`: Hệ thống tự động cập nhật thông tin mới nhất vào hồ sơ thú cưng.
*   Nếu không truyền `pet_id` nhưng có `pet_data`: Hệ thống tự động tạo mới hồ sơ thú cưng cho khách hàng, tự động tra cứu để liên kết `species_id` (chủng loại) và `breed_id` (giống) tương ứng dựa trên tên hoặc ID do giao diện gửi lên.

#### 3. Logic Tính toán Phụ thu Cân nặng (`calculateWeightSurcharge`)
*   Hệ thống kiểm tra nếu dịch vụ có kích hoạt phụ thu cân nặng (`is_weight_surcharge_applied = true`).
*   Tra cứu ma trận giá (`ServicePriceMatrix`) của dịch vụ được sắp xếp tăng dần theo khoảng cân nặng tối thiểu (`weight_min`).
*   Xác định mức giá tương ứng với cân nặng thú cưng. Giá chuẩn mặc định là giá ở mức cân nặng thấp nhất (thường dưới 3kg). Phụ thu được tính bằng hiệu số: `Giá thực tế theo cân nặng - Giá tiêu chuẩn`.
*   Nếu khoảng cân nặng yêu cầu người dùng liên hệ trực tiếp (`is_contact = true`), hệ thống sẽ quăng lỗi chặn đặt lịch online và hướng dẫn liên hệ chi nhánh.

#### 4. Đổi lịch hẹn trực tuyến (`rescheduleAppointment`)
*   Khách hàng chỉ được phép tự đổi lịch trực tuyến khi lịch hẹn đang ở trạng thái `'pending'` hoặc `'confirmed'` và trạng thái thanh toán là `'unpaid'` hoặc `'waiting_store_payment'`. Nếu đã thanh toán trực tuyến thành công, hệ thống chặn tự đổi lịch để tránh sai lệch hóa đơn.
*   Khi đổi lịch, hệ thống thực hiện nhả slot cũ (giảm `booked_count` của slot cũ) và chiếm slot mới (tăng `booked_count` của slot mới), đồng thời cập nhật thông tin ngày giờ mới và ghi nhận lý do đổi lịch vào `AppointmentStatusHistory`.

---

## 2. Mua sắm (Shopping & E-Commerce)

Phân hệ Mua sắm cung cấp trải nghiệm cửa hàng trực tuyến bán thức ăn, phụ kiện, thuốc thú y, hỗ trợ giỏ hàng, áp dụng mã giảm giá (Voucher), tính phí giao hàng và tạo hóa đơn thanh toán.

### A. Các bảng cơ sở dữ liệu liên quan
*   [schema.prisma: Lớp Mua sắm](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma#L970-L1164)
    *   `Product`, `ProductCategory`, `ProductVariant`: Danh mục và thông tin sản phẩm (bao gồm các biến thể kích thước, màu sắc).
    *   `Cart`, `CartItem`: Quản lý giỏ hàng của từng khách hàng.
    *   `Order`, `OrderItem`: Thông tin chi tiết của đơn hàng và các mặt hàng chụp nhanh khi mua.
    *   `Voucher`, `VoucherUsage`: Quản lý mã giảm giá và lịch sử sử dụng của từng tài khoản.

### B. Logic nghiệp vụ chi tiết
Các logic này được triển khai chủ yếu trong [orderAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/orderAPIService.js) và [cartAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/cartAPIService.js):

#### 1. Đặt hàng từ Giỏ hàng hoặc Mua ngay (`checkoutCart`)
*   **Nguồn sản phẩm:** Hệ thống hỗ trợ 2 cơ chế mua hàng:
    *   *Mua qua giỏ hàng (DB Cart):* Lấy các mặt hàng trong giỏ hàng có cờ `is_selected = true`.
    *   *Mua ngay (Direct Checkout):* Nhận danh sách sản phẩm trực tiếp từ LocalStorage do giao diện gửi lên.
*   **Kiểm tra tồn kho:** Hệ thống đối chiếu số lượng đặt mua với lượng tồn kho của biến thể (`ProductVariant.stock_quantity`) hoặc sản phẩm gốc (`Product.stock_quantity`). Nếu vượt quá số lượng tồn, giao dịch sẽ bị từ chối.
*   **Tính toán chi phí:**
    *   **Phí vận chuyển (Shipping Fee):** Nếu tổng giá trị đơn hàng (chưa giảm giá) từ **500.000 VND** trở lên, hệ thống sẽ miễn phí vận chuyển. Ngược lại, áp dụng phí giao hàng mặc định là **30.000 VND**.
    *   **Tổng thanh toán:** `Tạm tính + Phí vận chuyển - Số tiền giảm giá`.

#### 2. Logic Áp dụng Mã giảm giá (Voucher)
Khi người dùng nhập `voucher_code`, hệ thống tiến hành kiểm tra một chuỗi điều kiện nghiêm ngặt:
1.  Voucher phải tồn tại và đang ở trạng thái `'active'`.
2.  Thời gian hiện tại nằm trong khoảng từ `start_at` đến `end_at`.
3.  Tổng tiền tạm tính của đơn hàng phải lớn hơn hoặc bằng giá trị đơn hàng tối thiểu (`min_order_amount`).
4.  Lượt sử dụng còn lại của voucher phải lớn hơn 0 (`remaining_usage > 0`).
5.  Khách hàng chưa từng sử dụng voucher này trước đây (truy vấn bảng `VoucherUsage`).

> [!TIP]
> **Cách tính giảm giá:**
> *   Dạng phần trăm (`percent`): `Tạm tính * (discount_value / 100)`. Giới hạn tối đa bằng `max_discount_amount` (nếu có).
> *   Dạng tiền mặt cố định (`fixed`): Chiết khấu trực tiếp số tiền bằng `discount_value`.
> *   Số tiền giảm giá tối đa không được vượt quá tổng giá trị tạm tính của đơn hàng.

#### 3. Giao dịch Tạo Đơn hàng và Trừ Kho
*   Tạo bản ghi `Order` với trạng thái ban đầu là `order_status = 'pending'` và `payment_status = 'unpaid'`.
*   Tạo các bản ghi `OrderItem` lưu thông tin snapshot tên sản phẩm (kèm tên biến thể), giá bán thực tế và số lượng tại thời điểm mua.
*   **Cập nhật kho:** Thực hiện đồng thời việc trừ tồn kho (`stock_quantity`) và cộng dồn số lượng đã bán (`sold_quantity`) của sản phẩm hoặc biến thể tương ứng.
*   Tạo bản ghi `Payment` lưu phương thức thanh toán khách chọn (ví dụ: `cod` hoặc `online`).
*   Nếu có áp dụng voucher, hệ thống lưu lịch sử vào `VoucherUsage` và giảm `remaining_usage` của voucher đi 1.
*   Xóa các sản phẩm đã thanh toán khỏi giỏ hàng trực tuyến của người dùng.

#### 4. Logic Đặt hàng cho Khách vãng lai (`guestCheckout`)
Dành cho khách hàng chưa đăng ký tài khoản nhưng muốn đặt hàng nhanh:
*   Hệ thống kiểm tra tính hợp lệ của email và số điện thoại. 
    *   Nếu email/sđt trùng với một tài khoản ở trạng thái chưa kích hoạt (`status = 'inactive'`), hệ thống tự động dọn dẹp các mã OTP liên quan và xóa tài khoản cũ đó để tránh xung đột dữ liệu.
    *   Nếu email/sđt trùng với tài khoản đang hoạt động, hệ thống yêu cầu khách hàng đăng nhập thay vì dùng luồng khách vãng lai.
*   **Tự động tạo tài khoản:** Hệ thống sinh ngẫu nhiên mật khẩu mạnh dài 10 ký tự (chứa chữ hoa, chữ thường, số, ký tự đặc biệt), băm mật khẩu và tạo mới một bản ghi `User` với vai trò `CUSTOMER`, trạng thái `'active'`, đồng thời bật cờ đổi mật khẩu bắt buộc `require_password_change = true`.
*   Sau khi tạo đơn hàng thành công, hệ thống gửi một email bất đồng bộ (`sendGuestAccountEmail`) chứa mật khẩu đăng nhập được sinh tự động và mã đơn hàng để khách hàng có thể đăng nhập theo dõi đơn hàng bất cứ lúc nào.

---

## 3. Quản lý (Management System)

Hệ thống quản lý cốt lõi của phòng khám điều phối các hoạt động vận hành hằng ngày, quản lý thông tin khách hàng, hồ sơ y tế của thú cưng và các vấn đề tài chính.

### A. Các bảng cơ sở dữ liệu liên quan
*   [schema.prisma: Lớp Danh tính & Hồ sơ thú cưng](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma#L305-L554)
*   [schema.prisma: Lớp Bệnh án & Y tế](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma#L804-L968)
*   [schema.prisma: Lớp Tài chính & Khách hàng thân thiết](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma#L1166-L1286)

### B. Logic nghiệp vụ chi tiết

#### 1. Quản lý Hồ sơ Thú cưng
Triển khai trong [petAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/petAPIService.js):
*   **Tính tuổi tự động (`calculateAgeText`):** Tuổi hiển thị được tính toán động dựa trên ngày sinh và ngày hiện tại. Trả về chi tiết dạng: `"X tuổi Y tháng"`, `"X tháng"`, hoặc `"Dưới 1 tháng"`. Nếu không có ngày sinh, hệ thống sẽ sử dụng chuỗi nhập thô `age` do người dùng cung cấp hoặc hiển thị `"Chưa rõ"`.
*   **Xử lý Ảnh đại diện:** Hỗ trợ lưu trữ ảnh định dạng Base64 gửi từ ứng dụng. Hệ thống tự động giải mã, lưu tệp vật lý vào thư mục `/public/uploads/pets` và trả về đường dẫn URL nội bộ tương ứng.
*   **Xóa hồ sơ:** Hệ thống áp dụng phương thức xóa mềm (soft delete) bằng cách đổi trạng thái `status` của thú cưng thành `'deleted'` để không làm ảnh hưởng đến lịch sử bệnh án và giao dịch cũ.

#### 2. Quản lý Y tế & Bệnh án
Triển khai trong [medicalRecordAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/medicalRecordAPIService.js):
*   **Bệnh án (`MedicalRecord`):** Bác sĩ phụ trách cập nhật thông tin về triệu chứng, chẩn đoán và hướng dẫn điều trị. Bệnh án có thuộc tính `is_locked_for_customer` mặc định là `true` (chỉ hiển thị nội bộ giữa bác sĩ và nhân viên phòng khám). Khi hồ sơ được hoàn tất và duyệt mở khóa, khách hàng mới có thể xem thông tin chi tiết qua ứng dụng.
*   **Đơn thuốc (`Prescription`):** Liên kết trực tiếp với bệnh án, lưu trữ tên thuốc, liều lượng, tần suất uống, thời gian sử dụng và chỉ dẫn chi tiết của bác sĩ.
*   **Lịch sử tiêm phòng (`PetVaccinationHistory`):** Ghi chép các mũi vắc-xin đã tiêm và dự tính ngày tiêm tiếp theo (`next_due_date`) để làm cơ sở nhắc nhở.
*   **Nhắc nhở tự động (`PetReminder`):** Hệ thống tự động quét lịch trình tiêm chủng hoặc tái khám định kỳ. Dựa trên tham số `remind_before_days` (mặc định trước 3 ngày), hệ thống sẽ tạo các thông báo gửi đến khách hàng qua kênh thông báo nội bộ (In-app) hoặc email.

#### 3. Quản lý Tài chính, Hoàn tiền & Khách hàng thân thiết
*   **Thanh toán & Hóa đơn:** Khi một giao dịch thanh toán thành công (qua cổng online hoặc thu tiền tại quầy), hệ thống tạo bản ghi hóa đơn (`Receipt`) lưu trữ mã hóa đơn và đường dẫn tải hóa đơn điện tử phục vụ khách hàng.
*   **Quy trình Hoàn tiền (`Refund`):** Khi đơn hàng bị hủy hoặc có sự cố dịch vụ, yêu cầu hoàn tiền sẽ được tạo ở trạng thái `'requested'`. Quản trị viên tiến hành phê duyệt, thực hiện hoàn trả tiền qua cổng thanh toán và cập nhật trạng thái sang `'completed'`.
*   **Tích điểm Loyalty:**
    *   Tài khoản hoàn thành thanh toán sẽ được tích điểm tự động dựa trên giá trị đơn hàng thực tế (quy đổi theo tỷ lệ thiết lập hệ thống).
    *   Khi thanh toán đơn mới, khách hàng có thể chọn tiêu dùng điểm tích lũy (`LoyaltyAccount.current_points`) để trừ trực tiếp vào hóa đơn thanh toán (`points_discount_amount`). Hệ thống sẽ ghi nhận lịch sử biến động số dư điểm vào bảng `LoyaltyPointTransaction`.

---

## 4. Blog & Cộng đồng (Blog & Community)

Phân hệ Blog cung cấp kênh thông tin chính thức từ phòng khám (official blogs) và không gian giao lưu chia sẻ kinh nghiệm nuôi dạy thú cưng giữa các thành viên (community posts).

### A. Các bảng cơ sở dữ liệu liên quan
*   [schema.prisma: Lớp Blog](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma#L1338-L1397)
    *   `PostCategory`: Quản lý các chủ đề bài viết (Ví dụ: Chăm sóc mèo, Dinh dưỡng chó, Cứu hộ...).
    *   `Post`: Lưu thông tin tiêu đề, nội dung, tác giả, lượt xem, lượt thích của bài đăng.
    *   `PostLike`: Bảng liên kết trung gian lưu trữ danh sách người dùng thích bài viết.
    *   `PostComment`: Quản lý các bình luận và phản hồi dưới bài viết.

### B. Logic nghiệp vụ chi tiết
Các logic này được triển khai chủ yếu trong [contentAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/contentAPIService.js):

#### 1. Tạo bài viết và Sinh Slug tự động
*   **Phân quyền loại bài viết:** 
    *   Nếu tác giả có vai trò là `ADMIN`, bài viết mặc định có thuộc tính `post_type = 'official_blog'`.
    *   Nếu là thành viên thông thường, bài viết có thuộc tính `post_type = 'community'`.
*   **Sinh Slug tự động:** Tiêu đề bài viết được chuẩn hóa bằng cách loại bỏ các ký tự đặc biệt, chuyển sang chữ thường không dấu, nối bằng dấu gạch ngang (`-`) và nối thêm đuôi định danh thời gian (`Date.now()`) để đảm bảo tính duy nhất tuyệt đối của đường dẫn (SEO Friendly).

#### 2. Tối ưu hóa lượt xem bài viết (`view_count`)
*   Khi khách hàng truy cập chi tiết một bài viết thông qua API lấy chi tiết bằng slug (`getPostBySlug`), hệ thống sẽ thực hiện tăng chỉ số `view_count` lên 1 đơn vị.
*   Để tăng tốc phản hồi cho API chi tiết bài viết, thao tác cập nhật số lượt xem được gọi dưới dạng bất đồng bộ không đồng bộ (fire-and-forget). Hệ thống trả về dữ liệu bài viết ngay lập tức cho người dùng mà không cần chờ câu lệnh cập nhật cơ sở dữ liệu hoàn tất.

#### 3. Logic Toggle Like Bài viết
*   Hệ thống sử dụng cơ chế Toggle Like tiện lợi qua một API duy nhất: `POST /posts/:id/like`.
*   Sử dụng cơ chế kiểm soát giao dịch (Database Transaction) để thực hiện:
    *   Kiểm tra sự tồn tại lượt thích của cặp `(user_id, post_id)` trong bảng `PostLike`.
    *   Nếu đã thích: Xóa bản ghi `PostLike`, đồng thời giảm `likes_count` của bài viết đi 1 đơn vị. Trả về hành động `'unliked'`.
    *   Nếu chưa thích: Tạo mới bản ghi `PostLike`, đồng thời tăng `likes_count` của bài viết lên 1 đơn vị. Trả về hành động `'liked'`.

#### 4. Logic Bình luận 2 Cấp độ
Để tối ưu hóa hiệu năng hiển thị trên giao diện người dùng và đơn giản hóa cây dữ liệu, hệ thống giới hạn cấu trúc bình luận tối đa là **2 cấp độ**:
1.  **Bình luận gốc (Cấp 1):** Bản ghi có thuộc tính `parent_comment_id = null`.
2.  **Bình luận phản hồi (Cấp 2):** Bản ghi có `parent_comment_id` liên kết đến ID của bình luận cấp 1. Hệ thống chặn phản hồi của phản hồi (không có bình luận cấp 3).

*   **Sắp xếp hiển thị khi truy vấn bình luận (`getPostComments`):**
    *   Các bình luận gốc (Cấp 1) được sắp xếp theo thời gian tạo mới nhất lên đầu (`created_at: 'desc'`) để người dùng thấy các thảo luận mới.
    *   Với mỗi bình luận gốc, danh sách các phản hồi con (Cấp 2) được tải kèm và sắp xếp theo thời gian cũ nhất đến mới nhất (`created_at: 'asc'`) để đảm bảo cuộc đối thoại được đọc từ trên xuống dưới theo thứ tự tự nhiên.
*   **Xóa bình luận:** Khi người dùng yêu cầu xóa bình luận, hệ thống thực hiện cập nhật trạng thái `status = 'deleted'` thay vì xóa vật lý khỏi cơ sở dữ liệu để bảo toàn cấu trúc phản hồi của cuộc thảo luận.

---

*Tài liệu được cập nhật dựa trên phiên bản Cơ sở dữ liệu và Code hiện tại.*
