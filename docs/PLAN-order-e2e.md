# Kế Hoạch Triển Khai: Luồng Nghiệp Vụ Order E2E (End-to-End Suite)

Tài liệu này xác lập kế hoạch chi tiết, kiến trúc kịch bản và danh mục công việc triển khai **Bộ Kiểm Thử & Xác Minh Luồng Nghiệp Vụ Order End-to-End (E2E)** cho hệ thống **PET CLINIC BACKEND**, tuân thủ nghiêm ngặt chuẩn OpenAPI 3.1 (`docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml`), mô hình dữ liệu MongoDB (`05-mongodb-schema-v7.md`), máy trạng thái (`09-state-machines-v7.md`), ma trận phân quyền RBAC (`08-authorization-matrix-v7.md`), và **phản hồi định hướng từ Nhóm Trưởng (Checklist duyệt bộ dữ liệu sản phẩm `docs/CHECKLIST-duyet-bo-du-lieu-san-pham.md`)**:
1. **Thay đổi danh mục sản phẩm (New Taxonomy)**: Chuẩn hóa theo nhóm chức năng đa loài.
2. **Đa dạng chủng loài thú cưng**: Không giới hạn chó/mèo, mở rộng sang thú nhỏ (hamster, thỏ, bọ ú) và chim cảnh.
3. **Cơ chế chiết khấu 2 tầng (Two-Tier Pricing)**: **Product discount trước, Voucher sau**.

---

## 1. Các Quyết Định Kiến Trúc & Nghiệp Vụ Chốt (Confirmed Business Rules)

### 1.1. Cấu Trúc Danh Mục & Đa Dạng Chủng Loài (Category Taxonomy & Species Diversity)
- **Hệ thống danh mục chuẩn hóa (Function-based Categories):**
  1. `Thức ăn & Dinh dưỡng` (`food-nutrition`): Hạt, pate, cỏ nén, hạt kê cho các loài.
  2. `Vệ sinh & Chăm sóc` (`hygiene-grooming`): Cát vệ sinh, tã lót cún, lót chuồng gỗ nén, sữa tắm.
  3. `Phụ kiện & Chuồng trại` (`accessories-housing`): Lồng nuôi, bát ăn thông minh, dây dắt, balo vận chuyển.
  4. `Y tế & Thực phẩm chức năng` (`supplements-healthcare`): Gel dinh dưỡng, vitamin, khoáng chất lông đa loài.
- **Dữ liệu sản phẩm đa loài thực nghiệm (4 nhóm loài):**
  - **Chó (Dog):** Hạt dinh dưỡng cún con (`PROD-DOG-01`, giá gốc: 150,000 VND, `discountPercent`: 10% $\rightarrow$ `finalPrice`: 135,000 VND).
  - **Mèo (Cat):** Pate cá ngừ đại dương (`PROD-CAT-01`, giá gốc: 80,000 VND, `discountPercent`: 0% $\rightarrow$ `finalPrice`: 80,000 VND).
  - **Thú nhỏ (Small Animals - Hamster/Thỏ/Bọ):** Cỏ nén dinh dưỡng Timothy & lót chuồng (`PROD-SMALL-01`, giá gốc: 120,000 VND, `discountPercent`: 25% $\rightarrow$ `finalPrice`: 90,000 VND).
  - **Chim cảnh (Birds):** Hạt kê & khoáng chất bổ sung cho vẹt/chim hót (`PROD-BIRD-01`, giá gốc: 100,000 VND, `discountPercent`: 0% $\rightarrow$ `finalPrice`: 100,000 VND).

### 1.2. Cơ Chế Tính Giá & Chiết Khấu 2 Tầng: Product Discount Trước, Voucher Sau
- **Tầng 1 - Product Discount (Chiết khấu trực tiếp sản phẩm):**
  - Áp dụng trên từng Variant của Product: `discountPercent` (0 – 100%).
  - Đơn giá sau giảm: `finalPrice = Math.round(price * (100 - discountPercent) / 100)`.
  - Khi thêm vào giỏ và checkout: `unitPrice` của OrderItem chính là `finalPrice`.
  - `lineSubtotal = unitPrice * quantity = finalPrice * quantity`.
  - Tổng tiền hàng: `merchandiseSubtotal = sum(lineSubtotal)`.
