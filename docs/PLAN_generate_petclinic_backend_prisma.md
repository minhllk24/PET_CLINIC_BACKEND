# PLAN tạo source base Backend ExpressJS + Prisma cho hệ thống Pet Clinic

## 0. Mục tiêu

Tạo lại source base Backend cho hệ thống **Pet Clinic / Dr.Pet's House** dựa trên:

1. Source mẫu Backend cũ của hệ thống khác.
2. File SQL script Pet Clinic đã tạo.
3. Yêu cầu mới: chuyển database access từ **Mongoose/MongoDB** sang **Prisma/MySQL**.
4. Giữ phong cách source cũ: `controllers -> services -> routes`, response format `EM / EC / DT`, JWT auth, cookie refresh token, nodemailer, body-parser, cors.
5. Giữ nguyên các thư viện hiện có trong `package.json`, chỉ bổ sung Prisma nếu cần.

Backend mới phải dùng:

```text
ExpressJS
Prisma ORM
MySQL
JWT
bcryptjs
nodemailer
Babel / nodemon giống source mẫu
```

---

## 1. Nguyên tắc bắt buộc khi generate source

### 1.1. Không dùng Mongoose nữa

Source mẫu cũ đang dùng:

```js
import mongoose from 'mongoose';
mongoose.connect(...)
```

Với Backend mới:

```text
- Xóa hoặc bỏ sử dụng toàn bộ mongoose.connect trong src/server.js.
- Không tạo file model kiểu Mongoose trong src/models.
- Không import mongoose hoặc Types.ObjectId trong service/controller.
- Không dùng Product.find, User.findOne, Order.findByIdAndUpdate...
- Thay toàn bộ bằng Prisma Client.
```

### 1.2. Prisma là nguồn tạo database

Không dùng file `.sql` để chạy thủ công trong MySQL Workbench nữa. Thay vào đó:

```text
prisma/schema.prisma
→ npx prisma migrate dev --name init
→ Prisma tạo bảng trong MySQL
```

File `schema.prisma` đã được chuyển từ SQL script và đi kèm với file PLAN này.

### 1.3. Giữ nguyên style API response

Tất cả service/controller trả về format:

```js
{
  EM: 'message',
  EC: 0,
  DT: data
}
```

Quy ước:

```text
EC = 0   thành công
EC = 1   thiếu/thông tin không hợp lệ ở mức user input
EC = 2   dữ liệu bị trùng hoặc business rule không đạt
EC = -1  không tìm thấy dữ liệu hoặc không có quyền
EC = -2  lỗi trong service
EC = -999 lỗi token/auth middleware
```

### 1.4. Giữ package.json hiện tại, chỉ thêm Prisma

Source mẫu đang có các dependency chính:

```json
{
  "bcryptjs": "^2.4.3",
  "body-parser": "^1.20.3",
  "cookie-parser": "^1.4.7",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.21.1",
  "jsonwebtoken": "^9.0.2",
  "lodash": "^4.17.21",
  "mongoose": "^8.8.2",
  "nodemailer": "^6.9.16",
  "uuid": "^11.0.3"
}
```

Yêu cầu:

```text
- Không xóa thư viện cũ trong package.json nếu không cần thiết.
- Có thể giữ mongoose trong package.json nhưng không được dùng trong code.
- Thêm @prisma/client vào dependencies.
- Thêm prisma vào devDependencies.
```

Cài thêm:

```bash
npm install @prisma/client
npm install prisma --save-dev
```

---

## 2. Cấu hình Prisma

## 2.1. File `.env`

Tạo/cập nhật `.env`:

```env
PORT=8080
REACT_URL=http://localhost:3000

DATABASE_URL="mysql://root:123456@localhost:3306/pet_clinic_db"

JWT_ACCESS_TOKEN_SECRET=your_access_token_secret
JWT_REFRESH_TOKEN_SECRET=your_refresh_token_secret

EMAIL_APP=your_email@gmail.com
EMAIL_APP_PASSWORD=your_app_password

PAYPAL_CLIENT_ID=your_paypal_client_id
```

