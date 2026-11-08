# TÀI LIỆU BÀN GIAO FRONTEND (FE HANDOFF)
## Bàn Giao Khắc Phục Phản Hồi Kiểm Tra Lại Của FE & Nghiệm Thu 16 Hạng Mục `FEEDBACK 7-11 cust 2`

> **Kính gửi:** Ban Dự Án & Đội Ngũ Phát Triển Frontend (`DR_PETS_HOUSE_ANGULAR` & Web FE)  
> **Tài liệu căn cứ:**  
> 1. Bảng phản hồi phía FE: *"2. Những điểm BE cần kiểm tra lại"* (Ảnh chụp màn hình từ FE)  
> 2. Tài liệu khách hàng / QA: [`docs/FEEDBACK 7-11 cust 2.docx`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/FEEDBACK%207-11%20cust%202.docx) (16 hạng mục)  
> **Trạng thái:** ✅ **HOÀN TẤT TRIỂN KHAI & TEST XANH 100% – ĐÃ SEED DỮ LIỆU LÊN MONGODB**  
> **Ngày bàn giao:** 08/11/2026  
> **Branch Git:** `feat/foundation-v6` | **Commit:** [`eae2435`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND)

---

### MỤC LỤC
1. [Nghiệm Thu & Bàn Giao 5 Điểm Phản Hồi Từ Phía Frontend](#1-nghiệm-thu--bàn-giao-5-điểm-phản-hồi-từ-phía-frontend)
2. [Bảng Đối Chiếu Chi Tiết 16 Hạng Mục `FEEDBACK 7-11 cust 2`](#2-bảng-đối-chiếu-chi-tiết-16-hạng-mục-feedback-7-11-cust-2)
3. [Tài Liệu Chi Tiết Các API Mới & Cập Nhật Cho FE](#3-tài-liệu-chi-tiết-các-api-mới--cập-nhật-cho-fe)
   - 3.1 [Nhóm API Địa chỉ & Đơn vị hành chính (Tỉnh / Huyện / Xã)](#31-nhóm-api-địa-chỉ--đơn-vị-hành-chính-tỉnh--huyện--xã)
   - 3.2 [Nhóm API Dịch vụ & Đặt lịch (Chỉ hiển thị BOOKABLE)](#32-nhóm-api-dịch-vụ--đặt-lịch-chỉ-hiển-thị-bookable)
   - 3.3 [Nhóm API Sản phẩm, Biến thể, Sản phẩm tương tự & 4 Banner](#33-nhóm-api-sản-phẩm-biến-thể-sản-phẩm-tương-tự--4-banner)
   - 3.4 [Nhóm API Flash Sale](#34-nhóm-api-flash-sale)
   - 3.5 [Nhóm API Đánh giá & Phản hồi (Like/Helpful, Rating=0, Chỉ bắt buộc nội dung)](#35-nhóm-api-đánh-giá--phản-hồi-likehelpful-rating0-chỉ-bắt-buộc-nội-dung)
   - 3.6 [Nhóm API Chi nhánh (Giờ làm việc & Wrapper legacy)](#36-nhóm-api-chi-nhánh-giờ-làm-việc--wrapper-legacy)
4. [Thông Tin Dữ Liệu Seed Test Trên Môi Trường Trực Tiếp](#4-thông-tin-dữ-liệu-seed-test-trên-môi-trường-trực-tiếp)
5. [Kết Quả Kiểm Thử Hệ Thống (Automated Test Suites)](#5-kết-quả-kiểm-thử-hệ-thống-automated-test-suites)

---

## 1. Nghiệm Thu & Bàn Giao 5 Điểm Phản Hồi Từ Phía Frontend

Bảng dưới đây đối chiếu trung thực các điểm FE đã nêu trong bảng *"2. Những điểm BE cần kiểm tra lại"*:

| # | Vấn đề FE phản hồi | Kết quả kiểm tra & Giải pháp kỹ thuật đã triển khai | File mã nguồn đã cập nhật | Trạng thái nghiệm thu |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Trạng thái phản hồi (`BE-FIX-04`)**<br>*"API `PATCH /feedback/:id/status` vẫn cho phép chuyển trực tiếp sang `PROCESSED` mà không kiểm tra email đã gửi."* | - **Đã sửa chặt chẽ trong BE:** Trong `updateFeedbackStatus`, bổ sung điều kiện chặn: nếu chuyển sang `PROCESSED` mà `replyDelivery.deliveryStatus !== 'SENT'` hoặc thiếu `providerMessageId`, hệ thống lập tức trả về mã lỗi **`409 Conflict` (`INVALID_STATE_TRANSITION`)** với thông báo yêu cầu gửi email phản hồi trước.<br>- Trong hàm `formatFeedback`, chỉ bật hành động `'RESOLVE'` trong `allowedActions` khi email phản hồi đã gửi thành công. | [`src/modules/review/feedback.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/review/feedback.service.js#L290-L321)<br>[`tests/review.test.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/tests/review.test.js#L374-L395) | ✅ **PASS 100% (Đã chặn 409 khi chưa gửi mail)** |
| **2** | **Giới hạn phân trang (`BE-FIX-10`)**<br>*"Tài liệu nói nâng lên 200, nhưng `feedback.service.js` vẫn giới hạn tối đa 100 bản ghi/request."* | - **Đã sửa:** Nâng trần `Math.min(parsedLimit, 200)` trong `feedback.service.js`.<br>- **Đồng bộ toàn diện:** Nâng đồng loạt trần phân trang lên `200` tại `catalog.service.js`, `serviceCatalog.service.js` và `branch.service.js`. | [`src/modules/review/feedback.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/review/feedback.service.js#L239)<br>[`src/modules/catalog/catalog.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/catalog/catalog.service.js#L636)<br>[`src/modules/catalog/serviceCatalog.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/catalog/serviceCatalog.service.js#L254)<br>[`src/modules/branch/branch.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/branch/branch.service.js#L194) | ✅ **PASS 100% (Cho phép query `limit=200`)** |
| **3** | **Hotline cứu trợ (`BE-FIX-08`)**<br>*"Tài liệu ghi `1900-PET-HELP` ở một chỗ nhưng response và giá trị mặc định trong code là `1900-6868`. Cần chốt dữ liệu chính thức."* | - **Chốt chính thức toàn hệ thống:** Hotline cứu trợ khẩn cấp chuẩn là **`1900-6868`**.<br>- Đã sửa lại dòng 96 trong tài liệu handoff cũ từ `1900-PET-HELP` thành `1900-6868` để đồng bộ 100% giữa Code, Database và Tài liệu. | [`docs/FE-HANDOFF-BE-FIX-GAP-UAT-RESULTS-2026-11-06.md`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/FE-HANDOFF-BE-FIX-GAP-UAT-RESULTS-2026-11-06.md#L96) | ✅ **ĐÃ ĐỒNG BỘ CHÍNH THỨC** |
| **4** | **API tạo bài cộng đồng (`BE-FIX-06`)**<br>*"Source BE thực tế hỗ trợ `type`, `imageUrls`, `status`, phù hợp với payload FE hiện tại. Không cần sửa theo JSON mẫu nếu chưa có yêu cầu."* | - **Giữ nguyên tính tương thích cao:** BE tiếp tục duy trì hỗ trợ cả `type`/`imageUrls`/`status` (khớp payload FE đang gọi) lẫn alias fallback (`category`/`images`).<br>- Đã sửa lại mục 4.2 trong tài liệu handoff để mô tả chính xác contract thực tế FE đang dùng, không yêu cầu FE đổi mã nguồn. | [`docs/FE-HANDOFF-BE-FIX-GAP-UAT-RESULTS-2026-11-06.md`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/FE-HANDOFF-BE-FIX-GAP-UAT-RESULTS-2026-11-06.md#L162-L179) | ✅ **ĐÃ ĐỒNG BỘ TÀI LIỆU** |
| **5** | **API ẩn đánh giá (`BE-FIX-07`)**<br>*"FE đang gọi `/reviews/:id/hide` và source BE có hỗ trợ. Không cần đổi thành `/admin/reviews/:id/hide` chỉ vì cách ghi trong tài liệu."* | - **Xác nhận endpoint chuẩn:** `POST /api/v1/reviews/:id/hide` (và `PATCH /api/v1/reviews/:id/hide`) là endpoint chính thức của hệ thống.<br>- Đã cập nhật dòng 95 và mục 4.3 trong tài liệu handoff để ghi nhận đúng endpoint FE đang gọi, xem `/admin/reviews/:id/hide` là alias tương thích ngược. | [`docs/FE-HANDOFF-BE-FIX-GAP-UAT-RESULTS-2026-11-06.md`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/FE-HANDOFF-BE-FIX-GAP-UAT-RESULTS-2026-11-06.md#L95) | ✅ **ĐÃ ĐỒNG BỘ TÀI LIỆU** |

---

## 2. Bảng Đối Chiếu Chi Tiết 16 Hạng Mục `FEEDBACK 7-11 cust 2`

Hệ thống phân định minh bạch giữa **11 hạng mục Backend/Data đã xử lý triệt để** và **5 hạng mục giao diện phía repo Frontend Angular**:

### Bảng tổng hợp

| # | Hạng mục trong tài liệu `FEEDBACK 7-11 cust 2.docx` | Ảnh đính kèm | Phân loại | Tình trạng triển khai & Hướng dẫn |
| :-: | :--- | :--- | :--- | :--- |
| **1** | Thêm API thành phố, quận/huyện, phường/xã | `image1.png` | **BE Done** | ✅ Đã mở 3 API `/provinces`, `/districts`, `/wards` chuẩn `{ EC: 0, EM: 'Success', DT: [...] }`. |
| **2** | Chỉ hiển thị dịch vụ loại `BOOKABLE` trên form đặt lịch | `image8.png` | **BE Done** | ✅ Đã tự động lọc `bookingMode: 'BOOKABLE'` khi khách gọi `GET /api/v1/services`. |
| **3** | Tài khoản Lê Văn Cường đặt nhiều đơn nhưng không có địa chỉ ở thông tin tài khoản | `image5.png` | **BE Done** | ✅ Đã thêm cơ chế tự động đồng bộ địa chỉ từ `Order` vào `user.addresses` + seed 2 địa chỉ mặc định cho user. |
| **4** | Từ giỏ hàng bấm thanh toán thì có sản phẩm, reload lại bị mất | `image6.png` | **FE UI/Router** *(BE hỗ trợ)* | ⚠️ Do state Angular in-memory bị mất khi reload. BE đã hỗ trợ nhận `userId` qua query/header để FE reload giỏ hàng từ API. |
| **5** | Chưa nối giá sản phẩm ở trang chi tiết | `image17.png` | **BE Done** | ✅ Đã format trả đầy đủ `price`, `sale_price`, `originalPrice`, `compareAtPrice` cho từng biến thể và sản phẩm cha. |
| **6** | Bấm chọn từng loại (biến thể) thì hiển thị hình tương ứng | `image16.png`, `image3.png` | **BE Done** | ✅ Đã gắn ảnh riêng cho từng biến thể (`imageUrl`, `image`, `images: [url]`) cho cả dữ liệu catalog lẫn 4 sản phẩm banner. |
| **7** | Chữ "Còn hàng" bị lệch, cần dịch sang phải xíu | `image18.png` | **FE UI CSS** | ⚠️ Cần team FE chỉnh `margin-left` / `padding-left` của thẻ badge trạng thái tồn kho trên component HTML/CSS. |
| **8** | Không có đánh giá mà dưới để 5 sao; nút Hữu ích (1) bấm không nhảy số | `image9.png` | **BE Done** | ✅ `getProductReviewStats` trả `averageRating: 0` khi 0 review; đã thêm API `POST /api/v1/reviews/:id/like` để tăng số hữu ích. |
| **9** | Chưa có sản phẩm tương tự ở trang chi tiết | `image15.png` | **BE Done** | ✅ Đã tự động nhúng `relatedProducts` (tối đa 8 SP cùng danh mục/loài) trong `GET /products/:id` và mở thêm `GET /products/:id/related`. |
| **10** | 1. Nhớ nối 2 cái voucher với giao hàng<br>2. Sửa nút "Mua" thành "Mua ngay" | `image13.png` | **Ý 1: BE Done**<br>**Ý 2: FE UI** | ✅ Ý 1: Đã nhúng object `shipping` (freeship 500k, voucher hint, phí 30k) vào API sản phẩm.<br>⚠️ Ý 2: FE sửa text nút thành `"Mua ngay"`. |
| **11** | Hover chuột vào nút bị mất chữ | `image12.png` | **FE UI CSS** | ⚠️ Do CSS `:hover` của button đang để màu chữ trùng với màu nền button (cần sửa màu text bên FE). |
| **12** | Mục Flash Sale báo "Hiện chưa có sản phẩm khuyến mãi" | `image10.png` | **BE Done** | ✅ Đã seed chiến dịch Flash Sale đang diễn ra (`FS-RUNNING-01`) và chuẩn hóa format trả dữ liệu ở `GET /api/v1/flash-sales/active`. |
| **13** | Xóa cụm từ khóa gợi ý dưới thanh search | `image7.png` | **FE UI** | ⚠️ FE xóa/ẩn block HTML các thẻ từ khóa gợi ý tĩnh dưới input tìm kiếm trên header. |
| **14** | Tạo sản phẩm của 4 banner trang chủ (bấm "Mua ngay" chuyển sang chi tiết sản phẩm) | `image4.png`, `image14.png` | **BE Done** | ✅ Đã seed đủ 4 sản phẩm (`SP-BANNER-001` → `004`) với đầy đủ biến thể, giá và ảnh banner, tra cứu được bằng cả ID lẫn slug. |
| **15** | Nối API danh sách chi nhánh ở trang Liên hệ | `image2.png` | **BE Done** | ✅ Đã chuẩn hóa `formatBranchResponse` trả đủ `hours: '08:00 - 20:00'`, `phone`, `address` kèm wrapper `{ EC: 0, DT: [...] }`. |
| **16** | Form liên hệ bắt buộc điền hết tất cả ô; chỉ bắt buộc ở field nội dung | `image11.png` | **BE Done** *(kèm lưu ý FE)* | ✅ BE đã bỏ bắt buộc trên model `Feedback`, chỉ bắt buộc `message`. Khách không điền tên/email/sđt/tiêu đề vẫn gửi thành công 201. |

---

## 3. Tài Liệu Chi Tiết Các API Mới & Cập Nhật Cho FE

### 3.1 Nhóm API Địa chỉ & Đơn vị hành chính (Tỉnh / Huyện / Xã)

Hỗ trợ đúng 100% contract mà `CustomerAccountService` bên FE Angular (`chunk-CrH1NXxe.js`) đang gọi:

#### A. Lấy danh sách Tỉnh / Thành phố
- **Endpoint:** `GET /provinces` (hoặc `/api/v1/provinces`)
- **Response Format (`200 OK`):**
  ```json
  {
    "EC": 0,
    "EM": "Success",
    "DT": [
      { "code": "79", "name": "Thành phố Hồ Chí Minh", "type": "Tỉnh/Thành phố" },
      { "code": "01", "name": "Thành phố Hà Nội", "type": "Tỉnh/Thành phố" },
      { "code": "48", "name": "Thành phố Đà Nẵng", "type": "Tỉnh/Thành phố" },
      { "code": "92", "name": "Thành phố Cần Thơ", "type": "Tỉnh/Thành phố" },
      { "code": "31", "name": "Thành phố Hải Phòng", "type": "Tỉnh/Thành phố" },
      { "code": "74", "name": "Tỉnh Bình Dương", "type": "Tỉnh/Thành phố" },
      { "code": "75", "name": "Tỉnh Đồng Nai", "type": "Tỉnh/Thành phố" },
      { "code": "77", "name": "Tỉnh Bà Rịa - Vũng Tàu", "type": "Tỉnh/Thành phố" },
      { "code": "68", "name": "Tỉnh Lâm Đồng", "type": "Tỉnh/Thành phố" }
    ]
  }
  ```

#### B. Lấy danh sách Quận / Huyện
- **Endpoint:** `GET /districts?provinceCode=79` (hoặc `GET /districts/79`)
- **Response Format (`200 OK`):**
  ```json
  {
    "EC": 0,
    "EM": "Success",
    "DT": [
      { "code": "760", "name": "Quận 1", "provinceCode": "79" },
      { "code": "770", "name": "Quận 3", "provinceCode": "79" },
      { "code": "778", "name": "Quận 7", "provinceCode": "79" },
      { "code": "765", "name": "Quận Bình Thạnh", "provinceCode": "79" }
    ]
  }
  ```

#### C. Lấy danh sách Phường / Xã
- **Endpoint:** `GET /wards?districtCode=760` (hoặc `GET /wards/760`)
- **Response Format (`200 OK`):**
  ```json
  {
    "EC": 0,
    "EM": "Success",
    "DT": [
      { "code": "26734", "name": "Phường Bến Nghé", "districtCode": "760" },
      { "code": "26740", "name": "Phường Bến Thành", "districtCode": "760" },
      { "code": "26743", "name": "Phường Đa Kao", "districtCode": "760" }
    ]
  }
  ```

#### D. Lấy & Thêm sổ địa chỉ tài khoản khách hàng
- **Lấy sổ địa chỉ:** `GET /users/:userId/addresses` (hoặc `/api/v1/users/:userId/addresses`)
- **Thêm địa chỉ mới:** `POST /users/:userId/addresses`
  - **Payload Body:**
    ```json
    {
      "recipientName": "Lê Văn Cường",
      "phone": "0905555555",
      "line1": "456 Hai Bà Trưng",
      "province": "Thành phố Hồ Chí Minh",
      "district": "Quận 1",
      "ward": "Phường Bến Nghé",
      "isDefault": true
    }
    ```
  - **Response Format (`200 OK` / `201 Created`):**
    ```json
    {
      "EC": 0,
      "EM": "Success",
      "DT": [
        {
          "_id": "6ae7a1b2c3d4e5f678901234",
          "id": "6ae7a1b2c3d4e5f678901234",
          "recipientName": "Lê Văn Cường",
          "phone": "0905555555",
          "line1": "123 Nguyễn Thị Minh Khai",
          "province": "Thành phố Hồ Chí Minh",
          "district": "Quận 1",
          "ward": "Phường Bến Thành",
          "fullAddress": "123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh",
          "isDefault": true
        }
      ]
    }
    ```
- **Cập nhật / Đặt mặc định địa chỉ:** `PUT /addresses/:addressId` hoặc `PATCH /addresses/:addressId`
- **Xóa địa chỉ:** `DELETE /addresses/:addressId`

---

### 3.2 Nhóm API Dịch vụ & Đặt lịch (Chỉ hiển thị BOOKABLE)

- **Endpoint:** `GET /api/v1/services?limit=100` (hoặc `/services?limit=100`)
- **Hành vi mới:**
  - Tự động lọc chỉ trả các dịch vụ có `bookingMode: 'BOOKABLE'`. Không còn lẫn các dịch vụ nội viện (`WALK_IN_ONLY`, `INTERNAL_ONLY`).
  - Trả kèm cả cấu trúc chuẩn mới lẫn cấu trúc legacy để component Angular đổ dữ liệu trực tiếp:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "6ae1aeffb1d650ca8dafe601",
          "_id": "6ae1aeffb1d650ca8dafe601",
          "service_id": "6ae1aeffb1d650ca8dafe601",
          "name": "Khám tổng quát thú cưng",
          "service_name": "Khám tổng quát thú cưng",
          "basePrice": 150000,
          "base_price": 150000,
          "bookingMode": "BOOKABLE",
          "is_weight_surcharge_applied": false,
          "category": "MEDICAL",
          "status": "ACTIVE"
        }
      ]
    }
    ```

---

### 3.3 Nhóm API Sản phẩm, Biến thể, Sản phẩm tương tự & 4 Banner

#### A. Chi tiết sản phẩm & Sản phẩm tương tự
- **Endpoint:** `GET /api/v1/products/:id` (Hỗ trợ tra cứu bằng MongoDB `_id`, mã sản phẩm `code` hoặc `slug`).
- **Response Format (`200 OK`):**
  - Trả kèm mảng `relatedProducts` (tối đa 8 sản phẩm cùng category/species).
  - Trả kèm object `shipping`:
    ```json
    {
      "shipping": {
        "freeShippingThreshold": 500000,
        "defaultShippingFee": 30000,
        "estimatedDelivery": "Giao nhanh 2h nội thành TP.HCM, 1-3 ngày toàn quốc",
        "voucherHint": "Miễn phí vận chuyển cho đơn từ 500.000đ hoặc áp mã FREESHIP",
        "returnPolicyDays": 7
      }
    }
    ```
  - Mỗi phần tử trong `variants` có ảnh và giá riêng:
    ```json
    {
      "id": "var-cat-01",
      "sku": "WHISKAS-TUNA-1.2KG",
      "label": "Túi 1.2kg",
      "price": 85000,
      "sale_price": 85000,
      "originalPrice": 105000,
      "oldPrice": 105000,
      "compareAtPrice": 105000,
      "discountPercent": 19,
      "imageUrl": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80",
      "image": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80",
      "images": ["https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80"],
      "stock": 100
    }
    ```

#### B. Danh mục 4 Sản phẩm Banner Trang Chủ (Đã seed lên Database)
Khi người dùng bấm vào nút *"Mua ngay"* trên 4 banner trang chủ, FE chuyển hướng trực tiếp đến các slug hoặc code sau:

1. **Banner 1 (Dinh Dưỡng Khỏe Mạnh):**
   - **Mã sản phẩm:** `SP-BANNER-001`
   - **Slug:** `dinh-duong-khoe-manh-tu-tu-nhien` (alias: `banner-1`, `1`)
   - **Giá niêm yết:** `245.000đ` (Giá gốc: `310.000đ` – Giảm 21%)
   - **Ảnh chính:** `https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=900&auto=format&fit=crop&q=80`

2. **Banner 2 (Bát ăn PetBowl):**
   - **Mã sản phẩm:** `SP-BANNER-002`
   - **Slug:** `bat-an-petbowl` (alias: `banner-2`, `2`)
   - **Giá niêm yết:** `85.000đ` (Giá gốc: `120.000đ` – Giảm 29%)
   - **Ảnh chính:** `https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=900&auto=format&fit=crop&q=80`

3. **Banner 3 (Khay vệ sinh cho mèo Jobi):**
   - **Mã sản phẩm:** `SP-BANNER-003`
   - **Slug:** `khay-ve-sinh-cho-meo-jobi` (alias: `banner-3`, `3`)
   - **Giá niêm yết:** `260.000đ` (Giá gốc: `350.000đ` – Giảm 26%)
   - **Ảnh chính:** `https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900&auto=format&fit=crop&q=80`

4. **Banner 4 (Vòng cổ chuông đính kèm JewPet):**
   - **Mã sản phẩm:** `SP-BANNER-004`
   - **Slug:** `vong-co-jewpet` (alias: `banner-4`, `4`)
   - **Giá niêm yết:** `65.000đ` (Giá gốc: `95.000đ` – Giảm 32%)
   - **Ảnh chính:** `https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=900&auto=format&fit=crop&q=80`

---

### 3.4 Nhóm API Flash Sale

- **Endpoint:** `GET /api/v1/flash-sales/active` (hoặc `/flash-sales/active`)
- **Dữ liệu trả về:** Chiến dịch `FS-RUNNING-01` (*"Flash Sale Giờ Vàng - Deal Sốc Thú Cưng"*):
  ```json
  {
    "success": true,
    "data": {
      "id": "6ae911223344556677889901",
      "code": "FS-RUNNING-01",
      "name": "Flash Sale Giờ Vàng - Deal Sốc Thú Cưng",
      "status": "RUNNING",
      "startTime": "2026-11-08T00:00:00.000Z",
      "endTime": "2026-11-08T23:59:59.000Z",
      "items": [
        {
          "productId": "6ae1aeffb1d650ca8dafe101",
          "name": "Thức ăn hạt cao cấp cho chó Royal Canin Mini Adult",
          "originalPrice": 350000,
          "salePrice": 245000,
          "discountPercent": 30,
          "stock": 50,
          "sold": 18,
          "remainingStock": 32,
          "imageUrl": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80"
        }
      ]
    }
  }
  ```

---

### 3.5 Nhóm API Đánh giá & Phản hồi (Like/Helpful, Rating=0, Chỉ bắt buộc nội dung)

#### A. Nút "Hữu ích" cho Đánh giá (Review)
- **Endpoint:** `POST /api/v1/reviews/:id/like` (Hỗ trợ alias: `POST /api/v1/reviews/:id/helpful`, `PATCH /api/v1/reviews/:id/like`)
- **Quyền hạn:** Công khai / Khách hàng (Không bắt buộc token)
- **Response Format (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Cảm ơn bạn đã đánh giá tính hữu ích!",
    "data": {
      "id": "6ae3b1c2d3e4f5a6b7c8d9e0",
      "helpfulCount": 2,
      "likeCount": 2
    }
  }
  ```

#### B. API Gửi ý kiến phản hồi / Liên hệ (Feedback)
- **Endpoint:** `POST /api/v1/feedback` (hoặc `/feedback`)
- **Quy tắc kiểm tra hợp lệ mới:** **Chỉ bắt buộc trường `message`** (nội dung phản hồi).
- **Payload hợp lệ tối thiểu:**
  ```json
  {
    "message": "Phòng khám phục vụ rất tận tình, tôi rất hài lòng!"
  }
  ```
  *(Các trường `name`, `email`, `phone`, `subject`, `category` là tùy chọn, BE tự gán fallback an toàn nếu khách bỏ trống).*

---

### 3.6 Nhóm API Chi nhánh (Giờ làm việc & Wrapper legacy)

- **Endpoint:** `GET /branches` (hoặc `GET /api/v1/branches?limit=200`)
- **Response Format:**
  ```json
  {
    "EC": 0,
    "EM": "Success",
    "DT": [
      {
        "id": "6ad08e4417bf41f5954234c3",
        "branch_id": "6ad08e4417bf41f5954234c3",
        "code": "BR-000001",
        "name": "Chi nhánh Quận 1 (Trụ sở chính)",
        "branch_name": "Chi nhánh Quận 1 (Trụ sở chính)",
        "address": "123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
        "phone": "02839123456",
        "email": "drpet.q1@petclinic.vn",
        "hours": "08:00 - 20:00 (Thứ 2 - Chủ Nhật)",
        "operating_hours": "08:00 - 20:00 (Thứ 2 - Chủ Nhật)",
        "status": "ACTIVE"
      }
    ]
  }
  ```

---

## 4. Thông Tin Dữ Liệu Seed Test Trên Môi Trường Trực Tiếp

Toàn bộ dữ liệu dưới đây đã được nạp trực tiếp vào cơ sở dữ liệu MongoDB `pet_clinic_v2`:

### 4.1 Tài khoản Khách hàng UAT
- **Tên hiển thị:** Lê Văn Cường
- **Tên đăng nhập:** `customer`
- **Mật khẩu:** `cT6$vM2!pL9#zR8&`
- **Số điện thoại:** `0905555555`
- **Email:** `customer.levanc@gmail.com`
- **Sổ địa chỉ mặc định:** Đã được gắn 2 địa chỉ thật (Quận 1, TP.HCM) và tự động đồng bộ từ lịch sử đơn hàng.

### 4.2 Tài khoản Quản trị & Bác sĩ UAT
- **Mật khẩu chung:** `K9#mQ$8xL!2vW*7z`
- **Danh sách tài khoản:**
  - `admin` (ADMIN)
  - `manager`, `manager_dual` (MANAGER)
  - `doctor`, `vet_dual` (STAFF: VETERINARIAN)
  - `receptionist` (STAFF: RECEPTIONIST)
  - `groomer` (STAFF: CARE_STAFF_GROOMER)
  - `nurse` (STAFF: NURSE)

---

## 5. Kết Quả Kiểm Thử Hệ Thống (Automated Test Suites)

Các bộ kiểm thử tích hợp và kiểm thử hồi quy đều đạt kết quả tuyệt đối:

```bash
# 1. Chạy bộ test UAT GAP & Feedback
npx jest tests/integration/be-fix-gap-uat.test.js tests/review.test.js --runInBand
# Kết quả:
# PASS tests/review.test.js (15.186 s)
# PASS tests/integration/be-fix-gap-uat.test.js
# Test Suites: 2 passed, 2 total
# Tests:       32 passed, 32 total

# 2. Chạy bộ test Catalog, Service & Flash Sale
npx jest tests/catalog.test.js tests/service-branch.test.js tests/integration/flash-sale.test.js --runInBand
# Kết quả:
# PASS tests/catalog.test.js
# PASS tests/service-branch.test.js
# PASS tests/integration/flash-sale.test.js
# Test Suites: 3 passed, 3 total
# Tests:       37 passed, 37 total
```

---
*Tài liệu này được lập và đối soát trực tiếp cùng mã nguồn Backend và cơ sở dữ liệu MongoDB để phục vụ nghiệm thu dự án.*  
**Đại diện Đội ngũ Kỹ thuật Backend**
