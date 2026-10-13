# HƯỚNG DẪN KẾT NỐI API AUTH/RBAC (DÀNH CHO FRONTEND)

> **Dự án:** PET CLINIC  
> **Phiên bản API:** `/api/v1` (OpenAPI v7 Spec Compliance)  
> **Server Base URL:** `http://localhost:8080/api/v1`  
> **Định dạng dữ liệu:** `application/json`  
> **Chuẩn mã lỗi:** RFC 9457 Problem Details (`application/problem+json`)

---

## 1. Lưu ý kỹ thuật bắt buộc cho Frontend

### 1.1 CORS & Cookies (Cực kỳ quan trọng)
- Backend lưu trữ `refreshToken` trong **HttpOnly Cookie** (`SameSite=Strict`, `Path=/api/v1/auth`).
- **Bắt buộc:** Mọi request từ Frontend (Axios / Fetch / Angular HttpClient) **PHẢI** bật gửi credentials / cookie:
  ```typescript
  // 1. Angular HttpClient (Admin App)
  // Trong Service gọi API:
  this.http.post('http://localhost:8080/api/v1/auth/login', body, {
    withCredentials: true // BẮT BUỘC để trình duyệt tự nhận/gửi cookie refreshToken
  });

  // Hoặc cấu hình global qua Angular HttpInterceptor:
  @Injectable()
  export class CredentialsInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
      const cloned = req.clone({ withCredentials: true });
      return next.handle(cloned);
    }
  }

  // 2. Axios
  axios.defaults.withCredentials = true;

  // 3. Fetch API
  fetch('http://localhost:8080/api/v1/auth/login', {
    credentials: 'include', // BẮT BUỘC
  });
  ```
- Backend CORS đã cho phép sẵn các nguồn gốc (Allowed Origins) và hỗ trợ gửi Credentials:
  - Angular Admin App: `http://localhost:4200`
  - Admin App (dự phòng): `http://localhost:3001`
  - Customer App: `http://localhost:3000`

### 1.2 Access Token Handling
- Khi đăng nhập thành công, response trả về `accessToken` (thời hạn 15 phút).
- FE lưu `accessToken` trong **Bộ nhớ (Memory / Redux / Pinia / React Context)** hoặc SessionStorage.
- Khi gọi các API yêu cầu đăng nhập, gắn Header:
  ```http
  Authorization: Bearer <accessToken>
  ```
- Khi nhận lỗi `401 TOKEN_EXPIRED`, Axios Interceptor tự động gọi `POST /api/v1/auth/refresh` (trình duyệt tự gửi cookie refreshToken) để lấy `accessToken` mới.

---

## 2. Danh sách tài khoản Demo đã tạo sẵn để Test

Sau khi khởi động MongoDB và chạy lệnh `npm run seed:demo` trong thư mục `BE/`, bạn có sẵn các tài khoản sau:

| Cấp bậc / Quyền | Vai trò (`systemRole`) | Vai trò phụ (`staffSubRole`) | Số điện thoại (Identifier) | Mật khẩu | Trạng thái (`accountStatus`) | Mục đích test |
|---|---|---|---|---|---|---|
| **Quản trị viên** | `ADMIN` | — | `0900000000` | `Admin@1234` | `ACTIVE` | Toàn quyền hệ thống, quản lý tài khoản nội bộ |
| **Quản lý chi nhánh** | `MANAGER` | — | `0901234567` | `Manager@1234` | `ACTIVE` | Xem dữ liệu trong chi nhánh được gán |
| **Bác sĩ thú y** | `STAFF` | `VETERINARIAN` | `0903333333` | `Doctor@1234` | `ACTIVE` | Khám chữa bệnh, bệnh án |
| **Lễ tân** | `STAFF` | `RECEPTIONIST` | `0904444444` | `Staff@1234` | `ACTIVE` | Đặt lịch hẹn, tiếp đón |
| **Khách hàng** | `CUSTOMER` | — | `0905555555` | `Customer@1234` | `ACTIVE` | Mua hàng, đặt lịch cho thú cưng |
| **Chưa kích hoạt** | `CUSTOMER` | — | `0907777777` | `Customer@1234` | `PENDING_ACTIVATION` | Test thông báo cần xác thực OTP (403) |
| **Bị khóa** | `CUSTOMER` | — | `0906666666` | `Customer@1234` | `BLOCKED` | Test thông báo tài khoản bị khóa (403) |

