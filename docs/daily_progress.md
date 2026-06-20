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

---
## [Ngày 13/06/2026]
### Đã hoàn thành:
- **Cập nhật và tối ưu hóa file Seed dữ liệu mẫu (`prisma/seed.js`):**
  - **Logic sinh dữ liệu ngẫu nhiên phong phú:** Tích hợp các hàm helper tạo tên tiếng Việt (`generateRandomName`), loại bỏ dấu tiếng Việt để tạo email chuẩn hóa (`removeAccents`), và tự động sinh email ngẫu nhiên theo định dạng chuẩn (`generateRandomEmail`).
  - **Idempotency (Tránh trùng lặp dữ liệu):** Thêm logic kiểm tra số lượng bản ghi hiện có của từng role trước khi chèn mới, đảm bảo chỉ chèn phần chênh lệch để đạt mục tiêu:
    - 20 tài khoản **STAFF** hoạt động (`active`), mật khẩu mặc định `12345678`, ảnh đại diện từ Pravatar.
    - 15 tài khoản **DOCTOR** hoạt động (`active`), tiền tố "Dr.", mật khẩu mặc định `12345678`, ảnh đại diện từ Pravatar.
    - 35 tài khoản **CUSTOMER** hoạt động (`active`), mật khẩu mặc định `12345678`, ảnh đại diện từ Pravatar.
- **Seeding hồ sơ thú cưng (Pet Profiles & Pet Images):**
  - Phân tích và seed thành công dữ liệu liên kết giữa 4 bảng: `pet_species`, `pet_breeds`, `pets` và `pet_images`.
  - Mở rộng giống loài: Thêm 3 loài mới gồm `Chó`, `Hamster`, `Thỏ` bên cạnh loài `Mèo` có sẵn. Bổ sung **15 giống loài** mẫu tương ứng (Husky, Corgi, Golden Retriever, Thỏ Mini Lop, Hamster Roborovski, v.v.).
  - Phân bổ sở hữu thú cưng logic cho 35 CUSTOMER:
    - 15 khách hàng đầu tiên: Mỗi khách hàng sở hữu chính xác **1 hồ sơ thú cưng**.
    - 20 khách hàng tiếp theo: Mỗi khách hàng sở hữu ngẫu nhiên từ **2 đến 4 hồ sơ thú cưng**.
    - Tổng cộng đã tạo thành công **74 thú cưng** hoạt động (`active`), kèm đầy đủ thông tin chi tiết (tên, giới tính, ngày sinh, cân nặng, trạng thái sức khỏe ngẫu nhiên).
  - Tự động gán **1 đến 2 hình ảnh** thực tế chất lượng cao từ Unsplash cho mỗi thú cưng thông qua bảng `pet_images`, thiết lập chính xác ảnh chính (`is_primary: true`).
  - Toàn bộ cơ chế seed pet được bảo vệ bởi điều kiện `pet.count() === 0` để tránh bị chèn trùng khi chạy lại lệnh seed nhiều lần.
- **Thực thi và kiểm thử:**
  - Chạy thành công lệnh `npm run seed` (`babel-node prisma/seed.js`), đồng bộ hóa dữ liệu hoàn hảo vào MySQL Database.
- **Bổ sung và nâng cấp Seed dữ liệu cho Dịch vụ & Hồ sơ Bác sĩ (Grooming & Spa, Khám bệnh):**
  - **Khởi tạo Chi nhánh (Branches):** Khởi tạo thành công **2 chi nhánh** mẫu ("Chi nhánh Quận 10 (Chính)" và "Chi nhánh Bình Thạnh") nhằm phục vụ việc phân bổ bác sĩ khám và liên kết lịch hẹn.
  - **Seeding hồ sơ Bác sĩ chi tiết:** 
    - Đã seed chính xác **4 tài khoản Bác sĩ cụ thể** với thông tin kinh nghiệm (`bio`) và đánh giá thật được lấy từ thiết kế Figma: Bs. Trần Văn Nhân (20 năm kinh nghiệm), Bs. Võ Công Nam (14 năm kinh nghiệm), Bs. Nguyễn Thu Hồng (5 năm kinh nghiệm), Bs. Trần Phương Trâm (7 năm kinh nghiệm).
    - Tự động gán chi nhánh công tác ngẫu nhiên hoặc chỉ định, gán avatar từ Unsplash, đồng thời đồng bộ hóa hồ sơ bác sĩ cho tất cả 15 tài khoản DOCTOR trong hệ thống để tránh tình trạng tài khoản DOCTOR không có thông tin chi tiết ở bảng `doctors`.
  - **Phát triển Seed dữ liệu danh mục & dịch vụ khám/spa:**
    - Đổi tên và chuẩn hóa danh mục cũ `Khám bệnh` thành `Khám & Điều trị`.
    - Tạo mới 2 danh mục dịch vụ: `Grooming & Spa` và `Combo Grooming & Spa`.
    - Thêm đầy đủ **18 dịch vụ mẫu chi tiết** khớp 100% với giao diện UI Figma (bao gồm giá cả cơ bản, mô tả hoạt động chi tiết, thời gian thực hiện trung bình, hình ảnh Unsplash chất lượng cao). Trong đó có 3 combo hấp dẫn (Combo Tắm 11 bước, Combo Tắm cơ bản & cắt tỉa lông, Combo Chăm sóc & bảo vệ móng) và các dịch vụ khám chữa bệnh khác.
    - Logic chèn dữ liệu đảm bảo **tính Idempotency (không trùng lặp)** bằng cách kiểm tra trước sự tồn tại của dịch vụ và danh mục, tự động update nếu đã có sẵn và chỉ chèn mới khi chưa tồn tại.

