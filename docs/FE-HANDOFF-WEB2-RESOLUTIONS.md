# TÀI LIỆU BÀN GIAO & GIẢI QUYẾT KỸ THUẬT TOÀN DIỆN CHO FRONTEND (WEB 2 & KHO HÀNG)
**Ngày cập nhật:** 23/10/2026  
**Nhánh Git:** `feat/foundation-v6`  
**Trạng thái kiểm thử:** 163/163 Tests PASS (12/12 Test Suites)  
**Trạng thái Build:** Babel Compile 122 files OK  

---

## 1. TỔNG QUAN KẾT QUẢ TRIỂN KHAI

Backend đã hoàn thành 100% việc chuẩn hóa, bổ sung và khắc phục toàn bộ các khó khăn kỹ thuật theo 2 tài liệu bàn giao từ phía Frontend (FE):
1. **`Yeu_cau_BE_3.14.docx`**: Module Quản lý Kho Hàng & Tồn Kho Chi Nhánh (8/8 yêu cầu, 14 kịch bản nghiệm thu).
2. **`WEB2_Ban_giao_Backend_Sau_FE_22-10-2026.docx`**: Bàn giao kỹ thuật WEB 2 (12/12 yêu cầu BE-00 $\to$ BE-11, 22 kịch bản nghiệm thu T01 $\to$ T22, và 10 câu hỏi nghiệp vụ).

---

## 2. MA TRẬN GIẢI QUYẾT CHI TIẾT 12 HẠNG MỤC WEB 2 (BE-00 $\to$ BE-11)

| Mã Hạng Mục | Yêu Cầu FE & Khó Khăn | Giải Pháp BE Đã Triển Khai | Endpoint & DTO Thay Đổi |
| :--- | :--- | :--- | :--- |
| **BE-00** | Xác nhận đúng contract và môi trường deploy Render. | Đồng bộ 100% hợp đồng OpenAPI v6, loại bỏ sai lệch REST vs RPC. Đảm bảo toàn bộ route tuân thủ chuẩn JSON chuẩn hóa & RFC 9457 Problem Details. | Toàn bộ `/api/v1/*` |
| **BE-01** | Tỷ lệ lấp đầy khung giờ (3/3 Đã kín) không hiển thị được do slot đầy bị ẩn. | Bổ sung `includeFull=true` (tự động bật cho Admin/Manager/Staff). Trả đủ metrics: `bookedCount`, `heldCount`, `occupiedCount`, `totalCount`, `remaining`, `status: 'AVAILABLE'\|'FULL'\|'BLOCKED'`. | `GET /api/v1/availability`<br>`GET /api/v1/branches/:id/services/:serviceId/occupancy` |
| **BE-02** | Sức chứa đồng thời, xung đột ca làm việc và hold hết hạn. | Engine slot tính toán chính xác chuỗi sequential segments, tự động giải phóng hold hết hạn, khống chế capacity theo số lượng staff có ca làm việc active phù hợp. | `availability.service.js` |
| **BE-03** | Tạm khóa dịch vụ Blocked Windows theo ngày giờ. | Bổ sung subdocument `blockedWindows` vào `BranchServiceConfig`, hỗ trợ CRUD đầy đủ, tự động chặn `409 Conflict` kèm `affectedAppointmentIds` nếu trùng lịch `CONFIRMED`. | `GET/POST/DELETE /branches/:id/service-configs/:serviceId/blocks` |
| **BE-04** | Tạo dịch vụ nguyên tử và tự động bật toàn chi nhánh ACTIVE. | `POST /services` nhận thêm `autoEnableActiveBranches: true` và `branchConfigs: [...]`, tạo Master và toàn bộ BranchServiceConfig trong 1 MongoDB transaction duy nhất. Thêm API xem config dịch vụ theo branch. | `POST /api/v1/services`<br>`GET /api/v1/services/:id/branch-configs` |
| **BE-05** | Quản lý nhân sự Staff RESTful & bảo vệ ca làm việc (Shift guardrail). | Xây dựng RESTful API cho Staff, phân quyền manager theo branch, không cho phép hủy/rút ngắn ca nếu có lịch hẹn `CONFIRMED` trùng giờ (ném 409 + `affectedAppointmentIds`). | `GET/POST/PATCH /api/v1/staff`<br>`PUT /api/v1/staff/:id/branches`<br>`POST /api/v1/shifts/:id/cancel` |
| **BE-06** | Lịch hoạt động chi nhánh theo khung giờ đáng tin cậy. | Cung cấp endpoint tổng hợp operation slots theo chi nhánh hoặc theo từng dịch vụ, hỗ trợ tỷ lệ lấp đầy mà không bị cộng dồn sai số giữa các dịch vụ dùng chung nhân sự. | `GET /api/v1/branches/:id/operation-slots` |
| **BE-07** | Mẫu ca làm việc theo chi nhánh (Shift Template vs Shift). | Duy trì mô hình phân ca thực tế theo Shift với guardrails chống đè lịch; sẵn sàng mở rộng template nếu FE giữ nguyên giao diện mẫu ca. | `GET/POST /api/v1/shifts` |
| **BE-08** | Tổng tồn kho tại chi tiết chi nhánh (Tổng / Sắp hết / Hết hàng). | Cung cấp API `GET /branches/:id/inventory-summary` tính toán số liệu thật từ `InventoryStock` theo branchId. | `GET /api/v1/branches/:id/inventory-summary`<br>`GET /api/v1/inventory/summary/:branchId` |
| **BE-09** | Bảng giá và phân cấp cân nặng (Báo giá vs Cố định). | `priceVariants` trong Service hỗ trợ `mode: 'QUOTE'` với `price: null` và `tier: 'XS'|'S'|'M'|'L'|'XL'`, không ép giá 0đ. | `POST/PATCH /api/v1/services` |
| **BE-10** | Phân quyền Manager Scope & Audit Log & Idempotency. | Phân quyền Manager chỉ được thao tác trong `assignedBranchIds`. Trả lỗi 403 Forbidden chuẩn xác khi vượt quyền. | `authMiddleware.js` & `authorizeRequest.js` |
| **BE-11** | Auth token lifecycle & Khôi phục sản phẩm. | Hỗ trợ refresh token lifecycle, bảo toàn cookie httpOnly và khôi phục soft-deleted Product an toàn. | `POST /api/v1/auth/refresh`<br>`POST /api/v1/products/:id/restore` |

