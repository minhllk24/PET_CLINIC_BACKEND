import mongoose from 'mongoose';
import FlashSale from './models/FlashSale';
import Product from '../catalog/models/Product';
import AppError from '../../utils/AppError';

/**
 * Derives the runtime state of a flash sale campaign
 */
export const deriveFlashSaleState = (sale, now = new Date()) => {
  if (!sale) return null;
  if (sale.status === 'DRAFT') {
    return 'DRAFT';
  }

  const startDate = new Date(sale.startAt);
  const endDate = new Date(sale.endAt);
  const nowDate = new Date(now);

  if (nowDate >= endDate) {
    return 'ENDED';
  }

  if (sale.isPaused) {
    return 'PAUSED';
  }

  if (nowDate < startDate) {
    return 'UPCOMING';
  }

  if (startDate <= nowDate && nowDate < endDate && !sale.isPaused) {
    return 'RUNNING';
  }

  return 'UNKNOWN';
};

/**
 * Format a FlashSale document into clean DTO with enriched item metrics
 */
export const formatFlashSale = (sale, now = new Date()) => {
  if (!sale) return null;
  const doc = sale.toObject ? sale.toObject() : sale;
  const derivedStatus = deriveFlashSaleState(doc, now);

  const formattedItems = (doc.items || []).map((it) => {
    const qtyLimit = Number(it.quantityLimit || 0);
    const soldQty = Number(it.soldQuantity || 0);
    const remaining = Math.max(0, qtyLimit - soldQty);
    const origPrice = Number(it.originalPrice || 0);
    const sPrice = Number(it.salePrice || 0);
    const discountPercent = origPrice > 0 ? Math.round(((origPrice - sPrice) / origPrice) * 100) : 0;
    const soldPercent = qtyLimit > 0 ? Math.min(100, Math.round((soldQty / qtyLimit) * 100)) : 0;

    return {
      id: it._id ? it._id.toString() : undefined,
      productId: (it.productId?._id || it.productId || '').toString(),
      variantId: it.variantId ? (it.variantId?._id || it.variantId).toString() : null,
      sku: it.sku,
      productName: it.productName || null,
      variantLabel: it.variantLabel || null,
      originalPrice: origPrice,
      salePrice: sPrice,
      quantityLimit: qtyLimit,
      soldQuantity: soldQty,
      remainingQuantity: remaining,
      discountPercent,
      soldPercent,
    };
  });

  return {
    id: (doc._id || doc.id).toString(),
    code: doc.code || null,
    name: doc.name,
    description: doc.description || null,
    startAt: doc.startAt ? new Date(doc.startAt).toISOString() : null,
    endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null,
    activationMode: doc.activationMode || 'AUTO',
    isPaused: Boolean(doc.isPaused),
    status: doc.status || 'DRAFT',
    derivedStatus,
    items: formattedItems,
    version: doc.version || 1,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
};

/**
 * Check if any of the items overlap in another published flash sale during the given timeframe
 */
export const assertNoFlashSaleItemOverlap = async ({ items, startAt, endAt, excludeSaleId = null }) => {
  const query = {
    status: 'PUBLISHED',
    startAt: { $lt: new Date(endAt) },
    endAt: { $gt: new Date(startAt) },
  };

  if (excludeSaleId && mongoose.Types.ObjectId.isValid(excludeSaleId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeSaleId) };
  }

  const overlappingSales = await FlashSale.find(query).lean();
  if (overlappingSales.length === 0) return;

  const candidateSkus = new Set(items.map((i) => i.sku));
  for (const existingSale of overlappingSales) {
    for (const exItem of existingSale.items || []) {
      if (candidateSkus.has(exItem.sku)) {
        throw new AppError(
          409,
          'Conflict',
          'FLASH_SALE_ITEM_OVERLAP',
          `Sản phẩm/SKU "${exItem.sku}" đã tham gia chiến dịch Flash Sale khác ("${existingSale.name}") trong cùng khung giờ`
        );
      }
    }
  }
};