- **Tầng 2 - Voucher Discount (Mã giảm giá đơn hàng):**
  - Voucher chỉ được tính toán TRÊN giá đã chiết khấu tầng 1 (`merchandiseSubtotal` hoặc `eligibleSubtotal`).
  - Kiểm tra điều kiện `minOrderAmount` dựa trên `eligibleSubtotal` (đã trừ Product discount).
  - Phân bổ voucher (`allocatedDiscount`) theo tỷ lệ `lineSubtotal` của các mặt hàng đủ điều kiện. Dồn phần dư lẻ vào dòng cuối cùng.
  - Số tiền thực trả của từng dòng hàng: `lineNet = lineSubtotal - allocatedDiscount`.
- **Tác động đến Return / Refund:**
  - Hoàn tiền tính trên đơn giá thực trả sau cả 2 tầng: `unitNet = Math.floor(lineNet / quantity)`.
  - Khách chỉ được hoàn đúng số tiền thực tế đã chi trả (`lineNet`), không thể đòi hoàn theo `price` gốc trước chiết khấu.
  - Phí vận chuyển không hoàn (`shippingRefunded: 0`). Chặn trần lũy kế không vượt quá `lineNet` và `totalOrderMerchandiseNetPaid`.

---

## 2. Ma Trận Kịch Bản Nghiệp Vụ E2E (Scenario Matrix)

| STT | Nhóm Kịch Bản | Hành Động & Endpoint | Kết Quả Mong Đợi / Invariant Cần Kiểm Chứng |
|---|---|---|---|
| **SC-01** | **Chuẩn Bị Dữ Liệu Đa Loài & Danh Mục Mới** | Fixtures Setup | Khởi tạo 4 Categories mới; 4 Products đa dạng (Chó, Mèo, Thú nhỏ, Chim cảnh) có Product discount; InventoryStock 3 chi nhánh (`BR-000001`, `BR-000002`, `BR-000003`); 3 loại Voucher; User & Tokens các cấp. |
| **SC-02** | **Fulfillment Resolver - Priority Branch** | `POST /checkout` | Cart chứa sản phẩm đa loài. Chọn `BR-000001` (ưu tiên 1). Kho `BR-000001` trừ đúng số lượng (ledger `ISSUE`), kho các branch khác giữ nguyên. |
| **SC-03** | **Fulfillment Resolver - Branch Fallback & Inactive** | `POST /checkout` | Branch 1 hết hàng hoặc `status: INACTIVE` $\rightarrow$ tự động fallback sang `BR-000002` đủ hàng cho cart. |
| **SC-04** | **Fulfillment Resolver - Cart Split Rejection** | `POST /checkout` | Tổng tồn cả 3 chi nhánh đủ cho cart, nhưng không branch nào đơn lẻ chứa đủ toàn cart $\rightarrow$ Ném `422 INSUFFICIENT_INVENTORY`, tuyệt đối không tách đơn. |
| **SC-05** | **Validation Hàng Tồn & Số Lượng** | `POST /checkout` | Số lượng $\le 0$, số lượng vượt quá tồn kho $\rightarrow$ Ném lỗi `422 INSUFFICIENT_INVENTORY` hoặc `400 VALIDATION_ERROR`. |
| **SC-06** | **Two-Tier Pricing & Snapshot Tài Chính** | `POST /checkout` | Kiểm chứng Product discount áp trước (`finalPrice`), Voucher áp sau. Snapshot chính xác `allocatedDiscount`, `lineNet`, dồn phần dư lẻ vào dòng cuối cùng. Quota voucher tiêu thụ đúng 1 lần. |
| **SC-07** | **Vòng Đời Đơn Hàng COD** | `confirm` $\rightarrow$ `process` $\rightarrow$ `ship` $\rightarrow$ `mark-delivered` | COD không cần trả trước. Thanh toán giữ `PENDING` xuyên suốt các bước, **chỉ chuyển sang `PAID` duy nhất khi chuyển trạng thái `COMPLETED` (`mark-delivered`)**. Ghi nhận `deliveredAt`. |
| **SC-08** | **Vòng Đời ONLINE_MOCK & Auto-Cancel Compensating Tx** | `checkout` (ONLINE_MOCK) $\rightarrow$ Payment Fail/Expire/Cancel | Chưa thanh toán mà gọi `confirm` $\rightarrow$ `422 PAYMENT_REQUIRED`. Khi payment terminal thất bại $\rightarrow$ Auto-cancel Order (`CANCELLED`), hoàn stock qua ledger `RECEIPT`, hoàn voucher quota idempotent. |
| **SC-09** | **Cửa Sổ Đổi Trả 7 Ngày (Return Window)** | `GET /returnable-items`, `POST /return-quote` | Trong vòng 7 ngày kể từ `deliveredAt` $\rightarrow$ cho phép đổi trả. Quá 7 ngày $\rightarrow$ Ném `422 RETURN_WINDOW_EXPIRED`. |
| **SC-10** | **Quy Trình Đổi Trả & Chặn Bypass RBAC** | `POST /order-returns` $\rightarrow$ `process` $\rightarrow$ `receive` $\rightarrow$ `approve` $\rightarrow$ `refund` | Customer tạo return (`REQUESTED`, giữ `returnReservedQty`). Receptionist chỉ được `process` và `receive`. Receptionist gọi `approve`/`reject` $\rightarrow$ Chặn `403 Forbidden`. Manager/Admin duyệt `approve` và xử lý hoàn tiền `OrderRefund` $\rightarrow$ `REFUNDED` (`COMPLETED`). |
| **SC-11** | **Partial Return, Multi-Stage Return & Ceiling Limit** | `order-returns` (Partial Qty, Multiple times) | Return 1 trong các item đa loài hoặc trả từng phần số lượng; tính đơn giá thực trả `unitNet = Math.floor(lineNet / quantity)`. Đợt cuối bù toàn bộ phần dư lẻ. Không hoàn phí ship (`shippingRefunded = 0`). Chặn trần lũy kế (`422 REFUND_EXCEEDS_NET_PAID`). |
| **SC-12** | **Bảo Toàn Quota Voucher Hậu Hoàn Tiền** | `order-returns` Approve/Complete | Tuyệt đối **không** khôi phục quota voucher sau khi đã Delivered/Completed. Voucher usage giữ nguyên lịch sử giao dịch. |