> 💡 **Quy tắc mật khẩu:** Tối thiểu 8 ký tự, có ít nhất 1 chữ in hoa và 1 chữ số (`^(?=.*[A-Z])(?=.*\d).{8,}$`).

---

## 3. Danh sách Endpoints Xác thực (`/api/v1/auth`)

### 3.1 Đăng nhập (Login)
- **Endpoint:** `POST /api/v1/auth/login`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "identifier": "0905555555",
    "password": "Customer@1234",
    "rememberMe": true
  }
  ```
  *(Lưu ý: `identifier` có thể là Số điện thoại hoặc Email).*
- **Response thành công (200 OK):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7c8e9f42...",
    "expiresIn": 900,
    "user": {
      "id": "6709765f02bc503a4c511234",
      "fullName": "Khách Hàng Lê Văn C",
      "email": "customer.levanc@gmail.com",
      "phone": "0905555555",
      "systemRole": "CUSTOMER",
      "staffSubRole": null,
      "accountStatus": "ACTIVE",
      "activationStatus": "ACTIVATED",
      "lastLogin": "2026-10-11T15:00:00.000Z",
      "branchScope": []
    }
  }
  ```
  *(Đồng thời trình duyệt tự động nhận cookie `refreshToken` HttpOnly).*

### 3.2 Đăng ký khách hàng (Register)
- **Endpoint:** `POST /api/v1/auth/register`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "phone": "0909888999",
    "fullName": "Nguyễn Văn Mới",
    "email": "moi.nguyen@example.com",
    "password": "Password@123",
    "confirmPassword": "Password@123"
  }
  ```
- **Response thành công (201 Created):**
  ```json
  {
    "message": "OTP has been sent",
    "identifier": "0909888999"
  }
  ```
  *(Tài khoản mới tạo sẽ ở trạng thái `PENDING_ACTIVATION` cho đến khi xác thực OTP).*

### 3.3 Xác thực mã OTP (Verify OTP)
- **Endpoint:** `POST /api/v1/auth/verify-otp`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "identifier": "0909888999",
    "otpCode": "123456",
    "purpose": "REGISTER"
  }
  ```
  *(Giá trị `purpose` hợp lệ: `REGISTER` hoặc `FORGOT_PASSWORD`).*
- **Response thành công (200 OK):**
  - Khi kích hoạt đăng ký:
    ```json
    { "message": "Account activated successfully" }
    ```
  - Khi quên mật khẩu:
    ```json
    { "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
    ```

### 3.4 Gửi lại mã OTP (Resend OTP)
- **Endpoint:** `POST /api/v1/auth/resend-otp`
- **Quyền:** Public (cooldown 30 giây giữa 2 lần bấm gửi)
- **Request Body:**
  ```json
  {
    "identifier": "0909888999",
    "purpose": "REGISTER"
  }
  ```
- **Response thành công (200 OK):**
  ```json
  {
    "message": "OTP has been resent",
    "identifier": "0909888999"
  }
  ```

### 3.5 Quên mật khẩu (Forgot Password)
- **Endpoint:** `POST /api/v1/auth/forgot-password`
- **Quyền:** Public (Anti-enumeration: luôn trả 200 để tránh lộ thông tin người dùng)
- **Request Body:**
  ```json
  {
    "identifier": "0905555555"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "If an account exists with this identifier, an OTP has been sent"
  }
  ```

### 3.6 Đặt lại mật khẩu (Reset Password)
- **Endpoint:** `POST /api/v1/auth/reset-password`
- **Quyền:** Public (cần `resetToken` nhận được từ bước verify-otp)
- **Request Body:**
  ```json
  {
    "resetToken": "<chuỗi_token_nhận_từ_verify_otp>",
    "newPassword": "NewPassword@123",
    "confirmPassword": "NewPassword@123"
  }
  ```
- **Response (200 OK):**
  ```json
  { "message": "Password reset successfully" }
  ```

