import mongoose from 'mongoose';
import Category from './models/Category';
import Product from './models/Product';
import Order from '../order/models/Order';
import InventoryItem from '../inventory/models/InventoryItem';
import { attachOutOfStockFlag } from './stockAvailability.service';
import { generateProductCode, formatVariantSku, calculateFinalPrice } from './skuGenerator.service';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

// Helper: chuyển chuỗi thành slug
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Helper: mã hóa / giải mã cursor
const encodeCursor = (id) => Buffer.from(id.toString()).toString('base64');
const decodeCursor = (cursor) => {
  try {
    return Buffer.from(cursor, 'base64').toString('ascii');
  } catch (e) {
    return null;
  }
};

// Helper: định dạng đối tượng theo chuẩn OpenAPI v7 (loại bỏ timestamps và fields thừa)
const formatCategory = (cat) => {
  if (!cat) return null;
  const obj = typeof cat.toObject === 'function' ? cat.toObject() : { ...cat };
  return {
    id: (obj._id || obj.id).toString(),
    name: obj.name,
    slug: obj.slug,
    parentId: obj.parentId ? obj.parentId.toString() : null,
    status: obj.status || 'ACTIVE'
  };
};

const formatProductVariant = (v) => {
  if (!v) return null;
  const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v };
  const basePrice = parseInt(vObj.price, 10) || 0;
  const discountPercent = Number(vObj.discountPercent) || 0;
  const finalPrice = vObj.finalPrice !== undefined && vObj.finalPrice !== null
    ? parseInt(vObj.finalPrice, 10)
    : calculateFinalPrice(basePrice, discountPercent);

  const formatted = {
    id: (vObj._id || vObj.id).toString(),
    sku: vObj.sku,
    label: vObj.label,
    price: basePrice,
    discountPercent,
    finalPrice,
    image: vObj.image || null,
    status: vObj.status || 'ACTIVE'
  };

  if (vObj.availableStock !== undefined) {
    formatted.availableStock = vObj.availableStock;
  }
  return formatted;
};

const formatProduct = (prod) => {
  if (!prod) return null;
  const obj = typeof prod.toObject === 'function' ? prod.toObject() : { ...prod };
  const formatted = {
    id: (obj._id || obj.id).toString(),
    productCode: obj.productCode || null,
    name: obj.name,
    description: obj.description || '',
    categoryId: (obj.categoryId ? (obj.categoryId._id || obj.categoryId) : '').toString(),
    origin: obj.origin || null,
    expiryInfo: obj.expiryInfo || null,
    images: Array.isArray(obj.images) ? obj.images : [],
    productType: obj.productType || 'SIMPLE',
    usageType: obj.usageType || 'SALE',
    variants: Array.isArray(obj.variants) ? obj.variants.map(formatProductVariant) : [],
    status: obj.status || 'ACTIVE',
    outOfStock: Boolean(obj.outOfStock)
  };

  if (obj.totalStock !== undefined) {
    formatted.totalStock = obj.totalStock;
  }
  if (obj.archivedAt) {
    formatted.archivedAt = obj.archivedAt instanceof Date ? obj.archivedAt.toISOString() : obj.archivedAt;
  }
  return formatted;
};

// ================= CATEGORY SERVICE =================

export const listCategories = async (params, actor) => {
  if (mongoose.connection.readyState !== 1) {
    return { items: [], nextCursor: null };
  }
  const { parentId, q, status, limit = 20, cursor } = params;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const query = {};

  // Phân quyền: public và CUSTOMER chỉ xem được ACTIVE
  const isInternal = actor && ['ADMIN', 'MANAGER'].includes(actor.systemRole);
  if (!isInternal) {
    query.status = 'ACTIVE';
  } else if (status) {
    query.status = status;
  }

  if (parentId !== undefined) {
    query.parentId = parentId === 'null' || parentId === '' ? null : parentId;
  }

  if (q) {
    query.name = { $regex: q.trim(), $options: 'i' };
  }

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    if (decodedId && mongoose.isValidObjectId(decodedId)) {
      query._id = { $gt: new mongoose.Types.ObjectId(decodedId) };
    }
  }

  const items = await Category.find(query)
    .sort({ _id: 1 })
    .limit(parsedLimit + 1);

  let nextCursor = null;
  if (items.length > parsedLimit) {
    const nextItem = items.pop();
    nextCursor = encodeCursor(items[items.length - 1]._id);
  }

  const formattedItems = items.map(formatCategory);

  return { items: formattedItems, nextCursor };
};

