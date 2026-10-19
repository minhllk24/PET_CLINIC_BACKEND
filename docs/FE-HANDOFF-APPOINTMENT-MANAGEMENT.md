# FE-HANDOFF: Appointment Management & Time Slot Engine (P0 & P1)

Tài liệu bàn giao tích hợp Frontend (FE) cho hệ thống Quản lý Lịch hẹn (Appointment Management), Công cụ tìm kiếm Time Slot (Availability Engine), và Thanh toán/Đặt cọc/Hoàn tiền Mock (Online Mock & Pay at Store).

---

## 1. Tổng quan Kiến trúc & Quy tắc cốt lõi (Business Rules)

### 1.1 Khái niệm & Booking Mode của Service
| Booking Mode | Ý nghĩa & Hành vi |
|---|---|
| `BOOKABLE` | Dịch vụ cho phép khách hàng đặt trực tiếp online qua `/api/v1/appointments`. |
| `REQUEST_ONLY` | Dịch vụ yêu cầu gửi form tư vấn/phê duyệt trước (vd: Phẫu thuật). Gửi qua `/api/v1/appointment-requests`. Đặt qua booking trực tiếp sẽ trả về lỗi `422 REQUEST_ONLY_SERVICE`. |
| `CONTACT_ONLY` | Dịch vụ khẩn cấp (Cấp cứu 24/7). Không nhận booking online, trả về `422 BOOKING_MODE_NOT_ALLOWED`. Khuyên khách hàng gọi hotline ngay lập tức. |

### 1.2 Multi-Service Booking Invariant
- **Cùng `serviceType`**: Chỉ cho phép chọn nhiều dịch vụ nếu chúng thuộc cùng loại (`GROOMING` hoặc `MEDICAL`). Chọn lẫn lộn sẽ trả về `422 MIXED_SERVICE_TYPES`.
- **Thứ tự thực hiện (Sequential Execution)**:
  - Hệ thống tính slot nối tiếp nhau: Segment 1 kết thúc lúc $T_1$, Segment 2 bắt đầu lúc $T_1$ và kết thúc lúc $T_2$.
  - Khách hàng không chọn Staff. Backend tự động phân bổ Staff phù hợp ca làm việc (`Shift`), vai trò (`requiredStaffRole`), và ưu tiên **Least-Loaded** (nhân viên ít lịch nhất trong ngày). Nếu 2 segment liên tiếp yêu cầu cùng role, hệ thống ưu tiên giữ nguyên 1 nhân viên để chăm sóc liền mạch.

### 1.3 Quy tắc Thanh toán & Đặt cọc (TA-30 Rules)
| Phương thức | Tỷ lệ thanh toán Upfront | Luồng trạng thái & Giữ chỗ |
|---|---|---|
| `ONLINE_MOCK` | 100% `finalAmount` | Thành công $\rightarrow$ Chuyển ngay sang `PENDING_CONFIRMATION`. Slot được giữ. |
| `PAY_AT_STORE` | 30% `finalAmount` (Cọc) | Phải cọc 30% qua `ONLINE_MOCK`. Chuyển sang `PENDING_PAYMENT` với cửa sổ giữ chỗ 10 phút (`holdExpiresAt`). Thanh toán cọc xong $\rightarrow$ `PENDING_CONFIRMATION`. Còn 70% thanh toán tại quầy khi hoàn thành. Nếu `finalAmount = 0` (do voucher 100%) $\rightarrow$ Vào thẳng `PENDING_CONFIRMATION`. |

### 1.4 Chính sách Hủy lịch & Dời lịch (Reschedule & Cancel Policy)
- **Dời lịch (`POST /api/v1/appointments/{id}/reschedule`)**:
  - Phải trước giờ hẹn $\ge 24\text{ giờ}$ (`scheduledStart - now >= 24h`). Nếu $< 24\text{h}$ trả về `422 RESCHEDULE_TOO_LATE`.
  - Tối đa 2 lần dời (`rescheduleCount < 2`). Quá 2 lần trả về `422 RESCHEDULE_LIMIT`.