Nếu MySQL root không có mật khẩu:

```env
DATABASE_URL="mysql://root@localhost:3306/pet_clinic_db"
```

## 2.2. File `prisma/schema.prisma`

Dùng file `schema.prisma` đi kèm với PLAN này.

Lưu ý quan trọng trong schema:

```text
- payments.order_id là bắt buộc, không nullable.
- reviews không có service_id và appointment_id.
- reviews dùng target_type + target_id để đánh giá product hoặc service.
- Vì target_id là polymorphic nên Prisma không enforce foreign key tới products/services.
- SQL views không chuyển sang Prisma model; nếu cần thì dùng query Prisma hoặc raw SQL.
```

## 2.3. Lệnh tạo database từ Prisma

Sau khi có `schema.prisma`, chạy:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Nếu muốn reset database local:

```bash
npx prisma migrate reset
```

Nếu muốn xem dữ liệu:

```bash
npx prisma studio
```

---

## 3. Cấu trúc source Backend đề xuất

Dựa theo source mẫu, giữ cấu trúc quen thuộc nhưng mở rộng cho Pet Clinic:

```text
.
├── prisma
│   ├── schema.prisma
│   └── seed.js
├── src
│   ├── configs
│   │   ├── cors.js
│   │   ├── viewEngine.js
│   │   └── prisma.js
│   ├── controllers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── petController.js
│   │   ├── appointmentController.js
│   │   ├── serviceController.js
│   │   ├── productController.js
│   │   ├── cartController.js
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   ├── medicalRecordController.js
│   │   ├── healthDiaryController.js
│   │   ├── reminderController.js
│   │   ├── reviewController.js
│   │   ├── postController.js
│   │   ├── firstAidController.js
│   │   ├── rescueController.js
│   │   ├── adoptionController.js
│   │   └── aiChatController.js
│   ├── middleware
│   │   └── authMiddleware.js
│   ├── routes
│   │   └── api.js
│   ├── services
│   │   ├── authAPIService.js
│   │   ├── userAPIService.js
│   │   ├── petAPIService.js
│   │   ├── appointmentAPIService.js
│   │   ├── serviceAPIService.js
│   │   ├── productAPIService.js
│   │   ├── cartAPIService.js
│   │   ├── orderAPIService.js
│   │   ├── paymentAPIService.js
│   │   ├── medicalRecordAPIService.js
│   │   ├── healthDiaryAPIService.js
│   │   ├── reminderAPIService.js
│   │   ├── reviewAPIService.js
│   │   ├── postAPIService.js
│   │   ├── firstAidAPIService.js
│   │   ├── rescueAPIService.js
│   │   ├── adoptionAPIService.js
│   │   ├── aiChatAPIService.js
│   │   └── emailAPIService.js
│   ├── utils
│   │   ├── jwtHelpers.js
│   │   ├── prismaHelpers.js
│   │   ├── passwordHelpers.js
│   │   └── responseHelpers.js
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── package-lock.json
```

---

## 4. File cấu hình Prisma Client

Tạo file:

```text
src/configs/prisma.js
```

Nội dung gợi ý:

```js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
```

---

## 5. Sửa `src/server.js`

Source mẫu cũ có `mongoose.connect(...)`. Backend mới phải bỏ đoạn này.

File `src/server.js` gợi ý:

```js
require('dotenv').config();
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import configViewEngine from './configs/viewEngine';
import configCors from './configs/cors';
import initAPIRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 8080;

configCors(app);
configViewEngine(app);

app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Middleware fix BigInt JSON serialization from Prisma
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function (data) {
    return oldJson.call(this, JSON.parse(JSON.stringify(data, (_, value) => {
      return typeof value === 'bigint' ? value.toString() : value;
    })));
  };
  next();
});

initAPIRoutes(app);

app.listen(PORT, () => {
  console.log('SERVER is running on PORT:', PORT);
});
```

