import mongoose from 'mongoose';
import Product from './models/Product';
import InventoryStock from '../inventory/models/InventoryStock';
import Branch from '../branch/models/Branch';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

/**
 * Lấy danh sách ID các chi nhánh đang ACTIVE
 */
export const getActiveBranchIds = async () => {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return [];
    }
    const query = Branch.find({ status: 'ACTIVE' }).select('_id');
    const branches = typeof query.lean === 'function' ? await query.lean() : await query;
    return Array.isArray(branches) ? branches.map((b) => b._id) : [];
  } catch (error) {
    return [];
  }
};

/**
 * Tính tổng tồn kho khả dụng cho danh sách inventoryItemIds trên toàn bộ chi nhánh active
 * @param {Array<ObjectId>} itemIds 
 * @returns {Promise<Map<string, number>>} Map itemId -> tổng tồn
 */
export const getGlobalStockMap = async (itemIds) => {
  const stockMap = new Map();
  if (!itemIds || itemIds.length === 0) return stockMap;

  try {
    const activeBranchIds = await getActiveBranchIds();
    const match = { inventoryItemId: { $in: itemIds } };
    if (activeBranchIds.length > 0) {
      match.branchId = { $in: activeBranchIds };
    }

    const aggregates = await InventoryStock.aggregate([
      { $match: match },
      { $group: { _id: '$inventoryItemId', totalQty: { $sum: '$quantity' } } }
    ]);

    if (aggregates && Array.isArray(aggregates)) {
      for (const agg of aggregates) {
        stockMap.set(agg._id.toString(), Math.max(0, agg.totalQty));
      }
    }
  } catch (error) {
    // Return empty stock map in case of db errors or mock environments
  }

  return stockMap;
};

/**
 * Gắn cờ outOfStock cho một hoặc nhiều document Product (chuyển sang plain object)
 * @param {Array<Object>|Object} products 
 * @returns {Promise<Array<Object>|Object>}
 */
export const attachOutOfStockFlag = async (products) => {
  const isArray = Array.isArray(products);
  const list = isArray ? products : [products];
  if (list.length === 0) return isArray ? [] : null;

  // Thu thập toàn bộ inventoryItemId của các variants
  const allItemIds = [];
  for (const prod of list) {
    if (prod.variants && Array.isArray(prod.variants)) {
      for (const v of prod.variants) {
        if (v.inventoryItemId) {
          allItemIds.push(v.inventoryItemId);
        }
      }
    }
  }

  const stockMap = await getGlobalStockMap(allItemIds);

  const enriched = list.map((prod) => {
    const obj = typeof prod.toObject === 'function' ? prod.toObject() : { ...prod };
    
    // Đổi _id thành id theo format contract nếu cần
    if (obj._id && !obj.id) obj.id = obj._id.toString();

    let totalProductStock = 0;
    if (obj.variants && Array.isArray(obj.variants)) {
      obj.variants = obj.variants.map((v) => {
        const vObj = { ...v };
        if (vObj._id && !vObj.id) vObj.id = vObj._id.toString();
        const vQty = vObj.inventoryItemId ? (stockMap.get(vObj.inventoryItemId.toString()) || 0) : 0;
        vObj.availableStock = vQty;
        if (vObj.status === 'ACTIVE') {
          totalProductStock += vQty;
        }
        return vObj;
      });
    }

    obj.totalStock = totalProductStock;
    // outOfStock: true khi tổng tồn khả dụng trên các active branch = 0
    obj.outOfStock = totalProductStock <= 0;
    return obj;
  });

  return isArray ? enriched : enriched[0];
};

/**
 * Kiểm tra tính khả dụng khi khách hàng chọn mua hoặc thêm vào Cart
 * Không cho chọn/mua sản phẩm không active, hết hàng hoặc vượt tồn
 * @param {string|ObjectId} productId 
 * @param {string|ObjectId} variantId 
 * @param {number} requestedQuantity 
 */
export const checkVariantPurchasable = async (productId, variantId, requestedQuantity = 1) => {
  const product = await Product.findById(productId);
  if (!product || product.status !== 'ACTIVE') {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.PRODUCT_NOT_PURCHASABLE,
      'Product is not active or does not exist'
    );
  }

  if (product.usageType === 'SERVICE_SUPPLY') {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.PRODUCT_NOT_PURCHASABLE,
      'Sản phẩm phục vụ dịch vụ không thể bán lẻ cho khách hàng'
    );
  }

  const variant = product.variants.id ? product.variants.id(variantId) : product.variants.find(v => v._id.toString() === variantId.toString());
  if (!variant || variant.status !== 'ACTIVE') {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.PRODUCT_NOT_PURCHASABLE,
      'Product variant is not active or does not exist'
    );
  }

  if (!variant.inventoryItemId) {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.INSUFFICIENT_INVENTORY,
      'Product variant is missing inventory item'
    );
  }

  const stockMap = await getGlobalStockMap([variant.inventoryItemId]);
  const availableQty = stockMap.get(variant.inventoryItemId.toString()) || 0;

  if (availableQty <= 0) {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.INSUFFICIENT_INVENTORY,
      'Product variant is out of stock'
    );
  }

  if (availableQty < requestedQuantity) {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.INSUFFICIENT_INVENTORY,
      `Requested quantity (${requestedQuantity}) exceeds available stock (${availableQty})`
    );
  }

  return { product, variant, availableQty };
};
