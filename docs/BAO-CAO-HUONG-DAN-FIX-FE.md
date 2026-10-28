# BÁO CÁO HƯỚNG DẪN KỸ THUẬT: FIX LỖI & HOÀN THIỆN GIAO DIỆN FRONTEND
**Dự án:** Hệ thống Website & Trang Quản trị Dr. Pet's House  
**Người nhận:** Hưng, Linh & Frontend Team  
**Người lập:** Senior Backend & Prompt Engineer  
**Tham chiếu Backend API:** Chuẩn OpenAPI V7 & MongoDB Database `pet_clinic_v2` (nhánh `feat/foundation-v6`)  

---

## 1. TỔNG QUAN CÁC ĐIỂM CẦN HOÀN THIỆN TRÊN FRONTEND

Dựa trên phản hồi từ PM và sự thay đổi cấu trúc dữ liệu theo chuẩn thực tế của Backend, Frontend cần điều chỉnh 6 hạng mục chính sau:

| # | Hạng mục lỗi | Nguyên nhân gốc rễ | Hướng xử lý trên FE |
|---|---|---|---|
| **1** | **Hình ảnh sản phẩm bị lỗi `[object Object]` hoặc không hiển thị** | Chuẩn OpenAPI V7 quy định `images` là một mảng object `[{ id, url, isPrimary }]`. Frontend đang render trực tiếp hoặc ép kiểu chuỗi. | Sử dụng helper `getProductThumbnail()` trích xuất trường `url` từ mảng ảnh. |
| **2** | **Tên Role nhân viên bị lặp** (ví dụ: *"Nhân viên - Bác sĩ thú y"*) | Backend lưu 2 trường: `systemRole: 'STAFF'` và `staffSubRole: 'VETERINARIAN'`. FE đang ghép chuỗi hoặc hiển thị cả 2 enum. | Áp dụng hàm mapper `renderStaffRoleName()` để hiển thị đúng tên tiếng Việt chuyên môn. |
| **3** | **Quản lý Ca làm việc (Shifts) chỉ hiển thị 1 chi nhánh** | FE chưa bind động danh sách 3 chi nhánh từ API `GET /api/v1/branches` hoặc đang hardcode chi nhánh đầu tiên. | Nạp động danh sách 3 chi nhánh; khi người dùng chọn chi nhánh thì tự động filter nhân viên thuộc chi nhánh đó. |
| **4** | **Crash hoặc lỗi giao diện khi gặp Khách vãng lai (Guest)** | Đơn hàng hoặc lịch hẹn của khách vãng lai có `customerId = null` (chưa có tài khoản). FE giả định `customerId` luôn tồn tại. | Kiểm tra `customerId == null`, fallback đọc từ `contactSnapshot` và hiển thị badge `[Khách vãng lai]`. |
| **5** | **Tự động đăng xuất sau 15 phút (Auto-logout)** | JWT Access Token có thời hạn sống 15 phút. Khi hết hạn, BE trả về `401 Unauthorized`. | Cấu hình Axios Interceptor tự động gọi `POST /api/v1/refresh` để xin token mới và retry request ngầm. |
| **6** | **Danh mục sản phẩm hiển thị sai hoặc lộn xộn** | FE đang dùng danh sách danh mục hardcode cũ hoặc chưa đồng bộ với 4 danh mục chuẩn của BE. | Gọi API `GET /api/v1/categories?status=ACTIVE` để lấy 4 danh mục chuẩn. |

---

## 2. HƯỚNG DẪN CHI TIẾT KÈM MÃ NGUỒN MẪU (CODE SNIPPETS)

### 2.1. Khắc phục lỗi Hình ảnh Sản phẩm (Images Array of Objects)
* **Vị trí áp dụng:** `FE/src/services/productService.js`, các component `ProductCard.jsx`, `ProductDetail.jsx`, `CartItem.jsx`, `OrderItem.jsx`.
* **Cách khắc phục:**
Tạo file helper tiện ích `src/utils/imageHelper.js`:

