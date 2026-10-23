# HƯỚNG DẪN KẾT NỐI API DỊCH VỤ, CHI NHÁNH, TRẢ HÀNG & VOUCHER (DÀNH CHO FRONTEND)

> **Dự án:** PET CLINIC BACKEND  
> **Phiên bản API:** `/api/v1` (OpenAPI v7 Spec Compliance)  
> **Server Base URL:** `http://localhost:8080/api/v1` (Local) / `https://api.drpetshouse.lat/api/v1` (Production/Staging)  
> **Định dạng dữ liệu:** `application/json`  
> **Chuẩn mã lỗi:** RFC 9457 Problem Details (`application/problem+json`)  
> **Tài liệu tham chiếu:** Phản hồi FE ngày 22-10 & Quy tắc Trả hàng Hoàn tiền Voucher

---

## 📑 Mục lục
1. [Lưu ý kỹ thuật & Header bắt buộc](#1-lưu-ý-kỹ-thuật--header-bắt-buộc)
2. [Danh sách Chi nhánh đã chuẩn hóa](#2-danh-sách-chi-nhánh-đã-chuẩn-hóa)
3. [Module Dịch vụ & Cấu hình Chi nhánh (Service Catalog)](#3-module-dịch-vụ--cấu-hình-chi-nhánh-service-catalog)
4. [Module Khóa Tạm Thời Dịch Vụ Theo Khung Giờ (Temporary Blocks)](#4-module-khóa-tạm-thời-dịch-vụ-theo-khung-giờ-temporary-blocks)
5. [Module Vận Hành Chi Nhánh & Đặt Lịch (Operation Slots & Availability)](#5-module-vận-hành-chi-nhánh--đặt-lịch-operation-slots--availability)
6. [Module Nhân Sự & Lịch Sử Kho Hàng (Staff & Inventory Snapshot)](#6-module-nhân-sự--lịch-sử-kho-hàng-staff--inventory-snapshot)
7. [Module Trả Hàng Hoàn Tiền & Phân Bổ Voucher (Order Return & Voucher)](#7-module-trả-hàng-hoàn-tiền--phân-bổ-voucher-order-return--voucher)
8. [Bảng Tra Cứu Mã Lỗi RFC 9457](#8-bảng-tra-cứu-mã-lỗi-rfc-9457)
9. [Code Mẫu Tích Hợp (Angular HttpClient & Axios)](#9-code-mẫu-tích-hợp-angular-httpclient--axios)

---

## 1. Lưu ý kỹ thuật & Header bắt buộc

### 1.1 Headers cho các Request
- **Xác thực danh tính (Authentication):**
  ```http
  Authorization: Bearer <accessToken>
  ```
- **Chống trùng lặp giao dịch (Idempotency Key - Bắt buộc với POST đơn hàng / hoàn trả):**
  ```http
  Idempotency-Key: <unique-uuid-v4>
  ```
- **Khách vãng lai (Guest Cart Token):**
  ```http
  x-guest-cart-token: <guest-token>
  ```

### 1.2 Phân quyền dữ liệu theo Chi nhánh (Manager Branch Scoping)
- Tài khoản `ADMIN`: Toàn quyền thao tác trên toàn bộ chi nhánh.
- Tài khoản `MANAGER`: Chỉ có quyền thao tác trên các chi nhánh nằm trong mảng `assignedBranchIds`. Nếu gọi API tác động vào chi nhánh khác, Backend sẽ trả mã lỗi `403 Forbidden` (`BRANCH_ACCESS_DENIED`).

---

## 2. Danh sách Chi nhánh đã chuẩn hóa

Toàn bộ tên chi nhánh đã được chuẩn hóa lại theo định dạng: **`Chi nhánh + Tên Quận`**, phía dưới hiển thị địa chỉ chi tiết:

| Mã Chi Nhánh (`code`) | Tên Chi Nhánh (`name`) | Địa chỉ chi tiết (`address`) | Điện thoại |
|---|---|---|---|
| `BR-000001` | **Chi nhánh Quận 1** | 123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM | `02812345678` |
| `BR-000002` | **Chi nhánh Quận 3** | 456 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM | `02887654321` |
| `BR-000003` | **Chi nhánh Bình Thạnh** | 789 Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM | `02899998888` |

> 💡 **Khuyến nghị hiển thị FE:**  
> - Dòng tiêu đề: `branch.name` (Ví dụ: `Chi nhánh Quận 1`)  
> - Dòng phụ/mô tả bên dưới: `branch.address` (Ví dụ: `123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM`)

---

## 3. Module Dịch vụ & Cấu hình Chi nhánh (Service Catalog)

### 3.1 Tạo Service mới và Tự động bật trên các chi nhánh (`autoEnableActiveBranches`)
- **Vấn đề đã giải quyết:** FE không cần phải gọi 1 request tạo Service rồi lặp thêm 3 request `PUT` cấu hình chi nhánh nữa.
- **Endpoint:** `POST /api/v1/services`
- **Quyền:** `ADMIN`
- **Request Body mẫu:**
  ```json
  {
    "code": "SPA-VIP-01",
    "name": "Combo Spa & Cắt Tỉa Lông VIP",
    "serviceType": "GROOMING",
    "basePrice": 350000,
    "durationMinutes": 60,
    "requiredStaffRole": "STAFF",
    "bookingMode": "SLOT_BASED",
    "autoEnableActiveBranches": true,
    "branchConfigs": [
      {
        "branchId": "6ad08e4417bf41f5954234c3",
        "capacity": 2,
        "enabled": true
      }
    ]
  }
  ```
- **Quy tắc Backend xử lý:**
  - Nếu `autoEnableActiveBranches: true`: Backend tự động kích hoạt dịch vụ trên **TẤT CẢ các chi nhánh đang ACTIVE** với `capacity: 1`, `enabled: true`.
  - Nếu gửi kèm `branchConfigs`: Chi nhánh nào được chỉ định trong mảng sẽ nhận giá trị ghi đè (`capacity: 2` như ví dụ trên).
- **Response thành công (201 Created):**
  ```json
  {
    "id": "6ad1234567890abcdef12345",
    "code": "SPA-VIP-01",
    "name": "Combo Spa & Cắt Tỉa Lông VIP",
    "basePrice": 350000,
    "durationMinutes": 60,
    "status": "ACTIVE"
  }
  ```

### 3.2 Lấy toàn bộ cấu hình chi nhánh của 1 Dịch vụ (Tránh N+1 Request)
- **Endpoint:** `GET /api/v1/services/:serviceId/branch-configs`
- **Quyền:** `ADMIN`, `MANAGER`
- **Response thành công (200 OK):**
  ```json
  [
    {
      "branchId": "6ad08e4417bf41f5954234c3",
      "branchCode": "BR-000001",
      "branchName": "Chi nhánh Quận 1",
      "branchStatus": "ACTIVE",
      "enabled": true,
      "capacity": 2,
      "temporaryBlockedWindows": []
    },
    {
      "branchId": "6ad08e4417bf41f5954234c4",
      "branchCode": "BR-000002",
      "branchName": "Chi nhánh Quận 3",
      "branchStatus": "ACTIVE",
      "enabled": true,
      "capacity": 1,
      "temporaryBlockedWindows": []
    },
    {
      "branchId": "6ad08e4417bf41f5954234c5",
      "branchCode": "BR-000003",
      "branchName": "Chi nhánh Bình Thạnh",
      "branchStatus": "ACTIVE",
      "enabled": false,
      "capacity": 1,
      "temporaryBlockedWindows": []
    }
  ]
  ```

### 3.3 Cập nhật Dịch vụ Master mà KHÔNG ghi đè cấu hình chi nhánh
- **Endpoint:** `PATCH /api/v1/services/:id`
- **Quyền:** `ADMIN`
- **Lưu ý:** Khi đổi giá hoặc tên dịch vụ, Backend **giữ nguyên 100% trạng thái bật/tắt của từng chi nhánh**, không tự ý bật lại các chi nhánh mà quản lý đã chủ động tắt.

---

## 4. Module Khóa Tạm Thời Dịch Vụ Theo Khung Giờ (Temporary Blocks)

Dùng khi chi nhánh cần bảo trì phòng khám, sát trùng phòng spa, hoặc nhân viên bận đột xuất trong một khoảng thời gian nhất định trong ngày.

### 4.1 Thêm khung giờ khóa tạm thời
- **Endpoint:** `POST /api/v1/branches/:branchId/service-configs/:serviceId/temporary-blocks`
- **Quyền:** `ADMIN`, `MANAGER` (thuộc chi nhánh)
- **Request Body:**
  ```json
  {
    "startAt": "2026-10-25T14:00:00.000Z",
    "endAt": "2026-10-25T16:00:00.000Z",
    "reason": "Bảo trì thiết bị sấy lông"
  }
  ```
- **Quy tắc kiểm tra xung đột lịch hẹn (Conflict Checking):**
  - Nếu trong khoảng `[startAt, endAt)` đã có cuộc hẹn ở trạng thái `CONFIRMED` hoặc `IN_PROGRESS` $\to$ Backend **chặn lại và ném lỗi 409 Conflict**:
    ```json
    {
      "type": "https://errors.petclinic.com/service-blocked-conflict",
      "title": "Conflict",
      "status": 409,
      "code": "SERVICE_BLOCKED_CONFLICT",
      "detail": "Cannot block service window because there are existing confirmed appointments",
      "affectedAppointmentIds": ["6ad9876543210fedcba98765"]
    }
    ```
- **Response thành công (201 Created):**
  ```json
  {
    "message": "Temporary block added successfully",
    "temporaryBlockedWindows": [
      {
        "blockId": "6ad111222333444555666777",
        "startAt": "2026-10-25T14:00:00.000Z",
        "endAt": "2026-10-25T16:00:00.000Z",
        "reason": "Bảo trì thiết bị sấy lông",
        "createdAt": "2026-10-23T05:00:00.000Z"
      }
    ]
  }
  ```

### 4.2 Gỡ bỏ khung giờ khóa tạm thời
- **Endpoint:** `DELETE /api/v1/branches/:branchId/service-configs/:serviceId/temporary-blocks/:blockId`
- **Quyền:** `ADMIN`, `MANAGER`
- **Response thành công (200 OK):**
  ```json
  {
    "message": "Temporary block removed successfully",
    "temporaryBlockedWindows": []
  }
  ```

---

## 5. Module Vận Hành Chi Nhánh & Đặt Lịch (Operation Slots & Availability)

### 5.1 Dashboard Lịch Hoạt Động Khung Giờ Toàn Chi Nhánh
- **Mục đích:** Giúp FE hiển thị biểu đồ/bảng slot của toàn chi nhánh trong ngày (ví dụ `2/3`, `3/3` khi FULL).
- **Endpoint:** `GET /api/v1/branches/:branchId/operation-slots?date=YYYY-MM-DD`
- **Quyền:** `ADMIN`, `MANAGER`, `STAFF`
- **Response thành công (200 OK):**
  ```json
  {
    "branchId": "6ad08e4417bf41f5954234c3",
    "branchName": "Chi nhánh Quận 1",
    "date": "2026-10-25",
    "timeSlots": [
      {
        "time": "08:00",
        "totalCapacity": 4,
        "bookedCount": 4,
        "remainingCapacity": 0,
        "status": "FULL"
      },
      {
        "time": "09:00",
        "totalCapacity": 4,
        "bookedCount": 3,
        "remainingCapacity": 1,
        "status": "NEARLY_FULL"
      },
      {
        "time": "10:00",
        "totalCapacity": 4,
        "bookedCount": 1,
        "remainingCapacity": 3,
        "status": "AVAILABLE"
      }
    ]
  }
  ```
- **Quy tắc render màu trên FE:**
  - `status === 'AVAILABLE'`: Màu xanh lá (Còn nhiều chỗ).
  - `status === 'NEARLY_FULL'`: Màu vàng/cam (Sắp hết chỗ).
  - `status === 'FULL'`: Màu đỏ (Đã kín chỗ).

### 5.2 Lấy slot khả dụng kèm cả các slot đã kín chỗ (`includeUnavailable`)
- **Endpoint:** `GET /api/v1/appointments/availability?branchId=...&serviceId=...&date=2026-10-25&includeUnavailable=true`
- **Lưu ý:** Truyền `includeUnavailable=true` để Backend không ẩn các slot `remaining: 0`, giúp FE hiển thị danh sách giờ có trạng thái disabled/màu xám thay vì bị thiếu giờ.

---

## 6. Module Nhân Sự & Lịch Sử Kho Hàng (Staff & Inventory Snapshot)

### 6.1 Cập nhật thông tin & phân công Chi nhánh cho Staff
- **Cập nhật thông tin cơ bản:** `PATCH /api/v1/staff/:id`
  ```json
  {
    "fullName": "Bác Sĩ Nguyễn Văn A",
    "phone": "0901112233",
    "staffSubRole": "VETERINARIAN",
    "licenseNumber": "VET-HCM-2026",
    "experienceYears": 5
  }
  ```
- **Phân công chi nhánh trực thuộc:** `PUT /api/v1/staff/:id/branches`
  ```json
  {
    "branchIds": [
      "6ad08e4417bf41f5954234c3",
      "6ad08e4417bf41f5954234c4"
    ]
  }
  ```

### 6.2 Lịch sử Giao Dịch Kho Hàng (Đã snapshot Tên Chi Nhánh & Người Thao Tác)
- **Endpoint:** `GET /api/v1/inventory/transactions`
- **Response thành công (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "6ad999888777666555444333",
        "transactionType": "RECEIPT",
        "sourceType": "PURCHASE_ORDER",
        "branchId": "6ad08e4417bf41f5954234c3",
        "branchName": "Chi nhánh Quận 1",
        "sku": "FOOD-CAT-01",
        "productName": "Thức Ăn Hạt Cho Mèo Royal Canin",
        "changeQty": 50,
        "actorId": "6ad1234567890abcdef12345",
        "actorName": "Quản Lý Nguyễn Văn B",
        "isSystemActor": false,
        "createdAt": "2026-10-23T04:30:00.000Z"
      }
    ],
    "pagination": { "limit": 20, "hasMore": false }
  }
  ```
  *(FE không cần tự map `branchId` hay `actorId` thủ công nữa; backend đã snapshot sẵn `branchName` và `actorName`).*

---

## 7. Module Trả Hàng Hoàn Tiền & Phân Bổ Voucher (Order Return & Voucher)

Đây là logic trọng tâm được nâng cấp nhằm đảm bảo tính toán tài chính tuyệt đối chính xác:

### 7.1 Cấu trúc Snapshot Tiền Hàng Khi Tạo Đơn Hàng (`checkoutCreateOrder`)
Mỗi phần tử trong `order.items` chứa các trường tài chính:
```json
{
  "orderItemId": "6ad1234567890abcdef11111",
  "productId": "6ad222333444555666777888",
  "nameSnapshot": "Thức Ăn Cho Chó SmartHeart 3kg",
  "unitPrice": 100000,
  "quantity": 3,
  "lineSubtotal": 300000,
  "allocatedDiscount": 30000,
  "lineNet": 270000,
  "returnedQty": 0,
  "returnReservedQty": 0,
  "refundedNet": 0
}
```
- `allocatedDiscount`: Giảm giá voucher phân bổ cho dòng hàng này.
- `lineNet`: Số tiền hàng **thực trả sau voucher** của dòng sản phẩm đó (`lineSubtotal - allocatedDiscount`).

---

### 7.2 Lấy Báo Giá Hoàn Trả (Get Return Quote)
- **Mục đích:** FE gọi trước khi cho khách submit form để hiển thị số tiền dự kiến được hoàn.
- **Endpoint:** `POST /api/v1/orders/:orderId/return-quote`
- **Request Body:**
  ```json
  {
    "items": [
      {
        "orderItemId": "6ad1234567890abcdef11111",
        "quantity": 1
      }
    ]
  }
  ```
- **Response thành công (200 OK):**
  ```json
  {
    "orderId": "6ad555666777888999000111",
    "eligible": true,
    "returnWindowEndsAt": "2026-10-30T10:00:00.000Z",
    "items": [
      {
        "orderItemId": "6ad1234567890abcdef11111",
        "returnableQty": 3,
        "requestedQty": 1,
        "refundAmount": 90000
      }
    ],
    "refundBreakdown": {
      "merchandiseNet": 90000,
      "shippingRefunded": 0,
      "total": 90000
    }
  }
  ```

---

### 7.3 Tạo Yêu Cầu Trả Hàng (Create Return Request)
- **Endpoint:** `POST /api/v1/order-returns`
- **Headers bắt buộc:** `Idempotency-Key: <uuid>`
- **Request Body:**
  ```json
  {
    "orderId": "6ad555666777888999000111",
    "items": [
      {
        "orderItemId": "6ad1234567890abcdef11111",
        "quantity": 1
      }
    ],
    "reason": "Sản phẩm bị rách bao bì khi giao hàng",
    "evidenceUrls": [
      "https://res.cloudinary.com/petclinic/image/upload/v1/evidence1.jpg"
    ]
  }
  ```
- **Response thành công (201 Created):**
  ```json
  {
    "id": "6ad777888999000111222333",
    "code": "RET-1729681200000-A1B2C3",
    "status": "REQUESTED",
    "refundBreakdown": {
      "merchandiseNet": 90000,
      "shippingRefunded": 0,
      "total": 90000
    }
  }
  ```

---

### 7.4 Bốn (4) Quy tắc vàng FE cần nắm về Hoàn tiền & Voucher
1. **Hoàn tiền theo giá thực trả (`lineNet`):**  
   Dù khách trả một phần hay toàn bộ đơn hàng, số tiền hoàn luôn dựa trên giá trị sau khi đã trừ giảm giá voucher.
2. **Không hoàn phí ship:**  
   Trường `shippingRefunded` luôn bằng `0`. Tổng tiền hoàn bằng đúng tiền hàng thực trả.
3. **Chặn trần hoàn tiền (`REFUND_EXCEEDS_NET_PAID`):**  
   Tổng số tiền hoàn lũy kế qua các lần đổi trả không bao giờ vượt quá tổng tiền hàng thực trả của đơn (`totalOrderMerchandiseNetPaid`). Nếu vượt, hệ thống sẽ trả lỗi `422 Unprocessable Entity`.
4. **Quy tắc quota Voucher:**  
   - **Hủy đơn trước khi giao (`PENDING`, `CONFIRMED`, `PROCESSING`):** Quota voucher **được tự động khôi phục**.
   - **Trả hàng sau khi giao (`DELIVERED`, `COMPLETED`):** Quota voucher **tuyệt đối KHÔNG được khôi phục**. Lượt voucher xem như đã sử dụng xong.

---

## 8. Bảng Tra Cứu Mã Lỗi RFC 9457

Tất cả các lỗi trả về đều tuân thủ định dạng chuẩn `application/problem+json`:

| HTTP Status | Mã lỗi (`code`) | Ý nghĩa & Nguyên nhân | Hướng xử lý cho FE |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | Thiếu trường hoặc sai định dạng dữ liệu | Kiểm tra lại body theo bảng field bắt buộc |
| `401` | `AUTHENTICATION_ERROR` | Thiếu hoặc hết hạn `accessToken` | Gọi `POST /api/v1/auth/refresh` lấy token mới |
| `403` | `BRANCH_ACCESS_DENIED` | Manager thao tác chi nhánh không được gán | Ẩn nút thao tác hoặc hiển thị thông báo quyền hạn |
| `404` | `ORDER_NOT_FOUND` | Không tìm thấy đơn hàng | Kiểm tra lại ID truyền trên URL |
| `409` | `SERVICE_BLOCKED_CONFLICT` | Khung giờ khóa có lịch hẹn `CONFIRMED` | Hiển thị modal danh sách mã lịch hẹn bị xung đột |
| `422` | `RETURN_WINDOW_EXPIRED` | Quá thời hạn đổi trả 7 ngày | Thông báo khách hàng đơn hàng đã hết hạn đổi trả |
| `422` | `RETURN_QTY_EXCEEDS_RETURNABLE` | Số lượng yêu cầu trả > số lượng còn lại | Giới hạn `max` của input quantity = `returnableQty` |
| `422` | `REFUND_EXCEEDS_NET_PAID` | Số tiền hoàn vượt quá tiền hàng thực trả | Thông báo số tiền yêu cầu vượt quá giới hạn |
| `422` | `VOUCHER_INVALID` | Voucher hết hạn / hết lượt / sai chi nhánh | Hiển thị lý do từ trường `detail` |

---

## 9. Code Mẫu Tích Hợp (Angular HttpClient & Axios)

### 9.1 Angular Service gọi API Báo Giá & Trả Hàng (Admin & Customer App)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export interface ReturnQuoteRequest {
  items: Array<{ orderItemId: string; quantity: number }>;
}

export interface CreateReturnRequest {
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  reason: string;
  evidenceUrls?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class OrderReturnService {
  private readonly baseUrl = 'http://localhost:8080/api/v1';

  constructor(private http: HttpClient) {}

  // 1. Lấy báo giá hoàn tiền thực tế
  getReturnQuote(orderId: string, payload: ReturnQuoteRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/return-quote`, payload, {
      withCredentials: true
    });
  }

  // 2. Gửi yêu cầu hoàn trả (Kèm Idempotency-Key)
  submitReturnRequest(payload: CreateReturnRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Idempotency-Key': uuidv4()
    });

    return this.http.post(`${this.baseUrl}/order-returns`, payload, {
      headers,
      withCredentials: true
    });
  }

  // 3. Lấy slot vận hành toàn chi nhánh
  getBranchOperationSlots(branchId: string, date: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/branches/${branchId}/operation-slots`, {
      params: { date },
      withCredentials: true
    });
  }

  // 4. Khóa tạm thời dịch vụ tại chi nhánh
  blockServiceWindow(branchId: string, serviceId: string, body: { startAt: string; endAt: string; reason: string }): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/branches/${branchId}/service-configs/${serviceId}/temporary-blocks`,
      body,
      { withCredentials: true }
    );
  }
}
```

### 9.2 Axios Client (Customer React / Vue App)

```typescript
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  withCredentials: true
});

// Tự động gắn Idempotency-Key cho các request nhạy cảm
api.interceptors.request.use((config) => {
  if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
    if (!config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] = uuidv4();
    }
  }
  return config;
});

// Hàm tạo yêu cầu trả hàng
export async function createOrderReturn(orderId: string, orderItemId: string, quantity: number, reason: string) {
  try {
    const response = await api.post('/order-returns', {
      orderId,
      items: [{ orderItemId, quantity }],
      reason
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.code === 'REFUND_EXCEEDS_NET_PAID') {
      alert('Số tiền hoàn vượt quá số tiền thực tế bạn đã thanh toán!');
    }
    throw error;
  }
}
```

---

> 🎯 **Cam kết hỗ trợ:** Nếu phía Frontend gặp bất kỳ vướng mắc nào trong quá trình kết nối hoặc cần thêm trường dữ liệu đặc thù cho UI, đội Backend sẵn sàng hỗ trợ và mở rộng tức thì!
