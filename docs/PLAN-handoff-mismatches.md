# Kế hoạch khắc phục Mismatch (Backend Handoff)

Mục tiêu: Cập nhật Backend v6 để tuân thủ 100% các yêu cầu khắt khe (strict invariants) được mô tả trong tài liệu `BACKEND_HANDOFF_LATEST_WEB2.md`.

## 1. Mục tiêu (Goals)
- Tách biệt Guest Token cho Cart và Lookup.
- Áp dụng thuật toán Fulfillment Priority từ `system_settings`.
- Chặn Booking sai logic (trộn lẫn serviceType).
- Ngăn chặn ghi đè ServiceRecord đồng thời (Optimistic Concurrency).

## 2. Các thay đổi dự kiến (Scope of Work)

### Phase 1: Guest Token Separation & Middleware
- **[x] TASK 1.1:** Cập nhật Middleware `optionalAuth.js` / `authorizeRequest.js` (hoặc tạo middleware mới `guestLookupAuth.js`) để kiểm tra `X-Guest-Lookup-Token`. (Agent: `backend-specialist`)
- **[x] TASK 1.2:** Cập nhật API Cart và Order để dùng `X-Guest-Cart-Token` (đổi tên Header từ `x-guest-token` sang `x-guest-cart-token`). (Agent: `backend-specialist`)

### Phase 2: Booking Constraint
- **[x] TASK 2.1:** Thêm logic kiểm tra `serviceType` trong `createAppointment` (`src/modules/booking/booking.service.js`). Bắn lỗi 400 nếu list services chứa cả MEDICAL và GROOMING. (Agent: `backend-specialist`)

### Phase 3: Optimistic Concurrency (CAS)
- **[x] TASK 3.1:** Cập nhật schema `ServiceRecord` thêm trường `version` (kiểu số nguyên). (Agent: `backend-specialist`)
- **[x] TASK 3.2:** Bắt buộc truyền `expectedVersion` vào body của API `finalizeRecord` / `submitReview` / `updateMaterials`. Ném lỗi `409 CONFLICT` nếu `expectedVersion != currentVersion`. Sau khi save thành công, tăng `version` lên 1. (Agent: `backend-specialist`)

### Phase 4: Order Fulfillment Priority
- **[x] TASK 4.1:** Seed cấu hình mặc định cho `SystemSetting` (`commerce.fulfillmentBranchPriority`). (Agent: `backend-specialist`)
- **[x] TASK 4.2:** Cập nhật `order.service.js` thay vì dùng `Branch.find()` thường, sẽ parse priority list từ Setting để tìm branch đủ hàng sớm nhất. (Agent: `backend-specialist`)

## 3. Phase X: Final Verification
- [x] Chạy lại `npm run test` để đảm bảo không phá vỡ tính tương thích của Contract cũ.
- [x] Xác nhận 4 lỗi mismatch đã được đóng và Push code lên GitHub.
