# 02 Current State Architecture v6

| Thanh phan | Trang thai | Vai tro |
|---|---|---|
| FE hien tai (React + Vite, `BE_A_PET_CLINIC-FRONTEND`, `build-init`) | LEGACY | Nguon man hinh/luong de migrate. Sheet task 2.2 "Audit migration React -> Angular" xac nhan huong nay |
| **FE dich** | **Customer Angular + Admin Angular** (hai app) | Dung API client sinh tu OpenAPI v6 (`x-audience`: customer / admin) |
| BE hien tai (`PET_CLINIC_BACKEND`, `dev`) | OBSOLETE | Se bi loai khoi target codebase, khong la nen tang |
| MySQL hien tai | LEGACY persistence | Tham khao khai niem. Khong migrate (xem 12) |
| BE dich | GREENFIELD Node.js + Express + MongoDB | Xay moi |
| Figma | FIGMA_AVAILABLE_BUT_NOT_FROZEN | Da truy cap de review; chua freeze/approve de FE handoff |
| Sheet (2) + Log.docx | Nguon yeu cau cap nhat | Log thap hon sheet; mau thuan thi sheet thang |

Git: khong `reset --hard`, khong force-push, khong viet lai lich su. Implement: branch moi, loai BE cu khoi target, them BE moi, PR.

## Bang chung React legacy (chi de migrate, khong thuoc kien truc dich)
React 18, Axios, React Query, Redux Toolkit, React Router, Ant Design; doc loi `.EC/.EM/.DT` (~50 cho); `role_code`/`DOCTOR`; gui `slot_id`, `service_ids`; da co multi-select dich vu (`BookingPaymentStep.jsx`). Khong co bookingMode, deposit, assignedBranches, inventory, lastLogin, activationStatus.
Migrate sang Angular: moi man hinh doi sang API v6; khong giu client Axios. Chua xac minh noi dung tung trong 656 file React.

## Hanh vi legacy KHONG mang sang target
Guest tu tao account + password (cung bi Log muc 2 de cap, nhung sheet M02 cam); time_slots/booked_count; Prisma/MySQL; role DOCTOR; `{EM,EC,DT}`; waiting_store_payment; rescheduled; no_show_count chan thanh toan; payments.order_id NOT NULL; stock ghi truc tiep; OTP Math.random va plaintext.

## Mau thuan giua Log.docx va sheet (sheet thang)
| Log | Sheet | Xu ly |
|---|---|---|
| Guest mua hang: tai khoan tao san, doi mat khau lan dau | M02: khong tu sinh account/mat khau; activation qua OTP | Theo sheet |
| No-show nhieu lan: yeu cau coc o lan sau; no-show sat gio tru phi giu cho | Feature: <24h/no-show khong hoan coc; khong co rule dem no-show | Khong nhan rule dem no-show; khong mo them rule dem no-show trong scope V6 |
| Mat khau toi thieu 8, co chu hoa va so | Khong noi | Nhan (khong mau thuan) |
| Freeship don 500k | Sheet chi noi "tinh shipping" | Nhan 500000 (>=) lam nguong cau hinh |
| Nhac lich qua Gmail + chuong thong bao | Khong noi | Nhan |
| Luu lich vao DB chi khi bam "Dat lich" cuoi cung | Khong noi, khong mau thuan | Nhan |