export const createCategory = async (data, actor) => {
  let { name, slug, parentId, status } = data;
  if (!name) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Name is required');
  }

  slug = slug ? slugify(slug) : slugify(name);
  if (!slug) slug = 'cat-' + Date.now();

  const existing = await Category.findOne({ slug });
  if (existing) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `Category slug "${slug}" already exists`);
  }

  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) {
      throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Parent category not found');
    }
  }

  const category = new Category({
    name: name.trim(),
    slug,
    parentId: parentId || null,
    status: status || 'ACTIVE'
  });

  await category.save();

  return formatCategory(category);
};

export const getCategoryById = async (id, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  const isInternal = actor && ['ADMIN', 'MANAGER'].includes(actor.systemRole);
  if (!isInternal && category.status !== 'ACTIVE') {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  return formatCategory(category);
};

export const updateCategory = async (id, data, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  if (data.name) category.name = data.name.trim();
  if (data.slug) {
    const newSlug = slugify(data.slug);
    if (newSlug !== category.slug) {
      const existing = await Category.findOne({ slug: newSlug, _id: { $ne: id } });
      if (existing) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `Slug "${newSlug}" already exists`);
      }
      category.slug = newSlug;
    }
  }
  if (data.parentId !== undefined) {
    category.parentId = data.parentId || null;
  }
  if (data.status) {
    category.status = data.status;
  }

  await category.save();

  return formatCategory(category);
};

export const archiveCategory = async (id, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Category not found');
  }

  category.status = 'INACTIVE';
  await category.save();

  return formatCategory(category);
};

// ================= PRODUCT SERVICE =================

export const listProducts = async (params, actor) => {
  if (mongoose.connection.readyState !== 1) {
    return { items: [], totalItems: 0, nextCursor: null };
  }
  const {
    q,
    categoryId,
    status,
    usageType,
    createdWithinDays,
    minPrice,
    maxPrice,
    inStockOnly,
    sort = 'NEWEST',
    limit = 20,
    cursor
  } = params;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const query = {};

  // Phân quyền: public/CUSTOMER chỉ thấy ACTIVE và usageType in ['SALE', 'SHARED']
  const isInternal = actor && ['ADMIN', 'MANAGER'].includes(actor.systemRole);
  if (!isInternal) {
    query.status = 'ACTIVE';
    query.usageType = { $in: ['SALE', 'SHARED'] };
  } else {
    if (status) query.status = status;
    if (usageType) query.usageType = usageType;
  }

  // Filter categoryId (hỗ trợ nhiều category ngăn cách bằng dấu phẩy)
  if (categoryId) {
    const rawIds = categoryId.split(',').map((id) => id.trim()).filter((id) => mongoose.isValidObjectId(id));
    if (rawIds.length === 1) {
      query.categoryId = new mongoose.Types.ObjectId(rawIds[0]);
    } else if (rawIds.length > 1) {
      query.categoryId = { $in: rawIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
  }

  // Filter createdWithinDays (ví dụ 7, 30, 90 ngày)
  if (createdWithinDays) {
    const days = parseInt(createdWithinDays, 10);
    if (!isNaN(days) && days > 0) {
      const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: pastDate };
    }
  }

  // Search q (hỗ trợ name, productCode, variants.sku, description)
  if (q && q.trim()) {
    const trimmed = q.trim();
    query.$or = [
      { name: { $regex: trimmed, $options: 'i' } },
      { productCode: { $regex: trimmed, $options: 'i' } },
      { 'variants.sku': { $regex: trimmed, $options: 'i' } },
      { description: { $regex: trimmed, $options: 'i' } }
    ];
  }

  // Price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter = {};
    if (minPrice !== undefined) priceFilter.$gte = parseInt(minPrice, 10);
    if (maxPrice !== undefined) priceFilter.$lte = parseInt(maxPrice, 10);
    query['variants.price'] = priceFilter;
  }

  // Sắp xếp
  let sortCriteria = { _id: -1 };
  if (sort === 'NEWEST') sortCriteria = { createdAt: -1, _id: -1 };
  else if (sort === 'NAME_ASC') sortCriteria = { name: 1, _id: 1 };
  else if (sort === 'NAME_DESC') sortCriteria = { name: -1, _id: -1 };
  else if (sort === 'PRICE_ASC') sortCriteria = { 'variants.price': 1, _id: 1 };
  else if (sort === 'PRICE_DESC') sortCriteria = { 'variants.price': -1, _id: -1 };

  // Tổng số bản ghi thỏa mãn điều kiện
  const totalItems = await Product.countDocuments(query);

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    if (decodedId && mongoose.isValidObjectId(decodedId)) {
      query._id = { $lt: new mongoose.Types.ObjectId(decodedId) };
    }
  }

  // Fetch thêm 1 bản ghi để tính nextCursor
  let products = await Product.find(query)
    .sort(sortCriteria)
    .limit(parsedLimit + 1);

  // Gắn cờ outOfStock & tồn kho tính từ InventoryStock
  let enriched = await attachOutOfStockFlag(products);

  // Nếu người dùng chọn inStockOnly -> loại bỏ các item outOfStock
  const filterInStock = inStockOnly === true || inStockOnly === 'true';
  if (filterInStock) {
    enriched = enriched.filter((p) => !p.outOfStock);
  }

  let nextCursor = null;
  if (enriched.length > parsedLimit) {
    enriched.pop();
    const lastItem = enriched[enriched.length - 1];
    nextCursor = encodeCursor(lastItem.id || lastItem._id);
  }

  // Chuẩn hóa response theo contract OpenAPI v7 (ProductPage)
  const items = enriched.map(formatProduct);

  return { items, totalItems, nextCursor };
};

