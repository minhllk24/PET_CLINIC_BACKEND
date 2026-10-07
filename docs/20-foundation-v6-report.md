# Báo cáo Tiến độ: Hoàn thành Foundation Backend (Spec v6) - V2

**Kính gửi:** Nhóm trưởng / Quản lý dự án
**Ngày cập nhật:** 07/10/2026
**Branch hoàn thành:** `feat/foundation-v6`

---

## 1. Mục tiêu và Phạm vi

Báo cáo này tổng hợp việc hoàn thiện xây dựng bộ khung (Foundation) cho Backend sau khi đã **khắc phục toàn bộ 6 lỗi theo feedback của Nhóm trưởng**, đặc biệt là vấn đề kết nối MongoDB và chuẩn hóa API contract theo Spec v6.

## 2. Kết quả Đạt được (Những gì đã hoàn thành)

Chúng ta đã thiết lập thành công các thành phần cốt lõi sau:

### 2.1. Cấu trúc Server và Cơ sở dữ liệu
- **Express.js & Modular Monolith:** Phân tách rõ ràng giữa `app.js` (middleware/routes) và `server.js` (khởi chạy server và kết nối DB).
- **Graceful Shutdown (Mongoose 8):** Cập nhật phương thức đóng server bằng `async/await`, loại bỏ callback lỗi thời của Mongoose 8. Quá trình dừng server (khi nhận `SIGINT`/`SIGTERM`) nay hoạt động trơn tru không rò rỉ tài nguyên.
- **MongoDB:** `.env.example` và `README.md` đã được viết lại, cung cấp tài liệu setup hoàn toàn bằng MongoDB. Bất kỳ ai clone project về đều có thể chạy ngay với `MONGODB_URI` mà không dính dáng tới MySQL. Toàn bộ mã nguồn cũ đã được dọn sang thư mục `legacy/`.

### 2.2. Xử lý Lỗi Toàn cục (Global Error Handling)
- **Chuẩn RFC 9457:** Xây dựng cơ chế bắt lỗi tập trung (`src/shared/errorHandler.js`) trả về JSON format chuẩn theo yêu cầu của Spec v6 (bao gồm `type`, `title`, `status`, `code`, `correlationId`, `instance`).
- **32 Mã lỗi (ErrorCodes):** Cập nhật danh sách 32 mã lỗi nghiệp vụ thành nguồn sự thật duy nhất (Single Source of Truth) tại `src/shared/errorCodes.js` (VD: `STAFF_ROLE_MISMATCH`, `SLOT_UNAVAILABLE`).
- **Bắt lỗi Middleware & Cơ sở dữ liệu:** Tự động bắt và chuẩn hóa các lỗi phổ biến như:
  - Lỗi Payload Too Large (413) -> chuyển thành `VALIDATION_ERROR`.
  - Lỗi JSON Parse Error (400) -> chuyển thành `VALIDATION_ERROR`.
  - Lỗi Mongoose (Duplicate Key, Invalid ID) -> chuyển đổi tự động sang `CONFLICT`, `NOT_FOUND`.

### 2.3. Cổng Bảo mật và Xác thực Dữ liệu (Validation & Security)
- **OpenAPI Validator:** Tích hợp middleware tự động kiểm tra payload dựa trên file `07-openapi-v6.yaml`. Bất kỳ request nào sai cấu trúc sẽ nhận 400 `VALIDATION_ERROR`. Đặc biệt, các lỗi thiếu token (401) hoặc sai quyền (403) từ validator đã được map chuẩn xác sang `AUTHENTICATION_ERROR` và `AUTHORIZATION_ERROR` thay vì `INTERNAL_ERROR`.
- **CORS & Rate Limiting:** 
  - Đã chuyển vị trí `httpLogger` lên trên cùng để đảm bảo **mọi lỗi CORS (403) và Rate Limit (429) đều có X-Correlation-Id** trả về cho client.
  - Lỗi Rate Limit (429) nay được ném qua Error Handler, trả về JSON chuẩn RFC 9457 với code `RATE_LIMIT` thay vì raw JSON của thư viện.

### 2.4. Logging & Theo dõi (Observability)
- **Pino Logger:** Tích hợp logging hiệu suất cao bằng `pino`.
- **Correlation ID:** Tự động sinh hoặc kế thừa `X-Correlation-Id` cho mỗi request. ID này được đính kèm vào log, trả về qua header và xuất hiện trong body lỗi, giúp team dễ dàng truy vết (trace) luồng xử lý và tìm nguyên nhân lỗi.

### 2.5. Kiểm thử Tự động & Nghiệm thu
- **Môi trường Test Độc lập:** Bổ sung `tests/setup.js` thiết lập các biến môi trường giả lập, không phụ thuộc thông tin thật.
- **Test Coverage (10/10 PASS):** Viết thêm các bộ test mở rộng bằng `Jest` + `Supertest`:
  - Kiểm thử `413 VALIDATION_ERROR` khi payload > 1MB.
  - Kiểm thử `429 RATE_LIMIT` khi gọi quá giới hạn cấu hình.
  - Kiểm thử `403 AUTHORIZATION_ERROR` khi giả mạo Origin.
  - Kiểm thử `401 AUTHENTICATION_ERROR` khi gọi các route bảo mật thiếu token.
  - Kiểm tra readiness `/api/v1/health/ready` trả `503 INTERNAL_ERROR` khi rớt mạng DB và `200 ready` khi kết nối thành công.
- **Kiểm chứng DB thật:** Đã chạy thử server local nối thẳng vào MongoDB Atlas thật và xác minh endpoint trả 200, log ra màn hình rõ ràng. Không commit URL credential vào Git.

## 3. Thu hoạch và Điểm nghẽn đã giải quyết

- **Giải quyết triệt để lỗi khởi động:** Đã fix lỗi server crash do trỏ nhầm file spec cũ, server hiện tại hoạt động trơn tru với `v6`.
- **An toàn hơn khi Dev vs Prod:** Bật chế độ `validateResponses` khi dev (để nhắc nhở lập trình viên nếu trả về sai định dạng cam kết), nhưng tự động tắt trên production để tối ưu tốc độ.
- **Bảo vệ rò rỉ dữ liệu:** `errorHandler` được cấu hình để ẩn chi tiết lỗi hệ thống khi `status = 500`, tránh rò rỉ stack trace ra bên ngoài.

## 4. Kế hoạch tiếp theo

Foundation hiện đã hoàn toàn sẵn sàng. Nhóm có thể bắt đầu song song thực hiện các Module nghiệp vụ lớn:
1. **Module Authorization/Authentication:** Dựa vào `authMiddleware.js` để viết chức năng phân quyền chi tiết (JWT, Staff Role Validation).
2. **Module Booking & Appointment:** Bắt đầu code luồng đặt lịch phức tạp (Segment, Staffing) của spec v6.
3. **Triển khai CI/CD:** Đưa Jest test vào pipeline Github Actions để tự động kiểm tra mỗi khi có Push/PR.

---
**Trạng thái nhánh code:** Code đã được commit và Push lên GitHub tại nhánh `feat/foundation-v6`. Nhóm trưởng có thể Review và Merge PR.
