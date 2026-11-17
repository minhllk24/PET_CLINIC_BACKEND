# BÁO CÁO NGHIỆM THU & BÀN GIAO BACKEND CHO FRONTEND
**Dự án:** Web2 - Pet Clinic (Dr. Pets House)  
**Phân hệ:** Content / Community, Appointments & First Aid  
**Ngày phát hành:** 17/11/2026  
**Tham chiếu tài liệu FE:** `WEB2_BE_Handoff_Community_Appointment_FirstAid_2026-11-16.docx`  
**Nhánh FE tích hợp:** `integration/admin-customer-backtotop-20261116` (Commit: `0b36e6a`)  
**Người thực hiện:** Senior Backend Engineer  

---

## 1. TỔNG QUAN KẾT QUẢ TRIỂN KHAI

Toàn bộ các yêu cầu từ P0 đến P1 trong tài liệu bàn giao ngày 16/11/2026 đã được triển khai hoàn tất, bao gồm cả việc **khắc phục 3 lỗi nghiêm trọng (blocking bugs)** tồn tại trước đó:

| STT | Phân hệ / Endpoint | Mức độ | Trạng thái trước | Kết quả sau triển khai |
| :---: | :--- | :---: | :--- | :--- |
| 1 | `POST /community/posts` | **P0** | Thiếu validate blob URL | **ĐÃ HOÀN TẤT:** Bắt buộc `status = PENDING`, chặn `blob:` URL, lưu `type` và `typeLabel`. |
| 2 | `GET /community/posts` | **P0** | Chưa bảo đảm 100% lọc status | **ĐÃ HOÀN TẤT:** Chỉ trả `APPROVED`. `REJECTED`, `PENDING`, `HIDDEN` bị loại bỏ hoàn toàn. |
| 3 | `PATCH /admin/community/posts/:id/moderate` | **P0** | Đã có | **ĐÃ HOÀN TẤT:** Duyệt/từ chối/ẩn/hiện, ghi nhận `moderatedBy`, `moderatedAt` và `moderationHistory`. |
| 4 | Tương tác Community (Comments/Likes/Replies) | **P0** | **Lỗi nghiêm trọng:** Bị đè bởi mock inline trả `comments: []` | **ĐÃ HOÀN TẤT:** Gỡ bỏ hoàn toàn mock inline, đấu nối trực tiếp vào `CommunityComment` & `likesCount` trong MongoDB. Hỗ trợ song song cả endpoint canonical và legacy. |
| 5 | `GET /first-aid/guides/:slug` & `GET /first-aid/guides` | **P1** | Chỉ trả `videoUrl` và `urgencyLevel` | **ĐÃ HOÀN TẤT:** DTO trả song song `urgent: boolean` + `urgencyLevel: string`, `video_url` + `videoUrl` (null khi không có video). |
| 6 | `GET /appointments/my-history` | **P0** | **Lỗi nghiêm trọng:** Lệch ID giữa `User._id` và `Customer._id` làm rỗng lịch sử | **ĐÃ HOÀN TẤT:** Tự động map `Customer.findOne({ userId })`, trả danh sách thật của đúng user, chặn truy cập khi chưa đăng nhập. |
| 7 | `POST /appointments/:id/start` | **P0** | Thiếu kiểm tra Check-in | **ĐÃ HOÀN TẤT:** Chặn cứng 422 `CHECKIN_REQUIRED` nếu lịch chưa hoàn tất Check-in tại quầy. Bắt buộc có `assignedStaffId`. |
| 8 | `POST /rescue/pets` (Hồ sơ cứu hộ) | **P0** | Manager gửi thiếu `branchId` bị lọt | **ĐÃ HOÀN TẤT:** Bắt buộc Manager phải gửi `branchId` thuộc quyền quản lý (`BRANCH_REQUIRED`), chặn 403 nếu ngoài quyền. |

---

## 2. CHI TIẾT CÁC THAY ĐỔI TRONG MÃ NGUỒN

### 2.1. File `src/modules/content/publicContent.routes.js`
* Gỡ bỏ toàn bộ các handler mock tĩnh (trước đây trả về `comments: []` và ID fake `cmt-${Date.now()}`).
* Định tuyến song song các alias URL để FE gọi theo chuẩn nào cũng thành công:
  * Comments: `GET/POST /community/posts/:id/comments` và `/posts/:id/comments`.
  * Replies: `POST /community/comments/:id/replies`, `/community/comments/:id/reply`, `/posts/comments/:commentId/reply`.
  * Likes: `POST /community/posts/:id/like`, `/posts/:id/like`, `POST /community/posts/:id/unlike`, `DELETE /posts/:id/like`.

### 2.2. File `src/modules/content/content.service.js`
* **`createCommunityPost`**:
  * Kiểm tra mảng `imageUrls`: Nếu có URL bắt đầu bằng `blob:` $\rightarrow$ trả mã lỗi `400 INVALID_MEDIA_URL`.
  * Bỏ qua trường `status` client truyền lên; luôn ép `status = 'PENDING'`.
  * Tự động khởi tạo hồ sơ `Customer` nếu user là thành viên mới.
* **`getPostBySlugPublic` & `getPostsPublic`**:
  * Chuẩn hóa DTO: Thêm trường `urgent` (true/false) tính từ `urgencyLevel === 'URGENT'`.
  * Chuẩn hóa trường video: Trả song song `video_url` và `videoUrl` (trả `null` nếu chuỗi rỗng để FE không kích hoạt video player rác).