---

## 3. Phân Công Chuyên Môn & Agent Routing

- **Master Orchestrator & Backend Architect:** `@[backend-specialist]` (chịu trách nhiệm kiến trúc dịch vụ, MongoDB session transactions, tính toàn vẹn 2 tầng tài chính, idempotency).
- **Test Engineering:** `@[backend-specialist]` kết hợp Jest + Supertest (kiểm thử tích hợp trực tiếp qua Express App, middleware và service logic).
- **Security & Authorization Reviewer:** Đối chiếu `08-authorization-matrix-v7.md` (chặn bypass phân quyền Receptionist vs Manager/Admin).

---

## 4. Kế Hoạch Triển Khai Từng Bước (Actionable Tasks)

### Giai đoạn 1: Chuẩn Bị Data Fixtures Đa Loài & Danh Mục Mới
- [x] **Task 1.1:** Xây dựng module fixture helper `tests/fixtures/orderE2EData.js`:
  - Khởi tạo 4 Categories chuẩn: `Thức ăn & Dinh dưỡng`, `Vệ sinh & Chăm sóc`, `Phụ kiện & Chuồng trại`, `Y tế & Thực phẩm chức năng`.
  - Khởi tạo 4 Products đại diện cho 4 nhóm loài:
    - `PROD-DOG-01`: Chó (price: 150,000, discountPercent: 10% $\rightarrow$ finalPrice: 135,000 VND).
    - `PROD-CAT-01`: Mèo (price: 80,000, discountPercent: 0% $\rightarrow$ finalPrice: 80,000 VND).
    - `PROD-SMALL-01`: Thú nhỏ (Hamster/Thỏ) (price: 120,000, discountPercent: 25% $\rightarrow$ finalPrice: 90,000 VND).
    - `PROD-BIRD-01`: Chim cảnh (price: 100,000, discountPercent: 0% $\rightarrow$ finalPrice: 100,000 VND).
  - Khởi tạo InventoryItems và InventoryStock trên 3 chi nhánh (`BR-000001` - Q1, `BR-000002` - Q3, `BR-000003` - Bình Thạnh) với các mức tồn kho có chủ đích:
    - Case A: Branch 1 đủ cả giỏ hàng đa loài.
    - Case B: Branch 1 thiếu 1 món, Branch 2 đủ toàn bộ giỏ hàng.
    - Case C: Branch 1 có món A (món B = 0), Branch 2 có món B (món A = 0) (tổng tồn cả hệ thống đủ nhưng từng chi nhánh riêng lẻ không đủ).
  - Cấu hình `SystemSetting` key `commerce`: `fulfillmentBranchPriority: [BR-000001, BR-000002, BR-000003]`, `freeShippingThreshold: 500000`, `standardShippingFee: 30000`.
  - Tạo 3 mã Voucher mẫu:
    - `VOUCHER_PCT_CAP`: Giảm 10% tối đa 50,000 VND.
    - `VOUCHER_FIXED`: Giảm 40,000 VND cho đơn từ 150,000 VND.
    - `VOUCHER_SCOPED`: Giảm 20% chỉ áp dụng cho `PROD-SMALL-01`.
  - Cung cấp Auth Tokens: Customer, Guest, Receptionist, Manager, Admin.

