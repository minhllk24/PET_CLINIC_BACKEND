# Foundation Setup (Server + Mongo + Config + Error/Response + Auth skeleton + Health)

## Goal
Hoàn thành 4 đầu mục task nền tảng cho backend MongoDB **đúng contract `docs/07-openapi-v5.yaml`** (greenfield, `/api/v1`, RFC 9457) để FE test kết nối.

Nguồn: 02 (BE cũ = OBSOLETE), 03 (kiến trúc), 07 (contract), 08 (authz), 11 (enum/errorCode), 13 (security), 14 (test), 15 (ADR-21/23).

## Hiện trạng 4 đầu mục

| # | Đầu mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Server structure + MongoDB connection | 🟡 Một phần | Kết nối Atlas OK (replica set, đủ cho transaction). Chưa có cấu trúc module, vẫn chạy chung code Prisma/MySQL cũ |
| 2 | Env/config, logging, global error handler, validation convention | 🟡 Một phần | Có `MONGODB_URI`, có `errorHandler`/`AppError` nhưng **chưa đúng spec**. Chưa có logging, config fail-fast, validation |
| 3 | Response format thống nhất + auth middleware skeleton | 🔴 Sai hướng | `ApiResponse {status,message,data}` **mâu thuẫn spec** (spec trả resource trần). `authMiddleware` cũ dùng `role_code`, `{EM,EC,DT}` |
| 4 | Base route / health check | 🟡 Một phần | Đã có `GET /api/v1/health` (inline trong `api.js`), chưa chuẩn hóa, chưa kiểm tra DB |

### Phát hiện cần xử lý
1. **Spec không có envelope**: 2xx trả thẳng schema (ví dụ `AuthTokens`, `CustomerPage {items, nextCursor}`); chỉ lỗi dùng `application/problem+json`. Phân trang là **cursor** (`limit`, `cursor`, `nextCursor`), không phải page/offset.
2. **`Problem` bắt buộc** `type, title, status, code, correlationId` (+ `errors[]`, `suggestedGroups`). `code` thuộc enum `ErrorCode` (doc 11). `errorHandler` hiện tại thiếu `code`, `correlationId`, và sai content-type.
3. **Legacy còn chạy**: `server.js` vẫn gắn `routes/api` (Prisma) và `initCronJobs()` — log "generated slots" cho thấy cron **vẫn ghi vào MySQL mỗi lần khởi động**.
4. **Bảo mật lệch doc 13**: CORS còn wildcard `*.vercel.app` + ngrok (doc 13: allowlist đúng 2 origin Angular); body limit 50mb; JWT secret placeholder; chưa có helmet/rate limit.
5. `/health` **không có trong OpenAPI** → cần quyết định (xem Câu hỏi).

## Tasks (theo thứ tự phụ thuộc)

