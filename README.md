# Pet Clinic Backend

Đây là Source Code hệ thống Backend Quản lý Phòng Khám Thú Y & Thương mại điện tử dành cho Pet. 
Kiến trúc: **NodeJS (Express) + Prisma + MySQL**.

## Yêu cầu môi trường
- NodeJS: `>= v20`
- MySQL Server: `>= v8`
- Công cụ test API: Postman / Thunder Client

## Cài đặt và Chạy dự án

**Bước 1: Cài đặt thư viện**
Mở Terminal tại thư mục gốc của dự án (`PET_CLINIC_BACKEND`) và gõ:
```bash
npm install
npm install @prisma/client
npm install prisma --save-dev
```

**Bước 2: Cấu hình biến môi trường**
- Copy file `.env.example` và đổi tên thành `.env`.
- Cấu hình lại biến `DATABASE_URL` theo thông tin kết nối MySQL của máy bạn (username, password, port, tên database).

**Bước 3: Khởi tạo Database và Nạp dữ liệu mẫu**
Đảm bảo MySQL của bạn đang chạy. Sau đó gõ lần lượt các lệnh:
```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```
- Lệnh `migrate dev` sẽ tạo bảng trong MySQL.
- Lệnh `generate` sẽ tạo Prisma Client.
- Lệnh `db seed` sẽ nạp tự động tài khoản Admin, Bác sĩ, Khách hàng, 5 danh mục và 40 sản phẩm mẫu (dữ liệu thật từ PetMart) cùng hình ảnh và biến thể.

> 💡 **Lưu ý để tránh trùng lặp dữ liệu (Duplicate Data):**
> Lệnh `npx prisma db seed` sẽ liên tục chèn thêm dữ liệu nếu chạy nhiều lần. Để dọn sạch Database hoàn toàn và tự động nạp lại 1 bộ dữ liệu chuẩn duy nhất (không bị duplicate), hãy chạy lệnh:
> ```bash
> npx prisma migrate reset
> ```

**Bước 4: Khởi động Server**
```bash
npm start
```
Nếu Terminal báo `SERVER is running on PORT: 8080`, bạn đã cài đặt thành công!

## Thông tin đăng nhập mẫu (Seed Data)
Tất cả các tài khoản mẫu đều có chung password là: `12345678`
- Admin: `admin@petclinic.com`
- Doctor: `doctor1@petclinic.com`
- Customer: `customer1@petclinic.com`

---
*Developed by Group_Project_Pet_Clinic.*