Lý do cần middleware BigInt:

```text
Database SQL dùng BIGINT cho ID.
Prisma trả BIGINT thành kiểu BigInt trong JavaScript.
Express res.json không serialize được BigInt nếu không convert.
```

---

## 6. Quy tắc ID khi dùng Prisma

Vì Prisma schema dùng `BigInt` cho các khóa chính, API nên xử lý ID như sau:

```js
const toBigIntId = (id) => {
  if (!id || isNaN(Number(id))) return null;
  return BigInt(id);
};
```

Tạo file:

```text
src/utils/prismaHelpers.js
```

```js
export const toBigIntId = (id) => {
  if (!id || isNaN(Number(id))) return null;
  return BigInt(id);
};

export const serializeBigInt = (data) => {
  return JSON.parse(JSON.stringify(data, (_, value) => {
    return typeof value === 'bigint' ? value.toString() : value;
  }));
};
```

Không dùng:

```js
Types.ObjectId.isValid(id)
```

Thay bằng:

```js
const userId = toBigIntId(req.params.id);
if (!userId) return ...;
```

---

## 7. Auth/JWT mới theo Prisma

## 7.1. Payload JWT

Không dùng `_id` như MongoDB nữa. Dùng:

```js
{
  user_id: user.user_id.toString(),
  role_code: user.role.role_code,
  email: user.email,
  full_name: user.full_name
}
```

## 7.2. `jwtHelpers.js`

Giữ thư viện `jsonwebtoken`, nhưng bỏ logic kiểm tra `payload instanceof mongoose.Document`.

Gợi ý:

```js
import Jwt from 'jsonwebtoken';
require('dotenv').config();

export const generateAccessToken = (payload) => {
  return Jwt.sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload) => {
  return Jwt.sign(payload, process.env.JWT_REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
};

export const refreshNewTokenService = (token) => {
  try {
    const { iat, exp, ...rest } = Jwt.verify(token, process.env.JWT_REFRESH_TOKEN_SECRET);
    return generateAccessToken(rest);
  } catch (error) {
    return null;
  }
};
```

## 7.3. Auth middleware

Không dùng `decoded.isAdmin`. Dùng `decoded.role_code`.

```js
if (decoded.role_code !== 'ADMIN') {
  return res.status(403).json({
    EM: 'You dont have permission!',
    EC: -1,
    DT: ''
  });
}
```

Quyền nên có:

```text
ADMIN   toàn quyền quản trị
STAFF   xác nhận thanh toán tại cửa hàng, xem lịch/đơn liên quan
DOCTOR  xem lịch khám, tạo bệnh án
CUSTOMER quản lý dữ liệu của chính mình
```

---

## 8. Mapping từ Mongoose model cũ sang Prisma model mới

### 8.1. UserModel cũ → User/Role/UserAddress mới

Mongoose cũ:

```text
UserModel: name, email, password, isAdmin, phone, address, city, avatar
```

Prisma mới:

```text
User:
- user_id
- role_id
- full_name
- email
- phone
- password_hash
- avatar_url
- status

Role:
- ADMIN / STAFF / DOCTOR / CUSTOMER

UserAddress:
- recipient_name
- recipient_phone
- address_line
- ward/district/province
```

### 8.2. ProductModel cũ → Product/ProductCategory/ProductImage mới

Mongoose cũ:

```text
ProductModel: name, image, type, price, countInStock, rating, description, discount, sold
```

Prisma mới:

```text
Product:
- product_name
- product_category_id
- description
- price
- stock_quantity
- average_rating
- status

ProductCategory:
- category_name

ProductImage:
- image_url
```

Mapping đề xuất:

```text
name          -> product_name
image         -> ProductImage.image_url
type          -> ProductCategory.category_name
price         -> price
countInStock  -> stock_quantity
rating        -> average_rating
description   -> description
```

### 8.3. OrderProduct cũ → Order/OrderItem/Payment mới

Mongoose cũ:

