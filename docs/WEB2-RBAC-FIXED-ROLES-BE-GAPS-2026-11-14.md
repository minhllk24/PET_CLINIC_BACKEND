# WEB 2 — RBAC cố định theo ma trận `feature` (14/11/2026)

## Nguồn nghiệp vụ
`WEB2 _ SHEET _ WORKSPACE (13).xlsx` → tab `feature`. Chỉ dùng các vai trò cố định ADMIN, MANAGER và STAFF (RECEPTIONIST, CARE_STAFF_GROOMER, VETERINARIAN, NURSE). Không có permission editor hoặc quyền tùy biến từng tài khoản.

- ADMIN: phạm vi All; quản trị hệ thống.
- MANAGER: phạm vi Branch/assignedBranchIds, không quản trị role tài khoản.
- STAFF: các chức năng được phân công theo staffSubRole và Assigned; không xem directory người dùng hoặc lịch của nhân viên khác.
- CUSTOMER: không có quyền Backoffice.

FE đã triển khai `core/guards/admin-role-policy.ts`, `roleGuard`, route capabilities, sidebar và các action guards chính. Mọi API vẫn phải kiểm tra role và branch/assignment scope từ BE. **FE không thể ghi đè 403 của BE.**

## API BE chưa khớp ma trận

| Mức | Quyền theo sheet | Endpoint BE `feat/foundation-v6` | Hiện tại | BE cần xử lý |
|---|---|---|---|---|
| P1 | STAFF xem Voucher (M10) | `GET /vouchers`, `GET /vouchers/:id` | requireRole ADMIN, MANAGER | Cho STAFF có quyền R theo role, không cấp quyền POST/PATCH |
| P1 | STAFF xem Flash Sale (M10) | `GET /flash-sales`, `GET /flash-sales/:id` | requireRole ADMIN, MANAGER | Cho STAFF đọc danh sách/chi tiết, không cấp quyền thay đổi chiến dịch |
| P0 | MANAGER CRUD/S Blog và First Aid (M20) | `POST /admin/content/posts`, `PATCH /admin/content/posts/:id`, `DELETE /admin/content/posts/:id` | requireRole ADMIN | Bổ sung MANAGER kèm đúng scope/quy tắc nghiệp vụ; `PATCH /posts/:id/status` đã cho MANAGER |
| P1 | MANAGER kiểm duyệt/xóa Community (M21) | `DELETE /admin/content/community/posts/:id` | requireRole ADMIN | Bổ sung MANAGER theo ma trận, gắn scope/ownership thích hợp |
| P1 | MANAGER CRUD/S Rescue (M22) | `DELETE /admin/content/rescue/pets/:id` | requireRole ADMIN | Cho MANAGER xử lý đối tượng thuộc scope; các POST/PATCH đã cho MANAGER |

**Không mở quyền quá mức:** không thay đổi write API Master Product, Category, Voucher, Flash Sale hay Service cho MANAGER/STAFF. ADMIN giữ CRUD/S toàn hệ thống; MANAGER Master read-only và BranchService được cấu hình trong chi nhánh.

## E2E cần nghiệm thu
1. Admin: có thể CRUD master, quản trị tài khoản và tạo Manager với nhiều `assignedBranchIds` qua `POST /managers`; không chuyển trực tiếp User STAFF thành MANAGER.
2. Manager: Dashboard theo nhiều chi nhánh được giao, quản lý nhân sự/ca/kho/đơn/lịch; không xem hoặc ghi chi nhánh khác; chỉ R sản phẩm, voucher, Flash Sale.
3. RECEPTIONIST: tạo/xử lý Order & Appointment, xem dịch vụ/sản phẩm, không phê duyệt Refund cuối và không xem global Customer directory.
4. VETERINARIAN/NURSE/CARE_STAFF_GROOMER: chỉ lịch hẹn/hồ sơ được giao, lịch làm việc cá nhân, không có quyền phân ca/hoàn tiền/đơn hàng.
5. CUSTOMER: vào Backoffice vẫn theo luồng 403 cũ được leader yêu cầu giữ nguyên.
6. Truy cập trực tiếp URL, bấm nút, gọi API thủ công từ trình duyệt và refresh session đều phải tôn trọng role & scope.

Chỉ đánh dấu RBAC hoàn tất sau khi BE cập nhật contract, môi trường deploy và 6 nhóm tài khoản được kiểm thử E2E. Không merge `main` trước nghiệm thu.