```javascript
/**
 * Trích xuất URL hình ảnh sản phẩm một cách an toàn
 * Tương thích cả định dạng OpenAPI V7 (mảng object) lẫn định dạng URL chuỗi cũ.
 * 
 * @param {Object} product - Đối tượng sản phẩm
 * @returns {string} URL hình ảnh hợp lệ hoặc ảnh placeholder mặc định
 */
export const getProductThumbnail = (product) => {
  if (!product) return '/images/default-product.png';

  // 1. Nếu images là mảng các đối tượng [{ id, url, isPrimary }]
  if (Array.isArray(product.images) && product.images.length > 0) {
    // Ưu tiên ảnh chính (isPrimary = true)
    const primaryImg = product.images.find(img => img && img.isPrimary);
    if (primaryImg && typeof primaryImg.url === 'string') {
      return primaryImg.url;
    }
    // Nếu không có ảnh primary, lấy ảnh đầu tiên
    const firstImg = product.images[0];
    if (typeof firstImg === 'string') return firstImg;
    if (firstImg && typeof firstImg.url === 'string') return firstImg.url;
  }

  // 2. Fallback cho các trường hợp dữ liệu cũ
  if (typeof product.thumbnail === 'string' && product.thumbnail.trim()) {
    return product.thumbnail;
  }
  if (typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    return product.imageUrl;
  }

  return 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&auto=format&fit=crop&q=60';
};
```

* **Cách dùng trong Component:**
```jsx
import { getProductThumbnail } from '../utils/imageHelper';

const ProductCard = ({ product }) => {
  const imageUrl = getProductThumbnail(product);

  return (
    <div className="product-card">
      <img 
        src={imageUrl} 
        alt={product.name} 
        onError={(e) => { e.target.src = '/images/default-product.png'; }}
      />
      <h3>{product.name}</h3>
    </div>
  );
};
```

---

### 2.2. Khắc phục lỗi Trùng lặp Tên Role Nhân viên
* **Vị trí áp dụng:** Trang Quản lý Nhân sự (`StaffManagement.jsx`), Danh sách Lịch trực (`ShiftCalendar.jsx`), Bảng phân công Bác sĩ.
* **Cách khắc phục:**
Tạo file `src/utils/roleHelper.js`:

```javascript
export const STAFF_ROLE_LABELS = {
  VETERINARIAN: 'Bác sĩ Thú y',
  NURSE: 'Y tá / Điều dưỡng',
  RECEPTIONIST: 'Lễ tân',
  CARE_STAFF_GROOMER: 'Chuyên viên Spa & Grooming',
  BRANCH_MANAGER: 'Quản lý Chi nhánh',
  ADMINISTRATOR: 'Quản trị viên'
};

/**
 * Hiển thị chức danh nhân viên chuẩn mực, không bị trùng lặp
 */
export const renderStaffRoleName = (user) => {
  if (!user) return 'Chưa phân công';

  if (user.systemRole === 'ADMIN') return 'Quản trị viên';
  if (user.systemRole === 'BRANCH_MANAGER') return 'Quản lý Chi nhánh';
  
  // Nếu là STAFF, hiển thị chức vụ chuyên môn
  if (user.staffSubRole && STAFF_ROLE_LABELS[user.staffSubRole]) {
    return STAFF_ROLE_LABELS[user.staffSubRole];
  }
  
  return 'Nhân viên';
};
```

* **Hiển thị trên UI:**
```jsx
// Thay vì hiển thị: {staff.systemRole} - {staff.staffSubRole}
// Hãy dùng:
<span className="staff-role-badge">
  {renderStaffRoleName(staff)}
</span>
```

---

