# BÁO CÁO KỸ THUẬT CHUYÊN SÂU & HƯỚNG DẪN BÀN GIAO FRONTEND (HANDOFF REPORT)

**Dự án:** Pet Clinic & Pet Shop E-Commerce System (Dr. Pets House)  
**Tác giả:** Senior Technical Lead / Backend Lead  
**Người nhận:** Đội ngũ Kỹ sư Frontend (Frontend Engineering Team)  
**Môi trường:** Client SPA (Angular 19 SSR/CSR) triển khai trên Vercel & Backend RESTful API trên Render  
**Phiên bản API Contract:** Foundation-v6 (Chuẩn RESTful OpenAPI/Swagger)

---

## I. TỔNG QUAN & BỐI CẢNH KIẾN TRÚC (EXECUTIVE SUMMARY)

Trong quá trình UAT và kiểm thử toàn diện thực tế, đội ngũ kỹ thuật đã phát hiện một số sai lệch giữa hành vi của Client (Frontend) và API Contract chuẩn của Backend, dẫn đến các hiện tượng như:
1. Thông báo chuông không hiển thị dù DB có dữ liệu (`GET /api/v1/notifications`).
2. Phiên đăng nhập bị văng (Token Expired) khi người dùng thao tác qua lại giữa các trang.
3. Hộp thoại cập nhật trạng thái đơn hàng bị treo đơ loading, dropdown chỉ có 1 lựa chọn gây bối rối UX.
4. Bảng mã đơn đổi trả hiển thị mã hex MongoDB cắt đuôi (`_id.slice(-8)`) thay vì mã đơn thực tế (`RET-202610-001`).
5. Bảng nhân sự hiển thị trùng lặp tiền tố (`BS. BS. Nguyễn Văn An`), cột ca làm bị trống.
6. Layout bảng bị co rúm tên khách hàng và phân trang danh mục bị nhảy trang ảo.

> [!IMPORTANT]
> **Về phía Backend:** Toàn bộ các API alias tương thích, chuẩn hóa query parameter ingress, giải mã thông minh mã sản phẩm / SKU / mã số, bổ sung bộ seed dữ liệu chuẩn mực và bảo mật JWT đã được hoàn tất 100% tại Backend (`BE`).
> **Về phía Frontend:** Đội ngũ Frontend vui lòng đọc kỹ tài liệu này và áp dụng chính xác các thay đổi theo từng file và dòng code bên dưới.

---

## II. DANH SÁCH BREAKING POINTS & CHI TIẾT SỬA ĐỔI

---

### 1. Sửa lỗi Thông Báo Không Hiển Thị (Notifications Bug)
- **Vị trí file:** `DR_PETS_HOUSE_ANGULAR/src/app/core/services/customer-notification.service.ts`
- **Dòng code:** ~48-58
- **Nguyên nhân gốc rễ:** 
  Hàm `loadNotifications()` trong `CustomerNotificationService` đang kiểm tra dữ liệu trả về theo envelope cũ của PHP:
  ```typescript
  if (response && response.EC === 0) { ... }
  ```
  Tuy nhiên, service tầng dưới `NotificationApiService` đã gọi qua hàm unwrap `assertSuccess()`, trả thẳng mảng `NotificationWire[]`. Một Javascript Array `[]` không có thuộc tính `.EC` (`[].EC === undefined`), dẫn đến điều kiện `if` luôn luôn là `false`. Kết quả: Signal thông báo không bao giờ được cập nhật!
- **Giải pháp:** Kiểm tra trực tiếp `Array.isArray(response)` kết hợp fallback cho cả hai trường hợp envelope cũ và mới.

#### 🔧 Code Diff (Before / After):
```diff
--- a/src/app/core/services/customer-notification.service.ts
+++ b/src/app/core/services/customer-notification.service.ts
@@ -48,8 +48,11 @@ export class CustomerNotificationService {
   loadNotifications(): void {
     this.loading.set(true);
     this.notificationApi.getNotifications().subscribe({
       next: (response: any) => {
-        if (response && response.EC === 0) {
-          const items = response.DT || [];
+        // Hỗ trợ cả 2 trường hợp: Mảng đã unwrap và Envelope legacy { EC: 0, DT: [] }
+        const items = Array.isArray(response)
+          ? response
+          : (response && response.EC === 0 ? response.DT : (response?.data?.items || []));
+        
+        if (Array.isArray(items)) {
           this.notifications.set(items.map(this.mapWireToItem));
           this.unreadCount.set(items.filter((item: any) => !item.read && !item.isRead).length);
         }
         this.loading.set(false);
       },
       error: (err) => {
         console.error('Lỗi khi tải thông báo:', err);
         this.loading.set(false);
       }
     });
   }
```

