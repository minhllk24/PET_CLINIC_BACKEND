# 📖 HƯỚNG DẪN CHO FRONTEND – Task P0: Staff/Role/Shift

> **Cập nhật:** 2026-10-19 | **Tác giả:** An Thai
> **Backend API Base URL:** `https://pet-clinic-backend-a4lj.onrender.com/api/v1`
> **Status:** ✅ ĐÃ SẴN SÀNG TÍCH HỢP – Toàn bộ 10 endpoints đã hoàn thiện và vượt qua 115/115 automated tests

---

## 1. CÁC ENDPOINTS ĐÃ HOÀN THIỆN

### 1.1 Staff Management (Trang Admin – Angular)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/staff` | Bearer (ADMIN) | Tạo nhân viên mới + internal account |
| `GET` | `/staff?branchId=&staffSubRole=&limit=20&cursor=` | Bearer (ADMIN/MANAGER) | Danh sách nhân viên (cursor pagination) |
| `PATCH` | `/staff/{id}` | Bearer (ADMIN) | Sửa vai trò/trạng thái nhân viên |
| `PUT` | `/staff/{id}/branches` | Bearer (ADMIN) | Gán chi nhánh cho nhân viên |
| `PUT` | `/managers/{id}/assigned-branches` | Bearer (ADMIN) | Gán chi nhánh cho Manager |

### 1.2 Shift Management (Trang Admin – Angular)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/shifts` | Bearer (ADMIN/MANAGER) | Tạo ca làm việc (chống trùng ca: 409) |
| `GET` | `/shifts?staffId=&branchId=&dateFrom=&dateTo=&status=&limit=20&cursor=` | Bearer (ADMIN/MANAGER/STAFF) | Query ca làm việc (role + branch scope) |
| `PATCH` | `/shifts/{id}` | Bearer (ADMIN/MANAGER) | Sửa ca |
| `POST` | `/shifts/{id}/cancel` | Bearer (ADMIN/MANAGER) | Hủy ca (yêu cầu reason, Idempotency-Key) |

### 1.3 Availability (Trang Customer – React) – Đã hoạt động với Shift thật

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/availability?serviceIds=&branchId=&date=YYYY-MM-DD` | Không cần | Lấy slot trống theo dịch vụ/chi nhánh/ngày |

### 1.4 Attendance / Chấm công Mockup (P0 Spec)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/attendance?staffId=&date=YYYY-MM-DD` | Tùy chọn | Trả trạng thái check-in giả lập (CHECKED_IN) |

> **Lưu ý:** Availability đã hoạt động và đọc Shift thật từ MongoDB để tính slot chính xác. FE Customer KHÔNG cần thay đổi gì.

---

## 2. REQUEST/RESPONSE FORMATS

### 2.1 Tạo nhân viên – `POST /api/v1/staff`

**Request:**
```json
{
  "fullName": "Bác Sĩ Nguyễn Văn A",
  "email": "nguyenvana@petclinic.com",
  "phone": "0911111111",
  "staffSubRole": "VETERINARIAN",
  "authorizedBranchIds": ["60c72b2f9b1d8b2bad000001"],
  "homeBranchId": "60c72b2f9b1d8b2bad000001"
}
```

**Response (201):**
```json
{
  "id": "670abc123def456...",
  "userId": "670abc123def789...",
  "fullName": "Bác Sĩ Nguyễn Văn A",
  "staffSubRole": "VETERINARIAN",
  "authorizedBranchIds": ["60c72b2f9b1d8b2bad000001"],
  "homeBranchId": "60c72b2f9b1d8b2bad000001",
  "status": "ACTIVE"
}
```

### 2.2 Tạo ca – `POST /api/v1/shifts`

**Request:**
```json
{
  "staffId": "670abc123def456...",
  "branchId": "60c72b2f9b1d8b2bad000001",
  "startAt": "2026-10-20T08:00:00.000Z",
  "endAt": "2026-10-20T16:00:00.000Z"
}
```

**Header bắt buộc:**
```
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid-v4>
```

**Response (201):**
```json
{
  "id": "670shift123...",
  "staffId": "670abc123def456...",
  "branchId": "60c72b2f9b1d8b2bad000001",
  "staffSubRole": "VETERINARIAN",
  "startAt": "2026-10-20T08:00:00.000Z",
  "endAt": "2026-10-20T16:00:00.000Z",
  "status": "ACTIVE"
}
```

**Error (409 – Trùng ca):**
```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "code": "SHIFT_OVERLAP",
  "detail": "Staff already has an active shift overlapping this time range"
}
```

### 2.3 Hủy ca – `POST /api/v1/shifts/{id}/cancel`

**Request:**
```json
{
  "reason": "Nhân viên nghỉ phép"
}
```

**Header bắt buộc:**
```
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid-v4>
```

### 2.4 Danh sách staff – `GET /api/v1/staff`

