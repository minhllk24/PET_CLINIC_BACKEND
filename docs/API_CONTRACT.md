# Pet Clinic Backend API Contract

Tai lieu nay duoc lap tu source backend thuc te, chu yeu tu:

- `src/server.js`
- `src/routes/api.js`
- `src/controllers/*.js`
- `src/services/*APIService.js`
- `prisma/schema.prisma`

Base URL mac dinh:

```text
http://localhost:8080/api/v1
```

## Quy Uoc Chung

Tat ca JSON response di qua `sendResponse` co shape:

```json
{
  "EM": "Message",
  "EC": 0,
  "DT": {}
}
```

Quy uoc `EC`:

- `0`: thanh cong.
- `1`: thieu field, invalid input, hoac request khong hop le.
- `2`, `3`: loi nghiep vu cu the tuy API, vi du trung email, het hang, tai khoan bi khoa.
- `-1`: khong tim thay, bi tu choi, hoac rule nghiep vu khong dat.
- `-2`: loi server.
- `-999`: loi auth/token/session.

Auth:

```http
Authorization: Bearer <access_token>
```

Login tra `access_token` trong `DT.access_token` va set `refresh_token` vao HttpOnly cookie. FE nen bat `withCredentials: true` khi goi `/refresh` neu chay khac origin.

Role code dang dung:

```text
ADMIN, STAFF, DOCTOR, CUSTOMER
```

BigInt tu Prisma duoc serialize thanh string boi middleware trong `server.js`. FE nen xu ly cac id lon nhu string.

Static files:

```text
GET /uploads/<filename>
```

Backend serve static tu `src/public`, upload medical record luu file URL dang `/uploads/<filename>`.

## Auth

### POST `/register`

Auth: Public

Body:

```json
{
  "full_name": "Nguyen Van A",
  "email": "customer@example.com",
  "phone": "0900000000",
  "password": "Password1"
}
```

Required:

- `email` hoac `phone`
- `password`

Rules:

- Password toi thieu 8 ky tu, co it nhat 1 chu hoa va 1 chu so.
- User tao moi co `status = inactive`.
- Gui OTP qua email hoac mock SMS.

Success `DT`: `""`

### POST `/verify-register-otp`

Auth: Public

Body:

```json
{
  "login_id": "customer@example.com",
  "otp_code": "123456"
}
```

Success: active user, `DT = ""`.

### POST `/login`

Auth: Public

Body:

```json
{
  "login_id": "customer@example.com",
  "password": "Password1",
  "remember_me": true
}
```