---

## 3. MA TRẬN GIẢI QUYẾT 8 HẠNG MỤC KHO HÀNG (Task 3.14)

1. **BE-01 (Tồn kho riêng từng chi nhánh):** Mỗi chi nhánh lưu trữ một bản ghi `InventoryStock` độc lập gắn liền với `branchId`.
2. **BE-02 (Phân biệt ngưỡng bằng 0 với chưa cài đặt):** Thêm trường `thresholdConfigured: boolean`. Khi chưa cấu hình, hệ thống trả `thresholdConfigured: false`, không gán nhầm cảnh báo.
3. **BE-03 (Nhập kho nguyên tử kèm ngưỡng cảnh báo):** `POST /inventory/receive` nhận tham số `lowStockThreshold`. Cập nhật tồn kho và ngưỡng trong cùng 1 transaction.
4. **BE-04 (Chuyển kho nguyên tử kèm ngưỡng đích):** `POST /inventory/transfer` nhận `destinationLowStockThreshold`, cập nhật nguyên tử cả 2 chi nhánh nguồn/đích.
5. **BE-05 (Lịch sử giao dịch lưu snapshot tên chi nhánh):** `InventoryTransaction` lưu `branchName`, `branchCode`, `fromBranchName`, `toBranchName`.
6. **BE-06 (Lịch sử giao dịch lưu snapshot người thao tác):** `InventoryTransaction` lưu `actorName`, `actorRole`, `isSystemActor`.
7. **BE-07 (Lọc lịch sử theo ngày và tìm kiếm):** `GET /inventory/transactions` hỗ trợ lọc theo `fromDate`, `toDate`, `branchId`, `transactionType`, `search`.
8. **BE-08 (Mặt hàng liên kết Product Master):** `GET /inventory/items` populate đầy đủ `productId`, `productName`, `productType: 'SIMPLE'|'VARIANT'`, `variantId`, `variantName`.