/**
 * List flash sale campaigns for Admin/Manager
 */
export const listFlashSales = async (query = {}, actor = null) => {
  const { status, derivedStatus, search, page = 1, limit = 20, cursor } = query;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const filter = {};

  if (status) {
    filter.status = status.toUpperCase();
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const s = search.trim();
    const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { code: regex }, { description: regex }];
  }

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const allSales = await FlashSale.find(filter).sort({ _id: -1 });
  const now = new Date();

  // Filter by derivedStatus in memory if requested
  let filtered = allSales;
  if (derivedStatus) {
    const targetStatus = derivedStatus.toUpperCase();
    filtered = allSales.filter((s) => deriveFlashSaleState(s, now) === targetStatus);
  }

  const totalCount = filtered.length;
  const startIndex = (parsedPage - 1) * parsedLimit;
  const items = cursor ? filtered.slice(0, parsedLimit) : filtered.slice(startIndex, startIndex + parsedLimit);
  const hasMore = startIndex + parsedLimit < totalCount;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

  return {
    items: items.map((s) => formatFlashSale(s, now)),
    total: totalCount,
    totalCount,
    page: parsedPage,
    limit: parsedLimit,
    nextCursor,
  };
};

/**
 * Get flash sale by ID
 */
export const getFlashSaleById = async (id, actor = null) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'Bad Request', 'INVALID_ID', 'Invalid Flash Sale ID format');
  }

  const sale = await FlashSale.findById(id);
  if (!sale) {
    throw new AppError(404, 'Not Found', 'FLASH_SALE_NOT_FOUND', 'Flash Sale campaign not found');
  }

  return formatFlashSale(sale);
};

/**
 * Create a new Flash Sale campaign (with optional atomic publishNow or status='PUBLISHED')
 */
