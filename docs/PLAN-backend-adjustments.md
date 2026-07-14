# Kế hoạch điều chỉnh và bổ sung API Backend

Kế hoạch này chi tiết hóa việc giải quyết 3 điểm thiếu sót lớn trên Backend nhằm đáp ứng hoàn chỉnh dữ liệu cho Frontend, dựa trên các quyết định tối ưu nhất:

---

## 1. Phương án kỹ thuật & Thiết kế

### A. Community: Bình luận và Thích bài viết
*   **Bình luận 2 cấp:** Chỉ hỗ trợ 2 cấp độ bình luận: bình luận chính (parent) và các câu trả lời trực tiếp (child). Đây là giải pháp phù hợp nhất để giữ cấu trúc dữ liệu đơn giản, truy vấn nhanh và dễ hiển thị ở giao diện.
*   **Cơ chế Thích:** Sử dụng duy nhất một API toggle `POST /posts/:id/like`. Khi gọi API, hệ thống tự động kiểm tra xem user đã thích bài viết chưa:
    *   Nếu rồi -> Xóa bản ghi `PostLike`, giảm `likes_count` của bài đăng và trả về `action: 'unliked'`.
    *   Nếu chưa -> Tạo bản ghi `PostLike`, tăng `likes_count` và trả về `action: 'liked'`.
*   **Cơ sở dữ liệu:** Cần bổ sung model `PostLike` vào `schema.prisma` để lưu quan hệ `Many-to-Many` giữa `User` và `Post`.

### B. Order Repay: Thanh toán lại đơn hàng
*   **Luồng xử lý:** Khi gọi API `POST /orders/:id/repay`, hệ thống sẽ cho phép thay đổi phương thức thanh toán (`payment_method` trong body).
*   **Đổi phương thức thanh toán:**
    *   Nếu đổi sang `cod` -> Cập nhật payment method của đơn hàng và chuyển trạng thái payment sang `pending`.
    *   Nếu đổi sang hoặc giữ nguyên `online` -> Tạo/Cập nhật bản ghi Payment với phương thức `online` và trả về URL thanh toán giả lập (sandbox URL) chứa thông tin số tiền và mã đơn hàng.
*   **Điều kiện thanh toán lại:** Đơn hàng phải có `payment_status: 'unpaid'` và `order_status` khác `'cancelled'`.

### C. Doctors: Lấy danh sách bác sĩ
*   **Thông tin chi tiết:** Truy vấn trực tiếp từ bảng `Doctor`, liên kết dữ liệu với bảng `User` (lấy tên, avatar), bảng `Branch` (thông tin chi nhánh làm việc) và bảng `DoctorSpecialty` / `Specialty` (lấy chuyên khoa của bác sĩ) để trả về thông tin đầy đủ nhất cho Frontend.

---

## 2. Kế hoạch thay đổi chi tiết

### [Component] Database Schema
#### [MODIFY] [schema.prisma](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/schema.prisma)
*   Thêm model `PostLike`:
    ```prisma
    model PostLike {
      user_id BigInt @db.BigInt
      post_id BigInt @db.BigInt

      user User @relation(fields: [user_id], references: [user_id], onDelete: Cascade, onUpdate: Cascade)
      post Post @relation(fields: [post_id], references: [post_id], onDelete: Cascade, onUpdate: Cascade)

      @@id([user_id, post_id])
      @@map("post_likes")
    }
    ```
*   Thêm quan hệ tương ứng vào model `User` và `Post`.

### [Component] API Routes
#### [MODIFY] [api.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/routes/api.js)
*   Đăng ký các route cho Community:
    *   `GET /posts/:id/comments` (Công khai)
    *   `POST /posts/:id/comments` (Yêu cầu đăng nhập)
    *   `POST /posts/comments/:commentId/reply` (Yêu cầu đăng nhập)
    *   `DELETE /posts/comments/:commentId` (Yêu cầu đăng nhập)
    *   `POST /posts/:id/like` (Yêu cầu đăng nhập)
*   Đăng ký route cho Order:
    *   `POST /orders/:id/repay` (Yêu cầu đăng nhập)
*   Đăng ký route cho Staff:
    *   `GET /doctors` (Công khai)

### [Component] Services & Controllers
#### [NEW/MODIFY] [contentAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/contentAPIService.js) & [contentController.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/controllers/contentController.js)
*   Viết logic cho bình luận bài viết và thích bài viết (tự động cập nhật `likes_count`).

#### [NEW/MODIFY] [orderAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/orderAPIService.js) & [orderController.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/controllers/orderController.js)
*   Viết logic `repayOrder` kiểm tra trạng thái và cập nhật/tạo mới bản ghi thanh toán.

#### [NEW/MODIFY] [userAPIService.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/services/userAPIService.js) & [userController.js](file:///d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/controllers/userController.js)
*   Viết logic `getDoctors` truy vấn bảng `Doctor` kèm `branch`, `doctor_specialties.specialty` và `user`.

---

## 3. Kế hoạch xác thực (Verification)

### Kiểm thử thủ công qua API
1.  **Chạy DB Push & Generate:** `npx prisma db push` và `npx prisma generate` để cập nhật Prisma Client.
2.  **Community:**
    *   Gọi `POST /posts/:id/like` kiểm tra lượt thích tăng/giảm và log trạng thái toggle.
    *   Gọi `POST /posts/:id/comments` tạo comment chính, gọi `POST /posts/comments/:commentId/reply` tạo câu trả lời và check cấu trúc lồng nhau qua `GET /posts/:id/comments`.
3.  **Order Repay:**
    *   Tạo đơn hàng chưa thanh toán -> gọi `/repay` với phương thức thanh toán online và COD để kiểm tra kết quả trả về.
4.  **Doctors:**
    *   Gọi `GET /doctors` kiểm tra định dạng JSON trả về có đầy đủ thông tin chi nhánh, chuyên khoa và thông tin tài khoản không.

---

## 4. Tài liệu bàn giao
*   Cập nhật Postman Collection `Pet_Clinic_Collection.json`.
*   Cập nhật log tiến trình trong `daily_progress.md`.
