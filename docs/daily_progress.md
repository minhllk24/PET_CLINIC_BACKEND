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

*(Bạn có thể tiếp tục copy format trên để ghi chú cho các ngày tiếp theo nhé)*