- [x] **T1 Cô lập legacy**: tạo branch mới (doc 02: không force-push); tách app mới khỏi route/cron Prisma (không import `routes/api` cũ, không gọi `initCronJobs`). → Verify: `npm run dev` không còn log "generated slots", không kết nối MySQL.
- [x] **T2 Cấu trúc server**: tách `src/app.js` (express app) và `src/server.js` (listen + connect DB + graceful shutdown); thư mục `src/modules/`, `src/shared/` (errors, http, middleware, config). → Verify: server chỉ listen sau khi `mongoose.connect` thành công; Ctrl+C đóng kết nối sạch.
- [x] **T3 Config fail-fast**: `src/shared/config` đọc `.env`, thiếu `MONGODB_URI`/`JWT_*` thì thoát có thông báo; cập nhật `.env.example` (không chứa secret thật). → Verify: xóa `MONGODB_URI` → process dừng với lỗi rõ ràng.
- [x] **T4 Logging + correlationId**: middleware gán `X-Correlation-Id` (nhận hoặc sinh UUID), logger có cấp độ, **redact** password/OTP/token/cartToken (doc 13). → Verify: mỗi request có log kèm correlationId, header trả về cùng giá trị.
- [x] **T5 Error model chuẩn RFC 9457**: viết lại `AppError(status, code, detail, errors?)` + `errorHandler` → `application/problem+json` với `type,title,status,code,correlationId,instance`; map CastError/E11000/ValidationError/JSON parse → `VALIDATION_ERROR`/`CONFLICT`; 404 handler `NOT_FOUND`; lỗi lạ → `INTERNAL_ERROR` không lộ stack. → Verify: gọi route không tồn tại, JSON hỏng, ObjectId sai → đúng `code` + content-type.
- [x] **T6 Validation convention**: chọn 1 cơ chế (đề xuất `express-openapi-validator` đọc thẳng `07-openapi-v5.yaml`, khớp doc 03/14) + chặn key `$`/`.` + giới hạn payload (giảm từ 50mb). → Verify: body thừa field → 400 `VALIDATION_ERROR` có `errors[]`.
- [x] **T7 Response convention**: **bỏ `ApiResponse` envelope**; quy ước: 2xx trả resource trần, 201/204 đúng spec, helper phân trang cursor `{items, nextCursor}`; chuẩn hóa ID `ObjectId` string. → Verify: response mẫu khớp schema trong OpenAPI.
- [x] **T8 Auth middleware skeleton** (chỉ khung, chưa login thật): `authenticate` (Bearer JWT 15m, lỗi → 401 `AUTHENTICATION_ERROR`), `optionalAuth`, `requireRole(systemRole[], staffSubRole?)` (403 `AUTHORIZATION_ERROR`); `req.actor = {id, systemRole, staffSubRole, assignedBranchIds, authorizedBranchIds}` từ token+DB; không nhận authority field từ client (doc 08). Role enum theo doc 11 (bỏ `DOCTOR`, `role_code`). → Verify: không token → 401 problem; token sai role → 403; route mẫu `GET /api/v1/auth/me` trả 401 khi chưa đăng nhập.
- [x] **T9 Security baseline**: `helmet`, CORS allowlist 2 origin từ env (Customer + Admin Angular), rate limit nền (chi tiết login/OTP để task Auth), bật `X-Content-Type-Options`. → Verify: Origin lạ không nhận `Access-Control-Allow-Origin`.
- [x] **T10 Health check**: `GET /api/v1/health` (liveness) + `GET /api/v1/health/ready` (kiểm tra `mongoose.connection.readyState`, 503 nếu DB mất); public, không auth. → Verify: `curl localhost:8080/api/v1/health` = 200; ngắt mạng DB → ready = 503 problem.
- [x] **T11 Verification cuối**: smoke test bằng `curl`/Postman; lint (`lint_runner.py`), `security_scan.py`; ghi kết quả. Test tự động (Jest + supertest) cho error handler, auth middleware, health.

## Done When
- [x] Server khởi động chỉ với Mongo, không đụng MySQL/Prisma.
- [x] Mọi lỗi trả `application/problem+json` có `code` + `correlationId`; 2xx không envelope.
- [x] `authenticate`/`requireRole` hoạt động theo `systemRole`/`staffSubRole`.
- [x] FE gọi được `/api/v1/health` từ origin Angular được cho phép.

## Câu hỏi cần bạn chốt trước khi code
1. **Legacy code**: xóa/loại khỏi target (đúng doc 02/ADR-01) hay giữ cô lập trong thư mục `legacy/` để tham khảo?
2. **`/health` ngoài OpenAPI**: chấp nhận thêm ngoài spec (khuyến nghị, vì là hạ tầng), hay bạn bè sẽ cập nhật spec?
3. **Thư viện mới** (`helmet`, `express-rate-limit`, `pino`, `express-openapi-validator`): đồng ý thêm?
4. Có tạo **branch mới** (ví dụ `feat/mongo-foundation`) cho phần này không?

## Notes
- Phần `ApiResponse.js` và `errorHandler.js` đã tạo hôm qua cần sửa/xóa theo T5/T7 — đó là sai lệch so với spec, không phải do doc cũ.
- Nằm ngoài scope task này: Mongoose models (doc 05/06), logic Auth thật (login/refresh/OTP), seed Admin đầu tiên.
- Bảo mật: `.env` hiện có mật khẩu Gmail app và PayPal client id thật — đã gitignore, nhưng nên đổi/thu hồi nếu từng bị chia sẻ.
