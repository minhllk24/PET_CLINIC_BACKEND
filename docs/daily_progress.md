# Nhật ký tiến độ thực hiện dự án Pet Clinic Backend

File này dùng để ghi chú lại các công việc đã hoàn thành, các vấn đề gặp phải và kế hoạch cho ngày tiếp theo.

## [Ngày 23/05/2026]
### Đã hoàn thành:
- Triển khai thành công luồng Quên mật khẩu (Forgot Password):
  - Viết `emailHelpers.js` để gửi email OTP qua Nodemailer.
  - Viết `otpHelpers.js` để sinh mã OTP và Reset Token.
  - Bổ sung 3 API mới: `POST /api/v1/forgot-password`, `POST /api/v1/verify-otp`, `POST /api/v1/reset-password`.
- Kiểm tra và đồng bộ cấu trúc API với UI thiết kế:
  - Xác nhận API `POST /api/v1/pets` (Tạo hồ sơ thú cưng) đã hỗ trợ đầy đủ tất cả các trường trên UI (bao gồm cả ảnh đại diện, tình trạng sức khỏe).
  - **Sửa lỗi nghiêm trọng** ở API `POST /api/v1/medical-records` (Tạo bệnh án) bị lệch so với Database Schema (thiếu `record_name`, `created_by_user_id` và sai tên field).
- Cập nhật chuẩn xác các Payload Request Body trong file Postman Collection (`Pet_Clinic_Collection.json`) để Frontend dễ dàng test và tích hợp.

### Vấn đề cần lưu ý:
- Backend đã hoạt động trơn tru với các thay đổi mới. Frontend cần đảm bảo gửi đúng JSON payload như đã hướng dẫn trong Postman.

---
## [Ngày 24/05/2026]
### Đã hoàn thành:
- **Nâng cấp toàn diện luồng Authentication theo chuẩn bảo mật cao:**
  - Bổ sung luồng xác thực Email bằng OTP khi Đăng ký (`POST /api/v1/verify-register-otp`).
  - Áp dụng kiểm tra độ mạnh mật khẩu (>= 8 ký tự, có chữ hoa, chữ số).
  - Tích hợp cơ chế chống Brute Force: Khóa tài khoản nếu nhập sai mật khẩu 5 lần.
  - Chuyển đổi quản lý Session sang Database (`UserSession` table), hỗ trợ tính năng "Ghi nhớ đăng nhập" (`remember_me`) với thời hạn 30 ngày.
  - Thêm API Đổi mật khẩu (`POST /api/v1/change-password`) và cơ chế tự động thu hồi (revoke) toàn bộ session cũ trên các thiết bị khác khi đổi/reset mật khẩu.
- **Bổ sung API hỗ trợ luồng Đặt lịch (Booking):**
  - Khởi tạo `branchAPIService` và `branchController`.
  - Thêm API `GET /api/v1/branches` để lấy danh sách chi nhánh đổ vào Dropdown ở màn hình Điền thông tin đặt lịch.
- **Cập nhật Postman Collection:** Đã đồng bộ tất cả các API mới và payload vào file `Pet_Clinic_Collection.json`.

### Vấn đề cần lưu ý (Next Steps):
- Luồng tạo lịch hẹn (`POST /api/v1/appointments`) đang thiếu tham số `payment_method` và tính năng tích hợp Cổng thanh toán trực tuyến (VNPay/MoMo) như thiết kế UI. Cần lên phương án giải quyết trong ngày tới.

---
## [Ngày 30/05/2026]
### Đã hoàn thành:
- **Triển khai API Phản hồi khách hàng (Customer Reviews):**
  - Viết mới hàm `getAllReviews(query)` trong `reviewAPIService.js` hỗ trợ phân trang (`page`, `pageSize`) và tự động join lấy thông tin người dùng viết đánh giá.
  - Bổ sung controller `handleGetAllReviews` và đăng ký route công khai `GET /api/v1/reviews`.
  - Khắc phục triệt để lỗi tham chiếu sai tên quan hệ (`review_images` -> `images`) trong hàm lấy danh sách đánh giá cũ, giúp toàn bộ tính năng Reviews hoạt động trơn tru.