### 2.3. Khắc phục Quản lý Ca làm việc & Phân ca Đa chi nhánh
* **Quy trình chuẩn cho UI Lịch trực (Shift Management):**
  1. Khi nạp trang Lịch làm việc, gọi API lấy danh sách các chi nhánh đang hoạt động:
     ```javascript
     const fetchBranches = async () => {
       const res = await axiosClient.get('/branches?status=ACTIVE');
       // Trả về mảng 3 chi nhánh: Quận 1 (BR-000001), Quận 7 (BR-000002), Bình Thạnh (BR-000003)
       setBranches(res.data.data?.branches || res.data.data || []);
     };
     ```
  2. Bổ sung bộ lọc Chi nhánh trên đầu trang lịch (Branch Filter Dropdown).
  3. Khi mở Modal "Thêm ca trực" (Create Shift):
     * Cung cấp Dropdown chọn Chi nhánh làm việc.
     * Khi người dùng chọn chi nhánh (ví dụ: Chi nhánh Quận 7), gọi API lấy danh sách nhân sự của chi nhánh đó để populate vào Dropdown Nhân viên:
       `GET /staff?branchId=${selectedBranchId}&status=ACTIVE`
     * Khung giờ ca trực chuẩn:
       * **Ca Sáng:** `08:00` - `14:00`
       * **Ca Chiều:** `14:00` - `20:00`

---

### 2.4. Xử lý Đơn hàng & Lịch hẹn của Khách vãng lai (Guest Cases - Không có Tài khoản)
* **Đặc điểm dữ liệu từ Backend:**
  * **Đơn hàng của Guest:** Trường `customerId` là `null`. Có trường `guestContactId` và snapshot `contactSnapshot: { fullName, phone, email }`.
  * **Lịch hẹn của Guest:** Trường `customerId` và `petId` là `null`. Thông tin lưu tại `contactSnapshot` và `petSnapshot: { name, species, breed, weightKg }`.
* **Cách hiển thị an toàn trên giao diện:**

```jsx
// Component hiển thị thông tin Khách hàng trên Đơn hàng (OrderRow.jsx)
const OrderCustomerInfo = ({ order }) => {
  const isGuest = !order.customerId || Boolean(order.guestContactId);
  const displayName = isGuest 
    ? (order.contactSnapshot?.fullName || 'Khách vãng lai')
    : (order.customer?.fullName || order.contactSnapshot?.fullName);
  const phone = order.contactSnapshot?.phone || order.customer?.phone;

  return (
    <div className="customer-info-cell">
      <div className="font-semibold">{displayName}</div>
      <div className="text-sm text-gray-500">{phone}</div>
      {isGuest && (
        <span className="badge badge-warning text-xs mt-1">
          Khách vãng lai
        </span>
      )}
    </div>
  );
};
```

```jsx
// Component hiển thị Thú cưng trên Lịch hẹn (AppointmentCard.jsx)
const AppointmentPetInfo = ({ appointment }) => {
  const isGuest = !appointment.customerId;
  const petName = appointment.pet?.name || appointment.petSnapshot?.name || 'Thú cưng vãng lai';
  const species = appointment.pet?.species || appointment.petSnapshot?.species || 'OTHER';

  return (
    <div className="pet-info">
      <span className="pet-name font-medium">{petName}</span>
      <span className="pet-species text-xs text-gray-400">({species})</span>
      {isGuest && <span className="tag-guest text-xs ml-2">Khách vãng lai</span>}
    </div>
  );
};
```

---

### 2.5. Khắc phục Lỗi Tự Động Đăng Xuất Sau 15 Phút (Silent Refresh Token)
* **Vị trí áp dụng:** File cấu hình Axios của toàn ứng dụng (ví dụ: `FE/src/services/api.js` hoặc `FE/src/utils/axiosClient.js`).
* **Cơ chế hoạt động:**
  Khi Access Token hết hạn (15 phút), API gọi lên sẽ nhận về lỗi `401 Unauthorized`. Thay vì chuyển hướng ngay về `/login`, Axios Interceptor sẽ tạm dừng request đó, âm thầm gọi `POST /api/v1/refresh` để lấy Access Token mới, sau đó thử lại request ban đầu.

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1',
  withCredentials: true // Bắt buộc để gửi cookie HttpOnly chứa refresh_token
});

