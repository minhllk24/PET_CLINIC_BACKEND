# Pet Clinic Backend

Đây là Source Code hệ thống Backend Quản lý Phòng Khám Thú Y & Thương mại điện tử dành cho Pet.
Kiến trúc: **NodeJS (Express) + MongoDB**.

## Yêu cầu môi trường
- NodeJS: `>= v20`
- MongoDB: Mongoose (Atlas hoặc Local)
- Công cụ test API: Postman / Thunder Client

## Cài đặt và Chạy dự án

**Bước 1: Cài đặt thư viện**
Mở Terminal tại thư mục gốc của dự án (`PET_CLINIC_BACKEND`) và gõ:
```bash
npm install
```

**Bước 2: Cấu hình biến môi trường**
- Copy file `.env.example` và đổi tên thành `.env`.
- Cấu hình lại biến `MONGODB_URI` theo thông tin kết nối MongoDB của bạn (MongoDB Atlas hoặc Local).
- Đảm bảo biến `CUSTOMER_APP_URL` và `ADMIN_APP_URL` trỏ tới đúng URL của môi trường Angular (mặc định localhost:3000 và localhost:3001).

**Bước 3: Khởi động Server**
```bash
npm run dev
```
Nếu Terminal báo `SERVER is running on PORT: 8080`, bạn đã cài đặt thành công!

---
*Developed by Group_Project_Pet_Clinic.*