- **Sửa lỗi toàn diện luồng Đặt lịch hẹn (POST /api/v1/appointments):**
  - Đồng bộ hàm `createAppointment` và các hàm liên quan trong `appointmentAPIService.js` với 13+ lỗi Database Schema (mã lịch hẹn `appointment_code`, snapshot thú cưng & giống loài, mô tả tình trạng, giá trị tiền tệ trong chi tiết dịch vụ, v.v.).
  - Khắc phục các bug ẩn nghiêm trọng như sai tên model Prisma (`clinicSlot` -> `timeSlot`), sai tên cột sức chứa (`max_capacity` -> `max_booking`), và cơ chế giải phóng slot khi hủy lịch bị lệch múi giờ (đã chuyển sang tìm kiếm trực tiếp bằng `slot_id` cực kỳ chuẩn xác).
- **Cập nhật Postman Collection:** Đã đồng bộ request "Book Appointment" về đúng định dạng payload mới (loại bỏ các trường thừa tự động tính, hỗ trợ định dạng dịch vụ chi tiết).
- **Kiểm thử tự động:** Viết script kiểm thử đầu cuối (E2E) trực tiếp với cơ sở dữ liệu để xác nhận thành công 100% việc lưu trữ dữ liệu, snapshots, quan hệ nhiều-nhiều, lịch sử trạng thái, và giải phóng slot khi hủy.

---
## [Ngày 05/06/2026]
### Đã hoàn thành:
- **Triển khai tính năng Flash Sale:**
  - Cập nhật Database Schema thêm các model `FlashSale` và `FlashSaleItem`.
  - Phát triển API `GET /api/v1/flash-sales/active` tự động tìm kiếm và trả về đợt Flash Sale đang diễn ra hoặc sắp bắt đầu.
  - Tự động tính toán giá sau giảm (`discount_price`) ngay khi Admin tạo/cập nhật Flash Sale để tối ưu tốc độ truy vấn ở phía Frontend.
  - Xây dựng trọn bộ API quản trị CRUD (Create, Update, Delete) kèm cơ chế Cascade Delete xóa sạch dữ liệu liên đới.
- **Phát triển tính năng Sản phẩm bán chạy (Best Sellers) & Hiển thị Giá gốc:**
  - Bổ sung trường `original_price` (để hiển thị giá bị gạch ngang) và `sold_quantity` (số lượng đã bán) vào bảng `Product`.
  - Cập nhật API `GET /api/v1/products` hỗ trợ tham số `sort` linh hoạt (`best_selling`, `price_asc`, `price_desc`, `rating`).
  - Lập trình cơ chế tự động đếm sản phẩm bán ra: tăng `sold_quantity` khi User thanh toán giỏ hàng (Checkout) và hoàn trả lại khi Admin hủy đơn (Cancel).
  - Viết script seed data để quét toàn bộ dữ liệu cũ, tự động tính ngược số lượng đã bán từ lịch sử đơn hàng và sinh giá gốc giả lập để phục vụ demo UI.
- **Quản lý Postman Collection:**
  - Chèn an toàn thư mục "10. Flash Sales" (chứa 4 API) vào `Pet_Clinic_Collection.json` mà không làm xáo trộn format gốc của file 1400+ dòng.
  - Cập nhật payload các request của Product (Get All Products, Create, Update) để đồng bộ với tính năng mới.

