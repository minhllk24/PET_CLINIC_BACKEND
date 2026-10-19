# Kế Hoạch Triển Khai: Luồng Nghiệp Vụ Order & Return/Refund (P0 & P1)

Tài liệu này định hình kế hoạch kiến trúc, thiết kế kỹ thuật và các bước triển khai chi tiết cho module **Order** (Priority P0) và **Return/Refund** (Priority P1) tuân thủ hoàn toàn canonical contract OpenAPI 3.1 (`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` và `docs/07-openapi-v6.yaml`), mô hình dữ liệu `05-mongodb-schema-v7.md`, ma trận phân quyền `08-authorization-matrix-v7.md`, và máy trạng thái `09-state-machines-v7.md`.

---

## 0. Các Quyết Định Kiến Trúc Đã Xác Nhận (Confirmed Architectural Decisions)
1. **Quy tắc Hoàn Tiền Từng Phần Có Voucher (Phương án A):**
   - Đơn giá hoàn tính theo giá thực tế khách đã trả sau chiết khấu voucher: $\text{itemNetUnit} = \text{Math.floor}(\text{lineNet} / \text{orderedQty})$.
   - Khi hoàn trả lần cuối cho item, số tiền hoàn là phần còn lại $\text{lineNet} - \text{alreadyRefundedNet}$ để đảm bảo tổng số tiền hoàn đúng 100% không bao giờ vượt quá $\text{lineNet}$.
   - Phí vận chuyển (`shippingFee`) **không hoàn** dưới mọi hình thức (`shippingRefunded = 0`).
2. **Cơ chế Tự Động Huỷ Đơn Khi ONLINE_MOCK Thất Bại (Phương án A):**
   - Tức thời xử lý khi cổng thanh toán Payment nhận trạng thái `FAILED`, `CANCELLED` hoặc `EXPIRED` (hoặc khi query Order quá hạn hold 10 phút):
   - Đơn hàng chuyển sang `CANCELLED`, chạy giao dịch bù nguyên tử (compensating transaction) hoàn tồn kho bằng ledger `RECEIPT` và hoàn quota voucher idempotently.
3. **Xử Lý Từ Chối Đổi Trả Tại Trạng Thái RECEIVED (Phương án A):**
   - Khi Manager/Admin từ chối đơn trả hàng tại `RECEIVED`, `OrderReturn` chuyển sang `REJECTED`, giải phóng `returnReservedQty` trên `Order`, không hoàn tiền, không tự động nhập kho. Việc trả lại hàng vật lý cho khách được xử lý thủ công ngoài hệ thống (chuẩn Canonical v7).

---

## 1. Mục Tiêu & Phạm Vi (Goals & Scope)

### 1.1. Luồng Order (Priority P0)
- **Đặt hàng (Checkout):** 
  - Khách hàng (Customer hoặc Guest) checkout giỏ hàng tạo Order với mã duy nhất `ORD-...`.
  - Phân bổ chi nhánh thực hiện (`fulfillmentBranchId`) bằng `FulfillmentBranchResolver`: chọn branch `ACTIVE` đầu tiên trong `system_settings.commerce.fulfillmentBranchPriority` có **đủ tồn cho TOÀN BỘ giỏ hàng**. Không split order.
  - Trừ kho tức thời (atomic ledger `ISSUE`) và tiêu thụ voucher trong cùng một MongoDB Session Transaction.
- **Phương thức thanh toán & Vòng đời Order:**
  - `ONLINE_MOCK` hoặc `COD`.
  - Với `COD`: Trạng thái thanh toán là `PENDING`, **chỉ chuyển sang `PAID` duy nhất khi đơn hàng chuyển sang `COMPLETED` (`mark-delivered`)**.
  - Với `ONLINE_MOCK`: Nếu thanh toán `FAILED`, `CANCELLED` hoặc `EXPIRED` $\rightarrow$ Tự động huỷ đơn (`CANCELLED`), thực hiện giao dịch bù (compensating transaction) ghi ledger `RECEIPT` để hoàn lại stock, hoàn voucher quota idempotent.
