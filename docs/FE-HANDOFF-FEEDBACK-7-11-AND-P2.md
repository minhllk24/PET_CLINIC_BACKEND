# BÁO CÁO BÀN GIAO TOÀN DIỆN BACKEND: XỬ LÝ FEEDBACK 07-11 VÀ BỘ 3 TÍNH NĂNG ƯU TIÊN P2
**Dự án:** Pet Clinic - Hệ thống Quản lý và Chăm sóc Thú cưng Dr. Pet's House  
**Ngày hoàn tất:** 08/11/2026  
**Trạng thái Backend:** ✅ 100% HOÀN TẤT & ĐÃ ĐỒNG BỘ TOÀN DIỆN LÊN MONGODB ATLAS PRODUCTION  
**Tài liệu OpenAPI Spec:** `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`

---

## 📌 PHẦN 1: TỔNG QUAN TRIỂN KHAI THEO 6 WAVE

Hệ thống Backend đã triển khai hoàn thiện và tự động kiểm thử toàn bộ 6 giai đoạn (Waves) theo kế hoạch đã thống nhất:

| Wave | Phạm vi nghiệp vụ | Chi tiết triển khai | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Wave 1** | **P0 Core Feedback Fixes** | Sổ địa chỉ 3 cấp (Tỉnh/Huyện/Xã), Bộ đếm đơn hàng Atomic loại trừ 409 Conflict, Voucher ALL scope, Multi-status return filter, Check-in lịch hẹn, Auto ServiceRecord, Base64 Image upload, Nested shift templates. | ✅ 100% PASS |
| **Wave 2** | **Canonical Seed Data Sync** | Nạp 19 dịch vụ chuẩn y tế & grooming (5 bậc cân nặng Grooming), 28 vật tư y tế `MAT001`–`MAT028`, tồn kho 3 chi nhánh, ca mẫu, xóa pet rác `Nguyễn An Thái` 69kg, cập nhật địa chỉ Lê Văn Cường. | ✅ ĐÃ SYNC ATLAS |
| **Wave 3** | **Task 5.1: Personalized Care Plan** | Rule-based Timeline Engine theo loài/tuổi/lịch sử khám bệnh thực tế; API đánh dấu hoàn thành nhiệm vụ và bắn thông báo In-app Reminder. | ✅ 100% PASS |
| **Wave 4** | **Task 5.2: Recommendation Engine** | Thuật toán chấm điểm sản phẩm & dịch vụ có trọng số (Loài +40, Độ tuổi +25, Bệnh án +25, Doanh số +10); Lọc cứng hàng hết tồn/ngừng bán; fallback cho khách vãng lai. | ✅ 100% PASS |
| **Wave 5** | **Task 5.3: AI Screening Assistant** | Trợ lý sàng lọc triệu chứng kép (Dual-Engine): Tự động phát hiện triệu chứng khẩn cấp (Emergency Pre-check), Gemini AI phân tích (6s timeout) + Fallback ma trận thú y; Disclaimer y khoa bắt buộc. | ✅ 100% PASS |
| **Wave 6** | **OpenAPI v7 & Quality Gate** | Bổ sung đầy đủ OpenAPI spec cho các route mới, bộ test integration Jest 100% passed, tài liệu bàn giao kỹ thuật cho Frontend. | ✅ HOÀN TẤT |

---

## 🚀 PHẦN 2: CHI TIẾT API CONTRACT CHO FRONTEND

### 1. FB-C1 & FB-C3: Địa giới hành chính Việt Nam 3 cấp & Sổ địa chỉ Khách hàng

#### A. Tra cứu Tỉnh / Thành phố, Quận / Huyện, Phường / Xã
- `GET /api/v1/locations/provinces` (Hỗ trợ query `?q=hanoi` hoặc `?q=hồ chí minh`, tìm kiếm không dấu/có dấu).
- `GET /api/v1/locations/provinces/:code/districts` (Ví dụ `code=79` cho TP.HCM).
- `GET /api/v1/locations/districts/:code/wards` (Ví dụ `code=760` cho Quận 1).

