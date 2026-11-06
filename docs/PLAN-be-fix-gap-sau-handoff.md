# KẾ HOẠCH TRIỂN KHAI KHẨN CẤP: XỬ LÝ 10 LỖI P0/P1 & 16 KỊCH BẢN GAP UAT SAU HANDOFF
## Tài liệu căn cứ: `docs/WEB2_YEU_CAU_BE_FIX_GAP_SAU_HANDOFF_2026-11-06.docx`

> **Ngày lập:** 06/11/2026  
> **Trạng thái:** PLANNING (Chờ xác nhận thực thi)  
> **Mục tiêu:** Khắc phục triệt để 10 mã lỗi `BE-FIX-01` → `BE-FIX-10` (6 P0 + 4 P1) và vượt qua 16 kịch bản nghiệm thu `GAP-01` → `GAP-16` cùng 64 kịch bản UAT gốc trên database thật.

---

## 1. Phân Tích Giải Pháp Kỹ Thuật Cho 10 Mã Lỗi (`BE-FIX-01` → `BE-FIX-10`)

### Nhóm 1: Flash Sale & Authoritative Checkout (`BE-FIX-01`, `BE-FIX-02`, `BE-FIX-03`) — [P0]

1. **`BE-FIX-01` (Chốt giá & hạn mức Flash Sale nguyên tử trong Transaction + Hoàn hạn mức khi Hủy/Expire):**
   - **Hiện trạng:** `order.service.js` kiểm tra giá Flash Sale ngoài transaction, chỉ so sánh `soldQuantity < quantityLimit` mà không xét `item.quantity` (`qtyRequested`), chưa cộng `soldQuantity` trong transaction checkout và chưa hoàn lại `soldQuantity` khi đơn hàng bị hủy.
   - **Giải pháp:**
     - Bổ sung hàm `consumeFlashSaleQuotaInSession({ saleId, sku, variantId, productId, quantity, session })` trong `flashSale.service.js`: sử dụng `FlashSale.findOneAndUpdate` nguyên tử (CAS) với điều kiện `status: 'PUBLISHED'`, `isPaused: false`, `startAt <= now < endAt`, khớp đúng `sku` và `soldQuantity + quantity <= quantityLimit`. Nếu không thỏa mãn (vượt quota hoặc 2 khách đặt song song), ném lỗi `409 FLASH_SALE_QUOTA_EXCEEDED` và rollback toàn bộ transaction.
     - Lưu thông tin `flashSaleId`, `flashSaleApplied: true`, `flashSaleQuotaReleased: false` vào từng `orderItem`.
     - Bổ sung hàm `releaseFlashSaleQuotaInSession` trong luồng `cancelOrder` / expire / payment fail: hoàn lại đúng `quantity` vào `soldQuantity` (không âm, idempotent đúng 1 lần nhờ cờ `flashSaleQuotaReleased`).

2. **`BE-FIX-02` (Chặn tuyệt đối match nhầm SKU/biến thể trong `findActiveFlashSaleItem`):**
   - **Hiện trạng:** Dòng 427 của `flashSale.service.js` có `return isProduct;` làm fallback khiến biến thể B (không giảm giá) bị áp nhầm giá Flash Sale của biến thể A cùng `productId`.
   - **Giải pháp:**
     - Xóa bỏ fallback `return isProduct;` khi sản phẩm có biến thể hoặc khi item truyền `variantId`/`sku`. Bắt buộc khớp chính xác `it.sku === cleanSku` hoặc `it.variantId.toString() === variantId.toString()`.
     - Khi tạo/cập nhật chiến dịch Flash Sale (`createFlashSale`, `updateFlashSale`), đối chiếu trực tiếp với `Product` trong DB để xác nhận `variant` tồn tại, thuộc đúng `productId`, đang `ACTIVE`, và lấy `originalPrice` chuẩn từ server.

3. **`BE-FIX-03` (Đồng bộ Contract Tạo+Xuất bản `status: 'PUBLISHED'`, chế độ `AUTO`/`MANUAL` & `PATCH` đầy đủ):**
   - **Hiện trạng:** FE gửi `status: 'PUBLISHED'` nhưng BE chỉ đọc `publishNow`; chế độ `MANUAL` vẫn khởi tạo `isPaused: false` khiến tự chạy khi đến giờ; `PATCH /flash-sales/:id` bỏ qua `items`, `activationMode`, `status`.
   - **Giải pháp:**
     - Trong `createFlashSale`: Hỗ trợ đồng thời `publishNow === true` **HOẶC** `status === 'PUBLISHED'`.
     - Với `activationMode === 'MANUAL'`: khởi tạo `isPaused: true` (hoặc kiểm soát cờ kích hoạt thủ công) để chiến dịch `MANUAL` không tự động chuyển sang `RUNNING` khi chưa được Admin bật.
     - Trong `updateFlashSale` (`PATCH`): Cập nhật đầy đủ `items` (validate SKU, `quantityLimit`, giữ nguyên `soldQuantity` của các SKU đang có, kiểm tra overlap nếu `PUBLISHED`), `activationMode`, `status`, `isPaused`, và kiểm tra `version` (trả `409 VERSION_CONFLICT` nếu xung đột).
     - Bổ sung xử lý `Idempotency-Key` cho `POST /api/v1/flash-sales` để chống tạo trùng chiến dịch khi gửi lặp.

