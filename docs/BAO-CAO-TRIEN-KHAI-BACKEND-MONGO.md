# BÁO CÁO KỸ THUẬT: TRIỂN KHAI & HOÀN THIỆN BACKEND - MONGODB ATLAS
**Dự án:** Hệ thống Quản trị & Thương mại Chuỗi Phòng khám Thú y Dr. Pet's House  
**Phiên bản:** Task 2.8 - UAT Production Ready (MongoDB Atlas `pet_clinic_v2`)  
**Nhánh Git:** `feat/foundation-v6`  
**Tác giả:** Senior Backend & Prompt Engineer  

---

## 1. TỔNG QUAN HIỆN TRẠNG & NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)

Sau khi kiểm tra phản hồi từ PM và rà soát đối soát toàn bộ mã nguồn Backend (`feat/foundation-v6`) cùng cơ sở dữ liệu MongoDB Atlas, các lỗi được xác định nguyên nhân kỹ thuật chi tiết như sau:

| # | Vấn đề phản ánh | Nguyên nhân Kỹ thuật Backend / Database | Hệ quả thực tế |
|---|---|---|---|
| **1** | **Tạo ca làm chỉ có 1 chi nhánh, nhân sự trực full tuần 7/7 sáng tối** | File seed cũ `demoUsersSeed.js` chỉ khởi tạo nhân sự cho duy nhất chi nhánh `BR-000001` (Quận 1). Hai chi nhánh `BR-000002` (Quận 7) và `BR-000003` (Bình Thạnh) có 0 nhân sự. Vòng lặp tạo ca chạy cứng `for (let i = 0; i < 7; i++)` từ 08:00 - 17:00 không có ngày nghỉ. | Lịch trực phi thực tế, vi phạm Luật Lao động; 2 chi nhánh còn lại không thể phân ca vì không có nhân sự trực thuộc. |
| **2** | **1 chi nhánh chỉ có 4 nhân viên, tên role hiển thị bị lặp** | CSDL lưu 2 trường phân cấp: `systemRole: 'STAFF'` và `staffSubRole: 'VETERINARIAN'`. Bộ seed cũ chỉ tạo đúng 4 tài khoản cho Q1; Frontend ghép chuỗi thô dẫn đến hiển thị lặp `Nhân viên - Bác sĩ thú y` hoặc `STAFF - VETERINARIAN`. | Thiếu nhân sự kiểm thử luồng đa chi nhánh; giao diện hiển thị thiếu chuyên nghiệp. |
| **3** | **Sản phẩm có 16 cái, 6-7 cái là sản phẩm test; danh mục lộn xộn; không có hình** | Quá trình chạy Postman/Integration Test tạo các bản ghi rác (`SP-000555`, `SP-000888`, `SP-000999`, tên chứa `test`, `thử nghiệm`). Script `uatSeed.js` nạp sản phẩm nhưng trường ảnh rỗng (`images: []`). | Danh mục và sản phẩm rác làm loãng dữ liệu UAT; giao diện cửa hàng không có hình ảnh hiển thị. |
| **4** | **Thiếu các trường hợp khách vãng lai (Guest) không có tài khoản** | Chưa có kịch bản seed cho khách vãng lai mua hàng hoặc đặt lịch khám; trường `customerId` trên đơn hàng và lịch hẹn luôn mặc định gắn vào một User có sẵn. | Không thể kiểm thử luồng khách vãng lai tra cứu đơn hàng, đặt cọc dịch vụ hoặc luồng kích hoạt tài khoản từ khách vãng lai. |

---

## 2. THIẾT KẾ KIẾN TRÚC & NGHIỆP VỤ THỰC TẾ (REALISTIC DOMAIN ARCHITECTURE)