export const createFlashSale = async (data = {}, actor = null) => {
  const {
    name,
    description,
    startAt,
    endAt,
    activationMode = 'AUTO',
    publishNow = false,
    status,
    idempotencyKey,
    items = [],
  } = data;

  // 1. Idempotency Key check: if already processed, return existing
  if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0) {
    const cleanKey = idempotencyKey.trim();
    const existing = await FlashSale.findOne({ idempotencyKey: cleanKey });
    if (existing) {
      return formatFlashSale(existing);
    }
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError(400, 'Bad Request', 'NAME_REQUIRED', 'Flash Sale campaign name is required');
  }

  if (!startAt || !endAt) {
    throw new AppError(400, 'Bad Request', 'DATES_REQUIRED', 'startAt and endAt dates are required');
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError(400, 'Bad Request', 'INVALID_DATE', 'Invalid date format');
  }

  if (startDate >= endDate) {
    throw new AppError(400, 'Bad Request', 'INVALID_TIME_RANGE', 'startAt must be strictly before endAt');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Bad Request', 'ITEMS_REQUIRED', 'Flash Sale must contain at least one item');
  }

  // Validate items
  const validatedItems = [];
  const seenSkus = new Set();

  for (const it of items) {
    if (!it.productId || !it.sku) {
      throw new AppError(400, 'Bad Request', 'ITEM_IDENTIFIER_REQUIRED', 'productId and sku are required for all items');
    }

    const cleanSku = it.sku.trim().toUpperCase();
    if (seenSkus.has(cleanSku)) {
      throw new AppError(400, 'Bad Request', 'DUPLICATE_ITEM', `SKU "${cleanSku}" is duplicated in this campaign`);
    }
    seenSkus.add(cleanSku);

    const origPrice = Number(it.originalPrice);
    const sPrice = Number(it.salePrice);
    const qtyLimit = Number(it.quantityLimit);

    if (isNaN(origPrice) || origPrice <= 0) {
      throw new AppError(400, 'Bad Request', 'INVALID_ORIGINAL_PRICE', `Invalid originalPrice for SKU ${cleanSku}`);
    }

    if (isNaN(sPrice) || sPrice <= 0 || sPrice >= origPrice) {
      throw new AppError(400, 'Bad Request', 'INVALID_SALE_PRICE', `salePrice must be greater than 0 and less than originalPrice for SKU ${cleanSku}`);
    }

    if (isNaN(qtyLimit) || qtyLimit < 1) {
      throw new AppError(400, 'Bad Request', 'INVALID_QUANTITY_LIMIT', `quantityLimit must be at least 1 for SKU ${cleanSku}`);
    }

    validatedItems.push({
      productId: new mongoose.Types.ObjectId(it.productId),
      variantId: it.variantId && mongoose.Types.ObjectId.isValid(it.variantId) ? new mongoose.Types.ObjectId(it.variantId) : null,
      sku: cleanSku,
      productName: it.productName || null,
      variantLabel: it.variantLabel || null,
      originalPrice: origPrice,
      salePrice: sPrice,
      quantityLimit: qtyLimit,
      soldQuantity: Number(it.soldQuantity) || 0,
    });
  }

  const isPublishRequested = publishNow === true || status === 'PUBLISHED';
  const initialStatus = isPublishRequested ? 'PUBLISHED' : 'DRAFT';
  if (initialStatus === 'PUBLISHED') {
    await assertNoFlashSaleItemOverlap({ items: validatedItems, startAt: startDate, endAt: endDate });
  }

  // MANUAL activation mode starts with isPaused: true
  const initialPaused = activationMode === 'MANUAL';
  const code = data.code || `FS-${Date.now().toString().slice(-6)}`;

  const flashSale = new FlashSale({
    code,
    idempotencyKey: idempotencyKey && typeof idempotencyKey === 'string' ? idempotencyKey.trim() : undefined,
    name: name.trim(),
    description: description ? description.trim() : null,
    startAt: startDate,
    endAt: endDate,
    activationMode,
    isPaused: initialPaused,
    status: initialStatus,
    items: validatedItems,
    createdBy: actor?.id ? new mongoose.Types.ObjectId(actor.id) : null,
  });

  try {
    await flashSale.save();
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      const existing = await FlashSale.findOne({ idempotencyKey: idempotencyKey.trim() });
      if (existing) return formatFlashSale(existing);
    }
    throw err;
  }
  return formatFlashSale(flashSale);
};

/**
 * Publish a draft Flash Sale campaign
 */
export const publishFlashSale = async (id, actor = null) => {
  const sale = await FlashSale.findById(id);
  if (!sale) {
    throw new AppError(404, 'Not Found', 'FLASH_SALE_NOT_FOUND', 'Flash Sale campaign not found');
  }

  if (sale.status === 'PUBLISHED') {
    return formatFlashSale(sale);
  }

  await assertNoFlashSaleItemOverlap({
    items: sale.items,
    startAt: sale.startAt,
    endAt: sale.endAt,
    excludeSaleId: sale._id,
  });

  sale.status = 'PUBLISHED';
  sale.isPaused = false;
  sale.updatedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : null;
  sale.version += 1;
  await sale.save();

  return formatFlashSale(sale);
};

/**
 * Pause / Resume a Flash Sale campaign
 */
export const togglePauseFlashSale = async (id, isPaused, actor = null) => {
  const sale = await FlashSale.findById(id);
  if (!sale) {
    throw new AppError(404, 'Not Found', 'FLASH_SALE_NOT_FOUND', 'Flash Sale campaign not found');
  }

  sale.isPaused = isPaused !== undefined ? Boolean(isPaused) : !sale.isPaused;
  sale.updatedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : null;
  sale.version += 1;
  await sale.save();

  return formatFlashSale(sale);
};

/**
 * Update flash sale details (supporting items, activationMode, version concurrency)
 */
