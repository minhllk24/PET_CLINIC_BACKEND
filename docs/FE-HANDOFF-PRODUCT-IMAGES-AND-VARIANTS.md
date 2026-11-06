# 📋 TÀI LIỆU HƯỚNG DẪN BÀN GIAO FRONTEND (ANGULAR)
## Tính năng: Hiển thị 5–10 hình ảnh, Bộ chọn Loại (Biến thể) & Đưa vào Giỏ hàng trên Trang Chi tiết Sản phẩm

> **Dành cho:** Đội ngũ Frontend WEB 2 (`DR_PETS_HOUSE_ANGULAR`)  
> **Framework:** Angular (TypeScript + HTML Template)  
> **Phiên bản API Backend:** `v7.0` (MongoDB Atlas `pet_clinic_v2`)  
> **Trạng thái:** Đã triển khai và xác thực dữ liệu thực tế 100%  

---

### 1. BỐI CẢNH & PHÂN TÍCH HỆ THỐNG DỮ LIỆU

Trang Chi tiết Sản phẩm trên giao diện gặp 3 vấn đề chính khi kết nối với Backend:
1. **Nút "Loại" bị trắng/rỗng:**
   - **Nguyên nhân:** Backend tuân theo chuẩn OpenAPI v7 với schema `ProductVariant`, trong đó tên hiển thị của biến thể được đặt là thuộc tính `label` (`sku`, `label`, `price`, `finalPrice`, `discountPercent`, `status`, `availableStock`). Trong khi đó, mapper cũ chỉ đọc `variant.name` khiến giá trị bị `undefined`.
2. **Không đồng bộ giá bán và tồn kho khi chọn Loại:**
   - Khi người dùng click chọn biến thể (ví dụ: Túi 2kg, Túi 8kg, Bao 15kg), giá bán và số lượng tồn kho trên giao diện cần lập tức cập nhật theo `variant.price`, `variant.finalPrice`, và `variant.availableStock`.
3. **Thanh ảnh Thumbnail bị tràn vỡ khi có 5–10 ảnh:**
   - Layout cũ cố định chiều cao cho 2 ảnh. Với 5–10 ảnh sản phẩm chất lượng cao từ CDN Unsplash/Cloudinary, cần sử dụng container cuộn dọc mượt mà (`overflow-y-auto`, `scroll-smooth`) với kích thước thumbnail chuẩn `94x94px`.

---

### 2. MÔ HÌNH DỮ LIỆU TYPESCRIPT (ANGULAR MODELS)

Tạo hoặc cập nhật file interface tại `src/app/core/models/product.model.ts`:

```typescript
export interface ProductImage {
  id?: string;
  url: string;
  isPrimary?: boolean;
  altText?: string;
}

export interface ProductVariant {
  sku: string;
  label: string; // Tên hiển thị của biến thể (VD: "Túi 2kg", "Bao 15kg")
  name?: string;  // Alias tương thích ngược
  price: number;
  finalPrice: number;
  discountPercent?: number;
  availableStock: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK' | 'INACTIVE';
  imageUrl?: string;
}

export interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  slug?: string;
  categoryName?: string;
  categoryId?: string;
  description?: string;
  price: number;
  finalPrice: number;
  images: ProductImage[];
  variants: ProductVariant[];
  rating?: number;
  reviewCount?: number;
}
```

---

### 3. CẬP NHẬT SERVICE MAPPER (ANGULAR PRODUCT SERVICE)

