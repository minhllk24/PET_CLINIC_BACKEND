# TÀI LIỆU BÀN GIAO FRONTEND (FE HANDOFF)
## Nghiệm Thu & Tích Hợp Toàn Diện Admin Dashboard M23 (`DASH-BE-01` → `DASH-BE-10`)

> **Kính gửi:** Đội ngũ Phát triển Frontend (`DR_PETS_HOUSE_ANGULAR` / Web Admin) & QA  
> **Tài liệu căn cứ:** [`docs/WEB2_YEU_CAU_BE_HOAN_THIEN_ADMIN_DASHBOARD_M23_2026-11-09.docx`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/WEB2_YEU_CAU_BE_HOAN_THIEN_ADMIN_DASHBOARD_M23_2026-11-09.docx) (`UAT-01` → `UAT-18`, `DASH-BE-01` → `DASH-BE-10`)  
> **Trạng thái:** ✅ **HOÀN TẤT TRIỂN KHAI – OPENAPI ĐÃ ĐỒNG BỘ – 109/109 TEST PASS – ĐÃ SEED UAT & ĐỐI SOÁT TRỰC TIẾP TRÊN MONGODB**  
> **Ngày bàn giao:** 11/11/2026  
> **Nhánh Git:** `feat/foundation-v6`  
> **OpenAPI đồng bộ:** [`docs/07-openapi-v6.yaml`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/07-openapi-v6.yaml) & [`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml)

---

### MỤC LỤC
1. [Tổng Quan Phạm Vi Triển Khai (`DASH-BE-01` → `DASH-BE-10`)](#1-tổng-quan-phạm-vi-triển-khai-dash-be-01--dash-be-10)
2. [Đặc Tả Chi Tiết 5 Endpoint Dashboard M23](#2-đặc-tả-chi-tiết-5-endpoint-dashboard-m23)
   - [2.1 `GET /summary`](#21-get-summary)
   - [2.2 `GET /revenue-analytics`](#22-get-revenue-analytics)
   - [2.3 `GET /low-stock`](#23-get-low-stock)
   - [2.4 `GET /service-stats`](#24-get-service-stats)
   - [2.5 `GET /attention`](#25-get-attention)
3. [Clickthrough Filtering Trên `GET /orders` & `GET /appointments` (`DASH-BE-07`)](#3-clickthrough-filtering-trên-get-orders--get-appointments-dash-be-07)
4. [Bảng Status Catalogs Chuẩn Hệ Thống](#4-bảng-status-catalogs-chuẩn-hệ-thống)
5. [Quy Tắc Kế Toán, Múi Giờ `Asia/Ho_Chi_Minh` (`+07:00`) & RBAC (`400/401/403/404`)](#5-quy-tắc-kế-toán-múi-giờ-asiahо_chi_minh-0700--rbac-400401403404)
6. [JSON Mẫu Đối Soát Thực Tế Trên MongoDB (Đã Mask PII)](#6-json-mẫu-đối-soát-thực-tế-trên-mongodb-đã-mask-pii)
7. [Hướng Dẫn Seed UAT & Chạy Kiểm Thử Tự Động](#7-hướng-dẫn-seed-uat--chạy-kiểm-thử-tự-động)

---

## 1. Tổng Quan Phạm Vi Triển Khai (`DASH-BE-01` → `DASH-BE-10`)

Toàn bộ API Dashboard được mount song song trên cả 2 prefix trong [`src/app.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/app.js#L909-L910):
- **Primary:** `/api/v1/dashboard/*`
- **Admin Alias:** `/api/v1/admin/dashboard/*`

Tất cả route dashboard đi qua middleware `requireRole(['ADMIN', 'MANAGER'])` và live-sync phân quyền chi nhánh từ MongoDB (Fail-Closed cho `MANAGER`/`STAFF` trong [`authMiddleware.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/shared/authMiddleware.js#L40-L71)).

| Hạng mục | Yêu cầu cốt lõi | File Backend triển khai | Trạng thái |
| :--- | :--- | :--- | :---: |
| **DASH-BE-01** | Chuẩn hóa `resolveVnDateRange` (`+07:00`), kỳ trước, 4 mức `granularity`, max `366` ngày | [`dashboard.utils.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.utils.js) | ✅ Done |
| **DASH-BE-02** | RBAC đa chi nhánh + đơn chi nhánh theo thứ tự `400 -> 403 -> 404` | [`dashboard.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.service.js#L49-L100) | ✅ Done |
| **DASH-BE-03** | Doanh thu thuần khớp tuyệt đối đến 1 VND giữa `/summary` và `/revenue-analytics`, hỗ trợ số âm (`UAT-18`) | [`dashboard.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.service.js#L259-L426) | ✅ Done |
| **DASH-BE-04** | KPI `orders`, `appointments`, `activeCustomers` + trend + `*CountsByStatus` + `statusCatalog` + giữ legacy keys | [`dashboard.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.service.js#L781-L947) | ✅ Done |
| **DASH-BE-05** | Top dịch vụ hoàn thành `/service-stats` theo `executionCompletedAt ?? completedAt ?? updatedAt` + `revenue: null` | [`dashboard.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.service.js#L1020-L1091) | ✅ Done |
| **DASH-BE-06** | Cảnh báo tồn kho `/low-stock` dùng chung `queryLowStockData` với `/summary`, phân biệt `thresholdConfigured` & `MATERIAL` | [`dashboard.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.service.js#L643-L774) | ✅ Done |
| **DASH-BE-07** | Đồng bộ clickthrough `GET /orders` & `GET /appointments` theo ngày VN `+07:00` & branch scope | [`order.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/order/order.service.js#L649-L728)<br>[`booking.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/booking/booking.service.js#L1099-L1155) | ✅ Done |
| **DASH-BE-08** | Endpoint mới `GET /attention` cho đơn tồn đọng & lịch hẹn trong 24h tới (bỏ qua `from`/`to`, giữ RBAC chi nhánh) | [`dashboard.routes.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.routes.js#L22-L23)<br>[`dashboard.controller.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/dashboard/dashboard.controller.js#L39-L46) | ✅ Done |
| **DASH-BE-09** | Bổ sung `Appointment.completedAt`, hook tự gán khi execution hoàn tất, 9 compound indexes dashboard | [`Appointment.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/booking/models/Appointment.js#L106-L119)<br>[`execution.service.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/modules/execution/execution.service.js#L1133-L1136) | ✅ Done |
| **DASH-BE-10** | OpenAPI `v6`/`v7`, seed UAT cô lập (`npm run seed:dashboard-uat`), E2E Real MongoDB & Mocked Unit Suite | [`dashboardUatSeed.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/seeds/dashboardUatSeed.js)<br>[`dashboard-m23-e2e.test.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/tests/dashboard-m23-e2e.test.js) | ✅ Done |

---

## 2. Đặc Tả Chi Tiết 5 Endpoint Dashboard M23

> **Headers bắt buộc cho mọi endpoint Dashboard:**  
> `Authorization: Bearer <accessToken>` (vai trò `ADMIN` hoặc `MANAGER`)

### Quy tắc Query thời gian & chi nhánh dùng chung (trừ `/low-stock` & `/attention`)
| Query Param | Kiểu | Bắt buộc | Mặc định | Quy tắc Validation |
| :--- | :--- | :---: | :--- | :--- |
| `branchId` | `string` (ObjectId 24 hex) | Không | Tổng hợp theo quyền actor | `ADMIN`: bỏ trống = toàn hệ thống (`branchIds: []`), truyền ID = lọc 1 chi nhánh (`404` nếu không tồn tại).<br>`MANAGER`: bỏ trống = union `assignedBranchIds`, truyền ID = phải thuộc `assignedBranchIds` (`403` nếu ngoài scope). |
| `preset` | `enum` | Không | `30d` | Một trong: `today`, `7d`, `30d`, `this_week`, `this_month`, `this_year`. Bị bỏ qua nếu có `from` & `to`. |
| `from` | `string` (`YYYY-MM-DD`) | Đi kèm `to` | Theo `preset` | Phải truyền **đồng thời** cả `from` và `to` (thiếu 1 trong 2 -> `400`). Lịch hợp lệ và `from <= to`, tối đa `366` ngày. |
| `to` | `string` (`YYYY-MM-DD`) | Đi kèm `from` | Theo `preset` | Ví dụ `2026-10-13` đến `2026-11-11` = `30` ngày bao gồm cả ngày đầu và ngày cuối theo giờ VN. |
| `timezone` | `string` | Không | `Asia/Ho_Chi_Minh` | Chỉ hỗ trợ `Asia/Ho_Chi_Minh`. Giá trị khác -> `400 VALIDATION_ERROR`. |

**Quy tắc tự động chọn `granularity` theo số ngày (`days`):**
- `days === 1`: `hour` (24 điểm: `YYYY-MM-DDTHH:00:00+07:00`)
- `2 <= days <= 31`: `day` (`YYYY-MM-DD`)
- `32 <= days <= 180`: `week` (`YYYY-MM-DD` ngày đầu mỗi block 7 ngày tính từ `from`)
- `181 <= days <= 366`: `month` (`YYYY-MM-01`)

---

### 2.1 `GET /summary`

- **Paths:** `GET /api/v1/dashboard/summary` hoặc `GET /api/v1/admin/dashboard/summary`
- **Query Params:** `branchId`, `preset`, `from`, `to`, `timezone`
- **Response Schema (`200 OK`, bọc trong `{ success: true, data }`):**

```typescript
export interface DashboardKpiTrendPoint {
  periodStart: string; // YYYY-MM-DD | YYYY-MM-DDTHH:00:00+07:00 | YYYY-MM-01
  value: number;
}

export interface DashboardKpiMetric {
  current: number;
  previous: number;
  delta: number;               // current - previous (có thể âm)
  changePercent: number | null; // null nếu previous <= 0; ngược lại round 2 chữ số thập phân
  currency?: 'VND';            // Chỉ có trên kpis.revenue
  trend: DashboardKpiTrendPoint[];
}

export interface DashboardSummaryData {
  range: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    granularity: 'hour' | 'day' | 'week' | 'month';
    timezone: 'Asia/Ho_Chi_Minh';
    branchIds: string[]; // [] khi ADMIN xem toàn hệ thống
  };
  kpis: {
    revenue: DashboardKpiMetric;
    orders: DashboardKpiMetric;
    appointments: DashboardKpiMetric;
    activeCustomers: DashboardKpiMetric;
  };
  orderCountsByStatus: Record<'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED', number>;
  appointmentCountsByStatus: Record<'PENDING_PAYMENT' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW', number>;
  statusCatalog: {
    order: Array<{ code: string; label: string; tone: string; group: string }>;
    appointment: Array<{ code: string; label: string; tone: string; group: string }>;
    payment: Array<{ code: string; label: string; scope: string }>;
  };
  // Legacy root keys (được giữ để tương thích ngược, giá trị đã chuẩn hóa khớp kpis)
  orders: number;
  appointments: number;
  revenue: { amount: number; currency: 'VND' };
  newCustomers: number;
  lowStockItems: number; // Luôn bằng GET /low-stock -> data.total
  breakdown: {
    commerceRevenue: number;  // orderRevenue + refundAdjustment
    clinicRevenue: number;    // === serviceRevenue
    orderRevenue: number;     // >= 0
    serviceRevenue: number;   // >= 0
    refundAdjustment: number; // <= 0
    orderCountsByStatus: Record<string, number>;
    appointmentCountsByStatus: Record<string, number>;
    timeRange: {
      startDate: string; // ISO UTC (= from 00:00:00.000+07:00)
      endDate: string;   // ISO UTC exclusive (= (to+1) 00:00:00.000+07:00)
    };
  };
}
```

---

### 2.2 `GET /revenue-analytics`

- **Paths:** `GET /api/v1/dashboard/revenue-analytics` hoặc `GET /api/v1/admin/dashboard/revenue-analytics`
- **Query Params:** `branchId`, `preset`, `from`, `to`, `timezone`
- **Bất biến tích hợp FE:**  
  1. `totalRevenue === summary.kpis.revenue.current`  
  2. $\sum \text{points[i].totalRevenue} \equiv \text{totalRevenue}$ đến chính xác `1 VND`  
  3. Cả `point.totalRevenue` lẫn `totalRevenue` **không bị clamp về 0** (`>= 0` không bắt buộc — có thể âm khi tiền hoàn vượt doanh thu bán trong bucket/kỳ).

```typescript
export interface RevenueAnalyticsPoint {
  periodStart: string;
  orderRevenue: number;
  serviceRevenue: number;
  refundAdjustment: number; // Số âm (hoặc 0)
  totalRevenue: number;     // orderRevenue + serviceRevenue + refundAdjustment
}

export interface DashboardRevenueAnalyticsData {
  currency: 'VND';
  granularity: 'hour' | 'day' | 'week' | 'month';
  range: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    timezone: 'Asia/Ho_Chi_Minh';
    branchIds: string[];
  };
  totalRevenue: number;
  previousRevenue: number;
  delta: number;
  changePercent: number | null;
  totals: {
    orderRevenue: number;
    serviceRevenue: number;
    refundAdjustment: number;
  };
  points: RevenueAnalyticsPoint[];
}
```

---

### 2.3 `GET /low-stock`

- **Paths:** `GET /api/v1/dashboard/low-stock` hoặc `GET /api/v1/admin/dashboard/low-stock`
- **Query Params:**
  - `branchId` (optional)
  - `limit`: integer `1..20`, **mặc định `10`** (nếu truyền `> 20` sẽ tự kẹp về `20`; truyền `< 1` hoặc không phải số nguyên dương -> `400`).
- **Quy tắc lọc & sắp xếp:**
  - Chỉ tính các `Branch` đang `ACTIVE` và `InventoryItem` đang `ACTIVE`.
  - Bản ghi thuộc danh sách cảnh báo khi: `quantity === 0` (`status: 'OUT_OF_STOCK'`) **HOẶC** (`thresholdConfigured === true` và `quantity <= lowStockThreshold`, `status: 'LOW_STOCK'`).
  - Sắp xếp theo mức độ nghiêm trọng tăng dần: `OUT_OF_STOCK` (`quantity === 0`) lên trước → `quantity` tăng dần → `sku` A-Z → `branchName` A-Z.
  - `unconfiguredCount`: Đếm số `InventoryStock` còn hàng (`quantity > 0`) nhưng chưa cấu hình ngưỡng (`thresholdConfigured !== true`) để FE hiển thị nhắc nhở vận hành nếu cần.
  - `imageUrl`: Tự động resolve cho `kind === 'PRODUCT'` theo thứ tự `variant.image` → ảnh `isPrimary` của `Product` → ảnh đầu tiên; **luôn trả `null`** cho `kind === 'MATERIAL'`.

```typescript
export interface LowStockAlertItem {
  stockId: string;
  inventoryItemId: string;
  branchId: string;
  branchName: string;
  branchCode: string | null;
  sku: string;
  name: string;
  unit: string;
  kind: 'PRODUCT' | 'MATERIAL';
  imageUrl: string | null;
  quantity: number;
  lowStockThreshold: number;
  threshold: number; // Alias tương thích
  thresholdConfigured: boolean;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface DashboardLowStockData {
  total: number;             // Luôn bằng summary.lowStockItems
  unconfiguredCount: number;
  items: LowStockAlertItem[];
}
```

---

### 2.4 `GET /service-stats`

- **Paths:** `GET /api/v1/dashboard/service-stats` hoặc `GET /api/v1/admin/dashboard/service-stats`
- **Query Params:** `branchId`, `preset`, `from`, `to`, `timezone`, `limit` (`1..10`, **mặc định `5`**)
- **Quy tắc thống kê:**
  - Loại trừ `Appointment` có `status` thuộc `['CANCELLED', 'NO_SHOW']`.
  - Unwind từng phân đoạn trong `services[]` có `executionStatus === 'COMPLETED'` (kể cả khi lịch hẹn tổng đang `IN_PROGRESS`), lọc mốc hoàn thành phân đoạn theo `services.executionCompletedAt ?? completedAt ?? updatedAt` trong khoảng `[startUtc, endExclusiveUtc)`.
  - Sắp xếp theo `completedCount` giảm dần → `name` A-Z → `serviceId` tăng dần.
  - Trường `revenue` cố định trả `null` (theo hợp đồng dữ liệu: không chia doanh thu giả định khi lịch hẹn có nhiều phân đoạn dịch vụ và voucher cấp đơn).

```typescript
export interface DashboardServiceStatItem {
  serviceId: string | null;
  name: string;
  serviceType: 'MEDICAL' | 'GROOMING' | string;
  completedCount: number;
  revenue: null;
}

export interface DashboardServiceStatsData {
  range: {
    from: string;
    to: string;
    timezone: 'Asia/Ho_Chi_Minh';
    branchIds: string[];
  };
  items: DashboardServiceStatItem[];
}
```

---

### 2.5 `GET /attention`

- **Paths:** `GET /api/v1/dashboard/attention` hoặc `GET /api/v1/admin/dashboard/attention`
- **Query Params:**
  - `branchId` (optional, áp dụng RBAC chi nhánh bình thường)
  - `limit`: integer `1..10`, **mặc định `5`** (áp dụng độc lập cho từng danh sách `orders` và `appointments`)
  - `includeShipped`: `'true' | 'false'`, **mặc định `'false'`**
- **Lưu ý nghiệp vụ quan trọng:** Endpoint này **chủ động bỏ qua bộ lọc `from`/`to`/`preset`** vì luôn phản ánh **hiện trạng vận hành ngay lúc này** (đơn tồn đọng từ các kỳ trước vẫn phải hiện để Admin/Manager xử lý).
  - **`orders`**: Lọc `status` trong `['PENDING', 'CONFIRMED', 'PROCESSING']` (thêm `'SHIPPED'` nếu `includeShipped=true`), sort `createdAt: 1` (đơn lâu nhất chưa xử lý lên đầu). `ordersTotal` là tổng đếm toàn bộ backlog theo chi nhánh.
  - **`appointments`**: Lọc `status` trong `['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS']` và `now <= scheduledStart <= now + 24h`, sort `scheduledStart: 1`.
  - **Lưu ý hiển thị tên khách hàng:** API thực tế trả nguyên tên snapshot từ `contactSnapshot`/`customerSnapshot` (fallback `'Khách hàng'`) để Admin/Manager vận hành liên hệ; riêng trong các mẫu JSON ở Mục 6 tài liệu này đã mask PII khi bàn giao.

```typescript
export interface AttentionOrderItem {
  id: string;
  code: string;
  customerName: string;
  totalAmount: number;
  createdAt: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED';
  branchId: string | null;
  branchName: string | null;
}

export interface AttentionAppointmentItem {
  id: string;
  code: string;
  customerName: string;
  petName: string | null;
  scheduledStart: string | null;
  status: 'PENDING_PAYMENT' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS';
  serviceType: string;
  branchId: string | null;
  branchName: string | null;
}

export interface DashboardAttentionData {
  branchIds: string[];
  ordersTotal: number;
  appointmentsTotal: number;
  orders: AttentionOrderItem[];
  appointments: AttentionAppointmentItem[];
}
```

---

## 3. Clickthrough Filtering Trên `GET /orders` & `GET /appointments` (`DASH-BE-07`)

Khi người dùng click vào KPI Card (`orders`, `appointments`), Status Pill (`orderCountsByStatus`, `appointmentCountsByStatus`) hoặc dòng cảnh báo trên Dashboard, FE điều hướng sang màn hình Quản lý Đơn hàng / Lịch hẹn và gọi API danh sách với các query param đã được chuẩn hóa dưới đây (OpenAPI `v6` & `v7` đã cập nhật cho phép truyền `YYYY-MM-DD`).

### 3.1 `GET /api/v1/orders`
- **Query params hỗ trợ:**
  - `status`: `PENDING | CONFIRMED | PROCESSING | SHIPPED | COMPLETED | CANCELLED`
  - `branchId` (hoặc `fulfillmentBranchId`): ObjectId chi nhánh
  - `from` & `to` (alias: `dateFrom`/`dateTo`, `startDate`/`endDate`): Hỗ trợ `YYYY-MM-DD` (tính theo nửa khoảng VN `[from 00:00:00+07:00, (to+1) 00:00:00+07:00)` trên trường `createdAt`) hoặc ISO `date-time`.
  - `code`, `search`, `customerId`, `cursor`, `limit` (`1..100`, mặc định `20`)
- **RBAC:** `STAFF` và `MANAGER` bị giới hạn trong chi nhánh được gán; nếu truyền `branchId` ngoài quyền -> trả **`403 BRANCH_SCOPE_ERROR`**.
- **Response `200`:** `{ success: true, data: { items, totalCount, nextCursor } }`
- **Ví dụ URL clickthrough từ pill *"Đơn COMPLETED trong kỳ tại Q1"*:**
  ```
  GET /api/v1/orders?status=COMPLETED&branchId=6ad08e4417bf41f5954234c3&from=2026-10-13&to=2026-11-11&limit=20
  ```

### 3.2 `GET /api/v1/appointments`
- **Phân biệt lọc theo ngày hẹn vs ngày tạo (rất quan trọng để khớp số KPI Dashboard!):**
  - Mặc định khi chỉ truyền `from` / `to`: API giữ tương thích lịch cũ — lọc trên `scheduledStart`.
  - Khi clickthrough từ KPI Dashboard (`appointments` / `appointmentCountsByStatus` vốn đếm theo **`createdAt`**): FE **truyền thêm `dateField=createdAt`** (cùng `from` & `to` `YYYY-MM-DD`) **HOẶC** truyền trực tiếp `createdFrom` & `createdTo` (`YYYY-MM-DD`). Backend sẽ chuyển sang lọc `createdAt` theo nửa khoảng VN `+07:00`.
- **Query params hỗ trợ:** `status`, `branchId`, `customerId`, `dateField` (`createdAt` | `scheduledStart`), `createdFrom`, `createdTo`, `from`, `to`, `limit` (`1..100`, mặc định `20`).
- **RBAC:** `RECEPTIONIST` và `MANAGER` bị khóa trong chi nhánh được gán (`MANAGER` không có chi nhánh hoặc truyền `branchId` ngoài scope -> **`403 BRANCH_SCOPE_ERROR`**).
- **Response `200`:** `{ success: true, data: { items, nextCursor } }`
- **Ví dụ URL clickthrough từ pill *"Lịch hẹn CONFIRMED tạo trong kỳ"*:**
  ```
  GET /api/v1/appointments?status=CONFIRMED&dateField=createdAt&from=2026-10-13&to=2026-11-11&branchId=6ad08e4417bf41f5954234c3&limit=20
  ```

---

## 4. Bảng Status Catalogs Chuẩn Hệ Thống

FE nên đọc động từ `summary.data.statusCatalog` hoặc dùng đúng bảng mapping sau để tránh lệch label/màu:

### 4.1 Order Status (`statusCatalog.order`)
| `code` | `label` | `tone` | `group` | Ý nghĩa trên Dashboard |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING` | Chờ xác nhận | `amber` | `ACTIVE` | Tính trong `orders`, vào `/attention` |
| `CONFIRMED` | Đã xác nhận | `blue` | `ACTIVE` | Tính trong `orders`, vào `/attention` |
| `PROCESSING` | Đang xử lý | `indigo` | `ACTIVE` | Tính trong `orders`, vào `/attention` |
| `SHIPPED` | Đang giao | `teal` | `IN_TRANSIT` | Tính trong `orders`, vào `/attention` nếu `includeShipped=true` |
| `COMPLETED` | Hoàn thành | `green` | `TERMINAL_SUCCESS` | Đóng góp `orderRevenue` theo `deliveredAt` |
| `CANCELLED` | Đã hủy | `red` | `TERMINAL_CANCELLED` | Có mặt trong `orderCountsByStatus`, không cộng `orderRevenue`, không tính `activeCustomers` |

### 4.2 Appointment Status (`statusCatalog.appointment`)
| `code` | `label` | `tone` | `group` | Ý nghĩa trên Dashboard |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING_PAYMENT` | Chờ thanh toán | `amber` | `ACTIVE` | Tính trong `appointments`, vào `/attention` nếu trong 24h |
| `PENDING_CONFIRMATION` | Chờ xác nhận | `amber` | `ACTIVE` | Tính trong `appointments`, vào `/attention` nếu trong 24h |
| `CONFIRMED` | Đã xác nhận | `blue` | `ACTIVE` | Tính trong `appointments`, vào `/attention` nếu trong 24h |
| `IN_PROGRESS` | Đang thực hiện | `indigo` | `ACTIVE` | Có thể có phân đoạn `COMPLETED` vào `/service-stats` |
| `COMPLETED` | Hoàn tất | `green` | `TERMINAL_SUCCESS` | Đóng góp `serviceRevenue` theo `completedAt` |
| `CANCELLED` | Đã hủy | `red` | `TERMINAL_CANCELLED` | Không tính `serviceRevenue` và không tính `activeCustomers` |
| `NO_SHOW` | Vắng mặt | `slate` | `TERMINAL_CANCELLED` | Bị loại khỏi `/service-stats` |

### 4.3 Payment Status (`statusCatalog.payment`)
| `code` | `label` | `scope` |
| :--- | :--- | :--- |
| `PENDING` | Chờ thanh toán | `TRANSACTION` |
| `PAID` | Đã thanh toán | `TRANSACTION` |
| `FAILED` | Thanh toán thất bại | `TRANSACTION` |
| `CANCELLED` | Đã hủy giao dịch | `TRANSACTION` |
| `EXPIRED` | Hết hạn thanh toán | `TRANSACTION` |
| `REFUND_PENDING` | Chờ hoàn tiền | `REFUND` |
| `REFUNDED` | Đã hoàn tiền | `REFUND` |

---

## 5. Quy Tắc Kế Toán, Múi Giờ `Asia/Ho_Chi_Minh` (`+07:00`) & RBAC (`400/401/403/404`)

### 5.1 Công thức Kế toán chính xác đến `1 VND`
1. **`orderRevenue`** (từ `Order` có `status === 'COMPLETED'`):
   - Mốc thời gian ghi nhận: `deliveredAt ?? thời điểm cuối chuyển COMPLETED trong statusHistory ?? updatedAt`.
   - Số tiền: Tổng `lineNet` (loại `shippingFee`); nếu voucher cấp đơn chưa phân bổ (`allocatedDiscount === 0`) và không phải `FREESHIP` (tức `voucher.code !== 'FREESHIP'` và `voucherDiscount !== shippingFee`) thì trừ `voucherDiscount`.
2. **`serviceRevenue`** (từ `Appointment` có `status === 'COMPLETED'`):
   - Mốc thời gian ghi nhận: `completedAt ?? max(services.executionCompletedAt) ?? updatedAt`.
   - Số tiền: `pricing.finalAmount ?? pricing.subtotal ?? 0` (chỉ tính 1 lần tại thời điểm lịch hẹn hoàn tất, không cộng trùng tiền đặt cọc 30% + 70% còn lại).
3. **`refundAdjustment`** (từ `OrderRefund` có `status === 'REFUNDED'`):
   - Mốc thời gian ghi nhận: `refundedAt`.
   - Guard đối soát đơn: Chỉ khấu trừ khi `orderDoc.status === 'COMPLETED'` hoặc `cause === 'RETURN'` (đơn hủy `CANCELLED` trước giao không bị trừ oan vào doanh thu).
   - Loại trừ tiền ship hoàn: $\text{netRefund} = \max(0, \text{OrderRefund.amount} - \text{OrderReturn.refundBreakdown.shippingRefunded})$.
   - Trả về giá trị âm (hoặc `0`, đã chuẩn hóa không bao giờ ra `-0`).
4. **Doanh thu thuần (`totalRevenue`):**
   $$\text{totalRevenue} = \text{orderRevenue} + \text{serviceRevenue} + \text{refundAdjustment}$$
   - **Không dùng `Math.max(0, ...)`:** Nếu ngày/kỳ chỉ phát sinh hoàn trả lớn hơn tiền bán thì trả đúng số âm (`UAT-18`).
5. **`activeCustomers`:** Số lượng `customerId` (`!= null`) **distinct** phát sinh ít nhất 1 `Order` hoặc `Appointment` (`status !== 'CANCELLED'`) có `createdAt` nằm trong kỳ.

### 5.2 Format lỗi RFC 9457 (`application/problem+json`) & Ma trận RBAC
Mọi lỗi từ Middleware/Service trả Content-Type `application/problem+json` với cấu trúc thống nhất từ [`errorHandler.js`](file:///d:/A1.%20Lap%20Trinh%20Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/src/shared/errorHandler.js#L119-L135):
```json
{
  "type": "https://httpstatuses.com/403",
  "title": "Forbidden",
  "status": 403,
  "code": "BRANCH_ACCESS_DENIED",
  "correlationId": "uuid-v4",
  "detail": "You do not have access to this branch",
  "instance": "/api/v1/dashboard/summary?branchId=..."
}
```

Thứ tự kiểm tra bảo mật cố định **`400 -> 403 -> 404`** (đảm bảo `MANAGER` không dò được ObjectId chi nhánh không thuộc quyền):

| HTTP | Error `code` | Điều kiện kích hoạt | Khuyến nghị xử lý FE |
| :---: | :--- | :--- | :--- |
| **`401`** | `AUTHENTICATION_ERROR` / `TOKEN_EXPIRED` | Thiếu Bearer token, token sai, user bị xóa hoặc JWT hết hạn | Refresh token hoặc điều hướng trang Login |
| **`400`** | `VALIDATION_ERROR` | `branchId` sai định dạng ObjectId; thiếu 1 trong `from`/`to`; `from > to`; khoảng `> 366` ngày; `preset` hoặc `timezone !== 'Asia/Ho_Chi_Minh'`; `limit < 1` | Reset bộ lọc hợp lệ & toast cảnh báo nhập liệu |
| **`403`** | `AUTHORIZATION_ERROR` / `FORBIDDEN` | Vai trò là Guest, `CUSTOMER`, `STAFF` gọi API Dashboard | Ẩn menu Admin Dashboard / chuyển về trang 403 |
| **`403`** | `BRANCH_SCOPE_EMPTY` | Tài khoản `MANAGER` chưa được gán chi nhánh nào trong `assignedBranchIds` | Hiển thị empty state *"Tài khoản chưa được phân quyền chi nhánh"* |
| **`403`** | `BRANCH_ACCESS_DENIED` *(dashboard)*<br>`BRANCH_SCOPE_ERROR` *(orders/appointments)* | `MANAGER`/`STAFF`/`RECEPTIONIST` truyền `branchId` không nằm trong chi nhánh được gán | Reset dropdown chi nhánh về phạm vi được phép |
| **`403`** | `ACCOUNT_BLOCKED` / `ACCOUNT_NOT_ACTIVATED` | Tài khoản đang bị khóa hoặc chưa kích hoạt | Logout & thông báo trạng thái tài khoản |
| **`404`** | `BRANCH_NOT_FOUND` | Chỉ xảy ra với **`ADMIN`** khi truyền `branchId` đúng 24 ký tự hex nhưng không có trong DB | Bỏ chọn chi nhánh đã xóa & tải lại danh sách `GET /branches` |

---

## 6. JSON Mẫu Đối Soát Thực Tế Trên MongoDB (Đã Mask PII)

Kết quả dưới đây được trích nguyên trạng từ script đối soát trực tiếp trên database `pet_clinic_v2` sau khi chạy `npm run seed:dashboard-uat` cho cửa sổ **`preset=30d` (`2026-10-13` → `2026-11-11`, kỳ trước `2026-09-13` → `2026-10-12`)**:

### 6.1 Bảng tổng hợp 5 kiểm tra đối soát (`true` 100% ở cả 3 actor)
| Actor / Scope | `revenue.current` (prev / delta / %) | `orderRevenue` / `serviceRevenue` / `refundAdjustment` | `orders.current` | `appointments.current` | `activeCustomers.current` | `lowStockItems` | `attention` (`orders` / `apts`) | Tất cả 5 check đối soát |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`ADMIN_GLOBAL`** | `10,385,250` (`4,926,000` / `+5,459,250` / `+110.83%`) | `10,856,250` / `670,000` / `-1,141,000` | `88` | `18` | `21` | `3` | `13` / `1` | ✅ `true` |
| **`MANAGER_Q1`** (`6ad08e4417bf41f5954234c3`) | `3,000,250` (`4,165,000` / `-1,164,750` / `-27.97%`) | `3,221,250` / `670,000` / `-891,000` | `51` | `14` | `10` | `2` | `7` / `1` | ✅ `true` |
| **`MANAGER_DUAL`** (`Q1` + `Q7`) | `6,623,250` (`4,291,000` / `+2,332,250` / `+54.35%`) | `6,844,250` / `670,000` / `-891,000` | `72` | `17` | `16` | `2` | `10` / `1` | ✅ `true` |

### 6.2 Mẫu JSON `GET /api/v1/dashboard/summary` + `/low-stock` + `/service-stats` + `/attention` (`ADMIN_GLOBAL`)
*(PII tên khách hàng trong mảng `attention` đã được mask `*` để bảo mật trong tài liệu)*

```json
{
  "summary": {
    "range": {
      "from": "2026-10-13",
      "to": "2026-11-11",
      "previousFrom": "2026-09-13",
      "previousTo": "2026-10-12",
      "granularity": "day",
      "timezone": "Asia/Ho_Chi_Minh",
      "branchIds": []
    },
    "kpis": {
      "revenue": {
        "current": 10385250,
        "previous": 4926000,
        "delta": 5459250,
        "changePercent": 110.83,
        "currency": "VND"
      },
      "orders": { "current": 88, "previous": 4, "delta": 84, "changePercent": 2100 },
      "appointments": { "current": 18, "previous": 0, "delta": 18, "changePercent": null },
      "activeCustomers": { "current": 21, "previous": 1, "delta": 20, "changePercent": 2000 }
    },
    "orderCountsByStatus": {
      "PENDING": 0,
      "CONFIRMED": 6,
      "PROCESSING": 6,
      "SHIPPED": 7,
      "COMPLETED": 38,
      "CANCELLED": 31
    },
    "appointmentCountsByStatus": {
      "PENDING_PAYMENT": 0,
      "PENDING_CONFIRMATION": 1,
      "CONFIRMED": 5,
      "IN_PROGRESS": 4,
      "COMPLETED": 2,
      "CANCELLED": 4,
      "NO_SHOW": 2
    },
    "lowStockItems": 3,
    "breakdown": {
      "orderRevenue": 10856250,
      "serviceRevenue": 670000,
      "refundAdjustment": -1141000,
      "commerceRevenue": 9715250,
      "clinicRevenue": 670000
    }
  },
  "serviceStats": {
    "range": { "from": "2026-10-13", "to": "2026-11-11", "timezone": "Asia/Ho_Chi_Minh", "branchIds": [] },
    "items": [
      {
        "serviceId": "6ad08e4517bf41f5954234c8",
        "name": "Khám sức khỏe tổng quát",
        "serviceType": "MEDICAL",
        "completedCount": 3,
        "revenue": null
      },
      {
        "serviceId": "6ad08e4417bf41f5954234c6",
        "name": "Tắm spa & Sấy phồng tạo kiểu",
        "serviceType": "GROOMING",
        "completedCount": 1,
        "revenue": null
      }
    ]
  },
  "lowStock": {
    "total": 3,
    "unconfiguredCount": 0,
    "items": [
      {
        "stockId": "6ae1aeffb1d650ca8dafe51a",
        "inventoryItemId": "6ae1aeffb1d650ca8dafe519",
        "branchId": "6ad08e4417bf41f5954234c3",
        "branchName": "Chi nhánh Quận 1",
        "branchCode": "BR-000001",
        "sku": "SP-RC-MINI-001-01",
        "name": "Thức ăn hạt cao cấp cho chó nhỏ Royal Canin Mini Adult - Túi 800g",
        "unit": "cái",
        "kind": "PRODUCT",
        "imageUrl": "https://www.petmart.vn/wp-content/uploads/2021/06/thuc-an-cho-cho-truong-thanh-co-nho-royal-canin-mini-adult1.jpg",
        "quantity": 0,
        "lowStockThreshold": 5,
        "threshold": 5,
        "thresholdConfigured": true,
        "status": "OUT_OF_STOCK"
      },
      {
        "stockId": "6af41fd8b25c942961da2a99",
        "inventoryItemId": "6af41fd8b25c942961da2a98",
        "branchId": "6ad08e4417bf41f5954234c5",
        "branchName": "Chi nhánh Bình Thạnh",
        "branchCode": "BR-000003",
        "sku": "MAT-UAT-BANDAGE-01",
        "name": "Băng gạc y tế vô trùng UAT",
        "unit": "Cuộn",
        "kind": "MATERIAL",
        "imageUrl": null,
        "quantity": 2,
        "lowStockThreshold": 5,
        "threshold": 5,
        "thresholdConfigured": true,
        "status": "LOW_STOCK"
      },
      {
        "stockId": "6ae1aeffb1d650ca8dafe523",
        "inventoryItemId": "6ae1aeffb1d650ca8dafe522",
        "branchId": "6ad08e4417bf41f5954234c3",
        "branchName": "Chi nhánh Quận 1",
        "branchCode": "BR-000001",
        "sku": "SP-WHISKAS-002-01",
        "name": "Pate thơm ngon cho mèo Whiskas vị cá thu và cá hồi biển - Gói 85g Cá Thu & Cá Hồi",
        "unit": "cái",
        "kind": "PRODUCT",
        "imageUrl": "https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/1b7e6a49-8c76-47fa-a0f8-514ccebd0520/4b402154-86cc-4e51-8571-ca76d0a6e2a4/h-t-whiskas-adult-cho-m-o-tr-ng-th-nh.png",
        "quantity": 3,
        "lowStockThreshold": 8,
        "threshold": 8,
        "thresholdConfigured": true,
        "status": "LOW_STOCK"
      }
    ]
  },
  "attention": {
    "ordersTotal": 13,
    "appointmentsTotal": 1,
    "orders": [
      {
        "id": "6af41fd9b25c942961da2aa4",
        "code": "ORD-UAT-BACKLOG-OLD",
        "customerName": "Đơn t*** đ*** >*** 3*** n*** (***",
        "totalAmount": 210000,
        "createdAt": "2026-10-07T01:00:00.000Z",
        "status": "PENDING",
        "branchId": "6ad08e4417bf41f5954234c3",
        "branchName": "Chi nhánh Quận 1"
      },
      {
        "id": "6ae5bc515d7595e2555032de",
        "code": "ORD-20261029-0012",
        "customerName": "Phạm Q*** N***",
        "totalAmount": 140000,
        "createdAt": "2026-10-31T10:00:46.458Z",
        "status": "PROCESSING",
        "branchId": "6ad08e4417bf41f5954234c3",
        "branchName": "Chi nhánh Quận 1"
      }
    ],
    "appointments": [
      {
        "id": "6af41fdab25c942961da2aa8",
        "code": "APT-UAT-UPCOMING-24H",
        "customerName": "Khách h*** s*** t*** (*** U***",
        "petName": "Lucky",
        "scheduledStart": "2026-11-11T10:56:38.151Z",
        "status": "CONFIRMED",
        "serviceType": "GROOMING",
        "branchId": "6ad08e4417bf41f5954234c3",
        "branchName": "Chi nhánh Quận 1"
      }
    ]
  }
}
```

### 6.3 Mẫu đối soát `MANAGER_Q1` & Ca doanh thu âm `UAT-18` (Chi nhánh Bình Thạnh)
- **`MANAGER_Q1` (`revenueAnalytics` các ngày có hoàn tiền lớn hơn tiền bán):**
  ```json
  {
    "granularity": "day",
    "totalRevenue": 3000250,
    "previousRevenue": 4165000,
    "delta": -1164750,
    "changePercent": -27.97,
    "totals": { "orderRevenue": 3221250, "serviceRevenue": 670000, "refundAdjustment": -891000 },
    "nonZeroPointsSample": [
      { "periodStart": "2026-11-06", "orderRevenue": 0, "serviceRevenue": 0, "refundAdjustment": -150000, "totalRevenue": -150000 },
      { "periodStart": "2026-11-08", "orderRevenue": 0, "serviceRevenue": 250000, "refundAdjustment": -741000, "totalRevenue": -491000 },
      { "periodStart": "2026-11-11", "orderRevenue": 300000, "serviceRevenue": 420000, "refundAdjustment": 0, "totalRevenue": 720000 }
    ]
  }
  ```
- **`UAT-18` (Lọc riêng 1 ngày `from=2026-10-30&to=2026-10-30&branchId=6ad08e4417bf41f5954234c5` — Chi nhánh Bình Thạnh `BR-000003`):**
  ```json
  {
    "date": "2026-10-30",
    "revenue": -250000,
    "refundAdjustment": -250000,
    "granularity": "hour"
  }
  ```

---

## 7. Hướng Dẫn Seed UAT & Chạy Kiểm Thử Tự Động

### 7.1 Hướng dẫn chạy Seed UAT thủ công (Idempotent & Cô lập)
Script seed Dashboard được tách riêng hoàn toàn khỏi luồng boot server (`server.js`/`app.js`), chỉ upsert các bản ghi có prefix UAT riêng để an toàn cho dữ liệu hiện có:

```bash
# Bước 1 (chỉ cần nếu DB chưa có dữ liệu chi nhánh/user/catalog nền):
npm run seed:uat-prod

# Bước 2 (chạy lại nhiều lần không trùng lặp):
npm run seed:dashboard-uat
```

**Các kịch bản UAT được tạo tự động theo ngày VN (`Asia/Ho_Chi_Minh`):**
- `ORD-UAT-01`: Tạo kỳ trước (`-35d`), giao kỳ này (`-2d`) tại Q1 → kiểm chứng doanh thu ghi nhận theo `deliveredAt`.
- `ORD-UAT-FREESHIP`: Đơn hôm nay dùng mã `FREESHIP` (`shippingFee = 30k`, `voucherDiscount = 30k`) → không trừ oan 30k vào tiền hàng.
- `ORD-UAT-02-SRC` + `RET-UAT-02` + `RF-UAT-02`: Đơn giao kỳ trước (`-40d`), hoàn hàng kỳ này (`-5d`) tổng hoàn `180k` gồm `30k` ship → chỉ trừ `150k` vào `refundAdjustment`.
- `ORD-UAT-CANCEL` + `RF-UAT-CANCEL`: Đơn `CANCELLED` hoàn tiền tại Q7 → không làm âm doanh thu Q7.
- `ORD-UAT-BT-SRC` + `RF-UAT-BT-NEG`: Đơn giao `-40d` ở Bình Thạnh, hoàn `250k` vào ngày `-12d` (`2026-10-30`) → kiểm chứng `UAT-18` doanh thu âm `-250,000 VND`.
- `ORD-UAT-GUEST` & `ORD-UAT-BACKLOG-OLD`: Khách vãng lai (`activeCustomers` không bị tính `null`) và đơn `PENDING` tồn đọng `> 35` ngày cho `/attention`.
- `APT-UAT-03`, `APT-UAT-04` (2 segment `COMPLETED`, 1 `IN_PROGRESS`), `APT-UAT-05` (`COMPLETED` hôm nay, cọc 30% + trả nốt 70% = tính đúng 420k 1 lần), `APT-UAT-UPCOMING-24H` (`now + 3h` tại Q1).
- Kho cảnh báo: Sản phẩm #1 ở Q1 `qty: 0` (`OUT_OF_STOCK`, có `imageUrl`), cùng SKU đó ở Q7 `qty: 15` (`HEALTHY`); Sản phẩm #2 ở Q1 `qty: 3 / 8` (`LOW_STOCK`); `MAT-UAT-BANDAGE-01` (`MATERIAL`) ở Bình Thạnh `qty: 2 / 5` (`LOW_STOCK`, `imageUrl: null`).

### 7.2 Bằng chứng Kiểm thử Tự động (Chạy sau lần chỉnh sửa cuối)

| Loại kiểm thử | Lệnh chạy | Kết quả thực tế | Phạm vi chứng minh |
| :--- | :--- | :---: | :--- |
| **Suite hồi quy 8 files** | `npx jest tests/content-dashboard.test.js tests/dashboard-m23-e2e.test.js tests/contract.test.js tests/order-e2e.test.js tests/execution.test.js tests/appointment.test.js tests/appointment-e2e.test.js tests/inventory.test.js --runInBand` | **8 suites PASS**<br>**109/109 tests PASS** (`129.237 s`) | Toàn bộ Dashboard, OpenAPI contract, Orders, Execution, Appointments, Inventory không regression |
| **E2E Real MongoDB + Supertest HTTP** | `npx jest tests/dashboard-m23-e2e.test.js --verbose --runInBand` | **10/10 PASS** (`19.837 s`) | `UAT-01..18`, RBAC `400/401/403/404` 2 prefix, `DASH-BE-07` clickthrough, `UAT-16` concurrency isolation, `UAT-15` tải `>= 1,200` bản ghi đo `352 ms` (cả batch HTTP) |
| **Unit Mocked + Content** | `npx jest tests/content-dashboard.test.js --verbose --runInBand` | **14/14 PASS** (`9` content + `5` M23 unit/utils) | Kiểm tra logic `dashboard.utils.js`, RBAC, image resolution `PRODUCT` vs `MATERIAL` |
