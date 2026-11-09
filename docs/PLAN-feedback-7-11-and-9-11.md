# Kế Hoạch Triển Khai Khắc Phục Feedback 7-11 (Bản 2) và 9-11

> **Chế độ:** `/plan` (Chỉ lập kế hoạch, không can thiệp code trước khi được phê duyệt)  
> **Tài liệu phân tích:** `docs/FEEDBACK 7-11 2.docx` & `docs/FEEDBACK 9-11 customer.docx`  
> **Chuyên gia phụ trách:** Project Planner, Backend Specialist & Orchestrator  

---

## 1. Mục tiêu (Goal)
Khắc phục triệt để 5 lỗi cốt lõi phía Backend (Hiển thị giá 0đ, Lọc loại dịch vụ Y tế vs Spa, Khung giờ đặt lịch bị trống, Lỗi đăng nhập mật khẩu tài khoản Customer, và Thiếu sổ địa chỉ khách hàng), đồng thời lập tài liệu Handoff hướng dẫn chi tiết cho Frontend xử lý các lỗi giao diện và kết nối API còn thiếu.

---

## 2. Bảng Đối Soát & Phân Loại Toàn Diện (Cross-Check List)

### A. Đối chiếu `FEEDBACK 7-11 2.docx` (27 mục):
| STT | Nội dung Feedback từ tài liệu | Phân loại | Trạng thái hiện tại | Nguyên nhân & Hướng giải quyết |
|:---:|:---|:---:|:---:|:---|
| 1 | **CHO T KÉ: Test API customer** | Tiêu đề | - | Phần test chức năng khách hàng |
| 2 | **thêm api thành phố đồ dô** *(media/image14.png)* | Cả BE & FE | **BE ĐÃ CÓ**<br>FE chưa nối | BE đã có sẵn API 3 cấp: `/api/v1/locations/provinces`, `/districts`, `/wards`. FE cần thay ô text tự gõ thành 3 dropdown gọi API này. |
| 3 | **Chỉ hiển thị dịch vụ loại BOOKABLE** *(media/image19.png)* | **BE FIX** | Cần cập nhật | Trang đặt lịch đang hiện cả Cấp cứu 24/7 (`CONTACT_ONLY`) và Phẫu thuật (`REQUEST_ONLY`). BE cần mặc định lọc `bookingMode: 'BOOKABLE'` khi public client gọi `/services`. |
| 4 | **Tài khoản Lê Văn Cường đặt chục đơn mà không có địa chỉ ở thông tin tài khoản?** *(media/image13.png)* | **BE FIX** | Cần cập nhật | `formatCustomerDetail` trong `customer.service.js` chưa populate/serialize mảng `addresses` từ `User`. Đồng thời tester chưa đăng nhập được do sai mật khẩu. |
| 5 | **MẤY CÁI SAU LÀ T CHECK TRÊN drpetshouse.lat LÀ CÁI MỚI NHẤT** | Ghi chú | - | Môi trường test production/custom domain. |
| 6 | **chưa nối giá à** *(media/image27.png)* | **BE FIX (CRITICAL)** | Cần sửa ngay | Trong `catalog.service.js` hàm `formatProduct`, logic format giá chỉ chạy khi `productType === 'SIMPLE'`. Toàn bộ sản phẩm trong DB có `productType: 'VARIANT'`, khiến giá cấp product bị `undefined` -> FE fallback thành **`0đ`**. |
| 7 | **chưa chỉnh UI nè cái cũ được hơn ở đây... cái 3 ảnh bên trái... khi bấm chọn từng loại hiển thị hình tương ứng** *(media/image23, 28.png)* | FE + BE Data | BE đã có ảnh variant, FE cần bind | BE đã có 3 variant với 3 ảnh sắc nét và nhãn. BE sẽ bổ sung alias `title`, `size`, `option`, `weight` để FE bind nhãn không bị ô trắng; FE bind sự kiện click variant đổi ảnh chính. |
| 8 | **phần bên trái hiển thị 3 ảnh = 3 ô, còn lại ẩn và có thể scroll để bấm xem** *(media/image20.png)* | FE | Thuộc FE | Thumbnail bị tràn dọc đè lên mô tả và footer do thiếu CSS `overflow-y` và `max-height`. |
| 9 | **ko có đánh giá mà dưới để 5 sao** *(media/image4.png)* | FE + BE Alias | FE bug `0 \|\| 5` | BE trả về `averageRating: 0, totalReviews: 0`. FE bị lỗi cú pháp JS `averageRating \|\| 5`. BE sẽ bổ sung thêm cờ `ratingDisplay: 0`, `hasReviews: false` để FE sửa thành `?? 0`. |
| 10 | **chưa có sp tương tự** *(media/image25.png)* | **BE FIX** | Hưởng lợi từ fix #6 | BE đã có `/products/:id/related` và `/similar`. Do lỗi giá ở #6 nên FE có thể lọc bỏ hoặc không render được card. Fix #6 sẽ làm sản phẩm tương tự hiển thị chuẩn. |
| 11 | **1. Nhớ nối 2 cái vc với giao hàng; 2. đổi màu nút “Mua ngay” nhìn bị chìm hơn nút thêm vào giỏ** *(media/image29.png)* | FE + BE Alias | BE đã có object `shipping` | Nút "Mua ngay": FE đổi CSS. Chính sách ship: BE thêm alias `freeShippingPolicy`, `deliveryEstimate` ở root của product để FE hiển thị ngay. |
| 12 | **nhấn nút đọc thêm thì chuyển xuống phần sp tương tự rồi** *(media/image5.png)* | FE | Thuộc FE | Nút "Đọc thêm" bị gắn thẻ `<a>` nhảy anchor `#related` thay vì toggle accordion text. |
| 13 | **chờ CVH tạo mục flash sale rồi nối lại nhé** *(media/image26.png)* | FE | Thuộc FE | Chờ thành viên FE ghép banner Flash Sale (BE đã có `/api/v1/flash-sales/active`). |
| 14 | **bỏ cái xác nhận này + tb xóa thnahf công luôn** *(media/image3.png)* | FE | Thuộc FE | Bỏ popup modal confirm khi xóa giỏ hàng và toast message. |
| 15 | **tạo giúp t sp của 4 cái banner này...** *(media/image21, 16.png)* | BE | **ĐÃ XONG** | Đã tạo và seed xong 4 sản phẩm banner `SP-BANNER-001` đến `004` ở commit `8055508`. |
| 16 | **nối api vào (chi nhánh dự phòng)** *(media/image2.png)* | FE | Thuộc FE | BE đã có `/api/v1/branches`, FE cần kết nối API thay vì dùng mảng tĩnh dự phòng. |
| 17 | **tất cả ô dưới đây ko required mà đang bắt phải điền hết mới cho gửi, bắt buộc ở field nội dung giúp t** *(media/image17.png)* | FE | Thuộc FE | BE đã cho phép nullable tất cả trừ `message/content`. FE cần bỏ thuộc tính `required` ở input Tên, SĐT, Email, Giới tính. |
| 18 | **chưa sửa bảng giá** *(media/image9, 18.png)* | FE | Thuộc FE | Layout modal bảng giá dịch vụ bị vỡ chữ, các pill cân nặng bị đè chồng lên nhau. |
| 19 | **nút “tư vấn miễn phí” redirect qua gọi hotline/zalo,..** *(media/image15.png)* | FE | Thuộc FE | Gắn link `tel:1900-6868` hoặc link Zalo vào nút. |
| 20 | **ở khám và điều trị mà hiện dvu của grooming, bên grooming thì trống** *(media/image6, 11.png)* | **BE FIX (CRITICAL)** | Cần sửa ngay | `listServices` trong `serviceCatalog.service.js` **chưa hề có bộ lọc `serviceType`**. Khi FE truyền `?serviceType=MEDICAL` hoặc `?category=Khám & Điều trị`, BE bỏ qua và trả toàn bộ list khiến grooming hiện trước. |
| 21 | **chưa có tính khung giờ... đặt lịch tới đây là die rồi** *(media/image8.png)* | **BE FIX (CRITICAL)** | Cần sửa ngay | `availability.service.js` kiểm tra ca trực nhân viên, nếu ngày chọn chưa có ca trực của nhân viên tương ứng thì set `staffUnavailable = true` -> slot `FULL` -> khách hàng nhận `slots: []` (trống trơn). Cần cơ chế fallback capacity cho giờ mở cửa của chi nhánh và mở rộng seed ca trực. |
| 22 | **thêm báo cáo vi phạm** *(media/image7.png)* | FE | **BE ĐÃ CÓ** | BE đã có sẵn `POST /api/v1/content/community/posts/:id/reports`. FE chỉ cần bổ sung nút/menu Báo cáo trên thẻ bài viết. |
| 23 | **cứu trợ bên link vercel thì nối rồi, link web thì chưa** *(media/image30, 12.png)* | FE Deploy | Thuộc FE | Link `drpetshouse.lat` chưa deploy bản build mới nhất kết nối API cứu trợ. |
| 24 | **đăng nhập ko được** *(media/image1.png)* | **BE FIX** | Xem mục 31 | Đồng bộ mật khẩu `K9#mQ$8xL!2vW*7z` cho Customer. |
| 25 | **nối api địa điểm sao kêu đổi ô QUỐC GIA thành gì ấy mà** *(media/image24.png)* | FE | Thuộc FE | Thay ô Quốc gia bằng dropdown Tỉnh/Quận/Phường từ API `/locations`. |
| 26 | **Tại sao phải cần đăng nhập z (khi nhập voucher)** *(media/image22.png)* | FE | Thuộc FE | FE tự check `if (!isLoggedIn)` và báo lỗi, trong khi API BE `/vouchers/validate` cho phép khách vãng lai (guest) kiểm tra mã. |
| 27 | **thêm header+footer cho trang thanh toán đơn hàng này** *(media/image10.png)* | FE | Thuộc FE | Gắn Header/Footer component vào trang Checkout. |

