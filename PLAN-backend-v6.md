# PLAN-backend-v6

## 1. Overview
Bản kế hoạch này nhằm xây dựng và tái cấu trúc toàn diện hệ thống backend cho Pet Clinic (phiên bản v6). Dự án sẽ chuyển đổi từ MySQL sang MongoDB (replica set), áp dụng kiến trúc Modular Monolith trên nền tảng Express.js hiện có, và tuân thủ chặt chẽ tài liệu OpenAPI v6. Kế hoạch được chia thành nhiều giai đoạn (Milestones) đi từ nền tảng, dữ liệu cốt lõi đến các luồng nghiệp vụ phức tạp.

## 2. Project Type
**BACKEND**

## 3. Success Criteria
- [ ] Hoàn thành script migration dữ liệu từ MySQL sang MongoDB đảm bảo tính toàn vẹn (tham chiếu `12-mysql-to-mongodb-migration-v6.md`).
- [ ] Database MongoDB Schema và Indexes được thiết lập chuẩn xác (tham chiếu `05-mongodb-schema-v6.md` & `06-mongodb-index-workload-v6.md`).
- [ ] 100% các API tuân thủ hợp đồng OpenAPI v6 (`07-openapi-v6.yaml`).
- [ ] Thực thi đúng các State Machines (`09-state-machines-v6.md`) và Multi-document transactions.
- [ ] Các logic nghiệp vụ: Đặt lịch (Availability engine), Checkout (Fulfillment Branch Resolver), Thanh toán, Inventory được implement chính xác.

## 4. Tech Stack
- **Framework:** Node.js + Express.js (giữ nguyên stack hiện tại, tái cấu trúc theo v6).
- **Database:** MongoDB (Replica Set bắt buộc để hỗ trợ multi-document transactions).
- **API Spec:** OpenAPI 3.0 (First-approach).
- **Auth:** JWT (Access Token 15m + Refresh Rotation).
- **Testing:** Jest / Supertest (theo chiến lược kiểm thử tại file 14).

## 5. File Structure
Cấu trúc cơ bản theo kiến trúc Modular Monolith:
```text
src/
├── app.js
├── shared/ (middleware, errorHandler, db connection)
├── modules/
│   ├── identity/ (auth, users)
│   ├── customer/ (customers, pets)
│   ├── branch/ (branches, branch_services)
│   ├── staff/ (profiles, shifts)
│   ├── catalog/ (categories, products, services)
│   ├── order/ (cart, orders, returns)
│   ├── booking/ (appointments, availability)
│   ├── execution/ (service_records)
│   ├── inventory/ (stocks, transactions)
│   ├── payment/ (mock provider, refunds)
│   └── notification/ (outbox, emails)
└── scripts/
    └── migration/ (MySQL to MongoDB)
```

## 6. Task Breakdown

### Milestone 1: Foundation & Data Migration (Giai đoạn Nền tảng)
- **[x] TASK 1.1:** Cấu hình MongoDB Replica Set và kết nối DB hỗ trợ Transactions. (Agent: `backend-specialist`, Skill: `database-design`)
  - *Input:* Cấu hình `.env`.
  - *Output:* Mongoose connection config hỗ trợ session/transactions.
  - *Verify:* Chạy thử một transaction rỗng thành công.
- **[x] TASK 1.2:** Định nghĩa toàn bộ Mongoose Schemas (Collections) theo tài liệu số 05. (Agent: `backend-specialist`, Skill: `database-design`)
  - *Input:* `05-mongodb-schema-v6.md`
  - *Output:* Các file model `.js` trong từng module.
  - *Verify:* Schemas load thành công, không lỗi syntax.
- **[x] TASK 1.3:** Định nghĩa MongoDB Indexes theo tài liệu số 06. (Agent: `backend-specialist`, Skill: `database-design`)
  - *Input:* `06-mongodb-index-workload-v6.md`
  - *Output:* Script khởi tạo/sync indexes.
  - *Verify:* Các indexes đặc thù (text, compound, TTL) được tạo trên DB.
- **[x] TASK 1.4:** (HỦY BỎ) Viết ETL Script chuyển đổi dữ liệu MySQL -> MongoDB.
  - *Note:* Tài liệu `12-mysql-to-mongodb-migration-v6.md` xác nhận không yêu cầu migrate dữ liệu (NO DATA MIGRATION IN CURRENT IMPLEMENTATION SCOPE). Backend làm lại từ đầu.

