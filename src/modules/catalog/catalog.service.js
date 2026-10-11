import mongoose from 'mongoose';
import Category from './models/Category';
import Product from './models/Product';
import InventoryItem from '../inventory/models/InventoryItem';
import { attachOutOfStockFlag } from './stockAvailability.service';
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
  return {
    id: (vObj._id || vObj.id).toString(),
    sku: vObj.sku,
    label: vObj.label,
    price: parseInt(vObj.price, 10),
    status: vObj.status || 'ACTIVE'
  };
};

const formatProduct = (prod) => {
  if (!prod) return null;
  const obj = typeof prod.toObject === 'function' ? prod.toObject() : { ...prod };
  return {
    id: (obj._id || obj.id).toString(),
    name: obj.name,
    description: obj.description || '',
    categoryId: (obj.categoryId ? (obj.categoryId._id || obj.categoryId) : '').toString(),
    origin: obj.origin || null,
    expiryInfo: obj.expiryInfo || null,
    images: Array.isArray(obj.images) ? obj.images : [],
    variants: Array.isArray(obj.variants) ? obj.variants.map(formatProductVariant) : [],
    status: obj.status || 'ACTIVE',
    outOfStock: Boolean(obj.outOfStock)
  };
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
    return { items: [], nextCursor: null };
  }
  const {
    q,
    categoryId,
    status,
    minPrice,
    maxPrice,
    inStockOnly,
    sort = 'NEWEST',
    limit = 20,
    cursor
  } = params;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const query = {};

  // Phân quyền: public/CUSTOMER chỉ thấy ACTIVE
  const isInternal = actor && ['ADMIN', 'MANAGER'].includes(actor.systemRole);
  if (!isInternal) {
    query.status = 'ACTIVE';
  } else if (status) {
    query.status = status;
  }

  if (categoryId) {
    if (mongoose.isValidObjectId(categoryId)) {
      query.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
  }

  if (q) {
    query.$text = { $search: q.trim() };
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

  // Gắn cờ outOfStock tính từ InventoryStock
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

  return { items, nextCursor };
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
  if (!isInternal && product.status !== 'ACTIVE') {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');
  }

  const enriched = await attachOutOfStockFlag(product);
  return formatProduct(enriched);
};

export const createProduct = async (data, actor) => {
  const { name, description, categoryId, origin, expiryInfo, images, variants, status } = data;

  if (!name || !categoryId || !variants || !Array.isArray(variants) || variants.length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'name, categoryId and variants are required');
  }

  if (!mongoose.isValidObjectId(categoryId)) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Invalid categoryId');
  }

  const category = await Category.findById(categoryId);
  if (!category || category.status !== 'ACTIVE') {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Category does not exist or is inactive');
  }

  // Đăng ký InventoryItem cho từng variant
  const preparedVariants = [];
  for (const v of variants) {
    if (!v.sku || !v.label || v.price === undefined) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Variant must have sku, label and price');
    }

    const trimmedSku = v.sku.trim();
    // Tìm hoặc tạo InventoryItem loại PRODUCT
    let item = await InventoryItem.findOne({ sku: trimmedSku });
    if (!item) {
      item = new InventoryItem({
        sku: trimmedSku,
        name: `${name.trim()} - ${v.label.trim()}`,
        kind: 'PRODUCT',
        unit: 'cái',
        status: v.status || 'ACTIVE'
      });
      await item.save();
    }

    preparedVariants.push({
      _id: new mongoose.Types.ObjectId(),
      sku: trimmedSku,
      label: v.label.trim(),
      price: parseInt(v.price, 10),
      status: v.status || 'ACTIVE',
      inventoryItemId: item._id
    });
  }

  // Lưu Product master global (TUYỆT ĐỐI KHÔNG LƯU STOCK TRÊN PRODUCT)
  const product = new Product({
    name: name.trim(),
    description: description || '',
    categoryId,
    origin: origin || null,
    expiryInfo: expiryInfo || null,
    images: images || [],
    variants: preparedVariants,
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

  if (data.name) product.name = data.name.trim();
  if (data.description !== undefined) product.description = data.description;
  if (data.categoryId) {
    const category = await Category.findById(data.categoryId);
    if (!category) throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, 'Category not found');
    product.categoryId = data.categoryId;
  }
  if (data.origin !== undefined) product.origin = data.origin;
  if (data.expiryInfo !== undefined) product.expiryInfo = data.expiryInfo;
  if (data.images !== undefined) product.images = data.images;
  if (data.status) product.status = data.status;

  if (data.variants && Array.isArray(data.variants)) {
    const updatedVariants = [];
    for (const v of data.variants) {
      let item = await InventoryItem.findOne({ sku: v.sku.trim() });
      if (!item) {
        item = new InventoryItem({
          sku: v.sku.trim(),
          name: `${product.name} - ${v.label.trim()}`,
          kind: 'PRODUCT',
          unit: 'cái',
          status: v.status || 'ACTIVE'
        });
        await item.save();
      }

      updatedVariants.push({
        _id: v.id ? new mongoose.Types.ObjectId(v.id) : new mongoose.Types.ObjectId(),
        sku: v.sku.trim(),
        label: v.label.trim(),
        price: parseInt(v.price, 10),
        status: v.status || 'ACTIVE',
        inventoryItemId: item._id
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
  await product.save();
  return getProductById(product._id, actor);
};

// ================= VARIANT OPERATIONS =================

export const addVariant = async (productId, data, actor) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');

  const { sku, label, price, status } = data;
  const trimmedSku = sku.trim();

  let item = await InventoryItem.findOne({ sku: trimmedSku });
  if (!item) {
    item = new InventoryItem({
      sku: trimmedSku,
      name: `${product.name} - ${label.trim()}`,
      kind: 'PRODUCT',
      unit: 'cái',
      status: status || 'ACTIVE'
    });
    await item.save();
  }

  product.variants.push({
    _id: new mongoose.Types.ObjectId(),
    sku: trimmedSku,
    label: label.trim(),
    price: parseInt(price, 10),
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

  if (data.sku) variant.sku = data.sku.trim();
  if (data.label) variant.label = data.label.trim();
  if (data.price !== undefined) variant.price = parseInt(data.price, 10);
  if (data.status) variant.status = data.status;

  await product.save();
  return getProductById(productId, actor);
};

export const deactivateVariant = async (productId, variantId, actor) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Product not found');

  const variant = product.variants.id(variantId);
  if (!variant) throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Variant not found');

  variant.status = 'INACTIVE';
  await product.save();
  return getProductById(productId, actor);
};