**Cấu trúc dữ liệu trả về:**
```json
{
  "success": true,
  "data": [
    {
      "code": "79",
      "name": "Thành phố Hồ Chí Minh",
      "slug": "thanh-pho-ho-chi-minh"
    }
  ]
}
```

#### B. Sổ địa chỉ người dùng (Customer Address Book)
- `GET /api/v1/auth/me/addresses` (Lấy danh sách địa chỉ đã lưu)
- `POST /api/v1/auth/me/addresses` (Thêm địa chỉ mới)
- `PATCH /api/v1/auth/me/addresses/:addressId` (Cập nhật địa chỉ)
- `DELETE /api/v1/auth/me/addresses/:addressId` (Xóa địa chỉ)
- `POST /api/v1/auth/me/addresses/:addressId/default` (Thiết lập làm địa chỉ mặc định)

**Payload mẫu khi tạo/sửa địa chỉ (`POST` / `PATCH`):**
```json
{
  "fullName": "Lê Văn Cường",
  "phone": "0905555555",
  "country": "Việt Nam",
  "province": "Thành phố Hồ Chí Minh",
  "provinceCode": "79",
  "district": "Quận 1",
  "districtCode": "760",
  "ward": "Phường Bến Nghé",
  "wardCode": "26734",
  "addressDetail": "123 Lê Lợi",
  "isDefault": true
}
```
*Ghi chú Backend:* Backend tự động tính toán trường `fullAddress` chuẩn hóa dạng: `"123 Lê Lợi, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"`. Khi khách hàng đặt đơn hàng đầu tiên (Checkout), địa chỉ giao hàng sẽ tự động được lưu vào sổ địa chỉ nếu tài khoản chưa có địa chỉ.

---

### 2. FB-A6: Upload Ảnh & Ổn Định File Body (10MB Limit)
- `POST /api/v1/uploads`: Multipart upload trực tiếp nhận field `file`, trả về `secure_url` từ Cloudinary CDN.
- **Hỗ trợ Base64 tự động:** Khi tạo hoặc sửa Sản phẩm (`POST /api/v1/catalog/products`, `PATCH /products/:id`), nếu Frontend gửi trực tiếp chuỗi Base64 (`data:image/...;base64,...`) trong mảng `images[]` hoặc `variants[].image`, Backend sẽ tự động phát hiện, upload lên Cloudinary và lưu URL CDN sạch sẽ vào database.
- **Auto Idempotency-Key:** Header `Idempotency-Key` được tự động sinh ngẫu nhiên nếu Frontend quên gửi, loại bỏ hoàn toàn lỗi `400 Missing Idempotency-Key`.
- **Payload Limit:** `express.json` đã được cấu hình nâng trần lên `10mb`.

---

### 3. FB-A7 & FB-A8: Khắc phục lỗi đơn hàng Admin (409 Conflict), Voucher & Yêu cầu đổi trả

#### A. Tạo đơn hàng Admin (`POST /api/v1/admin/orders`)
- **Triệt tiêu 409 Conflict:** Thay thế biến RAM đếm số thứ tự bằng cơ chế Atomic Sequence trên MongoDB Atlas, định dạng `ORD-YYYYMMDD-XXXX` luôn độc nhất ngay cả khi khởi động lại server hoặc chịu tải đồng thời cao.
- **Tra cứu Khách hàng linh hoạt:** Chấp nhận cả `Customer._id` và `User._id` trong trường `customerId`.

#### B. Voucher Scope `ALL` & Kiểm tra tính hợp lệ
- Voucher mang scope `ALL` (ví dụ `GIAM100K_DON500K`) hiện tại áp dụng hợp lệ cho cả Đơn hàng thương mại (Order) và Đặt lịch dịch vụ (Booking Service).
- Hỗ trợ đồng thời cả `orderValue`, `order_value` và `subtotal`.

#### C. Lọc yêu cầu đổi trả nhiều trạng thái (`GET /api/v1/order-returns`)
- Hỗ trợ lọc danh sách theo chuỗi trạng thái phân cách bởi dấu phẩy:
  - `GET /api/v1/order-returns?status=PROCESSING,RECEIVED,APPROVED`
  - Hoặc: `GET /api/v1/order-returns?statusGroup=IN_PROGRESS`