- **Hủy lịch bởi Khách hàng (`POST /api/v1/appointments/{id}/cancel`)**:
  - $\ge 24\text{ giờ}$ trước giờ hẹn: Hoàn 100% tiền đã trả/cọc (`prepaidOutcome: 'REFUNDED'`), hoàn trả lượt sử dụng voucher (`restoreQuota`).
  - $< 24\text{ giờ}$ trước giờ hẹn: Phạt 30% `finalAmount` (`prepaidOutcome: 'FORFEITED_PENALTY'`), không hoàn voucher.
- **Hủy lịch bởi Cửa hàng (`POST /api/v1/appointments/{id}/store-cancel`)**:
  - Hoàn 100% tiền đã trả/cọc cho khách trong mọi trường hợp, hoàn trả quota voucher.
- **No-Show (`POST /api/v1/appointments/{id}/no-show`)**:
  - Thu phạt 30% cọc (`prepaidOutcome: 'FORFEITED_PENALTY'`), voucher bị mất.

---

## 2. Danh sách Endpoints RESTful

### 2.1 Tra cứu khung giờ trống (Availability Engine)
- **Endpoint**: `GET /api/v1/availability`
- **Quyền**: Public (Customer, Guest, Staff, Admin)
- **Query Parameters**:
  - `branchId` (bắt buộc, string ObjectId)
  - `date` (bắt buộc, định dạng `YYYY-MM-DD`)
  - `serviceIds` (bắt buộc, danh sách serviceIds cách nhau bởi dấu phẩy hoặc lặp param: `id1,id2`)
- **Phản hồi mẫu (200 OK)**:
```json
{
  "branchId": "507f1f77bcf86cd799439011",
  "date": "2026-10-25",
  "totalDurationMinutes": 75,
  "serviceType": "GROOMING",
  "timeSlots": [
    {
      "startTime": "08:00",
      "endTime": "09:15",
      "available": true,
      "reason": null
    },
    {
      "startTime": "08:15",
      "endTime": "09:30",
      "available": false,
      "reason": "CAPACITY_FULL"
    }
  ]
}
```

---

### 2.2 Tạo Cuộc hẹn Online (Customer Booking)
- **Endpoint**: `POST /api/v1/appointments`
- **Quyền**: Customer (cần Bearer Token)
- **Headers**: `Idempotency-Key: <unique-uuid>` (Khuyến nghị)
- **Body**:
```json
{
  "branchId": "507f1f77bcf86cd799439011",
  "serviceIds": ["507f1f77bcf86cd799439021", "507f1f77bcf86cd799439022"],
  "slotStart": "2026-10-25T08:00:00.000Z",
  "petId": "507f1f77bcf86cd799439031",
  "contact": {
    "fullName": "Nguyễn Văn A",
    "phone": "0901234567",
    "email": "customer@example.com"
  },
  "notes": "Bé mèo hơi nhút nhát",
  "paymentMethod": "PAY_AT_STORE",
  "voucherCode": "PETCARE20"
}
```
- **Phản hồi (201 Created)**: Trả về chi tiết Appointment kèm `pricing`, `deposit`, `services`, và `allowedActions`.

---

### 2.3 Quản lý Lịch hẹn (Chi tiết & Trạng thái)
- `GET /api/v1/appointments`: Danh sách lịch hẹn (Customer chỉ xem lịch của mình, Admin/Staff lọc theo `branchId`, `status`, `from`, `to`).
- `GET /api/v1/appointments/{id}`: Xem chi tiết cuộc hẹn.
- `POST /api/v1/appointments/{id}/confirm`: (Receptionist/Manager/Admin) Xác nhận lịch hẹn.
- `POST /api/v1/appointments/{id}/reject`: (Receptionist/Manager/Admin) Từ chối lịch hẹn kèm lý do (`reason`).
- `POST /api/v1/appointments/{id}/reschedule`: Dời lịch sang khung giờ mới (`{ "newSlotStart": "2026-10-26T09:00:00.000Z" }`).
- `POST /api/v1/appointments/{id}/cancel`: Khách hàng tự hủy lịch (`{ "reason": "Bận việc đột xuất" }`).
- `POST /api/v1/appointments/{id}/store-cancel`: (Staff/Admin) Cửa hàng hủy lịch.
- `POST /api/v1/appointments/{id}/no-show`: (Receptionist/Admin) Đánh dấu vắng mặt.
- `POST /api/v1/appointments/{id}/pay-prepayment`: Giả lập thanh toán cọc / thanh toán online mock.
- `PUT /api/v1/appointments/{id}/segments/{serviceId}/staff`: Phân công lại nhân viên cho dịch vụ cụ thể.
- `POST /api/v1/appointments/{id}/segments/{serviceId}/start`: Bắt đầu tiến hành dịch vụ (Chuyển `executionStatus` sang `IN_PROGRESS`).