### 3.7 Cấp mới Access Token (Token Refresh)
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Quyền:** Public (tự động đọc cookie `refreshToken` do trình duyệt gửi kèm hoặc qua body)
- **Request Body:** Không bắt buộc (hoặc rỗng `{}`)
- **Response (200 OK):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7c8e9f42...",
    "expiresIn": 900
  }
  ```

### 3.8 Đăng xuất (Logout)
- **Endpoint:** `POST /api/v1/auth/logout`
- **Quyền:** Yêu cầu Header `Authorization: Bearer <accessToken>`
- **Response (204 No Content)**.

### 3.9 Thông tin tài khoản hiện tại (Current User)
- **Endpoint:** `GET /api/v1/auth/me`
- **Quyền:** Yêu cầu Header `Authorization: Bearer <accessToken>`
- **Response (200 OK):**
  ```json
  {
    "id": "6709765f02bc503a4c511234",
    "fullName": "Khách Hàng Lê Văn C",
    "email": "customer.levanc@gmail.com",
    "phone": "0905555555",
    "systemRole": "CUSTOMER",
    "staffSubRole": null,
    "accountStatus": "ACTIVE",
    "activationStatus": "ACTIVATED",
    "lastLogin": "2026-10-11T15:00:00.000Z",
    "branchScope": []
  }
  ```

### 3.10 Cập nhật thông tin cá nhân
- **Endpoint:** `PUT /api/v1/auth/me`
- **Quyền:** Yêu cầu Header `Authorization: Bearer <accessToken>`
- **Request Body (chỉ cho phép các trường này):**
  ```json
  {
    "fullName": "Nguyễn Văn Đẹp Trai",
    "email": "deptrai@example.com",
    "avatarUrl": "https://example.com/avatar.jpg"
  }
  ```

### 3.11 Đổi mật khẩu
- **Endpoint:** `POST /api/v1/auth/change-password`
- **Quyền:** Yêu cầu Header `Authorization: Bearer <accessToken>`
- **Request Body:**
  ```json
  {
    "oldPassword": "Customer@1234",
    "newPassword": "NewPassword@123",
    "confirmPassword": "NewPassword@123"
  }
  ```

---

## 4. Quản lý tài khoản nội bộ (`/api/v1/admin/users`)

Dành cho ứng dụng **Admin Angular / Admin Web**:

| Method | Endpoint | Quyền hạn | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | `ADMIN`, `MANAGER` | Lấy danh sách người dùng (MANAGER tự động bị giới hạn theo chi nhánh) |
| `GET` | `/api/v1/admin/users/:id` | `ADMIN`, `MANAGER` | Xem chi tiết 1 người dùng |
| `POST` | `/api/v1/admin/users` | `ADMIN` only | Tạo tài khoản nội bộ (`STAFF`, `MANAGER`, `ADMIN`) |
| `PUT` | `/api/v1/admin/users/:id/status` | `ADMIN` only | Khóa / Kích hoạt tài khoản (`BLOCKED`, `ACTIVE`, `DEACTIVATED`) |
| `PUT` | `/api/v1/admin/users/:id/role` | `ADMIN` only | Đổi vai trò hoặc chi nhánh làm việc |

---

## 5. Định dạng lỗi chuẩn RFC 9457 Problem Details

Khi xảy ra lỗi (4xx, 5xx), Backend luôn trả về cấu trúc đồng nhất:
```json
{
  "type": "https://httpstatuses.com/403",
  "title": "Forbidden",
  "status": 403,
  "code": "ACCOUNT_BLOCKED",
  "detail": "Account has been blocked. Please contact support.",
  "correlationId": "5f134888-eb09-4598-a38f-a9cb02e1b12b",
  "instance": "/api/v1/auth/login"
}
```

Các mã lỗi (`code`) phổ biến để FE bắt và hiển thị thông báo tương ứng:
- `INVALID_CREDENTIALS` (401): Sai số điện thoại hoặc mật khẩu.
- `TOKEN_EXPIRED` (401): Access token hết hạn (kích hoạt refresh).
- `TOKEN_REUSE_DETECTED` (401): Phát hiện bảo mật (bắt người dùng đăng nhập lại).
- `ACCOUNT_NOT_ACTIVATED` (403): Chưa xác thực OTP (chuyển sang màn hình nhập OTP).
- `ACCOUNT_BLOCKED` (403): Tài khoản bị quản trị viên khóa.
- `ACCOUNT_LOCKED` (423): Nhập sai 5 lần, tạm khóa 30 phút.
- `OTP_EXPIRED` (400): Mã OTP hết hạn (quá 5 phút).
- `MAX_OTP_ATTEMPTS_EXCEEDED` (429): Quá 5 lần nhập sai OTP.
- `OTP_COOLDOWN` (429): Chưa hết 30s thời gian chờ gửi lại OTP.
- `PASSWORD_TOO_WEAK` (400): Mật khẩu không đủ 8 ký tự, chữ hoa và số.