### Vấn đề cần lưu ý (Next Steps):
- Dữ liệu mẫu phong phú của 74 thú cưng, 15 bác sĩ (kèm profile chi tiết ở bảng `doctors`), 3 danh mục dịch vụ lớn và 19 dịch vụ chi tiết đã sẵn sàng hoạt động ở Backend.
- Frontend có thể kết nối ngay để hiển thị giao diện danh sách thú cưng, danh sách bác sĩ, và danh mục dịch vụ một cách trực quan nhờ hình ảnh thực tế đã được seed.

---
## [Ngày 20/06/2026]
### Đã hoàn thành:
- **Bổ sung và tối ưu hóa hệ thống API Blog phục vụ màn hình Blog nền tảng (Figma):**
  - **Cập nhật Database Schema**: Bổ sung trường `excerpt` (tóm tắt ngắn bài viết) và `is_featured` (bài viết nổi bật) vào bảng `Post` trong Prisma Schema, đã sinh và chạy migration thành công.
  - **Khắc phục các bug nghiêm trọng trong service bài viết (`contentAPIService.js`)**:
    - Sửa lỗi sử dụng cột không tồn tại `published_at` sang dùng cột `created_at` để sắp xếp bài viết.
    - Sửa lỗi hàm `createPost` bị lỗi schema do truyền sai tên cột (`author_id` -> `author_user_id`).
    - Đồng bộ hóa các enum giá trị `post_type` (từ `'community_post'` sang `'community'`).
  - **Triển khai 3 API GET mới**:
    - `GET /api/v1/post-categories`: Lấy danh sách danh mục bài viết đang hoạt động (`status: 'active'`).
    - `GET /api/v1/posts/featured`: Lấy ra 1 bài viết nổi bật duy nhất có cờ `is_featured = true`.
    - `GET /api/v1/posts/trending?limit=4`: Lấy top bài viết xu hướng theo số lượng lượt xem (`view_count`) giảm dần.
  - **Cải tiến API Lấy danh sách bài viết (`GET /api/v1/posts`)**:
    - Hỗ trợ lọc bài viết linh hoạt theo danh mục qua tham số `categoryId`.
    - Tự động map và chuẩn hóa tham số `type` (hỗ trợ cả `community_post` và `community`).
    - Tự động lọc bỏ bài viết nổi bật khỏi danh sách chung (`is_featured: false`) để tránh lặp dữ liệu trên UI.
    - Tối ưu hóa truy vấn Prisma chỉ select các trường dữ liệu cần thiết (tránh trả về `content` quá lớn khi lấy danh sách) và include các thông tin quan hệ của tác giả (`author`) và danh mục (`category`).
- **Nâng cấp API phục vụ màn hình Chi tiết bài viết (Blog Detail):**
  - **Tự động tăng lượt xem (`view_count`)**: Lập trình cơ chế tự động tăng lượt xem nguyên tử (atomic increment) theo phương thức *fire-and-forget* khi gọi API lấy chi tiết bài viết theo slug (`GET /api/v1/posts/:slug`).
  - **Hỗ trợ loại trừ bài viết đang xem (`excludeId`)**: Thêm tham số `excludeId` vào API `GET /api/v1/posts` để loại trừ bài viết hiện tại ra khỏi kết quả, hỗ trợ tối đa cho việc hiển thị "Bài viết liên quan" (Related Posts).
- **Khởi tạo dữ liệu mẫu cho Blog & Blog Detail (Seeding)**:
  - Cập nhật file [seed.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/seed.js) tự động tạo 4 danh mục bài viết chuẩn thiết kế: *Sức khỏe*, *Dinh dưỡng*, *Tâm lý*, *Vệ sinh & Làm đẹp*.
  - Khởi tạo **1 bài viết nổi bật** (`is_featured: true`) có đầy đủ tiêu đề, tóm tắt ngắn, nội dung chi tiết dạng HTML và ảnh đại diện chất lượng cao.
  - Khởi tạo **4 bài viết xu hướng** (Trending Posts) với số lượng lượt xem giả lập lớn để kiểm thử tính năng lọc theo `view_count` giảm dần.
  - Khởi tạo **5 bài viết thường** khác nhau thuộc cả 2 loại `official_blog` và `community` phục vụ phân trang và bộ lọc theo danh mục.
  - Khởi tạo **các bình luận mẫu** (bao gồm cả câu trả lời lồng nhau từ admin) cho bài viết nổi bật để demo giao diện phần bình luận trong màn hình chi tiết.