- **Máy trạng thái Order:**
  - `PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `COMPLETED`.
  - Huỷ đơn: Customer/Guest huỷ tại `PENDING` hoặc `CONFIRMED`. Nhân viên huỷ tại `PENDING`, `CONFIRMED` hoặc `PROCESSING`. Cấm huỷ khi đã `SHIPPED` hoặc `COMPLETED`.

### 1.2. Luồng Return / Refund (Priority P1)
- **Cửa sổ yêu cầu (Return Window):**
  - Chỉ cho phép tạo yêu cầu trả hàng trong vòng **7 ngày** tính từ `deliveredAt` (`now <= deliveredAt + 7 days`) của đơn hàng `COMPLETED`.
- **Trả hàng từng phần (Partial Return):**
  - Khách hàng chọn từng mặt hàng và số lượng muốn trả: `0 < requestedQty <= returnableQty`.
  - `returnableQty = orderedQty - alreadyReturnedQty - returnReservedQty`.
- **Cơ chế Two-Phase Reservation chống Over-Return:**
  - Khi tạo `OrderReturn` (`REQUESTED`): Tạm giữ số lượng `returnReservedQty += requestedQty` trên từng order item.
  - Nếu yêu cầu bị `REJECTED` hoặc `CANCELLED`: Giải phóng `returnReservedQty -= requestedQty`.
  - Nếu yêu cầu được `APPROVED`: Chuyển `returnedQty += requestedQty` và `returnReservedQty -= requestedQty`.
- **Máy trạng thái Return (1 Cấp duyệt chặt chẽ):**
  - `REQUESTED` $\rightarrow$ `PROCESSING` (Receptionist kiểm tra bằng chứng / lý do).
  - `PROCESSING` $\rightarrow$ `RECEIVED` (Receptionist xác nhận đã nhận hàng tại quầy; **không đổi tồn kho, không hoàn tiền tại bước này**).
  - `RECEIVED` $\rightarrow$ `APPROVED` (Manager hoặc Admin duyệt cấp cuối; đóng băng khoản hoàn, tự động sinh `OrderRefund` `PENDING`).
  - `PROCESSING` hoặc `RECEIVED` $\rightarrow$ `REJECTED` (Manager hoặc Admin từ chối; giải phóng `returnReservedQty`, hàng trả khách xử lý thủ công ngoài hệ thống).
  - `REQUESTED` hoặc `PROCESSING` $\rightarrow$ `CANCELLED` (Khách tự huỷ).
  - `APPROVED` $\rightarrow$ `COMPLETED` (Khi `OrderRefund` được xử lý chuyển `REFUNDED`).
- **Quy tắc tính Refund:**
  - Số tiền hoàn tính theo tỷ lệ giá thực tế khách đã trả sau chiết khấu voucher:
    $$\text{refundAmount} = \text{Math.floor}\left(\frac{\text{lineNet}}{\text{orderedQty}}\right) \times \text{requestedQty}$$
    (Đảm bảo tổng tiền hoàn cho 1 item không vượt quá `lineNet`).
  - Phí vận chuyển (`shippingFee`) **tuyệt đối không hoàn** (`shippingRefunded: 0`).
  - Hàng trả lại **không tự động nhập kho**. Nếu kiểm định tái sử dụng, nhân viên thực hiện thủ công qua nghiệp vụ `Inventory Receive`.

---

## 2. Kiến Trúc Dữ Liệu & Schema Models

### 2.1. Model `OrderReturn` (`src/modules/order/models/OrderReturn.js`)
```javascript
{
  code: { type: String, required: true, unique: true }, // RET-YYYYMMDD-XXXXXX
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact' },
  status: { 
    type: String, 
    enum: ['REQUESTED', 'PROCESSING', 'RECEIVED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'],
    default: 'REQUESTED',
    index: true
  },
  reason: { type: String, required: true },
  evidenceUrls: [{ type: String }],
  items: [{
    orderItemId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    orderedQty: Number,
    alreadyReturnedQty: { type: Number, default: 0 },
    requestedQty: { type: Number, required: true },
    refundAmount: { type: Number, required: true }
  }],
  refundBreakdown: {
    merchandiseNet: { type: Number, required: true },
    shippingRefunded: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderRefund' },
  history: [{
    status: String,
    at: { type: Date, default: Date.now },
    actorId: mongoose.Schema.Types.ObjectId,
    note: String
  }],
  version: { type: Number, default: 1 }
}
```

### 2.2. Model `OrderRefund` (`src/modules/order/models/OrderRefund.js`)
```javascript
{
  code: { type: String, required: true, unique: true }, // REF-YYYYMMDD-XXXXXX
  cause: { type: String, enum: ['RETURN', 'CANCELLATION'], required: true },
  orderReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderReturn', sparse: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  amount: { type: Number, required: true },
  provider: { type: String, default: 'MOCK' },
  status: { 
    type: String, 
    enum: ['PENDING', 'REFUNDED', 'FAILED'], 
    default: 'PENDING',
    index: true 
  },
  refundedAt: Date,
  idempotencyKey: String,
  history: [{
    status: String,
    at: { type: Date, default: Date.now },
    actorId: mongoose.Schema.Types.ObjectId,
    note: String
  }],
  version: { type: Number, default: 1 }
}
```

---

## 3. Bản Đồ Endpoints & Phân Quyền (RBAC Alignment)

| Method | Endpoint | Quyền (RBAC) | State Transition | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/checkout` | Customer, Guest | $\rightarrow$ `PENDING` | Checkout tạo đơn hàng (đã có) |
| `GET` | `/api/v1/orders` | Customer (Own), Receptionist (Branch), Manager (Assigned), Admin (All) | - | Danh sách đơn hàng theo phân quyền |
| `GET` | `/api/v1/orders/:id` | Customer/Guest (Own), Staff/Manager/Admin | - | Xem chi tiết đơn hàng |
| `POST` | `/api/v1/orders/:id/confirm` | Receptionist, Manager, Admin | `PENDING` $\rightarrow$ `CONFIRMED` | Xác nhận đơn hàng (ONLINE_MOCK cần PAID) |
| `POST` | `/api/v1/orders/:id/process` | Receptionist, Manager, Admin | `CONFIRMED` $\rightarrow$ `PROCESSING` | Chuyển đơn sang đóng gói/xử lý |
| `POST` | `/api/v1/orders/:id/ship` | Receptionist, Manager, Admin | `PROCESSING` $\rightarrow$ `SHIPPED` | Giao hàng cho đơn vị vận chuyển |
| `POST` | `/api/v1/orders/:id/mark-delivered` | Receptionist, Manager, Admin | `SHIPPED` $\rightarrow$ `COMPLETED` | Giao thành công (COD chuyển PAID, mở 7 ngày trả) |
| `POST` | `/api/v1/orders/:id/cancel` | Customer, Guest (Own) | `PENDING`/`CONFIRMED` $\rightarrow$ `CANCELLED` | Khách huỷ đơn hàng |
| `POST` | `/api/v1/orders/:id/staff-cancel` | Receptionist, Manager, Admin | `PENDING`/`CONFIRMED`/`PROCESSING` $\rightarrow$ `CANCELLED` | Nhân viên huỷ đơn hàng kèm lý do |
| `GET` | `/api/v1/orders/:id/returnable-items` | Customer, Guest, Staff, Manager, Admin | - | Lấy danh sách item còn hạn trả trong 7 ngày |
| `POST` | `/api/v1/orders/:id/return-quote` | Customer, Guest, Staff, Manager, Admin | - | Ước tính số tiền hoàn (dry-run preview) |
| `POST` | `/api/v1/order-returns` | Customer, Guest | $\rightarrow$ `REQUESTED` | Tạo yêu cầu trả hàng, giữ `returnReservedQty` |
| `GET` | `/api/v1/order-returns` | Customer (Own), Receptionist, Manager, Admin | - | Danh sách yêu cầu trả hàng |
| `GET` | `/api/v1/order-returns/:id` | Customer/Guest (Own), Receptionist, Manager, Admin | - | Xem chi tiết yêu cầu trả hàng |
| `POST` | `/api/v1/order-returns/:id/process` | Receptionist | `REQUESTED` $\rightarrow$ `PROCESSING` | Lễ tân tiếp nhận xử lý yêu cầu |
| `POST` | `/api/v1/order-returns/:id/receive` | Receptionist | `PROCESSING` $\rightarrow$ `RECEIVED` | Lễ tân xác nhận đã nhận hàng thực tế |
| `POST` | `/api/v1/order-returns/:id/approve` | Manager, Admin (1 Cấp duyệt) | `RECEIVED` $\rightarrow$ `APPROVED` | Duyệt hoàn tiền, tạo `OrderRefund` |
| `POST` | `/api/v1/order-returns/:id/reject` | Manager, Admin | `PROCESSING`/`RECEIVED` $\rightarrow$ `REJECTED` | Từ chối trả hàng, hoàn `returnReservedQty` |
| `POST` | `/api/v1/order-returns/:id/cancel` | Customer, Guest (Own) | `REQUESTED`/`PROCESSING` $\rightarrow$ `CANCELLED` | Khách tự huỷ yêu cầu trả hàng |
| `POST` | `/api/v1/order-refunds/:id/process`| Manager, Admin | `PENDING` $\rightarrow$ `REFUNDED` | Thực thi lệnh hoàn tiền qua mock provider |

---

## 4. Chi Tiết Các Bước Triển Khai (Detailed Task Breakdown)

### Task 1: Hoàn Thiện Data Models `OrderReturn` & `OrderRefund`
- **Agent:** `backend-specialist`
- **Tập tin:**
  - [OrderReturn.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/models/OrderReturn.js)
  - [OrderRefund.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/models/OrderRefund.js)
  - [Order.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/models/Order.js) (đã có sẵn `returnReservedQty`, `returnedQty`, `refundedNet`)
- **Nghiệp vụ:** Khai báo đầy đủ Mongoose Schema với indexes, validation, và timestamps.

### Task 2: Hoàn Thiện Trọn Vẹn State Machine Cho Module Order
- **Agent:** `backend-specialist` + `security-auditor`
- **Tập tin:**
  - [order.service.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/order.service.js)
  - [order.controller.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/order.controller.js)
  - [order.routes.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/order.routes.js)
- **Nghiệp vụ:**
  - Bổ sung `confirmOrder`, `processOrder`, `shipOrder`, `markDelivered` (cập nhật `deliveredAt = new Date()`, đổi COD sang `PAID`).
  - Chuẩn hoá `customerCancelOrder` và `staffCancelOrder` với compensating transaction.
  - Tự động huỷ đơn và bồi hoàn kho khi payment `ONLINE_MOCK` thất bại (`FAILED`/`CANCELLED`/`EXPIRED`).
  - Hỗ trợ `returnable-items` và `return-quote` phục vụ giao diện trả hàng cho Frontend.

### Task 3: Xây Dựng Service & Luồng Nghiệp Vụ Return / Refund
- **Agent:** `backend-specialist` + `security-auditor`
- **Tập tin mới:**
  - `src/modules/order/return.service.js`
  - `src/modules/order/return.controller.js`
  - `src/modules/order/return.routes.js`
- **Nghiệp vụ:**
  - Kiểm tra điều kiện 7 ngày từ `deliveredAt`.
  - Tính toán số tiền hoàn thực tế theo tỷ lệ `lineNet / orderedQty`.
  - Giữ và giải phóng `returnReservedQty` an toàn chống race condition.
  - Phân quyền chính xác: Lễ tân chỉ `process` & `receive`; Manager/Admin `approve` & `reject`.
  - Tự động sinh `OrderRefund` khi approve và xử lý chuyển tiền mock.

### Task 4: Mount Router & Cấu Hình Định Tuyến Ứng Dụng
- **Agent:** `backend-specialist`
- **Tập tin:**
  - [app.js](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/app.js)
- **Nghiệp vụ:** Mount `/api/v1/order-returns` và `/api/v1/order-refunds` vào Express app.

### Task 5: Bộ Kiểm Thử Tự Động Toàn Diện (End-to-End Suite)
- **Agent:** `test-engineer`
- **Tập tin mới:**
  - `tests/order-return.test.js`
- **Kịch bản kiểm thử:**
  1. Luồng Order trọn vẹn: Checkout $\rightarrow$ Confirm $\rightarrow$ Process $\rightarrow$ Ship $\rightarrow$ Mark Delivered (COD payment chuyển `PAID`).
  2. ONLINE_MOCK failure: Huỷ đơn tự động, hoàn tồn kho RECEIPT, hoàn voucher quota.
  3. Kiểm tra cửa sổ 7 ngày: Đơn quá 7 ngày bị từ chối `RETURN_WINDOW_EXPIRED`.
  4. Trả hàng từng phần: Kiểm tra số lượng hợp lệ, giữ `returnReservedQty`, cấm trả vượt `returnableQty`.
  5. Quy tắc phân quyền 1 cấp: Lễ tân gọi `approve`/`reject` bị chặn 403; Manager/Admin thực hiện thành công.
  6. Hoàn tiền: Duyệt `APPROVED` tạo `OrderRefund` `PENDING`, gọi `process` chuyển `REFUNDED` và OrderReturn thành `COMPLETED`. Không hoàn tiền phí ship.

---

## 5. Phase X: Tiêu Chí Nghiệm Thu (Verification Checklist)

- [x] Tất cả 9 test suites của dự án (131/131 tests) đạt 100% PASS khi chạy `npm test`.
- [x] Lệnh `npm run build` biên dịch sạch sẽ toàn bộ 116 files không có lỗi Babel.
- [x] Tuân thủ nghiêm ngặt chuẩn OpenAPI 3.1: Mọi endpoint `Order` và `OrderReturn` trả response đúng schema, không dính lỗi `additionalProperties: false`.
- [x] Viết tài liệu bàn giao `docs/FE-HANDOFF-P0-ORDER-P1-RETURN.md` hướng dẫn chi tiết cho Frontend.
- [x] Áp dụng nhất quán 3 lựa chọn Khuyến Nghị A: Hoàn tiền theo giá thực trả sau voucher không hoàn ship, tự động huỷ đơn bồi hoàn kho khi ONLINE_MOCK thất bại, và từ chối đổi trả tại RECEIVED không sinh biến động kho.
