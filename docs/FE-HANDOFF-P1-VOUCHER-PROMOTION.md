# Handoff Tài Liệu Tích Hợp Frontend: Nghiệp Vụ Voucher & Khuyến Mãi (Priority P1)

Tài liệu này cung cấp chi tiết toàn diện về các API, quy tắc nghiệp vụ, cấu trúc dữ liệu và mã lỗi liên quan đến module **Voucher & Promotion Engine** được xây dựng tuân thủ canonical contract OpenAPI 3.1 (`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` và `docs/07-openapi-v6.yaml`).

---

## 1. Tổng Quan & Ma Trận Phân Quyền (RBAC)

| Endpoint | Method | Vai trò được phép (RBAC) | Idempotency-Key Header | Mô tả |
| :--- | :---: | :--- | :---: | :--- |
| `/api/v1/vouchers/validate` | `POST` | `CUSTOMER`, `guest(public)` | Không bắt buộc | Kiểm tra voucher có hợp lệ với giỏ hàng/lịch hẹn |
| `/api/v1/vouchers` | `GET` | `ADMIN`, `MANAGER` | Không | Lấy danh sách voucher toàn hệ thống |
| `/api/v1/vouchers/:id` | `GET` | `ADMIN`, `MANAGER` | Không | Xem chi tiết 1 voucher |
| `/api/v1/vouchers` | `POST` | `ADMIN` (Manager bị cấm 403) | **Bắt buộc** (độ dài $\ge 8$) | Tạo mới voucher |
| `/api/v1/vouchers/:id` | `PATCH` | `ADMIN` (Manager bị cấm 403) | Không bắt buộc | Cập nhật voucher (Ràng buộc: `quota >= usedCount`) |

---

## 2. Các Quy Tắc Nghiệp Vụ Cốt Lõi (Core Business Rules)

1. **Giới hạn Stack Voucher:**
   - Mỗi giao dịch (`Order` hoặc `Appointment`) chỉ được áp dụng **tối đa 1 voucher** duy nhất (`1 voucher / transaction`).
2. **Tiêu thụ Quota (Atomic Quota Consumption):**
   - Quá trình validate / check giá **không** trừ quota.
   - Quota chỉ bị trừ duy nhất khi transaction **COMMIT** thành công trong MongoDB Session (`usedCount` tăng 1).
   - Nếu transaction fail / abort / rollback, quota được bảo toàn 100%.
3. **Hoàn Quota khi Huỷ Giao dịch (Quota Restoration):**
   - **Đơn hàng E-commerce (`Order`):** Huỷ đơn hợp lệ (`cancelOrder`) hoặc thanh toán trực tuyến thất bại (`PAYMENT_FAILED`) sẽ tự động hoàn lại quota cho voucher theo cơ chế Idempotent (chỉ hoàn 1 lần duy nhất).
   - **Lịch hẹn khám (`Appointment` - Tuân thủ Lựa chọn A):** 
     - Quota voucher chỉ được hoàn trả nếu lịch hẹn được huỷ trước giờ bắt đầu **$\ge 24$ tiếng** hoặc được huỷ bởi Nhân viên / Admin.
     - Nếu Khách hàng tự huỷ sát giờ ($< 24$ tiếng), voucher sẽ **bị tịch thu (forfeited)**, tương ứng với chính sách mất cọc.
4. **Công Thức Tính Cọc 30% Lịch Hẹn (`Appointment` - Tuân thủ Lựa chọn A):**
   - Giảm giá voucher được trừ trực tiếp từ `subtotal` ra `finalAmount`:
     $$\text{finalAmount} = \max(0, \text{subtotal} - \text{discountAmount})$$
   - Phương thức `ONLINE_MOCK`: Khách thanh toán 100% `finalAmount` qua cổng online.
   - Phương thức `PAY_AT_STORE`:
     $$\text{depositAmount} = \text{Math.round}(\text{finalAmount} \times 0.30)$$
     $$\text{balanceAmount} = \text{finalAmount} - \text{depositAmount}$$
     Khách thanh toán trước khoản `depositAmount` qua `ONLINE_MOCK`, số tiền còn lại `balanceAmount` sẽ thanh toán trực tiếp tại quầy khám. Đảm bảo tổng hai khoản luôn khớp chính xác 100% với `finalAmount`.
