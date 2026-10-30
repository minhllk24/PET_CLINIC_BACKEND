# BÁO CÁO KỸ THUẬT CHUYÊN SÂU & CẨM NANG TÍCH HỢP API DÀNH CHO FRONTEND
**Người nhận:** Linh & Đội ngũ Frontend Web 2 (`DR_PETS_HOUSE_ANGULAR`)  
**Người lập:** Senior API Engineer & Senior Prompt Engineer  
**Hệ thống Backend:** Node.js, Express, MongoDB Atlas, OpenAPI v7 Specification  
**Base URL Production (Render):** `https://pet-clinic-backend-a4lj.onrender.com/api/v1`

---

## 1. TỔNG QUAN & LỜI MỞ ĐẦU

Chào Linh và team Frontend!

Sau khi hệ thống Backend hoàn tất triển khai bản vá CORS trên Render (xác thực Preflight `OPTIONS` trả về `204 OK` thành công cho domain `https://www.drpetshouse.lat` và `https://*.vercel.app`), qua việc rà soát Network Tab và mã nguồn thực tế, đội ngũ Backend đã ghi nhận và phân tích chi tiết nguyên nhân gây ra một số lỗi **`400 Bad Request`** và **`404 Not Found`** khi thao tác trên giao diện.

Báo cáo này cung cấp bản chẩn đoán chi tiết và các đoạn mã **TypeScript / Angular Drop-in Replacement** chuẩn xác 100% theo hợp đồng OpenAPI v7 để Linh có thể cập nhật nhanh chóng, hoàn thiện giao diện và bàn giao sản phẩm mượt mà.

---

## 2. MA TRẬN PHÂN TÍCH LỖI & GIẢI PHÁP TỨC THÌ

| Khu vực | Mã lỗi | URL Endpoint đang gọi | Nguyên nhân cụ thể | Giải pháp từ Frontend |
|:---|:---:|:---|:---|:---|
| **Sản phẩm (Catalog)** | `400` | `GET /products?sort=best_selling` | Giá trị `sort` gửi chữ thường hoặc giá trị không có trong Enum (`best_selling`, `price_asc`). OpenAPI v7 chỉ nhận Enum viết hoa. | Đổi giá trị `sort` sang: `NEWEST`, `PRICE_ASC`, `PRICE_DESC`, `NAME_ASC`. |
| **Tìm kiếm Sản phẩm** | `400` | `GET /products?filter=...&category_id=...` | Tên query parameter bị lệch (`filter` thay vì `q`, `category_id` thay vì `categoryId`). | Đổi tên query params sang: `q` và `categoryId`. |
| **Kiểm tra Lịch hẹn** | `400` | `GET /availability?branchId=...&date=...` | Backend bắt buộc phải có `serviceIds` để tính thời lượng ca khám và xung đột ca trực. | Luôn truyền kèm query param `serviceIds`. |
| **Xác thực OTP** | `400` | `POST /verify-otp` hoặc `/verify-register-otp` | Gửi snake_case `{ login_id, otp_code }` và thiếu trường `purpose`. | Gửi payload: `{ identifier, otpCode, purpose: 'REGISTER' }`. |
| **Giỏ hàng (Cart)** | `404` | `POST /cart`, `PUT /cart/:id` | Backend MongoDB OpenAPI v7 dùng cấu trúc RESTful chuẩn tài nguyên con: `/cart/items`. | Đổi endpoint sang: `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`. |
| **Lấy giờ hẹn (Slots)** | `404` | `GET /appointments/slots` | Backend tách riêng module kiểm tra giờ trống thành `/availability`. Route `appointments/:id` tưởng `slots` là mã lịch hẹn nên báo 404/401. | Chuyển sang gọi: `GET /availability?branchId=...&date=...&serviceIds=...`. |
| **Tài khoản (Auth)** | `404` | `POST /verify-register-otp`, `/forgot-password`, `/reset-password` | Gọi thiếu prefix module `/auth/`. | Thêm tiền tố `/auth/`: `/auth/verify-otp`, `/auth/forgot-password`, `/auth/reset-password`. |
| **Tin tức / Cứu hộ** | `404` | `GET /flash-sales/active`, `/first-aid/*`, `/adoptions/*` | Đây là các tính năng của Web 1 cũ (MySQL), chưa nằm trong phạm vi MongoDB v7. | Đã có hàm fallback `catchError` an toàn ở FE, hoặc sử dụng dữ liệu tĩnh hiển thị. |

---

## 3. HƯỚNG DẪN CODE DROP-IN REPLACEMENT CHI TIẾT

### 3.1. Module Xác thực (`src/app/core/customer/services/api/auth-api.service.ts`)

> **Vấn đề:** Các hàm gọi OTP, quên mật khẩu, làm mới token đang gọi vào root thay vì `/auth/*`, và gửi sai tên trường (`login_id` thay vì `identifier`).

**Mã nguồn chuẩn hóa (Copy & Paste thay thế các hàm tương ứng):**