export const getProductById = async (id, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const isInternal = actor && ['ADMIN', 'MANAGER'].includes(actor.systemRole);
  if (!isInternal && (product.status !== 'ACTIVE' || product.usageType === 'SERVICE_SUPPLY')) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const enriched = await attachOutOfStockFlag(product);
  return formatProduct(enriched);
};

export const createProduct = async (data, actor) => {
  const {
    name,
    description,
    categoryId,
    productType = 'SIMPLE',
    usageType = 'SALE',
    origin,
    expiryInfo,
    images,
    variants,
    status
  } = data;

  if (!name || !categoryId || !variants || !Array.isArray(variants) || variants.length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'name, categoryId and variants are required');
  }

  if (productType === 'SIMPLE' && variants.length > 1) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Sản phẩm đơn giản (SIMPLE) chỉ được có tối đa 1 biến thể');
  }

  if (!mongoose.isValidObjectId(categoryId)) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Invalid categoryId');
  }

  const category = await Category.findById(categoryId);
  if (!category || category.status !== 'ACTIVE') {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Category does not exist or is inactive');
  }

  // Tự sinh productCode nếu FE không gửi
  let productCode = data.productCode ? data.productCode.trim() : '';
  if (!productCode) {
    productCode = await generateProductCode();
  } else {
    const existingCode = await Product.findOne({ productCode });
    if (existingCode) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `Mã sản phẩm "${productCode}" đã tồn tại`);
    }
  }

  // Đăng ký InventoryItem và xử lý SKU cho từng variant
  const preparedVariants = [];
  const skuSet = new Set();
  let nextSkuSeq = 1;

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (v.price === undefined || isNaN(parseInt(v.price, 10))) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Variant must have a valid price');
    }

    const price = parseInt(v.price, 10);
    const discountPercent = Number(v.discountPercent) || 0;
    const finalPrice = calculateFinalPrice(price, discountPercent);
    const label = v.label ? v.label.trim() : (productType === 'SIMPLE' ? 'Mặc định' : `Biến thể ${i + 1}`);

    // Tự sinh SKU nếu không có (theo chuẩn SKU-01: SP-000123-001)
    let trimmedSku = v.sku ? v.sku.trim() : '';
    if (!trimmedSku) {
      trimmedSku = formatVariantSku(productCode, nextSkuSeq);
      nextSkuSeq++;
    } else {
      nextSkuSeq++;
    }

    if (skuSet.has(trimmedSku)) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `SKU "${trimmedSku}" bị trùng lặp giữa các biến thể của sản phẩm`);
    }
    skuSet.add(trimmedSku);

    // Kiểm tra SKU đã tồn tại ở sản phẩm khác chưa
    const existingProductWithSku = await Product.findOne({ 'variants.sku': trimmedSku });
    if (existingProductWithSku) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `SKU "${trimmedSku}" đã tồn tại ở sản phẩm "${existingProductWithSku.name}"`);
    }

    // Tìm hoặc tạo InventoryItem loại PRODUCT
    let item = await InventoryItem.findOne({ sku: trimmedSku });
    if (!item) {
      item = new InventoryItem({
        sku: trimmedSku,
        name: `${name.trim()} - ${label}`,
        kind: 'PRODUCT',
        unit: 'cái',
        status: v.status || 'ACTIVE'
      });
      await item.save();
    }

    preparedVariants.push({
      _id: new mongoose.Types.ObjectId(),
      sku: trimmedSku,
      label,
      price,
      discountPercent,
      finalPrice,
      image: v.image || null,
      status: v.status || 'ACTIVE',
      inventoryItemId: item._id
    });
  }

  // Lưu Product master global (TUYỆT ĐỐI KHÔNG LƯU STOCK TRÊN PRODUCT)
  const product = new Product({
    productCode,
    name: name.trim(),
    description: description || '',
    categoryId,
    productType,
    usageType,
    origin: origin || null,
    expiryInfo: expiryInfo || null,
    images: images || [],
    variants: preparedVariants,
    nextSkuSeq,
    status: status || 'ACTIVE'
  });

  await product.save();

  const enriched = await attachOutOfStockFlag(product);
  return formatProduct(enriched);
};