5. **Ràng buộc Chỉnh Sửa Voucher (Admin Constraint - Tuân thủ Lựa chọn A):**
   - Admin không thể cập nhật `quota` nhỏ hơn số lượng đã được sử dụng thực tế (`usedCount`). Nếu vi phạm, BE trả về `422 Unprocessable Entity`.
   - Nếu Admin chuyển `status` sang `INACTIVE`, các phiên checkout đang chờ chưa commit sẽ bị từ chối ngay lập tức.

---

## 3. Chi Tiết API & Payload Mẫu

### 3.1. Validate Voucher (Frontend gọi realtime khi khách nhập mã)
- **Endpoint:** `POST /api/v1/vouchers/validate`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "code": "SUMMER20",
  "scope": "SERVICE",
  "subtotal": 500000
}
```
*(Ghi chú: `scope` nhận một trong 3 giá trị: `ORDER`, `PRODUCT`, `SERVICE`)*.

- **Response Thành Công (HTTP 200 - Hợp lệ):**
```json
{
  "valid": true,
  "discountAmount": 100000,
  "voucher": {
    "code": "SUMMER20",
    "name": "Khuyến mãi Mùa hè",
    "type": "PERCENTAGE",
    "value": 20,
    "maxDiscountAmount": 100000
  }
}
```

- **Response Không Thành Công (HTTP 200 - Không hợp lệ, hiển thị lý do cho người dùng):**
```json
{
  "valid": false,
  "reason": "MIN_CONDITION_NOT_MET",
  "message": "Giá trị đơn hàng chưa đạt mức tối thiểu áp dụng voucher (600,000 VND)"
}
```

#### Bảng Tra Cứu Các Mã Lý Do Không Hợp Lệ (`reason`):
| Mã `reason` | Ý nghĩa hiển thị trên UI |
| :--- | :--- |
| `VOUCHER_NOT_FOUND` | Mã giảm giá không tồn tại |
| `VOUCHER_INACTIVE` | Mã giảm giá hiện đang tạm ngưng sử dụng |
| `NOT_STARTED` | Chương trình ưu đãi chưa đến ngày bắt đầu |
| `EXPIRED` | Mã giảm giá đã hết hạn sử dụng |
| `QUOTA_EXCEEDED` | Mã giảm giá đã hết lượt sử dụng |
| `SCOPE_MISMATCH` | Voucher không áp dụng cho loại giao dịch này (ví dụ: voucher Dịch vụ dùng cho Đơn hàng Sản phẩm) |
| `MIN_CONDITION_NOT_MET` | Giá trị giao dịch chưa đạt điều kiện tối thiểu |

---

### 3.2. Quản Trị Voucher (Dành cho Admin Web Dashboard)

#### A. Tạo mới Voucher
- **Endpoint:** `POST /api/v1/vouchers`
- **Headers:**
  - `Authorization: Bearer <Admin_JWT_Token>`
  - `Idempotency-Key: voucher-create-2026-001` (bắt buộc, $\ge 8$ ký tự)
- **Request Body:**
```json
{
  "code": "PETVIP50",
  "name": "Giảm 50k dịch vụ khám",
  "type": "FIXED",
  "value": 50000,
  "scope": "SERVICE",
  "minOrderAmount": 200000,
  "quota": 100,
  "status": "ACTIVE",
  "effectiveFrom": "2026-10-01T00:00:00.000Z",
  "effectiveTo": "2026-12-31T23:59:59.000Z"
}
```
- **Response (HTTP 201):**
```json
{
  "id": "670f781b-8dae-48ef-ab25-000000000001",
  "code": "PETVIP50",
  "name": "Giảm 50k dịch vụ khám",
  "type": "FIXED",
  "value": 50000,
  "scope": "SERVICE",
  "minOrderAmount": 200000,
  "maxDiscountAmount": null,
  "quota": 100,
  "usedCount": 0,
  "status": "ACTIVE",
  "effectiveFrom": "2026-10-01T00:00:00.000Z",
  "effectiveTo": "2026-12-31T23:59:59.000Z",
  "createdAt": "2026-10-19T21:00:00.000Z",
  "updatedAt": "2026-10-19T21:00:00.000Z"
}
```

#### B. Cập nhật Voucher
- **Endpoint:** `PATCH /api/v1/vouchers/:id`
- **Headers:** `Authorization: Bearer <Admin_JWT_Token>`
- **Request Body (Ví dụ tăng quota hoặc vô hiệu hoá):**
```json
{
  "quota": 150,
  "status": "ACTIVE"
}
```
- **Error Response nếu cập nhật quota < usedCount (HTTP 422 - Option A):**
```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Không thể giảm quota (50) nhỏ hơn số lượt voucher đã được sử dụng thực tế (80)",
  "code": "INVALID_QUOTA_UPDATE"
}
```

---

## 4. Tích Hợp Vào Luồng Đặt Lịch & Đặt Hàng

### 4.1. Đơn Hàng E-Commerce (`POST /api/v1/checkout`)
Khi gửi request checkout, FE truyền mã voucher đã validate:
```json
{
  "items": [...],
  "voucherCode": "PETVIP50",
  "shippingAddress": {...},
  "paymentMethod": "ONLINE_MOCK"
}
```
- Backend sẽ validate voucher lại trong atomic session, áp dụng chiết khấu phân bổ theo từng dòng sản phẩm, tăng `usedCount` và trả về `order.discountAmount` cùng `order.finalAmount`.

### 4.2. Đặt Lịch Hẹn Khám (`POST /api/v1/appointments`)
```json
{
  "petId": "670f781b-8dae-48ef-ab25-8d08eee48901",
  "branchId": "507f1f77bcf86cd799439011",
  "serviceIds": ["507f1f77bcf86cd799439021"],
  "scheduledStart": "2026-10-25T09:00:00.000Z",
  "voucherCode": "PETVIP50",
  "paymentOption": "PAY_AT_STORE"
}
```
- Response trả về cấu trúc thanh toán minh bạch:
```json
{
  "id": "670f781b-8dae-48ef-ab25-8d08eee48999",
  "subtotal": 500000,
  "discountAmount": 50000,
  "finalAmount": 450000,
  "depositAmount": 135000,
  "balanceAmount": 315000,
  "paymentOption": "PAY_AT_STORE",
  "paymentStatus": "DEPOSIT_PENDING"
}
```
Frontend điều hướng khách hàng tới cổng thanh toán trực tuyến để thu khoản cọc `135,000 VND` (`depositAmount`). Sau khi cọc thành công, trạng thái lịch hẹn chuyển sang `CONFIRMED`.

---

## 5. Danh Sách Mã Voucher Demo Đã Khởi Tạo (Cho FE Hưng Kiểm Thử Vercel)

Dữ liệu voucher mẫu đã được nạp trực tiếp vào cơ sở dữ liệu MongoDB và sẵn sàng kiểm thử qua lệnh `npm run seed:vouchers`:

| Mã Voucher (`code`) | Loại giảm giá | Mức giảm | Đơn tối thiểu | Phạm vi (`scope`) | Mục đích kiểm thử UI / Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`GIAM40K_DON150K`** | `FIXED` | 40,000 VNĐ | 150,000 VNĐ | `ORDER` | Test đơn hàng E-commerce giảm tiền mặt cố định |
| **`GIAM10_CAP50`** | `PERCENTAGE` | 10% (Tối đa 50,000 VNĐ) | 100,000 VNĐ | `ORDER` | Test đơn hàng giảm % có áp trần giảm giá tối đa |
| **`FREESHIP`** | `FIXED` | 30,000 VNĐ | 100,000 VNĐ | `ORDER` | Test miễn phí / giảm trừ phí vận chuyển |
| **`SUMMER20`** | `PERCENTAGE` | 20% (Tối đa 100,000 VNĐ) | 0 VNĐ | `SERVICE` | Test đặt lịch hẹn Spa/Grooming/Khám bệnh có voucher |
| **`PETCLINIC50K`** | `FIXED` | 50,000 VNĐ | 200,000 VNĐ | `SERVICE` | Test đặt lịch hẹn giảm 50k với hóa đơn $\ge 200k$ |
| **`THUNHO20`** | `PERCENTAGE` | 20% (Tối đa 100,000 VNĐ) | 0 VNĐ | `PRODUCT` | Test giỏ hàng chứa sản phẩm danh mục chỉ định |
| **`VIP100K_DON500K`** | `FIXED` | 100,000 VNĐ | 500,000 VNĐ | `ORDER` | Test điều kiện đơn hàng giá trị cao |
| **`EXPIRED_TEST`** | `PERCENTAGE` | 15% | 0 VNĐ | `ORDER` | **Test lỗi UI:** Mã đã hết hạn (`EXPIRED`) |
| **`MAXOUT_TEST`** | `FIXED` | 20,000 VNĐ | 0 VNĐ | `ORDER` | **Test lỗi UI:** Mã đã hết lượt sử dụng (`QUOTA_EXCEEDED`) |