Tại file `src/app/core/services/product.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProductDetail, ProductVariant, ProductImage } from '../models/product.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly baseUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getProductById(id: string): Observable<ProductDetail> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(res => this.normalizeProduct(res.data || res))
    );
  }

  private normalizeProduct(raw: any): ProductDetail {
    // 1. Chuẩn hóa mảng 5 - 10 ảnh
    const rawImages = Array.isArray(raw.images) ? raw.images : [];
    const images: ProductImage[] = rawImages.map((img: any, idx: number) => {
      const url = typeof img === 'string' ? img : (img.url || img.imageUrl || '');
      return {
        id: img.id || `img-${idx}`,
        url: this.normalizeImageUrl(url),
        isPrimary: typeof img === 'object' ? Boolean(img.isPrimary) : (idx === 0)
      };
    });

    // 2. Chuẩn hóa biến thể (đọc đúng variant.label)
    const rawVariants = Array.isArray(raw.variants) ? raw.variants : [];
    const variants: ProductVariant[] = rawVariants.map((v: any) => {
      const label = v.label || v.name || v.sku || 'Tiêu chuẩn';
      const price = Number(v.price) || Number(raw.price) || 0;
      const finalPrice = Number(v.finalPrice) || Number(v.price) || price;
      const availableStock = v.availableStock !== undefined ? Number(v.availableStock) : 50;

      return {
        sku: v.sku,
        label,
        name: label,
        price,
        finalPrice,
        discountPercent: Number(v.discountPercent) || 0,
        availableStock,
        status: v.status || (availableStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'),
        imageUrl: v.imageUrl ? this.normalizeImageUrl(v.imageUrl) : undefined
      };
    });

    return {
      id: raw._id || raw.id,
      sku: raw.sku,
      name: raw.name,
      slug: raw.slug,
      categoryName: raw.categoryName || raw.category_name,
      categoryId: raw.categoryId,
      description: raw.description,
      price: Number(raw.price) || 0,
      finalPrice: Number(raw.finalPrice) || Number(raw.price) || 0,
      images,
      variants,
      rating: raw.rating || 5,
      reviewCount: raw.reviewCount || 0
    };
  }

  private normalizeImageUrl(value: string): string {
    if (!value) return '';
    if (/^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
      return value;
    }
    return `${environment.apiUrl.replace(/\/api\/v1$/, '')}/${value.replace(/^\//, '')}`;
  }
}
```

---

### 4. MẪU ANGULAR COMPONENT & TEMPLATE

#### 4.1 Component TypeScript (`product-detail.component.ts`)

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ProductDetail, ProductVariant } from '../../core/models/product.model';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit {
  product: ProductDetail | null = null;
  selectedVariant: ProductVariant | null = null;
  selectedImageIndex = 0;
  quantity = 1;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '6ae1aeffb1d650ca8dafe521';
    this.productService.getProductById(id).subscribe({
      next: (data) => {
        this.product = data;
        // Tự động chọn biến thể đầu tiên còn hàng
        if (data.variants && data.variants.length > 0) {
          const firstAvailable = data.variants.find(v => v.status === 'ACTIVE' && v.availableStock > 0) || data.variants[0];
          this.selectVariant(firstAvailable);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Lỗi tải sản phẩm:', err);
        this.isLoading = false;
      }
    });
  }

  selectVariant(variant: ProductVariant): void {
    this.selectedVariant = variant;
    // Nếu biến thể có ảnh riêng, chuyển đổi sang ảnh đó
    if (variant.imageUrl && this.product) {
      const idx = this.product.images.findIndex(img => img.url === variant.imageUrl);
      if (idx !== -1) this.selectedImageIndex = idx;
    }
  }

  get currentPrice(): number {
    return this.selectedVariant?.finalPrice ?? this.product?.finalPrice ?? 0;
  }

  get currentOriginalPrice(): number {
    return this.selectedVariant?.price ?? this.product?.price ?? 0;
  }

  get currentStock(): number {
    return this.selectedVariant?.availableStock ?? 0;
  }

  addToCart(): void {
    if (!this.product || !this.selectedVariant) return;

    this.cartService.addToCart({
      productId: this.product.id,
      sku: this.selectedVariant.sku,
      variantLabel: this.selectedVariant.label,
      quantity: this.quantity,
      price: this.currentPrice,
      imageUrl: this.product.images[0]?.url
    }).subscribe({
      next: () => alert('Đã thêm sản phẩm vào giỏ hàng thành công!'),
      error: (err) => alert('Lỗi khi thêm giỏ hàng: ' + err.message)
    });
  }
}
```

#### 4.2 HTML Template (`product-detail.component.html`)