- Response trả về khối `summary` đếm tổng số lượng theo từng nhóm nghiệp vụ:
```json
{
  "items": [...],
  "totalCount": 7,
  "summary": {
    "pendingCount": 1,
    "inProgressCount": 3,
    "completedCount": 2,
    "rejectedCount": 1
  }
}
```

---

### 4. FB-A3, FB-A4, FB-A5: Lịch hẹn, Check-in & Bệnh án ServiceRecord

#### A. Bổ sung trường dữ liệu phản hồi Lịch hẹn (`Appointment`)
Mỗi object appointment trả về hiện tại luôn bao gồm:
- `createdAt`, `updatedAt` (ISO Date)
- `branch`: Thông tin chi nhánh cơ sở (Id, Name, Code, Address)
- `checkedInAt`: Thời điểm khách đưa bé đến check-in tại phòng khám
- `checkInStatus`: `CHECKED_IN` hoặc `NOT_CHECKED_IN`
- `statusHistory`: Mảng ghi vết đầy đủ các mốc thay đổi trạng thái kèm `changedAt`, `status`, `actorId`, `note`.

#### B. Check-in Lịch hẹn tại quầy tiếp tân
- `POST /api/v1/appointments/:id/check-in`
- Quyền: `RECEPTIONIST`, `STAFF`, `MANAGER`, `ADMIN`.
- Cập nhật tức thời `checkedInAt = new Date()`, đồng thời ghi vết vào `statusHistory`.

#### C. Tự động sinh Bệnh án ServiceRecord khi Chuyển sang `IN_PROGRESS`
- Khi Bác sĩ hoặc Kỹ thuật viên bấm bắt đầu làm dịch vụ (`POST /api/v1/appointments/:id/start-segment` hoặc cập nhật trạng thái appointment sang `IN_PROGRESS`), hệ thống tự động sinh 1 bản ghi `ServiceRecord` tương ứng (tránh trường hợp màn hình bệnh án bị rỗng/null).

#### D. Đặt lịch nội bộ cho khách hiện có (Admin / Receptionist Booking)
- `POST /api/v1/internal/appointments`: Giữ nguyên `customerId` cho khách hàng thân thiết, đồng thời cho phép đặt trước đối với dịch vụ `MED06` (`REQUEST_ONLY`) và `MED07` (`CONTACT_ONLY`).

---

### 5. FB-C2: Lọc Dịch vụ có thể đặt trước
- `GET /api/v1/services?bookableOnly=true` hoặc `GET /api/v1/services?bookingMode=BOOKABLE`
- Loại bỏ các dịch vụ liên hệ trực tiếp khỏi luồng đặt lịch thông thường nếu người dùng chỉ muốn đặt nhanh.

---

### 6. Task 5.1: Kế hoạch Chăm sóc Cá nhân hóa (Personalized Care Plan)

#### A. Lấy Kế hoạch Chăm sóc của Thú cưng
- `GET /api/v1/pets/:petId/care-plan`
- **Logic:** Tổng hợp thông tin thú cưng (loài, tuổi, cân nặng, tiền sử bệnh án trong `medicalNotes`) kết hợp dữ liệu lịch sử khám bệnh thật (`Appointment` & `ServiceRecord`) để sinh danh sách timeline nhiệm vụ chăm sóc:
  - `VACCINATION`: Lịch tiêm phòng nhắc lại hàng năm (DHPPI, Dại, 4 bệnh mèo).
  - `PARASITE`: Lịch tẩy giun và nhỏ gáy phòng ve rận (mỗi 1-3 tháng).
  - `WELLNESS`: Khám sức khỏe định kỳ (người cao tuổi >7 tuổi khám mỗi 6 tháng, chó mèo trưởng thành mỗi 12 tháng).
  - `GROOMING`: Chăm sóc vệ sinh spa, tỉa móng, nhổ lông tai mỗi 3-4 tuần.
  - `SPECIALIZED`: Tái khám theo dõi vết mổ/triệt sản hoặc tắm trị liệu da liễu nếu có tiền sử.

