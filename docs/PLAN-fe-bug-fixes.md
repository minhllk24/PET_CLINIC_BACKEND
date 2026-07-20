# Kế hoạch sửa lỗi Frontend (Bug Fixes)

## 1. Lỗi hiển thị biến thể sản phẩm (Kích cỡ/Loại không có)

**Biểu hiện:** Ở trang "Đơn hàng của tôi", phần thông tin sản phẩm hiển thị `Loại: Không có  Kích cỡ: Không có`.

**Nguyên nhân:** Database schema không tách biệt trường `type` và `size`. Thay vào đó, toàn bộ chuỗi mô tả biến thể (ví dụ: "500ml - Lớn") được lưu trong trường `variant_name` của object `ProductVariant`. Hiện tại Frontend đang đọc sai thuộc tính (`item.variant?.type` và `item.variant?.size`).

**Giải pháp thực hiện:**
- Cập nhật component hiển thị chi tiết sản phẩm trong đơn hàng.
- Thay vì lấy `item.variant?.type` và `item.variant?.size`, hãy đọc trực tiếp `item.variant?.variant_name`.
- Ví dụ thay đổi mã:
  ```jsx
  // Code cũ
  <p>Loại: {item.variant?.type || 'Không có'} Kích cỡ: {item.variant?.size || 'Không có'}</p>
  
  // Code mới
  <p>Biến thể: {item.variant?.variant_name || 'Không có'}</p>
  ```

## 2. Lỗi tự động Logout (Auto-logout) sau 15 phút

**Biểu hiện:** Người dùng cứ dùng được khoảng 15 phút là bị đẩy ra ngoài, yêu cầu đăng nhập lại, cho dù có tick "Ghi nhớ đăng nhập" hay không.

**Nguyên nhân:**
- Access Token (JWT) được thiết lập thời gian sống (TTL) là 15 phút để đảm bảo bảo mật.
- Khi Access Token hết hạn, các API yêu cầu xác thực sẽ trả về mã lỗi `401 Unauthorized`.
- Backend đã cung cấp sẵn API `POST /api/v1/refresh` để xin lại Access Token mới (thông qua Refresh Token được lưu an toàn trong httpOnly cookie). Tuy nhiên, phía Frontend chưa có cơ chế tự động gọi API này khi nhận lỗi 401.

**Giải pháp thực hiện:**
- Triển khai **Axios Interceptor** (hoặc cấu hình Fetch tương đương).
- Khi có bất kỳ API call nào nhận về status `401`, interceptor sẽ tạm giữ (pause) request đang bị lỗi.
- Tự động gọi API `POST /api/v1/refresh` (bắt buộc truyền `{ withCredentials: true }` để gửi kèm cookie chứa refresh_token).
- Nếu refresh thành công, lấy Access Token mới thay vào header (nếu Frontend quản lý token qua memory/state) và retry (thực hiện lại) request ban đầu.
- Nếu refresh thất bại (ví dụ Refresh Token cũng đã hết hạn do lâu không sử dụng), tiến hành xóa dữ liệu user trong state/store và điều hướng người dùng về trang Đăng nhập.
- **Mã tham khảo (Dùng Axios):**
  ```javascript
  import axios from 'axios';
  
  const apiClient = axios.create({
      baseURL: '/api/v1',
      withCredentials: true // Quan trọng để gửi và nhận cookie
  });
  
  apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
          const originalRequest = error.config;
          
          // Tránh lặp vô hạn nếu API refresh cũng trả về 401
          if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/refresh') {
              originalRequest._retry = true;
              
              try {
                  // Gọi API refresh token
                  await axios.post('/api/v1/refresh', {}, { withCredentials: true });
                  
                  // Nếu lấy token thành công, thực hiện lại request ban đầu
                  return apiClient(originalRequest);
              } catch (refreshError) {
                  // Refresh token cũng đã hết hạn hoặc lỗi
                  // Thực hiện logic logout (clear Redux/Zustand store, redirect to /login)
                  window.location.href = '/login';
                  return Promise.reject(refreshError);
              }
          }
          return Promise.reject(error);
      }
  );
  
  export default apiClient;
  ```

## 3. Lỗi Đơn hàng hiển thị 0đ (Thông tin thêm)

**Thông tin:** Lỗi thanh toán dẫn đến đơn hàng rỗng và tổng tiền 0đ **đã được team Backend khắc phục**. Team Frontend không cần thay đổi gì thêm đối với chức năng Checkout, chỉ cần kiểm tra lại để đảm bảo hoạt động trơn tru cùng với hiển thị biến thể.

---

## Checklist Nghiệm thu (Verification)

- [ ] **Test Hiển thị:** Đặt thử 1 đơn hàng có biến thể (ví dụ thức ăn hạt có khối lượng khác nhau). Kiểm tra hiển thị ở Lịch sử đơn hàng hiện đúng tên biến thể thay vì "Không có".
- [ ] **Test Auto-Refresh:** Đăng nhập thành công, mở Network tab trong DevTools. Để máy rảnh (idle) khoảng 16 phút. Sau đó thực hiện 1 thao tác gọi API (chuyển trang, tải lại danh sách). Đảm bảo xuất hiện request gọi tới `/refresh` thành công và request gốc tự động retry thành công, không bị văng ra màn hình Login.
- [ ] **Test Logout hết hạn:** Đăng nhập thành công không tích "Nhớ đăng nhập", tắt trình duyệt đi mở lại, phải yêu cầu đăng nhập lại (Backend đã cấu hình Session Cookie cho trường hợp này).