```text
OrderProduct:
- orderItems[]
- shippingAddress
- paymentMethod
- itemsPrice
- shippingPrice
- totalPrice
- user
- isPaid
- paidAt
- isDelivered
```

Prisma mới:

```text
Order:
- order_code
- user_id
- recipient_name
- recipient_phone
- shipping_address
- subtotal_amount
- shipping_fee
- total_amount
- order_status
- payment_status

OrderItem:
- order_id
- product_id
- item_name_snapshot
- quantity
- unit_price
- total_price

Payment:
- order_id NOT NULL
- payment_method
- final_amount
- status
- paid_at
```

---

## 9. Các module API cần generate

## 9.1. Auth APIs

Prefix:

```text
/api/v1/auth
```

Routes:

```text
POST /register
POST /login
POST /logout
GET  /refresh-token
POST /forgot-password/send-otp
POST /forgot-password/verify-otp
POST /forgot-password/reset
```

Service chính:

```text
registerNewUser
loginUser
logoutUser
refreshNewToken
sendForgotPasswordOtp
verifyForgotPasswordOtp
resetPassword
```

Rule:

```text
- Password hash bằng bcryptjs.
- Register mặc định role CUSTOMER.
- Kiểm tra email/phone trùng bằng prisma.user.findFirst.
- Login bằng email hoặc phone.
- Password tối thiểu 8 ký tự, có chữ hoa và số.
- OTP 6 số, hết hạn 5 phút, gửi lại sau 60 giây.
- Reset password phải revoke session cũ trong user_sessions.
```

## 9.2. User APIs

Prefix:

```text
/api/v1/users
```

Routes:

```text
GET    /                 ADMIN
GET    /:id              ADMIN hoặc chính user
PUT    /:id              ADMIN hoặc chính user
DELETE /:id              ADMIN
GET    /:id/addresses    ADMIN hoặc chính user
POST   /:id/addresses    ADMIN hoặc chính user
PUT    /addresses/:id    ADMIN hoặc chủ địa chỉ
DELETE /addresses/:id    ADMIN hoặc chủ địa chỉ
```

## 9.3. Pet APIs

Prefix:

```text
/api/v1/pets
```

Routes:

```text
GET    /my-pets
GET    /:id
POST   /
PUT    /:id
DELETE /:id
GET    /species
GET    /breeds?species_id=
```

Rule:

```text
- CUSTOMER chỉ thao tác pet của mình.
- ADMIN có thể xem tất cả.
- Delete nên soft delete: pets.status = deleted.
- Danh sách pet card nên trả thêm latest_exam_date từ medical_records.
```

## 9.4. Medical Record APIs

Prefix:

```text
/api/v1/medical-records
```

Routes:

```text
GET    /pet/:petId
GET    /:id
POST   /                  DOCTOR hoặc USER nếu source_type=user_uploaded
PUT    /:id               DOCTOR hoặc owner nếu user_uploaded
DELETE /:id               DOCTOR/ADMIN hoặc owner nếu user_uploaded
POST   /:id/attachments
DELETE /attachments/:id
```

Rule:

```text
- doctor_created: CUSTOMER chỉ xem/tải, không sửa/xóa.
- user_uploaded: CUSTOMER có thể quản lý nếu là chủ pet.
- File hỗ trợ PDF/JPG/PNG.
```

## 9.5. Health Diary APIs

Prefix:

```text
/api/v1/health-diaries
```

Routes:

```text
GET    /pet/:petId?month=&year=
GET    /:id
POST   /
PUT    /:id
DELETE /:id
POST   /:id/attachments
```

Rule:

```text
- Lịch theo tháng.
- Entry có date, time, icon_code, color_code, title, content.
- Attachment có group: medical_file, invoice, other.
```

## 9.6. Reminder APIs

Prefix:

```text
/api/v1/reminders
```

Routes:

```text
GET    /pet/:petId
POST   /
PUT    /:id
PATCH  /:id/complete
DELETE /:id
```

Rule:

