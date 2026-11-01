# BÁO CÁO TRIỂN KHAI BACKEND VÀ TÀI LIỆU HANDOFF CHO FRONTEND (PHIÊN BẢN V6)

> **Mã tài liệu:** `DOC-BE-FE-BR3-AUTOCONFIRM-V6`  
> **Dự án:** Hệ thống Chuỗi Phòng Khám & Thương Mại Điện Tử Thú Y Dr. Pet's House  
> **Nhánh Git:** `feat/foundation-v6`  
> **Người thực hiện:** Backend Specialist (Antigravity Agent)  
> **Ngày phát hành:** 01/11/2026  
> **Đối tượng tiếp nhận:** Nhóm phát triển Frontend (Angular Customer Shell & Admin Shell), QA/Tester, Tech Lead  

---

## PHẦN I: BÁO CÁO KẾT QUẢ TRIỂN KHAI BACKEND

### 1. Tổng quan các vấn đề đã xử lý triệt để

Theo nội dung trao đổi kỹ thuật của nhóm qua các tin nhắn chat về hệ thống Booking và Hồ sơ bệnh án thú y, Backend đã hoàn tất 100% các hạng mục kỹ thuật:

| STT | Vấn đề phản ánh từ Chat Team | Trạng thái trước đây | Giải pháp Backend đã triển khai | Trạng thái hiện tại |
|---|---|---|---|---|
| **1** | **Lỗi Capacity Check chặn nhầm khung giờ** | Query đếm lịch hẹn trùng lặp toàn bộ khoảng `[scheduledStart, scheduledEnd]` của lịch hẹn thay vì từng chặng dịch vụ (`segments`), gây xung đột sai khi khách đặt nhiều dịch vụ so le | Sửa đổi query dùng `$elemMatch` đối chiếu chính xác theo từng dịch vụ, loại trừ các lịch `PENDING_PAYMENT` đã hết hạn giữ chỗ | ✅ **ĐÃ KHẮC PHỤC** |
| **2** | **Thời gian giữ chỗ chưa thống nhất** | Đang để 10 phút (`10 * 60 * 1000`) | Nâng lên **15 phút** (`15 * 60 * 1000`) đồng bộ với giao diện và quy chế thanh toán | ✅ **ĐÃ ĐỒNG BỘ** |
| **3** | **Bỏ bước `PENDING_CONFIRMATION` thủ công** | Đặt lịch xong phải chờ lễ tân bấm xác nhận thủ công dù đã cọc | Chuyển thẳng sang `CONFIRMED` ngay khi thanh toán cọc/toàn phần thành công (`ONLINE_MOCK`, 0đ hoặc thanh toán tại quầy) | ✅ **TỰ ĐỘNG HÓA** |
| **4** | **Nghiệp vụ BR3: Tự động chỉ định Bác sĩ duyệt hồ sơ** | Chưa có logic gán Bác sĩ duyệt (`reviewerStaffId`) khi Y tá thực hiện dịch vụ y tế | Xây dựng thuật toán `resolveVetReviewer` áp dụng 5 cấp độ ưu tiên, tự động gán Bác sĩ duyệt lúc tạo lịch hẹn và lúc tạo/gửi hồ sơ | ✅ **HOÀN THIỆN 100%** |
| **5** | **Chuẩn hóa danh mục dịch vụ điều dưỡng MED05** | `MED05` trước đây là "Tư vấn dinh dưỡng" (`VETERINARIAN`, `CONTACT_ONLY`) | Chuẩn hóa `MED05` thành "Thay băng & Chăm sóc vết thương" (`NURSE`, `BOOKABLE`, 120.000đ, 30 phút, mở ở cả 3 chi nhánh) | ✅ **CHUẨN HÓA** |
| **6** | **Cronjob huỷ nhầm đơn đã xác nhận** | Cronjob query các lịch `holdExpiresAt <= now` mà không ràng buộc trạng thái `PENDING_PAYMENT` | Thắt chặt query cronjob chỉ quét `status: 'PENDING_PAYMENT'`, đảm bảo lịch `CONFIRMED` không bao giờ bị hủy | ✅ **ĐÃ BẢO VỆ** |