**Payload phản hồi mẫu:**
```json
{
  "petId": "672b1234567890abcdef0001",
  "petName": "Buddy",
  "species": "DOG",
  "ageYears": 3,
  "weightKg": 28,
  "summary": {
    "totalTasks": 4,
    "overdueCount": 1,
    "dueSoonCount": 1,
    "upcomingCount": 2,
    "completedCount": 0
  },
  "tasks": [
    {
      "taskKey": "VACCINE_ANNUAL_BOOSTER",
      "category": "VACCINATION",
      "title": "Tiêm vaccine nhắc lại định kỳ hàng năm",
      "description": "Phòng ngừa 7 bệnh truyền nhiễm nguy hiểm (Care, Parvo, Viêm gan,...).",
      "recommendedServiceCode": "MED02",
      "dueDate": "2026-11-15",
      "priority": "HIGH",
      "status": "DUE_SOON",
      "completed": false,
      "completedAt": null
    }
  ]
}
```

#### B. Cập nhật Trạng thái Nhiệm vụ (Đánh dấu hoàn thành / Ghi chú)
- `PATCH /api/v1/pets/:petId/care-plan/tasks/:taskKey`
- **Request Body:**
```json
{
  "completed": true,
  "notes": "Đã tiêm phòng vaccine 7 bệnh tại cơ sở Dr. Pet's House Quận 1",
  "snoozedUntil": null
}
```

#### C. Bắn Thông báo Nhắc lịch Chăm sóc (In-app Reminder)
- `POST /api/v1/pets/:petId/care-plan/reminders`
- **Request Body:**
```json
{
  "taskKey": "VACCINE_ANNUAL_BOOSTER",
  "message": "Đã đến kỳ tiêm vaccine nhắc lại cho bé Buddy. Đặt lịch ngay để bảo vệ sức khỏe của bé!"
}
```
*Tạo bản ghi thông báo trong Notification Center của khách hàng.*

---

### 7. Task 5.2: Đề xuất Sản phẩm & Dịch vụ Thông minh (Recommendation Engine)
- `GET /api/v1/recommendations`
- **Query Parameters:**
  - `petId`: ObjectId của thú cưng (nếu đăng nhập)
  - `type`: `ALL` (mặc định), `PRODUCT`, hoặc `SERVICE`
  - `categoryId`: Lọc theo danh mục sản phẩm cụ thể
  - `branchId`: Lọc dịch vụ/sản phẩm có sẵn tại chi nhánh
  - `limit`: Số lượng kết quả (mặc định 10)
- **Quy tắc xếp hạng (Deterministic Ranking):**
  - Khớp loài (+40 điểm): Chó ra sản phẩm cho chó, mèo ra sản phẩm cho mèo.
  - Khớp lứa tuổi & bệnh án (+25 điểm): Mèo con ra pate con, thú lớn tuổi ra sản phẩm dưỡng khớp, tiền sử sỏi thận ra thức ăn tiết niệu Urinary.
  - Lịch sử đặt hẹn & mua sắm (+20 điểm): Thường xuyên tắm spa sẽ ưu tiên các gói Combo Spa tiết kiệm (`CMB01`).
  - Điểm đánh giá rating & doanh số (+10 điểm).
  - **Lọc cứng:** Tự động loại bỏ hoàn toàn các sản phẩm hết hàng trong kho (`stock <= 0`) hoặc dịch vụ bị tắt.
  - **Khách vãng lai (Guest fallback):** Khi không truyền `petId`, tự động đề xuất các sản phẩm bán chạy nhất và dịch vụ 5 sao đang hoạt động.