---

### Nhóm 2: Phản Hồi Email Thật, Báo Cáo Vi Phạm Atomic & Admin Community (`BE-FIX-04`, `BE-FIX-05`, `BE-FIX-06`) — [P0]

4. **`BE-FIX-04` (Phản hồi khách hàng qua Email Provider / Outbox thật, có trạng thái QUEUED/SENT/FAILED & Retry):**
   - **Hiện trạng:** `feedback.service.js` tự gán `deliveryStatus: 'SENT'` và sinh `providerMessageId` giả.
   - **Giải pháp:**
     - Xây dựng `emailOutbox.service.js` + model `EmailOutbox` kết nối Nodemailer SMTP / Transactional Outbox.
     - Khi gửi phản hồi (`replyFeedback`): tạo bản ghi Outbox với `idempotencyKey`, thực hiện gửi qua transport thật.
     - Chỉ khi provider xác nhận thành công mới gán `deliveryStatus: 'SENT'`, lưu `providerMessageId` thật và chuyển `feedback.status = 'PROCESSED'`.
     - Nếu provider lỗi (hoặc kích hoạt cờ kiểm thử lỗi provider): gán `deliveryStatus: 'FAILED'` (hoặc `'QUEUED'`), lưu `lastError`, **giữ nguyên trạng thái `PROCESSING`** (không báo thành công giả) và cho phép Admin bấm gửi lại (retry idempotent không gửi trùng).

5. **`BE-FIX-05` (Xử lý báo cáo vi phạm Atomic trong MongoDB Transaction & Chống xử lý đồng thời):**
   - **Hiện trạng:** `resolveCommunityReport` chạy 3 câu lệnh rời rạc không có transaction và không khóa trạng thái CAS.
   - **Giải pháp:**
     - Bọc toàn bộ `resolveCommunityReport` trong `session.withTransaction`.
     - Bước 1: Dùng CAS `CommunityReport.findOneAndUpdate({ _id: id, status: { $in: ['PENDING', 'UNDER_REVIEW'] } }, ..., { session })`. Nếu trả về `null` → ném ngay `409 REPORT_ALREADY_RESOLVED` (chặn 2 Admin xử lý trùng).
     - Bước 2: Cập nhật `CommunityPost` (`status: 'HIDDEN'` nếu `HIDE_POST`, `hasOpenReport: false`) trong cùng `session`.
     - Bước 3: `CommunityReport.updateMany` đồng bộ toàn bộ các báo cáo đang mở của cùng `postId` trong cùng `session`. Nếu có bất kỳ lỗi nào ở bước 2 hoặc 3, toàn bộ transaction tự động rollback 100%.

6. **`BE-FIX-06` (Bổ sung API `POST /api/v1/admin/community/posts` cho Admin tạo bài đăng cộng đồng):**
   - **Hiện trạng:** `adminContent.routes.js` thiếu route `POST /community/posts` mà FE đang gọi.
   - **Giải pháp:**
     - Khai báo `router.post('/community/posts', requireRole(['ADMIN', 'MANAGER']), contentController.createCommunityPostAdmin)` trong `adminContent.routes.js`.
     - Xử lý validate dữ liệu (`title`, `content`, `type`, `images`, `status`), lọc XSS bằng `sanitizeHtml`, mặc định `status: 'APPROVED'` (hoặc theo payload Admin chọn), lưu thông tin tác giả Admin và hỗ trợ `Idempotency-Key`.

---

### Nhóm 3: Kiểm Duyệt Đánh Giá, Đối Tác Cứu Trợ, Upload Bền Vững & Minh Chứng UAT (`BE-FIX-07` → `BE-FIX-10`) — [P1]

7. **`BE-FIX-07` (Ẩn đánh giá bắt buộc có `reason` & Đồng bộ thống kê sao `ratingAvg`/`ratingCount`):**
   - **Giải pháp:**
     - Trong `hideReview`: kiểm tra nếu thiếu `reason` (hoặc chuỗi rỗng) → trả lỗi `400 VALIDATION_ERROR` (không tự gán `'Hidden by moderator'`).
     - Viết hàm `syncTargetRatingStats(targetType, targetId)`: tính lại `ratingAvg` và `ratingCount` từ các review `ACTIVE` (`hidden: false`) và cập nhật trực tiếp vào `Product` / `Service` ngay trong `hideReview`, `showReview`, `createReview`, `deleteReview`.

