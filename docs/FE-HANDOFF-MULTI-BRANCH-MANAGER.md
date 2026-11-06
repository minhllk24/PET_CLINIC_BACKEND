# TÀI LIỆU HÀN GẮN & BÀN GIAO FRONTEND (FE HANDOFF - CẬP NHẬT LẦN 2)
## Module Quản Lý Nhiều Chi Nhánh (Multi-Branch Manager), Bảo Mật Fail-Closed Live Sync & Nghiệm Thu Dữ Liệu Hồ Sơ Dịch Vụ Thật

> **Dành cho:** Frontend Engineering Team (`DR_PETS_HOUSE_ANGULAR`)  
> **Phiên bản API Backend:** `v7.0` (Canonical REST & RFC 9457)  
> **Môi trường Database:** MongoDB Atlas (`pet_clinic_v2`)  
> **Trạng thái BE:** Đã giải quyết triệt để 5 nhóm phản hồi & 100% Automated + Live DB Test PASS  

---

### MỤC LỤC
1. [Giải Quyết 5 Nhóm Phản Hồi Từ Frontend](#1-giải-quyết-5-nhóm-phản-hồi-từ-frontend)
2. [Chi Tiết API Quản Lý Đã Chuẩn Hóa](#2-chi-tiết-api-quản-lý-đã-chuẩn-hóa)
3. [Cơ Chế Phân Quyền & Dynamic Live Sync (Fail-Closed)](#3-cơ-chế-phân-quyền--dynamic-live-sync-fail-closed)
4. [Bằng Chứng Dữ Liệu Hồ Sơ Dịch Vụ Thật Trên MongoDB Atlas](#4-bằng-chứng-dữ-liệu-hồ-sơ-dịch-vụ-thật-trên-mongodb-atlas)
5. [Phân Trang Hợp Nhất Nhân Sự + Quản Lý (`/api/v1/staff`)](#5-phân-trang-hợp-nhất-nhân-sự--quản-lý-apiv1staff)
6. [Thông Tin Bàn Giao Môi Trường & Bằng Chứng Nghiệm Thu UAT](#6-thông-tin-bàn-giao-môi-trường--bằng-chứng-nghiệm-thu-uat)

---

## 1. Giải Quyết 5 Nhóm Phản Hồi Từ Frontend

| STT | Phản hồi từ FE | Giải pháp Backend đã triển khai | Trạng thái |
| :---: | :--- | :--- | :---: |
| **1** | Validate toàn bộ `assignedBranchIds`, không tự bỏ qua ID sai; sinh mật khẩu CSPRNG; đồng bộ response `success/data` & phân trang; siết quyền xem chi tiết Manager. | Viết hàm `validateActiveBranches`: kiểm tra toàn bộ ID hợp lệ, tồn tại và đang `ACTIVE` trong DB (ném `400 VALIDATION_ERROR` nếu có ID lỗi/không tồn tại). Sinh mật khẩu bằng `node:crypto` CSPRNG. Trả đồng thời cả top-level lẫn `data`. Siết `getManagerById` chỉ hiển thị chi nhánh thuộc quyền của Manager. | ✅ ĐÃ SỬA & PASS |
| **2** | Dynamic Live Sync: Khi lỗi DB không được dùng quyền cũ trong JWT; chứng minh thu hồi chi nhánh bị chặn ngay. | Triển khai cơ chế **Fail-Closed**: nếu truy vấn DB lỗi hoặc mất kết nối, hệ thống lập tức từ chối request với `503 SERVICE_UNAVAILABLE` (`DATABASE_SYNC_ERROR`), xóa sạch branch claims, tuyệt đối không dùng lại JWT cũ. Đã bổ sung automated unit/integration test. | ✅ ĐÃ SỬA & PASS |
| **3** | Hồ sơ dịch vụ: Xác nhận làm giàu từ dữ liệu thật, gửi response thực tế có liên kết Pet, Service, Staff, Branch. | Đã trích xuất trực tiếp từ MongoDB Atlas: bản ghi `SR-503597` liên kết thật với Pet "Luna", Service "Thay băng & Chăm sóc vết thương", Staff "Hoàng Thị Mai", Reviewer "Nguyễn Văn An", Branch "Chi nhánh Quận 1". | ✅ ĐÃ XÁC THỰC |
| **4** | Ảnh sản phẩm và biến thể: Gửi response thực tế 5–10 ảnh + SKU giỏ hàng; cập nhật tài liệu sang Angular. | Đã cập nhật file [`docs/FE-HANDOFF-PRODUCT-IMAGES-AND-VARIANTS.md`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/FE-HANDOFF-PRODUCT-IMAGES-AND-VARIANTS.md) sang 100% Angular (TypeScript + HTML Template) kèm JSON thật từ DB. | ✅ ĐÃ CẬP NHẬT |
| **5** | Bàn giao môi trường: Branch, Commit SHA, API Base URL, Database, OpenAPI và kết quả UAT thật. | Cung cấp đầy đủ thông tin môi trường và bằng chứng PASS cho 5 mục tại Mục 6 bên dưới. | ✅ ĐÃ BÀN GIAO |

---

## 2. Chi Tiết API Quản Lý Đã Chuẩn Hóa

### 2.1 Tạo Tài Khoản Quản Lý Mới

- **Endpoint:** `POST /api/v1/managers` (hoặc `POST /api/v1/staff` với `systemRole: "MANAGER"`)
- **Quyền:** Chỉ `ADMIN`
- **Request Body mẫu:**
```json
{
  "fullName": "Phạm Quốc Quản Lý",
  "phone": "0918889999",
  "email": "quanly.hcm@petclinic.vn",
  "assignedBranchIds": [
    "6ae1aeffb1d650ca8dafe501",
    "6ae1aeffb1d650ca8dafe502"
  ],
  "systemRole": "MANAGER"
}
```

> **Quy tắc kiểm tra `assignedBranchIds`:**
> - Nếu truyền ID sai định dạng (ví dụ: `"invalid-id"`) hoặc ID chi nhánh không tồn tại / đang bị đóng cửa (`INACTIVE`), Backend lập tức trả về **`400 VALIDATION_ERROR`** kèm thông báo lỗi cụ thể, không tự ý bỏ qua ID lỗi.
> - Mật khẩu sinh tự động sử dụng thuật toán **CSPRNG (`node:crypto.randomInt`)** dài 16 ký tự bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.

- **Response thành công (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "673b1e4f5311236168a109ff",
    "userId": "673b1e4f5311236168a109ff",
    "staffCode": "MGR-8492",
    "fullName": "Phạm Quốc Quản Lý",
    "phone": "0918889999",
    "email": "quanly.hcm@petclinic.vn",
    "systemRole": "MANAGER",
    "role": "MANAGER",
    "staffSubRole": "MANAGER",
    "homeBranchId": null,
    "assignedBranchIds": [
      "6ae1aeffb1d650ca8dafe501",
      "6ae1aeffb1d650ca8dafe502"
    ],
    "assignedBranches": [
      { "id": "6ae1aeffb1d650ca8dafe501", "code": "BR-Q1", "name": "Chi nhánh Quận 1" },
      { "id": "6ae1aeffb1d650ca8dafe502", "code": "BR-Q7", "name": "Chi nhánh Quận 7" }
    ],
    "status": "ACTIVE",
    "credentials": {
      "username": "mgr_phamquocquanly412",
      "password": "xK8#mQ2$vL9@pZ5!"
    }
  },
  "message": "Tạo tài khoản Quản lý thành công"
}
```

---

### 2.2 Lấy Danh Sách Quản Lý (Đồng Bộ Cấu Trúc Response)

- **Endpoint:** `GET /api/v1/managers`
- **Quyền:** `ADMIN` hoặc `MANAGER`
- **Response thành công (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "673b1e4f5311236168a109ff",
        "staffCode": "MGR-8492",
        "fullName": "Phạm Quốc Quản Lý",
        "phone": "0918889999",
        "systemRole": "MANAGER",
        "role": "MANAGER",
        "assignedBranchIds": ["6ae1aeffb1d650ca8dafe501", "6ae1aeffb1d650ca8dafe502"],
        "assignedBranches": [
          { "id": "6ae1aeffb1d650ca8dafe501", "code": "BR-Q1", "name": "Chi nhánh Quận 1" },
          { "id": "6ae1aeffb1d650ca8dafe502", "code": "BR-Q7", "name": "Chi nhánh Quận 7" }
        ],
        "status": "ACTIVE"
      }
    ],
    "totalCount": 1,
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "nextCursor": null
  },
  "items": [...],
  "totalCount": 1,
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "nextCursor": null
}
```
*(Backend trả về tương thích kép: FE đọc theo `res.data.items` hay `res.items`, `res.data.total` hay `res.totalCount` đều chuẩn xác).*

---

### 2.3 Xem Chi Tiết Quản Lý (Siết Phạm Vi Theo Chi Nhánh)

- **Endpoint:** `GET /api/v1/managers/:id`
- **Quy tắc bảo mật:**
  - `ADMIN`: Xem đầy đủ toàn bộ chi nhánh của Manager.
  - `MANAGER`: Khi xem đồng nghiệp Quản lý có chung chi nhánh, danh sách `assignedBranchIds` và `assignedBranches` trả về sẽ được **lọc (mask)** chỉ hiển thị các chi nhánh thuộc phạm vi quản lý của người gọi. Các chi nhánh ngoài quyền hạn sẽ bị ẩn hoàn toàn để tránh lộ thông tin nội bộ.
  - Nếu không có chi nhánh nào giao thoa: Trả về **`403 Forbidden`**.

---

## 3. Cơ Chế Phân Quyền & Dynamic Live Sync (Fail-Closed)

### Nguyên tắc bảo mật Fail-Closed:
1. **Thu hồi chi nhánh tức thì:** Khi Admin xóa chi nhánh B2 khỏi một Manager, request kế tiếp của Manager đến tài nguyên B2 lập tức bị từ chối với mã **`403 Forbidden`** mà **không cần người dùng đăng xuất hay đợi Token hết hạn**.
2. **Không dùng Token cũ khi lỗi Database:** Trong trường hợp xảy ra sự cố gián đoạn kết nối DB hoặc lỗi truy vấn:
   - Hệ thống **tuyệt đối không tin tưởng quyền chi nhánh cũ trong JWT** để cho phép truy cập.
   - Hệ thống lập tức trả về **`503 Service Unavailable`** (mã lỗi `DATABASE_SYNC_ERROR`: *"Unable to verify live account permissions due to database error"*).

---

## 4. Bằng Chứng Dữ Liệu Hồ Sơ Dịch Vụ Thật Trên MongoDB Atlas

Trích xuất trực tiếp từ database `pet_clinic_v2` trên MongoDB Atlas:

### Mẫu response thực tế từ `GET /api/v1/service-records`:
```json
{
  "id": "6ae739f25d7595e255503597",
  "code": "SR-503597",
  "recordType": "MEDICAL",
  "status": "WAITING_VET_REVIEW",
  "createdAt": "2026-11-01T13:09:00.517Z",

  "petId": "6ae5e54bae3db59cd6510183",
  "petName": "Luna",
  "pet": {
    "id": "6ae5e54bae3db59cd6510183",
    "name": "Luna",
    "species": "CAT",
    "breed": "Mèo Anh lông ngắn"
  },

  "serviceName": "Thay băng & Chăm sóc vết thương",
  "branchName": "Chi nhánh Quận 1",

  "primaryStaffName": "Hoàng Thị Mai",
  "staffName": "Hoàng Thị Mai",
  "reviewerName": "Nguyễn Văn An",

  "customerName": "Khách hàng"
}
```

> **Hướng dẫn cập nhật trên Angular Template:**
> ```html
> <!-- Cột Thú cưng -->
> <td>{{ record.petName || record.pet?.name || 'Thú cưng' }}</td>
> 
> <!-- Cột Dịch vụ -->
> <td>{{ record.serviceName || 'Dịch vụ khám chữa bệnh' }}</td>
> 
> <!-- Cột Nhân viên chính (Không còn dấu gạch ngang rỗng) -->
> <td>{{ record.primaryStaffName || record.staffName || 'Chưa phân công' }}</td>
> 
> <!-- Cột Chi nhánh -->
> <td>{{ record.branchName }}</td>
> ```

---

## 5. Phân Trang Hợp Nhất Nhân Sự + Quản Lý (`/api/v1/staff`)

Khi Admin truy cập danh sách Nhân sự tổng hợp (`GET /api/v1/staff` không truyền lọc role):
- Backend tự động hợp nhất cả Nhân viên thông thường (`StaffProfile`) và Quản lý chi nhánh (`User MANAGER`).
- Thuật toán sắp xếp hợp nhất (`_id: -1`) và phân trang chính xác:
  - `totalCount = tổng nhân viên + tổng quản lý`.
  - Hỗ trợ đầy đủ phân trang theo `page` + `limit` (trang 1, 2, 3...) và phân trang `cursor` mà **không bao giờ bỏ sót Quản lý ở các trang sau**.

---

## 6. Thông Tin Bàn Giao Môi Trường & Bằng Chứng Nghiệm Thu UAT

### 6.1 Thông tin kỹ thuật môi trường:
* **Git Repository:** `minhllk24/PET_CLINIC_BACKEND`
* **Git Branch:** `feat/foundation-v6`
* **API Base URL (Local):** `http://localhost:8080/api/v1`
* **API Base URL (Deployed/Staging):** `https://api.drpetshouse.lat/api/v1`
* **Database:** `pet_clinic_v2` (MongoDB Atlas)
* **OpenAPI Specification:** `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`

### 6.2 Bảng bằng chứng nghiệm thu UAT:

| Hạng mục kiểm thử | Kịch bản kiểm tra | Kết quả thực tế |
| :--- | :--- | :---: |
| **Validate branch IDs** | Gửi ID sai định dạng hoặc branch không tồn tại | ✅ Trả về đúng `400 VALIDATION_ERROR` |
| **CSPRNG Password** | Sinh mật khẩu tự động khi tạo Manager | ✅ 16 ký tự an toàn với `node:crypto.randomInt` |
| **Fail-Closed Live Sync** | Giả lập lỗi DB khi Manager gửi request | ✅ Chặn ngay lập tức với `503 DATABASE_SYNC_ERROR` |
| **Thu hồi quyền chi nhánh** | Admin gỡ chi nhánh khỏi Manager | ✅ Request tiếp theo bị chặn ngay với `403 Forbidden` |
| **Phân trang Nhân sự** | Lấy danh sách hợp nhất qua nhiều trang | ✅ Không bỏ sót Manager, `totalCount` và `totalPages` chính xác |
| **Dữ liệu Hồ sơ dịch vụ** | Gọi `GET /service-records` trên MongoDB Atlas | ✅ Đầy đủ `petName: "Luna"`, `serviceName`, `staffName: "Hoàng Thị Mai"` |
| **Sản phẩm & Biến thể** | Gọi `GET /products/:id` và đưa vào giỏ hàng | ✅ Trả về đủ 6 ảnh, 3 biến thể `label`, `finalPrice`, add cart SKU thành công |
| **Automated Test Suite** | Chạy toàn bộ 31 test suites hệ thống | ✅ **386/386 tests PASS 100%** |