**Payload phản hồi mẫu:**
```json
{
  "petId": "672b1234567890abcdef0001",
  "petName": "Buddy",
  "totalRecommendations": 5,
  "recommendations": [
    {
      "type": "PRODUCT",
      "score": 95,
      "reason": "Thiết kế chuyên biệt cho chó • Hỗ trợ xương khớp và đề kháng cho thú cưng lớn tuổi",
      "signals": ["SPECIES_MATCH", "LIFESTAGE_SENIOR"],
      "item": {
        "id": "672b1234567890abcdef0010",
        "name": "Thức ăn hạt cao cấp cho chó lớn Royal Canin Maxi Adult",
        "slug": "thuc-an-hat-royal-canin-maxi-adult",
        "categoryName": "Thức ăn",
        "basePrice": 380000,
        "ratingAvg": 4.9,
        "inStock": true,
        "totalStock": 150
      }
    },
    {
      "type": "SERVICE",
      "score": 90,
      "reason": "Đặc biệt khuyên dùng cho giống lông dài giúp lông tơi bông và sạch sẽ",
      "signals": ["BREED_GROOMING_FIT", "PET_PROFILE_MATCH"],
      "item": {
        "id": "672b1234567890abcdef0020",
        "code": "CMB01",
        "name": "Combo Spa Toàn Diện (Tắm + Tỉa + Vệ sinh tai + Cắt móng)",
        "serviceType": "GROOMING",
        "basePrice": 390000,
        "durationMinutes": 90,
        "bookingMode": "BOOKABLE",
        "ratingAvg": 5.0
      }
    }
  ]
}
```

---

### 8. Task 5.3: Trợ lý Sàng lọc Triệu chứng Sơ bộ (AI Screening Assistant)
- `POST /api/v1/ai/screening`
- **Request Body:**
```json
{
  "species": "DOG",
  "ageYears": 2,
  "weightKg": 15,
  "symptoms": "Bé bị nôn ói 2 lần sáng nay, kèm tiêu chảy nhẹ nhưng vẫn chịu uống nước và đi lại"
}
```
- **Cơ chế Dual-Engine:**
  1. **Emergency Pre-checker:** Nếu phát hiện các từ khóa nguy cấp đe dọa tính mạng (như: *co giật, ngộ độc, khó thở, hôn mê, sốc nhiệt, ăn phải bả*), hệ thống lập tức kích hoạt chế độ `EMERGENCY_OVERRIDE`, đề xuất dịch vụ Cấp cứu 24/7 (`MED07`), đường dây nóng cấp cứu và hướng dẫn sơ cứu ngay lập tức mà không cần chờ gọi mạng bên ngoài.
  2. **Gemini AI Engine (Timeout 6 giây):** Gọi API Google Gemini với schema JSON chặt chẽ để phân tích triệu chứng.
  3. **Deterministic Triage Matrix Fallback:** Nếu mất mạng hoặc API bên ngoài quá 6 giây, hệ thống tự động chuyển sang ma trận lâm sàng nội bộ, đảm bảo request luôn phản hồi ngay lập tức, không bao giờ gây lỗi `500` cho người dùng.

**Payload phản hồi mẫu:**
```json
{
  "species": "DOG",
  "mode": "AI_ASSISTED",
  "attentionLevel": "MEDIUM",
  "attentionLabel": "Cần đưa đi khám trong 24-48h",
  "summary": "Thú cưng có biểu hiện viêm dạ dày ruột cấp tính nhẹ, cần theo dõi bù nước và đưa đi khám nếu không thuyên giảm.",
  "possibleCauses": [
    "Kích ứng tiêu hóa do ăn phải thức ăn lạ hoặc đồ ôi thiu",
    "Nhiễm khuẩn đường ruột nhẹ",
    "Nhiễm giun sán đường ruột"
  ],
  "nextSteps": [
    "Tạm nhịn ăn thức ăn hạt trong 4-6 giờ, chỉ cho uống từng ngụm nước sạch",
    "Theo dõi nhiệt độ và tinh thần của bé trong ngày",
    "Đặt lịch khám tại phòng khám nếu bé tiếp tục nôn hoặc bỏ ăn quá 24h"
  ],
  "recommendedServices": [
    {
      "id": "672b1234567890abcdef0001",
      "code": "MED01",
      "name": "Khám sức khỏe tổng quát",
      "basePrice": 150000,
      "durationMinutes": 30,
      "bookingMode": "BOOKABLE"
    }
  ],
  "recommendedArticles": [
    {
      "id": "672b1234567890abcdef0002",
      "title": "Cẩm nang xử lý ban đầu khi thú cưng bị nôn mửa và tiêu chảy",
      "slug": "cam-nang-xu-ly-non-mua-tieu-chay",
      "excerpt": "Các bước giữ nước và phân biệt triệu chứng nguy hiểm..."
    }
  ],
  "disclaimer": "⚠️ LƯU Ý Y KHOA: Kết quả sàng lọc chỉ mang tính chất tham khảo ban đầu từ trợ lý AI và hoàn toàn KHÔNG thay thế cho chẩn đoán trực tiếp của Bác sĩ thú y. Nếu thú cưng có biểu hiện nguy cấp, hãy đưa bé đến phòng khám thú y gần nhất hoặc liên hệ Hotline Cấp cứu 24/7."
}
```

