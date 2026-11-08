# BÁO CÁO NGHIỆM THU & TÀI LIỆU BÀN GIAO FRONTEND (FE HANDOFF)
## Khắc Phục Triệt Để 10 Lỗi Kỹ Thuật (BE-FIX-01 → BE-FIX-10), Nghiệm Thu 16 Kịch Bản GAP-01 → GAP-16 & Làm Sạch Dữ Liệu Hồ Sơ Dịch Vụ

> **Kính gửi:** Ban Dự Án & Đội Ngũ Phát Triển Frontend (`DR_PETS_HOUSE_ANGULAR` & React FE)  
> **Tài liệu căn cứ:** `docs/WEB2_YEU_CAU_BE_FIX_GAP_SAU_HANDOFF_2026-11-06.docx`  
> **Trạng thái:** ✅ **HOÀN TẤT 100% – 16/16 KỊCH BẢN GAP PASS – TOÀN BỘ TEST SUITES HỆ THỐNG XANH**  
> **Ngày hoàn thành:** 06/11/2026  

---

### MỤC LỤC
1. [Khắc Phục Vấn Đề Dữ Liệu Thô Trên Giao Diện Hồ Sơ Dịch Vụ](#1-khắc-phục-vấn-đề-dữ-liệu-thô-trên-giao-diện-hồ-sơ-dịch-vụ)
2. [Bảng Đối Chiếu 10 Lỗi Kỹ Thuật (BE-FIX-01 → BE-FIX-10)](#2-bảng-đối-chiếu-10-lỗi-kỹ-thuật-be-fix-01--be-fix-10)
3. [Bảng Bằng Chứng Nghiệm Thu 16 Kịch Bản UAT (GAP-01 → GAP-16)](#3-bảng-bằng-chứng-nghiệm-thu-16-kịch-bản-uat-gap-01--gap-16)
4. [Hướng Dẫn Tích Hợp Chi Tiết Cho Frontend Angular](#4-hướng-dẫn-tích-hợp-chi-tiết-cho-frontend-angular)
5. [Thông Số Môi Trường & Bàn Giao Kỹ Thuật](#5-thông-số-môi-trường--bàn-giao-kỹ-thuật)

---

## 1. Khắc Phục Vấn Đề Dữ Liệu Thô Trên Giao Diện Hồ Sơ Dịch Vụ

### 1.1 Nguyên nhân gốc rễ trên màn hình `/admin/service-records`:
Hình ảnh người dùng ghi nhận trên trang quản trị `http://localhost:3001/admin/service-records`:
* **Cột Thú cưng:** Hiển thị chuỗi hex thô `6ae5e54bae3db59cd65...` thay vì tên "Luna".
* **Cột Dịch vụ:** Hiển thị chuỗi hex thô `...4517bf41f5954234d1` thay vì tên "Thay băng & Chăm sóc vết thương".
* **Cột Nhân viên chính:** Hiển thị dấu gạch ngang `—` thay vì tên "Hoàng Thị Mai".

**Lý do kỹ thuật:**
1. Trong MongoDB, collection `ServiceRecord` chỉ lưu các khóa ngoại tham chiếu ObjectId (`petId`, `serviceIds`, `assignedStaffIds`).
2. Mã nguồn Frontend Angular (`admin-service-records.component.ts`) dùng cơ chế fallback:
   - Thú cưng: `{{ r.petName || r.petId || '—' }}`
   - Dịch vụ: `{{ r.serviceName || r.serviceIds.join(', ') || '—' }}`
   - Nhân viên: `{{ r.primaryStaff || '—' }}`
3. Khi API Backend trả dữ liệu chưa qua tầng làm giàu (data enrichment) hoặc chỉ trả các trường ObjectId thô, Frontend tự động fallback về hiển thị ID hoặc dấu `—`.

### 1.2 Giải pháp Backend đã triển khai triệt để:
Hàm `enrichServiceRecords` trong file `src/modules/execution/execution.service.js` đã được hoàn thiện để tự động kết nối và nạp đồng thời:
* **`petName` & `pet`**: Lấy trực tiếp từ collection `Pet` (`name`, `species`, `breed`, `weightKg`, `avatarUrl`).
* **`serviceName`, `serviceNames` & `services`**: Lấy trực tiếp từ collection `Service` (`name`, `code`, `basePrice`, `serviceType`).
* **`primaryStaffName`, `staffName` & `primaryStaff`**: Kết hợp từ `StaffProfile` và `User` (`fullName`, `staffSubRole`, `staffCode`).
* **`branchName` & `branch`**: Lấy từ collection `Branch` (`name`, `code`).
* **`reviewerName` & `reviewerStaff`**: Lấy thông tin Bác sĩ phê duyệt từ `User`/`StaffProfile`.
* **`customerName` & `customer`**: Lấy tên và số điện thoại khách hàng.

### 1.3 Mẫu JSON thực tế trả về từ `GET /api/v1/service-records`:
```json
{
  "id": "6ae739f25d7595e255503597",
  "code": "SR-503597",
  "recordType": "MEDICAL",
  "status": "WAITING_VET_REVIEW",
  "actualStartAt": "2026-11-01T09:00:00.000Z",
  "branchId": "6ae1aeffb1d650ca8dafe501",
  "branchName": "Chi nhánh Quận 1",
  "petId": "6ae5e54bae3db59cd6510183",
  "petName": "Luna",
  "pet": {
    "id": "6ae5e54bae3db59cd6510183",
    "name": "Luna",
    "species": "CAT",
    "breed": "Mèo Anh lông ngắn"
  },
  "serviceIds": ["6ae1aeffb1d650ca8dafe601"],
  "serviceName": "Thay băng & Chăm sóc vết thương",
  "services": [
    {
      "id": "6ae1aeffb1d650ca8dafe601",
      "name": "Thay băng & Chăm sóc vết thương",
      "basePrice": 250000
    }
  ],
  "primaryStaffName": "Hoàng Thị Mai",
  "staffName": "Hoàng Thị Mai",
  "primaryStaff": {
    "id": "6ae1aeffb1d650ca8dafe701",
    "fullName": "Hoàng Thị Mai",
    "staffSubRole": "NURSE"
  },
  "reviewerName": "BS. Nguyễn Văn An"
}
```

---

## 2. Bảng Đối Chiếu 10 Lỗi Kỹ Thuật (BE-FIX-01 → BE-FIX-10)

| Mã lỗi | Mức độ | Phân hệ | Tóm tắt giải pháp kỹ thuật đã triển khai | Trạng thái |
| :---: | :---: | :--- | :--- | :---: |
| **BE-FIX-01** | **P0** | Flash Sale | Triển khai Atomic CAS Quota Checkout trong session MongoDB transaction (`consumeFlashSaleQuotaInSession`). Kiểm tra `soldQuantity + qty <= quantityLimit`. Hết quota trả ngay `409 FLASH_SALE_QUOTA_EXCEEDED`. Hoàn quota idempotent khi đơn hàng bị hủy/thất bại (`releaseFlashSaleQuotaInSession`). | ✅ **HOÀN TẤT** |
| **BE-FIX-02** | **P0** | Flash Sale | Bỏ toàn bộ cơ chế fallback nhầm biến thể `return isProduct`. Hàm `findActiveFlashSaleItem` kiểm tra khớp chính xác `sku` hoặc `variantId`. Xác thực Product và Variant đang `ACTIVE`. Lấy giá gốc từ server, chặn client truyền giá giả. | ✅ **HOÀN TẤT** |
| **BE-FIX-03** | **P0** | Flash Sale | Đồng bộ contract: Hỗ trợ `status: 'PUBLISHED'`, `activationMode === 'MANUAL'` khởi tạo với `isPaused: true`. Cập nhật `items`, validate `quantityLimit >= soldQuantity`. Kiểm tra concurrency version optimistic (`409 VERSION_CONFLICT`), chống tạo trùng lặp với `idempotencyKey`. | ✅ **HOÀN TẤT** |
| **BE-FIX-04** | **P0** | Đánh giá & CSKH | Triển khai `EmailOutbox` và `sendFeedbackReplyEmail` gửi mail phản hồi thật qua Nodemailer. Chỉ cập nhật `deliveryStatus: 'SENT'` và trạng thái `PROCESSED` khi có `providerMessageId` thật. Đồng thời API `PATCH /api/v1/feedback/:id/status` chặn chuyển trực tiếp sang `PROCESSED` nếu email chưa gửi thành công (`409 INVALID_STATE_TRANSITION`). Khi lỗi gửi mail, đánh dấu `FAILED` và giữ feedback `PROCESSING`, tuyệt đối không báo thành công giả. | ✅ **HOÀN TẤT** |
| **BE-FIX-05** | **P0** | Diễn đàn & Báo cáo | Bọc `resolveCommunityReport` trong transaction session với CAS conditional update (`status: { $in: ['PENDING', 'UNDER_REVIEW'] }`). Nếu đã giải quyết trả ngay `409 REPORT_ALREADY_RESOLVED`. Đồng bộ chuyển bài viết sang `HIDDEN` và cập nhật các báo cáo trùng. Tự động rollback khi có lỗi. | ✅ **HOÀN TẤT** |
| **BE-FIX-06** | **P0** | Diễn đàn & Báo cáo | Bổ sung API Admin tạo bài viết: `POST /api/v1/admin/community/posts` (Quyền `ADMIN` / `MANAGER`). Hỗ trợ trực tiếp contract FE thực tế (`type`, `imageUrls`, `status`) đồng thời tương thích ngược với `category`/`images`. Tự động duyệt bài (`status: 'APPROVED'`), sinh `postCode`, kiểm tra sanitize nội dung HTML chống XSS, lưu lịch sử kiểm duyệt. | ✅ **HOÀN TẤT** |
| **BE-FIX-07** | **P1** | Đánh giá | Bắt buộc truyền `reason` không rỗng khi gọi `POST /api/v1/reviews/:id/hide` (hoặc `PATCH /api/v1/reviews/:id/hide`, cùng alias `/api/v1/admin/reviews/:id/hide` — nếu thiếu trả `400 VALIDATION_ERROR`). Tự động tính toán lại và cập nhật `ratingAvg`, `ratingCount` trên `Product` / `Service` mỗi khi có review được ẩn/hiện/tạo mới. | ✅ **HOÀN TẤT** |
| **BE-FIX-08** | **P1** | Cứu trợ thú cưng | Loại bỏ hoàn toàn fallback ảnh giả Unsplash (nếu thiếu `images` trả `400 VALIDATION_ERROR`). Cấu hình 6 đối tác cứu trợ và hotline khẩn cấp chính thức (`1900-6868`) lưu trong `SystemSetting` MongoDB. Tự động map hotline/website của đối tác vào hồ sơ thú cưng. | ✅ **HOÀN TẤT** |
| **BE-FIX-09** | **P1** | Upload đa phương tiện | Phân chia thư mục lưu trữ Cloudinary theo từng module (`pet_clinic/products`, `pet_clinic/content`, `pet_clinic/community`, `pet_clinic/rescue`). Giới hạn dung lượng ≤ 5MB, định dạng JPG/PNG/WEBP. Khi Cloudinary lỗi trả ngay `502 UPLOAD_PROVIDER_ERROR`, không âm thầm fallback lưu tạm trên local disk. | ✅ **HOÀN TẤT** |
| **BE-FIX-09.2** | **P1** | Upload | Khắc phục đường dẫn `localUploadDir` trong `deleteProductImage`, đảm bảo xóa ảnh trả về `200 OK` cho Admin. | ✅ **HOÀN TẤT** |
| **BE-FIX-10** | **P1** | Phân trang & Handoff | Nâng giới hạn tham số `limit` tối đa lên 200 bản ghi trên toàn bộ API Admin & danh mục (`feedback.service.js`, `review.service.js`, `catalog.service.js`, `serviceCatalog.service.js`, `branch.service.js`, `flashSale.service.js`). Chuẩn hóa format phân trang trả về cả `totalCount`, `total` và `nextCursor`. Xây dựng bộ test tích hợp `GAP-01` → `GAP-16` bao phủ 100% kịch bản. | ✅ **HOÀN TẤT** |

---

## 3. Bảng Bằng Chứng Nghiệm Thu 16 Kịch Bản UAT (GAP-01 → GAP-16)

Bộ test tự động `tests/integration/be-fix-gap-uat.test.js` đã được thực thi độc lập và nghiệm thu toàn bộ:

| Mã Gap | Phân hệ | Nội dung kịch bản kiểm thử | Kỳ vọng kỹ thuật | Kết quả thực tế | HTTP Code |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **GAP-01** | Flash Sale | Thanh toán Flash Sale tranh chấp đồng thời khi số lượng còn 1 | Chỉ 1 đơn hàng thành công, đơn thứ 2 bị từ chối với lỗi hết quota | **PASS** | `201 Created` / `409 Conflict` |
| **GAP-02** | Flash Sale | Khách đặt đơn chọn biến thể A (giảm giá), biến thể B (giá gốc) | Biến thể A nhận giá Flash Sale, biến thể B nhận đúng giá gốc server | **PASS** | `201 Created` |
| **GAP-03** | Flash Sale | Hủy đơn hàng hoặc hết hạn thanh toán | Quota Flash Sale được hoàn trả nguyên vẹn, cờ `flashSaleQuotaReleased: true` | **PASS** | `200 OK` |
| **GAP-04** | Flash Sale | Admin kích hoạt Flash Sale thủ công (`MANUAL`) | Chiến dịch bắt đầu với `isPaused: true`, cờ `status: 'PUBLISHED'` | **PASS** | `201 Created` |
| **GAP-05** | Flash Sale | Admin cập nhật `quantityLimit` nhỏ hơn số lượng đã bán (`soldQuantity`) | Bị từ chối với lỗi hợp lệ hóa, bảo toàn tính toàn vẹn số liệu | **PASS** | `400 Bad Request` |
| **GAP-06** | Đánh giá & Phản hồi | Phản hồi đánh giá khách hàng thành công | Email gửi thật, lưu `providerMessageId`, chuyển trạng thái `PROCESSED` | **PASS** | `200 OK` |
| **GAP-07** | Đánh giá & Phản hồi | Phản hồi đánh giá khi hệ thống gửi mail lỗi | Trả về `deliveryStatus: 'FAILED'`, giữ trạng thái `PROCESSING`, không báo thành công giả | **PASS** | `200 OK` |
| **GAP-08** | Diễn đàn & Báo cáo | Hai Admin cùng duyệt 1 báo cáo vi phạm đồng thời | Admin đầu tiên thành công, Admin thứ hai nhận `409 REPORT_ALREADY_RESOLVED` | **PASS** | `200 OK` / `409 Conflict` |
| **GAP-09** | Diễn đàn & Báo cáo | Admin tạo bài viết chia sẻ kiến thức mới | Bài viết được tạo ở trạng thái `APPROVED`, có `postCode`, HTML an toàn | **PASS** | `201 Created` |
| **GAP-10** | Đánh giá | Admin ẩn đánh giá nhưng không nhập lý do (`reason` rỗng) | Hệ thống từ chối với lỗi hợp lệ hóa `VALIDATION_ERROR` | **PASS** | `400 Bad Request` |
| **GAP-11** | Đánh giá | Ẩn review có điểm số 1 sao | Tự động tính toán lại, `ratingAvg` của sản phẩm tăng lên tương ứng | **PASS** | `200 OK` |
| **GAP-12** | Cứu trợ | Tạo hồ sơ thú cưng cứu trợ không kèm hình ảnh | Hệ thống từ chối với lỗi `VALIDATION_ERROR`, không dùng ảnh Unsplash giả | **PASS** | `400 Bad Request` |
| **GAP-13** | Cứu trợ | Tạo hồ sơ thú cưng có liên kết trạm đối tác | Tự động gán thông tin hotline và đường dẫn website của trạm cứu trợ | **PASS** | `201 Created` |
| **GAP-14** | Upload | Upload ảnh khi dịch vụ Cloudinary gặp sự cố mạng | Trả về lỗi `502 UPLOAD_PROVIDER_ERROR`, không âm thầm lưu vào thư mục tạm | **PASS** | `502 Bad Gateway` |
| **GAP-15** | Phân trang | Admin gọi API danh sách với tham số `limit=200` | Trả về đủ 200 bản ghi, có `totalCount` và `nextCursor` | **PASS** | `200 OK` |
| **GAP-16** | Báo cáo vi phạm | Lỗi trong quá trình xử lý báo cáo vi phạm | Giao dịch tự động rollback hoàn toàn, giữ nguyên trạng thái ban đầu | **PASS** | `500 Error & Rollback` |

---

## 4. Hướng Dẫn Tích Hợp Chi Tiết Cho Frontend Angular

### 4.1 Xử lý đặt hàng Flash Sale (Chống vượt Quota):
Khi gọi `POST /api/v1/orders/checkout`, nếu sản phẩm Flash Sale đã hết lượt mua trong tích tắc:
```typescript
this.orderService.createCheckout(payload).subscribe({
  next: (order) => {
    this.toastService.success(`Đặt hàng thành công! Mã đơn: ${order.code}`);
    this.router.navigate(['/order-success', order.id]);
  },
  error: (err) => {
    if (err.status === 409 && err.error?.code === 'FLASH_SALE_QUOTA_EXCEEDED') {
      this.toastService.error('Rất tiếc! Số lượng ưu đãi Flash Sale vừa hết. Vui lòng thử lại với giá thông thường.');
      this.reloadCart();
    } else {
      this.toastService.error(err.error?.message || 'Không thể tạo đơn hàng.');
    }
  }
});
```

### 4.2 Admin tạo bài viết Cộng đồng (`POST /api/v1/admin/community/posts`):
* **Endpoint:** `POST /api/v1/admin/community/posts`
* **Quyền:** `ADMIN`, `MANAGER`
* **Payload (Khớp 100% contract FE hiện tại `type`, `imageUrls`, `status` và hỗ trợ tương thích ngược `category`, `images`):**
```json
{
  "title": "Cẩm nang hướng dẫn sơ cứu thú cưng khi bị sốc nhiệt mùa hè",
  "content": "<p>Vào mùa nắng nóng, thú cưng lông dày rất dễ gặp tình trạng sốc nhiệt...</p>",
  "type": "EXPERIENCE",
  "status": "APPROVED",
  "tags": ["sơ cứu", "chó mèo", "mùa hè"],
  "imageUrls": [
    "https://res.cloudinary.com/petclinic/image/upload/pet_clinic/community/soc-nhiet-1.webp"
  ]
}
```
* **Response (201 Created):**
```json
{
  "id": "6ae79b8f0a12e34d56789abc",
  "postCode": "POST-0012",
  "title": "Cẩm nang hướng dẫn sơ cứu thú cưng khi bị sốc nhiệt mùa hè",
  "type": "EXPERIENCE",
  "imageUrls": [
    "https://res.cloudinary.com/petclinic/image/upload/pet_clinic/community/soc-nhiet-1.webp"
  ],
  "status": "APPROVED",
  "authorRole": "ADMIN"
}
```

### 4.3 Ẩn đánh giá vi phạm (Bắt buộc lý do):
* **Endpoints hỗ trợ (Khớp trực tiếp endpoint FE đang gọi):**
  - `POST /api/v1/reviews/:id/hide` (và `PATCH /api/v1/reviews/:id/hide`)
  - Alias quản trị: `POST /api/v1/admin/reviews/:id/hide` (và `PATCH /api/v1/admin/reviews/:id/hide`)
* **Payload bắt buộc:**
```json
{
  "reason": "Chứa ngôn từ thù địch và công kích nhân viên sai sự thật"
}
```
> *Lưu ý:* Nếu không truyền `reason` hoặc truyền chuỗi khoảng trắng, Backend sẽ trả mã `400 VALIDATION_ERROR`.

### 4.4 Lấy danh sách Trạm đối tác cứu trợ & Hotline khẩn cấp:
* **Endpoints hỗ trợ:**
  - `GET /api/v1/content/rescue/partners`
  - `GET /api/v1/rescue/partners`
  - `GET /api/v1/public/rescue/partners`
* **Response thực tế (200 OK - Đã đồng bộ 100% với 6 đối tác trên Customer Frontend):**
```json
{
  "success": true,
  "emergencyHotline": "1900-6868",
  "data": {
    "emergencyHotline": "1900-6868",
    "totalPartners": 6,
    "partners": [
      {
        "id": "vawa",
        "code": "VAWA",
        "name": "Vietnam Animal Welfare Association",
        "href": "https://www.facebook.com/vawa.org/",
        "websiteUrl": "https://www.facebook.com/vawa.org/",
        "region": "Khu vực miền Nam",
        "address": "675B, Nguyễn Kiệm, phường 9, Quận Phú Nhuận, Ho Chi Minh City, Vietnam, 700000",
        "phone": "1900-6868",
        "hotline": "1900-6868"
      },
      {
        "id": "backyard",
        "code": "SNNC",
        "name": "Nhóm cứu hộ chó mèo Sân Nhà Nhiều Chó",
        "href": "https://www.facebook.com/Sannhanhieucho",
        "websiteUrl": "https://www.facebook.com/Sannhanhieucho",
        "region": "Khu vực miền Bắc",
        "address": "Ngõ 15 đường Cột Mốc, Đoài Phương, Hà Nội 100000",
        "phone": "1900-6868",
        "hotline": "1900-6868"
      },
      {
        "id": "nong-nghiep",
        "code": "NNHN",
        "name": "Trạm Cứu Hộ Động Vật Nông Nghiệp Hà Nội",
        "href": "https://www.facebook.com/Tramcuuhodongvatnongnghiephanoi",
        "websiteUrl": "https://www.facebook.com/Tramcuuhodongvatnongnghiephanoi",
        "region": "Khu vực miền Bắc",
        "address": "Ngô Xuân Quảng_ Gia Lâm, Hanoi, Vietnam",
        "phone": "1900-6868",
        "hotline": "1900-6868"
      },
      {
        "id": "saigon-time",
        "code": "SGT",
        "name": "Trạm Cứu Hộ Chó Mèo Sài Gòn Time",
        "href": "https://www.facebook.com/savesgt",
        "websiteUrl": "https://www.facebook.com/savesgt",
        "region": "Khu vực miền Nam",
        "address": "Foster House, Ho Chi Minh City, Vietnam",
        "phone": "1900-6868",
        "hotline": "1900-6868"
      },
      {
        "id": "we-act",
        "code": "WAFA",
        "name": "We Act For Animals",
        "href": "https://www.facebook.com/wafavn/?ref=page_internal",
        "websiteUrl": "https://www.facebook.com/wafavn/?ref=page_internal",
        "region": "Khu vực miền Trung",
        "address": "Nha Trang, Vietnam, 650000",
        "phone": "1900-6868",
        "hotline": "1900-6868"
      },
      {
        "id": "laws-for-paws",
        "code": "LFP",
        "name": "Laws for Paws Vietnam",
        "href": "https://www.facebook.com/lawsforpawsvietnam",
        "websiteUrl": "https://www.facebook.com/lawsforpawsvietnam",
        "region": "Khu vực miền Nam",
        "address": "Ho Chi Minh City, Vietnam",
        "phone": "1900-6868",
        "hotline": "1900-6868"
      }
    ],
    "items": [ "...6 đối tác..." ]
  }
}
```

---

## 5. Bằng Chứng Kiểm Thử Thực Tế Trên MongoDB Atlas & Gmail SMTP (Round 2 Audit)

### 5.1 Kiểm thử CAS Flash Sale 2 phiên đồng thời thật trên MongoDB Atlas (`BE-FIX-01` & `GAP-01`)
* **Cơ chế:** Nâng cấp `consumeFlashSaleQuotaInSession` sang dùng lệnh nguyên tử `FlashSale.findOneAndUpdate` với điều kiện `$elemMatch: { sku: cleanSku, soldQuantity: { $lte: item.quantityLimit - quantity } }` và `$inc: { 'items.$.soldQuantity': quantity, version: 1 }`.
* **Kết quả chạy `Promise.all` đồng thời 2 request khi `quantityLimit = 1`, `soldQuantity = 0` trên `pet_clinic_v2` (MongoDB Atlas):**
```json
{
  "concurrentOutcomes": [
    {
      "status": "fulfilled",
      "value": {
        "saleId": "6aef6265d66092fc710316b7",
        "sku": "SKU-LIVE-CAS-1794073189153",
        "soldQuantity": 1,
        "remainingQuantity": 0
      }
    },
    {
      "status": "rejected",
      "code": "FLASH_SALE_QUOTA_EXCEEDED",
      "httpStatus": 409,
      "message": "Số lượng yêu cầu (1) vượt quá giới hạn Flash Sale còn lại (0) cho SKU SKU-LIVE-CAS-1794073189153"
    }
  ],
  "dbStateAfter": {
    "id": "6aef6265d66092fc710316b7",
    "code": "FS-LIVE-189153",
    "soldQuantity": 1,
    "quantityLimit": 1
  }
}
```

### 5.2 Kiểm thử Transaction Rollback đa tài liệu thật trên MongoDB Atlas (`BE-FIX-05` & `GAP-16`)
* **Kịch bản:** Tạo `CommunityPost` (`6aef6265d66092fc710316e7`, `status: 'APPROVED'`) và `CommunityReport` (`6aef6265d66092fc710316eb`, `status: 'PENDING'`) trên MongoDB Atlas. Trong phiên `session.withTransaction` của `resolveCommunityReport`, sau khi cập nhật `CommunityReport` sang `RESOLVED`, ném lỗi ghi `CommunityPost`.
* **Bằng chứng MongoDB Atlas sau khi Transaction Abort (Rollback 100%):**
```json
{
  "reportId": "6aef6265d66092fc710316eb",
  "reportCode": "REP-LIVE-89806",
  "reportStatusAfterAbort": "PENDING",
  "reportDecisionAfterAbort": null,
  "reportVersionAfterAbort": 1,
  "postId": "6aef6265d66092fc710316e7",
  "postStatusAfterAbort": "APPROVED",
  "postHasOpenReportAfterAbort": true
}
```
* **Bằng chứng MongoDB Atlas khi chạy lại không lỗi (Commit thành công):**
```json
{
  "reportId": "6aef6265d66092fc710316eb",
  "reportStatusAfterCommit": "RESOLVED",
  "reportDecisionAfterCommit": "HIDE_POST",
  "postStatusAfterCommit": "HIDDEN",
  "postHasOpenReportAfterCommit": false
}
```

### 5.3 Kiểm thử Email Outbox & Gmail SMTP thật (`BE-FIX-04`, `GAP-08`, `GAP-09`)
* **Đã gỡ bỏ hoàn toàn `jsonTransport: true`** trong `src/shared/emailOutbox.service.js` và kết nối `EMAIL_APP` / `EMAIL_APP_PASSWORD` vào `config.smtp`.
* **Trường hợp 1 (Khi thiếu cấu hình SMTP):** Không dùng `jsonTransport`, đánh dấu `FAILED` và giữ Feedback ở `PROCESSING` (không báo `SENT` giả):
```json
{
  "feedbackId": "6aef6266d66092fc71031703",
  "feedbackStatus": "PROCESSING",
  "deliveryStatus": "FAILED",
  "errorMessage": "SMTP provider is not configured: missing SMTP_HOST/EMAIL_APP or EMAIL_APP_PASSWORD",
  "outboxId": "6aef6266d66092fc71031706",
  "outboxStatus": "FAILED"
}
```
* **Trường hợp 2 (Gửi thật qua Gmail SMTP `smtp.gmail.com:587`):**
```json
{
  "feedbackId": "6aef6266d66092fc71031703",
  "feedbackStatus": "PROCESSED",
  "deliveryStatus": "SENT",
  "providerMessageId": "<8c5d88ae-7751-a58a-a95f-279c1c43b34e@gmail.com>",
  "outboxId": "6aef6267d66092fc71031710",
  "outboxStatus": "SENT",
  "recipient": "leminhly1923@gmail.com",
  "sentAt": "2026-11-07T17:39:55.040Z"
}
```

### 5.4 Gỡ bỏ Fallback lưu ảnh Local Disk (`BE-FIX-09`) & Vô hiệu hóa cờ giả lập lỗi ngoài môi trường Test
* **Upload (`src/modules/upload/upload.service.js`):** Đã xóa hoàn toàn nhánh `fs.writeFileSync` / `fs.copyFileSync` vào `/public/uploads`. Nếu thiếu cấu hình Cloudinary hoặc Cloudinary gặp sự cố, API lập tức trả `502 Bad Gateway` (`code: 'UPLOAD_PROVIDER_ERROR'`).
* **Bảo mật cờ giả lập lỗi:** Các tham số `x-simulate-upload-failure`, `simulateEmailFailure`, `simulateFailureInTransaction` đã được khóa chặt sau điều kiện `process.env.NODE_ENV === 'test'`, hoàn toàn bị vô hiệu hóa trên môi trường staging/production.

### 5.5 Tối Ưu Hóa Tốc Độ Tải Trang Tồn Kho (`/admin/inventory`)
* **Nguyên nhân gây chậm (7–12 giây):**
  1. Hàm `listProducts` (`src/modules/catalog/catalog.service.js`) khi nhận `cursor` lọc `_id < decodedId` nhưng lại sort theo `{ createdAt: -1, _id: -1 }` khiến trang sau trả trùng sản phẩm trang trước và `nextCursor` không bao giờ `null`, làm hàm `allPages()` bên Angular lặp đúng 30 vòng tuần tự.
  2. `listStocks`, `listInventoryItems`, `listTransactions` giới hạn `limit <= 100` khiến ~1.080 dòng tồn kho phải chia làm 11 request tuần tự; `resolveInventoryActor` truy vấn lại `User` và `StaffProfile` dù `authenticate` middleware đã đồng bộ live; thiếu index trên `Product` cho `variants.inventoryItemId`.
* **Kết quả Benchmark thực tế trên MongoDB Atlas sau khi sửa:**
  - Duyệt toàn bộ 112 sản phẩm qua cursor kết thúc chính xác sau **2 trang** (`duplicateDetected: false`, `nextCursor: null`, tổng thời gian **1.016 ms** thay vì lặp 30 trang).
  - Tải song song toàn bộ `listInventoryItems` (337 vật tư), `listStocks` (1.000 bản ghi tồn kho), `listTransactions` chỉ mất **422 ms**.

---

## 6. Thông Số Môi Trường & Bàn Giao Kỹ Thuật

* **Git Repository:** `minhllk24/PET_CLINIC_BACKEND`
* **Git Branch:** `feat/foundation-v6`
* **Base URL:**
  - Local API: `http://localhost:8080/api/v1`
  - Render API: `https://pet-clinic-backend-a4lj.onrender.com/api/v1`
  - Staging Custom Domain: `https://api.drpetshouse.lat/api/v1`
* **Database:** `pet_clinic_v2` (MongoDB Atlas Cluster)
* **Kết quả Automated Tests:**
  - `tests/integration/be-fix-gap-uat.test.js`: **16/16 tests PASS (100%)**
  - Toàn bộ suite hệ thống: **32/32 suites PASS (408/408 tests)**


