# Task 2.8 — V7 review revision

Bộ này sửa trực tiếp từ 17 file V6 trong folder nguồn 1eVy1lv-0WmTkZlPpUqjA8in51PHGJG_7. Giữ các phần không liên quan; xuất bản mới, không ghi đè bản gốc. Ngày sửa: 08/10/2026 (Asia/Saigon).

## Đã sửa

1. PAY_AT_STORE luôn có cọc 30% finalAmount bằng ONLINE_MOCK. Customer/Guest có đường hoàn tất cọc: OTP Guest nếu cần → tạo Appointment → nhận prepaymentId → gọi mock/complete → PENDING_CONFIRMATION. BALANCE mới thu tại store sau COMPLETED. Có quyền owner, idempotency, hold expiry và compensation trong contract.
2. Xóa depositConfig/depositRequired/DepositType/DepositValue khỏi Service và snapshot. Không có cấu hình cọc hoặc override theo Service/Branch.
3. Threshold theo (branchId,inventoryItemId), có API update cho Manager assigned branch/Admin ALL; expectedVersion và audit, không thay quantity.
4. Product form không nhập stock. Initial stock dùng RECEIPT/INITIAL_STOCK. Procurement nằm ngoài scope. Transfer của Manager cần cả source/destination trong scope.
5. Store cancel hoàn 100%; chuyển lịch dùng reschedule-override giữ cùng Appointment/payment và re-reserve nguyên chuỗi atomically.
6. File 05 định nghĩa đầy đủ các collection trước đó chỉ ghi “như v2”: field, optionality, reference, unique/index, constraint. Các field bổ sung là thiết kế canonical của V7; chưa xác minh từ DB/v2.
7. Đồng bộ Domain/Schema/OpenAPI/Authz/State/Mapping/Test/ADR/Decision log và CSV sync đề xuất. File 18 ghi đúng kiểm tra đã chạy; file 19 cho phép chạy lại bằng Python + PyYAML.

## Hai business decisions đã chốt — 08/10/2026 (Asia/Saigon)

- TA-30: ONLINE đã trả 100%: Customer cancel <24h/no-show giữ 30% finalAmount, refund 70%; cancel >=24h refund 100%. PAY_AT_STORE mất cọc 30% khi hủy sát giờ/no-show. Store/system cancel refund 100% prepaid. Backend tính penalty = round(finalAmount * 0.30), refund = max(0, paidAmount - penalty); refund là phần còn lại để không lệch do làm tròn. Không tạo refund document nếu amount=0.
- MEDICAL: service có thể do Nurse và/hoặc Veterinarian thực hiện; không bắt buộc Vet segment. Service cần Vet trực tiếp tham gia phải có requiredStaffRole=VETERINARIAN. Nurse chỉ hoàn tất execution và submit; sau khi toàn bộ segments hoàn tất, ServiceRecord vào WAITING_VET_REVIEW. Veterinarian được phân công phải review và finalize. Reviewer assignment không tự reserve lịch; yêu cầu Vet tham gia trực tiếp được thể hiện bằng Service có role VETERINARIAN.

Trạng thái: BUSINESS_CONFIRMED / CONTRACT_REVIEW_READY. Hai quyết định không còn pending. Kiểm tra tĩnh được chạy lại; việc đánh Task 2.8 DONE cần đánh giá tiêu chí bàn giao tài liệu và đối chiếu Sheet. Chưa có implementation để chứng nhận runtime/E2E.

## Phạm vi kiểm tra

Kiểm tra YAML parse, internal refs, operationId, security metadata, payment combination rules và một số invariant trọng tâm đã chạy. Chưa chạy full OAS validator, runtime/E2E/concurrency; không chứng nhận DB/code đúng theo tài liệu. ONLINE full giữ mô phỏng auto-PAID ở create của V6; không biểu diễn cổng thanh toán thật. Không sửa live Sheet; file 17 chỉ là proposed sync, cần đọc cell hiện tại trước khi áp dụng.