---

### 2. Chi tiết kỹ thuật các giải pháp cốt lõi

#### 2.1. Nâng cấp bộ lọc kiểm tra sức chứa (Capacity Check)
- **Vị trí file:** `src/modules/booking/booking.service.js`
- **Cơ chế mới:**
  - Đối chiếu sức chứa phòng khám dựa trên số lượng nhân sự trực trong ca của chi nhánh.
  - Sử dụng toán tử `$elemMatch` lồng sâu vào mảng `services` của từng lịch hẹn:
    ```javascript
    const conflictingCount = await Appointment.countDocuments({
      branchId,
      status: { $in: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'] },
      $or: [
        { status: { $ne: 'PENDING_PAYMENT' } },
        { holdExpiresAt: { $gt: now } } // Bỏ qua các hold đã hết hạn
      ],
      services: {
        $elemMatch: {
          serviceId: seg.serviceId,
          start: { $lt: seg.end },
          end: { $gt: seg.start }
        }
      }
    });
    ```

#### 2.2. Quy tắc tự động gán Bác sĩ duyệt hồ sơ (BR3 - Vet Reviewer Resolution)
- **Vị trí file:** `src/modules/booking/booking.service.js`, `src/modules/execution/execution.service.js`
- **Hàm xử lý:** `resolveVetReviewer({ branchId, scheduledStart, scheduledEnd, preferredStaffId })`
- **5 Cấp độ ưu tiên nghiêm ngặt:**
  1. **Ưu tiên 1:** Bác sĩ khám chính của chính lịch hẹn đó (nếu trong lịch hẹn có chặng do Bác sĩ đảm nhiệm).
  2. **Ưu tiên 2:** Bác sĩ yêu cầu của khách hàng (`preferredStaffId`) nếu bác sĩ đó có lịch trực tại chi nhánh trùng khung giờ.
  3. **Ưu tiên 3:** Bác sĩ đang có ca trực tại chi nhánh (`Shift.find({ branchId, role: 'VETERINARIAN' })`) và có ít lịch duyệt nhất trong ngày (Load Balancing).
  4. **Ưu tiên 4:** Bác sĩ bất kỳ đang trực ca tại chi nhánh đó trong ngày.
  5. **Ưu tiên 5:** Bác sĩ trưởng phòng khám / Bác sĩ trực thuộc chi nhánh (Fallback an toàn).

#### 2.3. Tối ưu hóa phân quyền duyệt và chốt hồ sơ bệnh án
- **Vị trí file:** `src/modules/execution/execution.service.js`
- Hỗ trợ linh hoạt đối chiếu quyền truy cập thông qua cả `User._id` (JWT Token payload) và `StaffProfile._id`:
  - **Y tá (`NURSE`):** Thực hiện khám/chăm sóc, nhập ghi chú lâm sàng, bấm `submitReview` để chuyển trạng thái sang `WAITING_VET_REVIEW`.
  - **Bác sĩ (`VETERINARIAN`):** Bác sĩ được chỉ định duyệt (`reviewerStaffId`) hoặc Bác sĩ thực hiện có toàn quyền lưu nháp (`saveRecordDraft`) và chốt hồ sơ (`finalizeRecord`).
  - **Quản lý (`MANAGER`), Admin (`ADMIN`):** Có quyền duyệt hỗ trợ nếu bác sĩ vắng mặt đột xuất.

---

### 3. Kết quả kiểm thử chất lượng (Verification & Cleanliness)

1. **Bộ kiểm thử tự động (Automated Test Suite):**
   - Lệnh thực thi: `npm test`
   - Kết quả: **23/23 Test Suites PASSED**, **313/313 Tests PASSED** (Bao gồm trọn bộ unit test BR3 `tests/br3-phase1-phase2.test.js`).