- **Hoàn thiện API cho màn hình Product Page (Sidebar Filter):**
  - Cập nhật API `GET /api/v1/products` hỗ trợ tham số `minPrice` và `maxPrice` để lọc sản phẩm trong khoảng giá (Price Range).
  - Cập nhật API `GET /api/v1/categories` bổ sung trường `_count.products` (đếm số lượng sản phẩm active trong mỗi danh mục) để hiển thị số lượng kế bên tên danh mục.
  - Kiểm tra và xác nhận 100% độ phủ API (Rating, Giảm giá, Tìm kiếm, Phân trang) so với bản thiết kế UI.
  - Cập nhật các biến query params mới (`minPrice`, `maxPrice`) vào request "Get All Products" trong Postman Collection.

- **Hoàn thiện 4 API nâng cao cho màn hình Product Details Page:**
  - **Quản lý biến thể sản phẩm (Product Variants)**: Thiết kế model `ProductVariant` và liên kết với `CartItem`/`OrderItem` (nullable để tương thích ngược). Tích hợp mảng `variants` vào luồng CRUD chi tiết, tạo và cập nhật sản phẩm.
  - **Thống kê đánh giá (Review Stats)**: Tạo API `GET /api/v1/products/:id/review-stats` để trả về tổng số review, điểm trung bình và tỷ lệ phần trăm phân bố theo số sao (1-5 sao).
  - **Tương tác bình luận (Review Interactions) & Quyền Đánh Giá**:
    - Bổ sung API `GET /api/v1/reviews/can-review/:targetType/:targetId` để kiểm tra quyền được phép đánh giá (chỉ cho phép user đã mua hàng/sử dụng dịch vụ và có đơn hàng `completed`).
    - Cập nhật hàm `createReview` ở Backend để block nghiêm ngặt những user chưa mua hàng hoặc đã đánh giá sản phẩm trước đó.
    - Bổ sung tính năng "Thích" bình luận (`POST /api/v1/reviews/:id/like` - toggle và tự động cập nhật `likes_count`).
    - Bổ sung tính năng "Trả lời" bình luận (`POST /api/v1/reviews/:id/reply` - self-relation `parent_id`).
    - Cập nhật API lấy bình luận theo target để chỉ lấy bình luận gốc và tự động trả về mảng `replies` lồng nhau.
  - **Sản phẩm tương tự (Related Products)**: Tạo API `GET /api/v1/products/:id/related` trả về tối đa 10 sản phẩm cùng danh mục bán chạy nhất.
  - **Giỏ hàng & Thanh toán (Hỗ trợ Biến thể & localStorage)**:
    - Bổ sung luồng lưu và truyền `variant_id` từ Giỏ hàng (`POST /api/v1/cart`) sang Đơn hàng (`POST /api/v1/orders/checkout`).
    - Nâng cấp API Checkout (`POST /api/v1/orders/checkout`) để hỗ trợ thanh toán trực tiếp từ `localStorage`: Nhận mảng `items` trực tiếp từ Frontend để kiểm tra giá và tồn kho an toàn trên Server, giúp loại bỏ hoàn toàn sự phụ thuộc vào giỏ hàng trên DB nếu cần.
    - Tự động lấy giá bán (`price`) và trừ tồn kho (`stock_quantity`) trực tiếp trên biến thể (Product Variant) thay vì trên sản phẩm gốc. Trả lại đúng tồn kho biến thể khi hủy đơn hàng.
  - **Đồng bộ Postman**: Bổ sung đầy đủ các request mới (`Can Review`, `Related Products`, `Review Stats`, `Like`, `Reply`) vào `Pet_Clinic_Collection.json` và cập nhật payload `items` cho Checkout.

---
## [Ngày 07/06/2026]
### Đã hoàn thành:
- **Cập nhật luồng Thanh toán (Checkout API):**
  - Thêm trường `note` vào model `Order` để hỗ trợ ghi chú cho đơn hàng.
  - Sửa lỗi `P2000` (độ dài `session_token`) khi đăng nhập bằng cách tăng giới hạn ký tự trong DB schema.
  - Viết lại toàn bộ hàm `checkoutCart` trong `orderAPIService.js` để hỗ trợ áp dụng mã giảm giá (`voucher_code`), tự động tính `discount_amount`, và hardcode `shipping_fee = 0` theo giao diện UI.
  - Lưu đầy đủ snapshot địa chỉ người nhận (`recipient_name`, `recipient_phone`, `shipping_address`) và tên sản phẩm (`item_name_snapshot`).
  - Ghi nhận lịch sử sử dụng mã giảm giá (`VoucherUsage`) và đồng bộ log thanh toán (`Payment`).
  - Cập nhật payload request `Checkout Order` trong file `Pet_Clinic_Collection.json` (thêm trường `note`).
