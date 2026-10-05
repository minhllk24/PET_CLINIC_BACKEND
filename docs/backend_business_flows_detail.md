# 📋 PET CLINIC BACKEND - Mô tả chi tiết các luồng nghiệp vụ

> Tài liệu này cung cấp **toàn bộ thông tin backend** phục vụ cho việc:
> - Vẽ System Architecture
> - Thiết kế Collection/Schema, relationship, index
> - Viết API Contract
> - Map UI field ↔ API field ↔ DB field

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

### 1.1 Tech Stack

| Layer | Technology | Version | Ghi chú |
|-------|-----------|---------|---------|
| Runtime | Node.js | LTS | Babel transpile ES6+ |
| Framework | Express.js | ^4.21 | REST API |
| ORM | Prisma | ^5.14 | MySQL adapter |
| Database | MySQL | 8.x | `DATABASE_URL` env |
| Auth | JWT (jsonwebtoken) | ^9.0 | Access + Refresh token |
| Password | bcryptjs | ^2.4 | Hash + Compare |
| Email | Nodemailer | ^6.9 | Gmail SMTP |
| File Upload | Multer | ^2.1 | Disk storage → `public/uploads/` |
| Cron | node-cron | ^4.5 | Scheduled tasks |
| Build | Babel | ^7.26 | `@babel/preset-env` |

### 1.2 Tầng kiến trúc (3 layers)

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (React)                     │
│         Customer UI  /  Admin Dashboard              │
└──────────────┬──────────────────────┬───────────────┘
               │ HTTP / REST          │
               ▼                      ▼
┌─────────────────────────────────────────────────────┐
│                 API SERVER (Express)                  │
│                                                      │
│  ┌─────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ Routes  │→ │Controllers │→ │   Services      │  │
│  │ api.js  │  │ *Controller│  │ *APIService.js  │  │
│  └─────────┘  └────────────┘  └────────┬────────┘  │
│                                         │           │
│  ┌─────────────────┐  ┌───────────────┐ │           │
│  │   Middleware     │  │    Utils      │ │           │
│  │ - authMiddleware │  │ - jwt         │ │           │
│  │ - uploadMiddleware│ │ - email       │ │           │
│  │ - CORS           │  │ - otp         │ │           │
│  └─────────────────┘  │ - password    │ │           │
│                        └───────────────┘ │           │
└─────────────────────────────────────────┼───────────┘
                                          │
               ┌──────────────────────────┼──────────┐
               │         Prisma ORM       │          │
               │         prisma.js        ▼          │
               │  ┌──────────────────────────────┐   │
               │  │     MySQL Database            │   │
               │  │     pet_clinic_db             │   │
               │  │   (45+ tables, 50+ enums)     │   │
               │  └──────────────────────────────┘   │
               └─────────────────────────────────────┘

         External Services:
         ┌─────────────────┐  ┌──────────────────┐
         │  Gmail SMTP     │  │  PayPal (env)    │
         │  (Nodemailer)   │  │  (placeholder)   │
         └─────────────────┘  └──────────────────┘
```

### 1.3 Base URL & Response Format

```
Base URL:  http://localhost:8080/api/v1
```

**Chuẩn response cho TẤT CẢ API:**
```json
{
  "EM": "Thông điệp mô tả kết quả (string)",
  "EC": 0,       // 0 = success, <0 = system error, >0 = business error
  "DT": {}       // Data trả về (object/array/string)
}
```

**Error Code Convention:**
| EC | Ý nghĩa |
|----|---------|
| `0` | Thành công |
| `1` | Validation error / Missing params |
| `2` | Business logic error (duplicate, not eligible, etc.) |
| `3` | Password validation error |
| `-1` | Not found / Permission denied |
| `-2` | Internal server error |
| `-999` | Authentication error (token invalid/expired) |

### 1.4 Authentication Flow

```
                  ┌─────────┐
                  │ Client  │
                  └────┬────┘
                       │ POST /login
                       ▼
           ┌───────────────────────┐
           │ Verify email/phone    │
           │ + password (bcrypt)   │
           │ Check: status=active  │
           │ Check: failed_login<5 │
           └───────────┬──────────┘
                       │ OK
                       ▼
           ┌───────────────────────┐
           │ Generate:             │
           │ - Access Token (15m)  │
           │ - Refresh Token (30d) │
           │ Save UserSession      │
           └───────────┬──────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │ Response: tokens +    │
           │ user payload          │
           └───────────────────────┘

