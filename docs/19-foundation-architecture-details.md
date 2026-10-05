# Chi tiết Kiến trúc Nền tảng (Foundation Architecture) - MongoDB Backend

Tài liệu này mô tả chi tiết các thành phần cốt lõi (core foundation) đã được thiết lập cho hệ thống Backend mới sử dụng MongoDB. Đây là bộ khung chuẩn (Enterprise-grade) giúp toàn bộ team có thể thống nhất cách viết code, xử lý lỗi, logging và bảo mật.

---

## 1. Cấu trúc Thư mục (Directory Structure)

Kiến trúc mới tách biệt rõ ràng giữa khâu khởi chạy server và logic ứng dụng:

- `legacy/`: Chứa toàn bộ code cũ sử dụng MySQL và Prisma. Thư mục này chỉ để tham khảo, không được chạy hoặc import vào code mới.
- `src/server.js`: **Entry point** của ứng dụng. Chỉ chịu trách nhiệm kết nối Database (Mongoose), khởi động Express server (lắng nghe cổng 8080), và xử lý Graceful Shutdown (ngắt kết nối an toàn khi server bị tắt).
- `src/app.js`: Nơi cấu hình Express framework. Bao gồm các Middleware bảo mật, cấu hình CORS, Rate Limiting, Logging, OpenAPI Validator và gắn các Route (API).
- `src/shared/`: Chứa các module cốt lõi dùng chung toàn dự án (Config, Logger, Error Handler, Middlewares).

---

## 2. Quản lý Cấu hình (Configuration) - Fail-Fast

Mọi biến môi trường (`.env`) được quản lý tập trung tại `src/shared/config.js`.
- **Cơ chế Fail-Fast:** Hệ thống bắt buộc phải có các biến môi trường thiết yếu (ví dụ: `MONGODB_URI`, `JWT_ACCESS_TOKEN_SECRET`). Nếu khởi động server mà thiếu các biến này, server sẽ **báo lỗi và tự động dừng (process.exit(1))** thay vì để xảy ra lỗi ngầm lúc đang chạy (runtime).
- Giới hạn CORS: Chỉ cho phép các domain được khai báo qua biến `CUSTOMER_APP_URL` và `ADMIN_APP_URL`.

---

## 3. Quản lý Log (Logging & Traceability)

Hệ thống sử dụng thư viện `pino` (thông qua `src/shared/logger.js`) vì tốc độ cực nhanh và cấu trúc JSON chuẩn.
- **Correlation ID:** Mỗi request từ client gửi tới sẽ tự động được gán một mã ID duy nhất (`X-Correlation-Id`). Mã này sẽ đi theo toàn bộ vòng đời của request và được in ra ở mỗi dòng log. Điều này giúp dễ dàng truy vết (trace) lỗi trên Production.
- **Redaction (Che dữ liệu nhạy cảm):** Mọi log được cấu hình để tự động che lấp (`[REDACTED]`) các thông tin nhạy cảm như `password`, `otp`, `accessToken`, `refreshToken`,...

---

## 4. Chuẩn hóa Lỗi (Error Handling - RFC 9457)

Chúng ta đã **loại bỏ** kiểu trả lỗi tuỳ tiện. Mọi lỗi sinh ra (cố ý hoặc ngoại lệ) đều đi qua `src/shared/errorHandler.js` và được format theo chuẩn quốc tế **RFC 9457 (Problem Details for HTTP APIs)**.

**Ví dụ một JSON Lỗi trả về:**
```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Bad Request",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "correlationId": "9d08d298-6f30-418c-9a77-3606052d0f5d",
  "detail": "Request validation failed",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": ".body.email",
      "message": "must be a valid email",
      "code": "INVALID_FIELD"
    }
  ]
}
```
- Lớp `AppError` (`src/utils/AppError.js`) được dùng để chủ động ném lỗi. (Ví dụ: `throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'Không tìm thấy user');`)

---

## 5. Xác thực Dữ liệu Tự động (OpenAPI Validation)

Chúng ta không cần viết code kiểm tra từng trường dữ liệu (ví dụ: `if(!req.body.name) return error`).
- Thư viện `express-openapi-validator` được tích hợp thẳng vào `app.js`.
- Nó sẽ tự động đọc file tài liệu API (`docs/07-openapi-v5.yaml`).
- Nếu request (Body, Query, Params) gửi từ Frontend **không khớp** với tài liệu (thiếu biến bắt buộc, sai kiểu dữ liệu), validator sẽ ngay lập tức tự động trả về lỗi 400 Bad Request. Giúp Backend và Frontend luôn đồng bộ 100% với file Spec.

---

## 6. Quy ước Phản hồi (Response Convention)

- **Không dùng Envelope:** Loại bỏ kiểu `ApiResponse` (bọc data bên trong `{"status": "success", "data": {...}}`). 
- **Quy ước:** Với các request thành công (200 OK, 201 Created), API sẽ trả **trực tiếp tài nguyên (Raw Resource)** dưới dạng JSON. Dùng hàm `sendSuccess`, `sendCreated` từ `src/shared/responseHelpers.js`.
- Hỗ trợ hàm `createCursorPage(items, nextCursor)` chuẩn bị sẵn cho việc phân trang theo Cursor-based của dự án.

---

## 7. Xác thực & Phân quyền (Auth & Authorization)

Sử dụng khung `src/shared/authMiddleware.js`:
- `authenticate`: Middleware kiểm tra tính hợp lệ của JWT Token (Bearer). Nếu hợp lệ, tự động gán thông tin user vào `req.actor`.
- `requireRole`: Middleware phân quyền theo chức vụ. Ví dụ: `requireRole(['STAFF'], ['RECEPTIONIST'])` sẽ chỉ cho phép Nhân viên có sub-role là Lễ tân đi qua.

---

## 8. Sức khoẻ Hệ thống (Health Checks)

- Endpoint: `GET /api/v1/health` -> Kiểm tra xem server NodeJS có đang sống không.
- Endpoint: `GET /api/v1/health/ready` -> Kiểm tra xem Database MongoDB đã kết nối thành công (`readyState === 1`) chưa. (Rất quan trọng khi dùng Docker/Kubernetes để biết khi nào app sẵn sàng nhận traffic).

---

> **Note cho Developer:** Toàn bộ khung này đã được kiểm thử (verify) thành công. Khi phát triển các tính năng mới (CRUD), các bạn chỉ việc tạo Controller/Service tương ứng và khai báo đường dẫn vào Router, mọi yếu tố bảo mật, check lỗi, logging sẽ được nền tảng tự động lo!