Kịch bản seed mới [BE/src/seeds/productionUatSeed.js](file:///c:/Users/thain/Downloads/Web2%20Đồ%20án/BE/src/seeds/productionUatSeed.js) được xây dựng theo chuẩn mực vận hành phòng khám thú y và thương mại điện tử:

### 2.1. Đa chi nhánh & Cấu hình Thương mại (Multi-Branch & Commerce Settings)
* **Chi nhánh 1 (Quận 1 - Trụ sở trung tâm):** `BR-000001` - Số 120 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP.HCM. Hotline: `02838221111`.
* **Chi nhánh 2 (Quận 7 - Khu đô thị mới):** `BR-000002` - Số 450 Nguyễn Thị Thập, Phường Tân Quy, Quận 7, TP.HCM. Hotline: `02837752222`.
* **Chi nhánh 3 (Bình Thạnh - Cửa ngõ phía Đông):** `BR-000003` - Số 85 Bạch Đằng, Phường 15, Quận Bình Thạnh, TP.HCM. Hotline: `02835113333`.
* **Cấu hình Thương mại (`SystemSetting` key `commerce`):**
  * Thứ tự ưu tiên xuất kho / fulfillment: `[BR-000001, BR-000002, BR-000003]`.
  * Ngưỡng miễn phí vận chuyển: `500,000 VND`.
  * Phí vận chuyển tiêu chuẩn nội thành: `30,000 VND`.

### 2.2. Đội ngũ Nhân sự Đa chi nhánh & Lịch trực thực tế (Shifts Rotation)
* **Quản trị & Quản lý:**
  * `admin` (`admin@petclinic.com`): Quản trị viên toàn hệ thống (quyền hạn 3 chi nhánh).
  * `manager_q1` (`manager.q1@petclinic.com`): Quản lý Chi nhánh Quận 1.
  * `manager_q7` (`manager.q7@petclinic.com`): Quản lý Chi nhánh Quận 7.
* **12 Nhân viên chia đều cho 3 chi nhánh (mỗi chi nhánh 4 chức danh chuyên môn):**
  * **Chi nhánh Quận 1:**
    * Bác sĩ thú y: `doctor.an` (BS. Nguyễn Văn An)
    * Y tá: `nurse.mai` (Y tá Trần Thị Mai)
    * Lễ tân: `reception.bich` (Lễ tân Lê Ngọc Bích)
    * Chuyên viên Grooming: `groomer.dat` (Groomer Phạm Thành Đạt)
  * **Chi nhánh Quận 7:**
    * Bác sĩ thú y: `doctor.nam` (BS. Vũ Hoàng Nam)
    * Y tá: `nurse.trang` (Y tá Đỗ Thu Trang)
    * Lễ tân: `reception.khang` (Lễ tân Đinh Gia Khang)
    * Chuyên viên Grooming: `groomer.huy` (Groomer Hoàng Quốc Huy)
  * **Chi nhánh Bình Thạnh:**
    * Bác sĩ thú y: `doctor.thao` (BS. Phan Phương Thảo)
    * Y tá: `nurse.phuc` (Y tá Võ Hồng Phúc)
    * Lễ tân: `reception.yen` (Lễ tân Lâm Hải Yến)
    * Chuyên viên Grooming: `groomer.tuan` (Groomer Trịnh Anh Tuấn)
* **Quy luật xoay ca thực tế (Shift Rules):**
  * **Ca Sáng:** 08:00 – 14:00.
  * **Ca Chiều:** 14:00 – 20:00.
  * Mỗi nhân viên trực 1 ca/ngày, được nghỉ cố định 1 đến 2 ngày/tuần (Bác sĩ An nghỉ Thứ 4; Bác sĩ Nam nghỉ Thứ 5; Groomer nghỉ luân phiên ngày thường để phục vụ cao điểm cuối tuần).

### 2.3. Danh mục chuẩn hóa & 10 Sản phẩm thực tế có ảnh Unsplash chất lượng cao
* **4 Danh mục chuẩn:**
  1. `thuc-an-dinh-duong` (Thức ăn dinh dưỡng chó mèo)
  2. `cham-soc-ve-sinh` (Chăm sóc & Vệ sinh)
  3. `y-te-thuoc` (Y tế & Thuốc đặc trị thú y)
  4. `phu-kien-do-choi` (Phụ kiện & Đồ chơi thú cưng)
* **10 Sản phẩm có ảnh CDN độ phân giải cao (1200x1200px), đầy đủ biến thể, giá bán, giá vốn:**
  1. Thức ăn Hạt Chó Trưởng Thành Royal Canin Mini Adult (800g, 2kg, 8kg)
  2. Hạt Cho Mèo Vị Cá Biển Whiskas Ocean Fish (1.2kg, 3kg, 7kg)
  3. Cát Đậu Nành Tự Nhiên Cature Tofu Clumping Cat Litter (6L, 18L)
  4. Viên Nhai Trị Ve Rận Bọ Chét Bravecto Chewable (4.5-10kg, 10-20kg)
  5. Sữa Tắm Khử Mùi & Dưỡng Lông SOS Cao Cấp (530ml Hương Nước Hoa, 530ml Diệt Khuẩn)
  6. Đồ Chơi Gặm Sạch Răng Cho Chó KONG Classic Dog Toy (Size M, Size L)
  7. Cỏ Khô Alfalfa Cao Cấp Cho Thỏ & Bọ Ú Nature's Best (Gói 500g, Gói 1kg)
  8. Thức Ăn Hạt Trộn Dinh Dưỡng Cho Vẹt Cảnh Rio Bird Daily (Gói 500g, Gói 1kg)
  9. Gel Dinh Dưỡng & Tiêu Búi Lông Cho Mèo GimCat Malt-Soft Extra (Tuýp 100g, Tuýp 200g)
  10. Nệm Tròn Nhồi Bông Êm Ái Cho Chó Mèo Cozy Cloud (Size S, Size M)
* **Tồn kho đa chi nhánh (`InventoryStock`):** Toàn bộ sản phẩm được phân bổ tồn kho độc lập tại cả 3 chi nhánh (`BR-000001`, `BR-000002`, `BR-000003`) phục vụ luồng điều phối kho.

---

## 3. BAO QUÁT ĐẦY ĐỦ CÁC TRƯỜNG HỢP DỮ LIỆU THỰC TẾ (DATA SCENARIOS)

Hệ thống seed bao gồm 100% các tình huống kinh doanh thực tế:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CÁC TRƯỜNG HỢP DỮ LIỆU UAT                     │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. KHÁCH CÓ TÀI KHOẢN (MEMBER)    │ 2. KHÁCH VÃNG LAI (GUEST - NO ACC) │
│ - Customer Profile: Lê Văn Cường  │ - Guest Contact: Nguyễn Thị Hồng   │
│ - 2 Thú cưng: Buddy & Luna        │ - Đơn hàng COD: ORD-GUEST-HOT-01   │
│ - 4 Đơn hàng: Đa trạng thái       │ - customerId = null                │
│ - Lịch hẹn: APT-CUST-COMPLETED-01 │ - Liên kết qua guestContactId      │
│ - Bệnh án: ServiceRecord FINALIZED│                                    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. KHÁCH VÃNG LAI ĐẶT LỊCH HẸN    │ 4. KHÁCH VÃNG LAI CHỜ KÍCH HOẠT    │
│ - Guest Contact: Phạm Hoàng Long  │ - Guest Contact: Trần Minh Đức     │
│ - Lịch hẹn khám: APT-GUEST-01     │ - activationStatus:                │
│ - Cọc 30% tại quầy (PAY_AT_STORE) │   PENDING_ACTIVATION               │
│ - Lưu contactSnapshot & petSnap   │ - Token mời: INVITE-ACT-778899     │
│ - customerId = null               │ - Sẵn sàng test luồng kích hoạt    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 3.1. Trường hợp Khách hàng thành viên có tài khoản (`Customer`)
* Người dùng: **Lê Văn Cường** (`customer` / `customer@petclinic.com` / `0909123456`).
* 2 Thú cưng trong hồ sơ bệnh án: Chó Poodle **Buddy** (2 tuổi) và Mèo Anh lông ngắn **Luna** (1.5 tuổi).
* 4 Đơn hàng thương mại:
  * `ORD-COMPLETED-01`: Đã giao hàng thành công, thanh toán online VNPAY.
  * `ORD-SHIPPED-02`: Đang trên đường vận chuyển, hình thức COD.
  * `ORD-PROCESSING-03`: Đang được đóng gói tại Chi nhánh Quận 1.
  * `ORD-CANCELLED-04`: Đơn hàng đã hủy do khách đổi nhu cầu.
* 1 Lịch hẹn khám chữa bệnh `APT-CUST-COMPLETED-01`:
  * Trạng thái `COMPLETED` tại Chi nhánh Quận 1, Bác sĩ phụ trách: BS. Nguyễn Văn An.
  * Kèm **Hồ sơ bệnh án điện tử (`ServiceRecord`)** trạng thái `FINALIZED`, có chẩn đoán viêm da dị ứng và đơn thuốc phác đồ 7 ngày.

### 3.2. Trường hợp Khách vãng lai mua hàng online (`Guest Order - NO ACCOUNT`)
* Khách hàng: **Nguyễn Thị Hồng** (`0981112233`, `activationStatus: 'NO_ACCOUNT'`).
* Đơn hàng: `ORD-GUEST-HOT-01` (COMPLETED, mua 5 túi hạt Whiskas giao COD đến Quận 3).
* **Đặc tính kỹ thuật trên Database:**
  * **`customerId: null`** (Không có liên kết tài khoản).
  * **`guestContactId`**: Trỏ tới bản ghi `GuestContact`.
  * Toàn bộ thông tin họ tên, số điện thoại, địa chỉ nhận hàng được sao chép nguyên vẹn trong `contactSnapshot` và `shippingAddress`.

### 3.3. Trường hợp Khách vãng lai đặt lịch khám thú y (`Guest Appointment - NO ACCOUNT`)
* Khách hàng: **Phạm Hoàng Long** (`0978889900`, `activationStatus: 'NO_ACCOUNT'`).
* Lịch hẹn: `APT-GUEST-CLINIC-01` (CONFIRMED vào ngày mai tại Chi nhánh Quận 1).
* Dịch vụ: Khám tổng quát & Tiêm phòng vaccine cho mèo Miu Miu.
* Hình thức thanh toán: `PAY_AT_STORE`, **đã đặt cọc 30% (60,000 VND)**, số tiền còn lại 140,000 VND sẽ thanh toán khi khám.
* **Đặc tính kỹ thuật trên Database:**
  * **`customerId: null`**, **`petId: null`**.
  * Thông tin liên hệ và thú cưng lưu độc lập trong `contactSnapshot` và `petSnapshot` (`{ name: 'Miu Miu', species: 'CAT', breed: 'Mèo Ba Tư', weightKg: 3.5 }`).

### 3.4. Trường hợp Khách vãng lai nhận lời mời kích hoạt (`Guest - PENDING_ACTIVATION`)
* Khách hàng: **Trần Minh Đức** (`0912345678`, `activationStatus: 'PENDING_ACTIVATION'`).
* Trạng thái hồ sơ: Khách hàng sau khi khám tại quầy được hệ thống gửi token kích hoạt tài khoản `INVITE-ACT-778899`.
* Phục vụ test trực tiếp API `POST /api/v1/auth/activate-guest` và giao diện nhập mật khẩu kích hoạt của FE.

### 3.5. 9 Mã Voucher khuyến mãi đa dạng (`Vouchers`)
Bao gồm: `WELCOME10` (10% đơn đầu tiên), `SUMMER50K` (giảm 50K), `FREESHIP` (miễn phí ship), `VIP20` (giảm 20% tối đa 200K), `CLINICFREE` (giảm 100K y tế), `SPAPAMPER` (giảm 15% Spa), `Q1SPECIAL` (riêng Q1), `EXPIRED2025` (hết hạn), `MAXEDOUT` (hết lượt dùng).

---

## 4. HƯỚNG DẪN VẬN HÀNH & NẠP DỮ LIỆU LÊN MONGODB ATLAS

### Bước 1: Mở IP Whitelist trên MongoDB Atlas
Do cụm MongoDB Atlas `pet_clinic_v2` sử dụng chính sách tường lửa IP, bạn cần thêm địa chỉ IP để chạy lệnh seed:
1. Đăng nhập [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Chọn cụm **PetClinicCluster** $\rightarrow$ chọn menu **Network Access** (dưới nhóm *Security*).
3. Nhấp nút **Add IP Address**:
   * Thêm IP máy hiện tại hoặc chọn **Allow Access from Anywhere** (`0.0.0.0/0`) để cho phép chạy script từ xa.
   * Nhấp **Confirm**.

### Bước 2: Thực thi Script Seed
Tại thư mục gốc Backend (`BE`), chạy lệnh sau:
```powershell
npm run seed:uat-prod
```

### Bước 3: Kiểm tra và Đối soát dữ liệu
Chạy script kiểm tra độc lập để in ra số lượng dữ liệu đã nạp:
```powershell
node scripts/inspectData.js
```
Và kiểm tra bộ test hồi quy của Backend:
```powershell
npm test
```
*(Kết quả kỳ vọng: 100% test suites pass, bao gồm toàn bộ luồng Guest Activation và Customer Account).*