### Milestone 2: Core Modules & Authorization (Giai đoạn API Cốt lõi)
- **[x] TASK 2.1:** Thiết lập Middleware Validate OpenAPI và Authorization (Role/Branch Matrix). (Agent: `backend-specialist`, Skill: `api-patterns`)
  - *Input:* `07-openapi-v6.yaml`, `08-authorization-matrix-v6.md`
  - *Output:* Express middleware (CORS, JWT verify, Role check, OpenAPI validator).
  - *Verify:* API reject khi sai role, sai schema.
- **[x] TASK 2.2:** Xây dựng module Identity (Login, OTP, Token Refresh). (Agent: `backend-specialist`)
  - *Verify:* Đăng nhập trả về JWT đúng chuẩn, Refresh hoạt động.
- **[x] TASK 2.3:** Xây dựng module Branch, Staff, Shift & Service Catalog. (Agent: `backend-specialist`)
  - *Verify:* Thêm/Sửa/Xóa branch, tạo staff, gán shift thành công.
- **[x] TASK 2.4:** Xây dựng module Customer & Pet. (Agent: `backend-specialist`)
  - *Verify:* API CRUD Customer/Pet chạy đúng phân quyền.

### Milestone 3: Business Logic & State Machines (Giai đoạn Nghiệp vụ Phức tạp)
- **[x] TASK 3.1:** Xây dựng module Inventory (Append-only Ledger). (Agent: `backend-specialist`)
  - *Input:* `03-target-system-architecture-v6.md`, `09-state-machines-v6.md`
  - *Output:* Logic cập nhật Tồn kho (RECEIPT, ISSUE, ADJUSTMENT) qua Transaction.
  - *Verify:* Tồn kho cập nhật atomic và lưu history transaction.
- **[x] TASK 3.2:** Xây dựng luồng Order & Cart (Fulfillment Branch Resolver). (Agent: `backend-specialist`)
  - *Output:* Checkout API với thuật toán tự động tính toán branch lấy hàng, giảm trừ voucher và tính phí ship.
  - *Verify:* Tạo đơn hàng thành công trong 1 transaction (giảm tồn, tạo order, đổi trạng thái thanh toán PENDING).
- **[x] TASK 3.3:** Xây dựng Availability Engine & Đặt lịch (Booking). (Agent: `backend-specialist`)
  - *Input:* Rule chia segment booking và tính toán Staff availability.
  - *Output:* API `appointmentsCreate` (giữ slot, chọn staff phù hợp cho từng segment, xử lý deposit/mock online payment).
  - *Verify:* Từ chối khi double-booking, lock đúng slot, chia tiền cọc (30%) hoặc full theo cài đặt.
- **[x] TASK 3.4:** Xây dựng Service Execution & Encounter Finalization. (Agent: `backend-specialist`)
  - *Output:* Logic Nurse báo cáo/hoàn tất từng segment, Vet finalize để cập nhật ServiceRecord và tính toán vật tư thực tế.
  - *Verify:* State record đổi thành COMPLETED chuẩn xác sau bước cuối.

### Milestone 4: Integration & Polishing (Giai đoạn Tích hợp & Kiểm thử)
- **[x] TASK 4.1:** Tích hợp Outbox pattern (Email, SMS) & Notifications. (Agent: `backend-specialist`)
  - *Verify:* Notification lưu vào bảng Outbox để job worker gửi ngầm.
- **[x] TASK 4.2:** Xây dựng module Return & Refund (tính toán tiền hoàn trả). (Agent: `backend-specialist`)
  - *Verify:* Đơn trả hàng sinh đúng số tiền hoàn theo tỷ lệ discount lớn nhất (largest remainder).
- **[x] TASK 4.3:** Xây dựng logic định tuyến Cronjobs (Xóa/Hủy order/booking hết hạn). (Agent: `backend-specialist`)
  - *Verify:* Job quét timeout thành công.
- **[x] TASK 4.4:** Áp dụng Contract Testing. (Agent: `test-engineer`, Skill: `testing-patterns`)
  - *Input:* `14-api-contract-test-strategy-v6.md`
  - *Output:* Bộ test case Jest/Supertest cho các luồng cốt lõi.
  - *Verify:* `npm run test` pass 100%.

## 7. Phase X: Final Verification
- [x] Linter & Type Check: Code format sạch đẹp, không lỗi.
- [x] Security Scan: Pass các module check quyền (Authorization matrix không lọt).
- [x] Unit & Integration Tests: Pass (đặc biệt test các multi-document transactions).
- [x] Đảm bảo Socratic Gate được tôn trọng và tài liệu v6 đã được map chuẩn.
- [x] Start server thành công và gọi thử một API `/api/v1/health` (hoặc tương tự).