2. **Biên dịch mã nguồn (Babel Production Build):**
   - Lệnh thực thi: `npm run build`
   - Kết quả: **141/141 files compiled successfully** vào thư mục `dist/` không có cảnh báo syntax.
3. **Kiểm tra độ sạch dữ liệu (Production Cleanliness Check):**
   - Lệnh thực thi: `npm run check:clean`
   - Kết quả: **100% Sạch sẽ** trên MongoDB Atlas:
     - 0 Dịch vụ rác
     - 0 Đơn hàng chứa chuỗi test cũ
     - 0 Yêu cầu đổi trả test
     - 0 Lịch hẹn chứa mã `APT-CUST` / `APT-GUEST`
     - 0 Voucher thử nghiệm hiển thị trên UI

---

## PHẦN II: HƯỚNG DẪN TÍCH HỢP CHO FRONTEND (FE HANDOFF)

### 1. Thay đổi quy trình Đặt lịch & Thanh toán (Booking & Payment Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách hàng (FE Customer)
    participant FE as Customer Shell (Angular)
    participant BE as Backend API
    participant DB as MongoDB Atlas

    Customer->>FE: Chọn chi nhánh, thú cưng, dịch vụ (MED05 / Y tế)
    FE->>BE: POST /api/v1/appointments/public/book (hoặc /appointments)
    BE->>DB: Kiểm tra capacity từng segment & tạo Hold 15 phút
    BE->>BE: Tự động resolve reviewerStaffId (BR3)
    BE-->>FE: Trả về Appointment (status: PENDING_PAYMENT, holdExpiresAt: +15m)
    
    FE->>FE: Bắt đầu đồng hồ đếm ngược 15:00
    Customer->>FE: Chọn phương thức thanh toán cọc/toàn phần
    FE->>BE: POST /api/v1/payments/mock-complete (hoặc cổng VNPAY/MOMO)
    BE->>DB: Cập nhật status: CONFIRMED, holdExpiresAt: null
    BE-->>FE: HTTP 200 OK (status: CONFIRMED)
    FE->>Customer: Hiển thị màn hình "ĐẶT LỊCH THÀNH CÔNG" (Xác nhận ngay lập tức)