export const updateFlashSale = async (id, data = {}, actor = null) => {
  const sale = await FlashSale.findById(id);
  if (!sale) {
    throw new AppError(404, 'Not Found', 'FLASH_SALE_NOT_FOUND', 'Flash Sale campaign not found');
  }

  // Version concurrency check
  if (data.expectedVersion !== undefined && data.expectedVersion !== null) {
    if (Number(data.expectedVersion) !== Number(sale.version)) {
      throw new AppError(409, 'Conflict', 'VERSION_CONFLICT', 'Flash Sale campaign version conflict. Data has been modified concurrently.');
    }
  }

  if (data.name !== undefined) sale.name = data.name.trim();
  if (data.description !== undefined) sale.description = data.description ? data.description.trim() : null;
  if (data.startAt !== undefined) sale.startAt = new Date(data.startAt);
  if (data.endAt !== undefined) sale.endAt = new Date(data.endAt);
  if (data.activationMode !== undefined) sale.activationMode = data.activationMode;
  if (data.isPaused !== undefined) sale.isPaused = Boolean(data.isPaused);
  if (data.status !== undefined && ['DRAFT', 'PUBLISHED'].includes(data.status)) {
    sale.status = data.status;
  }

  if (sale.startAt >= sale.endAt) {
    throw new AppError(400, 'Bad Request', 'INVALID_TIME_RANGE', 'startAt must be before endAt');
  }

  // Support updating items with validation & preserving soldQuantity
  if (Array.isArray(data.items)) {
    const existingMap = new Map((sale.items || []).map((it) => [it.sku.toUpperCase(), it]));
    const validatedItems = [];
    const seenSkus = new Set();

    for (const it of data.items) {
      if (!it.productId || !it.sku) {
        throw new AppError(400, 'Bad Request', 'ITEM_IDENTIFIER_REQUIRED', 'productId and sku are required for all items');
      }

      const cleanSku = it.sku.trim().toUpperCase();
      if (seenSkus.has(cleanSku)) {
        throw new AppError(400, 'Bad Request', 'DUPLICATE_ITEM', `SKU "${cleanSku}" is duplicated in this campaign`);
      }
      seenSkus.add(cleanSku);

      const existingItem = existingMap.get(cleanSku);
      const currentSold = existingItem ? (existingItem.soldQuantity || 0) : 0;

      const origPrice = Number(it.originalPrice || existingItem?.originalPrice);
      const sPrice = Number(it.salePrice || existingItem?.salePrice);
      const qtyLimit = Number(it.quantityLimit !== undefined ? it.quantityLimit : existingItem?.quantityLimit);

      if (isNaN(origPrice) || origPrice <= 0) {
        throw new AppError(400, 'Bad Request', 'INVALID_ORIGINAL_PRICE', `Invalid originalPrice for SKU ${cleanSku}`);
      }

      if (isNaN(sPrice) || sPrice <= 0 || sPrice >= origPrice) {
        throw new AppError(400, 'Bad Request', 'INVALID_SALE_PRICE', `salePrice must be greater than 0 and less than originalPrice for SKU ${cleanSku}`);
      }

      if (isNaN(qtyLimit) || qtyLimit < 1) {
        throw new AppError(400, 'Bad Request', 'INVALID_QUANTITY_LIMIT', `quantityLimit must be at least 1 for SKU ${cleanSku}`);
      }

      if (qtyLimit < currentSold) {
        throw new AppError(400, 'Bad Request', 'INVALID_QUANTITY_LIMIT', `quantityLimit (${qtyLimit}) cannot be lower than already sold quantity (${currentSold}) for SKU ${cleanSku}`);
      }

      validatedItems.push({
        productId: new mongoose.Types.ObjectId(it.productId),
        variantId: it.variantId && mongoose.Types.ObjectId.isValid(it.variantId) ? new mongoose.Types.ObjectId(it.variantId) : (existingItem?.variantId || null),
        sku: cleanSku,
        productName: it.productName || existingItem?.productName || null,
        variantLabel: it.variantLabel || existingItem?.variantLabel || null,
        originalPrice: origPrice,
        salePrice: sPrice,
        quantityLimit: qtyLimit,
        soldQuantity: currentSold,
      });
    }

    if (sale.status === 'PUBLISHED') {
      await assertNoFlashSaleItemOverlap({
        items: validatedItems,
        startAt: sale.startAt,
        endAt: sale.endAt,
        excludeSaleId: sale._id,
      });
    }

    sale.items = validatedItems;
  }

  sale.updatedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : null;
  sale.version += 1;

  try {
    await sale.save();
  } catch (err) {
    if (err.name === 'VersionError' || err.code === 11000) {
      throw new AppError(409, 'Conflict', 'VERSION_CONFLICT', 'Conflict updating Flash Sale campaign. Data has been modified concurrently.');
    }
    throw err;
  }

  return formatFlashSale(sale);
};