8. **`BE-FIX-08` (Cứu trợ: Không chèn ảnh Unsplash giả, chuẩn hóa DB Đối tác & Hotline sơ cứu từ cấu hình):**
   - **Giải pháp:**
     - Trong `createRescuePet` / `updateRescuePet`: xóa bỏ fallback ảnh Unsplash; nếu không có ảnh hợp lệ → trả `400 VALIDATION_ERROR`.
     - Lưu danh bạ 6 đối tác cứu trợ vào `SystemSetting` (`key: 'rescue_partners'`) trong DB với đầy đủ `id`, `code`, `name`, `phone`, `address`, `websiteUrl`, `fanpageUrl`. Đồng bộ cả `GET /rescue/partners` và `GET /rescue/stations` đọc từ nguồn này. Validate `supportPartnerId` khi tạo thú cưng cứu trợ và trả kèm thông tin liên hệ CTA của đối tác.
     - Lấy `emergencyPhone` mặc định của bài viết Sơ cứu từ `SystemSetting` (`key: 'emergency_hotline'`).

9. **`BE-FIX-09` (Upload ảnh tách theo module `content`/`community`/`rescue` & Lưu trữ bền vững Cloudinary):**
   - **Giải pháp:**
     - Cập nhật `upload.service.js` và `upload.routes.js`: truyền đúng context `moduleName` (`products`, `content`, `community`, `rescue`), lưu vào thư mục Cloudinary tương ứng `pet_clinic/${moduleName}`.
     - Kiểm tra chặt MIME + file signature (JPG/PNG/WebP ≤ 5MB). Khi Cloudinary đã cấu hình mà upload lỗi (hoặc gửi cờ lỗi provider), trả lỗi `502 UPLOAD_PROVIDER_ERROR` rõ ràng, không âm thầm rơi vào vùng tạm làm mất ảnh sau redeploy.

10. **`BE-FIX-10` (Chuẩn hóa DTO phân trang `>100` & Chạy bộ kiểm thử thực tế 16 GAP + 64 UAT trên MongoDB Atlas):**
    - **Giải pháp:**
      - Cho phép `limit` tối đa lên tới `200` (thay vì khóa cứng 100) để hỗ trợ `GAP-15` (List >100 items), đồng bộ trả về `items`, `totalCount`, `total`, `page`, `limit`, `totalPages`, `nextCursor`, `serverTime`.
      - Viết bộ test tích hợp chạy trên DB thật (`tests/integration/be-fix-gap-uat.test.js`) xác minh toàn bộ `GAP-01` → `GAP-16` và cập nhật báo cáo nghiệm thu theo đúng mẫu Mục 8 của tài liệu FE.

---

## 2. Tiêu Chí Nghiệm Thu (Verification Checklist)

- [ ] **GAP-01..04 (Flash Sale):** 2 khách mua song song `quota=1` chỉ 1 đơn thành công; `qty=3 > quota=2` bị chặn; hủy đơn hoàn quota đúng 1 lần; sản phẩm 2 biến thể không áp nhầm giá.
- [ ] **GAP-05..06 (Campaign Lifecycle):** 3 POST cùng `Idempotency-Key` chỉ tạo 1 chiến dịch `PUBLISHED`; chế độ `MANUAL` không tự chạy; `PATCH` lưu đúng SKU, số lượng, thời gian.
- [ ] **GAP-07 (Admin Community):** `POST /api/v1/admin/community/posts` trả `201`, bài `APPROVED` hiển thị trên Customer feed.
- [ ] **GAP-08..09 (Feedback Email):** Thành công ghi `SENT` + `providerMessageId` thật; lỗi provider ghi `FAILED` và giữ trạng thái `PROCESSING`, retry không gửi trùng.
- [ ] **GAP-10..11 (Report Transaction):** 2 Admin xử lý cùng lúc → 1 thành công, 1 nhận `409`; lỗi giữa chừng rollback toàn bộ transaction.
- [ ] **GAP-12..15 (Review, Rescue, Upload, Pagination >100):** Ẩn review thiếu lý do trả `400`, đồng bộ sao; tạo thú cứu trợ thiếu ảnh trả `400`, gắn đúng đối tác; upload bền vững Cloudinary; phân trang `>100` đầy đủ `totalCount`/`nextCursor`.
- [ ] **GAP-16 (Full Suite & Handoff Report):** Toàn bộ Jest test suites PASS 100%, cập nhật tài liệu bàn giao theo đúng bảng `BE-FIX-01` → `BE-FIX-10`.