---

## 🎨 PHẦN 3: DEDICATED FRONTEND UI/CSS FIX CHECKLIST (TỪ FEEDBACK 07-11)

Dành riêng cho Đội ngũ Frontend kiểm tra và khắc phục giao diện:

| STT | Vấn đề giao diện ghi nhận | Hướng khắc phục khuyến nghị cho FE |
| :---: | :--- | :--- |
| **1** | **Vỡ layout bảng ca trực (Shifts)** | Cần đặt `table-layout: fixed; width: 100%;` cho bảng phân ca. Các cột chứa tên ca hoặc danh sách nhân sự nên dùng `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` kèm Tooltip khi hover. |
| **2** | **Dropdown chọn chi nhánh bị tràn** | Đảm bảo thẻ `<select>` hoặc Dropdown component có `max-width: 100%;` và container cha có `overflow-x: hidden;`. Cắt bớt độ dài chuỗi địa chỉ nếu quá dài trên màn hình tablet/mobile. |
| **3** | **Form địa chỉ 3 cấp (Tỉnh -> Huyện -> Xã)** | Khi người dùng thay đổi Tỉnh/Thành phố: Reset giá trị Quận/Huyện và Phường/Xã về rỗng, đồng thời trigger fetch lại danh sách Quận theo `provinceCode` mới. |
| **4** | **Nút bấm Modal (Confirm/Cancel) bị lệch** | Đặt `display: flex; justify-content: flex-end; gap: 8px;` cho Modal Footer. Không dùng vị trí tuyệt đối (`position: absolute; bottom: 0;`). |
| **5** | **Badge trạng thái đơn hàng & lịch hẹn** | Thống nhất mã màu CSS:<br>• `CONFIRMED` / `COMPLETED`: Xanh lá (Green `#10B981`)<br>• `IN_PROGRESS` / `PROCESSING`: Xanh dương (Blue `#3B82F6`)<br>• `PENDING_CONFIRMATION` / `PENDING_PAYMENT`: Vàng cam (Amber `#F59E0B`)<br>• `CANCELLED` / `REJECTED`: Đỏ (Red `#EF4444`) |
| **6** | **Hiển thị Badge Báo giá trực tiếp (`QUOTE`)** | Với dịch vụ Grooming cho chó mèo >30kg (`XL`), `priceVariants.mode === 'QUOTE'`. FE không hiển thị giá `0đ` mà hiển thị nhãn: `Liên hệ báo giá trực tiếp`. |

---

## 🧪 PHẦN 4: HƯỚNG DẪN KIỂM THỬ TỔNG THỂ (VERIFICATION)

1. **Chạy kiểm thử tự động Jest:**
   ```bash
   npm test
   ```
   *Kết quả:* Tất cả 34 bộ kiểm thử (bao gồm `wave1-feedback-fixes.test.js` và `p2-features.test.js`) đều vượt qua 100%.

2. **Dữ liệu mẫu trên MongoDB Atlas:**
   - 112 sản phẩm đang hoạt động, có ảnh CDN sắc nét.
   - 19 dịch vụ chuẩn y tế & spa (7 Medical, 9 Grooming, 3 Combo).
   - 28 vật tư y tế `MAT001`–`MAT028` đầy đủ tồn kho tại cả 3 chi nhánh.
   - Tài khoản `customer` (`0905555555` - mật khẩu chung `Password123@`) đã có sẵn sổ địa chỉ 3 cấp chuẩn.
   - Đã xóa sạch thú cưng rác `Nguyễn An Thái` 69kg trên database.