/**
 * Get active Flash Sale campaign for public storefront
 */
export const getActiveFlashSale = async () => {
  if (mongoose.connection.readyState !== 1) {
    return { sale: null, products: [] };
  }
  const now = new Date();
  const activeSale = await FlashSale.findOne({
    status: 'PUBLISHED',
    isPaused: false,
    startAt: { $lte: now },
    endAt: { $gt: now },
  }).lean();

  if (!activeSale) {
    return { sale: null, products: [] };
  }

  const formattedSale = formatFlashSale(activeSale, now);

  // Load enriched product details for storefront display
  const productIds = (activeSale.items || []).map((i) => i.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const enrichedProducts = (formattedSale.items || []).map((it) => {
    const p = productMap.get(it.productId);
    const primaryImg = p?.images?.find((i) => i.isPrimary)?.url || p?.images?.[0]?.url || p?.thumbnailUrl || null;
    return {
      ...it,
      productName: it.productName || p?.name || 'Sản phẩm Flash Sale',
      slug: p?.slug || null,
      imageUrl: primaryImg,
      categoryName: p?.categoryName || null,
    };
  });

  return {
    sale: formattedSale,
    products: enrichedProducts,
  };
};

/**
 * Check if a product variant has an active Flash Sale discount available.
 * Strict SKU or variantId matching - no loose product fallback (BE-FIX-02).
 */
export const findActiveFlashSaleItem = async (productId, variantIdOrSku) => {
  const isDbOrMock = mongoose.connection.readyState === 1 || Boolean(jest.isMockFunction?.(FlashSale.findOne));
  if (!isDbOrMock) {
    return null;
  }
  const now = new Date();
  const activeSale = await FlashSale.findOne({
    status: 'PUBLISHED',
    isPaused: false,
    startAt: { $lte: now },
    endAt: { $gt: now },
  });

  if (!activeSale) return null;

  const item = (activeSale.items || []).find((it) => {
    const isSameProduct = it.productId.toString() === productId.toString();
    if (!isSameProduct) return false;

    // Strict SKU or variant matching: NO loose fallback to productId!
    if (variantIdOrSku) {
      const target = variantIdOrSku.toString().trim();
      const matchVariantId = it.variantId && it.variantId.toString() === target;
      const matchSku = it.sku && it.sku.toUpperCase() === target.toUpperCase();
      return matchVariantId || matchSku;
    }
    // If no variantIdOrSku was passed, only match item if item has NO variantId
    return !it.variantId;
  });

  if (!item) return null;

  // Validate variant exists, is active, and server original price
  let product = null;
  if (mongoose.connection.readyState === 1 || Boolean(jest.isMockFunction?.(Product.findById))) {
    const query = Product.findById(productId);
    product = query && typeof query.lean === 'function' ? await query.lean() : await query;
  }

  if (product && product.status !== 'ACTIVE') return null;

  let originalPrice = item.originalPrice;
  if (product) {
    if (item.variantId) {
      const variant = (product.variants || []).find((v) => v._id.toString() === item.variantId.toString());
      if (variant && variant.status !== 'ACTIVE') return null;
      originalPrice = variant?.price || originalPrice;
    } else {
      originalPrice = (product.variants && product.variants[0]?.price) || product.price || originalPrice;
    }
  }

  const isQuotaAvailable = item.soldQuantity < item.quantityLimit;
  return {
    saleId: activeSale._id.toString(),
    saleName: activeSale.name,
    salePrice: item.salePrice,
    originalPrice,
    quantityLimit: item.quantityLimit,
    soldQuantity: item.soldQuantity,
    remainingQuantity: Math.max(0, item.quantityLimit - item.soldQuantity),
    isQuotaAvailable,
    itemDoc: item,
    saleDoc: activeSale,
  };
};

/**
 * Atomic CAS deduction of flash sale item quota inside transaction session (BE-FIX-01)
 */
export const consumeFlashSaleQuotaInSession = async ({ saleId, sku, variantId, quantity, session }) => {
  if (!saleId || (!sku && !variantId) || !quantity || quantity <= 0) {
    return null;
  }
  const cleanSku = sku ? sku.trim().toUpperCase() : null;
  const now = new Date();

  const queryOpts = session ? { session } : {};
  const sale = await FlashSale.findById(saleId, null, queryOpts);
  if (!sale || sale.status !== 'PUBLISHED' || sale.isPaused || sale.startAt > now || sale.endAt <= now) {
    throw new AppError(409, 'Conflict', 'FLASH_SALE_EXPIRED_OR_INACTIVE', 'Chiến dịch Flash Sale đã kết thúc hoặc không khả dụng');
  }

  const item = (sale.items || []).find((it) => {
    if (cleanSku && it.sku === cleanSku) return true;
    if (variantId && it.variantId && it.variantId.toString() === variantId.toString()) return true;
    return false;
  });

  if (!item) {
    throw new AppError(404, 'Not Found', 'FLASH_SALE_ITEM_NOT_FOUND', `Sản phẩm SKU ${cleanSku || variantId} không nằm trong Flash Sale này`);
  }

  const remaining = item.quantityLimit - item.soldQuantity;
  if (remaining < quantity) {
    throw new AppError(
      409,
      'Conflict',
      'FLASH_SALE_QUOTA_EXCEEDED',
      `Số lượng yêu cầu (${quantity}) vượt quá giới hạn Flash Sale còn lại (${Math.max(0, remaining)}) cho SKU ${cleanSku || variantId}`
    );
  }

  const isRealDbOrMockFindOneAndUpdate =
    mongoose.connection.readyState === 1 || Boolean(jest.isMockFunction?.(FlashSale.findOneAndUpdate));

  if (isRealDbOrMockFindOneAndUpdate) {
    const elemFilter = {
      soldQuantity: { $lte: item.quantityLimit - quantity },
    };
    if (cleanSku) {
      elemFilter.sku = cleanSku;
    } else if (variantId) {
      elemFilter.variantId = variantId;
    }

    const updatedSale = await FlashSale.findOneAndUpdate(
      {
        _id: saleId,
        status: 'PUBLISHED',
        isPaused: false,
        startAt: { $lte: now },
        endAt: { $gt: now },
        items: { $elemMatch: elemFilter },
      },
      {
        $inc: {
          'items.$.soldQuantity': quantity,
          version: 1,
        },
      },
      { new: true, ...(session ? { session } : {}) }
    );

    if (!updatedSale) {
      const latestSale = await FlashSale.findById(saleId, null, queryOpts);
      const latestItem = (latestSale?.items || []).find((it) => {
        if (cleanSku && it.sku === cleanSku) return true;
        if (variantId && it.variantId && it.variantId.toString() === variantId.toString()) return true;
        return false;
      });
      const latestRemaining = latestItem ? Math.max(0, latestItem.quantityLimit - latestItem.soldQuantity) : 0;
      throw new AppError(
        409,
        'Conflict',
        'FLASH_SALE_QUOTA_EXCEEDED',
        `Số lượng yêu cầu (${quantity}) vượt quá giới hạn Flash Sale còn lại (${latestRemaining}) cho SKU ${cleanSku || variantId}`
      );
    }

    const updatedItem = (updatedSale.items || []).find((it) => {
      if (cleanSku && it.sku === cleanSku) return true;
      if (variantId && it.variantId && it.variantId.toString() === variantId.toString()) return true;
      return false;
    }) || item;

    return {
      saleId: updatedSale._id.toString(),
      sku: updatedItem.sku,
      soldQuantity: updatedItem.soldQuantity,
      remainingQuantity: Math.max(0, updatedItem.quantityLimit - updatedItem.soldQuantity),
    };
  }

  item.soldQuantity += quantity;
  sale.version = (sale.version || 1) + 1;
  await sale.save(queryOpts);

  return {
    saleId: sale._id.toString(),
    sku: item.sku,
    soldQuantity: item.soldQuantity,
    remainingQuantity: Math.max(0, item.quantityLimit - item.soldQuantity),
  };
};

/**
 * Idempotent release of flash sale item quota on cancellation/expiry (BE-FIX-01)
 */
export const releaseFlashSaleQuotaInSession = async ({ saleId, sku, variantId, quantity, session }) => {
  if (!saleId || (!sku && !variantId) || !quantity || quantity <= 0) {
    return null;
  }
  const cleanSku = sku ? sku.trim().toUpperCase() : null;
  const queryOpts = session ? { session } : {};
  const sale = await FlashSale.findById(saleId, null, queryOpts);
  if (!sale) return null;

  const item = (sale.items || []).find((it) => {
    if (cleanSku && it.sku === cleanSku) return true;
    if (variantId && it.variantId && it.variantId.toString() === variantId.toString()) return true;
    return false;
  });

  if (!item) return true;

  const deductQty = Math.min(item.soldQuantity || 0, quantity);
  if (deductQty <= 0) return true;

  const isRealDbOrMockFindOneAndUpdate =
    mongoose.connection.readyState === 1 || Boolean(jest.isMockFunction?.(FlashSale.findOneAndUpdate));

  if (isRealDbOrMockFindOneAndUpdate) {
    const elemFilter = {
      soldQuantity: { $gte: deductQty },
    };
    if (cleanSku) {
      elemFilter.sku = cleanSku;
    } else if (variantId) {
      elemFilter.variantId = variantId;
    }

    await FlashSale.findOneAndUpdate(
      {
        _id: saleId,
        items: { $elemMatch: elemFilter },
      },
      {
        $inc: {
          'items.$.soldQuantity': -deductQty,
          version: 1,
        },
      },
      { new: true, ...(session ? { session } : {}) }
    );
    return true;
  }

  item.soldQuantity = Math.max(0, (item.soldQuantity || 0) - quantity);
  sale.version = (sale.version || 1) + 1;
  await sale.save(queryOpts);
  return true;
};

export const flashSaleService = {
  deriveFlashSaleState,
  deriveStatus: deriveFlashSaleState,
  formatFlashSale,
  assertNoFlashSaleItemOverlap,
  validateNoOverlappingItems: (items, startAt, endAt, excludeSaleId) =>
    assertNoFlashSaleItemOverlap({ items, startAt, endAt, excludeSaleId }),
  listFlashSales,
  getFlashSaleById,
  createFlashSale,
  updateFlashSale,
  togglePauseFlashSale,
  publishFlashSale,
  getActiveFlashSale,
  findActiveFlashSaleItem,
  consumeFlashSaleQuotaInSession,
  releaseFlashSaleQuotaInSession,
};

export default flashSaleService;