### Giai đoạn 2: Xây Dựng Suite Kiểm Thử Checkout & Fulfillment Resolver
- [x] **Task 2.1:** Viết kịch bản kiểm tra ưu tiên phân bổ chi nhánh (`FulfillmentBranchResolver`):
  - Kiểm tra chọn đúng Branch 1 khi đủ hàng.
  - Kiểm tra tự động bỏ qua Branch 1 nếu thiếu hàng và chọn Branch 2.
  - Kiểm tra bỏ qua Branch nếu Branch có trạng thái `INACTIVE`.
  - Kiểm tra ném lỗi `422 INSUFFICIENT_INVENTORY` khi tổng tồn đủ nhưng không chi nhánh đơn lẻ nào chứa đủ toàn bộ giỏ hàng (Cart Split Rejection).
- [x] **Task 2.2:** Kiểm tra tính toàn vẹn của giỏ hàng và kho:
  - Giỏ hàng rỗng, số lượng $\le 0$, số lượng vượt quá tồn kho.
  - Trừ kho nguyên tử bằng ledger `ISSUE` trên branch được chọn; các branch còn lại không bị trừ stock.
  - Xóa giỏ hàng sau khi checkout thành công.

### Giai đoạn 3: Kiểm Thử Two-Tier Pricing & Vòng Đời Order (COD & ONLINE_MOCK)
- [x] **Task 3.1:** Kịch bản tính giá 2 tầng (Product discount trước, Voucher sau):
  - Giỏ hàng kết hợp nhiều sản phẩm có discountPercent khác nhau (Chó 10%, Thú nhỏ 25%, Mèo 0%).
  - Kiểm chứng `unitPrice = finalPrice`, `lineSubtotal = finalPrice * quantity`.
  - Áp dụng Voucher trên `merchandiseSubtotal`: voucher phân bổ chính xác từng dòng theo tỷ lệ, dồn phần dư lẻ vào dòng cuối cùng.