JWT Payload = { user_id, role_code, email, full_name, require_password_change }
```

**Roles trong hệ thống:**
| role_code | Tên | Quyền |
|-----------|-----|-------|
| `CUSTOMER` | Khách hàng | Tất cả API `/api/v1/*` có `verifyToken` |
| `ADMIN` | Quản trị viên | Full quyền + `checkPermission(['ADMIN'])` |
| `STAFF` | Nhân viên | Order/Payment/Appointment status update |
| `DOCTOR` | Bác sĩ | Appointment status update |

**Middleware Authorization:**
```
verifyToken          → Xác thực Bearer token, gắn req.user
checkPermission([])  → Kiểm tra role_code trong whitelist
optionalAuth         → Parse token nếu có, không bắt buộc
```

---

## 2. DỊCH VỤ BÊN NGOÀI (External Services)

| Service | Dùng cho | Config |
|---------|----------|--------|
| **Gmail SMTP** (Nodemailer) | Gửi OTP, thông báo tài khoản guest, nhắc lịch hẹn | `EMAIL_APP`, `EMAIL_APP_PASSWORD` |
| **PayPal** | Thanh toán online (placeholder, chưa tích hợp thực) | `PAYPAL_CLIENT_ID` |
| **ZaloPay** | Mock payment URL cho repay | Sandbox URL (mock) |

### Cron Jobs

| Schedule | Tác vụ | Chi tiết |
|----------|--------|----------|
| `0 0 * * *` (Mỗi ngày 0:00) | Tự động tạo TimeSlots | Tạo slots cho 7 ngày tiếp theo |
| `0 * * * *` (Mỗi giờ) | Nhắc lịch hẹn 24h | Gửi email + tạo notification cho appointment confirmed, sắp đến trong 24-25h |
| Server startup | Generate slots | Tạo slots ban đầu khi server khởi động |

---

## 3. CÁC LUỒNG NGHIỆP VỤ CHÍNH

### 3.1 🔐 Module: Authentication & User Management

#### 3.1.1 Register (Đăng ký)

**Flow:**
1. Client gửi `{ full_name, email?, phone?, password }`
2. Validate email/phone chưa tồn tại
3. Validate password (≥8 ký tự, có chữ hoa + số)
4. Tạo user với `status: inactive`, role = CUSTOMER
5. Generate OTP (6 chữ số), lưu vào `otp_codes` (expires: 5 phút, resend: 60s)
6. Gửi OTP qua email (hoặc mock SMS cho phone)
7. Client gọi `/verify-register-otp` với `{ login_id, otp_code }`
8. Verify OTP → cập nhật `user.status = active`

#### 3.1.2 Login

**Flow:**
1. Client gửi `{ login_id, password, remember_me? }`
2. Tìm user bằng email HOẶC phone
3. Check status = active, failed_login_count < 5
4. Compare password (bcrypt)
5. Nếu sai → `failed_login_count++`, nếu ≥5 → khóa
6. Nếu đúng → reset `failed_login_count = 0`
7. Tạo Access Token (15m) + Refresh Token (30d)
8. Lưu UserSession (remember_me → 30 ngày, không → 1 ngày)

#### 3.1.3 Forgot/Reset Password

**Flow:**
1. `POST /forgot-password` → Gửi OTP tới email
2. `POST /verify-otp` → Xác thực OTP → Trả reset_token (JWT)
3. `POST /reset-password` → Dùng reset_token + newPassword → Cập nhật password, revoke tất cả sessions

#### 3.1.4 Guest Checkout (Tạo tài khoản tự động)

**Flow:**
1. Khách mua hàng không cần đăng nhập
2. Hệ thống tạo user (active, `require_password_change: true`)
3. Auto-generate password → gửi email thông tin tài khoản
4. Tạo order + payment trong 1 transaction

---

### 3.2 🐾 Module: Pet Profile

**Flow:**
1. Customer tạo/quản lý hồ sơ thú cưng
2. Chọn species (loài) → breed (giống)
3. Upload ảnh pet (PetImage, is_primary)
4. Thông tin weight_kg ảnh hưởng đến phụ thu dịch vụ grooming

**Liên kết:**
- Pet → Appointments, MedicalRecords, HealthDiary, Reminders, AiChatSession
- Species/Breed là master data (seed)

---

### 3.3 📅 Module: Appointment (Đặt lịch khám/grooming)

#### Flow chính (3 bước tách biệt hoặc 1 bước gộp):

**Cách 1: Tách (Create → Checkout)**
1. `POST /appointments` - Tạo lịch hẹn (status: pending, payment: unpaid)
2. `POST /appointments/:id/checkout` - Xác nhận thanh toán

**Cách 2: Gộp (Book & Checkout)**
1. `POST /appointments/book` - Tạo lịch + checkout cùng lúc

**Chi tiết flow tạo lịch:**
```
Client gửi request
  ↓
Validate: slot_id, service_ids, customer_name_snapshot
  ↓
Transaction bắt đầu:
  1. Lock & check TimeSlot (status=available, booked_count < max_booking)
  2. Validate service compatibility:
     - Tất cả services phải cùng 1 loại (exam HOẶC grooming)
     - SlotType phải khớp với loại dịch vụ
  3. Tăng booked_count trên slot (nếu full → status='full')
  4. Pet handling:
     - Nếu có pet_id + pet_data → update pet info
     - Nếu có pet_id không pet_data → lấy info hiện tại
     - Nếu chỉ có pet_data → tạo pet mới
  5. Tạo Appointment (snapshot customer name, phone, pet info)
  6. Tính phụ thu cân nặng qua ServicePriceMatrix:
     - Tìm weight range phù hợp
     - Surcharge = actualPrice - standardPrice (mức cân đầu tiên)
     - Nếu is_contact=true → reject (phải liên hệ trực tiếp)
  7. Tạo AppointmentService records
  8. Log AppointmentStatusHistory
Transaction kết thúc
```

**Checkout flow:**
```
1. Tính pricing (subtotal + surcharge - voucher discount)
2. Tạo Order (order_type = 'appointment')
3. Tạo OrderItems (item_type = 'service')
4. Tạo Payment record
5. Tạo VoucherUsage (nếu có)
6. Cập nhật appointment.payment_status
7. Log status history + tạo notification
```

**Trạng thái Appointment:**
```
pending → confirmed → completed
       ↘ cancelled
       ↘ rescheduled (→ có thể confirmed lại)
       ↘ missed (nhân viên đánh dấu)
```

**Reschedule flow:**
- Chỉ cho phép khi status = pending/confirmed VÀ payment = unpaid/waiting_store_payment
- Nhả slot cũ (booked_count--) → chiếm slot mới (booked_count++)
- Validate slot_type compatibility

**No-show rule:**
- Cancel trong 24h trước hẹn → `user.no_show_count++`
- Missed → `user.no_show_count++` + notification lần đầu

---

### 3.4 🛒 Module: Product & Cart

**Product hierarchy:**
```
ProductCategory (có parent → tree structure)
  └── Product
        ├── ProductImage (is_primary)
        ├── ProductVariant (variant_name, price, stock)
        └── FlashSaleItem (discount_price, stock riêng)
```

**Cart flow:**
1. Customer thêm sản phẩm vào cart (`POST /cart`)
2. Mỗi user có 1 active cart
3. CartItem chứa product_id, variant_id?, quantity, is_selected
4. Chỉ checkout các items có `is_selected = true`

**Lưu ý:** Frontend cũng hỗ trợ localStorage cart → gửi `items[]` trực tiếp khi checkout

---

### 3.5 💰 Module: Order & Payment

#### 3.5.1 Product Checkout

**Flow:**
```
POST /orders/checkout
  ↓
Validate: address_id, payment_method
  ↓
Lấy cart items (DB hoặc items[] trực tiếp)
  ↓
Kiểm tra stock (product hoặc variant)
  ↓
Tính giá: subtotal, voucher discount, shipping fee
  - Shipping: subtotal >= 500,000đ → free ship, < 500k → 30,000đ
  ↓
Transaction:
  1. Tạo Order (order_type='product')
  2. Tạo OrderItems + snapshot item_name
  3. Giảm stock (product.stock_quantity-- hoặc variant.stock_quantity--)
  4. Tăng sold_quantity
  5. Tạo Payment record
  6. Tạo VoucherUsage + giảm remaining_usage
  7. Xóa CartItems đã checkout (nếu dùng DB cart)
```

#### 3.5.2 Guest Checkout

**Giống Product Checkout nhưng thêm:**
1. Check email/phone đã tồn tại (nếu inactive → xóa, nếu active → reject)
2. Tạo user mới (active, require_password_change=true)
3. Tạo UserAddress
4. Tạo Order + Payment
5. Gửi email tài khoản tự động (email + generated password)

#### 3.5.3 Order Status Flow

```
pending → confirmed → shipping → completed
       ↘ cancelled (bởi admin/customer)
```

**Cancel rule:**
- Customer chỉ hủy được khi status = pending | confirmed
- Cancel → hoàn stock (increment stock_quantity, decrement sold_quantity)
- Nếu có variant → hoàn stock variant riêng

**Repay (Thanh toán lại):**
- Chỉ cho phép khi `payment_status = unpaid` VÀ `order_status != cancelled`
- Tìm payment pending/failed → update, hoặc tạo payment mới
- Trả về mock payment URL

#### 3.5.4 Payment Status Flow

```
pending → paid / failed / cancelled
waiting_store_payment → paid (staff confirm)
paid → refunded
```

**Payment methods:**
- `cod` (Cash on delivery)
- `online` (Banking/VNPay/Momo)
- `store` (Thanh toán tại cửa hàng)

---

### 3.6 🏥 Module: Medical Records

**Flow:**
1. Doctor/Staff tạo hồ sơ bệnh án cho pet sau khám
2. Có thể đính kèm files (attachments, max 5 files)
3. Tạo kê đơn thuốc (Prescription → PrescriptionItems)
4. Link tới appointment nếu có
5. `is_locked_for_customer` → customer không thể sửa hồ sơ bác sĩ tạo

**Source types:** `doctor_created`, `user_uploaded`, `system_imported`

---

### 3.7 📔 Module: Health Diary & Reminders

**Health Diary:**
- Customer ghi nhật ký sức khỏe cho pet
- Có icon_code, color_code cho UI display
- Đính kèm files (medical_file, invoice, other)

**Reminders:**
- Lời nhắc tiêm phòng, tẩy giun, tái khám
- `remind_before_days` (mặc định 3 ngày)
- Status: pending → completed / cancelled

---

### 3.8 ⭐ Module: Reviews

**Flow:**
1. Customer tạo review cho product hoặc service
2. Review polymorphic: `target_type` (product/service) + `target_id`
3. Hỗ trợ reply (nested reviews via `parent_id`)
4. Like/Unlike toggle
5. Admin có thể reject/delete review

**Check can review:** Kiểm tra user đã mua/sử dụng sản phẩm/dịch vụ chưa

---

### 3.9 🎁 Module: Vouchers & Loyalty

**Voucher:**
- `discount_type`: percent / fixed
- `target_type`: all / order / appointment
- Validate: start_at, end_at, min_order_amount, remaining_usage, user đã dùng chưa
- 1 user chỉ dùng 1 voucher 1 lần

**Loyalty Points:**
- LoyaltyAccount: `current_points`, `lifetime_points`
- Transactions: earn / redeem / refund / adjust
- Link tới Payment

---

### 3.10 📝 Module: Content (Blog, First Aid, AI Chat)

**Posts:**
- PostType: `official_blog` / `community`
- PostStatus: draft → published / hidden / deleted
- Support: featured, trending, like, comment (nested)

**First Aid Guides:**
- Category → Guide → Steps (ordered) + Media
- Guide có: situation_description, emergency_phone, video_url

**AI Chat Sessions:**
- SessionType: general / symptom
- Messages: user ↔ AI (+ system)
- is_emergency_warning flag

---

### 3.11 🐕 Module: Rescue & Adoption

**Rescue:**
- RescuePost: Bài viết về cứu hộ (admin tạo)
- RescueStation: Trạm cứu hộ (master data)

**Adoption:**
- AdoptionPet: Thú cưng cần nhận nuôi (admin tạo, có images)
- AdoptionRequest: Đơn xin nhận nuôi (customer gửi)
  - Status: pending → approved / rejected / cancelled
  - Admin review: reviewed_by_admin_id, rejection_reason

---

### 3.12 🔍 Module: Search & Contact & Notifications

**Search:**
- Unified search endpoint (`GET /search`)
- SearchScope: all / product / service / appointment / blog / rescue / adoption
- Log search history (SearchLog)

**Contact:**
- Form liên hệ (guest, không cần auth)
- Admin xem danh sách (`GET /contacts`)

**Notifications:**
- In-app notifications (user_id, title, content)
- message_parts (JSON) cho structured content
- Mark as read (single/all)

---

## 4. DATABASE SCHEMA CHI TIẾT

### 4.1 Datasource

```
Provider: MySQL
URL: mysql://root:123456@localhost:3306/pet_clinic_db
ORM: Prisma (generator: prisma-client-js)
ID type: BigInt (autoincrement)
```

### 4.2 Danh sách Models & Fields

> Ghi chú: `PK` = Primary Key, `FK` = Foreign Key, `UQ` = Unique, `IDX` = Indexed, `REQ` = Required (NOT NULL), `OPT` = Optional (nullable)

---

#### IDENTITY & ACCESS

**roles**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| role_id | BigInt | PK, auto | |
| role_code | VarChar(50) | UQ, REQ | CUSTOMER, ADMIN, STAFF, DOCTOR |
| role_name | VarChar(100) | REQ | |
| description | VarChar(255) | OPT | |
| created_at | DateTime | default(now) | |

**users**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| user_id | BigInt | PK, auto | |
| role_id | BigInt | FK→roles, REQ, IDX | |
| full_name | VarChar(150) | REQ | |
| email | VarChar(150) | UQ, OPT, IDX | |
| phone | VarChar(20) | UQ, OPT, IDX | |
| password_hash | VarChar(255) | OPT | bcrypt hash |
| avatar_url | VarChar(500) | OPT | |
| status | Enum(active,inactive,disabled) | default(active) | |
| failed_login_count | Int | default(0) | ≥5 → lock |
| require_password_change | Boolean | default(false) | Guest accounts |
| no_show_count | Int | default(0) | Cancel sát giờ/missed |
| terms_accepted_at | DateTime | OPT | |
| created_at | DateTime | default(now) | |
| updated_at | DateTime | auto | |

**auth_providers**
| Field | Type | Constraint |
|-------|------|-----------|
| auth_provider_id | BigInt | PK, auto |
| user_id | BigInt | FK→users, IDX |
| provider_name | Enum(google,facebook) | REQ |
| provider_user_id | VarChar(255) | UQ (composite) |
| provider_email | VarChar(150) | OPT |
| created_at | DateTime | default(now) |

**otp_codes**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| otp_id | BigInt | PK, auto | |
| user_id | BigInt | FK→users, OPT, IDX | |
| email | VarChar(150) | OPT, IDX | |
| phone | VarChar(20) | OPT, IDX | |
| otp_code | VarChar(10) | REQ | 6 digits |
| purpose | Enum(register,forgot_password,change_email,change_phone) | REQ | |
| expires_at | DateTime | REQ | +5 minutes |
| resend_available_at | DateTime | OPT | +60 seconds |
| used_at | DateTime | OPT | Mark used |
| attempt_count | Int | default(0) | ≥5 → lock OTP |
| created_at | DateTime | default(now) | |

**user_sessions**
| Field | Type | Constraint |
|-------|------|-----------|
| session_id | BigInt | PK, auto |
| user_id | BigInt | FK→users, IDX |
| session_token | VarChar(500) | UQ (refresh token) |
| remember_me | Boolean | default(false) |
| ip_address | VarChar(50) | OPT |
| user_agent | VarChar(255) | OPT |
| expires_at | DateTime | REQ |
| revoked_at | DateTime | OPT |
| created_at | DateTime | default(now) |

**user_addresses**
| Field | Type | Constraint |
|-------|------|-----------|
| address_id | BigInt | PK, auto |
| user_id | BigInt | FK→users, IDX |
| recipient_name | VarChar(150) | REQ |
| recipient_phone | VarChar(20) | REQ |
| recipient_email | VarChar(255) | OPT |
| address_line | VarChar(255) | REQ |
| ward | VarChar(100) | OPT |
| district | VarChar(100) | OPT |
| province | VarChar(100) | OPT |
| country | VarChar(100) | OPT |
| is_default | Boolean | default(false) |
| created_at | DateTime | default(now) |

**notifications**
| Field | Type | Constraint |
|-------|------|-----------|
| notification_id | BigInt | PK, auto |
| user_id | BigInt | FK→users, IDX |
| pet_id | BigInt | FK→pets, OPT |
| notification_type | VarChar(100) | REQ |
| title | VarChar(255) | REQ |
| content | Text | OPT |
| message_parts | Json | OPT |
| searchable_text | Text | OPT |
| channel | Enum(in_app,email,sms) | default(in_app) |
| is_read | Boolean | default(false) |
| sent_at | DateTime | OPT |
| created_at | DateTime | default(now) |

---

#### PET PROFILE

**pet_species**
| Field | Type | Constraint |
|-------|------|-----------|
| species_id | BigInt | PK, auto |
| species_name | VarChar(100) | UQ |
| status | Enum(active,inactive) | default(active) |

**pet_breeds**
| Field | Type | Constraint |
|-------|------|-----------|
| breed_id | BigInt | PK, auto |
| species_id | BigInt | FK→pet_species |
| breed_name | VarChar(100) | UQ (composite: species_id + breed_name) |

**pets**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| pet_id | BigInt | PK, auto | |
| owner_user_id | BigInt | FK→users, IDX | |
| species_id | BigInt | FK→pet_species, IDX | |
| breed_id | BigInt | FK→pet_breeds, OPT, IDX | |
| pet_name | VarChar(100) | REQ, IDX | |
| gender | Enum(male,female,unknown) | default(unknown) | |
| birth_date | Date | OPT | |
| age | VarChar(100) | OPT | Free text ("2 tuổi") |
| weight_kg | Decimal(5,2) | OPT | Ảnh hưởng surcharge |
| profile_image_url | VarChar(500) | OPT | |
| health_status | Enum(healthy,treating,need_recheck,unknown) | default(unknown) | |
| medical_note | Text | OPT | |
| next_vaccination_date | Date | OPT | |
| status | Enum(active,deleted) | default(active) | Soft delete |
| created_at | DateTime | default(now) | |
| updated_at | DateTime | auto | |

**pet_images**
| Field | Type | Constraint |
|-------|------|-----------|
| pet_image_id | BigInt | PK, auto |
| pet_id | BigInt | FK→pets, IDX |
| image_url | VarChar(500) | REQ |
| is_primary | Boolean | default(false) |
| created_at | DateTime | default(now) |

---

#### CLINIC, DOCTOR, STAFF, SCHEDULE

**branches**
| Field | Type | Constraint |
|-------|------|-----------|
| branch_id | BigInt | PK, auto |
| branch_name | VarChar(150) | REQ |
| address | VarChar(255) | REQ |
| phone | VarChar(20) | OPT |
| email | VarChar(150) | OPT |
| operating_hours | VarChar(255) | OPT |
| latitude | Decimal(10,7) | OPT |
| longitude | Decimal(10,7) | OPT |
| status | Enum(active,inactive) | default(active) |

**staff_profiles**
| Field | Type | Constraint |
|-------|------|-----------|
| staff_id | BigInt | PK, auto |
| user_id | BigInt | FK→users, UQ |
| branch_id | BigInt | FK→branches, IDX |
| position | VarChar(100) | OPT |
| status | Enum(active,inactive) | default(active) |

**doctors**
| Field | Type | Constraint |
|-------|------|-----------|
| doctor_id | BigInt | PK, auto |
| user_id | BigInt | FK→users, UQ |
| branch_id | BigInt | FK→branches, IDX |
| doctor_name | VarChar(150) | OPT |
| bio | Text | OPT |
| avatar_url | VarChar(500) | OPT |
| average_rating | Decimal(3,2) | default(0.00) |
| status | Enum(active,inactive) | default(active) |

**specialties** + **doctor_specialties** (M-N relationship)

**time_slots**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| slot_id | BigInt | PK, auto | |
| doctor_id | BigInt | FK→doctors, OPT, IDX | |
| branch_id | BigInt | FK→branches, IDX | |
| slot_date | Date | REQ | Composite IDX (slot_type, branch_id, slot_date) |
| start_time | Time | REQ | |
| end_time | Time | REQ | |
| max_booking | Int | default(1) | |
| booked_count | Int | default(0) | |
| status | Enum(available,full,locked,inactive) | default(available) | |
| slot_type | Enum(exam,grooming) | default(exam) | Phải match service type |

---

#### SERVICES & APPOINTMENTS

**service_categories**
| Field | Type | Constraint |
|-------|------|-----------|
| service_category_id | BigInt | PK, auto |
| category_name | VarChar(150) | UQ |
| description | Text | OPT |
| status | Enum(active,inactive) | default(active) |

**services**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| service_id | BigInt | PK, auto | |
| service_category_id | BigInt | FK→service_categories, IDX | |
| service_name | VarChar(150) | REQ | |
| description | Text | OPT | |
| base_price | Decimal(12,2) | default(0.00) | Giá cơ bản |
| duration_minutes | Int | default(30) | |
| image_url | VarChar(500) | OPT | |
| average_rating | Decimal(3,2) | default(0.00) | |
| status | Enum(active,inactive) | default(active) | |
| target_species | Enum(dog,cat,all) | default(all) | |
| is_weight_surcharge_applied | Boolean | default(false) | Kích hoạt bảng giá theo cân |

**service_price_matrix** (Bảng giá theo cân nặng)
| Field | Type | Constraint |
|-------|------|-----------|
| id | BigInt | PK, auto |
| service_id | BigInt | FK→services, IDX |
| weight_min | Decimal(5,2) | OPT |
| weight_max | Decimal(5,2) | OPT |
| price | Decimal(12,2) | OPT |
| is_contact | Boolean | default(false) |

**service_surcharges** (Legacy, ít dùng)
| Field | Type | Constraint |
|-------|------|-----------|
| surcharge_id | BigInt | PK |
| service_id | BigInt | FK→services, IDX |
| condition_type | Enum(age,weight,other) | |
| min_value | Decimal(10,2) | OPT |
| max_value | Decimal(10,2) | OPT |
| surcharge_amount | Decimal(12,2) | default(0) |
| description | VarChar(255) | OPT |

**appointments**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| appointment_id | BigInt | PK, auto | |
| appointment_code | VarChar(50) | UQ | Format: BK-XXXXXX-YYYY |
| user_id | BigInt | FK→users, IDX | |
| pet_id | BigInt | FK→pets, OPT, IDX | |
| branch_id | BigInt | FK→branches, IDX | |
| doctor_id | BigInt | FK→doctors, OPT, IDX | |
| slot_id | BigInt | FK→time_slots, IDX | |
| customer_name_snapshot | VarChar(150) | REQ | Snapshot tại thời điểm đặt |
| customer_phone_snapshot | VarChar(20) | OPT | |
| pet_name_snapshot | VarChar(100) | OPT | |
| pet_species_snapshot | VarChar(100) | OPT | |
| pet_breed_snapshot | VarChar(100) | OPT | |
| appointment_date | Date | REQ, IDX | |
| start_time | Time | REQ | |
| note | Text | OPT | |
| condition_description | Text | OPT | Mô tả tình trạng |
| status | Enum(pending,confirmed,completed,cancelled,rescheduled,missed) | default(pending), IDX | |
| payment_status | Enum(unpaid,waiting_store_payment,paid,refunded,failed) | default(unpaid), IDX | |
| created_at | DateTime | default(now) | |
| updated_at | DateTime | auto | |

**appointment_services**
| Field | Type | Constraint |
|-------|------|-----------|
| appointment_service_id | BigInt | PK, auto |
| appointment_id | BigInt | FK→appointments, IDX |
| service_id | BigInt | FK→services, IDX |
| quantity | Int | default(1) |
| unit_price | Decimal(12,2) | default(0) |
| surcharge_amount | Decimal(12,2) | default(0) |
| total_price | Decimal(12,2) | default(0) |

**appointment_status_history**
| Field | Type | Constraint |
|-------|------|-----------|
| history_id | BigInt | PK, auto |
| appointment_id | BigInt | FK→appointments, IDX |
| old_status | VarChar(50) | OPT |
| new_status | VarChar(50) | REQ |
| changed_by_user_id | BigInt | FK→users, OPT, IDX |
| reason | Text | OPT |
| changed_at | DateTime | default(now) |

---

#### MEDICAL RECORDS

**medical_records**
| Field | Type | Constraint |
|-------|------|-----------|
| medical_record_id | BigInt | PK, auto |
| pet_id | BigInt | FK→pets, composite IDX (pet_id, visit_date) |
| appointment_id | BigInt | FK→appointments, OPT, IDX |
| doctor_id | BigInt | FK→doctors, OPT, IDX |
| record_name | VarChar(255) | REQ |
| visit_date | Date | REQ |
| symptoms | Text | OPT |
| diagnosis | Text | OPT |
| treatment_note | Text | OPT |
| created_by_user_id | BigInt | FK→users, IDX |
| source_type | Enum(doctor_created,user_uploaded,system_imported) | default(doctor_created) |
| is_locked_for_customer | Boolean | default(true) |
| created_at, updated_at | DateTime | auto |

**medical_record_attachments** (file_name, file_url, file_type, file_size_kb)

**prescriptions** (prescription_id, medical_record_id, doctor_id, note)
  → **prescription_items** (medicine_name, dosage, frequency, duration, instruction)

**pet_vaccination_history** (vaccine_name, vaccinated_date, next_due_date)

---

#### HEALTH DIARY & REMINDERS

**health_diary_entries** (pet_id, user_id, entry_date, entry_time, icon_code, color_code, title, content, status)
  → **health_diary_attachments** (file_name, file_url, file_type, attachment_group)

**pet_reminders** (pet_id, user_id, reminder_type, title, remind_date, remind_before_days, note, status, completed_at)

---

#### PRODUCTS, CARTS, ORDERS

**product_categories** (product_category_id, parent_id → self-referencing tree, category_name, image_url, status)

**products**
| Field | Type | Constraint |
|-------|------|-----------|
| product_id | BigInt | PK, auto |
| product_category_id | BigInt | FK→product_categories, IDX |
| product_name | VarChar(200) | REQ, IDX |
| description | Text | OPT |
| price | Decimal(12,2) | default(0) |
| original_price | Decimal(12,2) | OPT |
| sold_quantity | Int | default(0) |
| stock_quantity | Int | default(0) |
| average_rating | Decimal(3,2) | default(0) |
| status | Enum(active,inactive,out_of_stock) | default(active), IDX |
| target_species | Enum(dog,cat,all) | default(all) |
| created_at, updated_at | DateTime | auto |

**product_images** (product_id, image_url, is_primary)
**product_variants** (product_id, variant_name, price, original_price, stock_quantity)

**carts** (user_id, status=active/checked_out/abandoned)
**cart_items** (cart_id, product_id, variant_id?, quantity, unit_price, is_selected)

**vouchers**
| Field | Type | Constraint |
|-------|------|-----------|
| voucher_id | BigInt | PK, auto |
| voucher_code | VarChar(50) | UQ |
| voucher_name | VarChar(150) | REQ |
| discount_type | Enum(percent,fixed) | REQ |
| discount_value | Decimal(12,2) | REQ |
| max_discount_amount | Decimal(12,2) | OPT |
| min_order_amount | Decimal(12,2) | default(0) |
| target_type | Enum(all,order,appointment) | default(all) |
| start_at, end_at | DateTime | REQ |
| total_usage_limit | Int | OPT |
| remaining_usage | Int | OPT |
| status | Enum(active,inactive,expired) | default(active) |
| created_at | DateTime | default(now) |

**orders**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| order_id | BigInt | PK, auto | |
| order_code | VarChar(50) | UQ | ORD-{timestamp}-{random} |
| order_type | Enum(product,appointment) | default(product) | |
| user_id | BigInt | FK→users, IDX | |
| appointment_id | BigInt | FK→appointments, OPT, IDX | Cho order type=appointment |
| address_id | BigInt | FK→user_addresses, OPT, IDX | |
| voucher_id | BigInt | FK→vouchers, OPT, IDX | |
| recipient_name | VarChar(150) | OPT | Snapshot |
| recipient_phone | VarChar(20) | OPT | Snapshot |
| shipping_address | VarChar(255) | OPT | Snapshot chuỗi đầy đủ |
| subtotal_amount | Decimal(12,2) | default(0) | |
| discount_amount | Decimal(12,2) | default(0) | Voucher discount |
| points_discount_amount | Decimal(12,2) | default(0) | Loyalty points |
| shipping_fee | Decimal(12,2) | default(0) | |
| total_amount | Decimal(12,2) | default(0) | subtotal + shipping - discount |
| order_status | Enum(pending,confirmed,shipping,completed,cancelled) | default(pending), IDX | |
| payment_status | Enum(unpaid,paid,failed,refunded) | default(unpaid) | |
| note | Text | OPT | |
| created_at, updated_at | DateTime | auto | |

**order_items**
| Field | Type | Constraint |
|-------|------|-----------|
| order_item_id | BigInt | PK, auto |
| order_id | BigInt | FK→orders, IDX |
| product_id | BigInt | FK→products, OPT, IDX |
| variant_id | BigInt | FK→product_variants, OPT, IDX |
| service_id | BigInt | FK→services, OPT, IDX |
| item_type | Enum(product,service) | default(product) |
| item_name_snapshot | VarChar(200) | REQ |
| quantity | Int | default(1) |
| unit_price | Decimal(12,2) | default(0) |
| total_price | Decimal(12,2) | default(0) |

**order_status_history** (order_id, old_status, new_status, changed_by_user_id, note, changed_at)

---

#### PAYMENTS, RECEIPTS, REFUNDS, LOYALTY

**payments**
| Field | Type | Constraint |
|-------|------|-----------|
| payment_id | BigInt | PK, auto |
| payment_code | VarChar(50) | UQ |
| user_id | BigInt | FK→users, IDX |
| order_id | BigInt | FK→orders, IDX |
| appointment_id | BigInt | FK→appointments, OPT, IDX |
| payment_target_type | Enum(order,appointment) | default(order) |
| payment_method | Enum(cod,online,store) | REQ |
| payment_gateway | VarChar(100) | OPT |
| gateway_transaction_id | VarChar(255) | OPT |
| subtotal_amount | Decimal(12,2) | default(0) |
| voucher_discount_amount | Decimal(12,2) | default(0) |
| points_used | Int | default(0) |
| points_discount_amount | Decimal(12,2) | default(0) |
| final_amount | Decimal(12,2) | default(0) |
| status | Enum(pending,waiting_store_payment,paid,failed,refunded,cancelled) | default(pending), IDX |
| confirmed_by_staff_id | BigInt | FK→staff_profiles, OPT, IDX |
| paid_at | DateTime | OPT |
| created_at | DateTime | default(now) |

**receipts** (payment_id UQ, receipt_code UQ, receipt_url, issued_at, created_by_user_id)
**refunds** (payment_id, refund_code UQ, amount, reason, status, processed_by_user_id, processed_at)
**voucher_usages** (voucher_id, user_id, payment_id, discount_amount, used_at)
**loyalty_accounts** (user_id UQ, current_points, lifetime_points)
**loyalty_point_transactions** (user_id, payment_id?, transaction_type, points, money_value, description)

---

#### REVIEWS

**reviews**
| Field | Type | Constraint | Ghi chú |
|-------|------|-----------|---------|
| review_id | BigInt | PK, auto | |
| user_id | BigInt | FK→users, IDX | |
| target_type | Enum(product,service) | REQ | Polymorphic |
| target_id | BigInt | REQ, composite IDX(target_type, target_id) | |
| order_id | BigInt | FK→orders, OPT, IDX | |
| rating | TinyInt | REQ | 1-5 |
| comment | Text | OPT | |
| status | Enum(posted,rejected,deleted) | default(posted) | |
| admin_note | Text | OPT | |
| reviewed_by_admin_id | BigInt | FK→users, OPT, IDX | |
| reviewed_at | DateTime | OPT | |
| created_at | DateTime | default(now) | |
| likes_count | Int | default(0) | |
| parent_id | BigInt | FK→reviews, OPT, IDX | Self-reference (replies) |

**review_images** (review_id, image_url)
**review_likes** (user_id + review_id = composite PK)

---

#### BLOG & COMMUNITY

**post_categories** (category_name UQ, status)

**posts**
| Field | Type | Constraint |
|-------|------|-----------|
| post_id | BigInt | PK, auto |
| post_category_id | BigInt | FK→post_categories, IDX |
| author_user_id | BigInt | FK→users, IDX |
| post_type | Enum(official_blog,community) | REQ |
| title | VarChar(255) | REQ |
| slug | VarChar(255) | UQ |
| thumbnail_url | VarChar(500) | OPT |
| excerpt | VarChar(500) | OPT |
| content | LongText | OPT |
| is_featured | Boolean | default(false) |
| likes_count | Int | default(0) |
| hashtags | VarChar(255) | OPT |
| status | Enum(draft,published,hidden,deleted) | default(draft) |
| view_count | Int | default(0) |
| created_at, updated_at | DateTime | auto |

**post_comments** (post_id, user_id, parent_comment_id?, content, status)
**post_likes** (user_id + post_id = composite PK)

---

#### FIRST AID, RESCUE, ADOPTION, AI CHAT, SEARCH, FLASH SALE, CONTACT

(Đã mô tả trong phần Schema. Các bảng bổ sung:)

- **first_aid_categories**, **first_aid_guides**, **first_aid_steps**, **first_aid_media**
- **rescue_posts**, **rescue_stations**
- **adoption_pets**, **adoption_pet_images**, **adoption_requests**
- **ai_chat_sessions**, **ai_chat_messages**
- **search_logs**
- **flash_sales**, **flash_sale_items** (UQ: flash_sale_id + product_id)
- **contact_messages** (name, gender?, phone, email, message, status=unread)

---

## 5. API CONTRACT CHI TIẾT

### 5.1 Auth APIs

| Method | Endpoint | Auth | Role | Request Body | Response DT | Validation |
|--------|----------|------|------|-------------|-------------|------------|
| POST | `/register` | ❌ | - | `{ full_name, email?, phone?, password }` | `""` | password: ≥8, ≥1 uppercase, ≥1 digit; email/phone unique |
| POST | `/verify-register-otp` | ❌ | - | `{ login_id, otp_code }` | `""` | OTP valid, not expired, attempt<5 |
| POST | `/login` | ❌ | - | `{ login_id, password, remember_me? }` | `{ access_token, refresh_token, user }` | status=active, failed_login<5 |
| POST | `/logout` | ❌ | - | Cookie / Header | `""` | - |
| POST | `/refresh` | ❌ | - | `{ refresh_token }` | `{ access_token }` | session exists, not revoked, not expired |
| POST | `/forgot-password` | ❌ | - | `{ email }` | `""` | email exists, resend cooldown 60s |
| POST | `/verify-otp` | ❌ | - | `{ email, otp_code }` | `{ reset_token }` | - |
| POST | `/reset-password` | ❌ | - | `{ reset_token, new_password }` | `""` | Token valid |
| POST | `/change-password` | ✅ | Any | `{ old_password, new_password }` | `""` | Old password correct, new password valid |

### 5.2 User APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/users` | ✅ | ADMIN | `?page=&limit=` | `{ totalRows, totalPages, users[] }` |
| GET | `/users/:id` | ✅ | Any | - | `{ user object }` |
| PUT | `/users/:id` | ✅ | Any | `{ full_name, email, phone, avatar_url }` | `{ updated user }` |
| DELETE | `/users/:id` | ✅ | ADMIN | - | `""` |
| GET | `/users/:id/addresses` | ✅ | Any | - | `[address]` |
| POST | `/users/:id/addresses` | ✅ | Any | `{ recipient_name, recipient_phone, address_line, ward, district, province, is_default }` | `{ new address }` |
| PUT | `/addresses/:addressId` | ✅ | Any | Same as create | `{ updated address }` |
| DELETE | `/addresses/:addressId` | ✅ | Any | - | `""` |
| GET | `/doctors` | ❌ | - | - | `[doctor with user info]` |

### 5.3 Pet APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/pets/species` | ❌ | - | - | `[{ species_id, species_name }]` |
| GET | `/pets/breeds` | ❌ | - | `?species_id=` | `[{ breed_id, breed_name, species_id }]` |
| GET | `/my-pets` | ✅ | Any | - | `[pet with species, breed, images]` |
| GET | `/pets/:id` | ✅ | Any | - | `{ pet detail }` |
| POST | `/pets` | ✅ | Any | `{ pet_name, species_id, breed_id?, gender?, weight_kg?, age?, profile_image_url?, medical_note? }` | `{ new pet }` |
| PUT | `/pets/:id` | ✅ | Any | Same as create | `{ updated pet }` |
| DELETE | `/pets/:id` | ✅ | Any | - | `""` (soft delete: status=deleted) |

### 5.4 Product & Category APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/categories` | ❌ | - | - | `[category tree with children]` |
| POST | `/categories` | ✅ | ADMIN | `{ category_name, parent_id?, image_url? }` | `{ new category }` |
| PUT | `/categories/:id` | ✅ | ADMIN | Same | `{ updated }` |
| DELETE | `/categories/:id` | ✅ | ADMIN | - | `""` |
| GET | `/products` | ❌ | - | `?page=&limit=&category_id=&sort=&keyword=&status=&species=` | `{ totalRows, totalPages, products[] }` |
| GET | `/products/:id` | ❌ | - | - | `{ product with images, variants, flash_sale }` |
| GET | `/products/:id/related` | ❌ | - | - | `[related products]` |
| GET | `/products/:id/review-stats` | ❌ | - | - | `{ average, count, distribution }` |
| POST | `/products` | ✅ | ADMIN | `{ product_name, product_category_id, price, stock_quantity, description, images[], variants[]? }` | `{ new product }` |
| PUT | `/products/:id` | ✅ | ADMIN | Same | `{ updated }` |
| DELETE | `/products/:id` | ✅ | ADMIN | - | `""` |

### 5.5 Flash Sale APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/flash-sales/active` | ❌ | - | - | `{ flash_sale with items[] }` |
| POST | `/flash-sales` | ✅ | ADMIN | `{ name, start_time, end_time, items[{product_id, discount_price, stock_quantity}] }` | `{ new flash sale }` |
| PUT | `/flash-sales/:id` | ✅ | ADMIN | Same | `{ updated }` |
| DELETE | `/flash-sales/:id` | ✅ | ADMIN | - | `""` |

### 5.6 Cart APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/cart` | ✅ | Any | - | `{ cart with items[] }` |
| POST | `/cart` | ✅ | Any | `{ product_id, variant_id?, quantity? }` | `{ updated cart }` |
| PUT | `/cart/:item_id` | ✅ | Any | `{ quantity?, is_selected? }` | `{ updated item }` |
| DELETE | `/cart/:item_id` | ✅ | Any | - | `""` |

### 5.7 Order APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/orders` | ✅ | Any | `?page=&limit=&status=&order_type=` | `{ totalRows, totalPages, orders[] }` |
| GET | `/orders/counts` | ✅ | Any | - | `{ all, pending, confirmed, shipping, completed, cancelled }` |
| GET | `/orders/:id` | ✅ | Any | - | `{ order detail with items, payments, address, history }` |
| POST | `/orders/checkout` | ✅ | Any | `{ address_id, payment_method, voucher_code?, note?, items[]? }` | `{ new order }` |
| POST | `/orders/guest-checkout` | ❌ | - | `{ full_name, phone, email, address_line, ward?, district?, province, payment_method, voucher_code?, note?, items[] }` | `{ order + guest_account }` |
| PUT | `/orders/:id/status` | ✅ | ADMIN/STAFF | `{ status }` | `{ updated order }` |
| PATCH | `/orders/:id/cancel` | ✅ | Any | - | `""` |
| POST | `/orders/:id/repay` | ✅ | Any | `{ payment_method? }` | `{ payment_url, order_id }` |

### 5.8 Payment APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/payments` | ✅ | ADMIN | `?page=&limit=` | `{ payments[] }` |
| PUT | `/payments/:id/status` | ✅ | ADMIN/STAFF | `{ status }` | `{ updated payment }` |

### 5.9 Service & Branch APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/branches` | ❌ | - | - | `[branch]` |
| GET | `/services` | ❌ | - | `?category_id=&keyword=&species=` | `[service with category]` |
| GET | `/services/pricing-matrix` | ❌ | - | - | `{ matrix by service }` |
| GET | `/services/categories` | ❌ | - | - | `[service_category]` |
| GET | `/services/:id` | ❌ | - | - | `{ service detail with surcharges, price_matrix }` |
| POST | `/services` | ✅ | ADMIN | `{ service_name, service_category_id, base_price, duration_minutes, image_url? }` | `{ new service }` |
| PUT | `/services/:id` | ✅ | ADMIN | Same | `{ updated }` |
| DELETE | `/services/:id` | ✅ | ADMIN | - | `""` |

### 5.10 Appointment APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/appointments/my-history` | ✅ | Any | `?status=&keyword=&page=&limit=` | `{ total, page, limit, data[] }` |
| GET | `/appointments/my-history/counts` | ✅ | Any | - | `{ all, pending, confirmed, completed, cancelled, rescheduled, missed }` |
| GET | `/appointments/slots` | ❌ | - | `?date=&doctor_id=&branch_id=&service_type=` | `[slot with doctor_name]` |
| GET | `/appointments/:id/pricing` | ✅ | Any | `?voucher_code=` | `{ subtotal, surcharge_amount, discount_amount, total, services[], voucher_error? }` |
| GET | `/appointments/:id` | ✅ | Any | - | `{ appointment detail with all relations }` |
| POST | `/appointments` | ✅ | Any | `{ slot_id, pet_id?, pet_data?, service_ids[], customer_name_snapshot, customer_phone_snapshot?, note?, condition_description? }` | `{ new appointment }` |
| POST | `/appointments/:id/checkout` | ✅ | Any | `{ payment_method, voucher_code? }` | `{ appointment, order, payment }` |
| PATCH | `/appointments/:id/cancel` | ✅ | Any | `{ note? }` | `{ updated }` |
| PATCH | `/appointments/:id/reschedule` | ✅ | Any | `{ new_slot_id }` | `{ updated }` |
| PATCH | `/appointments/:id/status` | ✅ | ADMIN/STAFF/DOCTOR | `{ status, note? }` | `{ updated }` |
| POST | `/appointments/preview-pricing` | ❌ | - | `{ pet_data?, service_ids[], voucher_code? }` | `{ subtotal, surcharge, discount, total, services[] }` |
| POST | `/appointments/book` | ✅ | Any | `{ slot_id, pet_id?, pet_data?, service_ids[], customer_name/phone, note?, payment_method, voucher_code? }` | `{ appointment, order, payment }` |

### 5.11 Medical Record APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/medical-records/pet/:petId` | ✅ | Any | `?page=&limit=` | `{ records[] }` |
| GET | `/medical-records/:id` | ✅ | Any | - | `{ record detail with attachments, prescriptions }` |
| POST | `/medical-records` | ✅ | Any | `FormData: { pet_id, appointment_id?, record_name, visit_date, symptoms?, diagnosis?, treatment_note?, prescriptions[], attachments[] (max 5 files) }` | `{ new record }` |
| PUT | `/medical-records/:id` | ✅ | Any | Same as create | `{ updated record }` |
| DELETE | `/medical-records/:id` | ✅ | Any | - | `""` |

### 5.12 Health Diary & Reminder APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/health-diaries/pet/:petId` | ✅ | Any | `?page=&limit=` | `{ diaries[] }` |
| POST | `/health-diaries` | ✅ | Any | `FormData: { pet_id, entry_date, entry_time?, icon_code?, color_code?, title, content?, attachments[] }` | `{ new diary }` |
| PUT | `/health-diaries/:id` | ✅ | Any | Same | `{ updated }` |
| DELETE | `/health-diaries/:id` | ✅ | Any | - | `""` (soft: status=deleted) |
| GET | `/reminders/pet/:petId` | ✅ | Any | - | `[reminders]` |
| POST | `/reminders` | ✅ | Any | `{ pet_id, reminder_type, title, remind_date, remind_before_days?, note? }` | `{ new reminder }` |
| PATCH | `/reminders/:id/complete` | ✅ | Any | - | `{ updated }` |
| DELETE | `/reminders/:id` | ✅ | Any | - | `""` |

### 5.13 Review APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/reviews` | ❌ | - | `?page=&limit=&status=` | `{ reviews[] }` |
| GET | `/reviews/target/:targetType/:targetId` | ❌ | - | `?page=&limit=&sort=` | `{ reviews with images, user, replies }` |
| GET | `/reviews/can-review/:targetType/:targetId` | ✅ | Any | - | `{ can_review: bool }` |
| POST | `/reviews` | ✅ | Any | `{ target_type, target_id, rating, comment?, order_id?, images[]? }` | `{ new review }` |
| PATCH | `/reviews/:id/reject` | ✅ | ADMIN | `{ admin_note? }` | `{ updated }` |
| PATCH | `/reviews/:id/delete` | ✅ | ADMIN | - | `{ updated }` |
| POST | `/reviews/:id/like` | ✅ | Any | - | `{ liked/unliked, likes_count }` |
| POST | `/reviews/:id/reply` | ✅ | Any | `{ comment }` | `{ reply review }` |

### 5.14 Voucher & Loyalty APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/vouchers` | ✅ | ADMIN | - | `[vouchers]` |
| POST | `/vouchers` | ✅ | ADMIN | `{ voucher_code, voucher_name, discount_type, discount_value, max_discount_amount?, min_order_amount?, target_type?, start_at, end_at, total_usage_limit?, remaining_usage? }` | `{ new voucher }` |
| POST | `/vouchers/apply` | ✅ | Any | `{ voucher_code, order_amount }` | `{ discount_amount, voucher info }` |
| GET | `/loyalty/my-points` | ✅ | Any | - | `{ current_points, lifetime_points }` |
| GET | `/loyalty/transactions` | ✅ | Any | `?page=&limit=` | `{ transactions[] }` |

### 5.15 Content APIs (Posts, First Aid, AI Chat)

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/post-categories` | ❌ | - | - | `[categories]` |
| GET | `/posts/featured` | ❌ | - | - | `{ featured post }` |
| GET | `/posts/trending` | ❌ | - | - | `[trending posts]` |
| GET | `/posts` | ❌ | - | `?page=&limit=&category_id=&type=` | `{ posts[] }` |
| GET | `/posts/:slug` | ❌ | - | - | `{ post detail }` |
| POST | `/posts` | ✅ | Any | `{ title, content, post_type, post_category_id, thumbnail_url?, excerpt?, hashtags? }` | `{ new post }` |
| GET | `/posts/:id/comments` | ❌ | - | - | `[comments with replies]` |
| POST | `/posts/:id/comments` | ✅ | Any | `{ content }` | `{ new comment }` |
| POST | `/posts/comments/:commentId/reply` | ✅ | Any | `{ content }` | `{ reply }` |
| DELETE | `/posts/comments/:commentId` | ✅ | Any | - | `""` |
| POST | `/posts/:id/like` | ✅ | Any | - | `{ liked/unliked }` |
| GET | `/first-aid/categories` | ❌ | - | - | `[categories]` |
| GET | `/first-aid/guides` | ❌ | - | `?category_id=` | `[guides]` |
| GET | `/first-aid/guides/:slug` | ❌ | - | - | `{ guide with steps, media }` |
| POST | `/first-aid/guides` | ✅ | ADMIN | `{ title, first_aid_category_id, situation_description, steps[], media[]? }` | `{ new guide }` |
| GET | `/ai-chat/sessions` | ✅ | Any | - | `[sessions]` |
| POST | `/ai-chat/sessions` | ✅ | Any | `{ pet_id?, session_type?, ad_hoc_pet_info? }` | `{ new session }` |

### 5.16 Rescue & Adoption APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/rescue/stations` | ❌ | - | - | `[stations]` |
| GET | `/rescue/posts` | ❌ | - | - | `[rescue posts]` |
| GET | `/adoptions/pets` | ❌ | - | `?status=` | `[adoption pets with images]` |
| POST | `/adoptions/requests` | ✅ | Any | `{ adoption_pet_id, full_name, phone, gender?, birth_year?, address, reason, housing_info?, experience? }` | `{ new request }` |
| GET | `/adoptions/my-requests` | ✅ | Any | - | `[my requests]` |
| PATCH | `/adoptions/requests/:id/status` | ✅ | ADMIN | `{ status, rejection_reason? }` | `{ updated }` |

### 5.17 Search, Contact, Notification APIs

| Method | Endpoint | Auth | Role | Request | Response DT |
|--------|----------|------|------|---------|-------------|
| GET | `/search` | Optional | - | `?keyword=&scope=&page=&limit=` | `{ results by scope }` |
| GET | `/search/suggestions` | ❌ | - | `?keyword=` | `[suggestions]` |
| POST | `/contacts` | ❌ | - | `{ name, gender?, phone, email, message }` | `{ new contact }` |
| GET | `/contacts` | ✅ | ADMIN | `?page=&limit=` | `[contacts]` |
| GET | `/notifications` | ✅ | Any | `?page=&limit=` | `{ notifications[] }` |
| PATCH | `/notifications/read-all` | ✅ | Any | - | `""` |
| PATCH | `/notifications/:id/read` | ✅ | Any | - | `""` |

---

## 6. FIELD MAPPING: UI ↔ API ↔ DB

### 6.1 Module: User (Đăng ký / Hồ sơ)

| UI Field (Label) | API Request Field | API Response Field | DB Column (Table) |
|-------------------|-------------------|-------------------|-------------------|
| Họ tên | `full_name` | `full_name` | `users.full_name` |
| Email | `email` | `email` | `users.email` |
| Số điện thoại | `phone` | `phone` | `users.phone` |
| Mật khẩu | `password` | - (never returned) | `users.password_hash` |
| Ảnh đại diện | `avatar_url` | `avatar_url` | `users.avatar_url` |
| Vai trò | - | `role_code` | `roles.role_code` via `users.role_id` |
| Trạng thái | - | `status` | `users.status` |

### 6.2 Module: Pet (Hồ sơ thú cưng)

| UI Field | API Request Field | API Response Field | DB Column (Table) |
|----------|-------------------|-------------------|-------------------|
| Tên thú cưng | `pet_name` | `pet_name` | `pets.pet_name` |
| Loài | `species_id` | `species.species_name` | `pets.species_id` → `pet_species.species_name` |
| Giống | `breed_id` | `breed.breed_name` | `pets.breed_id` → `pet_breeds.breed_name` |
| Giới tính | `gender` | `gender` | `pets.gender` |
| Cân nặng (kg) | `weight_kg` | `weight_kg` | `pets.weight_kg` |
| Tuổi | `age` | `age` | `pets.age` |
| Ngày sinh | `birth_date` | `birth_date` | `pets.birth_date` |
| Ảnh đại diện | `profile_image_url` | `profile_image_url` | `pets.profile_image_url` |
| Tình trạng sức khỏe | `health_status` | `health_status` | `pets.health_status` |
| Ghi chú y tế | `medical_note` | `medical_note` | `pets.medical_note` |
| Ảnh thú cưng | - | `pet_images[].image_url` | `pet_images.image_url` |

### 6.3 Module: Product

| UI Field | API Request Field | API Response Field | DB Column (Table) |
|----------|-------------------|-------------------|-------------------|
| Tên sản phẩm | `product_name` | `product_name` | `products.product_name` |
| Danh mục | `product_category_id` | `category.category_name` | `products.product_category_id` → `product_categories.category_name` |
| Giá bán | `price` | `price` | `products.price` |
| Giá gốc | `original_price` | `original_price` | `products.original_price` |
| Mô tả | `description` | `description` | `products.description` |
| Số lượng kho | `stock_quantity` | `stock_quantity` | `products.stock_quantity` |
| Đã bán | - | `sold_quantity` | `products.sold_quantity` |
| Đánh giá TB | - | `average_rating` | `products.average_rating` |
| Ảnh sản phẩm | `images[]` | `product_images[].image_url` | `product_images.image_url` |
| Biến thể | `variants[]` | `variants[].{variant_name, price, stock}` | `product_variants.*` |
| Flash Sale | - | `flash_sale_items[].discount_price` | `flash_sale_items.discount_price` |
| Đối tượng | `target_species` | `target_species` | `products.target_species` |

### 6.4 Module: Appointment (Đặt lịch)

| UI Field | API Request Field | API Response Field | DB Column (Table) |
|----------|-------------------|-------------------|-------------------|
| Mã lịch hẹn | - | `appointment_code` | `appointments.appointment_code` |
| Chi nhánh | (auto from slot) | `branch.branch_name` | `appointments.branch_id` → `branches.branch_name` |
| Bác sĩ | (auto from slot) | `doctor.doctor_name` | `appointments.doctor_id` → `doctors.doctor_name` |
| Ngày hẹn | (auto from slot) | `appointment_date` | `appointments.appointment_date` |
| Giờ bắt đầu | (auto from slot) | `start_time` | `appointments.start_time` |
| Khung giờ | `slot_id` | `slot.start_time, slot.end_time` | `appointments.slot_id` → `time_slots.*` |
| Thú cưng | `pet_id` / `pet_data` | `pet.*` | `appointments.pet_id` → `pets.*` |
| Dịch vụ | `service_ids[]` | `services[].service.*` | `appointment_services.service_id` → `services.*` |
| Tên khách | `customer_name_snapshot` | `customer_name_snapshot` | `appointments.customer_name_snapshot` |
| SĐT khách | `customer_phone_snapshot` | `customer_phone_snapshot` | `appointments.customer_phone_snapshot` |
| Tên pet (snapshot) | - | `pet_name_snapshot` | `appointments.pet_name_snapshot` |
| Loài pet (snapshot) | - | `pet_species_snapshot` | `appointments.pet_species_snapshot` |
| Giống pet (snapshot) | - | `pet_breed_snapshot` | `appointments.pet_breed_snapshot` |
| Ghi chú | `note` | `note` | `appointments.note` |
| Mô tả tình trạng | `condition_description` | `condition_description` | `appointments.condition_description` |
| Trạng thái | - | `status` | `appointments.status` |
| TT thanh toán | - | `payment_status` | `appointments.payment_status` |
| Giá gốc DV | - | `services[].unit_price` | `appointment_services.unit_price` |
| Phụ thu cân nặng | - | `services[].surcharge_amount` | `appointment_services.surcharge_amount` |
| Tổng tiền DV | - | `services[].total_price` | `appointment_services.total_price` |
| Tổng thanh toán | - | `final_price` (computed) | Tính từ payment hoặc sum services |
| PTTT | `payment_method` | `payment_method` | `payments.payment_method` |

### 6.5 Module: Order (Đơn hàng)

| UI Field | API Request Field | API Response Field | DB Column (Table) |
|----------|-------------------|-------------------|-------------------|
| Mã đơn hàng | - | `order_code` | `orders.order_code` |
| Loại đơn | - | `order_type` | `orders.order_type` |
| Người nhận | (from address) | `recipient_name` | `orders.recipient_name` |
| SĐT nhận | (from address) | `recipient_phone` | `orders.recipient_phone` |
| Địa chỉ giao | (from address) | `shipping_address` | `orders.shipping_address` |
| Tạm tính | - | `subtotal_amount` | `orders.subtotal_amount` |
| Giảm giá | - | `discount_amount` | `orders.discount_amount` |
| Điểm giảm | - | `points_discount_amount` | `orders.points_discount_amount` |
| Phí ship | - | `shipping_fee` | `orders.shipping_fee` |
| Tổng cộng | - | `total_amount` | `orders.total_amount` |
| Trạng thái | - | `order_status` | `orders.order_status` |
| TT thanh toán | - | `payment_status` | `orders.payment_status` |
| Ghi chú | `note` | `note` | `orders.note` |
| Mã voucher | `voucher_code` | `voucher.voucher_code` | `orders.voucher_id` → `vouchers.voucher_code` |
| Sản phẩm | `items[]` / DB cart | `order_items[].item_name_snapshot` | `order_items.item_name_snapshot` |
| Số lượng | `quantity` | `order_items[].quantity` | `order_items.quantity` |
| Đơn giá | - | `order_items[].unit_price` | `order_items.unit_price` |
| Thành tiền | - | `order_items[].total_price` | `order_items.total_price` |
| PTTT | `payment_method` | `payments[].payment_method` | `payments.payment_method` |

### 6.6 Module: Service (Dịch vụ)

| UI Field | API Request Field | API Response Field | DB Column (Table) |
|----------|-------------------|-------------------|-------------------|
| Tên dịch vụ | `service_name` | `service_name` | `services.service_name` |
| Danh mục | `service_category_id` | `category.category_name` | `services.service_category_id` → `service_categories.category_name` |
| Giá cơ bản | `base_price` | `base_price` | `services.base_price` |
| Thời gian (phút) | `duration_minutes` | `duration_minutes` | `services.duration_minutes` |
| Ảnh | `image_url` | `image_url` | `services.image_url` |
| Đánh giá TB | - | `average_rating` | `services.average_rating` |
| Đối tượng | `target_species` | `target_species` | `services.target_species` |
| Phụ thu cân nặng? | `is_weight_surcharge_applied` | `is_weight_surcharge_applied` | `services.is_weight_surcharge_applied` |
| Bảng giá theo cân | - | `price_matrix[]` | `service_price_matrix.*` |

### 6.7 Module: Review

| UI Field | API Request Field | API Response Field | DB Column (Table) |
|----------|-------------------|-------------------|-------------------|
| Loại đánh giá | `target_type` | `target_type` | `reviews.target_type` |
| ID mục tiêu | `target_id` | `target_id` | `reviews.target_id` |
| Số sao | `rating` | `rating` | `reviews.rating` |
| Nội dung | `comment` | `comment` | `reviews.comment` |
| Ảnh đính kèm | `images[]` | `images[].image_url` | `review_images.image_url` |
| Người đánh giá | - | `user.full_name` | `reviews.user_id` → `users.full_name` |
| Số lượt thích | - | `likes_count` | `reviews.likes_count` |
| Trạng thái | - | `status` | `reviews.status` |
| Phản hồi | `comment` (reply) | `replies[]` | `reviews.parent_id` |

---

## 7. RELATIONSHIPS DIAGRAM (TEXT)

```
users ──1:N──> pets
users ──1:N──> orders
users ──1:N──> appointments
users ──1:N──> carts (1 active)
users ──1:N──> notifications
users ──1:N──> reviews
users ──1:N──> posts
users ──1:1──> loyalty_accounts
users ──1:1──> staff_profiles
users ──1:1──> doctors

pets ──1:N──> appointments
pets ──1:N──> medical_records
pets ──1:N──> health_diary_entries
pets ──1:N──> pet_reminders

appointments ──N:1──> time_slots
appointments ──N:1──> branches
appointments ──N:1──> doctors
appointments ──1:N──> appointment_services ──N:1──> services
appointments ──1:N──> orders (type=appointment)
appointments ──1:N──> payments

orders ──1:N──> order_items ──N:1──> products/services
orders ──1:N──> payments
orders ──N:1──> vouchers
orders ──N:1──> user_addresses

payments ──1:1──> receipts
payments ──1:N──> refunds
payments ──1:N──> voucher_usages

products ──N:1──> product_categories (tree)
products ──1:N──> product_images
products ──1:N──> product_variants
products ──1:N──> flash_sale_items ──N:1──> flash_sales

services ──N:1──> service_categories
services ──1:N──> service_price_matrix
services ──1:N──> service_surcharges

reviews ──self──> reviews (parent_id for replies)
reviews ──N:M──> users (review_likes)

posts ──N:1──> post_categories
posts ──1:N──> post_comments (nested via parent_comment_id)
posts ──N:M──> users (post_likes)

adoption_pets ──1:N──> adoption_requests
adoption_pets ──1:N──> adoption_pet_images
```

---

> [!IMPORTANT]
> **Lưu ý quan trọng khi sử dụng tài liệu này:**
> - Database thực tế là **MySQL** (không phải MongoDB). Nếu task yêu cầu MongoDB, cần lưu ý convert schema.
> - Tất cả ID đều là **BigInt** (autoincrement), được serialize thành string trong response.
> - Review sử dụng **polymorphic pattern** (`target_type` + `target_id`), không có FK constraint trong Prisma.
> - Appointment sử dụng **snapshot pattern** cho customer/pet info tại thời điểm đặt.
> - Order có 2 types: `product` (mua hàng) và `appointment` (thanh toán dịch vụ).
> - Payment status `waiting_store_payment` chỉ dùng cho thanh toán tại cửa hàng.