export const updateProduct = async (id, data, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  // Ràng buộc bất biến: Không cho phép đổi productType sau khi đã tạo
  if (data.productType && data.productType !== product.productType) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Không thể chuyển đổi loại sản phẩm (productType) sau khi đã tạo');
  }

  if (data.name) product.name = data.name.trim();
  if (data.description !== undefined) product.description = data.description;
  if (data.categoryId) {
    const category = await Category.findById(data.categoryId);
    if (!category) throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Category not found');
    product.categoryId = data.categoryId;
  }
  if (data.usageType) product.usageType = data.usageType;
  if (data.origin !== undefined) product.origin = data.origin;
  if (data.expiryInfo !== undefined) product.expiryInfo = data.expiryInfo;
  if (data.images !== undefined) product.images = data.images;
  if (data.status) product.status = data.status;

  if (data.variants && Array.isArray(data.variants)) {
    if (product.productType === 'SIMPLE' && data.variants.length > 1) {
      throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Sản phẩm đơn giản (SIMPLE) chỉ được có tối đa 1 biến thể');
    }

    const updatedVariants = [];
    const skuSet = new Set();

    for (const v of data.variants) {
      const vId = v.id || v._id;
      let existingVariant = vId ? product.variants.id(vId) : null;

      // Rule SKU-05: Không cho phép sửa SKU của variant đã tạo
      if (existingVariant && v.sku && v.sku.trim() !== existingVariant.sku) {
        throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, `Không được phép chỉnh sửa mã SKU của biến thể "${existingVariant.sku}" đã tạo`);
      }

      let trimmedSku = v.sku ? v.sku.trim() : (existingVariant ? existingVariant.sku : '');
      if (!trimmedSku) {
        trimmedSku = formatVariantSku(product.productCode, product.nextSkuSeq || 1);
        product.nextSkuSeq = (product.nextSkuSeq || 1) + 1;
      }

      if (skuSet.has(trimmedSku)) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `SKU "${trimmedSku}" bị trùng lặp giữa các biến thể của sản phẩm`);
      }
      skuSet.add(trimmedSku);

      const existingProduct = await Product.findOne({ 'variants.sku': trimmedSku, _id: { $ne: id } });
      if (existingProduct) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `SKU "${trimmedSku}" đã tồn tại ở sản phẩm "${existingProduct.name}"`);
      }

      let item = await InventoryItem.findOne({ sku: trimmedSku });
      if (!item) {
        item = new InventoryItem({
          sku: trimmedSku,
          name: `${product.name} - ${(v.label || 'Mặc định').trim()}`,
          kind: 'PRODUCT',
          unit: 'cái',
          status: v.status || 'ACTIVE'
        });
        await item.save();
      }

      const price = v.price !== undefined ? parseInt(v.price, 10) : (existingVariant ? existingVariant.price : 0);
      const discountPercent = v.discountPercent !== undefined ? Number(v.discountPercent) : (existingVariant ? existingVariant.discountPercent : 0);
      const finalPrice = calculateFinalPrice(price, discountPercent);

      updatedVariants.push({
        _id: vId ? new mongoose.Types.ObjectId(vId) : new mongoose.Types.ObjectId(),
        sku: trimmedSku,
        label: (v.label || (existingVariant ? existingVariant.label : 'Mặc định')).trim(),
        price,
        discountPercent,
        finalPrice,
        image: v.image !== undefined ? v.image : (existingVariant ? existingVariant.image : null),
        status: v.status || (existingVariant ? existingVariant.status : 'ACTIVE'),
        inventoryItemId: item._id,
        deactivatedAt: existingVariant ? existingVariant.deactivatedAt : null
      });
    }
    product.variants = updatedVariants;
  }

  await product.save();
  return getProductById(product._id, actor);
};