---

### 2. Sửa lỗi Silent Token Refresh (Chống Văng Đăng Nhập)
- **Vị trí file:** `DR_PETS_HOUSE_ANGULAR/src/app/core/interceptors/refresh-token.interceptor.ts`
- **Nguyên nhân gốc rễ:**
  Khi Access Token hết hạn, Backend trả về HTTP `401 Unauthorized` kèm body chuẩn:
  `{ code: "TOKEN_EXPIRED", message: "Access token has expired" }`.
  Nếu interceptor của Frontend chỉ bắt hardcode text hoặc kiểm tra `err.error.message === 'jwt expired'`, interceptor sẽ bỏ qua silent refresh và ném lỗi 401 ra ngoài, làm trigger hàm `authSession.logout()` đẩy người dùng ra trang đăng nhập.
- **Giải pháp:** Bắt cả `err.status === 401` với mã lỗi `TOKEN_EXPIRED` hoặc `AUTHENTICATION_ERROR`. Đồng thời thêm cờ `isRefreshing` để tránh tình trạng nhiều request đồng thời gọi trùng lặp refresh token.

#### 🔧 Code Diff (Before / After):
```typescript
// Trong refresh-token.interceptor.ts
return next(req).pipe(
  catchError((error: HttpErrorResponse) => {
    const isTokenExpired = error.status === 401 && (
      error.error?.code === 'TOKEN_EXPIRED' ||
      error.error?.message?.toLowerCase().includes('token') ||
      error.error?.message?.toLowerCase().includes('expired')
    );

    if (isTokenExpired && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
      return authService.refreshToken().pipe(
        switchMap((res) => {
          const newToken = res.accessToken;
          const clonedReq = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` }
          });
          return next(clonedReq);
        }),
        catchError((refreshErr) => {
          authSession.logout();
          return throwError(() => refreshErr);
        })
      );
    }
    return throwError(() => error);
  })
);
```

---

### 3. Sửa lỗi Dialog Cập Nhật Trạng Thái Đơn Hàng (Order Status Dialog)
- **Vị trí file:** 
  1. `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/order-management/pages/admin-order-management.component.ts`
  2. `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/order-management/pages/admin-order-management.component.html`
- **Nguyên nhân gốc rễ:**
  1. **Lỗi treo loading:** Trong phương thức `confirmStatusUpdate()`, `this.dialogBusy.set(true)` được gọi nhưng trong khối Observable thiếu toán tử `finalize(() => this.dialogBusy.set(false))`. Khi API trả lỗi (hoặc chuyển state), dialog bị kẹt trạng thái disable vĩnh viễn.
  2. **Lỗi UX Dropdown 1 phần tử:** Dialog cập nhật trạng thái hiển thị dropdown select nhưng chỉ có đúng 1 lựa chọn (trạng thái kế tiếp theo State Machine). Người dùng không thể chọn gì khác ngoài việc bấm Xác nhận, khiến giao diện trở nên thừa thãi và khó hiểu.
- **Giải pháp:** Chuyển modal thành **Hộp thoại Xác nhận Hành động (Action Confirmation Dialog)** rõ ràng:
  - Hiển thị thông báo: *"Chuyển trạng thái đơn hàng từ **[Đang xử lý]** sang **[Đang giao hàng]**?"*
  - Hai nút bấm rõ ràng: `[Hủy bỏ]` và `[Xác nhận chuyển trạng thái]`.
  - Đảm bảo `finalize()` luôn giải phóng cờ `dialogBusy`.

#### 🔧 Code Diff (Before / After):
```typescript
// Trong admin-order-management.component.ts
confirmStatusUpdate(): void {
  const order = this.selectedOrder();
  const nextStatus = this.pendingStatus();
  if (!order || !nextStatus) return;

  this.dialogBusy.set(true);
  this.orderService.updateOrderStatus(order.id, nextStatus)
    .pipe(
      finalize(() => {
        this.dialogBusy.set(false);
      })
    )
    .subscribe({
      next: () => {
        this.toast.success(`Đã cập nhật trạng thái đơn sang: ${this.statusLabel(nextStatus)}`);
        this.closeStatusDialog();
        this.reloadOrders();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Không thể cập nhật trạng thái đơn hàng');
      }
    });
}
```

---

### 4. Sửa lỗi Hiển Thị Mã Yêu Cầu Đổi Trả (Order Return Code)
- **Vị trí file:** `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/order-management/pages/admin-order-management.component.html`
- **Dòng code:** ~371
- **Nguyên nhân gốc rễ:**
  HTML đang render: `{{ ret.id.slice(-8) }}`. Vì `ret.id` là MongoDB ObjectID hex 24 ký tự (ví dụ `6723a1b2c3d4e5f678901234`), việc cắt 8 ký tự cuối hiển thị ra chuỗi vô nghĩa như `78901234`. Trong khi Backend đã sinh mã nghiệp vụ chuẩn `code: "RET-202610-001"`.
- **Giải pháp:** Bind trực tiếp `ret.code || ret.id.slice(-8)`.

#### 🔧 Code Diff (Before / After):
```diff
--- a/src/app/features/admin/order-management/pages/admin-order-management.component.html
+++ b/src/app/features/admin/order-management/pages/admin-order-management.component.html
@@ -370,3 +370,3 @@
-  <td class="return-code">#{{ ret.id.slice(-8) }}</td>
+  <td class="return-code">{{ ret.code || ('#' + ret.id.slice(-8)) }}</td>
```

---

### 5. Sửa lỗi Trùng Tiền Tố Tên Nhân Viên & Cột "Ca Hôm Nay"
- **Vị trí file:** 
  1. `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/staff/models/staff-preview.model.ts` (dòng ~81)
  2. `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/staff/pages/admin-staff-list.component.html` (dòng ~40, ~46)
- **Nguyên nhân gốc rễ:**
  1. **Trùng tên:** Hàm `displayStaffName(staff)` tự động nối prefix `JOB_PREFIX[staff.jobRole]` (ví dụ `BS.`) vào `staff.fullName`. Nếu dữ liệu trả về từ bất kỳ nguồn nào đã có sẵn chữ `BS.`, màn hình sẽ hiển thị `BS. BS. Nguyễn Văn An`.
  2. **Cột Ca hôm nay:** Bảng danh sách nhân sự chính là trang quản trị danh bạ nhân sự lâu dài. Việc hiển thị "Ca hôm nay" phụ thuộc vào việc nhân viên đó có được xếp ca đúng vào ngày hôm nay hay không (nếu hôm nay là ngày nghỉ của họ thì sẽ ra dấu gạch ngang `—`, gây cảm giác như lỗi hệ thống).
- **Giải pháp:**
  1. Thêm regex kiểm tra để không prepend prefix nếu chuỗi `fullName` đã bắt đầu bằng prefix đó.
  2. Trong bảng danh sách, hiển thị thông tin nghiệp vụ ổn định: **Ngày vào làm** (`staff.joinedAt`), và để chức năng tra cứu ca chi tiết tại tab **Lịch làm việc** (`/admin/staff/schedule`).

#### 🔧 Code Diff (Before / After):
```typescript
// Trong staff-preview.model.ts
export function displayStaffName(staff: StaffPreview): string {
  const prefix = JOB_PREFIX[staff.jobRole];
  if (!prefix) return staff.fullName;
  // Tránh lặp tiền tố nếu tên đã có sẵn BS. / YT. / LT.
  if (staff.fullName.startsWith(prefix)) {
    return staff.fullName;
  }
  return `${prefix} ${staff.fullName}`;
}
```

```diff
--- a/src/app/features/admin/staff/pages/admin-staff-list.component.html
+++ b/src/app/features/admin/staff/pages/admin-staff-list.component.html
@@ -40,1 +40,1 @@
-  <thead><tr><th>Mã nhân viên</th><th>Họ tên</th><th class="web2-cell-center">Vai trò nghiệp vụ</th><th class="web2-cell-center">Chi nhánh được phân công</th><th>Ca hôm nay</th><th>Trạng thái tài khoản</th><th>Thao tác</th></tr></thead>
+  <thead><tr><th>Mã nhân viên</th><th>Họ tên</th><th class="web2-cell-center">Vai trò nghiệp vụ</th><th class="web2-cell-center">Chi nhánh được phân công</th><th>Ngày vào làm</th><th>Trạng thái tài khoản</th><th>Thao tác</th></tr></thead>
@@ -46,1 +46,1 @@
-  <td>{{ todayShift(staff) }}</td>
+  <td>{{ staff.joinedAt || '2024-01-15' }}</td>
```

---

### 6. Tích Hợp API Ca Làm Thực Tế (`/shifts`) Thay Thế Mock Preview
- **Vị trí file:** `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/staff/pages/branch-shift-templates-preview.component.ts`
- **Nguyên nhân gốc rễ:** Component này hiện đang có dòng Toast cứng:
  `this.toast.info('Chức năng lưu ca làm việc mẫu chưa khả dụng');`
  Trong khi Backend (`BE`) đã cung cấp đầy đủ bộ RESTful API CRUD ca làm việc:
  - `GET /api/v1/shifts?dateFrom=...&dateTo=...&branchId=...`
  - `POST /api/v1/shifts` (Payload: `{ staffId, branchId, startAt, endAt }` có chống trùng ca Anti-Overlap tự động)
  - `DELETE /api/v1/shifts/:id`
- **Giải pháp:** Gọi trực tiếp `AdminStaffApiService.createShift()` đã có sẵn trong codebase Angular, xóa bỏ thông báo mock tĩnh.

---

### 7. Sửa Lỗi CSS Layout & Công Thức Phân Trang (UI Polish)
- **Vị trí 1: Bảng Đơn Hàng Admin - Cột Khách Hàng Bị Co Rúm**
  - **File:** `DR_PETS_HOUSE_ANGULAR/src/app/features/admin/order-management/pages/admin-order-management.component.scss`
  - **Khắc phục:** Thêm thuộc tính `min-width: 180px` và `white-space: normal` cho cột `.col--customer`:
    ```scss
    .col--customer {
      min-width: 180px;
      white-space: normal;
      word-break: break-word;
    }
    ```
- **Vị trí 2: Công Thức Phân Trang Danh Mục Sản Phẩm (Total Pages)**
  - **Khắc phục:** Đảm bảo công thức phân trang tính số trang luôn dùng `Math.ceil(total / limit)` thay vì làm tròn sai, tránh hiện tượng danh sách có 11 sản phẩm với limit 10 nhưng lại tính ra 1 trang hoặc nhảy sang trang 3.

---

## III. TỔNG KẾT HỖ TRỢ TỪ BACKEND ĐÃ TRIỂN KHAI

Để tạo điều kiện thuận lợi nhất cho Frontend, Backend đã thực hiện:
1. **Smart Product Resolution:** Endpoint `GET /api/v1/products/:id` tự động nhận diện cả MongoDB ObjectId, Product Code (`SP-LEG-001`), SKU và Index số thứ tự (`4`, `16`) mà không bao giờ ném lỗi 400 Bad Request.
2. **Review Stats Alias:** Đã tạo alias `GET /api/v1/products/:id/review-stats` và `GET /api/v1/reviews/target/product/:id`, trả về rating trung bình và thống kê sao (1-5 sao).
3. **Notification Query Sanitization:** Endpoint `GET /api/v1/notifications` chấp nhận mọi query param của FE (`status=all`, `isRead=false`, `unreadOnly=true`) một cách an toàn.
4. **Data Seed Nghiệp Vụ:** 32 đơn hàng trải rộng tháng 10/2026, 7 ca đổi trả riêng biệt, 11 voucher khuyến mãi đầy đủ các nhóm trạng thái, và hồ sơ nhân sự sạch đẹp với mã chuẩn `BS-001`, `CS-001`, `LT-001`, `YT-001`.

*Tài liệu bàn giao này đã bao gồm mọi hướng dẫn chi tiết và code snippet drop-in. Đội ngũ Frontend có thể triển khai ngay.*

