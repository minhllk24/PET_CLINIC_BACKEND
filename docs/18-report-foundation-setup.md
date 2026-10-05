# Báo cáo Tiến độ Backend: Khởi tạo Foundation MongoDB

**Người báo cáo:** [Tên của bạn]
**Nhánh (Branch):** `feat/mongo-foundation`
**Trạng thái Task:** DONE ✅

---

## 🎯 1. Các mục tiêu đã hoàn thành (Achieved Goals)
Đã hoàn tất toàn bộ 4 đầu mục được giao ban đầu nhằm chuẩn bị nền tảng (foundation) cho kiến trúc mới:

1. **Dựng server structure và MongoDB connection:**
   - Tách bạch rõ ràng `src/app.js` (Express App) và `src/server.js` (Khởi chạy mạng & DB).
   - Thiết lập kết nối thành công với MongoDB Atlas. Cấu hình Graceful Shutdown để ngắt kết nối an toàn khi tắt server.
   - Các file cũ (dùng MySQL/Prisma) đã được cô lập an toàn vào thư mục `legacy/` để tiện đối chiếu mà không gây nhiễu mã nguồn mới.

2. **Thiết lập config, logging cơ bản, error handler, validation:**
   - **Config Fail-fast:** Hệ thống sẽ từ chối khởi động nếu thiếu các biến môi trường quan trọng (như MONGODB_URI) nhằm tránh lỗi ngầm trên Production.
   - **Logging nâng cao:** Cài đặt `pino` logger sinh tự động `X-Correlation-Id` cho mỗi request giúp dễ dàng truy vết lỗi, đồng thời tự động che (redact) mật khẩu/token khi in log.
   - **Global Error Handler:** Toàn bộ lỗi được bắt tập trung và format chuẩn theo cấu trúc **RFC 9457 (Problem JSON)** khớp hoàn toàn với OpenAPI Spec của team.
   - **Validation:** Tích hợp `express-openapi-validator`, tự động đối chiếu data client gửi lên với file thiết kế `07-openapi-v5.yaml`. Báo lỗi 400 Bad Request ngay nếu sai kiểu dữ liệu.

3. **Tạo response format thống nhất và auth middleware skeleton:**
   - Xóa bỏ kiểu response bọc trong `ApiResponse` cũ, thay bằng format RESTful nguyên bản (2xx trả thẳng data).
   - Đã dựng sẵn khung `authMiddleware.js` (`authenticate` và `requireRole`) đáp ứng đúng ma trận phân quyền mới (`systemRole` và `staffSubRole`).

4. **Tạo base route/health check:**
   - Đã cung cấp endpoint `GET /api/v1/health` và `GET /api/v1/health/ready` để Frontend config Base URL và DevOps (Docker/K8s) kiểm tra tình trạng kết nối DB.

---

## 💡 2. Những điểm thu hoạch & Kỹ thuật áp dụng (Highlights)
- **Chuẩn hóa API Contract-First:** Việc dùng OpenAPI file làm nguồn sự thật (source of truth) cho `express-openapi-validator` giúp Backend không phải tự viết code check từng field `if (!req.body.name)`, tiết kiệm rất nhiều thời gian và luôn đồng bộ với file thiết kế của Boss.
- **Bảo mật (Security):** Tích hợp sẵn `helmet`, `cors` (chỉ cho phép các Origin cụ thể), và `express-rate-limit` để chống spam API.

---

## ⏭️ 3. Đề xuất việc tiếp theo (Next Steps)
Nền tảng đã cực kỳ vững chắc, sẵn sàng chia task cho các thành viên trong nhóm:
1. Viết Authentication Service (Login, Generate JWT, Refresh Token).
2. Xây dựng MongoDB Models (Mongoose schema) dựa trên file thiết kế.
3. Triển khai các CRUD API (User, Branch, v.v.).
