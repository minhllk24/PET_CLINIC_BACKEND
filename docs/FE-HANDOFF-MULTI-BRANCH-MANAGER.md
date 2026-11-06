# TÀI LIỆU HÀN GẮN & TÍCH HỢP FRONTEND (FE HANDOFF)
## Module Quản Lý Nhiều Chi Nhánh (Multi-Branch Manager) & Làm Sạch Dữ Liệu Hồ Sơ Dịch Vụ (Service Record Data Enrichment)

> **Dành cho:** Frontend Engineering Team  
> **Phiên bản API:** V7  
> **Trạng thái BE:** Đã hoàn thành triển khai & 100% Automated Test Pass  
> **Mục tiêu:** Cung cấp chi tiết endpoint, payload mẫu, cấu trúc phản hồi và hướng dẫn hiển thị giao diện cho module Quản lý nhiều chi nhánh và màn hình Hồ sơ dịch vụ.

---

### MỤC LỤC
1. [Tổng Quan Kiến Trúc & Thiết Kế Linh Hoạt](#1-tổng-quan-kiến-trúc--thiết-kế-linh-hoạt)
2. [Chi Tiết API Quản Lý (Manager APIs)](#2-chi-tiết-api-quản-lý-manager-apis)
   - [2.1 Tạo Tài Khoản Quản Lý Mới](#21-tạo-tài-khoản-quản-lý-mới)
   - [2.2 Lấy Danh Sách Quản Lý](#22-lấy-danh-sách-quản-lý)
   - [2.3 Lấy Chi Tiết Quản Lý](#23-lấy-chi-tiết-quản-lý)
   - [2.4 Cập Nhật Thông Tin Quản Lý](#24-cập-nhật-thông-tin-quản-lý)
   - [2.5 Cập Nhật Danh Sách Chi Nhánh Phụ Trách](#25-cập-nhật-danh-sách-chi-nhánh-phụ-trách)
   - [2.6 Đặt Lại Mật Khẩu Quản Lý (Admin Reset Password)](#26-đặt-lại-mật-khẩu-quản-lý-admin-reset-password)
3. [Tích Hợp Trong Module Nhân Sự Hiện Có (`/api/v1/staff`)](#3-tích-hợp-trong-module-nhân-sự-hiện-có-apiv1staff)
4. [Cơ Chế Phân Quyền & Dynamic Scope Sync](#4-cơ-chế-phân-quyền--dynamic-scope-sync)
5. [Giải Quyết Dữ Liệu Hồ Sơ Dịch Vụ (Service Record Data Enrichment)](#5-giải-quyết-dữ-liệu-hồ-sơ-dịch-vụ-service-record-data-enrichment)
6. [Tài Khoản Test & Kịch Bản Kiểm Thử E2E](#6-tài-khoản-test--kịch-bản-kiểm-thử-e2e)

---

## 1. Tổng Quan Kiến Trúc & Thiết Kế Linh Hoạt

Backend đã triển khai mô hình **Hybrid Bridge** cho phép FE tích hợp theo 2 cách tùy ý mà không sợ lỗi:
1. **Dedicated Endpoint (Khuyên dùng cho tính năng Quản lý):** Gọi trực tiếp `/api/v1/managers` hoặc `/api/v1/admin/managers`.
2. **Unified Endpoint (Tích hợp liền mạch qua form Nhân sự hiện tại):** Sử dụng `/api/v1/staff`. Backend tự động nhận diện `systemRole: 'MANAGER'` hoặc `role: 'MANAGER'` để chuyển tiếp sang luồng Manager mà không bắt buộc trường `homeBranchId` hay phân ca làm việc.

### Các đặc điểm nghiệp vụ cốt lõi:
- **`systemRole`**: Luôn là `MANAGER`.
- **`assignedBranchIds`**: Mảng chứa danh sách ID chi nhánh quản lý (ít nhất 1 chi nhánh).
- **`homeBranchId`**: Bằng `null` (Quản lý không thuộc cố định 1 chi nhánh).
- **Phân ca**: Hệ thống chặn phân ca đối với tài khoản Quản lý (`Quản lý không cần phân ca làm việc`).
- **Dynamic Live Sync**: Khi Admin thay đổi danh sách chi nhánh phân công, quyền hạn của Manager có hiệu lực ngay lập tức trong từng request tiếp theo mà Quản lý không cần phải đăng xuất/đăng nhập lại.

---

## 2. Chi Tiết API Quản Lý (Manager APIs)

### 2.1 Tạo Tài Khoản Quản Lý Mới

- **Endpoint:** `POST /api/v1/managers` (hoặc `POST /api/v1/staff`)
- **Quyền truy cập:** Chỉ `ADMIN`
- **Headers:** `Authorization: Bearer <ADMIN_TOKEN>`
- **Request Body:**

```json
{
  "fullName": "Trần Văn Quản Lý",
  "phone": "0912345678",
  "email": "quanly.hcm@petclinic.vn",
  "assignedBranchIds": [
    "60d0fe4f5311236168a109ca",
    "60d0fe4f5311236168a109cb"
  ],
  "systemRole": "MANAGER",
  "notes": "Phụ trách cụm chi nhánh TP.HCM"
}
```

> **Lưu ý về thông tin đăng nhập (`credentials`):**  
> FE không bắt buộc phải nhập `username` và `password`. Nếu không truyền, Backend sẽ tự động sinh username duy nhất (dạng `mgr_xxxxxx`) và mật khẩu ngẫu nhiên bảo mật cao (16 ký tự bao gồm chữ hoa, chữ thường, số, ký tự đặc biệt).

- **Phản hồi thành công (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "673b1e4f5311236168a109ff",
    "userId": "673b1e4f5311236168a109fe",
    "staffCode": "MGR-2411001",
    "fullName": "Trần Văn Quản Lý",
    "phone": "0912345678",
    "email": "quanly.hcm@petclinic.vn",
    "systemRole": "MANAGER",
    "role": "MANAGER",
    "staffSubRole": "MANAGER",
    "homeBranchId": null,
    "assignedBranchIds": [
      "60d0fe4f5311236168a109ca",
      "60d0fe4f5311236168a109cb"
    ],
    "assignedBranches": [
      {
        "id": "60d0fe4f5311236168a109ca",
        "code": "BR-Q1",
        "name": "Chi nhánh Quận 1"
      },
      {
        "id": "60d0fe4f5311236168a109cb",
        "code": "BR-Q3",
        "name": "Chi nhánh Quận 3"
      }
    ],
    "status": "ACTIVE",
    "notes": "Phụ trách cụm chi nhánh TP.HCM",
    "credentials": {
      "username": "mgr_tranvanquanly",
      "password": "A1b@C2d#E3f$G4h%",
      "requirePasswordChange": false
    },
    "createdAt": "2026-11-06T12:00:00.000Z"
  },
  "message": "Tạo tài khoản Quản lý thành công"
}
```

---

### 2.2 Lấy Danh Sách Quản Lý

- **Endpoint:** `GET /api/v1/managers`
- **Quyền truy cập:** `ADMIN` (hoặc `MANAGER` xem chính họ)
- **Query Params:**
  - `page`: Trang (mặc định 1)
  - `limit`: Số bản ghi mỗi trang (mặc định 10)
  - `search`: Tìm theo họ tên, số điện thoại, email, mã nhân viên
  - `status`: Lọc trạng thái (`ACTIVE`, `INACTIVE`, `SUSPENDED`)
  - `branchId`: Lọc các quản lý phụ trách chi nhánh cụ thể
- **Phản hồi thành công (200 OK):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "673b1e4f5311236168a109ff",
        "staffCode": "MGR-2411001",
        "fullName": "Trần Văn Quản Lý",
        "phone": "0912345678",
        "email": "quanly.hcm@petclinic.vn",
        "systemRole": "MANAGER",
        "role": "MANAGER",
        "assignedBranchIds": [
          "60d0fe4f5311236168a109ca",
          "60d0fe4f5311236168a109cb"
        ],
        "assignedBranches": [
          { "id": "60d0fe4f5311236168a109ca", "code": "BR-Q1", "name": "Chi nhánh Quận 1" },
          { "id": "60d0fe4f5311236168a109cb", "code": "BR-Q3", "name": "Chi nhánh Quận 3" }
        ],
        "status": "ACTIVE"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 2.3 Lấy Chi Tiết Quản Lý

- **Endpoint:** `GET /api/v1/managers/:id`
- **Quyền truy cập:** `ADMIN` hoặc chính Quản lý sở hữu tài khoản
- **Phản hồi thành công (200 OK):** Trả về đối tượng Quản lý đầy đủ như mục 2.1 (ngoại trừ trường `credentials` chỉ hiển thị 1 lần lúc tạo).

---

### 2.4 Cập Nhật Thông Tin Quản Lý

- **Endpoint:** `PATCH /api/v1/managers/:id`
- **Quyền truy cập:** `ADMIN`
- **Request Body (các trường tùy chọn):**

```json
{
  "fullName": "Trần Văn Quản Lý (Đã cập nhật)",
  "phone": "0988776655",
  "notes": "Bổ sung quản lý thêm chi nhánh mới",
  "status": "ACTIVE"
}
```

- **Phản hồi thành công (200 OK):** Dữ liệu cập nhật mới nhất.

---

### 2.5 Cập Nhật Danh Sách Chi Nhánh Phụ Trách

- **Endpoint:** `PUT /api/v1/managers/:id/assigned-branches`
- **Quyền truy cập:** Chỉ `ADMIN`
- **Request Body:**

```json
{
  "assignedBranchIds": [
    "60d0fe4f5311236168a109ca",
    "60d0fe4f5311236168a109cc"
  ]
}
```

- **Phản hồi thành công (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "673b1e4f5311236168a109ff",
    "assignedBranchIds": [
      "60d0fe4f5311236168a109ca",
      "60d0fe4f5311236168a109cc"
    ],
    "assignedBranches": [
      { "id": "60d0fe4f5311236168a109ca", "code": "BR-Q1", "name": "Chi nhánh Quận 1" },
      { "id": "60d0fe4f5311236168a109cc", "code": "BR-TD", "name": "Chi nhánh Thủ Đức" }
    ]
  },
  "message": "Cập nhật danh sách chi nhánh quản lý thành công"
}
```

---

### 2.6 Đặt Lại Mật Khẩu Quản Lý (Admin Reset Password)

- **Endpoint:** `POST /api/v1/managers/:id/reset-password`
- **Quyền truy cập:** Chỉ `ADMIN`
- **Request Body (tùy chọn `newPassword`):**
```json
{
  "newPassword": "OptionalNewPassword123@"
}
```
*(Nếu bỏ trống body, hệ thống tự động sinh mật khẩu ngẫu nhiên mới và trả về).*

---

## 3. Tích Hợp Trong Module Nhân Sự Hiện Có (`/api/v1/staff`)

Nếu FE muốn tái sử dụng hoàn toàn danh sách Nhân viên (`/admin/staff`) và form Thêm nhân viên hiện tại mà không cần tách riêng trang:

1. **Hiển thị danh sách tổng hợp:**
   - `GET /api/v1/staff` mặc định trả về cả Nhân viên thông thường lẫn Quản lý chi nhánh.
   - Trường `systemRole` sẽ là `STAFF` hoặc `MANAGER`.
   - Nếu FE gọi `GET /api/v1/staff?role=MANAGER` hoặc `GET /api/v1/staff?staffSubRole=MANAGER`, BE tự động lọc ra danh sách các Quản lý.
2. **Form Thêm nhân viên:**
   - Khi người dùng chọn vai trò là `Quản lý` (gửi `systemRole: "MANAGER"` hoặc `role: "MANAGER"`):
     - FE ẩn chọn "Chi nhánh chính" (`homeBranchId`).
     - FE hiển thị multi-select "Chi nhánh phụ trách" (`assignedBranchIds`).
     - Gửi `POST /api/v1/staff` hoặc `POST /api/v1/managers`. Cả hai đều hoạt động như nhau!
3. **Cập nhật:**
   - FE có thể gọi `PATCH /api/v1/staff/:id` hoặc `PATCH /api/v1/managers/:id`.

---

## 4. Cơ Chế Phân Quyền & Dynamic Scope Sync

| Hành động | ADMIN | MANAGER | STAFF (Bác sĩ / Kỹ thuật viên) |
| :--- | :---: | :---: | :---: |
| Tạo / Cập nhật / Xóa Quản lý | ✅ Có quyền | ❌ Bị cấm (403) | ❌ Bị cấm (403) |
| Phân bổ danh sách chi nhánh cho Quản lý | ✅ Có quyền | ❌ Bị cấm (403) | ❌ Bị cấm (403) |
| Tự cấp quyền hoặc tạo Quản lý khác | ✅ N/A | ❌ Bị cấm (403) | ❌ Bị cấm (403) |
| Truy cập dữ liệu chi nhánh nằm trong `assignedBranchIds` | ✅ Toàn quyền | ✅ Có quyền | Chỉ chi nhánh được gán (`homeBranchId`) |
| Truy cập dữ liệu chi nhánh NGOÀI `assignedBranchIds` | ✅ Toàn quyền | ❌ Bị chặn (403) | ❌ Bị chặn (403) |
| Phân ca làm việc (Shifts) | ✅ Phân cho STAFF | ❌ Không áp dụng | ✅ Theo ca làm việc |

> **Cực kỳ quan trọng về Dynamic Live Sync:**  
> Backend đã tích hợp middleware đồng bộ trạng thái tài khoản và chi nhánh trực tiếp theo Database. Ngay khi Admin gỡ bỏ chi nhánh A khỏi một Manager, request kế tiếp của Manager đến chi nhánh A sẽ lập tức trả về `403 Forbidden` mà **không cần đợi Token JWT hết hạn** hoặc bắt người dùng đăng xuất.

---

## 5. Giải Quyết Dữ Liệu Hồ Sơ Dịch Vụ (Service Record Data Enrichment)

Đối với vấn đề hiển thị mã ObjectId thô (`6ae5e54bae3db59cd65d4102`, `6ad08e4517bf41f5954234d1`) và dấu gạch ngang (`—`) trên màn hình `Hồ sơ dịch vụ`:

### 5.1 Các trường mới được BE bổ sung tự động vào mỗi Service Record:

| Cột trên FE | Trường ID cũ (ObjectId) | Trường mới đã làm giàu (Dùng để hiển thị) | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Thú cưng** | `petId` | `petName` (String), `pet` (Object: `{ id, name, species, breed }`) | VD: `"Miu Miu"` |
| **Dịch vụ** | `serviceId` / `serviceIds` | `serviceName` (String), `serviceNames` (Array[String]), `services` (Array[Object]) | VD: `"Khám tổng quát, Tiêm vaccine"` |
| **Nhân viên chính** | `staffId` / `primaryStaffId` | `primaryStaffName` (String), `staffName` (String), `primaryStaff` (Object) | VD: `"BS. Nguyễn Văn A"` (Không còn dấu gạch ngang rỗng) |
| **Chi nhánh** | `branchId` | `branchName` (String), `branch` (Object: `{ id, code, name }`) | VD: `"Chi nhánh Quận 1"` |
| **Khách hàng** | `customerId` | `customerName` (String), `customerPhone` (String), `customer` (Object) | VD: `"Nguyễn Thị B (0901234567)"` |
| **Bác sĩ duyệt** | `reviewerStaffId` | `reviewerName` (String), `reviewerStaff` (Object) | Tên bác sĩ xét duyệt |

### 5.2 Mẫu dữ liệu phản hồi từ `GET /api/v1/service-records`:

```json
{
  "id": "673b2a5f5311236168a109aa",
  "recordCode": "SR-503597",
  "recordType": "MEDICAL",
  "status": "COMPLETED",
  "createdAt": "2026-11-01T08:30:00.000Z",

  "petId": "6ae5e54bae3db59cd65d4102",
  "petName": "Cún Lucky",
  "pet": {
    "id": "6ae5e54bae3db59cd65d4102",
    "name": "Cún Lucky",
    "species": "DOG",
    "breed": "Poodle"
  },

  "serviceId": "6ad08e4517bf41f5954234d1",
  "serviceName": "Khám sức khỏe tổng quát",
  "serviceNames": ["Khám sức khỏe tổng quát"],

  "branchId": "60d0fe4f5311236168a109ca",
  "branchName": "Chi nhánh Quận 1",

  "primaryStaffId": "673b1e4f5311236168a10955",
  "primaryStaffName": "BS. Lê Hoàng Nam",
  "staffName": "BS. Lê Hoàng Nam",

  "customerName": "Trần Thị Mai",
  "customerPhone": "0987654321"
}
```

### 5.3 Khuyến nghị cập nhật trên UI Component của FE:
```tsx
// Thay vì hiển thị trực tiếp record.petId hoặc record.serviceId:
// ❌ Cũ: <td>{record.petId}</td>
// ✅ Mới: <td>{record.petName || record.pet?.name || record.petId}</td>

// ❌ Cũ: <td>{record.serviceId}</td>
// ✅ Mới: <td>{record.serviceName || record.services?.map(s => s.name).join(', ') || 'Dịch vụ thú y'}</td>

// ❌ Cũ: <td>{record.staffId || '—'}</td>
// ✅ Mới: <td>{record.primaryStaffName || record.staffName || 'Chưa phân công'}</td>
```

---

## 6. Tài Khoản Test & Kịch Bản Kiểm Thử E2E

### 6.1 Môi trường kiểm thử cục bộ:
- Base URL: `http://localhost:3000/api/v1`
- Tài khoản Quản trị viên (Admin):
  - **Username / Email:** `admin` / `admin@petclinic.com`
  - **Password:** `Admin@123` (hoặc mật khẩu admin chuẩn trong seed)

### 6.2 Các bước kiểm thử xác nhận (E2E Test Steps):
1. **Bước 1: Tạo Quản lý phụ trách 2 chi nhánh:**
   - Đăng nhập bằng tài khoản `ADMIN`.
   - Gửi request `POST /api/v1/managers` với 2 ID chi nhánh trong `assignedBranchIds`.
   - Lưu lại `username` và `password` trả về trong trường `credentials`.
2. **Bước 2: Đăng nhập bằng tài khoản Quản lý vừa tạo:**
   - Gọi `POST /api/v1/auth/login` với thông tin đăng nhập trên.
   - Kiểm tra Token trả về có chứa vai trò `MANAGER`.
3. **Bước 3: Kiểm tra quyền truy cập chi nhánh:**
   - Dùng Token của Quản lý truy cập tài nguyên thuộc chi nhánh 1 & 2 -> **Thành công (200 OK)**.
   - Thử truy cập dữ liệu của chi nhánh thứ 3 (không được phân công) -> **Bị từ chối (403 Forbidden)**.
4. **Bước 4: Kiểm tra chặn phân ca:**
   - Thử gán ca làm việc cho Quản lý qua API Shifts -> **Hệ thống báo lỗi 400: Không áp dụng phân ca cho Quản lý**.
5. **Bước 5: Thử nghiệm Dynamic Sync:**
   - Admin gọi `PUT /api/v1/managers/:id/assigned-branches` gỡ bỏ chi nhánh 2.
   - Quản lý gửi request lại vào chi nhánh 2 -> **Lập tức nhận 403 Forbidden mà không cần đăng nhập lại**.
6. **Bước 6: Kiểm tra giao diện Hồ sơ dịch vụ:**
   - Mở màn hình `/admin/service-records`.
   - Xác nhận các cột "Thú cưng", "Dịch vụ", "Nhân viên chính", "Chi nhánh" hiển thị tên đầy đủ, rõ ràng và không còn mã ID thô.

---
*Nếu team FE cần hỗ trợ thêm thông tin hoặc tùy biến thêm trường dữ liệu, vui lòng phản hồi lại team BE.*