**Response (200):**
```json
{
  "items": [
    {
      "id": "...",
      "userId": "...",
      "fullName": "Bác Sĩ Nguyễn Văn A",
      "staffSubRole": "VETERINARIAN",
      "authorizedBranchIds": ["..."],
      "homeBranchId": "...",
      "status": "ACTIVE"
    }
  ],
  "nextCursor": "eyJfaWQi..." 
}
```
> `nextCursor = null` khi hết data. FE gửi `?cursor=eyJfaWQi...` để lấy trang tiếp.

---

## 3. ENUM VALUES

| Enum | Values |
|---|---|
| `systemRole` | `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER` |
| `staffSubRole` | `RECEPTIONIST`, `CARE_STAFF_GROOMER`, `VETERINARIAN`, `NURSE` |
| `shiftStatus` | `ACTIVE`, `CANCELLED` |
| `staffStatus` | `ACTIVE`, `INACTIVE` |
| `accountStatus` | `PENDING_ACTIVATION`, `ACTIVE`, `BLOCKED`, `DEACTIVATED` |

---

## 4. ĐĂNG NHẬP – CẬP NHẬT

### Request body cho Login (không đổi):
```json
{
  "identifier": "admin",
  "password": "K9#mQ$8xL!2vW*7z"
}
```

> **⚠️ FE hiện đang gửi `login_id`** thay vì `identifier`. Backend đã có bridge xử lý, nhưng **khuyến khích FE đổi sang `identifier`** để chuẩn OpenAPI.

### Bảng tài khoản test chuẩn hóa (Mật khẩu mạnh thực tế):

| Username | Password (Mật khẩu) | Vai trò | Chức vụ / Quyền hạn |
|---|---|---|---|
| `admin` | `K9#mQ$8xL!2vW*7z` | ADMIN | Toàn quyền hệ thống |
| `manager` | `tR5*bY9#fP2!sM7&` | MANAGER | Quản lý chi nhánh (Chi nhánh 1) |
| `doctor` | `vE8$dK2#zL6!pQ9@` | STAFF / VETERINARIAN | Bác sĩ thú y (khám, chẩn đoán, kê đơn) |
| `receptionist` | `rC4!mZ7#bX9$vT2&` | STAFF / RECEPTIONIST | Lễ tân tiếp đón |
| `groomer` | `gM9$kL3@sY7!bN2#` | STAFF / CARE_STAFF_GROOMER | Nhân viên Grooming / Spa thú cưng |
| `nurse` | `nS4#yP8!vQ2$kM7@` | STAFF / NURSE | Y tá thú y (hỗ trợ điều trị) |
| `customer` | `cT6$vM2!pL9#zR8&` | CUSTOMER | Khách hàng |
| `pending_user` | `pU3#zK8!vQ5$mY2@` | CUSTOMER | Khách hàng chưa kích hoạt |
| `blocked_user` | `bL9$rM2#vK4!zQ7@` | CUSTOMER | Khách hàng bị khóa |

---

## 5. PHÂN QUYỀN (RBAC)

### Token JWT chứa:
```json
{
  "id": "userId",
  "systemRole": "MANAGER",
  "staffSubRole": null,
  "assignedBranchIds": ["branchId1", "branchId2"]
}
```

### Ma trận quyền cho Staff/Shift:
| Hành động | ADMIN | MANAGER | STAFF | CUSTOMER |
|---|---|---|---|---|
| Tạo Staff | ✅ | ❌ | ❌ | ❌ |
| Xem Staff list | ✅ | ✅ (scoped) | ❌ | ❌ |
| Sửa Staff | ✅ | ❌ | ❌ | ❌ |
| Gán branch Staff | ✅ | ❌ | ❌ | ❌ |
| Tạo Shift | ✅ | ✅ (scoped) | ❌ | ❌ |
| Xem Shift list | ✅ | ✅ (scoped) | ✅ (self) | ❌ |
| Sửa Shift | ✅ | ✅ (scoped) | ❌ | ❌ |
| Hủy Shift | ✅ | ✅ (scoped) | ❌ | ❌ |

> **"scoped"** = Manager chỉ thao tác trên staff/shift thuộc chi nhánh mà Manager được gán
> **"self"** = Staff chỉ xem ca của chính mình

---

## 6. LƯU Ý QUAN TRỌNG CHO FE

1. **Idempotency-Key:** Mọi request POST mutation (tạo staff, tạo shift, hủy shift) PHẢI gửi header `Idempotency-Key: <uuid-v4>`. Nếu retry, dùng lại key cũ.

2. **Cursor-based pagination:** KHÔNG dùng page number. Dùng `?cursor=<nextCursor>` từ response trước.

3. **Error handling:** Tất cả error trả về format RFC 9457:
   ```json
   { "type": "about:blank", "title": "...", "status": 409, "code": "SHIFT_OVERLAP", "detail": "..." }
   ```

4. **Availability endpoint:** FE Customer gọi `GET /api/v1/availability?serviceIds=...&branchId=...&date=2026-10-20` → trả slot trống dựa trên Shift thật. KHÔNG cần gọi endpoint Shift.

5. **Content-Type:** Luôn gửi `Content-Type: application/json`