- **Triển khai API Đặt đơn cho khách vãng lai (Guest Checkout API):**
  - Tạo API `POST /api/v1/orders/guest-checkout` không yêu cầu đăng nhập.
  - Tự động kiểm tra trùng lặp email và số điện thoại. Đặc biệt, nếu tài khoản trùng tồn tại nhưng ở trạng thái chưa kích hoạt (`inactive`), hệ thống sẽ tự động xóa tài khoản cũ đó để cho phép khách hàng đặt đơn và tạo tài khoản mới.
  - Tự động tạo tài khoản khách (`User`), địa chỉ mặc định (`UserAddress`), tạo đơn hàng (`Order`), lưu các mặt hàng (`OrderItem`), bản ghi thanh toán (`Payment`) và sử dụng mã giảm giá (`VoucherUsage`) trong cùng một Prisma transaction đảm bảo tính nhất quán (nếu có lỗi sẽ rollback toàn bộ).
  - Tự động gửi email bất đồng bộ chứa mật khẩu đăng nhập ngẫu nhiên (sinh tự động 10 ký tự có độ phức tạp cao) kèm mã đơn hàng sau khi tạo đơn thành công mà không gây ảnh hưởng đến hiệu năng hay chặn luồng tạo đơn của khách.
  - Cập nhật Payload Response API `Guest Checkout`: Trả về trực tiếp thông tin tài khoản vừa tạo (`guest_account` gồm `username` và `password` chưa mã hóa) trong `DT` để UI màn hình "Đặt hàng thành công" có thể hiển thị theo đúng thiết kế của Figma.
  - Cập nhật file Postman collection `Pet_Clinic_Collection.json` thêm request `Guest Checkout` đầy đủ payload mẫu và không cần auth token.
- **Đồng bộ hóa địa chỉ nhận hàng với UI Thiết kế (UserAddress Schema Update):**
  - Thêm trường `recipient_email` (Email người nhận) và `country` (Quốc gia) vào model `UserAddress` trong file `schema.prisma`.
  - Chạy migration đồng bộ cơ sở dữ liệu (`add_email_country_to_user_addresses`).
  - Cập nhật service `createAddress` và `updateAddress` trong `src/services/userAPIService.js` để nhận diện, lưu trữ và cập nhật 2 trường này.
  - Cập nhật các mẫu dữ liệu test (payload) trong Postman collection `Pet_Clinic_Collection.json` cho các request `Create Address` và `Update Address` để bao gồm 2 field mới này.
- **Khởi tạo dữ liệu mẫu (Seeding Database):**
  - Xây dựng script crawl dữ liệu thực tế từ hệ thống PetMart (100 sản phẩm, bao gồm hình ảnh, giá bán, mô tả, biến thể).
  - Phân bổ tự động 100 sản phẩm với trọng số tập trung vào "Thức ăn" (40 sp) và "Đồ dùng thiết yếu" (30 sp) theo yêu cầu.
  - Tích hợp logic sinh sản phẩm vào file `prisma/seed.js` gốc mà không làm mất dữ liệu seed của Roles và Users cũ.
  - Chạy `npx prisma migrate reset --force` để dọn sạch hoàn toàn rác Database, reset migration và tự động seed 1 bộ data hoàn chỉnh (tránh duplicate data).
  - Cập nhật file `README.md` lưu ý rõ cách chạy `seed` vs `migrate reset`.