```text
- remind_before_days chỉ nhận 1/3/5/7.
- remind_date không được là ngày quá khứ.
```

## 9.7. Service & Appointment APIs

Service prefix:

```text
/api/v1/services
```

Routes:

```text
GET    /
GET    /categories
GET    /:id
POST   /                  ADMIN
PUT    /:id               ADMIN
DELETE /:id               ADMIN
```

Appointment prefix:

```text
/api/v1/appointments
```

Routes:

```text
GET    /my-history
GET    /:id
POST   /
PUT    /:id/reschedule
PATCH  /:id/cancel
PATCH  /:id/confirm       STAFF/ADMIN
PATCH  /:id/complete      DOCTOR/STAFF/ADMIN
GET    /slots?date=&doctor_id=&branch_id=
```

Rule:

```text
- Khi đặt lịch, dùng transaction:
  1. Kiểm tra slot còn trống.
  2. Tăng booked_count.
  3. Nếu full thì set status=full.
  4. Tạo appointment.
  5. Tạo appointment_services.
  6. Tạo appointment_status_history.
  7. Tạo notification.
- Cho phép pet_id null nếu “Đặt lịch cho thú cưng khác”, nhưng cần lưu snapshot pet_name/species/breed.
- Hủy/đổi lịch chỉ cho phép trước 24h theo business logic.
```

## 9.8. Product APIs

Prefix:

```text
/api/v1/products
```

Routes nên giữ gần giống source mẫu:

```text
GET    /
GET    /get-all-types
GET    /get-products-by-type/:categoryName
GET    /:id
POST   /create             ADMIN
PUT    /update             ADMIN
DELETE /delete             ADMIN
DELETE /delete-many        ADMIN
```

Có thể thêm route mới rõ nghĩa hơn:

```text
GET    /categories
POST   /
PUT    /:id
DELETE /:id
```

Query hỗ trợ:

```text
page
limit
sort
field
filter
category_id
min_price
max_price
```

Prisma query gợi ý:

```js
const products = await prisma.product.findMany({
  where: {
    status: 'active',
    product_name: filter ? { contains: filter } : undefined,
    product_category_id: categoryId ? BigInt(categoryId) : undefined,
  },
  include: {
    category: true,
    product_images: true,
  },
  skip,
  take: limit,
  orderBy,
});
```

## 9.9. Cart APIs

Prefix:

```text
/api/v1/cart
```

Routes:

```text
GET    /
POST   /items
PUT    /items/:id
PATCH  /items/:id/select
DELETE /items/:id
DELETE /clear
```

Rule:

```text
- Mỗi CUSTOMER có cart active.
- quantity không vượt quá products.stock_quantity.
- is_selected dùng cho bước chọn sản phẩm cần mua.
```

## 9.10. Order APIs

Prefix:

```text
/api/v1/orders
```

Routes:

```text
GET    /                 ADMIN/STAFF
GET    /my-orders
GET    /:id
POST   /
PATCH  /:id/cancel
PATCH  /:id/status       ADMIN/STAFF
DELETE /:id              ADMIN hoặc chủ đơn nếu business cho phép
```

Rule tạo đơn hàng:

```text
- Dùng prisma.$transaction.
- Chỉ lấy cart_items có is_selected=true.
- Kiểm tra tồn kho từng sản phẩm.
- Trừ stock_quantity.
- Tạo orders.
- Tạo order_items.
- Tạo payments với order_id bắt buộc.
- Nếu dùng voucher thì tạo voucher_usages sau khi payment paid.
- Nếu dùng điểm thì tạo loyalty_point_transactions loại redeem.
```

## 9.11. Payment APIs

Prefix:

```text
/api/v1/payments
```

Routes:

```text
GET    /config
GET    /                 ADMIN/STAFF
GET    /:id
POST   /create
PATCH  /:id/confirm-store-payment    STAFF/ADMIN
PATCH  /:id/mark-paid                STAFF/ADMIN hoặc callback online payment
POST   /:id/refund                   STAFF/ADMIN
```

Rule:

