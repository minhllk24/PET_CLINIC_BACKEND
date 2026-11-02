# BÁO CÁO TRIỂN KHAI VÀ HƯỚNG DẪN KẾT NỐI FRONTEND (FE HANDOFF)
## TASK 4.8: ADMIN CONTENT MANAGEMENT + REAL-DATA DASHBOARD & REPORTING (P1)

> **Dự án:** Hệ thống Chuỗi Phòng Khám & Thương Mại Điện Tử Thú Y Dr. Pet's House  
> **Nhánh Git:** `feat/foundation-v6`  
> **Backend Base URL (Local):** `http://localhost:5000/api/v1`  
> **Ngày hoàn thành:** 02/11/2026  
> **Trạng thái:** ✅ ĐÃ HOÀN TẤT TRIỂN KHAI, PASS 100% TEST SUITES (24/24 Suites, 326/326 Tests)

---

### MỤC LỤC
1. [TỔNG QUAN TRIỂN KHAI](#1-tổng-quan-triển-khai)
2. [HỆ THỐNG ENDPOINT CONTENT (BLOG & SƠ CỨU)](#2-hệ-thống-endpoint-content-blog--sơ-cứu)
3. [HỆ THỐNG ENDPOINT DIỄN ĐÀN CỘNG ĐỒNG (COMMUNITY POSTS)](#3-hệ-thống-endpoint-diễn-đàn-cộng-đồng-community-posts)
4. [HỆ THỐNG ENDPOINT CỨU HỘ & NHẬN NUÔI (RESCUE & ADOPTION)](#4-hệ-thống-endpoint-cứu-hộ--nhận-nuôi-rescue--adoption)
5. [HỆ THỐNG ENDPOINT DASHBOARD & BÁO CÁO THỰC TẾ](#5-hệ-thống-endpoint-dashboard--báo-cáo-thực-tế)
6. [QUY TẮC PHÂN QUYỀN RBAC & BẢO MẬT](#6-quy-tắc-phân-quyền-rbac--bảo-mật)
7. [DỮ LIỆU SEED MẪU SẴN SÀNG CHO FE TEST](#7-dữ-liệu-seed-mẫu-sẵn-sàng-cho-fe-test)
8. [HƯỚNG DẪN TÍCH HỢP CHO FRONTEND (ANGULAR & REACT)](#8-hướng-dẫn-tích-hợp-cho-frontend-angular--react)

---

### 1. TỔNG QUAN TRIỂN KHAI

Task 4.8 giải quyết trọn vẹn 2 mảng tính năng cốt lõi cho Admin và Khách hàng theo đúng tiêu chí: **"Lightweight Content Admin, không build full CMS rườm rà; Dashboard/Reporting dùng 100% dữ liệu thực từ MongoDB"**.

#### Các thành phần đã triển khai:
- **Phase 1: Schemas & Database Models**:
  - `Post.js`: Bài viết Blog (`OFFICIAL_BLOG`) và Cẩm nang sơ cứu khẩn cấp (`FIRST_AID`) có phân loại cấp độ nguy cấp, `emergencyPhone`, danh sách các bước sơ cứu (`steps`).
  - `CommunityPost.js`: Diễn đàn cộng đồng thành viên với quy trình kiểm duyệt `PENDING` ➔ `APPROVED` / `REJECTED` / `HIDDEN`, lưu vết kiểm duyệt và lý do từ chối.
  - `RescuePet.js`: Hồ sơ thú cưng cơ nhỡ tìm tổ ấm với mã định danh tự sinh `RESCUE-XXX-YYY`, tình trạng sức khỏe, tiêm phòng, trạng thái `LOOKING_FOR_HOME` vs `ADOPTED`.
  - `AdoptionRequest.js`: Đơn xin nhận nuôi thú cưng, tự động cập nhật trạng thái thú cưng sang `ADOPTED` ngay khi Admin/Manager phê duyệt đơn.
- **Phase 2: Content Services, Controllers & Routes**:
  - Tách bạch phân quyền giữa Public Route (`/api/v1/...`) và Admin Route (`/api/v1/admin/...`).
  - Tự động sinh SEO `slug` từ tiêu đề tiếng Việt chuẩn xác.
- **Phase 3: Real-Data Dashboard & Reporting Aggregation Engine**:
  - Doanh thu thuần tổng hợp từ Đơn hàng giao dịch thành công trừ tiền hoàn (`finalAmount - totalRefundedAmount`) cộng với Lịch hẹn khám hoàn tất.
  - Thống kê đơn hàng, lịch hẹn, khách hàng mới, cảnh báo tồn kho thấp (`quantity <= 5`) và dịch vụ được tin dùng nhất.
  - RBAC: `BRANCH_MANAGER` bị ràng buộc nghiêm ngặt chỉ được xem chi nhánh của mình (`assignedBranchIds`).
- **Phase 4: UAT Seed Dataset**:
  - Nạp sẵn 7 bài viết Blog & Sơ cứu, 4 bài viết diễn đàn, 3 hồ sơ thú cưng cứu hộ, 3 đơn xin nhận nuôi mẫu và tích hợp vào master seed `productionUatSeed.js`.

---

### 2. HỆ THỐNG ENDPOINT CONTENT (BLOG & SƠ CỨU)

#### 2.1. Phía Khách Hàng (Public)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/posts` | Public | Danh sách bài viết Blog (Query: `category`, `search`, `page`, `limit`) |
| `GET` | `/api/v1/posts/featured` | Public | Danh sách bài viết Blog nổi bật (`isFeatured: true`) |
| `GET` | `/api/v1/posts/trending` | Public | Danh sách bài viết Blog xem nhiều nhất |
| `GET` | `/api/v1/post-categories` | Public | Danh sách các danh mục bài viết hiện có |
| `GET` | `/api/v1/posts/:slug` | Public | Xem chi tiết bài viết Blog theo đường dẫn thân thiện SEO |
| `GET` | `/api/v1/first-aid/guides` | Public | Danh sách cẩm nang sơ cứu khẩn cấp (`postType = FIRST_AID`) |
| `GET` | `/api/v1/first-aid/guides/:slug` | Public | Chi tiết hướng dẫn sơ cứu từng bước (`steps`) và số Hotline cấp cứu |

#### 2.2. Phía Quản Trị (Admin & Branch Manager)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/admin/posts` | Admin / Manager | Quản lý bài viết (Lọc theo `status: DRAFT, PUBLISHED, ARCHIVED`, `postType`) |
| `GET` | `/api/v1/admin/posts/:id` | Admin / Manager | Xem chi tiết bài viết theo ObjectId |
| `POST` | `/api/v1/admin/posts` | Admin / Manager | Tạo bài viết Blog hoặc Cẩm nang sơ cứu mới |
| `PUT` | `/api/v1/admin/posts/:id` | Admin / Manager | Cập nhật toàn bộ nội dung bài viết |
| `PATCH` | `/api/v1/admin/posts/:id/status` | Admin / Manager | Đổi trạng thái bài viết (`DRAFT`, `PUBLISHED`, `ARCHIVED`) |
| `DELETE` | `/api/v1/admin/posts/:id` | Admin / Manager | Xóa bài viết |

##### Payload mẫu: Tạo Cẩm nang sơ cứu (POST `/api/v1/admin/posts`)
```json
{
  "title": "Cách sơ cứu chó mèo bị sốc nhiệt mùa nắng nóng",
  "postType": "FIRST_AID",
  "category": "Sơ cứu khẩn cấp",
  "excerpt": "Hạ nhiệt đúng cách khi thú cưng bị say nắng, thở dốc, co giật.",
  "content": "Sốc nhiệt mùa hè là trường hợp cấp cứu phổ biến...",
  "thumbnailUrl": "https://images.unsplash.com/photo-1543466835-00a7907e9de1",
  "isFeatured": true,
  "status": "PUBLISHED",
  "emergencyPhone": "1900-PET-HELP",
  "steps": [
    {
      "stepNumber": 1,
      "title": "Di chuyển vào bóng râm mát",
      "instruction": "Lập tức đưa bé vào phòng máy lạnh hoặc nơi có quạt gió thông thoáng."
    },
    {
      "stepNumber": 2,
      "title": "Lau ướt vùng đệm chân và bụng",
      "instruction": "Dùng khăn thấm nước mát (không dùng nước đá lạnh buốt) lau 4 đệm chân và vùng bẹn."
    }
  ]
}
```

---

### 3. HỆ THỐNG ENDPOINT DIỄN ĐÀN CỘNG ĐỒNG (COMMUNITY POSTS)

#### 3.1. Phía Khách Hàng (Customer)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/community/posts` | Public | Xem danh sách bài viết cộng đồng đã được duyệt (`APPROVED`) |
| `POST` | `/api/v1/community/posts` | Customer (Đăng nhập) | Đăng bài viết chia sẻ mới (Mặc định vào trạng thái `PENDING` chờ duyệt) |

##### Payload mẫu: Khách hàng đăng bài chia sẻ
```json
{
  "title": "Kinh nghiệm chăm sóc cún con sau khi tiêm phòng mũi đầu",
  "content": "Bé nhà mình sau khi tiêm hơi sốt nhẹ và ngủ nhiều, mình chườm ấm...",
  "imageUrls": [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb"
  ]
}
```

#### 3.2. Phía Quản Trị Kiểm Duyệt (Admin & Branch Manager)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/admin/community/posts` | Admin / Manager | Hàng đợi bài viết cộng đồng (Lọc: `PENDING`, `APPROVED`, `REJECTED`, `HIDDEN`) |
| `PATCH` | `/api/v1/admin/community/posts/:id/moderate` | Admin / Manager | Phê duyệt hoặc từ chối bài viết (`action: APPROVE / REJECT / HIDE`) |
| `DELETE` | `/api/v1/admin/community/posts/:id` | Admin / Manager | Xóa bài viết vi phạm nghiêm trọng |

##### Payload mẫu: Từ chối bài viết vi phạm (Bắt buộc có `rejectionReason`)
```json
{
  "action": "REJECT",
  "rejectionReason": "Bài viết chứa nội dung quảng cáo thương mại bán hàng trái quy định diễn đàn."
}
```

---

### 4. HỆ THỐNG ENDPOINT CỨU HỘ & NHẬN NUÔI (RESCUE & ADOPTION)

#### 4.1. Phía Khách Hàng (Customer)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/rescue/pets` | Public | Danh sách thú cưng đang tìm tổ ấm (`status: LOOKING_FOR_HOME` hoặc `ADOPTED`) |
| `GET` | `/api/v1/rescue/pets/:id` | Public | Xem hồ sơ chi tiết thú cưng cơ nhỡ (câu chuyện, sức khỏe, hình ảnh) |
| `POST` | `/api/v1/rescue/requests` | Public / Customer | Nộp đơn đăng ký xin nhận nuôi thú cưng |
| `GET` | `/api/v1/rescue/my-requests` | Customer (Đăng nhập) | Xem lại các đơn xin nhận nuôi của chính mình |

##### Payload mẫu: Nộp đơn xin nhận nuôi
```json
{
  "rescuePetId": "6ad08e4417bf41f5954234c9",
  "applicantInfo": {
    "fullName": "Nguyễn Văn An",
    "phone": "0987654321",
    "email": "an.nguyen@gmail.com",
    "address": "123 Lê Lợi, P. Bến Thành, Quận 1, TP.HCM",
    "housingType": "Nhà riêng có sân vườn rào kín",
    "hasPetExperience": true,
    "message": "Tôi rất yêu quý chó mèo và cam kết chăm sóc bé trọn đời."
  }
}
```

#### 4.2. Phía Quản Trị (Admin & Branch Manager)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/admin/rescue/pets` | Admin / Manager | Quản lý danh sách thú cưng cơ nhỡ (CRUD) |
| `POST` | `/api/v1/admin/rescue/pets` | Admin / Manager | Tạo hồ sơ thú cưng cơ nhỡ mới (Tự sinh mã `RESCUE-DOG-xxx`) |
| `PUT` | `/api/v1/admin/rescue/pets/:id` | Admin / Manager | Cập nhật hồ sơ thú cưng |
| `DELETE` | `/api/v1/admin/rescue/pets/:id` | Admin / Manager | Xóa hồ sơ thú cưng |
| `GET` | `/api/v1/admin/rescue/requests` | Admin / Manager | Quản lý danh sách đơn nhận nuôi (Lọc theo `status`, `rescuePetId`) |
| `PATCH` | `/api/v1/admin/rescue/requests/:id/review` | Admin / Manager | Xét duyệt đơn (`status: APPROVED / REJECTED`). **Nếu `APPROVED`, tự động đổi `RescuePet.status = 'ADOPTED'`** |

---

### 5. HỆ THỐNG ENDPOINT DASHBOARD & BÁO CÁO THỰC TẾ

> ⚠️ **Quy tắc cốt lõi:** 100% chỉ số hiển thị được tính toán trực tiếp từ dữ liệu thực tế trong MongoDB, không tạo số giả (mock/random).

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/summary` | Admin / Manager | Chỉ số tổng quan (Doanh thu thuần, Đơn hàng, Lịch hẹn, Khách hàng mới, Cảnh báo kho) |
| `GET` | `/api/v1/dashboard/revenue` | Admin / Manager | Biểu đồ doanh thu chi tiết (Tách bạch Doanh thu Sản phẩm vs Dịch vụ khám) |
| `GET` | `/api/v1/dashboard/low-stock` | Admin / Manager | Danh sách các sản phẩm đang có tồn kho nguy cấp (`quantity <= 5`) |
| `GET` | `/api/v1/dashboard/service-popularity` | Admin / Manager | Xếp hạng các dịch vụ khám/chữa/spa được đặt lịch nhiều nhất |

#### Query Parameters hỗ trợ cho Dashboard:
- `branchId` (Tùy chọn): Lọc số liệu theo chi nhánh cụ thể (Admin có thể bỏ trống để xem toàn chuỗi; Manager bắt buộc chỉ được lọc trong các branch mình phụ trách).
- `startDate` (ISO String, mặc định: 30 ngày trước).
- `endDate` (ISO String, mặc định: Hiện tại).

##### Response mẫu: `/api/v1/dashboard/summary`
```json
{
  "success": true,
  "data": {
    "filter": {
      "branchId": "6ad08e4417bf41f5954234c3",
      "startDate": "2026-10-01T00:00:00.000Z",
      "endDate": "2026-10-31T23:59:59.000Z"
    },
    "metrics": {
      "revenue": {
        "totalNetRevenue": 15450000,
        "productRevenue": 9200000,
        "serviceRevenue": 6250000,
        "currency": "VND"
      },
      "orders": {
        "total": 24,
        "deliveredOrCompleted": 18,
        "cancelled": 2
      },
      "appointments": {
        "total": 35,
        "completed": 28,
        "cancelled": 3
      },
      "customers": {
        "newRegistered": 12
      },
      "inventory": {
        "lowStockItemsCount": 3
      }
    }
  }
}
```

---

### 6. QUY TẮC PHÂN QUYỀN RBAC & BẢO MẬT

1. **Header yêu cầu**: Tất cả các route Admin/Manager bắt buộc truyền header:
   ```http
   Authorization: Bearer <access_token>
   ```
2. **Quy tắc phân vùng chi nhánh của Dashboard**:
   - Tài khoản có `systemRole: 'ADMIN'`: Có toàn quyền xem dữ liệu tổng hợp toàn hệ thống hoặc chọn từng chi nhánh.
   - Tài khoản có `systemRole: 'MANAGER'`: Hệ thống tự động kiểm tra `actor.assignedBranchIds`.
     - Nếu `branchId` gửi lên không nằm trong danh sách chi nhánh được phân công ➔ Trả về lỗi `403 Forbidden` (`FORBIDDEN_BRANCH_ACCESS`).
     - Nếu Manager không truyền `branchId` ➔ Backend tự động giới hạn phạm vi tính toán trong các chi nhánh mà Manager đó phụ trách.

---

### 7. DỮ LIỆU SEED MẪU SẴN SÀNG CHO FE TEST

Hệ thống đã có sẵn lệnh nạp seed dữ liệu mẫu hoàn chỉnh:
```bash
npm run seed:content
```
Dữ liệu đã được nạp sẵn bao gồm:
1. **Bài viết Blog**:
   - `lich-tiem-phong-vac-xin-dinh-ky-cho-cho-meo` (`isFeatured: true`, `isTrending: true`)
   - `dinh-duong-can-bang-cho-thu-cung-theo-tung-do-tuoi` (`isFeatured: true`)
   - `dau-hieu-nhan-biet-va-phong-ngua-ve-ran-bo-chet-o-thu-cung`
   - `bi-quyet-cham-soc-long-va-ve-sinh-tai-mat-cho-meo-cung-tai-nha` (`status: DRAFT`)
2. **Cẩm nang sơ cứu khẩn cấp**:
   - `cach-so-cuu-cho-meo-bi-hoc-di-vat-khan-cap` (`urgencyLevel: CRITICAL`, Hotline: `1900-PET-HELP`)
   - `xu-ly-khan-cap-khi-thu-cung-bi-ngo-doc-thuc-pham-la-hoac-hoa-chat`
   - `huong-dan-bang-bo-va-cam-mau-vet-thuong-ho-cho-thu-cung`
3. **Thú cưng cứu hộ**:
   - `RESCUE-DOG-001` (Bé Đậu, Chó cỏ lai, `LOOKING_FOR_HOME`)
   - `RESCUE-CAT-002` (Bé Mây, Mèo tam thể, `LOOKING_FOR_HOME`)
   - `RESCUE-DOG-003` (Bé Vàng, Chó Vàng Phú Quốc, `ADOPTED`)
4. **Đơn xin nhận nuôi**:
   - `ADOPT-REQ-001` (`PENDING`)
   - `ADOPT-REQ-002` (`APPROVED`)
   - `ADOPT-REQ-003` (`REJECTED` kèm lý do phòng trọ không an toàn)

---

### 8. HƯỚNG DẪN TÍCH HỢP CHO FRONTEND (ANGULAR & REACT)

#### Khuyến nghị cho Angular Shell:
1. **Quản lý Content**: Tạo `ContentService` gọi tới `/api/v1/admin/posts` và `/api/v1/posts`.
2. **Kiểm duyệt Diễn đàn**: Tạo giao diện `CommunityModerationComponent` hiển thị danh sách Tabs `PENDING (3)`, `APPROVED`, `REJECTED`. Khi bấm nút Từ chối, mở Modal yêu cầu nhập `rejectionReason` trước khi gọi PATCH `/moderate`.
3. **Hồ sơ Cứu hộ**: Hiển thị Badge `Chưa có tổ ấm` (Xanh lục) vs `Đã có tổ ấm` (Xám). Cung cấp nút Xem các đơn xin nhận nuôi gắn với từng bé.
4. **Dashboard**: Gắn bộ lọc ngày (DateRangePicker) và Dropdown Chi nhánh (`BranchSelect`). Gọi API `/api/v1/dashboard/summary` để cập nhật đồng thời 5 Cards thống kê (Doanh thu, Đơn hàng, Lịch hẹn, Khách mới, Cảnh báo kho).