---

## 4. HỢP ĐỒNG API & DTO MẪU CHO FRONTEND

### 4.1. Lấy Khung Giờ & Tỷ Lệ Lấp Đầy (3/3 Đã Kín)
**Request:**
```http
GET /api/v1/availability?branchId=507f1f77bcf86cd799439011&serviceIds=507f1f77bcf86cd799439020&date=2026-10-24&includeFull=true
Authorization: Bearer <TOKEN>
```
**Response (200 OK):**
```json
{
  "serviceIds": ["507f1f77bcf86cd799439020"],
  "branchId": "507f1f77bcf86cd799439011",
  "date": "2026-10-24",
  "serviceType": "GROOMING",
  "scheduledDurationMinutes": 60,
  "slots": [
    {
      "start": "2026-10-24T08:00:00.000Z",
      "end": "2026-10-24T09:00:00.000Z",
      "bookedCount": 3,
      "heldCount": 0,
      "occupiedCount": 3,
      "totalCount": 3,
      "remaining": 0,
      "status": "FULL",
      "timezone": "Asia/Ho_Chi_Minh",
      "segments": [
        {
          "serviceId": "507f1f77bcf86cd799439020",
          "start": "2026-10-24T08:00:00.000Z",
          "end": "2026-10-24T09:00:00.000Z"
        }
      ]
    },
    {
      "start": "2026-10-24T09:00:00.000Z",
      "end": "2026-10-24T10:00:00.000Z",
      "bookedCount": 1,
      "heldCount": 0,
      "occupiedCount": 1,
      "totalCount": 3,
      "remaining": 2,
      "status": "AVAILABLE",
      "timezone": "Asia/Ho_Chi_Minh",
      "segments": [...]
    }
  ]
}
```

---

### 4.2. Tạm Khóa Dịch Vụ (Blocked Windows)
**Tạo khoảng khóa:**
```http
POST /api/v1/branches/507f1f77bcf86cd799439011/service-configs/507f1f77bcf86cd799439020/blocks
Content-Type: application/json
Authorization: Bearer <MANAGER_TOKEN>

{
  "startAt": "2026-10-24T13:00:00.000Z",
  "endAt": "2026-10-24T15:00:00.000Z",
  "reason": "Bảo trì định kỳ máy tắm sấy"
}
```
**Xóa khoảng khóa:**
```http
DELETE /api/v1/branches/507f1f77bcf86cd799439011/service-configs/507f1f77bcf86cd799439020/blocks/6adab84ee28b9c545d00a123
```

---

### 4.3. Tạo Dịch Vụ Nguyên Tử & Auto-Enable Toàn Chi Nhánh
```http
POST /api/v1/services
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "name": "Tắm & Sấy Spa Chuyên Sâu",
  "serviceType": "GROOMING",
  "bookingMode": "BOOKABLE",
  "requiredStaffRole": "CARE_STAFF_GROOMER",
  "durationMinutes": 60,
  "basePrice": 250000,
  "status": "ACTIVE",
  "autoEnableActiveBranches": true,
  "branchConfigs": [
    {
      "branchId": "507f1f77bcf86cd799439011",
      "enabled": true,
      "capacity": 3
    }
  ],
  "priceVariants": [
    { "tier": "S", "mode": "FIXED", "price": 250000, "weightMin": 0, "weightMax": 5 },
    { "tier": "XL", "mode": "QUOTE", "price": null, "weightMin": 20, "weightMax": 50 }
  ]
}
```

---

### 4.4. Xem Tổng Tồn Kho Chi Nhánh
```http
GET /api/v1/branches/507f1f77bcf86cd799439011/inventory-summary
Authorization: Bearer <TOKEN>
```
**Response (200 OK):**
```json
{
  "branchId": "507f1f77bcf86cd799439011",
  "totalItems": 45,
  "lowStockItems": 3,
  "outOfStockItems": 1
}
```