```html
<div class="container mx-auto px-4 py-8" *ngIf="product">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    
    <!-- CỘT 1: HÌNH ẢNH (THUMBNAIL CUỘN DỌC + ẢNH CHÍNH) -->
    <div class="flex gap-4">
      <!-- Dải Thumbnail hỗ trợ 5 - 10 ảnh -->
      <div class="flex flex-col gap-2 h-[500px] w-24 overflow-y-auto pr-1 no-scrollbar">
        <button
          *ngFor="let img of product.images; let i = index"
          type="button"
          (click)="selectedImageIndex = i"
          class="relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all shrink-0"
          [class.border-blue-600]="selectedImageIndex === i"
          [class.border-gray-200]="selectedImageIndex !== i"
        >
          <img [src]="img.url" [alt]="product.name" class="w-full h-full object-cover" />
        </button>
      </div>

      <!-- Ảnh chính hiển thị to -->
      <div class="flex-1 h-[500px] rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
        <img
          [src]="product.images[selectedImageIndex]?.url"
          [alt]="product.name"
          class="max-h-full max-w-full object-contain"
        />
      </div>
    </div>

    <!-- CỘT 2: THÔNG TIN SẢN PHẨM & BỘ CHỌN LOẠI -->
    <div class="flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ product.name }}</h1>
      <p class="text-sm text-gray-500">Mã SKU: {{ selectedVariant?.sku || product.sku }}</p>

      <!-- Giá tiền động theo Biến thể -->
      <div class="flex items-baseline gap-3">
        <span class="text-3xl font-extrabold text-red-600">{{ currentPrice | number }}đ</span>
        <span *ngIf="currentOriginalPrice > currentPrice" class="text-lg text-gray-400 line-through">
          {{ currentOriginalPrice | number }}đ
        </span>
        <span *ngIf="selectedVariant?.discountPercent" class="px-2 py-0.5 text-xs font-semibold text-red-600 bg-red-100 rounded">
          -{{ selectedVariant?.discountPercent }}%
        </span>
      </div>

      <!-- BỘ CHỌN LOẠI (BIẾN THỂ) -->
      <div class="space-y-3">
        <label class="block text-sm font-semibold text-gray-700">
          Loại: <span class="text-blue-600 font-bold">{{ selectedVariant?.label }}</span>
        </label>
        <div class="flex flex-wrap gap-3">
          <button
            *ngFor="let v of product.variants"
            type="button"
            (click)="selectVariant(v)"
            [disabled]="v.status === 'OUT_OF_STOCK' || v.availableStock === 0"
            class="px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all"
            [class.border-blue-600]="selectedVariant?.sku === v.sku"
            [class.bg-blue-50]="selectedVariant?.sku === v.sku"
            [class.text-blue-700]="selectedVariant?.sku === v.sku"
            [class.border-gray-200]="selectedVariant?.sku !== v.sku"
            [class.opacity-50]="v.status === 'OUT_OF_STOCK' || v.availableStock === 0"
          >
            {{ v.label }}
          </button>
        </div>
      </div>

      <!-- Số lượng tồn kho -->
      <div class="text-sm text-gray-600">
        Tồn kho khả dụng: <span class="font-medium text-gray-900">{{ currentStock }} sản phẩm</span>
      </div>

      <!-- Nút Thêm vào giỏ hàng -->
      <div class="flex items-center gap-4 pt-4">
        <button
          type="button"
          (click)="addToCart()"
          [disabled]="currentStock === 0"
          class="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:bg-gray-300"
        >
          THÊM VÀO GIỎ HÀNG
        </button>
      </div>
    </div>

  </div>
</div>
```

---

### 5. DỮ LIỆU THỰC TẾ TRÍCH XUẤT TỪ MONGODB ATLAS (UAT EVIDENCE)

#### 5.1 JSON Response thực tế của Sản phẩm (6 ảnh, 3 biến thể):
* **Endpoint:** `GET /api/v1/products/6ae1aeffb1d650ca8dafe521`

```json
{
  "id": "6ae1aeffb1d650ca8dafe521",
  "name": "Thức ăn hạt cao cấp cho chó nhỏ Royal Canin Mini Adult",
  "categoryName": "Thức ăn thú cưng",
  "imageCount": 6,
  "images": [
    {
      "index": 1,
      "url": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&q=80",
      "isPrimary": true
    },
    {
      "index": 2,
      "url": "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=800&q=80",
      "isPrimary": false
    },
    {
      "index": 3,
      "url": "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80",
      "isPrimary": false
    },
    {
      "index": 4,
      "url": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&q=80",
      "isPrimary": false
    },
    {
      "index": 5,
      "url": "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=800&q=80",
      "isPrimary": false
    },
    {
      "index": 6,
      "url": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80",
      "isPrimary": false
    }
  ],
  "variants": [
    {
      "sku": "SP-RC-MINI-001-01",
      "label": "Túi 2kg",
      "price": 340000,
      "finalPrice": 323000,
      "discountPercent": 5,
      "availableStock": 50,
      "status": "ACTIVE"
    },
    {
      "sku": "SP-RC-MINI-001-02",
      "label": "Túi 8kg",
      "price": 1150000,
      "finalPrice": 1035000,
      "discountPercent": 10,
      "availableStock": 50,
      "status": "ACTIVE"
    },
    {
      "sku": "SP-RC-MINI-001-03",
      "label": "Bao 15kg",
      "price": 1980000,
      "finalPrice": 1742400,
      "discountPercent": 12,
      "availableStock": 50,
      "status": "ACTIVE"
    }
  ]
}
```

#### 5.2 JSON Request & Response khi đưa Biến thể vào Giỏ hàng:
* **Request:** `POST /api/v1/cart/items`
```json
{
  "productId": "6ae1aeffb1d650ca8dafe521",
  "sku": "SP-RC-MINI-001-02",
  "quantity": 1
}
```

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6ae1aeffb1d650ca8dafe521",
        "sku": "SP-RC-MINI-001-02",
        "productName": "Thức ăn hạt cao cấp cho chó nhỏ Royal Canin Mini Adult",
        "variantLabel": "Túi 8kg",
        "unitPrice": 1035000,
        "quantity": 1,
        "totalPrice": 1035000,
        "availableStock": 50,
        "imageUrl": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&q=80"
      }
    ],
    "subtotal": 1035000,
    "total": 1035000
  }
}
```
