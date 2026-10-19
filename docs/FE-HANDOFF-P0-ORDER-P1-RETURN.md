# Handoff Tài Liệu Tích Hợp Frontend: Order (P0) & Return/Refund (P1)

Tài liệu này cung cấp chi tiết toàn diện về các API, quy tắc nghiệp vụ, cấu trúc dữ liệu và mã lỗi liên quan đến module **Order** (Priority P0) và **Return/Refund** (Priority P1) được xây dựng tuân thủ canonical contract OpenAPI 3.1 (`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` và `docs/07-openapi-v6.yaml`).

---

## 1. Ma Trận Phân Quyền & Endpoints

| Method | Endpoint | Quyền (RBAC) | Idempotency Header | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/checkout` | Customer, Guest | Bắt buộc ($\ge 8$) | Tạo đơn hàng từ giỏ hàng, trừ kho, voucher |
| `GET` | `/api/v1/orders` | Customer (Own), Receptionist, Manager, Admin | Không | Danh sách đơn hàng theo quyền |
| `GET` | `/api/v1/orders/:id` | Customer/Guest (Own), Staff, Manager, Admin | Không | Chi tiết đơn hàng |
| `POST` | `/api/v1/orders/:id/confirm` | Receptionist, Manager, Admin | Không | Xác nhận đơn hàng (ONLINE_MOCK cần PAID) |
| `POST` | `/api/v1/orders/:id/process` | Receptionist, Manager, Admin | Không | Đóng gói / xử lý đơn hàng |
| `POST` | `/api/v1/orders/:id/ship` | Receptionist, Manager, Admin | Không | Giao đơn vị vận chuyển (`carrier`, `trackingNumber`) |
| `POST` | `/api/v1/orders/:id/mark-delivered` | Receptionist, Manager, Admin | Không | Giao thành công: COD chuyển `PAID`, mở hạn 7 ngày trả |
| `POST` | `/api/v1/orders/:id/cancel` | Customer, Guest (Own) | Bắt buộc ($\ge 8$) | Khách huỷ đơn (chỉ khi `PENDING` hoặc `CONFIRMED`) |
| `POST` | `/api/v1/orders/:id/staff-cancel` | Receptionist, Manager, Admin | Bắt buộc ($\ge 8$) | Nhân viên huỷ đơn (`PENDING`/`CONFIRMED`/`PROCESSING`) |
| `GET` | `/api/v1/orders/:id/returnable-items` | Customer, Guest, Staff, Manager, Admin | Không | Lấy danh sách sản phẩm còn hạn trả (7 ngày) |
| `POST` | `/api/v1/orders/:id/return-quote` | Customer, Guest, Staff, Manager, Admin | Không | Tính thử số tiền hoàn (dry-run, không lưu) |
| `POST` | `/api/v1/order-returns` | Customer, Guest (Own) | Bắt buộc ($\ge 8$) | Tạo yêu cầu trả hàng, giữ `returnReservedQty` |
| `GET` | `/api/v1/order-returns` | Customer (Own), Receptionist, Manager, Admin | Không | Danh sách yêu cầu trả hàng |
| `GET` | `/api/v1/order-returns/:id` | Customer/Guest (Own), Receptionist, Manager, Admin | Không | Xem chi tiết 1 yêu cầu trả hàng |
| `POST` | `/api/v1/order-returns/:id/process` | Receptionist, Staff | Không | Lễ tân tiếp nhận xử lý (`PROCESSING`) |
| `POST` | `/api/v1/order-returns/:id/receive` | Receptionist, Staff | Không | Lễ tân nhận hàng tại quầy (`RECEIVED`) |
| `POST` | `/api/v1/order-returns/:id/approve` | Manager, Admin (1 Cấp duyệt) | Không | Duyệt trả hàng, tạo `OrderRefund` `PENDING` |
| `POST` | `/api/v1/order-returns/:id/reject` | Manager, Admin | Không | Từ chối trả hàng, giải phóng `returnReservedQty` |
| `POST` | `/api/v1/order-returns/:id/cancel` | Customer, Guest (Own) | Không | Khách huỷ yêu cầu trả hàng |
| `GET` | `/api/v1/order-refunds/:id` | Manager, Admin | Không | Chi tiết giao dịch hoàn tiền |
| `POST` | `/api/v1/order-refunds/:id/process`| Manager, Admin | Bắt buộc ($\ge 8$) | Xử lý hoàn tiền mock $\rightarrow$ `REFUNDED` |

---

## 2. Quy Tắc Nghiệp Vụ Cốt Lõi (Core Business Rules)

### 2.1. Đặt Hàng & Thanh Toán Order
1. **Fulfillment Branch Selection:**
   - Server tự động gán `fulfillmentBranchId` bằng chi nhánh `ACTIVE` đầu tiên trong `system_settings.commerce.fulfillmentBranchPriority` có **đủ tồn kho cho toàn bộ giỏ hàng**. Không tách đơn hàng (no split order).
2. **Thanh toán & Giao dịch bù (Compensating Transaction):**
   - Đơn COD: Payment được tạo ở trạng thái `PENDING`. **Chỉ duy nhất khi đơn hàng chuyển sang `COMPLETED` (`mark-delivered`) thì payment mới chuyển sang `PAID`**.
   - Đơn `ONLINE_MOCK`: Nếu thanh toán `FAILED`, `CANCELLED` hoặc `EXPIRED` $\rightarrow$ Tự động huỷ đơn (`CANCELLED`), ghi ledger `RECEIPT` hoàn stock về kho, và hoàn lại quota voucher (idempotent).
3. **Cấm Hard-delete:** Không xoá vĩnh viễn đơn hàng hoặc lịch sử giao dịch.

### 2.2. Trả Hàng & Hoàn Tiền (Return & Refund - Confirmed Option A)
1. **Cửa Sổ Trả Hàng 7 Ngày (Strict 7-Day Window):**
   - Chỉ được tạo yêu cầu trả hàng khi `order.status === 'COMPLETED'` và trong vòng 7 ngày kể từ `deliveredAt` (`now <= deliveredAt + 7 days`).
   - Quá 7 ngày $\rightarrow$ Backend chặn với lỗi `422 Unprocessable Entity` (`RETURN_WINDOW_EXPIRED`).
2. **Trả Hàng Từng Phần & Cơ Chế Giữ Chỗ (Two-Phase Reservation):**
   - Số lượng trả: `0 < requestedQty <= returnableQty`.
   - `returnableQty = orderedQty - alreadyReturnedQty - returnReservedQty`.
   - Khi tạo `OrderReturn` (`REQUESTED`): Tạm giữ `returnReservedQty += requestedQty` trên Order Item để ngăn khách tạo trùng yêu cầu vượt quá số lượng.
   - Nếu từ chối (`REJECTED`) hoặc huỷ (`CANCELLED`): Trả lại `returnReservedQty -= requestedQty`.
   - Nếu duyệt (`APPROVED`): Chuyển `returnedQty += requestedQty` và giải phóng `returnReservedQty`.
3. **Quy Tắc Tính Tiền Hoàn (Proportional Net - Option A):**
   - Số tiền hoàn tính trên giá thực trả của từng sản phẩm sau chiết khấu voucher:
     $$\text{itemNetUnit} = \text{Math.floor}\left(\frac{\text{lineNet}}{\text{orderedQty}}\right)$$
     $$\text{refundAmount} = \text{itemNetUnit} \times \text{requestedQty}$$
   - Lần trả hàng cuối cùng cho sản phẩm sẽ nhận phần dôi dư còn lại để đảm bảo $\text{tổng hoàn} \le \text{lineNet}$.
   - **Phí vận chuyển (`shippingFee`) tuyệt đối không hoàn** (`shippingRefunded: 0`).
4. **Quy Tắc Tồn Kho:**
   - Trả hàng **không tự động nhập kho**. Nếu sản phẩm đủ điều kiện tái sử dụng, nhân viên chi nhánh nhập kho thủ công qua nghiệp vụ `Inventory Receive` (RECEIPT).
5. **Duyệt 1 Cấp Chặt Chẽ:**
   - Lễ tân (`RECEPTIONIST`) chỉ có quyền `process` và `receive`. Lễ tân cố tình duyệt hoặc từ chối sẽ bị chặn `403 Forbidden`.
   - Chỉ có Quản lý (`MANAGER`) hoặc Quản trị viên (`ADMIN`) mới có quyền `approve` hoặc `reject`.

---

## 3. Payloads & Endpoints Mẫu

### 3.1. Lấy Danh Sách Mặt Hàng Có Thể Trả
- **Endpoint:** `GET /api/v1/orders/:id/returnable-items`
- **Headers:** `Authorization: Bearer <Customer_Token>` hoặc `X-Guest-Lookup-Token: <token>`
- **Response (HTTP 200):**
```json
{
  "orderId": "670f781b-8dae-48ef-ab25-000000000001",
  "deliveredAt": "2026-10-18T10:00:00.000Z",
  "returnWindowEndsAt": "2026-10-25T10:00:00.000Z",
  "eligible": true,
  "items": [
    {
      "orderItemId": "670f781b-8dae-48ef-ab25-000000000011",
      "orderedQty": 2,
      "alreadyReturnedQty": 0,
      "returnableQty": 2,
      "maxRefundEstimate": 180000
    }
  ]
}
```

### 3.2. Dự Toán Số Tiền Hoàn (Dry-run Quote)
- **Endpoint:** `POST /api/v1/orders/:id/return-quote`
- **Request Body:**
```json
{
  "items": [
    {
      "orderItemId": "670f781b-8dae-48ef-ab25-000000000011",
      "quantity": 1
    }
  ]
}
```
- **Response (HTTP 200):**
```json
{
  "orderId": "670f781b-8dae-48ef-ab25-000000000001",
  "eligible": true,
  "returnWindowEndsAt": "2026-10-25T10:00:00.000Z",
  "items": [
    {
      "orderItemId": "670f781b-8dae-48ef-ab25-000000000011",
      "returnableQty": 2,
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

### 3.3. Tạo Yêu Cầu Trả Hàng (Customer / Guest)
- **Endpoint:** `POST /api/v1/order-returns`
- **Headers:**
  - `Authorization: Bearer <Customer_Token>` (hoặc `X-Guest-Lookup-Token`)
  - `Idempotency-Key: ret-create-2026-001` (bắt buộc, $\ge 8$ ký tự)
- **Request Body:**
```json
{
  "orderId": "670f781b-8dae-48ef-ab25-000000000001",
  "items": [
    {
      "orderItemId": "670f781b-8dae-48ef-ab25-000000000011",
      "quantity": 1
    }
  ],
  "reason": "Sản phẩm bị nứt hộp đựng",
  "evidenceUrls": ["https://res.cloudinary.com/.../img1.jpg"]
}
```
- **Response (HTTP 201):**
```json
{
  "id": "670f781b-8dae-48ef-ab25-000000000099",
  "orderId": "670f781b-8dae-48ef-ab25-000000000001",
  "status": "REQUESTED",
  "items": [
    {
      "orderItemId": "670f781b-8dae-48ef-ab25-000000000011",
      "productName": "Hạt Royal Canin 2kg",
      "orderedQty": 2,
      "alreadyReturnedQty": 0,
      "requestedQty": 1,
      "refundAmount": 90000
    }
  ],
  "reason": "Sản phẩm bị nứt hộp đựng",
  "refundBreakdown": {
    "merchandiseNet": 90000,
    "shippingRefunded": 0,
    "total": 90000
  },
  "refundId": null,
  "history": [
    {
      "status": "REQUESTED",
      "at": "2026-10-19T21:40:00.000Z"
    }
  ]
}
```

### 3.4. Quản Lý Duyệt Hoàn Tiền (Manager / Admin)
- **Endpoint:** `POST /api/v1/order-returns/:id/approve`
- **Headers:** `Authorization: Bearer <Manager_Token>`
- **Request Body:**
```json
{
  "note": "Đã kiểm tra kiện hàng, duyệt hoàn 90.000 VND"
}
```
- **Response (HTTP 200):** Trả về `OrderReturn` trạng thái `APPROVED` kèm `refundId` của giao dịch hoàn tiền `PENDING`.
- **Thực thi hoàn tiền mock:**
  - `POST /api/v1/order-refunds/:refundId/process` kèm `Idempotency-Key`.
  - Kết quả: `OrderRefund` chuyển `REFUNDED`, `OrderReturn` chuyển `COMPLETED`.

---

## 4. Bảng Tra Cứu Mã Lỗi Nghiệp Vụ (Error Codes)

| Mã Lỗi | HTTP Status | Ý nghĩa hiển thị trên giao diện |
| :--- | :---: | :--- |
| `RETURN_WINDOW_EXPIRED` | 422 | Đơn hàng đã quá hạn 7 ngày đổi trả tính từ lúc nhận hàng |
| `RETURN_QTY_EXCEEDS_RETURNABLE` | 422 | Số lượng yêu cầu trả vượt quá số lượng còn lại có thể trả |
| `INVALID_STATE_TRANSITION` | 400 | Thao tác không hợp lệ với trạng thái hiện tại của đơn hàng/đổi trả |
| `EMPTY_RETURN_ITEMS` | 400 | Danh sách sản phẩm đổi trả không được để trống |
| `PAYMENT_REQUIRED` | 422 | Đơn hàng ONLINE_MOCK cần hoàn tất thanh toán trước khi xác nhận |
| `INSUFFICIENT_INVENTORY` | 422 | Không có chi nhánh nào đủ tồn kho cho toàn bộ đơn hàng |
| `ORDER_NOT_FOUND` | 404 | Không tìm thấy thông tin đơn hàng |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện thao tác này |