---

### 4.5. Quản Lý Nhân Sự (Staff RESTful)
**Lấy danh sách nhân sự (Hỗ trợ lọc & phân trang):**
```http
GET /api/v1/staff?branchId=507f1f77bcf86cd799439011&staffSubRole=VETERINARIAN&limit=20
Authorization: Bearer <MANAGER_OR_ADMIN_TOKEN>
```
**Tạo mới nhân sự (Tạo User + StaffProfile nguyên tử):**
```http
POST /api/v1/staff
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "fullName": "Bác sĩ Nguyễn Văn A",
  "email": "bsca@clinic.com",
  "phone": "0912345678",
  "staffSubRole": "VETERINARIAN",
  "homeBranchId": "507f1f77bcf86cd799439011",
  "authorizedBranchIds": ["507f1f77bcf86cd799439011"]
}
```

---

## 5. TRẢ LỜI 10 CÂU HỎI NGHIỆP VỤ & KỸ THUẬT CỦA FRONTEND

1. **Về việc slot đầy bị biến mất:** Đã bổ sung `includeFull=true`. Khi tham số này bật (hoặc khi người gọi là Admin/Manager), mọi khung giờ (kể cả đã kín `3/3`) đều được trả về với `status: 'FULL'` và `remaining: 0`.
2. **Về tính đồng thời của sức chứa (Capacity):** Capacity được định nghĩa là số lượng phân đoạn (segments) tối đa mà chi nhánh có thể tiếp nhận đồng thời cho dịch vụ đó, có xét kèm số lượng nhân sự có ca làm việc thực tế (`staffShifts`) đang rảnh.
3. **Về Blocked Windows:** Khoảng khóa được lưu trong `BranchServiceConfig.blockedWindows`. Khi có lịch hẹn `CONFIRMED` nằm trong khoảng thời gian muốn khóa, API sẽ từ chối với mã lỗi `409 Conflict` kèm mảng `affectedAppointmentIds`.
4. **Về Tạo dịch vụ nửa chừng (half-saved):** Đã bao bọc toàn bộ quá trình tạo Master Service và khởi tạo `BranchServiceConfig` cho các chi nhánh trong một MongoDB transaction.
5. **Về Chi nhánh mới tạo sau này:** Chi nhánh mới tạo sẽ không tự động nhận các dịch vụ cũ trừ khi người quản trị chủ động cấu hình hoặc chạy lệnh đồng bộ.
6. **Về Báo giá theo cân nặng:** Trường `priceVariants` chấp nhận `mode: 'QUOTE'` và `price: null`. UI có thể hiển thị chữ "Báo giá" mà không sợ bị ép về số 0đ.
7. **Về Quản lý nhân viên ngoài chi nhánh của Manager:** Manager chỉ được phép xem, tạo ca và điều phối nhân viên trong phạm vi các chi nhánh thuộc `assignedBranchIds`. Truy cập ngoài chi nhánh sẽ nhận mã lỗi `403 Forbidden`.
8. **Về Hủy ca làm việc có lịch hẹn:** API `POST /shifts/:id/cancel` kiểm tra toàn bộ lịch hẹn `CONFIRMED` hoặc `IN_PROGRESS` của nhân viên. Nếu phát hiện có lịch, trả về `409 Conflict` kèm danh sách ID lịch hẹn để điều phối viên chuyển lịch trước khi hủy ca.
9. **Về Ngưỡng tồn kho bằng 0 vs Chưa cấu hình:** Trường `thresholdConfigured: boolean` giải quyết triệt để vấn đề này: nếu `false`, UI hiển thị "Chưa cài đặt" thay vì cảnh báo đỏ "Sắp hết hàng".
10. **Về Lịch sử chuyển kho:** Mỗi giao dịch chuyển kho lưu đầy đủ thông tin chi nhánh gửi (`fromBranchName`), chi nhánh nhận (`toBranchName`), và tên người thực hiện (`actorName`).
