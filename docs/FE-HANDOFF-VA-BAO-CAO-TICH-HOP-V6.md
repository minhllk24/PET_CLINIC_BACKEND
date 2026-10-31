# BÁO CÁO & TÀI LIỆU HANDOFF TÍCH HỢP DÀNH CHO FRONTEND (WEB 2 & ANGULAR)
> **Dự án:** Hệ Thống Chuỗi Phòng Khám & Thương Mại Điện Tử Dr. Pet's House  
> **Phiên bản Backend:** Foundation v6 (Live Atlas)  
> **Thời điểm bàn giao:** 31/10/2026  
> **Backend Host:** `https://pet-clinic-backend-a4lj.onrender.com/api/v1` (hoặc `http://localhost:5000/api/v1`)  
> **Trạng thái Database:** ✅ **100% SẠCH SẼ - 112 SẢN PHẨM THẬT - 0 BẢN GHI RÁC**  

---

## 📌 MỤC LỤC
1. [Tóm tắt Điều hành & Câu trả lời trọng tâm](#1-tóm-tắt-điều-hành--câu-trả-lời-trọng-tâm)
2. [Hạng mục 1: Các API MỚI Backend vừa mở — FE cần nối ngay](#2-hạng-mục-1-các-api-mới-backend-vừa-mở--fe-cần-nối-ngay)
   - 2.1 API Thống kê Đơn hàng: `GET /api/v1/orders/stats` (Admin Dashboard & Orders)
   - 2.2 API Xóa Ca trực Nhân sự: `DELETE /api/v1/shifts/:id` (Quản lý ca trực)
   - 2.3 API & DTO Flash Sale Voucher: `GET /api/v1/vouchers?isFlashSale=true` (Home & Checkout)
3. [Hạng mục 2: Các trường DTO MỚI Backend bổ sung — FE dùng trực tiếp](#3-hạng-mục-2-các-trường-dto-mới-backend-bổ-sung--fe-dùng-trực-tiếp)
   - 3.1 Ảnh sản phẩm phẳng: `thumbnailUrl` & `image` (Tránh lỗi trắng ảnh)
   - 3.2 Mã thẻ nhân viên: `staffCode`
   - 3.3 Mã đơn hàng & Lịch hẹn chuẩn doanh nghiệp
4. [Hạng mục 3: Các điểm Backend đã tự động xử lý — FE không cần sửa code](#4-hạng-mục-3-các-điểm-backend-đã-tự-động-xử-lý--fe-không-cần-sửa-code)
   - 4.1 Hết hạn Token UAT: Nâng lên 8 tiếng (không bị logout sau 15 phút)
   - 4.2 Sửa lỗi crash khi gọi API Catalog không truyền tham số
   - 4.3 Database Atlas đã sạch 100% không còn chữ UAT/CUST/TEST
5. [Thông tin Tài khoản Đăng nhập & URL Giao diện Admin](#5-thông-tin-tài-khoản-đăng-nhập--url-giao-diện-admin)
6. [Bảng Checklist Nghiệm thu Tích hợp FE - BE](#6-bảng-checklist-nghiệm-thu-tích-hợp-fe---be)

---

## 1. TÓM TẮT ĐIỀU HÀNH & CÂU TRẢ LỜI TRỌNG TÂM

### ❓ Phía Frontend có cần nối gì không?
**CÓ.** Phía FE có **3 hạng mục cần nối/cập nhật** để hoàn thiện giao diện nghiệm thu:
1. **Nối API Thống kê Đơn hàng (`GET /api/v1/orders/stats`):** Hiện tại trang `AdminDashboardPageComponent` và `AdminOrdersPageComponent` trong Angular đang là trang khung tĩnh ("Operational UI will be implemented later"). FE nối API này để hiển thị các thẻ KPI / Badge đếm đơn hàng tự động.
2. **Nối API Xóa Ca trực (`DELETE /api/v1/shifts/:id`):** Dành cho Quản lý / Admin xóa ca trực phân công nhầm (chỉ xóa được ca chưa diễn ra và chưa có khách đặt).
3. **Cập nhật hiển thị Ảnh Sản phẩm (`thumbnailUrl` / `image`):** Thay vì phải map mảng `images[]`, FE chỉ cần bind trực tiếp trường `thumbnailUrl` để hiện 100% ảnh Unsplash sắc nét từ 112 sản phẩm thật.
4. **Hiển thị Flash Sale Voucher:** Dùng cho Banner đếm ngược trên Trang chủ hoặc Giỏ hàng.

### ❓ Báo cáo này tên gì?
Tên chính thức của tài liệu này trong hệ thống:  
👉 **`docs/FE-HANDOFF-VA-BAO-CAO-TICH-HOP-V6.md`**  
*(Được lưu trữ trực tiếp trong thư mục tài liệu kỹ thuật của dự án để FE tham chiếu lâu dài).*

---

## 2. HẠNG MỤC 1: CÁC API MỚI BACKEND VỪA MỞ — FE CẦN NỐI NGAY

### 2.1 API Thống kê Đơn hàng (`GET /api/v1/orders/stats`)
* **Vị trí tích hợp trên FE:**
  * Trang **Admin Dashboard**: Thẻ tổng quan tình hình kinh doanh.
  * Trang **Quản lý Đơn hàng (Admin Orders)**: Các tab bộ lọc trạng thái (Tất cả, Chờ xử lý, Đã xác nhận, Đang giao, Đã giao, Đã hủy).
* **Endpoint:** `GET /api/v1/orders/stats`
* **Headers:**
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
* **Query Parameters (Tùy chọn):**
  * `branchId`: Lọc theo ID chi nhánh (nếu không truyền, ADMIN sẽ thấy tổng 3 chi nhánh, MANAGER sẽ tự động bị giới hạn theo chi nhánh quản lý).
  * `dateFrom` (hoặc `startDate`): Ngày bắt đầu (`YYYY-MM-DD`).
  * `dateTo` (hoặc `endDate`): Ngày kết thúc (`YYYY-MM-DD`).
* **Response mẫu (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "total": 59,
      "pending": 8,
      "confirmed": 12,
      "processing": 10,
      "shipping": 15,
      "shipped": 15,
      "completed": 10,
      "cancelled": 4
    }
  }
  ```

---

### 2.2 API Xóa Ca trực Nhân sự (`DELETE /api/v1/shifts/:id`)
* **Vị trí tích hợp trên FE:** Trang Quản lý Nhân sự & Phân ca (`/admin/shifts` hoặc Modal chi tiết ca làm việc).
* **Endpoint:** `DELETE /api/v1/shifts/:id`
* **Quyền hạn:** `ADMIN`, `MANAGER` (Manager chỉ được xóa ca thuộc chi nhánh mình).
* **Quy tắc an toàn (Fail-Safe) đã cài đặt sẵn ở Backend:**
  * **Trường hợp 1 (Hợp lệ):** Ca trực trong tương lai, chưa có khách hàng đặt lịch $\rightarrow$ Trả về `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "success": true,
        "message": "Shift deleted successfully",
        "id": "672322bf9b1d8b2bad000101"
      }
    }
    ```
  * **Trường hợp 2 (Ca đã bắt đầu hoặc hoàn thành):** Trả về `400 Bad Request`:
    ```json
    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Cannot delete shift that has already started or completed. Please cancel it instead."
      }
    }
    ```
    *Gợi ý FE:* Hiển thị thông báo Toast cảnh báo người dùng chuyển sang bấm nút "Hủy ca" (`cancelShift`).
  * **Trường hợp 3 (Đang có lịch hẹn của khách):** Trả về `409 Conflict`:
    ```json
    {
      "success": false,
      "error": {
        "code": "CONFLICT",
        "message": "Cannot delete shift with existing confirmed appointments"
      },
      "affectedAppointmentIds": ["672322bf9b1d8b2bad000201"]
    }
    ```
    *Gợi ý FE:* Báo lỗi "Không thể xóa ca do đã có lịch hẹn đặt trước của khách hàng".

---

### 2.3 API & DTO Flash Sale Voucher (`isFlashSale`)
* **Vị trí tích hợp trên FE:**
  * **Trang chủ (Home Page):** Banner giờ vàng Flash Sale kèm đồng hồ Countdown.
  * **Trang Giỏ hàng / Thanh toán:** Danh sách mã giảm giá nổi bật.
* **Endpoint lấy danh sách Flash Sale:**
  ```http
  GET /api/v1/vouchers?isFlashSale=true&status=ACTIVE
  ```
* **Cấu trúc DTO Voucher mới:**
  ```json
  {
    "id": "672322bf9b1d8b2bad000301",
    "code": "FLASHSALE30",
    "name": "⚡ FLASH SALE 30% - Giờ vàng giảm giá đơn hàng",
    "discountType": "PERCENTAGE",
    "discountValue": 30,
    "maxDiscountAmount": 80000,
    "minOrderAmount": 100000,
    "isFlashSale": true,
    "flashSaleStartTime": "2026-10-31T14:00:00.000Z",
    "flashSaleEndTime": "2026-10-31T20:00:00.000Z",
    "status": "ACTIVE"
  }
  ```
* **FE xử lý Countdown Timer:**
  Tính khoảng cách thời gian từ `new Date()` đến `new Date(voucher.flashSaleEndTime)`. Khi hết giờ, hiển thị trạng thái "Hết giờ vàng".

---

## 3. HẠNG MỤC 2: CÁC TRƯỜNG DTO MỚI BACKEND BỔ SUNG — FE DÙNG TRỰC TIẾP

### 3.1 Ảnh sản phẩm phẳng: `thumbnailUrl` & `image`
* **Vấn đề cũ trên FE:** Một số component hiển thị thẻ sản phẩm bị lỗi trắng ảnh / placeholder do FE tìm kiếm `item.image` nhưng Backend trả về mảng `item.images: [{ url, isPrimary }]`.
* **Cải tiến của Backend:** API `GET /api/v1/products` và `GET /api/v1/products/:id` đã tự động bổ sung sẵn:
  * `thumbnailUrl`: Chuỗi URL ảnh chính (primary image) hoặc ảnh đầu tiên.
  * `image`: Chuỗi URL dự phòng tương đương.
* **Cách FE viết code:**
  ```html
  <!-- Angular Template -->
  <img [src]="product.thumbnailUrl || product.image || 'assets/images/default-pet.png'" [alt]="product.name" />
  ```
  ```jsx
  // React JSX
  <img src={product.thumbnailUrl || product.image || "/assets/images/default-pet.png"} alt={product.name} />
  ```
  👉 **Kết quả:** 112 sản phẩm đều lập tức hiển thị ảnh Unsplash chất lượng cao.

### 3.2 Mã thẻ nhân viên (`staffCode`)
* **Endpoint:** `GET /api/v1/staff`, `GET /api/v1/staff/:id`
* **Trường mới:** `staffCode` (chuỗi dạng `ADMIN-001`, `QL-001`, `BS-001`, `LT-001`, `GM-001`).
* **Vị trí FE hiển thị:** Bảng danh sách nhân viên nội bộ, cột "Mã nhân viên".

### 3.3 Mã Đơn hàng & Lịch hẹn chuẩn doanh nghiệp
* Backend đã chuyển toàn bộ mã giao dịch sang định dạng chuẩn:
  * Đơn hàng: **`ORD-YYYYMMDD-XXXX`** (Ví dụ: `ORD-20261025-0001`).
  * Lịch hẹn: **`APT-YYYYMMDD-XXXX`** (Ví dụ: `APT-20261025-0001`).
* FE hiển thị trực tiếp trường `orderCode` / `code` mà không cần xử lý cắt chuỗi.

---

## 4. HẠNG MỤC 3: CÁC ĐIỂM BACKEND ĐÃ TỰ ĐỘNG XỬ LÝ — FE KHÔNG CẦN SỬA CODE

1. **Thời hạn Access Token 8 tiếng (UAT):**
   * Backend đã nâng thời hạn token lên `8h` (thay vì `15m`). Đội ngũ FE test luồng đặt hàng, duyệt lịch, chuyển trang Admin cả ngày không còn bị tình trạng đột ngột bị văng ra trang Login.
2. **Khắc phục lỗi gọi Catalog không tham số:**
   * Các request `GET /api/v1/categories` hay `GET /api/v1/products` khi FE không truyền query parameters sẽ không bao giờ bị crash 500 nữa.
3. **Dữ liệu Database sạch 100%:**
   * Đã quét sạch dịch vụ rác `fbdfdfđ` 90đ, các đơn hàng UAT test, voucher test.
   * Toàn bộ 112 sản phẩm có danh mục chuẩn (`thuc-an`, `do-dung-thiet-yeu`, `cham-soc-suc-khoe`, `do-choi`, `phu-kien`).
   * Phía FE chỉ cần gọi API là dữ liệu hiển thị đẹp mắt, hoàn hảo như trang thương mại điện tử chuyên nghiệp.

---

## 5. THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP & URL GIAO DIỆN ADMIN

### 5.1 Đường dẫn Giao diện Admin
* **Online (Vercel):** [https://dr-pets-house-angular.vercel.app/admin](https://dr-pets-house-angular.vercel.app/admin) *(hoặc `/admin/login`)*
* **Local (Angular):** `http://localhost:4200/admin` (sau khi chạy `npm start` tại thư mục `DR_PETS_HOUSE_ANGULAR`).

### 5.2 Bộ tài khoản kiểm thử chuẩn
> 🔑 **MẬT KHẨU CHUNG:** `K9#mQ$8xL!2vW*7z`

| Cấp bậc | Username (`identifier`) | Mật khẩu | Phạm vi quyền hạn |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` *(hoặc `admin@drpetshouse.vn`)* | `K9#mQ$8xL!2vW*7z` | Quản trị tối cao toàn chuỗi 3 chi nhánh |
| **Quản lý CN 1** | `manager_q1` | `K9#mQ$8xL!2vW*7z` | Quản lý vận hành Chi nhánh Quận 1 |
| **Quản lý CN 2** | `manager_q7` | `K9#mQ$8xL!2vW*7z` | Quản lý vận hành Chi nhánh Quận 7 |
| **Quản lý CN 3** | `manager_bt` | `K9#mQ$8xL!2vW*7z` | Quản lý vận hành Chi nhánh Bình Thạnh |
| **Bác sĩ Thú y** | `doctor.an` | `K9#mQ$8xL!2vW*7z` | Khám chữa bệnh & cập nhật bệnh án |
| **Lễ tân** | `reception.bich` | `K9#mQ$8xL!2vW*7z` | Check-in & tiếp nhận khách hàng |
| **Khách hàng** | `customer` *(hoặc `0905555555`)* | `K9#mQ$8xL!2vW*7z` | Đặt hàng & đặt lịch dịch vụ |

---

## 6. BẢNG CHECKLIST NGHIỆM THU TÍCH HỢP FE - BE

| STT | Luồng nghiệp vụ | Endpoint Backend | Trạng thái Backend | Phía Frontend cần làm |
| :---: | :--- | :--- | :---: | :--- |
| 1 | Thống kê Dashboard Admin | `GET /api/v1/orders/stats` | ✅ Sẵn sàng | Nối API vẽ các thẻ KPI số liệu |
| 2 | Danh sách sản phẩm & Ảnh | `GET /api/v1/products` | ✅ Sẵn sàng | Bind trường `thumbnailUrl` / `image` |
| 3 | Xóa ca trực nhân sự | `DELETE /api/v1/shifts/:id` | ✅ Sẵn sàng | Gắn nút Xóa ca vào UI lịch làm việc |
| 4 | Voucher Flash Sale giờ vàng | `GET /api/v1/vouchers?isFlashSale=true` | ✅ Sẵn sàng | Thêm thẻ Flash Sale & Countdown Timer |
| 5 | Đăng nhập Admin & Staff | `POST /api/v1/auth/login` | ✅ Sẵn sàng | Đăng nhập bằng `admin` / `K9#mQ$8xL!2vW*7z` |
| 6 | Đối soát Data sạch trên Atlas | Lệnh `npm run check:clean` | ✅ 100% Xanh | Không cần làm gì, dữ liệu đã hoàn hảo |

---
*Mọi thắc mắc kỹ thuật trong quá trình tích hợp, team Frontend có thể đối soát trực tiếp tài liệu OpenAPI tại [07-openapi-v6.yaml](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/07-openapi-v6.yaml) hoặc liên hệ đội ngũ Backend để được hỗ trợ tức thì.*