// Interceptor cho Request: Gắn Bearer Token nếu FE lưu token trong memory/localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor cho Response: Xử lý Silent Refresh Token khi gặp lỗi 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Bỏ qua nếu lỗi không phải 401 hoặc request là chính API refresh/login
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/refresh-token')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi API cấp lại Access Token
        const refreshResponse = await axios.post(
          `${api.defaults.baseURL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Nếu refresh token cũng hết hạn -> Thực hiện đăng xuất sạch sẽ
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login?expired=true';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## 3. DANH SÁCH TÀI KHOẢN & DỮ LIỆU MẪU ĐỂ TEST TRÊN FRONTEND

Sau khi Backend chạy seed xong trên MongoDB Atlas, Frontend team có thể dùng các tài khoản sau để test:

| Role | Username / Email | Mật khẩu chung | Chi nhánh kiểm tra |
|---|---|---|---|
| **System Admin** | `admin` / `admin@petclinic.com` | `K9#mQ$8xL!2vW*7z` | Toàn quyền cả 3 chi nhánh |
| **Manager Q1** | `manager_q1` / `manager.q1@petclinic.com` | `K9#mQ$8xL!2vW*7z` | Chi nhánh Quận 1 (`BR-000001`) |
| **Manager Q7** | `manager_q7` / `manager.q7@petclinic.com` | `K9#mQ$8xL!2vW*7z` | Chi nhánh Quận 7 (`BR-000002`) |
| **Bác sĩ Thú y Q1** | `doctor.an` | `K9#mQ$8xL!2vW*7z` | BS. Nguyễn Văn An - Q1 |
| **Bác sĩ Thú y Q7** | `doctor.nam` | `K9#mQ$8xL!2vW*7z` | BS. Vũ Hoàng Nam - Q7 |
| **Khách hàng Member** | `customer` / `customer@petclinic.com` | `K9#mQ$8xL!2vW*7z` | Lê Văn Cường (Có 2 Pet, 4 Đơn hàng, 1 Bệnh án) |
| **Khách vãng lai (Guest)** | Đơn `ORD-GUEST-HOT-01` | *(Không có mật khẩu)* | Kiểm tra hiển thị khách vãng lai mua hàng |
| **Khách vãng lai Lịch hẹn**| Mã `APT-GUEST-CLINIC-01` | *(Không có mật khẩu)* | Kiểm tra hiển thị lịch hẹn khách vãng lai mèo Miu Miu |

---

## 4. CHECKLIST NGHIỆM THU CHO FRONTEND (VERIFICATION CHECKLIST)

- [ ] **1. Ảnh Sản phẩm:** Mở trang Danh sách sản phẩm và Chi tiết sản phẩm. Đảm bảo toàn bộ 10 sản phẩm hiển thị ảnh Unsplash chất lượng cao, không có ô ảnh nào bị vỡ hoặc hiện `[object Object]`.
- [ ] **2. Tên Chức danh Nhân sự:** Mở màn Quản trị Nhân sự / Lịch làm việc. Đảm bảo nhân viên hiện rõ ràng: *"Bác sĩ Thú y"*, *"Y tá / Điều dưỡng"*, *"Lễ tân"*, *"Chuyên viên Spa & Grooming"*, không bị lặp chữ.
- [ ] **3. Lọc Ca làm việc theo Chi nhánh:** Chọn lần lượt 3 chi nhánh Quận 1, Quận 7, Bình Thạnh. Đảm bảo mỗi chi nhánh hiện đúng 4 nhân viên trực thuộc và danh sách các ca sáng/chiều tương ứng.
- [ ] **4. Đơn hàng Khách vãng lai:** Vào trang Danh sách Đơn hàng trong Admin. Đơn `ORD-GUEST-HOT-01` hiển thị đầy đủ thông tin người nhận (Nguyễn Thị Hồng, Quận 3) kèm badge *"Khách vãng lai"*, không bị trắng trang hay crash lỗi do thiếu `customerId`.
- [ ] **5. Lịch hẹn Khách vãng lai:** Vào màn Lịch hẹn khám. Lịch `APT-GUEST-CLINIC-01` hiển thị đúng tên thú cưng *"Miu Miu"* và trạng thái đã đặt cọc 30% (60,000đ).
- [ ] **6. Cơ chế Tự làm mới Token:** Đăng nhập tài khoản, để tab nhàn rỗi hơn 15 phút. Sau đó bấm thao tác tải lại dữ liệu hoặc chuyển trang. Đảm bảo trong tab Network có request gọi `/auth/refresh-token` thành công và không bị đá văng ra màn hình đăng nhập.