---

### 2.4 Internal Booking (Đặt lịch hộ tại quầy)
- **Endpoint**: `POST /api/v1/internal/appointments`
- **Quyền**: `RECEPTIONIST`, `MANAGER`, `ADMIN`
- **Body**: Tương tự như `/appointments`, hỗ trợ thêm trường `customerId` (nếu khách đã có tài khoản) hoặc thông tin khách vãng lai (Guest).

---

### 2.5 Yêu cầu Tư vấn / Phẫu thuật (Appointment Request)
- **Endpoint**: `POST /api/v1/appointment-requests`
- **Quyền**: Public / Customer
- **Body**:
```json
{
  "branchId": "507f1f77bcf86cd799439011",
  "serviceId": "507f1f77bcf86cd799439055",
  "contact": {
    "fullName": "Trần Thị B",
    "phone": "0987654321",
    "email": "customer_b@example.com"
  },
  "preferredDate": "2026-10-28",
  "preferredTimeRange": "MORNING",
  "notes": "Muốn phẫu thuật triệt sản cho cún cưng"
}
```
- **Xử lý nội bộ**:
  - `GET /api/v1/internal/appointment-requests`: Danh sách yêu cầu.
  - `POST /api/v1/internal/appointment-requests/{id}/contacted`: Đánh dấu đã liên hệ.
  - `POST /api/v1/internal/appointment-requests/{id}/convert`: Chuyển đổi thành Appointment chính thức.
  - `POST /api/v1/internal/appointment-requests/{id}/reject`: Từ chối yêu cầu.

---

## 3. Các mã lỗi thường gặp (Error Codes)

| HTTP Status | Error Code | Mô tả |
|---|---|---|
| `409` | `SLOT_UNAVAILABLE` | Khung giờ đã bị trùng lịch đặt chỗ (Double booking prevention). |
| `422` | `BRANCH_CLOSED` | Khung giờ ngoài giờ mở cửa của chi nhánh hoặc trúng ngày nghỉ lễ. |
| `422` | `MIXED_SERVICE_TYPES` | Không được chọn chung các dịch vụ khác nhóm (`GROOMING` và `MEDICAL`). |
| `422` | `REQUEST_ONLY_SERVICE` | Dịch vụ này yêu cầu gửi yêu cầu tư vấn trước (không đặt trực tiếp). |
| `422` | `BOOKING_MODE_NOT_ALLOWED` | Dịch vụ khẩn cấp (Cấp cứu 24/7) không cho phép đặt online. |
| `422` | `STAFF_UNAVAILABLE` | Không có nhân viên đúng chuyên môn trực ca tại khung giờ này. |
| `422` | `RESCHEDULE_TOO_LATE` | Không được dời lịch trong vòng 24 giờ trước giờ hẹn. |
| `422` | `RESCHEDULE_LIMIT` | Đã đạt giới hạn số lần dời lịch tối đa (2 lần). |
| `422` | `VOUCHER_INVALID` | Mã voucher không hợp lệ, hết hạn hoặc không áp dụng cho dịch vụ này. |
| `422` | `HOLD_EXPIRED` | Thời hạn 10 phút giữ chỗ để thanh toán cọc đã hết. |
