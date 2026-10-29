# BÁO CÁO BÀN GIAO & HƯỚNG DẪN TÍCH HỢP TOÀN DIỆN CHO FRONTEND (WEB 2)
> **Dự án:** Hệ thống Chuỗi Phòng Khám & Bệnh Viện Thú Y Dr. Pet's House  
> **Phiên bản Backend:** Foundation v6 / v7 Confirmed  
> **Thời điểm cập nhật:** 28/10/2026  
> **Trạng thái hệ thống:** ✅ **100% PASS ALL TESTS (282/282 tests - 20 Suites)** | ✅ **LIVE ATLAS SEEDED**

---

## 📌 MỤC LỤC
1. [Tóm tắt Điều hành & Phạm vi giải quyết](#1-tóm-tắt-điều-hành--phạm-vi-giải-quyết)
2. [Bảng Only-Text Toàn Bộ Tài Khoản Hệ Thống & Phân Quyền Chi Nhánh](#2-bảng-only-text-toàn-bộ-tài-khoản-hệ-thống--phân-quyền-chi-nhánh)
3. [Chuẩn hóa Danh Mục & 112 Sản Phẩm Thương Mại (100% Ảnh CDN)](#3-chuẩn-hóa-danh-mục--112-sản-phẩm-thương-mại-100-ảnh-cdn)
4. [Tài liệu Kỹ thuật Tích hợp API & DTO Cải tiến (P0 & P1)](#4-tài-liệu-kỹ-thuật-tích-hợp-api--dto-cải-tiến-p0--p1)
5. [Bộ Dữ Liệu Đối Soát Giao Dịch Mẫu (Orders, Returns, Appointments, Guests)](#5-bộ-dữ-liệu-đối-soát-giao-dịch-mẫu)
6. [Hướng Dẫn Gọi API Cho Frontend (Code Snippets & Axios)](#6-hướng-dẫn-gọi-api-cho-frontend-code-snippets--axios)

---

## 1. TÓM TẮT ĐIỀU HÀNH & PHẠM VI GIẢI QUYẾT

Phiên làm việc này giải quyết dứt điểm 100% các vấn đề được nêu trong nhận xét của **Nhóm trưởng** và tài liệu **Frontend Web 2 Full Audit Handoff (27/10/2026)**:

1. **Khắc phục triệt để dữ liệu sản phẩm:** Loại bỏ toàn bộ sản phẩm test rác, nạp 112 sản phẩm hoàn chỉnh (12 sản phẩm UAT + 100 sản phẩm di trú từ MySQL cũ) có đầy đủ ảnh CDN Unsplash sắc nét và tồn kho phủ cả 3 chi nhánh.
2. **Khớp 5 danh mục chuẩn theo giao diện UI:** `thuc-an`, `do-dung-thiet-yeu`, `cham-soc-suc-khoe`, `do-choi`, `phu-kien`.
3. **Phân bổ nhân sự và ca trực theo tối thiểu 3 chi nhánh:** Toàn bộ vai trò (trừ Admin) được phân chia rõ ràng về Chi nhánh 1 (Quận 1), Chi nhánh 2 (Quận 7), Chi nhánh 3 (Bình Thạnh) cùng các nhân sự lưu động đa chi nhánh và nhân sự dự bị để kiểm thử bảo mật Fail-Closed.
4. **Phủ đầy đủ các trường hợp nghiệp vụ biên (Edge Cases):** Khách vãng lai (`GuestContact`) có đơn hàng/lịch hẹn nhưng hoàn toàn **không có tài khoản**, khách chờ kích hoạt, khách đã kích hoạt, đơn hàng đủ 6 trạng thái, đổi trả đủ 7 trạng thái, lịch hẹn đủ 7 trạng thái.
5. **Mở các API bị thiếu & làm giàu DTO:** Mở API Admin tạo đơn tại quầy (`/api/v1/admin/orders/quote` & `/api/v1/admin/orders`), bổ sung các trường DTO còn thiếu (`description`, `minOrderAmount`, `allowedActions`, `receivedQty`, `quality`), hoàn kho thông minh chỉ khi hàng còn bán lại được (`RESELLABLE`).

---

## 2. BẢNG ONLY-TEXT TOÀN BỘ TÀI KHOẢN HỆ THỐNG & PHÂN QUYỀN CHI NHÁNH

> 🔑 **MẬT KHẨU CHUNG CHO TẤT CẢ TÀI KHOẢN:** `K9#mQ$8xL!2vW*7z`  
> *(Toàn bộ tài khoản đã được kích hoạt `ACTIVE`, mật khẩu mã hóa chuẩn bcrypt 12 salt rounds).*

### 👑 A. Ban Giám Đốc (Admin) & Quản Lý Chi Nhánh (Managers)
| STT | Username | Họ và tên | Số điện thoại | Email | System Role | Chi nhánh phân công | Phạm vi quản lý |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `admin` | Ban Giám Đốc Điều Hành | `0901234000` | `admin@drpetshouse.vn` | `ADMIN` | **Toàn hệ thống (All)** | Quyền tối cao, xem và duyệt toàn bộ chi nhánh |
| **2** | `manager_q1` | Quản Lý CN Quận 1 | `0901234001` | `manager.q1@drpetshouse.vn` | `MANAGER` | Chi nhánh 1 (Quận 1) | Chỉ quản lý đơn hàng/đổi trả/ca trực tại CN 1 |
| **3** | `manager_q7` | Quản Lý CN Quận 7 | `0901234002` | `manager.q7@drpetshouse.vn` | `MANAGER` | Chi nhánh 2 (Quận 7) | Chỉ quản lý đơn hàng/đổi trả/ca trực tại CN 2 |
| **4** | `manager_bt` | Quản Lý CN Bình Thạnh | `0901234003` | `manager.bt@drpetshouse.vn` | `MANAGER` | Chi nhánh 3 (Bình Thạnh) | Chỉ quản lý đơn hàng/đổi trả/ca trực tại CN 3 |
| **5** | `manager_multi` | Quản Lý Vận Hành Khu Vực | `0901234004` | `manager.multi@drpetshouse.vn` | `MANAGER` | **Liên chi nhánh (CN 1, 2, 3)** | Quản lý lưu động cả 3 cơ sở |
| **6** | `manager_unassigned` | Quản Lý Dự Bị | `0901234005` | `manager.unassigned@drpetshouse.vn` | `MANAGER` | **Chưa gán chi nhánh** | Dùng kiểm thử cơ chế bảo mật Fail-Closed (bị chặn 403) |

---

### 🩺 B. Đội Ngũ Nhân Sự Chuyên Môn (Staff - Đủ 4 Role Tại Mỗi Chi Nhánh + Nhân Sự Lưu Động)
| STT | Username | Họ và tên | Số điện thoại | Email | Sub Role | Chi nhánh làm việc | Lịch ca trực trong tuần |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **7** | `doctor.an` | BS. Nguyễn Văn An | `0911001001` | `dr.an@drpetshouse.vn` | `VETERINARIAN` | CN 1 (Quận 1) | T2, T3, T5, T6, CN (08:00 - 12:00) |
| **8** | `nurse.mai` | Y tá Hoàng Thị Mai | `0911001002` | `nurse.mai@drpetshouse.vn` | `NURSE` | CN 1 (Quận 1) | T2, T3, T4, T6, T7 (13:00 - 17:00) |
| **9** | `reception.bich` | Lễ tân Trần Thị Bích | `0911001003` | `reception.bich@drpetshouse.vn` | `RECEPTIONIST` | CN 1 (Quận 1) | T2, T4, T5, T6, T7 (08:00 - 12:00) |
| **10**| `groomer.dat` | Groomer Phạm Quốc Đạt | `0911001004` | `groomer.dat@drpetshouse.vn` | `CARE_STAFF_GROOMER` | CN 1 (Quận 1) | T3, T4, T5, T7, CN (13:00 - 17:00) |
| **11**| `doctor.nam` | BS. Lê Hoàng Nam | `0911002001` | `dr.nam@drpetshouse.vn` | `VETERINARIAN` | CN 2 (Quận 7) | T3, T4, T5, T7, CN (08:00 - 12:00) |
| **12**| `nurse.trang` | Y tá Vũ Thu Trang | `0911002002` | `nurse.trang@drpetshouse.vn` | `NURSE` | CN 2 (Quận 7) | T2, T3, T5, T6, T7 (13:00 - 17:00) |
| **13**| `reception.khang` | Lễ tân Ngô Minh Khang | `0911002003` | `reception.khang@drpetshouse.vn` | `RECEPTIONIST` | CN 2 (Quận 7) | T2, T3, T4, T6, CN (08:00 - 12:00) |
| **14**| `groomer.huy` | Groomer Đỗ Gia Huy | `0911002004` | `groomer.huy@drpetshouse.vn` | `CARE_STAFF_GROOMER` | CN 2 (Quận 7) | T2, T4, T5, T6, T7 (13:00 - 17:00) |
| **15**| `doctor.thao` | BS. Trần Phương Thảo | `0911003001` | `dr.thao@drpetshouse.vn` | `VETERINARIAN` | CN 3 (Bình Thạnh) | T2, T4, T6, T7, CN (08:00 - 12:00) |
| **16**| `nurse.phuc` | Y tá Đặng Hồng Phúc | `0911003002` | `nurse.phuc@drpetshouse.vn` | `NURSE` | CN 3 (Bình Thạnh) | T2, T3, T4, T5, T7 (13:00 - 17:00) |
| **17**| `reception.yen` | Lễ tân Nguyễn Hải Yến | `0911003003` | `reception.yen@drpetshouse.vn` | `RECEPTIONIST` | CN 3 (Bình Thạnh) | T3, T4, T5, T6, CN (08:00 - 12:00) |
| **18**| `groomer.tuan` | Groomer Lê Anh Tuấn | `0911003004` | `groomer.tuan@drpetshouse.vn` | `CARE_STAFF_GROOMER` | CN 3 (Bình Thạnh) | T2, T3, T5, T7, CN (13:00 - 17:00) |
| **19**| `doctor.multi` | BS. Đặng Cẩm Tú | `0911004001` | `dr.multi@drpetshouse.vn` | `VETERINARIAN` | **Lưu động CN 1, 2, 3** | Xoay ca luân phiên giữa 3 chi nhánh |
| **20**| `nurse.multi` | Y tá Nguyễn Thu Cúc | `0911004002` | `nurse.multi@drpetshouse.vn` | `NURSE` | **Lưu động CN 1, 2, 3** | Xoay ca luân phiên giữa 3 chi nhánh |
| **21**| `reception.multi`| Lễ tân Lê Mai Loan | `0911004003` | `reception.multi@drpetshouse.vn` | `RECEPTIONIST` | **Lưu động CN 1, 2, 3** | Xoay ca luân phiên giữa 3 chi nhánh |
| **22**| `groomer.multi` | Master Groomer Võ Thành Đạt | `0911004004` | `groomer.multi@drpetshouse.vn` | `CARE_STAFF_GROOMER` | **Lưu động CN 1, 2, 3** | Xoay ca luân phiên giữa 3 chi nhánh |
| **23**| `staff.unassigned` | Nhân viên Thử Việc | `0911004005` | `staff.unassigned@drpetshouse.vn` | `RECEPTIONIST` | **Chưa gán chi nhánh** | Dùng kiểm thử cơ chế chặn Fail-Closed |

---

### 🐾 C. Khách Hàng Thành Viên Đã Đăng Ký (Registered Customers)
| STT | Username | Họ và tên | Số điện thoại | Email | Thú cưng sở hữu | Chi nhánh hoạt động |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **24**| `customer` | Lê Văn Cường | `0905555555` | `customer.levanc@gmail.com` | • Chó **Buddy** (Golden, 28kg)<br>• Mèo **Luna** (Mèo Anh, 4.2kg) | CN 1 (Quận 1) & CN 2 (Quận 7) |
| **25**| `customer_q7` | Trần Văn Hùng | `0903334455` | `hung.tran@gmail.com` | • Chó **LuLu** (Poodle, 4.5kg) | CN 2 (Quận 7) |

---

### 🚶 D. Khách Vãng Lai (Guest Contacts - Phủ Hết Mọi Tình Huống Thực Tế)
| STT | Tên đại diện | Số điện thoại | Email | Trạng thái kích hoạt | Giao dịch thực tế đính kèm | Ý nghĩa nghiệp vụ |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **26**| Nguyễn Thị Hồng | `0981112233` | `guest.hong@gmail.com` | `NO_ACCOUNT` | Đơn hàng `ORD-GUEST-HOT-01` (`COMPLETED`) | Khách mua hàng online không tạo tài khoản (`customerId: null`) |
| **27**| Phạm Hoàng Long | `0978889900` | `guest.long@gmail.com` | `NO_ACCOUNT` | Lịch hẹn `APT-GUEST-CLINIC-01` (`CONFIRMED`, cọc 30%) | Khách đặt khám cho thú cưng "Mèo Miu Miu" không tạo tài khoản |
| **28**| Lê Thị Mai | `0908888888` | `guest.mai@gmail.com` | `PENDING_ACTIVATION` | • Đơn hàng `ORD-GUEST-PENDING-02` (`SHIPPED`)<br>• Lịch hẹn `APT-GUEST-GROOM-02` (`IN_PROGRESS`) | Khách đã nhận lời mời kích hoạt (`INVITE-ACT-MAI-888`), sẵn sàng test flow tạo mật khẩu |
| **29**| Trần Thu Trang | `0901234567` | `trang.tran@gmail.com` | `ACTIVATED` | Liên kết tài khoản `customer_q7` | Khách vãng lai đã kích hoạt nâng cấp thành Customer thành công |

---

## 3. CHUẨN HÓA DANH MỤC & 112 SẢN PHẨM THƯƠNG MẠI (100% ẢNH CDN)

### 🗂️ 5 Danh Mục Khớp 100% Bộ Lọc UI
| Danh mục | Slug | Số lượng sản phẩm | Mô tả hiển thị |
| :--- | :--- | :---: | :--- |
| **Thức ăn** | `thuc-an` | **44 sản phẩm** | Hạt khô, pate, cỏ khô, hạt dinh dưỡng chó mèo & chim vẹt |
| **Đồ dùng thiết yếu** | `do-dung-thiet-yeu` | **32 sản phẩm** | Cát vệ sinh đậu nành, sữa tắm khử mùi, khay vệ sinh |
| **Chăm sóc sức khỏe** | `cham-soc-suc-khoe` | **12 sản phẩm** | Viên nhai trị ve rận, gel dinh dưỡng, thuốc bổ lông |
| **Đồ chơi** | `do-choi` | **12 sản phẩm** | KONG cao su tự nhiên, cần câu mèo lông vũ, bóng gặm |
| **Phụ kiện** | `phu-kien` | **12 sản phẩm** | Nệm tròn cozy cloud, dây dắt ngực phản quang, lược chải lông |
| **TỔNG CỘNG** | — | **112 sản phẩm** | **100% có ảnh Unsplash CDN chất lượng cao + Tồn kho 3 CN** |

---

## 4. TÀI LIỆU KỸ THUẬT TÍCH HỢP API & DTO CẢI TIẾN (P0 & P1)

### 🔒 4.1 Phân quyền Branch Scoping cho Đơn Hàng (P0-01)
- **Quy tắc:**
  - `ADMIN`: Xem được toàn bộ đơn hàng của tất cả các chi nhánh.
  - `MANAGER` / `STAFF`: Chỉ xem được đơn hàng có `fulfillmentBranchId` thuộc danh sách chi nhánh được phân công.
  - Nếu `MANAGER` / `STAFF` chưa được gán chi nhánh (`assignedBranchIds = []`), hệ thống sẽ kích hoạt chế độ **Fail-Closed** và trả về danh sách rỗng (hoặc HTTP 403 nếu cố truy cập đơn cụ thể).
- **API:** `GET /api/v1/orders?branchId={branchId}`

---

### 💳 4.2 Mở API Tạo Đơn Hàng Tại Quầy Cho Admin/Staff (P0-04)
Frontend phần bán hàng tại quầy (POS/Admin) có thể gọi trực tiếp 2 endpoint mới:

#### 1. Tính báo giá đơn hàng (Quote Admin Order)
- **Endpoint:** `POST /api/v1/admin/orders/quote`
- **Quyền:** `ADMIN`, `MANAGER`, `STAFF`
- **Request Body:**
```json
{
  "customerId": "660c00000000000000000001", // Tùy chọn nếu là khách có tài khoản
  "fulfillmentBranchId": "660b00000000000000000001",
  "items": [
    {
      "productId": "660a00000000000000000001",
      "variantId": "660a00000000000000000002",
      "quantity": 2
    }
  ],
  "voucherCode": "GIAM40K_DON150K" // Tùy chọn
}
```
- **Response (200 OK):**
```json
{
  "items": [
    {
      "productId": "660a00000000000000000001",
      "variantId": "660a00000000000000000002",
      "quantity": 2,
      "unitPrice": 340000,
      "lineSubtotal": 680000,
      "allocatedDiscount": 40000,
      "lineNet": 640000
    }
  ],
  "pricing": {
    "merchandiseSubtotal": 680000,
    "voucherDiscount": 40000,
    "shippingFee": 0,
    "totalAmount": 640000
  }
}
```

#### 2. Khởi tạo đơn hàng tại quầy (Create Admin Order)
- **Endpoint:** `POST /api/v1/admin/orders`
- **Request Body:**
```json
{
  "customerId": "660c00000000000000000001", // Tùy chọn nếu là khách vãng lai
  "guestContactId": "660d00000000000000000001", // Tùy chọn nếu có hồ sơ guest
  "fulfillmentBranchId": "660b00000000000000000001",
  "paymentMethod": "COD", // hoặc "ONLINE_MOCK"
  "shippingAddress": {
    "province": "TP. Hồ Chí Minh",
    "district": "Quận 1",
    "ward": "Bến Nghé",
    "detail": "Số 45 Lê Duẩn"
  },
  "contactSnapshot": {
    "fullName": "Lê Văn Cường",
    "phone": "0905555555",
    "email": "customer.levanc@gmail.com"
  },
  "items": [
    {
      "productId": "660a00000000000000000001",
      "variantId": "660a00000000000000000002",
      "quantity": 1
    }
  ],
  "voucherCode": "GIAM40K_DON150K"
}
```

---

### 📦 4.3 DTO Yêu Cầu Đổi Trả & Nhận Hàng Kiểm Kho (P0-02, P1-02, P1-03)
DTO `OrderReturn` đã được bổ sung đầy đủ các trường mà FE yêu cầu:
- `code`: Mã yêu cầu đổi trả (VD: `RET-REQ-01`).
- `orderCode`: Mã đơn hàng gốc (VD: `ORD-CUST-COMPLETED-05`).
- `fulfillmentBranchId`: Chi nhánh xử lý đơn hàng.
- `evidenceUrls`: Danh sách link ảnh bằng chứng khách gửi.
- `allowedActions`: Danh sách hành động mà user hiện tại có thể bấm (VD: `["CANCEL"]`, `["PROCESS"]`, `["RECEIVE"]`, `["APPROVE", "REJECT"]`).
- `items[].receivedQty`: Số lượng kho thực tế đã nhận.
- `items[].quality`: Chất lượng sản phẩm kiểm tra (`RESELLABLE`, `DAMAGED`, `DISCARDED`).

#### API Nhận Hàng & Kiểm Tra Chất Lượng:
- **Endpoint:** `POST /api/v1/order-returns/:id/receive`
- **Payload:**
```json
{
  "items": [
    {
      "orderItemId": "item-ORD-CUST-COMPLETED-05-1",
      "receivedQty": 1,
      "quality": "RESELLABLE"
    }
  ],
  "note": "Hàng nguyên tem mác, bao bì chưa bóc, đủ điều kiện tái nhập kho."
}
```
> ⚠️ **Lưu ý nghiệp vụ:** Khi Quản lý bấm Duyệt (`approveReturn`), Backend sẽ **chỉ cộng hoàn tồn kho** cho các mặt hàng có `quality === 'RESELLABLE'`. Hàng `DAMAGED` hoặc `DISCARDED` sẽ không được cộng lại kho.

---

### 🎟️ 4.4 DTO Voucher Khuyến Mãi & Tìm Kiếm (P1-04)
DTO `Voucher` đã được cập nhật thêm các trường:
- `description`: Mô tả chi tiết khuyến mãi.
- `minOrderAmount`: Giá trị đơn hàng tối thiểu.
- `maxDiscountAmount`: Số tiền giảm giá tối đa (với voucher %).
- **API tìm kiếm:** `GET /api/v1/vouchers?search=GIAM10` (hỗ trợ tìm kiếm theo cả mã code lẫn tên voucher).

---

### 🔍 4.5 Tìm Kiếm Khách Hàng Bằng Số Điện Thoại Chính Xác (P1-05)
Frontend khi tìm kiếm khách tại quầy có thể truyền `exactPhone` hoặc `exact=true` để không bị trả về các khách có số điện thoại tương tự:
- `GET /api/v1/customers?exactPhone=0905555555`
- `GET /api/v1/customers?phone=0905555555&exact=true`

---

## 5. BỘ DỮ LIỆU ĐỐI SOÁT GIAO DỊCH MẪU

### 🛒 A. Đơn Hàng Mẫu
| Mã Đơn Hàng | Trạng Thái | Phương Thức | Tình Trạng Thanh Toán | Chi Nhánh | Chủ Đơn |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ORD-CUST-PENDING-01` | **`PENDING`** | COD | `PENDING` | Chi nhánh 1 | Lê Văn Cường |
| `ORD-CUST-CONFIRMED-02` | **`CONFIRMED`** | ONLINE_MOCK | `PENDING` | Chi nhánh 1 | Lê Văn Cường |
| `ORD-CUST-PROCESSING-03` | **`PROCESSING`** | ONLINE_MOCK | `PAID` | Chi nhánh 1 | Lê Văn Cường |
| `ORD-CUST-SHIPPED-04` | **`SHIPPED`** | COD | `PENDING` | Chi nhánh 1 | Lê Văn Cường |
| `ORD-CUST-COMPLETED-05` | **`COMPLETED`** | ONLINE_MOCK | `PAID` | Chi nhánh 1 | Lê Văn Cường (Đơn gốc của đổi trả) |
| `ORD-CUST-COMPLETED-06` | **`COMPLETED`** | ONLINE_MOCK | `PAID` | Chi nhánh 2 | Trần Văn Hùng (Quận 7) |
| `ORD-CUST-CANCELLED-07` | **`CANCELLED`** | COD | `CANCELLED` | Chi nhánh 1 | Lê Văn Cường |
| `ORD-GUEST-HOT-01` | **`COMPLETED`** | COD | `PAID` | Chi nhánh 1 | **Nguyễn Thị Hồng (Guest - KHÔNG CÓ TK)** |
| `ORD-GUEST-PENDING-02` | **`SHIPPED`** | COD | `PENDING` | Chi nhánh 1 | **Lê Thị Mai (Guest - CHỜ KÍCH HOẠT)** |

---

### 🔄 B. Yêu Cầu Đổi Trả & Hoàn Tiền Mẫu
| Mã Đổi Trả | Trạng Thái | Lý Do Đổi Trả | Tình Trạng Kiểm Hàng | Hoàn Tiền Gắn Liền |
| :--- | :--- | :--- | :--- | :--- |
| `RET-REQ-01` | **`REQUESTED`** | Bao bì rách khi nhận | Chờ tiếp nhận | Chưa tạo |
| `RET-PROC-02` | **`PROCESSING`** | Giao nhầm phân loại | Đang xử lý | Chưa tạo |
| `RET-RECV-03` | **`RECEIVED`** | Lỗi khóa zip bao bì | `receivedQty: 1`, `RESELLABLE` | Chưa tạo |
| `RET-APPR-04` | **`APPROVED`** | Hạt ẩm mốc do NSX | Đã kiểm định | `REF-RET-REQ-04` (`PENDING`) |
| `RET-REJ-05` | **`REJECTED`** | Khách không thích vị | Từ chối: Đã bóc quá 50% | Bị hủy |
| `RET-COMP-06` | **`COMPLETED`** | Hàng cận date | Đã nhập kho hoàn tất | `REF-RET-COMP-06` (`REFUNDED`) |
| `RET-CANC-07` | **`CANCELLED`** | Khách đổi ý giữ lại | Đã hủy yêu cầu | Bị hủy |

---

### 📅 C. Lịch Hẹn Mẫu (Appointments)
| Mã Lịch Hẹn | Trạng Thái | Loại Dịch Vụ | Thú Cưng | Nhân Sự Phụ Trách | Ghi Chú / Hồ Sơ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `APT-CUST-PEND-PAY-01` | **`PENDING_PAYMENT`** | Y Tế (Khám) | Chó Buddy | BS. An (CN 1) | Chờ cọc |
| `APT-CUST-PEND-CONF-02`| **`PENDING_CONFIRMATION`** | Grooming Spa | Mèo Luna | Groomer Đạt (CN 1) | Chờ phòng khám xếp lịch |
| `APT-CUST-CONFIRMED-03`| **`CONFIRMED`** | Y Tế (Khám) | Chó Buddy | BS. An (CN 1) | Đã cọc giữ chỗ |
| `APT-CUST-INPROGRESS-04`| **`IN_PROGRESS`** | Grooming Spa | Mèo Luna | Groomer Đạt (CN 1) | Đang tắm sấy |
| `APT-CUST-COMPLETED-05` | **`COMPLETED`** | Y Tế (Khám) | Chó Buddy | BS. An (CN 1) | **Kèm Bệnh Án ServiceRecord đã ký duyệt** |
| `APT-CUST-CANCELLED-06` | **`CANCELLED`** | Y Tế (Khám) | Mèo Luna | BS. An (CN 1) | Khách báo bận |
| `APT-CUST-NOSHOW-07` | **`NO_SHOW`** | Grooming Spa | Chó Buddy | Groomer Đạt (CN 1) | Khách không đến |
| `APT-GUEST-CLINIC-01` | **`CONFIRMED`** | Y Tế (Khám) | Mèo Miu Miu | BS. An (CN 1) | **Phạm Hoàng Long (Guest - KHÔNG CÓ TK, Cọc 30%)** |
| `APT-GUEST-GROOM-02` | **`IN_PROGRESS`** | Grooming Spa | Mèo Bông | Groomer Đạt (CN 1) | **Lê Thị Mai (Guest - CHỜ KÍCH HOẠT)** |

---

## 6. HƯỚNG DẪN GỌI API CHO FRONTEND (CODE SNIPPETS & AXIOS)

### 🚀 A. Gọi Báo Giá & Tạo Đơn Hàng Tại Quầy (Admin / Staff)
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://petclinic-api.yourdomain.com/api/v1',
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

// 1. Tính báo giá nhanh
export async function getAdminOrderQuote(payload: {
  fulfillmentBranchId: string;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  voucherCode?: string;
  customerId?: string;
}) {
  const response = await apiClient.post('/admin/orders/quote', payload);
  return response.data; // Trả về { items, pricing }
}

// 2. Chốt tạo đơn tại quầy
export async function createAdminOrder(payload: any) {
  const response = await apiClient.post('/admin/orders', payload);
  return response.data; // Trả về Order document mới tạo
}
```

---

### 📦 B. Tiếp Nhận Hàng Kiểm Kho Đổi Trả
```typescript
export async function receiveReturnInspection(returnId: string, itemsInspection: Array<{
  orderItemId: string;
  receivedQty: number;
  quality: 'RESELLABLE' | 'DAMAGED' | 'DISCARDED';
}>, note?: string) {
  const response = await apiClient.post(`/order-returns/${returnId}/receive`, {
    items: itemsInspection,
    note
  });
  return response.data;
}
```

---

### 🔍 C. Tìm Kiếm Voucher Khuyến Mãi
```typescript
export async function searchVouchers(searchTerm: string) {
  const response = await apiClient.get('/vouchers', {
    params: { search: searchTerm }
  });
  return response.data.items; // Danh sách voucher có description, minOrderAmount,...
}
```

---

> 🎯 **Kết luận:** Backend đã hoàn tất đầy đủ hợp đồng và dữ liệu mẫu. Phía Frontend có thể tự tin tích hợp, đối soát giao diện và thực hiện các luồng E2E mà không còn gặp bất kỳ xung đột nào!