```

#### Lưu ý cho FE:
- **Đồng hồ đếm ngược:** Khi tạo lịch hẹn, backend trả về `holdExpiresAt`. Frontend hiển thị đồng hồ đếm ngược đúng **15 phút**. Nếu hết 15 phút mà khách chưa thanh toán, backend cronjob sẽ tự động hủy (`CANCELLED`, reason: `HOLD_EXPIRED`).
- **Trạng thái lịch hẹn sau thanh toán:** Lịch hẹn chuyển ngay sang **`CONFIRMED`**. Frontend **KHÔNG CẦN** hiển thị thông báo "Chờ lễ tân duyệt" như phiên bản cũ. Khách hàng nhận được mã đặt chỗ và có thể đến phòng khám theo đúng giờ hẹn.

---

### 2. Hướng dẫn giao diện Quản lý Khám & Duyệt hồ sơ (Admin / Staff Shell)

#### 2.1. Phân loại theo vai trò nhân sự

| Vai trò | Quyền hạn trên Lịch hẹn / Hồ sơ bệnh án | Giao diện tương ứng |
|---|---|---|
| **Y tá / Điều dưỡng (`NURSE`)** | - Tiếp nhận ca chăm sóc điều dưỡng (như `MED05 - Thay băng & Chăm sóc vết thương`).<br>- Mở ca điều trị (`POST /service-records/:id/start-treatment`).<br>- Ghi chú chăm sóc & Bấm **"Gửi Bác sĩ duyệt"** (`POST /service-records/:id/submit-review`). | Nút màu cam/xanh dương: **"Hoàn tất & Gửi duyệt"** |
| **Bác sĩ Thú y (`VETERINARIAN`)** | - Khám bệnh và chốt hồ sơ đối với ca khám bệnh chính.<br>- Duyệt hồ sơ điều dưỡng do Y tá gửi lên (`WAITING_VET_REVIEW`).<br>- Kê đơn thuốc, kết luận y khoa & Bấm **"Hoàn tất & Chốt hồ sơ"** (`POST /service-records/:id/finalize`). | Tab danh sách: **"Hồ sơ cần duyệt"** + Nút **"Duyệt & Chốt hồ sơ"** |
| **Lễ tân (`RECEPTIONIST`)** | - Xem danh sách lịch hẹn trong ngày của chi nhánh.<br>- Check-in khách đến (`POST /appointments/:id/check-in`).<br>- Thu tiền tại quầy (nếu thanh toán sau). | Màn hình tiếp đón / Check-in |

---

### 3. Chi tiết API dành cho Frontend kết nối

#### 3.1. API Tạo lịch hẹn (Public & Member)
- **Endpoint:** `POST /api/v1/appointments/public/book` (hoặc `POST /api/v1/appointments`)
- **Headers:** `Content-Type: application/json`
- **Request Body mẫu (Dịch vụ Điều dưỡng MED05 do Y tá thực hiện):**
  ```json
  {
    "branchId": "6ad08e4417bf41f5954234c3",
    "customer": {
      "fullName": "Lê Văn Cường",
      "phone": "0901234567",
      "email": "cuong.le@example.com"
    },
    "pet": {
      "petName": "Buddy",
      "species": "DOG",
      "breed": "Golden Retriever",
      "weightKg": 25
    },
    "services": [
      {
        "serviceId": "6ad08e4417bf41f5954234c8",
        "serviceCode": "MED05",
        "staffId": null
      }
    ],
    "scheduledStart": "2026-11-02T09:00:00.000Z",
    "notes": "Thay băng vết mổ ở chân sau"
  }
  ```
- **Response trả về (Trích đoạn quan trọng):**
  ```json
  {
    "success": true,
    "data": {
      "appointment": {
        "_id": "6724...",
        "code": "APT-20261102-0001",
        "branchId": "6ad08e4417bf41f5954234c3",
        "status": "PENDING_PAYMENT",
        "primaryServiceType": "MEDICAL",
        "reviewerStaffId": "6ad08e4417bf41f5954234d1",
        "holdExpiresAt": "2026-11-02T02:15:00.000Z",
        "depositRequired": 36000,
        "totalEstimatedPrice": 120000
      }
    }
  }
  ```
  *(Lưu ý: `reviewerStaffId` đã được Backend tự động phân bổ cho Bác sĩ trực phụ trách).*

---

#### 3.2. API Y tá nộp hồ sơ chuyển Bác sĩ duyệt
- **Endpoint:** `POST /api/v1/service-records/:recordId/submit-review`
- **Quyền truy cập:** Token của nhân sự vai trò `NURSE` (hoặc nhân sự được phân công ca).
- **Request Body:**
  ```json
  {
    "treatmentNotes": "Đã tiến hành rửa vết thương bằng Povidine, thay gạc vô trùng và kiểm tra dấu hiệu nhiễm trùng. Vết thương khô ráo, không sưng mủ.",
    "performedStaffNote": "Bệnh nhân ngoan, không giãy giụa. Cần bác sĩ kiểm tra đơn thuốc kháng sinh bổ sung."
  }
  ```
- **Response thành công:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "6725...",
      "appointmentId": "6724...",
      "status": "WAITING_VET_REVIEW",
      "reviewerStaffId": "6ad08e4417bf41f5954234d1",
      "statusHistory": [
        {
          "status": "IN_PROGRESS",
          "updatedAt": "2026-11-02T09:10:00.000Z"
        },
        {
          "status": "WAITING_VET_REVIEW",
          "updatedAt": "2026-11-02T09:30:00.000Z",
          "note": "Y tá hoàn tất chăm sóc, chuyển bác sĩ thú y xem xét"
        }
      ]
    }
  }
  ```