Success `DT`:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "user_id": "1",
    "role_code": "CUSTOMER",
    "email": "customer@example.com",
    "full_name": "Nguyen Van A",
    "require_password_change": false
  }
}
```

Notes:

- Neu sai password 5 lan, account bi khoa logic bang `failed_login_count`.
- Neu `status != active`, login fail.

### POST `/logout`

Auth: Public

Clear cookie `refresh_token`. `DT = ""`.

### POST `/refresh`

Auth: Cookie `refresh_token`

Success `DT`:

```json
{
  "access_token": "..."
}
```

### POST `/forgot-password`

Auth: Public

Body:

```json
{
  "email": "customer@example.com"
}
```

Gui OTP reset password. `DT = ""`.

### POST `/verify-otp`

Auth: Public

Body:

```json
{
  "email": "customer@example.com",
  "otp_code": "123456"
}
```

Success `DT`:

```json
{
  "reset_token": "..."
}
```

### POST `/reset-password`

Auth: Public

Body:

```json
{
  "reset_token": "...",
  "new_password": "NewPassword1"
}
```

Success: revoke all sessions. `DT = ""`.

### POST `/change-password`

Auth: Auth

Body:

```json
{
  "old_password": "Password1",
  "new_password": "NewPassword2"
}
```

Success: revoke all sessions va clear refresh cookie. FE nen logout local.

## Search

### GET `/search`

Auth: Optional

Query:

```text
keyword=abc
scope=all|product|service|blog
page=1
limit=10
sort=relevance|price_asc|price_desc|newest|best_selling|rating
productCategoryId=1
serviceCategoryId=1
minPrice=10000
maxPrice=500000
```

Success `DT`:

```json
{
  "keyword": "abc",
  "scope": "all",
  "totalRows": 12,
  "totalPages": 2,
  "counts": {
    "service": 1,
    "product": 10,
    "blog": 1
  },
  "facetCounts": {
    "productCategories": {},
    "serviceCategories": {}
  },
  "results": []
}
```

### GET `/search/suggestions`

Auth: Public

Query:

```text
q=abc
limit=10
```

Success `DT`: array `{ keyword, count }`.

## Users Va Addresses

### GET `/users`

Auth: ADMIN

Query: `page`, `limit`

Success `DT`:

```json
{
  "totalRows": 100,
  "totalPages": 10,
  "users": []
}
```

User fields selected: `user_id`, `full_name`, `email`, `phone`, `avatar_url`, `status`, `role`, `created_at`.

### GET `/users/:id`

Auth: Auth

Success `DT`: user detail with `role`.

### PUT `/users/:id`

Auth: Auth

Body:

```json
{
  "full_name": "Nguyen Van A",
  "email": "a@example.com",
  "phone": "0900000000",
  "avatar_url": "/uploads/a.png",
  "status": "active"
}
```

Success `DT`: updated user.

Important: Route khong dung ownership middleware. FE khong nen expose update user khac cho CUSTOMER.

### DELETE `/users/:id`

Auth: ADMIN

Soft delete bang `status = deleted`.

### GET `/users/:id/addresses`

Auth: Auth

Success `DT`: array user addresses.

### POST `/users/:id/addresses`

Auth: Auth

Body:

```json
{
  "recipient_name": "Nguyen Van A",
  "recipient_phone": "0900000000",
  "recipient_email": "a@example.com",
  "address_line": "123 ABC",
  "ward": "Ward",
  "district": "District",
  "province": "Province",
  "country": "Vietnam",
  "is_default": true
}
```

Required: `recipient_name`, `recipient_phone`, `address_line`.

### PUT `/addresses/:addressId`

Auth: Auth

Body: same address fields, all optional.

### DELETE `/addresses/:addressId`

Auth: Auth

Deletes address.

## Pets

### GET `/pets/species`

Auth: Public

Success `DT`: active species.

### GET `/pets/breeds`

Auth: Public

Query required:

```text
species_id=1
```

Success `DT`: breeds of species.

### GET `/my-pets`

Auth: Auth

Success `DT`: current user's active pets, include `species`, `breed`, primary `pet_images`, `latest_exam_date`.

### GET `/pets/:id`

Auth: Auth

Permission:

- ADMIN can read all.
- CUSTOMER can read own pet only.

Success `DT`: pet with `species`, `breed`, `pet_images`.

### POST `/pets`

Auth: Auth

Body:

```json
{
  "pet_name": "Milo",
  "species_id": "1",
  "breed_id": "2",
  "gender": "male",
  "birth_date": "2024-01-01",
  "age": "2 years",
  "weight_kg": 5.5,
  "health_status": "healthy",
  "medical_note": "No allergy",
  "profile_image_url": "/uploads/milo.png"
}
```

Required: `pet_name`, `species_id`.

Rules:

- `weight_kg` must be positive and <= 200.
- `birth_date` cannot be future.
- `breed_id` must belong to `species_id`.

### PUT `/pets/:id`

Auth: Auth

Body: same as create, optional. `status` can only be changed by ADMIN.

### DELETE `/pets/:id`

Auth: Auth

Soft delete bang `status = deleted`.

## Product Categories

### GET `/categories`

Auth: Public

Success `DT`: active product categories, include `children` and `_count.products`.

### POST `/categories`

Auth: ADMIN

Body:

```json
{
  "category_name": "Food",
  "parent_id": null,
  "image_url": "/images/cat.png",
  "status": "active"
}
```

Required: `category_name`.

### PUT `/categories/:id`

Auth: ADMIN

Body: `category_name`, `parent_id`, `image_url`, `status`.

### DELETE `/categories/:id`

Auth: ADMIN

Soft delete bang `status = inactive`.

## Products

### GET `/products`

Auth: Public

Query:

```text
page=1
limit=10
filter=keyword
category_id=1
sort=newest|best_selling|price_asc|price_desc|rating
minPrice=10000
maxPrice=500000
```

Success `DT`:

```json
{
  "totalRows": 20,
  "totalPages": 2,
  "products": []
}
```

Product list includes `category` and primary `product_images`.

### GET `/products/:id`

Auth: Public

Success `DT`: product with `category`, `product_images`, `variants`.

### GET `/products/:id/related`

Auth: Public

Success `DT`: up to 10 active products in same category.

### GET `/products/:id/review-stats`

Auth: Public

Success `DT`:

```json
{
  "totalReviews": 10,
  "averageRating": 4.5,
  "breakdown": [
    {
      "star": 5,
      "count": 7,
      "percentage": 70
    }
  ]
}
```

### POST `/products`

Auth: ADMIN

Body:

```json
{
  "product_name": "Dog Food",
  "product_category_id": "1",
  "description": "High protein",
  "price": 120000,
  "original_price": 150000,
  "stock_quantity": 100,
  "status": "active",
  "images": ["/images/p1.png"],
  "variants": [
    {
      "variant_name": "1kg",
      "price": 120000,
      "original_price": 150000,
      "stock_quantity": 50
    }
  ]
}
```

Required: `product_name`, `product_category_id`.

### PUT `/products/:id`

Auth: ADMIN

Body: same as create, optional. If `images` or `variants` present, backend deletes old records and recreates.

### DELETE `/products/:id`

Auth: ADMIN

Soft delete bang `status = inactive`.

## Flash Sales

### GET `/flash-sales/active`

Auth: Public

Returns current active flash sale; if none, returns nearest upcoming active flash sale. `DT` can be `null`.

### POST `/flash-sales`

Auth: ADMIN

Body:

```json
{
  "name": "Weekend Sale",
  "start_time": "2026-07-14T00:00:00.000Z",
  "end_time": "2026-07-15T00:00:00.000Z",
  "status": "active",
  "items": [
    {
      "product_id": "1",
      "discount_percentage": 20,
      "stock_quantity": 10
    }
  ]
}
```

`discount_price` is calculated from product price.

### PUT `/flash-sales/:id`

Auth: ADMIN

Body: same as create, optional. If `items` present, backend recreates item list.

### DELETE `/flash-sales/:id`

Auth: ADMIN

Hard delete.

## Cart

### GET `/cart`

Auth: Auth

Success `DT`: cart with `cart_items`, each item includes product and primary image.

### POST `/cart`

Auth: Auth

Body:

```json
{
  "product_id": "1",
  "variant_id": "10",
  "quantity": 2
}
```

Required: `product_id`, `quantity`.

Rules:

- Product must be active.
- Variant, if sent, must belong to product.
- Stock must be enough.
- If same product/variant exists, quantity increments.

### PUT `/cart/:item_id`

Auth: Auth

Body:

```json
{
  "quantity": 3,
  "is_selected": true
}
```

If `quantity <= 0`, backend deletes the item.

### DELETE `/cart/:item_id`

Auth: Auth

Deletes cart item.

## Orders

### GET `/orders`

Auth: Auth

Query:

```text
page=1
limit=10
status=pending|confirmed|shipping|completed|cancelled
```

Permission:

- ADMIN sees all.
- Other roles see own orders.

Success `DT`:

```json
{
  "totalRows": 10,
  "totalPages": 1,
  "orders": []
}
```

Orders include `payments`, `order_items`.

### GET `/orders/:id`

Auth: Auth

Permission: ADMIN or owner.

Success `DT`: order with `order_items`, `payments`, `address`.

### POST `/orders/checkout`

Auth: Auth

Body using DB cart:

```json
{
  "address_id": "1",
  "payment_method": "cod",
  "voucher_code": "SALE10",
  "note": "Call before delivery"
}
```

Body direct checkout from FE/localStorage:

```json
{
  "address_id": "1",
  "payment_method": "cod",
  "voucher_code": "SALE10",
  "note": "Call before delivery",
  "items": [
    {
      "product_id": "1",
      "variant_id": "10",
      "quantity": 2
    }
  ]
}
```

Required: `address_id`, `payment_method`.

Payment method used in service: `cod` or `online`.

Rules:

- Address must belong to current user.
- If `items` absent, checkout selected DB cart items.
- Shipping fee: free if subtotal >= 500000, otherwise 30000.
- Creates `order`, `order_items`, `payment`.
- Decrements stock and increments sold quantity.
- Deletes processed cart items only in DB cart mode.

Success `DT`: created order.

### POST `/orders/guest-checkout`

Auth: Public

Body:

```json
{
  "full_name": "Nguyen Van A",
  "phone": "0900000000",
  "email": "guest@example.com",
  "address_line": "123 ABC",
  "ward": "Ward",
  "district": "District",
  "province": "Province",
  "payment_method": "cod",
  "voucher_code": "SALE10",
  "note": "Call before delivery",
  "items": [
    {
      "product_id": "1",
      "variant_id": "10",
      "quantity": 2
    }
  ]
}
```

Required: `full_name`, `phone`, `email`, `address_line`, `province`, `payment_method`, `items`.

Rules:

- Creates active CUSTOMER user with generated password and `require_password_change = true`.
- Creates address, order, payment.
- Emails generated account credentials.
- If email/phone already exists as active user, returns `EC = 2`.

Success `DT`: order plus `guest_account`.

### PUT `/orders/:id/status`

Auth: ADMIN, STAFF

Body:

```json
{
  "status": "confirmed"
}
```

Valid: `pending`, `confirmed`, `shipping`, `completed`, `cancelled`.

If cancelling, stock is returned.

## Payments

### GET `/payments`

Auth: ADMIN

Query: `page`, `limit`

Success `DT`: `{ totalRows, totalPages, payments }`.

### PUT `/payments/:id/status`

Auth: ADMIN, STAFF

Body:

```json
{
  "status": "paid"
}
```

Valid: `pending`, `waiting_store_payment`, `paid`, `failed`, `refunded`, `cancelled`.

## Branches

### GET `/branches`

Auth: Public

Success `DT`: active branches.

## Clinic Services

### GET `/services`

Auth: Public

Query:

```text
page=1
limit=10
filter=keyword
category_id=1
```

Success `DT`: `{ totalRows, totalPages, services }`.

### GET `/services/pricing-matrix`

Auth: Public

Success `DT`: array categories:

```json
[
  {
    "category_id": "1",
    "category_name": "Grooming",
    "weight_ranges": [
      {
        "min": 0,
        "max": 5,
        "label": "Duoi 5kg"
      }
    ],
    "services": [
      {
        "service_id": "1",
        "service_name": "Bath",
        "prices": [
          {
            "weight_label": "Duoi 5kg",
            "price": 100000,
            "is_contact": false
          }
        ]
      }
    ]
  }
]
```

### GET `/services/categories`

Auth: Public

Success `DT`: active service categories.

### GET `/services/:id`

Auth: Public

Success `DT`: service with category.

### POST `/services`

Auth: ADMIN

Body:

```json
{
  "service_name": "General Exam",
  "category_id": "1",
  "description": "Basic check",
  "base_price": 200000,
  "duration_minutes": 30,
  "status": "active"
}
```

Required: `service_name`, `category_id`, `base_price`.

### PUT `/services/:id`

Auth: ADMIN

Body: same as create, optional.

### DELETE `/services/:id`

Auth: ADMIN

Soft delete bang `status = inactive`.

## Appointments

### GET `/appointments/my-history`

Auth: Auth

Success `DT`: current user's appointments with doctor, pet, appointment services.

### GET `/appointments/slots`

Auth: Public

Query:

```text
date=2026-07-14
doctor_id=1
branch_id=1
service_type=exam|grooming
```

Required: `date`.

Success `DT`: available `timeSlot[]`, include doctor name.

### GET `/appointments/:id`

Auth: Auth

Permission:

- CUSTOMER can read own appointment only.
- Other roles can read.

Success `DT`: appointment with doctor, pet, services, status history.

### POST `/appointments`

Auth: Auth

Body:

```json
{
  "slot_id": "1",
  "pet_id": "1",
  "pet_data": {
    "pet_name": "Milo",
    "species_id": "1",
    "breed_id": "2",
    "weight_kg": 6,
    "age": "2",
    "gender": "male"
  },
  "service_ids": [
    "1",
    {
      "service_id": "2",
      "quantity": 1
    }
  ],
  "customer_name_snapshot": "Nguyen Van A",
  "customer_phone_snapshot": "0900000000",
  "condition_description": "Ho",
  "note": "Can bac si nu"
}
```

Required: `slot_id`, non-empty `service_ids`, `customer_name_snapshot`.

Rules:

- Slot must be available.
- Cannot mix exam and grooming service types in one appointment.
- Slot `slot_type` must match service type.
- Weight surcharge logic exists in service.

Success `DT`: created appointment.

### PATCH `/appointments/:id/cancel`

Auth: Auth

Cancels appointment. CUSTOMER can cancel own appointment. Late cancel under 24h increments `no_show_count`.

### PATCH `/appointments/:id/status`

Auth: ADMIN, STAFF, DOCTOR

Body:

```json
{
  "status": "confirmed",
  "note": "Confirmed by staff"
}
```

Valid: `pending`, `confirmed`, `completed`, `cancelled`, `rescheduled`, `missed`.

### GET `/appointments/:id/pricing`

Auth: Auth

Query:

```text
voucher_code=SALE10
```

Success `DT`:

```json
{
  "subtotal": 200000,
  "surcharge_amount": 0,
  "discount_amount": 0,
  "total": 200000,
  "services": [],
  "voucher_error": null
}
```

### POST `/appointments/:id/checkout`

Auth: Auth

Body:

```json
{
  "payment_method": "store",
  "voucher_code": "SALE10"
}
```

Used for checkout existing appointment.

### POST `/appointments/preview-pricing`

Auth: Public route, but controller passes `req.user`; currently no auth middleware, so `req.user` is usually undefined.

Body:

```json
{
  "pet_id": "1",
  "pet_data": {
    "weight_kg": 6
  },
  "service_ids": [
    "1",
    {
      "service_id": "2",
      "quantity": 1
    }
  ],
  "voucher_code": "SALE10"
}
```

Success `DT`: same pricing style as appointment pricing.

### POST `/appointments/book`

Auth: Auth

Body:

```json
{
  "slot_id": "1",
  "pet_id": "1",
  "pet_data": {
    "pet_name": "Milo",
    "species_id": "1",
    "breed_id": "2",
    "weight_kg": 6,
    "age": "2",
    "gender": "male"
  },
  "service_ids": [
    {
      "service_id": "1",
      "quantity": 1
    }
  ],
  "customer_name_snapshot": "Nguyen Van A",
  "customer_phone_snapshot": "0900000000",
  "condition_description": "Ho",
  "note": "Can bac si nu",
  "payment_method": "store",
  "voucher_code": "SALE10"
}
```

Required: `slot_id`, non-empty `service_ids`, `customer_name_snapshot`, `payment_method`.

Rules:

- If user `no_show_count >= 2`, cannot use `payment_method = store`.
- Creates appointment, order, payment in one transaction.

Success `DT`:

```json
{
  "appointment": {},
  "order": {},
  "payment": {}
}
```

Recommended FE flow:

1. GET `/services/categories`
2. GET `/services?category_id=...`
3. GET `/appointments/slots?date=...&branch_id=...&service_type=exam|grooming`
4. POST `/appointments/preview-pricing`
5. POST `/appointments/book`

## Medical Records

### GET `/medical-records/pet/:petId`

Auth: Auth

Permission:

- CUSTOMER can read own pet records only.
- Other roles can read.

Success `DT`: records with doctor and attachments.

### GET `/medical-records/:id`

Auth: Auth

Success `DT`: record with doctor, pet owner id, attachments.

### POST `/medical-records`

Auth: Auth, multipart supported

Body fields:

```json
{
  "pet_id": "1",
  "doctor_id": "1",
  "appointment_id": "1",
  "record_name": "Checkup",
  "visit_date": "2026-07-14",
  "symptoms": "Cough",
  "diagnosis": "Mild cold",
  "treatment_note": "Rest",
  "attachments": [
    {
      "file_url": "/uploads/x.png",
      "file_type": "image",
      "file_name": "x.png"
    }
  ]
}
```

Files:

```text
attachments[] up to 5 files
```

Allowed file MIME: JPEG, PNG, GIF, PDF. Max 10 MB/file.

Rules:

- CUSTOMER can create only for own pet; `source_type = user_uploaded`.
- Other roles create as `doctor_created`.

### PUT `/medical-records/:id`

Auth: Auth, multipart supported

Body: `record_name`, `symptoms`, `diagnosis`, `treatment_note`, `visit_date`, `doctor_id`, plus new files.

Rules:

- CUSTOMER can edit only own `user_uploaded` record.
- Doctor-created record can be edited by creator doctor or ADMIN.

### DELETE `/medical-records/:id`

Auth: Auth

Rules same as update for CUSTOMER.

## Health Diaries And Reminders

### GET `/health-diaries/pet/:petId`

Auth: Auth

Query: `month`, `year`

Success `DT`: diary entries with attachments.

### POST `/health-diaries`

Auth: Auth

Body:

```json
{
  "pet_id": "1",
  "entry_date": "2026-07-14",
  "entry_time": "10:00",
  "icon_code": "heart",
  "color_code": "#ff0000",
  "title": "An uong",
  "content": "An tot",
  "attachments": [
    {
      "file_url": "/uploads/a.png",
      "file_type": "image",
      "file_name": "a.png"
    }
  ]
}
```

### GET `/reminders/pet/:petId`

Auth: Auth

Success `DT`: reminders sorted by `remind_date`.

### POST `/reminders`

Auth: Auth

Body:

```json
{
  "pet_id": "1",
  "reminder_type": "vaccination",
  "title": "Tiem phong",
  "remind_date": "2026-08-01",
  "remind_before_days": 3,
  "repeat_type": "none",
  "notes": "Mui 2"
}
```

### PATCH `/reminders/:id/complete`

Auth: Auth

Sets `status = completed`.

### DELETE `/reminders/:id`

Auth: Auth

Deletes reminder.

## Reviews

### GET `/reviews`

Auth: Public

Query: `page`, `pageSize` or `limit`

Success `DT`: `{ totalRows, totalPages, reviews }`.

### GET `/reviews/target/:targetType/:targetId`

Auth: Public

Path:

```text
targetType=product|service
```

Query: `page`, `limit`

Success `DT`: parent reviews with user, images, replies, likes.

### GET `/reviews/can-review/:targetType/:targetId`

Auth: Auth

Success `DT`: boolean.

Rules:

- User cannot review same target twice.
- Product review requires completed order containing product.
- Service review requires completed appointment using service.

### POST `/reviews`

Auth: Auth

Body:

```json
{
  "target_type": "product",
  "target_id": "1",
  "rating": 5,
  "comment": "Good",
  "images": ["/uploads/review.png"]
}
```

Required: `target_type`, `target_id`, `rating`.

### PATCH `/reviews/:id/reject`

Auth: ADMIN

Sets review status `rejected`.

### PATCH `/reviews/:id/delete`

Auth: ADMIN

Sets review status `deleted`.

### POST `/reviews/:id/like`

Auth: Auth

Toggles like. Success `DT`: `{ liked: true|false }`.

### POST `/reviews/:id/reply`

Auth: Auth

Body:

```json
{
  "comment": "Cam on ban",
  "images": []
}
```

Creates reply review with `rating = 5`.

## Vouchers And Loyalty

### GET `/vouchers`

Auth: ADMIN

Success `DT`: all vouchers.

### POST `/vouchers`

Auth: ADMIN

Body expected by service:

```json
{
  "code": "SALE10",
  "discount_type": "percentage",
  "discount_value": 10,
  "max_discount": 50000,
  "min_order_value": 200000,
  "start_date": "2026-07-14",
  "end_date": "2026-08-14",
  "usage_limit": 100,
  "status": "active"
}
```

### POST `/vouchers/apply`

Auth: Auth

Body:

```json
{
  "code": "SALE10",
  "order_value": 300000
}
```

Success `DT`:

```json
{
  "discountAmount": 30000,
  "voucher_id": "1"
}
```

### GET `/loyalty/my-points`

Auth: Auth

Success `DT`: `{ points }`.

### GET `/loyalty/transactions`

Auth: Auth

Success `DT`: loyalty transactions.

## Posts, First Aid, AI Chat

### GET `/post-categories`

Auth: Public

Success `DT`: active post categories.

### GET `/posts/featured`

Auth: Public

Success `DT`: latest featured published post or `null`.

### GET `/posts/trending`

Auth: Public

Query: `limit`, default 4.

Success `DT`: posts ordered by `view_count desc`.

### GET `/posts`

Auth: Public

Query:

```text
page=1
limit=10
type=official_blog|community|community_post
categoryId=1
excludeId=1
```

Returns non-featured published posts.

### GET `/posts/:slug`

Auth: Public

Success `DT`: post with author, category, comments. Also increments `view_count` async.

### POST `/posts`

Auth: Auth

Body:

```json
{
  "post_category_id": "1",
  "title": "Title",
  "excerpt": "Short text",
  "content": "Full content",
  "thumbnail_url": "/uploads/post.png",
  "status": "published"
}
```

Post type:

- ADMIN creates `official_blog`.
- Others create `community`.

### GET `/first-aid/categories`

Auth: Public

Success `DT`: active first aid categories.

### GET `/first-aid/guides`

Auth: Public

Query:

```text
page=1
limit=10
categoryId=1
search=keyword
excludeId=1
```

Success `DT`: `{ totalRows, totalPages, guides }`.

### GET `/first-aid/guides/:slug`

Auth: Public

Success `DT`: guide with category, ordered steps, media.

### POST `/first-aid/guides`

Auth: ADMIN

Body:

```json
{
  "first_aid_category_id": "1",
  "title": "Choking",
  "situation_description": "What to do",
  "emergency_phone": "0868686868",
  "video_url": "https://...",
  "status": "published"
}
```

### GET `/ai-chat/sessions`

Auth: Auth

Success `DT`: current user's AI chat sessions.

### POST `/ai-chat/sessions`

Auth: Auth

Body: none used currently.

Success `DT`: created session.

## Rescue And Adoption

### GET `/rescue/stations`

Auth: Public

Success `DT`: active rescue stations.

### GET `/rescue/posts`

Auth: Public

Success `DT`: published rescue posts.

### GET `/adoptions/pets`

Auth: Public

Success `DT`: available adoption pets with images.

### POST `/adoptions/requests`

Auth: Auth

Body expected by service:

```json
{
  "adoption_pet_id": "1",
  "message": "I want to adopt"
}
```

Rules:

- Pet must be available.
- Max 3 pending requests per user.
- Cannot create 2 pending requests for same pet.

### GET `/adoptions/my-requests`

Auth: Auth

Success `DT`: current user's adoption requests with pet and images.

### PATCH `/adoptions/requests/:id/status`

Auth: ADMIN

Body:

```json
{
  "status": "approved"
}
```

Valid: `pending`, `approved`, `rejected`.

If approved, pet status becomes `adopted`, other pending requests are rejected.

## FE Integration Flows

### Login flow

1. POST `/login`.
2. Store `DT.access_token`.
3. Store `DT.user` in auth state.
4. Send `Authorization: Bearer <token>` for protected APIs.
5. On `EC = -999` or HTTP 401, POST `/refresh` with credentials.
6. If refresh fails, logout.

### Register flow

1. POST `/register`.
2. Ask user for OTP.
3. POST `/verify-register-otp`.
4. Redirect to login.

### Product checkout flow

1. GET `/products`, `/products/:id`.
2. POST `/cart` or keep local cart.
3. Auth checkout:
   - GET `/users/:id/addresses`.
   - POST `/orders/checkout`.
4. Guest checkout:
   - POST `/orders/guest-checkout`.
   - If success, FE can show generated `guest_account` and ask user to change password after login.

### Appointment booking flow

1. GET `/branches`.
2. GET `/services/categories`.
3. GET `/services?category_id=...`.
4. GET `/appointments/slots?date=YYYY-MM-DD&branch_id=...&service_type=exam|grooming`.
5. POST `/appointments/preview-pricing`.
6. POST `/appointments/book`.
7. Show appointment/order/payment result from `DT`.

### Pet health flow

1. GET `/my-pets`.
2. GET `/medical-records/pet/:petId`.
3. GET `/health-diaries/pet/:petId?month=7&year=2026`.
4. GET `/reminders/pet/:petId`.

## Can Kiem Thu Runtime Truoc Khi Noi FE Chinh Thuc

Mot so diem trong source co dau hieu lech ten model/field so voi `prisma/schema.prisma`; FE nen test thuc te bang Postman/local server truoc khi dong UI:

- `userAPIService.deleteUser` set `status = deleted`, nhung enum `UserStatus` trong schema chi co `active`, `inactive`, `disabled`.
- `clinicServiceAPIService` dung `category_id`, trong schema service relation field la `service_category_id`.
- Mot so appointment code dung `pet.user_id`, `pet.health_condition`, trong schema pet dang la `owner_user_id`, `health_status`.
- `paymentAPIService.updatePaymentStatus` dung field/model naming co the lech voi schema hien tai.
- `loyaltyAPIService` dung voucher fields `code`, `max_discount`, `min_order_value`, `start_date`, trong khi order checkout dung `voucher_code`, `max_discount_amount`, `min_order_amount`, `start_at`.
- `loyaltyAPIService.getMyPoints` doc `user.loyalty_points`, trong schema diem nam o `LoyaltyAccount`.
- `reviewAPIService` co cho service review dung `clinicService`/`service_id` theo cach co the lech schema.
- `rescueAPIService` include `station`, `adoption_pet_images`, va update `request_id`; schema hien tai co `images` va `adoption_request_id`, khong thay relation station trong rescue/adoption models.
- `contentAPIService` dung `prisma.aIChatSession`; Prisma generated client thuong la `prisma.aiChatSession`.

De FE noi chuan, nen uu tien test va dong contract theo cac API dang duoc dung ngay: Auth, Products, Cart, Orders, Pets, Branches, Services, Appointments. Cac module Phase 4 can smoke test ky hon.