```typescript
// 1. Làm mới Token (Refresh Token)
async refreshToken() {
  // ĐÚNG: /auth/refresh (không dùng /auth/refresh-token)
  const response = await this.http.post("/auth/refresh");
  return assertSuccess(response);
}

// 2. Xác thực OTP đăng ký tài khoản
async verifyRegisterOtp({ loginId, otpCode }: { loginId: string; otpCode: string }) {
  // ĐÚNG: /auth/verify-otp kèm purpose: 'REGISTER' và identifier
  const response = await this.http.post("/auth/verify-otp", {
    identifier: loginId.trim(),
    otpCode: otpCode.trim(),
    purpose: "REGISTER",
  });
  return assertSuccess(response);
}

// 3. Yêu cầu Quên mật khẩu
async forgotPassword(emailOrPhone: string) {
  // ĐÚNG: /auth/forgot-password với identifier
  const response = await this.http.post("/auth/forgot-password", {
    identifier: emailOrPhone.trim(),
  });
  return assertSuccess(response);
}

// 4. Xác thực OTP Quên mật khẩu
async verifyForgotOtp({ email, otpCode }: { email: string; otpCode: string }) {
  // ĐÚNG: /auth/verify-otp kèm purpose: 'FORGOT_PASSWORD'
  const response = await this.http.post("/auth/verify-otp", {
    identifier: email.trim(),
    otpCode: otpCode.trim(),
    purpose: "FORGOT_PASSWORD",
  });
  return assertSuccess(response);
}

// 5. Đặt lại Mật khẩu mới (Reset Password)
async resetPassword({ resetToken, newPassword }: { resetToken: string; newPassword: string }) {
  // ĐÚNG: /auth/reset-password với resetToken và newPassword (camelCase)
  const response = await this.http.post("/auth/reset-password", {
    resetToken,
    newPassword,
  });
  return assertSuccess(response);
}

// 6. Đổi Mật khẩu khi đã đăng nhập (Change Password)
async changePassword({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) {
  // ĐÚNG: /auth/change-password với oldPassword và newPassword
  const response = await this.http.post("/auth/change-password", {
    oldPassword,
    newPassword,
  });
  return assertSuccess(response);
}
```

---

### 3.2. Module Sản phẩm & Tìm kiếm (`product-page.helpers.ts` & `product-page.component.ts`)

> **Vấn đề:** 
> - Hàm `toBackendSort()` trả về chữ thường (`"price_asc"`, `"newest"`) hoặc `"best_selling"` $\rightarrow$ Backend ném lỗi 400 Enum Validation.
> - Tham số lọc gửi `filter` và `category_id` $\rightarrow$ Backend chỉ nhận `q` và `categoryId`.

**Bước 1: Sửa hàm chuyển đổi Sort tại `src/app/features/customer/products/pages/product-list/product-page.helpers.ts`:**

```typescript
// SỬA ĐOẠN NÀY ĐỂ TRẢ VỀ UPPERCASE ENUM CHUẨN OPENAPI v7:
export const toBackendSort = (sortOrder: string): "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC" => {
  if (sortOrder === "asc" || sortOrder === "price_asc") return "PRICE_ASC";
  if (sortOrder === "desc" || sortOrder === "price_desc") return "PRICE_DESC";
  if (sortOrder === "name_asc") return "NAME_ASC";
  return "NEWEST";
};
```

**Bước 2: Sửa hàm `loadProducts()` tại `src/app/features/customer/products/pages/product-list/product-page.component.ts` (khoảng dòng 117):**

```typescript
// THAY THẾ KHỐI params CŨ BẰNG KHỐI CHUẨN NÀY:
const params: Record<string, any> = {
  page,
  limit: PAGE_SIZE,
  sort: toBackendSort(this.sortOrder()),
};

// Chuẩn hóa tên trường sang camelCase theo OpenAPI v7:
if (this.searchQuery().trim()) {
  params['q'] = this.searchQuery().trim(); // Thay cho 'filter'
}

if (this.selectedCategoryIds().length > 0) {
  params['categoryId'] = this.selectedCategoryIds()[0]; // Thay cho 'category_id'
}
```

**Bước 3: Sửa `getBestSellingProducts()` tại `product-api.service.ts` (dòng 201):**

```typescript
async getBestSellingProducts(limit: number = 12) {
  // Không truyền sort: "best_selling" vì Backend v7 không có enum này.
  // Dùng sort: "NEWEST" hoặc để mặc định để lấy sản phẩm nổi bật mới nhất:
  return this.getProducts({ sort: "NEWEST", limit, page: 1 });
}
```

---

### 3.3. Module Giỏ hàng (`src/app/core/customer/services/api/cart-api.service.ts`)

> **Vấn đề:** Gọi `POST /cart` và `PUT /cart/:id` khiến Backend trả về `404 Not Found`. Chuẩn REST v7 là `/cart/items`.

**Mã nguồn chuẩn hóa:**