```text
- payments.order_id luôn bắt buộc.
- Thanh toán dịch vụ appointment cũng phải tạo một Order có order_type='appointment' trước.
- receipts tạo sau khi payment.status='paid'.
- refunds tạo khi hoàn tiền.
```

## 9.12. Voucher & Loyalty APIs

Voucher prefix:

```text
/api/v1/vouchers
```

Routes:

```text
GET    /                 ADMIN
POST   /                 ADMIN
PUT    /:id              ADMIN
DELETE /:id              ADMIN
POST   /apply
```

Loyalty prefix:

```text
/api/v1/loyalty
```

Routes:

```text
GET    /my-points
GET    /transactions
```

Rule:

```text
- Voucher code không phân biệt hoa thường.
- Một order/payment chỉ áp dụng tối đa 1 voucher.
- 1 điểm = 1.000 VND.
- Cứ 100.000 VND thực trả thì cộng 1 điểm.
```

## 9.13. Review APIs

Prefix:

```text
/api/v1/reviews
```

Routes:

```text
GET    /target/:targetType/:targetId
GET    /admin               ADMIN
POST   /
PATCH  /:id/reject          ADMIN
PATCH  /:id/delete          ADMIN
```

Schema mới:

```text
reviews không có service_id
reviews không có appointment_id
reviews có target_type: product/service
reviews có target_id: ID của product hoặc service
```

Rule:

```text
- rating 1-5.
- comment optional nhưng nên cho phép.
- images lưu ở review_images.
- Khi review posted/rejected/deleted thì update average_rating tương ứng:
  - target_type='product' → products.average_rating
  - target_type='service' → services.average_rating
```

## 9.14. Blog/Post APIs

Prefix:

```text
/api/v1/posts
```

Routes:

```text
GET    /
GET    /:slug
POST   /                  CUSTOMER tạo community, ADMIN tạo official_blog
PUT    /:id               Owner hoặc ADMIN
DELETE /:id               Owner hoặc ADMIN
POST   /:id/comments      Logged in
```

## 9.15. First Aid APIs

Prefix:

```text
/api/v1/first-aid
```

Routes:

```text
GET    /categories
GET    /guides
GET    /guides/:id
POST   /guides            ADMIN
PUT    /guides/:id        ADMIN
DELETE /guides/:id        ADMIN
```

## 9.16. Rescue & Adoption APIs

Rescue prefix:

```text
/api/v1/rescue
```

Adoption prefix:

```text
/api/v1/adoptions
```

Routes:

```text
GET    /pets
GET    /pets/:id
POST   /pets              ADMIN
PUT    /pets/:id          ADMIN
DELETE /pets/:id          ADMIN
POST   /requests          CUSTOMER
GET    /my-requests       CUSTOMER
GET    /requests          ADMIN
PATCH  /requests/:id/approve ADMIN
PATCH  /requests/:id/reject  ADMIN
```

Rule:

```text
- User chỉ được có tối đa 3 đơn pending.
- Không được gửi 2 đơn pending cho cùng một adoption_pet.
- Approve request thì update adoption_pets.status='adopted'.
```

## 9.17. AI Chat APIs

Prefix:

```text
/api/v1/ai-chat
```

Routes:

```text
POST   /sessions
GET    /sessions
GET    /sessions/:id/messages
POST   /sessions/:id/messages
PATCH  /sessions/:id/close
```

Rule:

```text
- User message tối đa 1000 ký tự.
- Lưu session 30 ngày.
- Luôn lưu disclaimer_shown=true khi tạo session.
- Nội dung tư vấn AI không ghi vào medical_records.
```

---

## 10. Prisma service coding rules

### 10.1. Không dùng raw SQL nếu không cần

Ưu tiên:

```js
prisma.user.findMany()
prisma.product.findFirst()
prisma.order.create()
prisma.$transaction()
```

Chỉ dùng `$queryRaw` cho báo cáo/phức tạp.

### 10.2. Tạo dữ liệu liên quan bằng transaction