---

#### 3.3. API Bác sĩ duyệt và chốt hồ sơ bệnh án
- **Endpoint:** `POST /api/v1/service-records/:recordId/finalize`
- **Quyền truy cập:** Token của Bác sĩ được gán (`reviewerStaffId`), hoặc Bác sĩ thực hiện, hoặc Quản lý chi nhánh.
- **Request Body:**
  ```json
  {
    "doctorConclusion": "Vết thương hồi phục tốt theo tiến trình ngày thứ 5. Tiếp tục giữ khô vết thương trong 3 ngày tới.",
    "prescription": [
      {
        "medicineName": "Amoxicillin 250mg",
        "dosage": "1 viên/lần, ngày 2 lần sau ăn",
        "durationDays": 5
      }
    ],
    "followUpDate": "2026-11-07T09:00:00.000Z"
  }
  ```
- **Response thành công:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "6725...",
      "status": "FINALIZED",
      "finalizedAt": "2026-11-02T09:45:00.000Z",
      "finalizedBy": "6ad08e4417bf41f5954234d1"
    }
  }
  ```
  *(Khi chốt hồ sơ, Backend sẽ đồng thời cập nhật Lịch hẹn tương ứng sang `COMPLETED`).*

---

### 4. Dữ liệu tài khoản kiểm thử UAT có sẵn trên môi trường thực tế

Toàn bộ các tài khoản dưới đây đã được cập nhật mật khẩu chung chuẩn bảo mật: `K9#mQ$8xL!2vW*7z`

| Tên Nhân Sự | Mã Nhân Viên | Vai Trò | Chi Nhánh | Email Đăng Nhập | Mục Đích Thử Nghiệm FE |
|---|---|---|---|---|---|
| **Bác sĩ Đặng Quốc An** | `BS-001` | `VETERINARIAN` | Quận 1 | `an.dang@petclinic.vn` | Đăng nhập để kiểm tra ca cần duyệt `WAITING_VET_REVIEW` (Lịch `APT-20261026-0002`) |
| **Y tá Lê Thị Mai** | `YT-001` | `NURSE` | Quận 1 | `mai.le@petclinic.vn` | Đăng nhập thực hiện ca điều dưỡng `MED05` và bấm gửi duyệt Bác sĩ |
| **Bác sĩ Trần Bảo Bình** | `BS-002` | `VETERINARIAN` | Quận 7 | `binh.tran@petclinic.vn` | Thử nghiệm load balancing phân bổ Bác sĩ duyệt tại Chi nhánh Q7 |
| **Lễ tân Hoàng Thị Cúc** | `LT-001` | `RECEPTIONIST` | Quận 1 | `cuc.hoang@petclinic.vn` | Thử nghiệm tiếp đón, kiểm tra danh sách lịch hẹn xác nhận tự động |
| **Quản lý Phạm Minh Đức** | `QL-001` | `MANAGER` | Quận 1 | `duc.pham@petclinic.vn` | Quyền duyệt tối cao đối với toàn bộ hồ sơ chi nhánh |

> **Ca bệnh mẫu sẵn sàng kiểm thử ngay:**
> - Mã lịch hẹn: `APT-20261026-0002`
> - Khách hàng: Lê Văn Cường - Thú cưng: Mèo Luna
> - Dịch vụ: `MED05` (Thay băng & Chăm sóc vết thương) do Y tá Mai thực hiện
> - Trạng thái hồ sơ: **`WAITING_VET_REVIEW`**
> - Bác sĩ được chỉ định duyệt: **Bác sĩ Đặng Quốc An (`BS-001`)**
> - FE có thể đăng nhập bằng tài khoản `an.dang@petclinic.vn` để thấy ngay hồ sơ này trong mục danh sách cần duyệt!
