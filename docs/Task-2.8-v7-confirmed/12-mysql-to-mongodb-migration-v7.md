# 12 Legacy Data / Schema Reference v7

Giu ten file de khop danh sach output. Noi dung la tham khao, **khong phai ke hoach migrate**.

## Pham vi
NO DATA MIGRATION IN CURRENT IMPLEMENTATION SCOPE. Sheet va Team Lead khong yeu cau migrate du lieu MySQL; backend cu xoa lam lai. Neu sau nay can migrate, mo yeu cau rieng.

## Khai niem legacy (tham khao) va noi thay the trong thiet ke moi
| Legacy | Thiet ke moi |
|---|---|
| users.status (active/inactive/disabled) | accountStatus + activationStatus |
| roles.DOCTOR, doctors | STAFF + staffSubRole VETERINARIAN |
| staff_profiles.branch_id | authorizedBranchIds[], homeBranchId, shifts.branchId |
| time_slots | availability tinh dong + slot_reservations |
| services + price matrix | services (serviceType, bookingMode, requiredStaffRole, priceVariants) + branch_service_configs |
| appointments + appointment_services | appointments (services[] la cac segment cung serviceType, moi segment co requiredStaffRole va assignedStaffId rieng) |
| payments (order_id NOT NULL), refunds | payments (target APPOINTMENT/ORDER), booking_refunds, order_returns, order_refunds |
| products.stock_quantity (ghi truc tiep) | inventory_stocks + ledger |
| carts, orders, order_items | carts (token cho Guest), orders (items[] snapshot, lineNet) |
| vouchers | vouchers + voucher_usages (quota) |
| medical_records | service_records + revisions |
| otp_codes, user_sessions | otp_challenges (hash), refresh_sessions (rotation) |

## Hanh vi legacy da loai bo
Guest tu tao account + password; waiting_store_payment; rescheduled; no_show_count chan thanh toan; `{EM,EC,DT}`; Math.random OTP; stock ghi truc tiep; cac phan mo rong khong thuoc scope (warehouse phu, thue) khong duoc dua vao.

- Migration note: map Service.requiredStaffRole to ServiceExecutionRole; RECEPTIONIST remains staffSubRole only. Material Catalog remains seed-only; do not migrate a separate Material CRUD module.