Ví dụ tạo order:

```js
await prisma.$transaction(async (tx) => {
  // check stock
  // update product stock
  // create order
  // create order items
  // create payment
});
```

### 10.3. Không trả password_hash

Mọi API trả user phải select rõ:

```js
select: {
  user_id: true,
  full_name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
}
```

Không trả:

```text
password_hash
session_token
otp_code
```

### 10.4. Soft delete cho dữ liệu nghiệp vụ

Nên soft delete:

```text
pets.status = deleted
products.status = inactive
posts.status = deleted
reviews.status = deleted
```

Không nên xóa cứng nếu dữ liệu liên quan đến order/payment/history.

---

## 11. Seed dữ liệu mẫu

Tạo file:

```text
prisma/seed.js
```

Seed nên có:

```text
roles: ADMIN, STAFF, DOCTOR, CUSTOMER
users: admin, staff, 2 doctors, 2 customers
branches: 2 cơ sở
species/breeds: chó, mèo, Beagle, Golden Retriever, mèo đen...
services: khám tổng quát, khám chữa bệnh, tiêm phòng, cắt móng, spa
product categories: thức ăn, đồ dùng, chăm sóc sức khỏe, đồ chơi, phụ kiện
products: 3-5 sản phẩm mẫu
vouchers: PET10, FREESHIP
appointments: 1-2 lịch mẫu
orders/payments: 1-2 giao dịch mẫu
medical_records: 1-2 hồ sơ mẫu
health_diary_entries: 2-3 ghi chú mẫu
posts/first aid/rescue/adoption: mỗi nhóm 1-2 mẫu
```

Cấu hình package.json thêm seed:

```json
{
  "prisma": {
    "seed": "babel-node prisma/seed.js"
  }
}
```

Chạy:

```bash
npx prisma db seed
```

---

## 12. Package.json đề xuất

Giữ nguyên script cũ, thêm Prisma packages.

```json
{
  "scripts": {
    "start": "nodemon --exec babel-node src/server.js",
    "build-src": "babel src -d build --copy-files",
    "build": "node build/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init",
    "prisma:studio": "prisma studio",
    "seed": "prisma db seed"
  },
  "dependencies": {
    "@prisma/client": "latest",
    "bcryptjs": "^2.4.3",
    "body-parser": "^1.20.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "lodash": "^4.17.21",
    "mongoose": "^8.8.2",
    "nodemailer": "^6.9.16",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "prisma": "latest",
    "@babel/cli": "^7.25.9",
    "@babel/core": "^7.26.0",
    "@babel/node": "^7.26.0",
    "@babel/preset-env": "^7.26.0",
    "nodemon": "^3.1.7"
  }
}
```

Ghi chú:

```text
- Giữ mongoose trong package.json theo yêu cầu, nhưng không dùng trong code.
- Nếu nhóm muốn sạch hơn sau này thì có thể remove mongoose, nhưng chưa làm ở source base.
```

---

## 13. Route file `src/routes/api.js` đề xuất

Giữ prefix:

```text
/api/v1
```

Cấu trúc route:

```js
import express from 'express';
import authController from '../controllers/authController';
import userController from '../controllers/userController';
import petController from '../controllers/petController';
import productController from '../controllers/productController';
import orderController from '../controllers/orderController';
import paymentController from '../controllers/paymentController';
import { authMiddleware, requireRole, authUserOrAdmin } from '../middleware/authMiddleware';

const router = express.Router();

const initAPIRoutes = (app) => {
  router.post('/auth/register', authController.handleRegister);
  router.post('/auth/login', authController.handleLogin);
  router.post('/auth/logout', authController.handleLogout);
  router.get('/auth/refresh-token', authController.handleRefreshToken);

  router.get('/users', authMiddleware, requireRole(['ADMIN']), userController.handleGetAllUsers);
  router.get('/users/:id', authMiddleware, authUserOrAdmin, userController.handleGetDetailUser);

  router.get('/products', productController.handleGetAllProducts);
  router.get('/products/:id', productController.handleGetDetailProduct);

  router.get('/pets/my-pets', authMiddleware, petController.handleGetMyPets);

  return app.use('/api/v1', router);
};

export default initAPIRoutes;
```

