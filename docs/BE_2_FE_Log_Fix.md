# BẢNG BÀN GIAO & GIẢI QUYẾT TOÀN DIỆN TỪ BACKEND CHO FRONTEND
## (BE_2_FE_LOG_FIX — TASK 3.6: PRODUCT & CATEGORY MANAGEMENT)

> **Người gửi:** Backend Team  
> **Người nhận:** Frontend Team (Angular Admin & Angular Customer)  
> **Tài liệu đối chiếu:** `docs/FE _ Log.md` & Thiết kế Figma Task 3.6  
> **Trạng thái:** ✅ **100% Hoàn thành & Đã kiểm thử tự động (96/96 tests PASS)**  
> **Nhánh Git:** `feat/foundation-v6` | **Commit:** `ff2d8a6`  
> **OpenAPI Contract:** `docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml` & `docs/07-openapi-v6.yaml`  

---

## MỤC LỤC
1. [Tổng quan & Cam kết](#i-tổng-quan--cam-kết)
2. [Bảng đối chiếu Hiện trạng: Trước vs Sau khi sửa đổi (Before vs After)](#ii-bảng-đối-chiếu-hiện-trạng-trước-vs-sau-khi-sửa-đổi)
3. [Hướng dẫn tích hợp Chi tiết: Cloudinary & Quản lý Ảnh (ĐẶC BIỆT QUAN TRỌNG)](#iii-hướng-dẫn-tích-hợp-chi-tiết-cloudinary--quản-lý-ảnh)
4. [Hướng dẫn kết nối các tính năng Nghiệp vụ chính](#iv-hướng-dẫn-kết-nối-các-tính-năng-nghiệp-vụ-chính)
5. [Bảng tra cứu Mã lỗi RFC 9457 & Khuyến nghị xử lý ở UI Frontend](#v-bảng-tra-cứu-mã-lỗi-rfc-9457--khuyến-nghị-xử-lý-ở-ui)
6. [Đoạn mã mẫu Angular Service (TypeScript)](#vi-đoạn-mã-mẫu-angular-service-typescript)

---

## I. TỔNG QUAN & CAM KẾT

Backend Team đã đọc kỹ toàn bộ nội dung tổng hợp từ tài liệu `docs/FE _ Log.md`, tiến hành rà soát từng màn hình theo Figma và triển khai toàn bộ các tính năng từ **Ưu tiên P0 đến P1**.

### 3 Cam kết cốt lõi từ Backend:
1. **Không còn dữ liệu Mock:** Toàn bộ API Product, Category, Variant, Stock và Upload đều đã đọc/ghi cơ sở dữ liệu thật và lưu trữ ảnh vĩnh viễn trên Cloudinary CDN (kể cả khi restart server hoặc redeploy Render).
2. **Không bắt FE tính toán hay map ID thủ công:** Backend tự động populate `categoryName`, tự động tính toán dải giá (`minPrice`, `maxPrice`, `minFinalPrice`, `maxFinalPrice`), tự động tính `finalPrice` từ khuyến mại, và tự động sinh mã sản phẩm (`SP-xxxxxx`) & SKU biến thể.
3. **Bảo toàn dữ liệu tuyệt đối:** Bất biến SKU đã tạo, khóa chuyển đổi `productType`, bảo vệ đơn hàng đang xử lý (không cho phép xóa/ngừng bán sản phẩm/biến thể nếu đang có đơn hàng chưa hoàn tất).

---

## II. BẢNG ĐỐI CHIẾU HIỆN TRẠNG (BEFORE VS AFTER)

| STT | Tính năng / Yêu cầu từ FE (`FE _ Log.md`) | Trước khi sửa (Before) | Sau khi hoàn thiện (After) | Contract / Endpoint áp dụng |
|:---:|:---|:---|:---|:---|
| **1** | **Tự động sinh mã sản phẩm & SKU** (Quy tắc SKU-01 -> SKU-09) | FE phải tự đặt hoặc gửi SKU giả lập; dễ trùng lặp hoặc mất tính nhất quán. | BE tự động sinh `productCode` dạng `SP-000123` và SKU từng biến thể `SP-000123-001`, `002`... Khóa cứng bất biến, cấm sửa SKU cũ (trả lỗi `422`). | `POST /api/v1/products`<br>`POST /api/v1/products/:id/variants` |
| **2** | **Upload ảnh lên Cloudinary & Lưu trữ vĩnh viễn** | Chưa có API upload ảnh thật, ảnh mất sau reload trang hoặc deploy lại. | Đã tích hợp Cloudinary SDK hoàn chỉnh ở Server. Hỗ trợ upload multipart tối đa 10 ảnh (JPG/PNG/WEBP, ≤ 5MB), trả về link CDN `https://res.cloudinary.com/...` tồn tại vĩnh viễn. | `POST /api/v1/uploads/products` |
| **3** | **API Xóa ảnh sản phẩm** | Chưa có API xóa ảnh khi user bấm nút "X" trên form. | Đã bổ sung endpoint xóa ảnh trực tiếp trên Cloudinary (và dọn dẹp file local nếu có). Hỗ trợ truyền `imageId` dạng wildcard path param. | `DELETE /api/v1/uploads/products/:imageId` |
| **4** | **Ảnh riêng cho từng biến thể** (`variant.image`) | Schema chưa lưu trường ảnh riêng cho từng variant. | Mọi biến thể đều hỗ trợ trường `image` (URL chuỗi). Khi update giá/tên không bao giờ bị mất ảnh biến thể đã lưu. | `variants[i].image` trong Product API |
| **5** | **`productType` (SIMPLE / VARIANT)** | Chưa có ràng buộc, dễ nhầm lẫn giữa sản phẩm đơn và nhiều biến thể. | `productType` được lưu tường minh. **Bất biến sau khi tạo:** Cố ý sửa `productType` ở màn chỉnh sửa sẽ bị BE từ chối ngay với mã `422`. | `productType: 'SIMPLE' \| 'VARIANT'` |
| **6** | **`usageType` (SALE / SHARED / SERVICE_SUPPLY)** | Chưa có bộ lọc và quy tắc phân quyền hiển thị theo đối tượng. | Quản lý ở Product Master. Phía Customer Site **tuyệt đối không bao giờ thấy** sản phẩm loại `SERVICE_SUPPLY`. Admin lọc được theo `usageType`. | `GET /api/v1/products?usageType=SALE` |
| **7** | **Khuyến mại & Tính giá tự động (`finalPrice`)** | FE phải tự tính giá giảm, dễ lệch số làm tròn giữa FE và BE. | BE tính toán chuẩn xác và trả về trường `finalPrice = Math.round(price * (100 - discountPercent) / 100)`. Validate `discountPercent` từ `0` đến `100`. | `variants[i].finalPrice` |
| **8** | **Tên danh mục (`categoryName`)** | FE nhận về mỗi `categoryId`, phải query bảng Category để map thủ công tên. | BE tự động `.populate()` và trả về trường `categoryName` ở cấp root của sản phẩm (ví dụ: `"categoryName": "Thức ăn cho mèo"`). | `categoryName: string` trong Product response |
| **9** | **Thông tin Dải giá cấp Sản phẩm (Pricing Summary)** | Màn danh sách/thẻ sản phẩm FE phải duyệt mảng `variants` để tìm min/max. | BE trả sẵn dải giá ở cấp Product: `minPrice`, `maxPrice`, `minFinalPrice`, `maxFinalPrice`. Với sản phẩm `SIMPLE`: trả thêm `price` và `finalPrice`. | `Product.minPrice`, `Product.maxPrice`... |
| **10** | **Chống trùng lặp nhãn biến thể (`label`)** | Có thể tạo 2 biến thể cùng tên nhãn gây nhầm lẫn khi bán hàng. | BE kiểm tra không phân biệt hoa thường và khoảng trắng (`"Size M"` vs `"  size m "`). Nếu trùng, chặn ngay và trả mã lỗi `422`. | `422 VALIDATION_ERROR` |
| **11** | **Bảo vệ Lưu trữ Sản phẩm (`archiveProduct`)** | Sản phẩm đang có đơn hàng xử lý vẫn có thể bị lưu trữ gây đứt gãy giao dịch. | BE kiểm tra bảng `Order`. Nếu có đơn hàng ở trạng thái `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, BE từ chối lưu trữ và trả mã lỗi `422`. | `POST /api/v1/products/:id/archive` |
| **12** | **Khôi phục Sản phẩm (`restoreProduct`)** | Chưa có endpoint chuẩn, hoặc khôi phục tự động bật bán `ACTIVE`. | Cung cấp endpoint riêng `POST /products/:id/restore`. Sản phẩm sau khi khôi phục luôn ở trạng thái an toàn `INACTIVE` để Admin duyệt trước khi mở bán. | `POST /api/v1/products/:id/restore` |
| **13** | **Phân trang & Đếm tổng bản ghi** | Màn danh sách thiếu `totalItems` khiến việc phân trang ở FE gặp khó khăn. | Trả đầy đủ `totalItems`, `totalPages`, `page`, `limit` (hỗ trợ cả phân trang trang 1, 2, 3... lẫn phân trang cursor `nextCursor`). | `GET /api/v1/products` |

---

## III. HƯỚNG DẪN TÍCH HỢP CHI TIẾT: CLOUDINARY & QUẢN LÝ ẢNH

> ⚠️ **LƯU Ý QUAN TRỌNG:** Phía Angular Frontend **KHÔNG CẦN** cài đặt Cloudinary SDK và **KHÔNG CẦN** giữ Cloudinary API Key / Secret. Toàn bộ xác thực bảo mật Cloudinary do Backend xử lý 100%.

```
┌─────────────────┐               ┌─────────────────┐               ┌─────────────────┐
│ Angular Admin   │ ──(1) Upload ──►│ Backend API     │ ──(2) Stream ──►│ Cloudinary CDN  │
│ File Input / UI │ ◄──(4) URLs ───│ (auth & resize) │ ◄──(3) Result ──│ (Secure Storage)│
└─────────────────┘               └─────────────────┘               └─────────────────┘
        │                                 │
        └──────────(5) Save Product───────┘
```

### 1. Upload ảnh sản phẩm (`POST /api/v1/uploads/products`)
- **URL:** `POST https://pet-clinic-backend-93b5.onrender.com/api/v1/uploads/products` (hoặc `http://localhost:8080/api/v1/uploads/products` khi dev local)
- **Headers:**
  - `Authorization: Bearer <ADMIN_OR_MANAGER_ACCESS_TOKEN>`
  - `Content-Type: multipart/form-data` (trên Angular HttpClient, khi bạn truyền `FormData`, Angular sẽ tự động set header này kèm `boundary`, **không cần set thủ công**).
- **Body Form-Data:**
  - Key name là: `files` (có thể append 1 file hoặc lặp `formData.append('files', file)` tối đa 10 file).
- **Quy chuẩn file:** Định dạng JPG, PNG, WEBP; dung lượng tối đa 5MB/file.
- **Response trả về (HTTP 201 Created):**
```json
{
  "items": [
    {
      "id": "pet_clinic/products/1791960666137_sp_poodle",
      "url": "https://res.cloudinary.com/dpvhnmz3y/image/upload/v1791960667/pet_clinic/products/1791960666137_sp_poodle.png",
      "size": 245100,
      "mimeType": "image/png",
      "originalName": "poodle_fit.png",
      "isPrimary": true,
      "sortOrder": 0
    },
    {
      "id": "pet_clinic/products/1791960668412_sp_poodle_back",
      "url": "https://res.cloudinary.com/dpvhnmz3y/image/upload/v1791960669/pet_clinic/products/1791960668412_sp_poodle_back.png",
      "size": 182300,
      "mimeType": "image/png",
      "originalName": "poodle_back.png",
      "isPrimary": false,
      "sortOrder": 1
    }
  ],
  "total": 2
}
```

### 2. Cách lưu ảnh vào Product sau khi upload thành công
Khi gọi `POST /api/v1/products` (hoặc `PATCH /api/v1/products/:id`):
- Mảng `images` của Product: Bạn truyền thẳng mảng objects nhận được từ API upload (hoặc nếu người dùng đổi ảnh chính thì set lại `isPrimary: true` cho đúng 1 ảnh):
```json
{
  "name": "Thức ăn Royal Canin Poodle Adult",
  "categoryId": "651f1f77bcf86cd799439001",
  "productType": "VARIANT",
  "usageType": "SALE",
  "images": [
    {
      "id": "pet_clinic/products/1791960666137_sp_poodle",
      "url": "https://res.cloudinary.com/.../sp_poodle.png",
      "isPrimary": true,
      "sortOrder": 0
    },
    {
      "id": "pet_clinic/products/1791960668412_sp_poodle_back",
      "url": "https://res.cloudinary.com/.../sp_poodle_back.png",
      "isPrimary": false,
      "sortOrder": 1
    }
  ],
  "variants": [
    {
      "label": "Túi 500g",
      "price": 120000,
      "discountPercent": 10,
      "image": "https://res.cloudinary.com/.../sp_poodle.png"
    }
  ]
}
```
*(Ghi chú: Backend vẫn tương thích ngược 100% nếu FE chỉ gửi mảng chuỗi `images: ["https://res.cloudinary.com/..."]`, BE sẽ tự động bọc thành object chuẩn).*

### 3. Xóa ảnh sản phẩm khỏi Cloudinary (`DELETE /api/v1/uploads/products/:imageId`)
Khi người dùng bấm nút xóa icon thùng rác / dấu "X" trên một bức ảnh trong giao diện:
- **URL:** `DELETE /api/v1/uploads/products/:imageId`
- **Ví dụ gọi thực tế:**
  - `DELETE /api/v1/uploads/products/pet_clinic/products/1791960666137_sp_poodle`
  - Hoặc encode: `DELETE /api/v1/uploads/products/pet_clinic%2Fproducts%2F1791960666137_sp_poodle`
- **Headers:** `Authorization: Bearer <ADMIN_OR_MANAGER_ACCESS_TOKEN>`
- **Response trả về (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Ảnh đã được xóa thành công",
  "id": "pet_clinic/products/1791960666137_sp_poodle"
}
```

---

## IV. HƯỚNG DẪN KẾT NỐI CÁC TÍNH NĂNG NGHIỆP VỤ CHÍNH

### 1. Màn hình Tạo mới Sản phẩm (`POST /api/v1/products`)
- **Headers:** `Authorization: Bearer <TOKEN>`, `Idempotency-Key: <UUID>` (Khuyến nghị FE tạo UUID v4 để chống bấm đúp chuột tạo trùng).
- **Quy tắc FE cần nhớ:**
  1. **Không gửi trường `sku` và `productCode`**: Backend tự động sinh `productCode: "SP-000123"` và SKU từng biến thể `SP-000123-001`. Ở giao diện form, FE chỉ cần hiển thị text: *"Tự động tạo khi lưu"*.
  2. **Trường `label` của biến thể:** Không được để 2 biến thể có cùng label (ví dụ không cho phép cả 2 dòng đều là "Size M").
  3. **Trường `price`:** Phải là số nguyên > 0.
  4. **Trường `discountPercent`:** Từ 0 đến 100.
  5. **Loại sản phẩm (`productType`):** Chọn `'SIMPLE'` hoặc `'VARIANT'`. Lưu ý sản phẩm `SIMPLE` chỉ được có duy nhất 1 phần tử trong mảng `variants`.

### 2. Màn hình Chỉnh sửa Sản phẩm (`PATCH /api/v1/products/:id`)
- **Quy tắc FE cần nhớ:**
  1. **Khóa trường `productType`:** Không cho phép user chuyển từ `SIMPLE` sang `VARIANT` hoặc ngược lại.
  2. **Khóa trường `sku` của các variant đã có sẵn:** Các biến thể đã có SKU không được phép sửa SKU. Admin chỉ được sửa `label`, `price`, `discountPercent`, `image`.
  3. Nếu Admin bấm thêm biến thể mới trên màn chỉnh sửa, gọi API: `POST /api/v1/products/:id/variants` (chỉ cần gửi `label`, `price`, `discountPercent`, `image`; Backend tự động cấp SKU tiếp theo ví dụ `SP-000123-003`).

### 3. Vô hiệu hóa biến thể (`POST /api/v1/products/:id/variants/:variantId/deactivate`)
- Dùng cho nút **"Ngưng kinh doanh"** biến thể.
- **Xử lý phản hồi từ BE:**
  - Nếu thành công (200 OK): Cập nhật trạng thái biến thể thành `INACTIVE`.
  - Nếu biến thể đang nằm trong một đơn hàng đang xử lý: BE trả mã **`422 Unprocessable Entity`** kèm thông báo cụ thể:
    `detail: "Không thể vô hiệu hóa biến thể vì đang có đơn hàng \"ORD-000456\" trong quá trình xử lý"`.
    -> FE hiển thị Toast/Popup cảnh báo nguyên văn câu `detail` này để Admin hiểu rõ lý do.

### 4. Lưu trữ & Khôi phục Sản phẩm
- **Lưu trữ sản phẩm:** `POST /api/v1/products/:id/archive`
  - Nếu sản phẩm đang có đơn hàng active, BE trả mã `422`:
    `detail: "Không thể lưu trữ sản phẩm vì đang có đơn hàng \"ORD-000456\" trong quá trình xử lý"`.
- **Khôi phục sản phẩm:** `POST /api/v1/products/:id/restore`
  - Chuyển `status` từ `ARCHIVED` về `INACTIVE`. Admin sẽ vào xem lại thông tin sản phẩm và chủ động chuyển sang `ACTIVE` khi sẵn sàng mở bán.

### 5. Danh sách & Bộ lọc Sản phẩm (`GET /api/v1/products`)
- Các query params hỗ trợ đầy đủ:
  - `page`: Trang hiện tại (1, 2, 3...)
  - `limit`: Số bản ghi mỗi trang (mặc định 20, tối đa 100)
  - `status`: `ACTIVE` | `INACTIVE` | `ARCHIVED`
  - `usageType`: `SALE` | `SHARED` | `SERVICE_SUPPLY`
  - `categoryId`: Lọc theo 1 hoặc nhiều ID danh mục (ví dụ: `?categoryId=id1,id2`)
  - `createdWithinDays`: `7` | `30` | `90`
  - `minPrice` & `maxPrice`: Khoảng giá lọc
  - `q`: Tìm kiếm mở rộng theo Tên sản phẩm, Mã sản phẩm (`SP-xxxxxx`) và SKU biến thể.
- **Cấu trúc Response trả về:**
```json
{
  "items": [
    {
      "id": "670cfa54bcf86cd799439123",
      "productCode": "SP-000001",
      "name": "Thức ăn hạt Royal Canin Fit 32",
      "categoryId": "651f1f77bcf86cd799439001",
      "categoryName": "Thức ăn cho mèo",
      "productType": "VARIANT",
      "usageType": "SALE",
      "status": "ACTIVE",
      "minPrice": 95000,
      "maxPrice": 380000,
      "minFinalPrice": 85500,
      "maxFinalPrice": 380000,
      "totalStock": 45,
      "outOfStock": false,
      "variants": [ ... ],
      "images": [ ... ]
    }
  ],
  "total": 42,
  "totalItems": 42,
  "totalPages": 3,
  "page": 1,
  "limit": 20
}
```

---

## V. BẢNG TRA CỨU MÃ LỖI RFC 9457 & KHUYẾN NGHỊ XỬ LÝ Ở UI

Backend tuân thủ chuẩn **RFC 9457 (Problem Details for HTTP APIs)** với Content-Type `application/problem+json`. Mọi response lỗi đều có dạng:

```json
{
  "type": "https://httpstatuses.com/422",
  "title": "Unprocessable Entity",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "Tên phân loại biến thể \"Túi 500g\" bị trùng lặp trong cùng một sản phẩm",
  "correlationId": "f873e12c-39bf-4313-a306-c183cd1543fd"
}
```

| HTTP Status | Code | Tình huống xảy ra | Hành vi khuyến nghị trên UI Frontend |
|:---:|:---|:---|:---|
| **400** | `VALIDATION_ERROR` | Thiếu trường bắt buộc (`name`, `categoryId`, `price` ≤ 0) hoặc upload sai định dạng file | Hiển thị thông báo đỏ ngay dưới trường nhập liệu tương ứng |
| **401** | `AUTHENTICATION_ERROR` | Token hết hạn hoặc chưa đăng nhập | Đăng xuất và điều hướng user về trang Login |
| **403** | `AUTHORIZATION_ERROR` | User không có quyền ADMIN / MANAGER | Hiển thị thông báo cấm truy cập hoặc ẩn các nút thao tác nhạy cảm |
| **404** | `NOT_FOUND` | Không tìm thấy Sản phẩm, Danh mục hoặc Ảnh | Thông báo "Dữ liệu không tồn tại hoặc đã bị xóa", chuyển hướng về danh sách |
| **409** | `CONFLICT` | Trùng mã sản phẩm hoặc trùng SKU biến thể | Đánh dấu đỏ trường Mã sản phẩm / SKU kèm nội dung cảnh báo |
| **422** | `VALIDATION_ERROR` | 1. Cố ý sửa `productType`<br>2. Cố ý sửa `sku` variant cũ<br>3. Trùng nhãn biến thể `label` trong cùng sản phẩm<br>4. Ngưng bán variant hoặc Lưu trữ sản phẩm khi đang có đơn hàng xử lý | Hiển thị Toast thông báo lỗi hoặc Modal cảnh báo với nội dung lấy từ `error.detail` |

---

## VI. ĐOẠN MÃ MẪU ANGULAR SERVICE (TYPESCRIPT)

Dưới đây là đoạn mã Angular mẫu hoàn chỉnh để team FE có thể copy và tích hợp ngay:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadImageItem {
  id: string;          // Ví dụ: 'pet_clinic/products/1791960666137_sp_test'
  url: string;         // Link Cloudinary CDN
  size: number;
  mimeType: string;
  originalName: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface UploadResponse {
  items: UploadImageItem[];
  total: number;
}

export interface DeleteImageResponse {
  success: boolean;
  message: string;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly baseUrl = 'https://pet-clinic-backend-93b5.onrender.com/api/v1';

  constructor(private http: HttpClient) {}

  /**
   * 1. Upload ảnh sản phẩm lên Cloudinary qua Backend
   * @param files Danh sách các file ảnh chọn từ input file (tối đa 10 ảnh)
   */
  uploadProductImages(files: File[]): Observable<UploadResponse> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    // Angular HttpClient tự động thiết lập Content-Type kèm multipart boundary
    return this.http.post<UploadResponse>(`${this.baseUrl}/uploads/products`, formData);
  }

  /**
   * 2. Xóa ảnh sản phẩm khỏi Cloudinary
   * @param imageId id của bức ảnh nhận được từ upload (ví dụ: 'pet_clinic/products/1791960666137_sp_test')
   */
  deleteProductImage(imageId: string): Observable<DeleteImageResponse> {
    const encodedId = encodeURIComponent(imageId);
    return this.http.delete<DeleteImageResponse>(`${this.baseUrl}/uploads/products/${encodedId}`);
  }

  /**
   * 3. Lấy danh sách sản phẩm với đầy đủ bộ lọc
   */
  getProducts(params: {
    page?: number;
    limit?: number;
    status?: string;
    usageType?: string;
    categoryId?: string;
    q?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if ((params as any)[key] !== undefined && (params as any)[key] !== null) {
        httpParams = httpParams.set(key, (params as any)[key]);
      }
    });
    return this.http.get<any>(`${this.baseUrl}/products`, { params: httpParams });
  }

  /**
   * 4. Tạo sản phẩm mới (tự động sinh mã SP & SKU)
   */
  createProduct(payload: any, idempotencyKey: string): Observable<any> {
    const headers = new HttpHeaders({
      'Idempotency-Key': idempotencyKey
    });
    return this.http.post<any>(`${this.baseUrl}/products`, payload, { headers });
  }

  /**
   * 5. Lưu trữ sản phẩm (có kiểm tra đơn hàng active)
   */
  archiveProduct(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/products/${id}/archive`, {});
  }

  /**
   * 6. Khôi phục sản phẩm đã lưu trữ về INACTIVE
   */
  restoreProduct(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/products/${id}/restore`, {});
  }
}
```

---

## VII. TỔNG KẾT & KÊNH HỖ TRỢ

Toàn bộ mã nguồn đã được merge vào nhánh **`feat/foundation-v6`** (commit `ff2d8a6`) và đã pass toàn bộ các suite tests.

Team Backend sẵn sàng hỗ trợ trực tiếp trong quá trình FE Angular tích hợp. Nếu có bất kỳ câu hỏi nào trong lúc test thực tế trên UI, các bạn hãy thông báo ngay để Backend cùng hỗ trợ xử lý! 🚀