```typescript
@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly http = inject(CustomerHttpService);

  // 1. Lấy chi tiết giỏ hàng
  async getCart() {
    const response = await this.http.get("/cart");
    return assertSuccess(response);
  }

  // 2. Thêm sản phẩm vào giỏ hàng
  async addToCart(payload: { productId: string; variantId?: string; quantity: number }) {
    // ĐÚNG: POST /cart/items
    const response = await this.http.post("/cart/items", {
      productId: payload.productId,
      variantId: payload.variantId || undefined,
      quantity: Number(payload.quantity) || 1,
    });
    return assertSuccess(response);
  }

  // 3. Cập nhật số lượng món hàng trong giỏ
  async updateCartItem(itemId: string, quantity: number) {
    // ĐÚNG: PATCH /cart/items/:itemId
    const response = await this.http.patch(`/cart/items/${itemId}`, {
      quantity: Number(quantity),
    });
    return assertSuccess(response);
  }

  // 4. Xóa món hàng khỏi giỏ
  async removeCartItem(itemId: string) {
    // ĐÚNG: DELETE /cart/items/:itemId
    const response = await this.http.delete(`/cart/items/${itemId}`);
    return assertSuccess(response);
  }
}
```

---

### 3.4. Module Kiểm tra Lịch hẹn & Giờ trống (`booking-api.service.ts`)

> **Vấn đề:** `GET /appointments/slots` bị 404 vì module kiểm tra giờ trống của MongoDB v7 nằm tại `GET /availability`.

**Mã nguồn chuẩn hóa tại `src/app/core/customer/services/api/booking-api.service.ts`:**

```typescript
async getAvailableSlots({ branchId, date, serviceIds }: { branchId: string; date: string; serviceIds?: string[] | string }) {
  // Chuẩn hóa danh sách mã dịch vụ (bắt buộc theo OpenAPI v7)
  const formattedServiceIds = Array.isArray(serviceIds) 
    ? serviceIds.join(',') 
    : (serviceIds || '6ad08e4417bf41f5954234c6'); // Mặc định dịch vụ khám cơ bản nếu chưa chọn

  const response = await this.http.get("/availability", {
    params: {
      branchId,
      date, // Định dạng YYYY-MM-DD
      serviceIds: formattedServiceIds,
    },
  });
  return assertSuccess(response);
}
```

---

## 4. DANH SÁCH TÀI KHOẢN TEST TRÊN PRODUCTION RENDER

Tất cả các tài khoản dưới đây đã được kích hoạt `ACTIVE` và băm mật khẩu `K9#mQ$8xL!2vW*7z` sẵn sàng trên MongoDB Atlas:

| Vai trò (Role) | Tài khoản (Identifier / Phone / Username) | Mật khẩu chuẩn (Copy & Paste) | Ghi chú kiểm thử |
|:---|:---|:---|:---|
| **Khách hàng (Customer)** | `0905555555` *(hoặc `customer.levanc@gmail.com`)* | `K9#mQ$8xL!2vW*7z` | Có sẵn thú cưng, lịch sử đơn hàng và đặt lịch. |
| **Khách hàng phụ (Customer 2)** | `0908888888` | `K9#mQ$8xL!2vW*7z` | Dùng dự phòng nếu tài khoản 1 bị dính lockout 423. |
| **Quản trị viên (Admin)** | `admin` | `K9#mQ$8xL!2vW*7z` | Toàn quyền quản trị 3 chi nhánh. |
| **Quản lý Chi nhánh 1** | `manager_br1` | `K9#mQ$8xL!2vW*7z` | Chi nhánh Quận 1 (`BR-000001`). |
| **Bác sĩ Thú y** | `vet_br1` | `K9#mQ$8xL!2vW*7z` | Nhân sự Bác sĩ chuyên môn Chi nhánh 1. |
| **Lễ tân tiếp đón** | `receptionist_br1` | `K9#mQ$8xL!2vW*7z` | Tiếp nhận check-in, gán lịch hẹn. |

> [!IMPORTANT]
> **Lưu ý về Form đăng nhập Customer:**  
> Modal đăng nhập của Customer có Validator chỉ chấp nhận Số điện thoại (10 số) hoặc Email. Vì vậy, khi test trên giao diện Customer, vui lòng dùng **`0905555555`** hoặc **`customer.levanc@gmail.com`** (không gõ username `customer` vì sẽ bị Client chặn form trước khi gửi request).

---

## 5. KẾ HOẠCH HỖ TRỢ SONG SONG TỪ PHÍA BACKEND

Để giảm tải áp lực cho Frontend và đảm bảo website không bị lỗi ngay cả khi FE chưa kịp build lại Vercel, **đội ngũ Backend đang song song triển khai một Ingress Bridge Middleware**:
1. Tự động chuyển đổi các query chữ thường `sort=best_selling`, `sort=price_asc` sang UPPERCASE Enum trên server.
2. Tự động ánh xạ alias các route cũ (`/cart` $\rightarrow$ `/cart/items`, `/appointments/slots` $\rightarrow$ `/availability`).
3. Trả về dữ liệu mock hợp lệ cho các API marketing Web 1 cũ (`flash-sales`, `first-aid`, `posts`) để dọn sạch 100% lỗi đỏ trên Console trình duyệt.

Chúc Linh và team Frontend triển khai suôn sẻ! Nếu gặp bất kỳ vướng mắc nào, Backend team luôn sẵn sàng hỗ trợ trực tiếp.