---

### B. Đối chiếu `FEEDBACK 9-11 customer.docx` (4 mục):
| STT | Nội dung Feedback từ tài liệu | Phân loại | Nguyên nhân & Hướng giải quyết |
|:---:|:---|:---:|:---|
| 28 | **sao mỗi lần load là nó hiện vầy, đổi thành “đang tải…” hay gì đó đi** *(media/image1.png: "Đang kiểm tra phiên đăng nhập...")* | FE | FE thay text thông báo kiểm tra token bằng loading spinner hoặc chữ "Đang tải...". |
| 29 | **? (Modal đăng nhập đè lên màn hình đặt lịch)** *(media/image4.png)* | FE | FE đang bắt buộc người dùng phải đăng nhập trước khi tiếp tục đặt lịch, trong khi nghiệp vụ và API BE cho phép khách vãng lai đặt lịch qua SĐT/Tên. |
| 30 | **thay favicon** *(media/image3.png)* | FE | FE thay file favicon icon móng vuốt thú cưng trong `index.html`. |
| 31 | **vẫn ko đăng nhập được** *(media/image2.png: 0905555555 + K9#mQ$8xL!2vW*7z -> "Invalid phone number or password")* | **BE FIX (CRITICAL)** | Tài liệu Handoff trước đây ghi mật khẩu Customer là `K9#mQ$8xL!2vW*7z`, nhưng code BE chỉ chấp nhận `cT6$vM2!pL9#zR8&` hoặc `Password123!`. BE cần cập nhật cho phép cả `K9#mQ$8xL!2vW*7z` và seed đồng bộ lên database. |

---

## 3. Danh Sách Nhiệm Vụ Kỹ Thuật Phía Backend (Tasks)

- [ ] **Task 1: Sửa triệt để hiển thị giá 0đ của sản phẩm (`src/modules/catalog/catalog.service.js`)**
  - Mở rộng logic `formatProduct`: Không phụ thuộc vào `productType === 'SIMPLE'`. Với mọi sản phẩm (`VARIANT`, `SIMPLE`, `COMBO`), tự động tính và gán `price = minPrice || minFinalPrice || variants[0]?.price || 0`, `finalPrice = minFinalPrice || variants[0]?.finalPrice || 0`, `product_price = ...`, `selling_price = ...`.
  - Bổ sung các alias của variant: `title: v.label`, `size: v.label`, `option: v.label`, `weight: v.label` để FE không bao giờ bị ô trắng rỗng.
  - *Kiểm tra:* Gọi `GET /api/v1/products` và `GET /api/v1/products/:id`, xác nhận 100% sản phẩm có `price > 0`, `finalPrice > 0`.

- [ ] **Task 2: Hỗ trợ lọc `serviceType` & `bookingMode: BOOKABLE` (`src/modules/catalog/serviceCatalog.service.js`)**
  - Bổ sung tham số `serviceType` và `type` vào `listServices`.
  - Xử lý ánh xạ thông minh:
    - Nếu `serviceType === 'MEDICAL'` hoặc `category` chứa `khám`, `điều trị`: lọc các dịch vụ Y tế (`MED01..MED05`).
    - Nếu `serviceType === 'GROOMING'` hoặc `category` chứa `grooming`, `spa`: lọc các dịch vụ Spa (`GRM01..GRM09`).
  - Mặc định khi khách hàng gọi `/services` không có bookingMode, chỉ trả về các dịch vụ có `bookingMode: 'BOOKABLE'` (loại bỏ Cấp cứu 24/7 và Phẫu thuật theo chỉ định).
  - *Kiểm tra:* Gọi `GET /api/v1/services?serviceType=MEDICAL` chỉ ra dịch vụ khám/điều trị; `GET /api/v1/services?serviceType=GROOMING` chỉ ra dịch vụ spa.

- [ ] **Task 3: Khắc phục khung giờ đặt lịch bị trống (`src/modules/booking/availability.service.js` & `uatSeed.js`)**
  - Cập nhật `availability.service.js`: Khi tính slots đặt lịch online, nếu chi nhánh mở cửa bình thường trong `openingHours`, nếu không có ca trực gán cứng thì fallback sang cơ chế capacity theo cấu hình chi nhánh (`BranchServiceConfig.capacity || 2`) để luôn có khung giờ khả dụng cho khách đặt.
  - Cập nhật seed ca trực trong `uatSeed.js` / `demoUsersSeed.js`: Tự động sinh ca trực luân phiên cho 30 ngày tiếp theo (thay vì chỉ 7 ngày) cho 4 vị trí nhân sự.
  - *Kiểm tra:* Gọi `GET /api/v1/availability?serviceIds=...&date=2026-11-21`, xác nhận trả về danh sách khung giờ trống có `status: 'AVAILABLE'`, không còn mảng rỗng `[]`.

- [ ] **Task 4: Fix lỗi đăng nhập `0905555555` với mật khẩu `K9#mQ$8xL!2vW*7z` (`src/modules/auth/auth.service.js` & Seed)**
  - Thêm `K9#mQ$8xL!2vW*7z` vào điều kiện chấp nhận mật khẩu của `CUSTOMER` / `0905555555` trong `auth.service.js`.
  - Cập nhật hash trong database cho user `customer` (`0905555555`).
  - *Kiểm tra:* Gửi `POST /api/v1/auth/login` với identifier `0905555555` và mật khẩu `K9#mQ$8xL!2vW*7z`, xác nhận HTTP 200 kèm access token.

- [ ] **Task 5: Trả về sổ địa chỉ khách hàng trong `formatCustomerDetail` (`src/modules/customer/customer.service.js`)**
  - Cập nhật hàm `formatCustomerDetail`: Populate và trả về `addresses: u?.addresses || []`.
  - Đảm bảo trong database user `customer` đã có sẵn địa chỉ mặc định `123 Lê Lợi, Phường Bến Nghé, Quận 1`.
  - *Kiểm tra:* Gọi `GET /api/v1/customers/:id` và `GET /api/v1/auth/me`, xác nhận có mảng `addresses` với ít nhất 1 địa chỉ.

- [ ] **Task 6: Bổ sung shipping & rating aliases trong `formatProduct` (`src/modules/catalog/catalog.service.js`)**
  - Trả thêm: `deliveryEstimate: '2 - 4 ngày'`, `freeShippingPolicy: 'Miễn phí vận chuyển cho đơn từ 500.000đ'`, `ratingDisplay: obj.ratingCount > 0 ? computedRating : 0`, `hasReviews: Boolean(obj.ratingCount > 0)`.
  - *Kiểm tra:* JSON response của chi tiết sản phẩm có sẵn các field này ở cấp root.

- [ ] **Task 7: Viết tài liệu Handoff chuyên sâu cho Frontend**
  - Lập file `docs/FE-HANDOFF-2026-11-09-FEEDBACK-RESOLUTION.md` hướng dẫn cụ thể cho FE xử lý 15 mục thuộc FE (CSS, form validation, event, layout, routes).

- [ ] **Task 8: Bộ Test Suite Tự Động Hóa Nghiệm Thu (Phase Verification)**
  - Viết file test mới `tests/feedback-7-11-and-9-11.test.js` kiểm tra tự động toàn bộ 6 lỗi BE đã khắc phục. Chạy test suite đảm bảo 100% pass.

---

## 4. Tiêu Chí Hoàn Thành (Done When)
1. Đăng nhập SĐT `0905555555` với mật khẩu `K9#mQ$8xL!2vW*7z` thành công 100%.
2. Tất cả sản phẩm hiển thị đúng giá bán thực tế (`price > 0`), không còn bất kỳ sản phẩm nào hiển thị `0đ`.
3. API `/api/v1/services` phân tách chính xác dịch vụ Khám bệnh và Grooming, loại bỏ dịch vụ không thể tự đặt lịch (`bookingMode !== 'BOOKABLE'`).
4. Khung giờ đặt lịch `/api/v1/availability` cho bất kỳ ngày nào trong tháng luôn trả về danh sách giờ trống hợp lệ.
5. Hồ sơ Customer trả về đầy đủ sổ địa chỉ đã seed.
6. Toàn bộ test suite chạy thành công không có lỗi.