export const archiveProduct = async (id, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  product.status = 'ARCHIVED';
  product.archivedAt = new Date();
  await product.save();
  return getProductById(product._id, actor);
};

export const restoreProduct = async (id, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  if (product.status !== 'ARCHIVED') {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Chỉ có thể khôi phục sản phẩm đang ở trạng thái ARCHIVED');
  }

  product.status = 'INACTIVE';
  product.archivedAt = null;
  await product.save();
  return getProductById(product._id, actor);
};

// ================= VARIANT OPERATIONS =================

export const addVariant = async (productId, data, actor) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');

  if (product.productType === 'SIMPLE') {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Không thể thêm biến thể cho sản phẩm đơn giản (SIMPLE). Hãy tạo sản phẩm loại VARIANT');
  }

  const { label, price, discountPercent = 0, image, status } = data;
  if (price === undefined || isNaN(parseInt(price, 10))) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Price is required');
  }

  const parsedPrice = parseInt(price, 10);
  const parsedDiscount = Number(discountPercent) || 0;
  const finalPrice = calculateFinalPrice(parsedPrice, parsedDiscount);

  // Sinh SKU tự động nếu không gửi (Rule SKU-01)
  let trimmedSku = data.sku ? data.sku.trim() : '';
  if (!trimmedSku) {
    trimmedSku = formatVariantSku(product.productCode, product.nextSkuSeq || 1);
    product.nextSkuSeq = (product.nextSkuSeq || 1) + 1;
  } else {
    product.nextSkuSeq = (product.nextSkuSeq || 1) + 1;
  }

  // Check if SKU already exists in this product or another product
  const existingProduct = await Product.findOne({ 'variants.sku': trimmedSku });
  if (existingProduct) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `SKU "${trimmedSku}" đã tồn tại ở sản phẩm "${existingProduct.name}"`);
  }

  let item = await InventoryItem.findOne({ sku: trimmedSku });
  if (!item) {
    item = new InventoryItem({
      sku: trimmedSku,
      name: `${product.name} - ${(label || 'Biến thể').trim()}`,
      kind: 'PRODUCT',
      unit: 'cái',
      status: status || 'ACTIVE'
    });
    await item.save();
  }

  product.variants.push({
    _id: new mongoose.Types.ObjectId(),
    sku: trimmedSku,
    label: (label || `Biến thể ${product.variants.length + 1}`).trim(),
    price: parsedPrice,
    discountPercent: parsedDiscount,
    finalPrice,
    image: image || null,
    status: status || 'ACTIVE',
    inventoryItemId: item._id
  });

  await product.save();
  return getProductById(productId, actor);
};

export const updateVariant = async (productId, variantId, data, actor) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');

  const variant = product.variants.id(variantId);
  if (!variant) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Variant not found');

  // Rule SKU-05: Bất biến SKU
  if (data.sku && data.sku.trim() !== variant.sku) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, `Không được phép chỉnh sửa mã SKU của biến thể "${variant.sku}" đã tạo`);
  }

  if (data.label) variant.label = data.label.trim();
  if (data.price !== undefined) variant.price = parseInt(data.price, 10);
  if (data.discountPercent !== undefined) variant.discountPercent = Number(data.discountPercent) || 0;
  variant.finalPrice = calculateFinalPrice(variant.price, variant.discountPercent);

  if (data.image !== undefined) variant.image = data.image;
  if (data.status) variant.status = data.status;

  await product.save();
  return getProductById(productId, actor);
};

export const deactivateVariant = async (productId, variantId, actor) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');

  const variant = product.variants.id(variantId);
  if (!variant) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Variant not found');

  // Chặn nếu có Order đang xử lý liên quan đến biến thể đó (Task 6.1)
  const activeOrder = await Order.findOne({
    'items.variantId': new mongoose.Types.ObjectId(variantId),
    status: { $in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] }
  });
  if (activeOrder) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, `Không thể vô hiệu hóa biến thể vì đang có đơn hàng "${activeOrder.code}" trong quá trình xử lý`);
  }

  variant.status = 'INACTIVE';
  variant.deactivatedAt = new Date();
  await product.save();
  return getProductById(productId, actor);
};

export const activateVariant = async (productId, variantId, actor) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');

  const variant = product.variants.id(variantId);
  if (!variant) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Variant not found');

  variant.status = 'ACTIVE';
  variant.deactivatedAt = null;
  await product.save();
  return getProductById(productId, actor);
};