AI generate source có thể mở rộng đầy đủ theo danh sách route ở phần 9.

---

## 14. Những lỗi cần tránh khi AI generate code

```text
1. Không dùng mongoose.connect trong server.js.
2. Không import ProductModel/UserModel/OrderProduct kiểu Mongoose.
3. Không dùng ObjectId hoặc Types.ObjectId.isValid.
4. Không trả BigInt trực tiếp qua res.json nếu chưa serialize.
5. Không dùng decoded.isAdmin; phải dùng decoded.role_code.
6. Không dùng reviews.service_id hoặc reviews.appointment_id vì 2 cột này đã bỏ.
7. Không tạo payment thiếu order_id.
8. Không hard delete dữ liệu liên quan payment/order/medical record.
9. Không lưu password plaintext.
10. Không trả password_hash, otp_code, session_token ra frontend.
```

---

## 15. Thứ tự triển khai source base đề xuất

### Phase 1: Setup Prisma + Auth

```text
- Cài @prisma/client và prisma.
- Thêm prisma/schema.prisma.
- Chạy migrate.
- Tạo src/configs/prisma.js.
- Sửa server.js bỏ mongoose.
- Tạo auth service/controller/middleware.
```

### Phase 2: Core user/pet/product/order

```text
- User CRUD.
- Pet CRUD.
- Product CRUD/list/filter.
- Cart.
- Order.
- Payment cơ bản.
```

### Phase 3: Clinic modules

```text
- Services.
- Time slots.
- Appointments.
- Appointment history.
- Medical records.
- Health diary.
- Reminders.
```

### Phase 4: Content/community

```text
- Reviews.
- Blog/posts/comments.
- First aid guides.
- Rescue posts/stations.
- Adoption pets/requests.
- AI chat history.
```

### Phase 5: Seed, testing, documentation

```text
- Seed dữ liệu mẫu.
- Test Postman/Thunder Client.
- Viết README chạy project.
- Kiểm tra Prisma Studio.
```

---

## 16. README chạy backend nên có

AI generate source cần tạo README có các bước:

```bash
npm install
npm install @prisma/client
npm install prisma --save-dev
```

Tạo `.env`:

```env
PORT=8080
REACT_URL=http://localhost:3000
DATABASE_URL="mysql://root:123456@localhost:3306/pet_clinic_db"
JWT_ACCESS_TOKEN_SECRET=your_access_token_secret
JWT_REFRESH_TOKEN_SECRET=your_refresh_token_secret
EMAIL_APP=your_email@gmail.com
EMAIL_APP_PASSWORD=your_email_app_password
PAYPAL_CLIENT_ID=your_paypal_client_id
```

Chạy migrate:

```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
npm start
```

---

## 17. Checklist hoàn thành

Source base được xem là hoàn thành nếu có:

```text
[ ] Chạy npm install thành công
[ ] Chạy npx prisma migrate dev --name init thành công
[ ] Chạy npx prisma generate thành công
[ ] Chạy npx prisma db seed thành công
[ ] npm start chạy server được
[ ] Không còn mongoose.connect trong server.js
[ ] Không còn service dùng Product.find/User.findOne kiểu Mongoose
[ ] Login/register dùng Prisma
[ ] JWT payload dùng user_id + role_code
[ ] Product list chạy được
[ ] Pet CRUD cơ bản chạy được
[ ] Cart/order/payment cơ bản chạy được
[ ] BigInt không gây lỗi res.json
[ ] reviews không dùng service_id/appointment_id
[ ] payments luôn có order_id
```

---

## 18. File đi kèm

File đi kèm bắt buộc:

```text
prisma/schema.prisma
```

File nên tạo thêm khi generate source:

```text
prisma/seed.js
README.md
.env.example
```