- [x] **Task 3.2:** Kịch bản luồng COD chuẩn:
  - Khởi tạo Order `PENDING`, Payment `PENDING`.
  - Chuyển tiếp tuần tự: `CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `COMPLETED` (`mark-delivered`).
  - Kiểm chứng: Payment chuyển sang `PAID` và ghi nhận `paidAt` ngay tại `mark-delivered`. Ghi nhận `deliveredAt` để mở cửa sổ trả hàng.
- [x] **Task 3.3:** Kịch bản luồng ONLINE_MOCK & Thất bại thanh toán:
  - Thử gọi `confirm` khi Payment chưa `PAID` $\rightarrow$ ném lỗi `422 PAYMENT_REQUIRED`.
  - Mô phỏng Payment `FAILED` / `CANCELLED` / `EXPIRED`:
    - Tự động huỷ đơn sang `CANCELLED`.
    - Thực hiện giao dịch bù (compensating tx): ghi ledger `RECEIPT` để hoàn kho.
    - Hoàn trả voucher quota qua `restoreQuotaInSession` với tính chất idempotent (không hoàn 2 lần).

### Giai đoạn 4: Kiểm Thử Luồng Return/Refund & Phân Quyền Đa Cấp
- [x] **Task 4.1:** Kiểm tra Return Window (7 ngày):
  - Tạo return trong vòng 7 ngày $\rightarrow$ thành công.
  - Tạo return sau 7 ngày kể từ `deliveredAt` $\rightarrow$ ném lỗi `422 RETURN_WINDOW_EXPIRED`.
- [x] **Task 4.2:** Kiểm tra ma trận phân quyền RBAC (Role Bypass Protection):
  - Customer tạo return request (`REQUESTED`), tạm giữ `returnReservedQty`.
  - Receptionist gọi `/process` $\rightarrow$ `PROCESSING`.
  - Receptionist gọi `/receive` $\rightarrow$ `RECEIVED`.
  - Receptionist cố tình gọi `/approve` hoặc `/reject` $\rightarrow$ trả về `403 Forbidden`.
  - Manager/Admin gọi `/approve` $\rightarrow$ `APPROVED` (chốt `refundBreakdown`, tạo `OrderRefund` `PENDING`).
  - Manager/Admin gọi `/reject` $\rightarrow$ `REJECTED` (giải phóng `returnReservedQty`, không hoàn tiền, không nhập kho theo chuẩn Canonical v7).
  - Manager/Admin gọi `/order-refunds/:id/process` $\rightarrow$ `REFUNDED` (OrderReturn chuyển sang `COMPLETED`, Payment ghi nhận `refundedAmount`).

### Giai đoạn 5: Kiểm Thử Nghiệp Vụ Hoàn Tiền Phức Hợp (Multi-Item Đa Loài, Voucher, Ceiling)
- [x] **Task 5.1:** Kịch bản Order 2+ items đa loài áp voucher:
  - Snapshot tài chính: `allocatedDiscount`, `lineNet` dựa trên `finalPrice`.
  - Partial Return lần 1 (trả 1 phần số lượng): tính đơn giá thực trả `unitNet * qty`. Phí ship không hoàn (`shippingRefunded: 0`).
  - Partial Return lần 2 (trả nốt số lượng còn lại): bù toàn bộ số lẻ còn lại `lineNet - refundedNet`.
  - Kiểm tra đối chiếu tổng số tiền hoàn khớp 100% với `lineNet` của sản phẩm.
  - Kiểm tra chặn trần: nếu cố tình yêu cầu hoàn vượt quá tổng tiền hàng thực trả $\rightarrow$ ném `422 REFUND_EXCEEDS_NET_PAID`.
- [x] **Task 5.2:** Kiểm tra voucher quota sau giao:
  - Sau khi đơn hàng đã `DELIVERED`/`COMPLETED`, toàn bộ các bước hoàn tiền partial/full tuyệt đối **không** được khôi phục voucher quota.
  - So sánh với việc hủy đơn trước khi giao: hủy hợp lệ trước khi giao thì voucher quota được khôi phục đúng 1 lần.

### Giai đoạn 6: Tích Hợp Test Suite & Chạy Kiểm Thử Toàn Diện
- [x] **Task 6.1:** Đóng gói thành file kiểm thử hoàn chỉnh `tests/order-e2e.test.js`.
- [x] **Task 6.2:** Chạy kiểm thử tự động toàn dự án:
  - `npm test -- --runInBand tests/order-e2e.test.js` (16/16 tests PASS 100%)
  - Chạy toàn bộ 13 suites: `npm test -- --runInBand` (184/184 tests PASS 100%)
  - Kiểm tra build sản phẩm: `npm run build` (122 files compiled Babel)
- [x] **Task 6.3:** Cập nhật tài liệu bàn giao `docs/FE-HANDOFF-SERVICE-BRANCH-ORDER-RETURN.md` và tạo Walkthrough tổng kết.

---

## 5. Tiêu Chí Hoàn Thành (Done Criteria)

- [x] Tất cả kịch bản E2E từ SC-01 đến SC-12 đều pass 100% trong `tests/order-e2e.test.js` (16/16 tests PASS).
- [x] Không làm gãy bất kỳ test suite nào trong 12 suites hiện tại (184/184 tests PASS across all 13 suites).
- [x] Dữ liệu fixture bao phủ 4 nhóm loài (Chó, Mèo, Thú nhỏ, Chim cảnh) và 4 Category chuẩn hóa.
- [x] Thuật toán tính giá 2 tầng (Product discount trước, Voucher sau) được kiểm chứng chính xác từng đồng VND.
- [x] Tách biệt rõ ràng quyền hạn giữa Receptionist (chỉ tiếp nhận/nhận hàng) và Manager/Admin (duyệt hoàn tiền).
- [x] Tính toán tài chính hoàn tiền chính xác từng đồng VND, không hoàn ship, chặn trần net paid, và không khôi phục voucher sau khi đã giao hàng.
- [x] Lệnh `npm run build` chạy không có lỗi biên dịch Babel.