* **`addCommunityComment` & `getCommunityComments`**:
  * Trả về DTO tương thích: Hỗ trợ alias `comments: items` và `totalRows: total`.
* **`createRescuePet`**:
  * Bổ sung kiểm tra vai trò `MANAGER`: Nếu không truyền `branchId` $\rightarrow$ quăng lỗi `400 BRANCH_REQUIRED`.

### 2.3. File `src/modules/booking/booking.service.js`
* **`getAppointments`**:
  * Đối với role `CUSTOMER`, truy vấn đồng thời cả `actor.id` (`User._id`) và `Customer._id` qua `$in: validCustomerIds`. Khách hàng luôn thấy lịch thật đã đặt của mình.
* **`getAppointmentById`**:
  * Đối với role `CUSTOMER`, cho phép truy cập nếu `appointment.customerId` khớp với `User._id` hoặc `Customer._id` của tài khoản đang đăng nhập.
* **`startSegment`**:
  * Bắt buộc kiểm tra `segment.assignedStaffId` $\rightarrow$ nếu thiếu trả `422 STAFF_NOT_ASSIGNED`.
  * Bắt buộc kiểm tra trạng thái Check-in (`checkInStatus === 'CHECKED_IN'` hoặc `checkedInAt != null`) $\rightarrow$ nếu chưa check-in trả `422 CHECKIN_REQUIRED`.

### 2.4. File `src/modules/booking/booking.controller.js`
* **`listAppointments`**:
  * Bổ sung chốt chặn: Nếu URL là `/my-history` mà không có token đăng nhập $\rightarrow$ trả ngay `401 UNAUTHENTICATED`, không trả nhầm dữ liệu của khách khác.

---

## 3. BẢNG MÃ LỖI CHUẨN HÓA DÀNH CHO FRONTEND

| HTTP Status | Mã lỗi nghiệp vụ (`code`) | Thông điệp hiển thị gợi ý cho FE |
| :---: | :--- | :--- |
| `400` | `INVALID_MEDIA_URL` | Ảnh dạng blob không hợp lệ. Vui lòng tải ảnh lên trước khi đăng bài. |
| `400` | `BRANCH_REQUIRED` | Quản lý bắt buộc phải chọn chi nhánh khi tạo hồ sơ thú cưng cứu hộ. |
| `401` | `UNAUTHENTICATED` | Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. |
| `403` | `AUTHORIZATION_ERROR` | Bạn không có quyền thực hiện thao tác này. |
| `403` | `FORBIDDEN` | Bạn không có quyền xem thông tin lịch hẹn này. |
| `409` | `SLOT_UNAVAILABLE` | Khung giờ này đã kín lịch. Vui lòng chọn khung giờ khác. |
| `422` | `CHECKIN_REQUIRED` | Bệnh nhân chưa hoàn tất Check-in tại quầy. Không thể bắt đầu ca khám. |
| `422` | `STAFF_NOT_ASSIGNED` | Dịch vụ chưa được phân công nhân viên chuyên môn. |

---

## 4. MINH CHỨNG KIỂM THỬ TỰ ĐỘNG (JEST TEST RESULTS)

File test: `tests/handoff-community-appointment-firstaid-2026-11-16.test.js`  
Chạy thực tế qua lệnh: `npx jest tests/handoff-community-appointment-firstaid-2026-11-16.test.js`  

```
PASS tests/handoff-community-appointment-firstaid-2026-11-16.test.js
  Handoff 2026-11-16 Verification: Community, Appointment, FirstAid
    1. Community Posts Requirements
      √ TC-01: Customer post is forced to PENDING status and cannot be bypassed (7 ms)
      √ TC-02: Rejects temporary blob URLs in imageUrls (13 ms)
      √ TC-03: Public feed query only returns APPROVED posts (2 ms)
    2. First Aid Guide DTO Contracts
      √ TC-04: Returns urgent boolean and clean video_url / videoUrl (2 ms)
      √ TC-05: Returns null for video_url when empty or missing (1 ms)
    3. Appointment Start Validations
      √ TC-06: Start rejects if appointment has NOT checked-in (14 ms)
      √ TC-07: Start rejects if assignedStaffId is missing (2 ms)
    4. Rescue Pet Branch Scope Enforcement
      √ TC-08: Rejects Manager creating rescue pet without branchId (2 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        1.898 s
```

---

## 5. HƯỚNG DẪN DÀNH CHO ĐỘI NGŨ FRONTEND

1. **Community Post:** Khi nhận phản hồi từ `POST /community/posts`, FE hiển thị thông báo *"Bài viết của bạn đã được gửi và đang chờ quản trị viên duyệt"*. Không cần tự chèn cờ mock.
2. **First Aid:** Binding trực tiếp `guide.urgent` cho thẻ badge "Khẩn cấp". Nếu `guide.video_url` có giá trị mới hiển thị Video Player, nếu `null` thì ẩn Player.
3. **Lịch hẹn của tôi (`/appointments/my-history`):** Đảm bảo truyền header `Authorization: Bearer <token>`. BE sẽ trả danh sách thật, không cần dùng fallback dữ liệu tĩnh.
4. **Bắt đầu ca khám:** Nút "Bắt đầu" ở màn hình Staff chỉ nên sáng lên khi lịch hẹn có trạng thái `CHECKED_IN`. Nếu bấm khi chưa check-in, BE sẽ trả lỗi `CHECKIN_REQUIRED`.