- **Đồng bộ hóa Postman Collection**:
  - Thêm đầy đủ 3 API mới và cập nhật các tham số truy vấn nâng cao cho `Get All Posts` (bổ sung trường `excludeId`) và body payload cho `Create Post` (thêm trường `excerpt`) vào file Postman collection `Pet_Clinic_Collection.json`.
  - Cập nhật mô tả chi tiết của request `Get Post By Slug` để ghi nhận cơ chế tăng lượt xem tự động.
  - Bổ sung request `"Get Community Posts"` chuyên biệt để hỗ trợ Frontend dễ dàng lọc, hiển thị danh mục bài viết từ cộng đồng.
- **Bổ sung Dữ liệu & Tính năng phục vụ Màn hình "Cộng đồng chia sẻ" (Community Blog)**:
  - **Cập nhật Database Schema & Migration**: Thêm cột `likes_count` (lượt thích) và `hashtags` (danh sách hashtags dạng chuỗi phân tách bằng dấu phẩy) vào model `Post` trong `schema.prisma`. Đã chạy migration thành công.
  - **Nâng cấp Service Layer**: Sửa đổi `getPosts`, `getFeaturedPost` và `getTrendingPosts` trong `contentAPIService.js` để trả về `likes_count`, `hashtags` và đếm số lượng bình luận thực tế từ bảng `PostComment` qua `_count: { select: { comments: true } }`.
  - **Cải tiến và mở rộng Seed Data (`seed.js`)**:
    - Khởi tạo 2 tài khoản tác giả khách hàng (`Hoàng Nam`, `Mai Anh`) làm người sáng tạo bài viết trên cộng đồng.
    - Thêm 8 bài viết cộng đồng (Community Posts) mới với đầy đủ thông tin thực tế, hình ảnh Unsplash chất lượng cao, lượt thích (`likes_count`) giả lập đa dạng và chuỗi `hashtags` chuẩn thiết kế.
    - **Sửa lỗi ReferenceError**: Khắc phục lỗi biến `customers` chưa được định nghĩa khi seeding bình luận của bài viết nổi bật.
    - **Seeding bình luận phong phú**: Tự động sinh ngẫu nhiên từ 2-3 bình luận thực tế từ các tài khoản khách hàng khác nhau cho mỗi bài viết cộng đồng, từ đó hiển thị được số lượng bình luận động chính xác trên UI.
- **Kiểm thử hệ thống**: Chạy lại thành công lệnh `npm run seed` (`babel-node prisma/seed.js`), đồng bộ hóa dữ liệu hoàn hảo vào cơ sở dữ liệu. Khởi chạy server kiểm tra toàn bộ các API Blog đều hoạt động trơn tru và trả về dữ liệu chuẩn cấu trúc.
- **Triển khai API & Dữ liệu mẫu cho màn hình "Cẩm nang sơ cứu" (First Aid Guides)**:
  - **Cập nhật Database Schema**: Bổ sung trường `slug` (unique) vào model `FirstAidGuide` trong `prisma/schema.prisma` và đồng bộ cấu trúc cơ sở dữ liệu.
  - **Nâng cấp Service Layer (`contentAPIService.js`)**:
    - Nâng cấp `getFirstAidGuides` hỗ trợ các bộ lọc nâng cao như danh mục (`categoryId`), tìm kiếm từ khóa (`search`), loại trừ bài viết đang xem (`excludeId`), và phân trang.
    - Triển khai `getFirstAidGuideBySlug` lấy thông tin chi tiết bài viết kèm danh sách các bước (`steps`) và file đính kèm (`media`).
    - Triển khai `getFirstAidCategories` lấy toàn bộ danh mục sơ cứu đang hoạt động (`status = active`).
    - Sửa đổi hàm `createFirstAidGuide` để xử lý chính xác các trường dữ liệu.
  - **Controller & Route Layer**: Đăng ký các handler tương ứng trong `contentController.js` và định tuyến các API sơ cứu mới trong `src/routes/api.js`.
  - **Seeding dữ liệu mẫu (`seed.js`)**: Cập nhật dữ liệu cho 4 danh mục sơ cứu (*Tai nạn*, *Ngộ độc*, *Khó thở*, *Chấn thương*) cùng 4 cẩm nang mẫu chi tiết có hình ảnh minh họa chất lượng cao từ Unsplash, các bước thực hiện tuần tự và video hướng dẫn (Heimlich cho chó bị hóc, xử lý mèo ngộ độc thực phẩm, sơ cứu bỏng, xử lý vết thương cắn nhau).
  - **Đồng bộ Postman Collection**: Thêm thư mục `17. First Aid Guides` chứa các request chi tiết (`Get First Aid Categories`, `Get All First Aid Guides`, `Get First Aid Guide By Slug`, `Create First Aid Guide`) vào file `Pet_Clinic_Collection.json`.
  - **Xác thực**: Chạy thử nghiệm thành công script kiểm thử và xác minh toàn bộ các API hoạt động đúng logic nghiệp vụ và trả về định dạng dữ liệu chuẩn.

