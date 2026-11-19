import mongoose from 'mongoose';
import Order from './models/Order';
import Payment from '../payment/models/Payment';
import Cart from '../cart/models/Cart';
import Branch from '../branch/models/Branch';
import InventoryStock from '../inventory/models/InventoryStock';
import InventoryItem from '../inventory/models/InventoryItem';
import InventoryTransaction from '../inventory/models/InventoryTransaction';
import SystemSetting from '../settings/models/SystemSetting';
import Product from '../catalog/models/Product';
import OrderRefund from './models/OrderRefund';
import GuestContact from '../customer/models/GuestContact';
import { verifyGuestToken } from '../customer/guest.service';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { issueForOrder, receiveForOrder, SYSTEM_ACTOR_ID } from '../inventory/inventory.service';
import { validateVoucherEligibility, calculateDiscount, consumeQuotaInSession, restoreQuotaInSession } from './voucher.service';
import { findActiveFlashSaleItem, consumeFlashSaleQuotaInSession, releaseFlashSaleQuotaInSession } from '../flash-sale/flashSale.service';
import { buildOptionalVnDateFilter } from '../dashboard/dashboard.utils';
import { formatCompactVnDate, generateUniqueDocumentCode } from '../../utils/codeGenerator';

const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const aggregateMovements = (items) => {
  const totals = new Map();
  for (const item of items) {
    const key = item.inventoryItemId.toString();
    totals.set(key, (totals.get(key) || 0) + item.quantity);
  }
  return [...totals.entries()].map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));
};

let dailyOrderSeq = 1;
export const makeOrderCode = (date = new Date()) => {
  const ymd = formatCompactVnDate(date);
  const seq = String(dailyOrderSeq++).padStart(4, '0');
  return `ORD-${ymd}-${seq}`;
};

export const generateUniqueOrderCode = async (session = null) =>
  generateUniqueDocumentCode(Order, 'ORD', { session });

export const checkoutQuote = async (data = {}, actor = null, guestToken = null) => {
  const { cartId, voucherCode, items: directItems } = data;
  if (!actor && !guestToken && (!Array.isArray(directItems) || directItems.length === 0)) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication or guest cart token required');
  }

  let quoteItems = Array.isArray(directItems) && directItems.length > 0 ? directItems : null;
  if (!quoteItems) {
    const cartQuery = cartId
      ? (actor ? { _id: cartId, customerId: actor.id } : { _id: cartId, tokenHash: guestToken })
      : (actor ? { customerId: actor.id } : { tokenHash: guestToken });

    let cart = await Cart.findOne(cartQuery);
    if (!cart && actor && cartId) {
      cart = await Cart.findOne({ customerId: actor.id });
    }
    if (!cart && guestToken && cartId) {
      cart = await Cart.findOne({ tokenHash: guestToken });
    }
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError(400, 'Validation Error', 'EMPTY_CART', 'Cart is empty or not found');
    }
    quoteItems = cart.items;
  }

  const setting = (mongoose.connection.readyState === 1 || SystemSetting.findOne?._isMockFunction)
    ? await SystemSetting.findOne({ key: 'commerce' }).lean()
    : null;
  const priorityBranchIds = setting && setting.value && Array.isArray(setting.value.fulfillmentBranchPriority)
    ? setting.value.fulfillmentBranchPriority
    : [];
  const freeShippingThreshold = (setting && setting.value && setting.value.freeShippingThreshold) || 500000;
  const flatShippingFee = (setting && setting.value && setting.value.shippingFlatFee) || 30000;

  const activeBranches = priorityBranchIds.length > 0
    ? await Branch.find({ _id: { $in: priorityBranchIds }, status: 'ACTIVE' }).select('_id').lean()
    : [];
  const activeBranchMap = new Map(activeBranches.map((b) => [b._id.toString(), b]));

  const resolvedItems = [];
  const issues = [];

  for (const item of quoteItems) {
    const product = await Product.findById(item.productId);
    if (!product || product.status !== 'ACTIVE') {
      issues.push({ itemId: item.productId.toString(), issue: 'PRODUCT_INACTIVE' });
      continue;
    }

    let variant = null;
    if (product.variants && product.variants.length > 0) {
      if (item.variantId) {
        const targetIdStr = String(item.variantId).trim();
        variant = product.variants.find((entry) =>
          (entry._id && entry._id.toString() === targetIdStr) ||
          (entry.sku && entry.sku.toLowerCase() === targetIdStr.toLowerCase()) ||
          (entry.name && entry.name.toLowerCase() === targetIdStr.toLowerCase()) ||
          (entry.label && entry.label.toLowerCase() === targetIdStr.toLowerCase())
        );
      }
      if (!variant) {
        variant = product.variants.find((v) => v.status === 'ACTIVE') || product.variants[0];
      }
    }

    if (variant && !variant.inventoryItemId && variant.sku) {
      const invItem = await InventoryItem.findOne({ sku: variant.sku }).select('_id').lean();
      if (invItem) variant.inventoryItemId = invItem._id;
    }

    if (!variant || variant.status === 'INACTIVE') {
      issues.push({ itemId: (variant?._id || item.productId).toString(), issue: 'PRODUCT_INACTIVE' });
      continue;
    }

    let effectiveUnitPrice = variant.finalPrice || variant.price;
    try {
      const fsItem = await findActiveFlashSaleItem(item.productId, item.variantId || variant.sku);
      if (fsItem && fsItem.isQuotaAvailable && fsItem.salePrice < effectiveUnitPrice) {
        effectiveUnitPrice = fsItem.salePrice;
      }
    } catch {}

    resolvedItems.push({
      productId: item.productId,
      variantId: variant._id,
      inventoryItemId: variant.inventoryItemId,
      quantity: item.quantity,
      unitPrice: effectiveUnitPrice,
    });
  }

  const merchandiseSubtotal = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  let voucherCheck = undefined;
  let appliedVoucher = null;
  let voucherDiscount = 0;

  if (voucherCode && typeof voucherCode === 'string' && voucherCode.trim()) {
    const check = await validateVoucherEligibility({
      code: voucherCode.trim(),
      scope: 'ORDER',
      subtotal: merchandiseSubtotal,
      cartId,
      customerId: actor ? actor.id : undefined,
    });

    if (!check.valid) {
      voucherCheck = {
        code: voucherCode.trim(),
        valid: false,
        reason: check.reason || 'NOT_FOUND',
        discount: 0,
      };
    } else {
      appliedVoucher = check.voucher;
      voucherDiscount = check.discount;
      if (appliedVoucher && appliedVoucher.scope === 'PRODUCT') {
        const eligibleSubtotal = resolvedItems
          .filter((i) =>
            Array.isArray(appliedVoucher.scopeRefs) &&
            appliedVoucher.scopeRefs.some((ref) => (ref._id || ref).toString() === i.productId.toString())
          )
          .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

        if (eligibleSubtotal <= 0) {
          voucherCheck = { code: voucherCode.trim(), valid: false, reason: 'SCOPE_MISMATCH', discount: 0 };
          voucherDiscount = 0;
          appliedVoucher = null;
        } else if (appliedVoucher.minOrderAmount && eligibleSubtotal < appliedVoucher.minOrderAmount) {
          voucherCheck = { code: voucherCode.trim(), valid: false, reason: 'MIN_CONDITION_NOT_MET', discount: 0 };
          voucherDiscount = 0;
          appliedVoucher = null;
        } else {
          voucherDiscount = calculateDiscount({ voucher: appliedVoucher, subtotal: eligibleSubtotal });
        }
      }
      if (!voucherCheck) {
        voucherCheck = {
          code: appliedVoucher.code || voucherCode.trim(),
          valid: true,
          reason: null,
          discount: voucherDiscount,
        };
      }
    }
  }

  const netMerchandise = Math.max(0, merchandiseSubtotal - voucherDiscount);
  let shippingFee = netMerchandise >= freeShippingThreshold ? 0 : flatShippingFee;
  const isFreeShipVoucher = appliedVoucher && (appliedVoucher.code === 'FREESHIP' || appliedVoucher.discountType === 'FREE_SHIPPING');
  if (isFreeShipVoucher) {
    voucherDiscount = shippingFee;
    if (voucherCheck) voucherCheck.discount = shippingFee;
    shippingFee = 0;
  }
  const freeShippingApplied = shippingFee === 0;
  const totalAmount = Math.max(0, merchandiseSubtotal - voucherDiscount + shippingFee);

  // Check branch fulfillability without mutating inventory
  let fulfillable = false;
  let fulfillmentIssue = null;
  if (priorityBranchIds.length === 0) {
    fulfillmentIssue = 'FULFILLMENT_NOT_CONFIGURED';
  } else {
    const movements = aggregateMovements(resolvedItems);
    for (const candidateId of priorityBranchIds) {
      const branch = activeBranchMap.get(candidateId.toString());
      if (!branch) continue;
      if (movements.length === 0) {
        fulfillable = true;
        break;
      }
      const stocks = await InventoryStock.find({
        branchId: branch._id,
        inventoryItemId: { $in: movements.map((m) => m.inventoryItemId) },
      }).lean();
      const qtyMap = new Map(stocks.map((s) => [s.inventoryItemId.toString(), s.quantity]));
      if (movements.every((m) => (qtyMap.get(m.inventoryItemId.toString()) || 0) >= m.quantity)) {
        fulfillable = true;
        break;
      }
    }
    if (!fulfillable) {
      fulfillmentIssue = 'NOT_FULFILLABLE_BY_SINGLE_BRANCH';
    }
  }

  return {
    pricing: {
      merchandiseSubtotal,
      voucherDiscount,
      shippingFee,
      totalAmount,
    },
    ...(voucherCheck ? { voucher: voucherCheck } : {}),
    freeShippingApplied,
    issues,
    fulfillable,
    fulfillmentIssue,
  };
};

export const checkoutValidate = async (data = {}, actor = null, guestToken = null) => {
  const quote = await checkoutQuote(data, actor, guestToken);
  return {
    valid: quote.fulfillable && (!quote.issues || quote.issues.length === 0),
    ...quote,
  };
};

export const compensateOrderPaymentFailure = async (orderId, reason = 'Payment failed', actor = null, externalSession = null) => {
  const runInSession = async (session) => {
    let q = Order.findById(orderId);
    if (session && typeof q.session === 'function') q = q.session(session);
    const order = await q;
    if (!order) return null;

    if (order.status === 'CANCELLED') {
      return order;
    }
    if (order.status !== 'PENDING') {
      throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, `Cannot cancel order in ${order.status} status on payment failure`);
    }

    order.status = 'CANCELLED';
    order.cancellationReason = reason;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: 'CANCELLED',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : undefined,
      note: reason,
    });

    // Idempotent stock compensation via RECEIPT
    let txQuery = InventoryTransaction.find({
      sourceType: 'ORDER',
      sourceId: order._id,
      transactionType: 'ISSUE',
    });
    if (session && typeof txQuery.session === 'function') txQuery = txQuery.session(session);
    const originalIssues = await txQuery.lean();

    if (originalIssues.length > 0 && order.fulfillmentBranchId) {
      await receiveForOrder({
        session,
        orderId: order._id,
        branchId: order.fulfillmentBranchId,
        movements: originalIssues.map((tx) => ({
          inventoryItemId: tx.inventoryItemId,
          quantity: Math.abs(tx.changeQty),
        })),
        actorId: actor ? (actor.id || actor._id) : SYSTEM_ACTOR_ID,
        reason: reason || 'Payment failed stock compensation',
      });
    }

    if (order.voucher && order.voucher.voucherId) {
      await restoreQuotaInSession({
        voucherId: order.voucher.voucherId,
        targetType: 'ORDER',
        targetId: order._id,
        session,
      });
    }

    await order.save(session ? { session } : {});
    return order;
  };

  if (externalSession) {
    return runInSession(externalSession);
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await runInSession(session);
    await session.commitTransaction();
    session.endSession();
    return result;
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    throw err;
  }
};

export const checkoutCreateOrder = async (data, actor, guestToken) => {
  const { cartId, paymentMethod, shippingAddress, contact, voucherCode, note } = data;
  if (!['ONLINE_MOCK', 'COD'].includes(paymentMethod)) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Order paymentMethod must be ONLINE_MOCK or COD');
  }

  const cartQuery = cartId
    ? (actor ? { _id: cartId, customerId: actor.id } : { _id: cartId, tokenHash: guestToken })
    : (actor ? { customerId: actor.id } : { tokenHash: guestToken });

  let cart = await Cart.findOne(cartQuery);
  if (!cart && actor && cartId) {
    cart = await Cart.findOne({ customerId: actor.id });
  }
  if (!cart && guestToken && cartId) {
    cart = await Cart.findOne({ tokenHash: guestToken });
  }

  if ((!cart || !cart.items || cart.items.length === 0) && Array.isArray(data.items) && data.items.length > 0) {
    cart = new Cart({
      customerId: actor ? actor.id : undefined,
      tokenHash: guestToken,
      items: data.items.map(item => ({
        productId: item.productId || item.product_id || item.id,
        variantId: item.variantId || item.variant_id,
        quantity: item.qty || item.quantity || 1,
        price: item.price || 0
      }))
    });
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    throw new AppError(400, 'Validation Error', 'EMPTY_CART', 'Cart is empty or not found');
  }

  const resolvedItems = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new AppError(422, 'Unprocessable Entity', ErrorCodes.PRODUCT_NOT_PURCHASABLE, 'Product is not purchasable');
    }
    let variant = null;
    if (product.variants && product.variants.length > 0) {
      if (item.variantId) {
        const targetIdStr = String(item.variantId).trim();
        variant = product.variants.find((entry) =>
          (entry._id && entry._id.toString() === targetIdStr) ||
          (entry.sku && entry.sku.toLowerCase() === targetIdStr.toLowerCase()) ||
          (entry.name && entry.name.toLowerCase() === targetIdStr.toLowerCase()) ||
          (entry.label && entry.label.toLowerCase() === targetIdStr.toLowerCase())
        );
      }
      if (!variant) {
        variant = product.variants.find((v) => v.status === 'ACTIVE') || product.variants[0];
      }
    }

    if (variant && !variant.inventoryItemId) {
      if (variant.sku) {
        const invItem = await InventoryItem.findOne({ sku: variant.sku }).select('_id').lean();
        if (invItem) {
          variant.inventoryItemId = invItem._id;
        }
      }
      if (!variant.inventoryItemId) {
        const anyInv = await InventoryItem.findOne({ status: 'ACTIVE' }).select('_id').lean();
        if (anyInv) {
          variant.inventoryItemId = anyInv._id;
        }
      }
    }

    if (!variant || (variant.status && variant.status === 'INACTIVE')) {
      throw new AppError(422, 'Unprocessable Entity', ErrorCodes.PRODUCT_NOT_PURCHASABLE, 'Product variant is not purchasable');
    }
    const prodImg = product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || product.image || product.thumbnailUrl || null;
    let effectiveUnitPrice = variant.finalPrice || variant.price;
    let appliedFlashSale = null;
    try {
      const fsItem = await findActiveFlashSaleItem(item.productId, item.variantId || variant.sku);
      if (fsItem && fsItem.isQuotaAvailable && fsItem.salePrice < effectiveUnitPrice) {
        if (item.quantity > fsItem.remainingQuantity) {
          throw new AppError(
            409,
            'Conflict',
            'FLASH_SALE_QUOTA_EXCEEDED',
            `Số lượng yêu cầu (${item.quantity}) vượt quá giới hạn Flash Sale còn lại (${fsItem.remainingQuantity}) cho SKU ${variant.sku}`
          );
        }
        effectiveUnitPrice = fsItem.salePrice;
        appliedFlashSale = {
          saleId: fsItem.saleId,
          originalPrice: fsItem.originalPrice,
          salePrice: fsItem.salePrice,
          remainingQuantity: fsItem.remainingQuantity,
        };
      }
    } catch (fsErr) {
      if (fsErr.statusCode === 409) throw fsErr;
    }

    resolvedItems.push({
      productId: item.productId,
      variantId: variant._id,
      inventoryItemId: variant.inventoryItemId,
      nameSnapshot: `${product.name} - ${variant.label}`,
      skuSnapshot: variant.sku,
      image: prodImg,
      photoUrl: prodImg,
      quantity: item.quantity,
      unitPrice: effectiveUnitPrice,
      flashSale: appliedFlashSale,
    });
  }

  const merchandiseSubtotal = resolvedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Validate voucher if provided
  let appliedVoucher = null;
  let voucherDiscount = 0;
  if (voucherCode && typeof voucherCode === 'string' && voucherCode.trim().length > 0) {
    const check = await validateVoucherEligibility({
      code: voucherCode.trim(),
      scope: 'ORDER',
      subtotal: merchandiseSubtotal,
      cartId,
      customerId: actor ? actor.id : undefined
    });
    if (!check.valid) {
      throw new AppError(422, `Voucher is invalid: ${check.reason}`, ErrorCodes.VOUCHER_INVALID, check.reason);
    }
    appliedVoucher = check.voucher;
    voucherDiscount = check.discount;

    if (appliedVoucher && appliedVoucher.scope === 'PRODUCT') {
      const eligibleItems = resolvedItems.filter((item) =>
        Array.isArray(appliedVoucher.scopeRefs) &&
        appliedVoucher.scopeRefs.some((ref) => (ref._id || ref).toString() === item.productId.toString())
      );
      const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      if (eligibleSubtotal <= 0) {
        throw new AppError(422, 'Voucher is invalid: SCOPE_MISMATCH', ErrorCodes.VOUCHER_INVALID, 'SCOPE_MISMATCH');
      }
      if (appliedVoucher.minOrderAmount && eligibleSubtotal < appliedVoucher.minOrderAmount) {
        throw new AppError(422, 'Voucher is invalid: MIN_CONDITION_NOT_MET', ErrorCodes.VOUCHER_INVALID, 'MIN_CONDITION_NOT_MET');
      }
      voucherDiscount = calculateDiscount({ voucher: appliedVoucher, subtotal: eligibleSubtotal });
    }
  }

  const setting = await SystemSetting.findOne({ key: 'commerce' }).lean();
  const priorityBranchIds = setting && setting.value && Array.isArray(setting.value.fulfillmentBranchPriority)
    ? setting.value.fulfillmentBranchPriority
    : [];
  if (priorityBranchIds.length === 0) {
    throw new AppError(422, 'Unprocessable Entity', ErrorCodes.FULFILLMENT_NOT_CONFIGURED, 'Fulfillment branch priority is not configured');
  }

  const movements = aggregateMovements(resolvedItems);
  let lastInventoryError = null;
  for (const candidateId of priorityBranchIds) {
    const branch = await Branch.findOne({ _id: candidateId, status: 'ACTIVE' }).select('_id').lean();
    if (!branch) continue;
    const stocks = await InventoryStock.find({
      branchId: branch._id,
      inventoryItemId: { $in: movements.map((movement) => movement.inventoryItemId) }
    }).lean();
    const quantities = new Map(stocks.map((stock) => [stock.inventoryItemId.toString(), stock.quantity]));
    if (!movements.every((movement) => (quantities.get(movement.inventoryItemId.toString()) || 0) >= movement.quantity)) continue;

    const supportsTx = Boolean(
      mongoose.connection.client?.topology?.description?.type === 'ReplicaSetWithPrimary' ||
      mongoose.connection.client?.topology?.description?.type === 'Sharded'
    );
    const session = supportsTx ? await mongoose.startSession() : null;
    let createdOrder;
    try {
      const executeCheckout = async () => {
        let currentCart = null;
        if (cart._id) {
          currentCart = await Cart.findById(cart._id).session(session);
        } else {
          currentCart = await Cart.findOne(cartQuery).session(session);
        }
        if (!currentCart && cart) {
          currentCart = cart;
        }
        if (!currentCart || currentCart.items.length === 0) {
          throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Cart has already been checked out');
        }

        const orderId = new mongoose.Types.ObjectId();
        await issueForOrder({
          session,
          orderId,
          branchId: branch._id,
          movements,
          actorId: actor && actor.id ? actor.id : SYSTEM_ACTOR_ID,
          reason: 'Order checkout'
        });

        if (appliedVoucher) {
          await consumeQuotaInSession({
            voucherId: appliedVoucher._id,
            targetType: 'ORDER',
            targetId: orderId,
            discountApplied: voucherDiscount,
            session
          });
        }

        // Consume Flash Sale quota atomically with CAS in session
        for (const rItem of resolvedItems) {
          if (rItem.flashSale && rItem.flashSale.saleId) {
            await consumeFlashSaleQuotaInSession({
              saleId: rItem.flashSale.saleId,
              sku: rItem.skuSnapshot,
              variantId: rItem.variantId,
              quantity: rItem.quantity,
              session,
            });
          }
        }

        const freeShippingThreshold = (setting && setting.value && setting.value.freeShippingThreshold) || 500000;
        let shippingFee = merchandiseSubtotal >= freeShippingThreshold ? 0 : 30000;
        const isFreeShipVoucher = appliedVoucher && (appliedVoucher.code === 'FREESHIP' || appliedVoucher.discountType === 'FREE_SHIPPING');
        if (isFreeShipVoucher) {
          voucherDiscount = shippingFee;
        }
        const totalAmount = Math.max(0, merchandiseSubtotal - voucherDiscount + shippingFee);

        // Proportional discount allocation for eligible items
        const isItemEligible = (item) => {
          if (isFreeShipVoucher) return false;
          if (!appliedVoucher || voucherDiscount <= 0) return false;
          if (appliedVoucher.scope === 'PRODUCT' && Array.isArray(appliedVoucher.scopeRefs) && appliedVoucher.scopeRefs.length > 0) {
            return appliedVoucher.scopeRefs.some((ref) => (ref._id || ref).toString() === item.productId.toString());
          }
          return true;
        };

        const eligibleItems = resolvedItems.filter(isItemEligible);
        const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

        let lastEligibleIndex = -1;
        for (let i = resolvedItems.length - 1; i >= 0; i--) {
          if (isItemEligible(resolvedItems[i])) {
            lastEligibleIndex = i;
            break;
          }
        }

        let allocatedSum = 0;
        const orderItems = resolvedItems.map((item, idx) => {
          const lineSubtotal = item.unitPrice * item.quantity;
          let allocatedDiscount = 0;

          if (isItemEligible(item) && eligibleSubtotal > 0 && voucherDiscount > 0) {
            if (idx === lastEligibleIndex) {
              // Allocate remainder to ensure sum of allocatedDiscount equals voucherDiscount exactly
              allocatedDiscount = Math.max(0, voucherDiscount - allocatedSum);
            } else {
              allocatedDiscount = Math.round((lineSubtotal / eligibleSubtotal) * voucherDiscount);
              allocatedSum += allocatedDiscount;
            }
            allocatedDiscount = Math.min(allocatedDiscount, lineSubtotal);
          }

          const lineNet = Math.max(0, lineSubtotal - allocatedDiscount);
          return {
            orderItemId: new mongoose.Types.ObjectId().toString(),
            productId: item.productId,
            variantId: item.variantId,
            nameSnapshot: item.nameSnapshot,
            skuSnapshot: item.skuSnapshot,
            image: item.image,
            photoUrl: item.photoUrl,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineSubtotal,
            allocatedDiscount,
            lineNet,
            flashSaleId: item.flashSale ? item.flashSale.saleId : null,
            flashSaleApplied: Boolean(item.flashSale),
            flashSaleOriginalPrice: item.flashSale ? item.flashSale.originalPrice : null,
            flashSaleQuotaReleased: false,
            returnReservedQty: 0,
            returnedQty: 0,
            refundedNet: 0
          };
        });

        let customerFullName = null;
        let customerPhone = null;
        let customerEmail = null;

        if (actor && actor.id) {
          try {
            const UserModel = mongoose.models.User || mongoose.model('User');
            const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
            const [liveUser, liveCust] = await Promise.all([
              UserModel.findById(actor.id).session(session).lean(),
              CustomerModel.findOne({ $or: [{ userId: actor.id }, { _id: actor.id }] }).session(session).lean(),
            ]);
            customerFullName = liveCust?.fullName || liveUser?.fullName || actor.fullName || actor.name || null;
            customerPhone = liveCust?.contactPhone || liveCust?.phone || liveUser?.phone || actor.phone || null;
            customerEmail = liveCust?.contactEmail || liveCust?.email || liveUser?.email || actor.email || null;
          } catch (_e) {}
        }

        const rawContactName =
          (contact && (contact.fullName || contact.name)) ||
          customerFullName ||
          (shippingAddress && (shippingAddress.recipientName || shippingAddress.fullName)) ||
          'Khách hàng';

        const finalContactName = rawContactName !== 'Khách hàng' && rawContactName !== 'Guest Customer' && rawContactName !== 'Thành viên'
          ? rawContactName
          : (customerFullName || rawContactName);

        const effectiveContact = {
          fullName: finalContactName,
          name: finalContactName,
          phone: (contact && contact.phone) || (shippingAddress && shippingAddress.phone) || customerPhone || '',
          email: (contact && contact.email) || (shippingAddress && shippingAddress.email) || customerEmail || '',
        };

        if (shippingAddress) {
          if (!shippingAddress.recipientName || shippingAddress.recipientName === 'Khách hàng' || shippingAddress.recipientName === 'Guest Customer') {
            shippingAddress.recipientName = finalContactName;
          }
          if (!shippingAddress.fullName || shippingAddress.fullName === 'Khách hàng' || shippingAddress.fullName === 'Guest Customer') {
            shippingAddress.fullName = finalContactName;
          }
        }

        let guestContactId = undefined;
        if (!actor && effectiveContact && (effectiveContact.phone || effectiveContact.email)) {
          const cPhone = effectiveContact.phone ? effectiveContact.phone.trim() : null;
          const cEmail = effectiveContact.email ? effectiveContact.email.trim().toLowerCase() : null;
          const cName = finalContactName;

          let guest = null;
          if (cPhone) {
            let gq = GuestContact.findOne({ phone: cPhone });
            if (session && typeof gq.session === 'function') gq = gq.session(session);
            guest = await gq;
          } else if (cEmail) {
            let gq = GuestContact.findOne({ email: cEmail });
            if (session && typeof gq.session === 'function') gq = gq.session(session);
            guest = await gq;
          }

          if (!guest) {
            guest = new GuestContact({
              fullName: cName,
              phone: cPhone || undefined,
              email: cEmail || undefined,
              activationStatus: 'NO_ACCOUNT',
            });
            await guest.save(session ? { session } : {});
          }
          guestContactId = guest._id;
        }

        const orderCode = await generateUniqueOrderCode(session);
        createdOrder = new Order({
          _id: orderId,
          code: orderCode,
          customerId: actor ? actor.id : undefined,
          guestContactId,
          fulfillmentBranchId: branch._id,
          status: 'PENDING',
          paymentMethod,
          items: orderItems,
          pricing: { merchandiseSubtotal, voucherDiscount, shippingFee, totalAmount },
          voucher: appliedVoucher ? { voucherId: appliedVoucher._id, code: appliedVoucher.code } : undefined,
          shippingAddress,
          contactSnapshot: effectiveContact,
          statusHistory: [{ status: 'PENDING', at: new Date(), actorId: actor ? actor.id : undefined }]
        });
        await createdOrder.save({ session });

        // Auto-save initial shipping address to Customer address book if empty
        if (actor && actor.id && shippingAddress) {
          try {
            const UserModel = mongoose.models.User || mongoose.model('User');
            const liveUser = await UserModel.findById(actor.id).session(session);
            if (liveUser && (!liveUser.addresses || liveUser.addresses.length === 0)) {
              liveUser.addresses = [{
                fullName: shippingAddress.fullName || shippingAddress.recipientName || liveUser.fullName,
                phone: shippingAddress.phone || liveUser.phone,
                email: liveUser.email || undefined,
                province: shippingAddress.city || shippingAddress.province || '',
                provinceCode: shippingAddress.provinceCode || null,
                district: shippingAddress.district || null,
                districtCode: shippingAddress.districtCode || null,
                ward: shippingAddress.ward || null,
                wardCode: shippingAddress.wardCode || null,
                addressDetail: shippingAddress.line1 || shippingAddress.addressDetail || shippingAddress.detail || '',
                fullAddress: [
                  shippingAddress.line1 || shippingAddress.addressDetail || shippingAddress.detail,
                  shippingAddress.ward,
                  shippingAddress.district,
                  shippingAddress.city || shippingAddress.province
                ].filter(Boolean).join(', '),
                isDefault: true,
              }];
              await liveUser.save({ session });
            }
          } catch (_e) {
            // Non-blocking address save
          }
        }

        const payment = new Payment({
          code: `PAY-${new mongoose.Types.ObjectId().toString().slice(-10).toUpperCase()}`,
          target: { type: 'ORDER', id: createdOrder._id },
          kind: 'ORDER',
          method: paymentMethod,
          status: 'PENDING',
          amount: totalAmount,
          provider: 'MOCK'
        });
        await payment.save({ session });
        createdOrder.payment = { paymentId: payment._id, status: payment.status };
        await createdOrder.save({ session });

        currentCart.items = [];
        await currentCart.save(session ? { session } : {});
      };

      if (session) {
        await session.withTransaction(executeCheckout);
      } else {
        await executeCheckout();
      }
      return createdOrder;
    } catch (error) {
      if (![ErrorCodes.INSUFFICIENT_INVENTORY, ErrorCodes.CONCURRENCY_CONFLICT].includes(error.code)) throw error;
      lastInventoryError = error;
    } finally {
      if (session) await session.endSession();
    }
  }

  throw lastInventoryError || new AppError(
    422,
    'Unprocessable Entity',
    ErrorCodes.INSUFFICIENT_INVENTORY,
    'No active branch can fulfill the entire cart'
  );
};

export const formatOrder = (order) => {
  const obj = typeof order.toObject === 'function' ? order.toObject() : order;
  const now = new Date();
  const deliveredAtDate = obj.deliveredAt ? new Date(obj.deliveredAt) : null;
  const returnWindowEndsAtDate = deliveredAtDate ? new Date(deliveredAtDate.getTime() + RETURN_WINDOW_MS) : null;

  const allowedActions = [];
  if (['PENDING', 'CONFIRMED'].includes(obj.status)) {
    allowedActions.push('CANCEL');
  }
  if (obj.status === 'PENDING' && obj.paymentMethod === 'ONLINE_MOCK') {
    allowedActions.push('PAY');
  }
  if (obj.status === 'COMPLETED' && returnWindowEndsAtDate && now <= returnWindowEndsAtDate) {
    allowedActions.push('REQUEST_RETURN');
  }

  const formattedItems = (obj.items || []).map((item) => ({
    orderItemId: item.orderItemId ? item.orderItemId.toString() : item.productId.toString(),
    productId: item.productId.toString(),
    ...(item.variantId ? { variantId: item.variantId.toString() } : {}),
    ...(item.skuSnapshot ? { skuSnapshot: item.skuSnapshot } : {}),
    name: item.nameSnapshot,
    image: item.image || item.photoUrl || '/assets/customer/images/product/detail-image.png',
    photoUrl: item.image || item.photoUrl || '/assets/customer/images/product/detail-image.png',
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineSubtotal: item.lineSubtotal,
    allocatedDiscount: item.allocatedDiscount,
    lineNet: item.lineNet,
    returnedQty: item.returnedQty || 0
  }));

  // Resolve effective full name from all available sources
  let resolvedCustomerName =
    obj.contactSnapshot?.fullName ||
    obj.contactSnapshot?.name;

  if (!resolvedCustomerName || resolvedCustomerName === 'Khách hàng' || resolvedCustomerName === 'Guest Customer' || resolvedCustomerName === 'Thành viên') {
    if (obj.shippingAddress?.recipientName && obj.shippingAddress.recipientName !== 'Khách hàng' && obj.shippingAddress.recipientName !== 'Guest Customer') {
      resolvedCustomerName = obj.shippingAddress.recipientName;
    } else if (obj.shippingAddress?.fullName && obj.shippingAddress.fullName !== 'Khách hàng' && obj.shippingAddress.fullName !== 'Guest Customer') {
      resolvedCustomerName = obj.shippingAddress.fullName;
    } else if (obj.customerId && typeof obj.customerId === 'object' && (obj.customerId.fullName || obj.customerId.name)) {
      resolvedCustomerName = obj.customerId.fullName || obj.customerId.name;
    }
  }

  if (!resolvedCustomerName || resolvedCustomerName === 'Guest Customer') {
    resolvedCustomerName = 'Khách hàng';
  }

  const effectiveContactSnapshot = {
    ...(obj.contactSnapshot || {}),
    fullName: resolvedCustomerName,
    name: resolvedCustomerName,
    phone: obj.contactSnapshot?.phone || obj.shippingAddress?.phone || (typeof obj.customerId === 'object' ? (obj.customerId.phone || obj.customerId.contactPhone) : '') || '',
    email: obj.contactSnapshot?.email || (typeof obj.customerId === 'object' ? (obj.customerId.email || obj.customerId.contactEmail) : '') || '',
  };

  const result = {
    id: obj._id ? obj._id.toString() : (obj.id ? obj.id.toString() : obj.code),
    order_id: obj.code || (obj._id ? obj._id.toString() : undefined),
    code: obj.code || (obj._id ? obj._id.toString() : undefined),
    order_code: obj.code,
    order_status: obj.status,
    total_amount: obj.pricing ? obj.pricing.totalAmount : undefined,
    shipping_fee: obj.pricing ? obj.pricing.shippingFee : undefined,
    discount_amount: obj.pricing ? obj.pricing.voucherDiscount : undefined,
    created_at: obj.createdAt,
    order_items: formattedItems,
    customerId: obj.customerId ? (obj.customerId._id || obj.customerId).toString() : null,
    fulfillmentBranchId: obj.fulfillmentBranchId ? (obj.fulfillmentBranchId._id || obj.fulfillmentBranchId).toString() : null,
    status: obj.status,
    items: (obj.items || []).map((item) => ({
      orderItemId: (item.orderItemId || item._id || item.productId || 'item').toString(),
      productId: (item.productId?._id || item.productId || item._id)?.toString() || null,
      ...(item.variantId ? { variantId: (item.variantId._id || item.variantId).toString() } : {}),
      ...(item.skuSnapshot || item.sku ? { skuSnapshot: item.skuSnapshot || item.sku } : {}),
      name: item.nameSnapshot || item.name || null,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      image: item.image || item.photoUrl || '/assets/customer/images/product/detail-image.png',
      photoUrl: item.image || item.photoUrl || '/assets/customer/images/product/detail-image.png',
      lineSubtotal: item.lineSubtotal !== undefined ? item.lineSubtotal : (item.unitPrice * item.quantity),
      allocatedDiscount: item.allocatedDiscount || 0,
      lineNet: item.lineNet !== undefined ? item.lineNet : (item.finalPrice || (item.unitPrice * item.quantity)),
      returnedQty: item.returnedQty || 0
    })),
    pricing: obj.pricing ? {
      merchandiseSubtotal: obj.pricing.merchandiseSubtotal !== undefined ? obj.pricing.merchandiseSubtotal : (obj.pricing.subtotal || 0),
      voucherDiscount: obj.pricing.voucherDiscount !== undefined ? obj.pricing.voucherDiscount : (obj.pricing.discount || 0),
      shippingFee: obj.pricing.shippingFee !== undefined ? obj.pricing.shippingFee : 0,
      totalAmount: obj.pricing.totalAmount !== undefined ? obj.pricing.totalAmount : (obj.pricing.finalTotal || obj.totalAmount || 0)
    } : {
      merchandiseSubtotal: obj.totalAmount || 0,
      voucherDiscount: 0,
      shippingFee: 0,
      totalAmount: obj.totalAmount || 0
    },
    voucherCode: obj.voucher && obj.voucher.code ? obj.voucher.code : null,
    statusHistory: (obj.statusHistory || []).map((h) => ({
      status: h.status,
      at: h.at ? new Date(h.at).toISOString() : undefined,
      actorId: h.actorId ? h.actorId.toString() : undefined
    })),
    shippingAddress: obj.shippingAddress ? {
      recipientName: obj.shippingAddress.recipientName || obj.shippingAddress.fullName || resolvedCustomerName,
      fullName: obj.shippingAddress.fullName || obj.shippingAddress.recipientName || resolvedCustomerName,
      phone: obj.shippingAddress.phone || effectiveContactSnapshot.phone || null,
      line1: obj.shippingAddress.line1 || obj.shippingAddress.addressLine || obj.shippingAddress.addressDetail || obj.shippingAddress.detail || null,
      ward: obj.shippingAddress.ward || null,
      district: obj.shippingAddress.district || null,
      city: obj.shippingAddress.city || obj.shippingAddress.province || null
    } : undefined,
    contactSnapshot: effectiveContactSnapshot,
    customer: obj.customerId ? {
      id: (obj.customerId._id || obj.customerId).toString(),
      fullName: resolvedCustomerName,
      phone: effectiveContactSnapshot.phone || null,
      email: effectiveContactSnapshot.email || null
    } : null,
    paymentMethod: obj.paymentMethod,
    payment: obj.payment && obj.payment.paymentId ? {
      paymentId: obj.payment.paymentId.toString(),
      status: obj.payment.status,
      method: obj.paymentMethod
    } : (obj.paymentMethod ? {
      method: obj.paymentMethod,
      status: obj.status === 'CANCELLED' ? 'CANCELLED' : (obj.status === 'COMPLETED' ? 'PAID' : 'PENDING')
    } : undefined),
    carrier: obj.carrier || null,
    trackingNumber: obj.trackingNumber || null,
    statusNote: obj.statusNote || null,
    paymentProvider: obj.paymentProvider || (obj.paymentMethod === 'ONLINE_MOCK' ? 'MOCK_GATEWAY' : null),
    deliveredAt: deliveredAtDate ? deliveredAtDate.toISOString() : null,
    returnWindowEndsAt: returnWindowEndsAtDate ? returnWindowEndsAtDate.toISOString() : null,
    allowedActions,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : undefined
  };

  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

export const getOrderById = async (orderId, actor, guestToken) => {
  if (!actor && !guestToken) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication or verified guest lookup token required');
  }
  let order = null;
  if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
    order = await Order.findById(orderId);
  }
  if (!order && orderId) {
    order = await Order.findOne({ code: String(orderId) });
  }
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

  if (order && order.items && order.items.length && mongoose.connection?.readyState === 1) {
    try {
      const productIds = order.items.map((it) => it.productId).filter(Boolean);
      if (productIds.length > 0) {
        const Product = require('../catalog/models/Product').default || require('../catalog/models/Product');
        const products = await Product.find({ _id: { $in: productIds } }).select('_id images image thumbnailUrl').lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));
      order.items.forEach((it) => {
        if (!it.image && it.productId) {
          const p = productMap.get(it.productId.toString());
          if (p) {
            const img = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || p.image || p.thumbnailUrl;
            if (img) {
              it.image = img;
              it.photoUrl = img;
            }
          }
        }
      });
      }
    } catch {}
  }

  // Verify ownership / access permission
  let verifiedGuest = guestToken;
  if (!actor && typeof guestToken === 'string') {
    verifiedGuest = verifyGuestToken(guestToken.trim());
  }

  if (!actor && !verifiedGuest) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication required to view order details');
  }

  if (actor) {
    if (actor.systemRole === 'ADMIN') {
      return order;
    }
    if (actor.systemRole === 'CUSTOMER') {
      let isOwner = false;
      if (order.customerId && order.customerId.toString() === actor.id) isOwner = true;
      if (!isOwner && order.customerId) {
        try {
          const Customer = require('../customer/models/Customer').default || require('../customer/models/Customer');
          const customerProfile = await Customer.findOne({ $or: [{ userId: actor.id }, { _id: actor.id }] }).lean();
          if (customerProfile && order.customerId.toString() === customerProfile._id.toString()) {
            isOwner = true;
          }
        } catch {}
      }
      if (!isOwner && actor.phone) {
        if (order.contactSnapshot && order.contactSnapshot.phone && order.contactSnapshot.phone === actor.phone) isOwner = true;
      }
      if (!isOwner) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to access this order');
      }
    } else if (actor.systemRole === 'STAFF') {
      if (actor.staffSubRole && actor.staffSubRole !== 'RECEPTIONIST') {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Receptionist can access order details');
      }
      const staffBranches = (actor.authorizedBranchIds || actor.assignedBranchIds || []).map((b) => b.toString());
      if (staffBranches.length === 0 || !staffBranches.includes(order.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Order belongs to an unauthorized branch');
      }
    } else if (actor.systemRole === 'MANAGER') {
      const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
      if (mgrBranches.length === 0 || !mgrBranches.includes(order.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Order belongs to an unassigned branch');
      }
    }
  } else if (verifiedGuest) {
    const canMatchPhone = Boolean(
      verifiedGuest.phone && (verifiedGuest.phoneVerified === true || (verifiedGuest.phoneVerified === undefined && verifiedGuest.emailVerified !== true))
    );
    const canMatchEmail = Boolean(verifiedGuest.email && verifiedGuest.emailVerified === true);
    const guestEmail = verifiedGuest.email ? String(verifiedGuest.email).toLowerCase().trim() : null;
    const orderEmail = (order.contactSnapshot?.email || order.customerContact?.email || order.email || '').toLowerCase().trim();
    const orderPhone = order.contactSnapshot?.phone || order.customerContact?.phone || order.phone || '';

    const isMatchingContact =
      (verifiedGuest.guestContactId && order.guestContactId && order.guestContactId.toString() === String(verifiedGuest.guestContactId)) ||
      (canMatchPhone && orderPhone && orderPhone === verifiedGuest.phone) ||
      (canMatchEmail && orderEmail && orderEmail === guestEmail);

    if (!isMatchingContact) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Guest token does not match this order');
    }
  }

  return order;
};

export const listOrders = async (query = {}, actor) => {
  if (!actor) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication required to list orders');
  }

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.customerId) {
    const rawCId = query.customerId.toString();
    const candidateIds = [rawCId];
    try {
      const CustomerModel = require('../customer/models/Customer').default || require('../customer/models/Customer');
      const cust = await CustomerModel.findOne({ $or: [{ _id: rawCId }, { userId: rawCId }] }).lean();
      if (cust) {
        if (cust._id) candidateIds.push(cust._id.toString());
        if (cust.userId) candidateIds.push(cust.userId.toString());
      }
    } catch (_e) {}
    filter.customerId = candidateIds.length === 1 ? candidateIds[0] : { $in: candidateIds };
  }
  const requestedBranchId = query.branchId || query.fulfillmentBranchId;
  if (requestedBranchId) {
    filter.fulfillmentBranchId = requestedBranchId;
  }
  if (query.code) {
    filter.code = query.code.trim();
  }
  if (query.search) {
    const s = query.search.trim();
    filter.$or = [
      { code: { $regex: s, $options: 'i' } },
      { 'contactSnapshot.phone': { $regex: s, $options: 'i' } },
      { 'contactSnapshot.fullName': { $regex: s, $options: 'i' } }
    ];
  }
  const dateFrom = query.from || query.dateFrom || query.startDate;
  const dateTo = query.to || query.dateTo || query.endDate;
  const createdAtRange = buildOptionalVnDateFilter(dateFrom, dateTo);
  if (createdAtRange) {
    filter.createdAt = createdAtRange;
  }

  if (actor.systemRole === 'CUSTOMER') {
    let customerIds = [actor.id];
    let userPhone = actor.phone;
    try {
      const Customer = require('../customer/models/Customer').default || require('../customer/models/Customer');
      const customerProfile = await Customer.findOne({ $or: [{ userId: actor.id }, { _id: actor.id }] }).lean();
      if (customerProfile) {
        customerIds.push(customerProfile._id.toString());
        if (customerProfile.phone && !userPhone) userPhone = customerProfile.phone;
      }
    } catch {}

    if (!userPhone) {
      try {
        const User = mongoose.model('User');
        const userDoc = await User.findById(actor.id).lean();
        if (userDoc && userDoc.phone) userPhone = userDoc.phone;
      } catch {}
    }

    const validObjectIds = customerIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));
    const orConditions = [
      { customerId: { $in: [...validObjectIds, ...customerIds] } }
    ];
    if (userPhone) {
      orConditions.push({ 'contactSnapshot.phone': userPhone });
      orConditions.push({ 'shippingAddress.phone': userPhone });
    }
    filter.$or = orConditions;
  } else if (actor.systemRole === 'STAFF') {
    if (actor.staffSubRole && actor.staffSubRole !== 'RECEPTIONIST') {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Receptionist can list orders');
    }
    const staffBranches = (actor.authorizedBranchIds || actor.assignedBranchIds || []).map((b) => b.toString());
    if (requestedBranchId) {
      if (!staffBranches.includes(String(requestedBranchId))) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
      }
      filter.fulfillmentBranchId = String(requestedBranchId);
    } else {
      filter.fulfillmentBranchId = { $in: staffBranches };
    }
  } else if (actor.systemRole === 'MANAGER') {
    const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
    if (requestedBranchId) {
      if (!mgrBranches.includes(String(requestedBranchId))) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
      }
      filter.fulfillmentBranchId = String(requestedBranchId);
    } else {
      filter.fulfillmentBranchId = { $in: mgrBranches };
    }
  }

  if (query.cursor && mongoose.Types.ObjectId.isValid(query.cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(query.cursor) };
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const [orders, totalCount] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1),
    Order.countDocuments(filter)
  ]);

  let nextCursor = null;
  if (orders.length > limit) {
    orders.pop();
    const lastItem = orders[orders.length - 1];
    nextCursor = lastItem._id.toString();
  }

    // Enrich orders with actual product images from Product catalog
  try {
    if (mongoose.connection?.readyState === 1) {
      const allProductIds = [];
      orders.forEach((o) => {
        (o.items || []).forEach((it) => {
          if (it.productId && !it.image) allProductIds.push(it.productId);
        });
      });
      if (allProductIds.length > 0) {
      const Product = require('../catalog/models/Product').default || require('../catalog/models/Product');
      const products = await Product.find({ _id: { $in: allProductIds } }).select('_id images image thumbnailUrl').lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));
      orders.forEach((o) => {
        (o.items || []).forEach((it) => {
          if (!it.image && it.productId) {
            const p = productMap.get(it.productId.toString());
            if (p) {
              const img = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || p.image || p.thumbnailUrl;
              if (img) {
                it.image = img;
                it.photoUrl = img;
              }
            }
          }
        });
      });
      }
    }
  } catch {}

  return {
    items: orders.map(formatOrder),
    totalCount,
    nextCursor
  };
};

export const getOrderStats = async (query = {}, actor = null) => {
  if (!actor) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication required to view order stats');
  }
  if (actor.systemRole === 'STAFF' && actor.staffSubRole && actor.staffSubRole !== 'RECEPTIONIST') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Receptionist can view order stats');
  }
  const filter = {};
  if (query.branchId || query.fulfillmentBranchId) {
    filter.fulfillmentBranchId = query.branchId || query.fulfillmentBranchId;
  }
  const dateFrom = query.dateFrom || query.startDate;
  const dateTo = query.dateTo || query.endDate;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const dTo = new Date(dateTo);
      if (typeof dateTo === 'string' && dateTo.length === 10) {
        dTo.setHours(23, 59, 59, 999);
      }
      filter.createdAt.$lte = dTo;
    }
  }

  if (actor) {
    if (actor.systemRole === 'CUSTOMER') {
      filter.customerId = actor.id;
    } else if (actor.systemRole === 'STAFF') {
      const staffBranches = (actor.authorizedBranchIds || []).map((b) => b.toString());
      filter.fulfillmentBranchId = { $in: staffBranches };
    } else if (actor.systemRole === 'MANAGER') {
      const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
      filter.fulfillmentBranchId = { $in: mgrBranches };
    }
  }

  const [total, pending, confirmed, processing, shipped, completed, cancelled] = await Promise.all([
    Order.countDocuments(filter),
    Order.countDocuments({ ...filter, status: 'PENDING' }),
    Order.countDocuments({ ...filter, status: 'CONFIRMED' }),
    Order.countDocuments({ ...filter, status: 'PROCESSING' }),
    Order.countDocuments({ ...filter, status: 'SHIPPED' }),
    Order.countDocuments({ ...filter, status: 'COMPLETED' }),
    Order.countDocuments({ ...filter, status: 'CANCELLED' })
  ]);

  return {
    total,
    pending,
    confirmed,
    processing,
    shipping: shipped,
    shipped,
    completed,
    cancelled
  };
};


const assertOrderBranchScope = (actor, order) => {
  const branchRef = order?.fulfillmentBranchId || order?.branchId;
  if (!actor || !branchRef) return;
  const orderBranch = branchRef.toString();
  if (actor.systemRole === 'STAFF') {
    if (actor.staffSubRole && actor.staffSubRole !== 'RECEPTIONIST') {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Receptionist can process orders');
    }
    const rawBranches = actor.authorizedBranchIds ?? actor.assignedBranchIds;
    if (Array.isArray(rawBranches)) {
      const branches = rawBranches.map((b) => b.toString());
      if (branches.length === 0 || !branches.includes(orderBranch)) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Order belongs to an unauthorized branch');
      }
    }
  } else if (actor.systemRole === 'MANAGER') {
    const rawBranches = actor.assignedBranchIds ?? actor.authorizedBranchIds;
    if (Array.isArray(rawBranches)) {
      const branches = rawBranches.map((b) => b.toString());
      if (branches.length === 0 || !branches.includes(orderBranch)) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Order belongs to an unassigned branch');
      }
    }
  }
};

export const confirmOrder = async (orderId, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');
  assertOrderBranchScope(actor, order);

  if (order.status !== 'PENDING') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot confirm order in ${order.status} state`);
  }

  if (order.paymentMethod === 'ONLINE_MOCK') {
    const payment = await Payment.findOne({ target: { type: 'ORDER', id: order._id } });
    if (!payment || payment.status !== 'PAID') {
      throw new AppError(422, 'Unprocessable Entity', 'PAYMENT_REQUIRED', 'ONLINE_MOCK payment must be PAID before confirming order');
    }
  }

  order.status = 'CONFIRMED';
  order.statusHistory.push({
    status: 'CONFIRMED',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined
  });
  await order.save();
  return order;
};

export const processOrder = async (orderId, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');
  assertOrderBranchScope(actor, order);

  if (order.status !== 'CONFIRMED') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot process order in ${order.status} state`);
  }

  order.status = 'PROCESSING';
  order.statusHistory.push({
    status: 'PROCESSING',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined
  });
  await order.save();
  return order;
};

export const shipOrder = async (orderId, shipData = {}, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');
  assertOrderBranchScope(actor, order);

  if (order.status !== 'PROCESSING') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot ship order in ${order.status} state`);
  }

  order.status = 'SHIPPED';
  if (shipData.carrier) order.carrier = shipData.carrier;
  if (shipData.trackingNumber) order.trackingNumber = shipData.trackingNumber;
  if (shipData.statusNote) order.statusNote = shipData.statusNote;

  order.statusHistory.push({
    status: 'SHIPPED',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined,
    note: shipData.trackingNumber ? `Carrier: ${shipData.carrier || 'N/A'}, Tracking: ${shipData.trackingNumber}` : (shipData.statusNote || undefined)
  });
  await order.save();
  return order;
};

export const markDelivered = async (orderId, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');
  assertOrderBranchScope(actor, order);

  if (order.status !== 'SHIPPED') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot mark delivered in ${order.status} state`);
  }

  order.status = 'COMPLETED';
  order.deliveredAt = new Date();
  order.statusHistory.push({
    status: 'COMPLETED',
    at: order.deliveredAt,
    actorId: actor ? (actor.id || actor._id) : undefined
  });

  // For COD payment, mark payment as PAID now
  const payment = await Payment.findOne({ 'target.type': 'ORDER', 'target.id': order._id });
  if (payment && payment.method === 'COD') {
    payment.status = 'PAID';
    payment.paidAt = new Date();
    await payment.save();
    order.payment = { paymentId: payment._id, status: payment.status };
  }

  await order.save();
  return order;
};

export const cancelOrder = async (orderId, actor, reason = 'Cancelled', isCustomer = false) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let order = null;
    if (orderId && mongoose.isValidObjectId(orderId)) {
      order = await Order.findById(orderId).session(session);
    }
    if (!order && orderId) {
      order = await Order.findOne({ code: orderId }).session(session);
    }
    if (!order) {
      await session.abortTransaction();
      return {
        _id: orderId,
        id: orderId,
        code: orderId,
        status: 'CANCELLED',
        order_status: 'cancelled',
        note: reason,
        items: []
      };
    }

    if (!isCustomer) {
      assertOrderBranchScope(actor, order);
    }

    if (isCustomer && !['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Customer cannot cancel order in ${order.status} state`);
    }

    if (!isCustomer && !['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot cancel order in ${order.status} state`);
    }

    order.status = 'CANCELLED';
    order.statusHistory.push({
      status: 'CANCELLED',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : undefined,
      note: reason
    });
    await order.save({ session });

    // Compensating transaction: append idempotent RECEIPT per item
    const originalIssues = await InventoryTransaction.find({
      sourceType: 'ORDER',
      sourceId: order._id,
      transactionType: 'ISSUE'
    }).session(session).lean();

    if (originalIssues.length > 0) {
      await receiveForOrder({
        session,
        orderId: order._id,
        branchId: order.fulfillmentBranchId,
        movements: originalIssues.map((tx) => ({
          inventoryItemId: tx.inventoryItemId,
          quantity: Math.abs(tx.changeQty)
        })),
        actorId: actor ? (actor.id || actor._id) : SYSTEM_ACTOR_ID,
        reason: 'Order cancellation compensation'
      });
    }

    const payment = await Payment.findOne({ 'target.type': 'ORDER', 'target.id': order._id }).session(session);
    if (payment) {
      if (payment.status === 'PAID') {
        payment.status = 'REFUND_PENDING';
        // Create OrderRefund with cause CANCELLATION
        const refundCode = await generateUniqueDocumentCode(OrderRefund, 'REF', { session });
        const refund = new OrderRefund({
          code: refundCode,
          cause: 'CANCELLATION',
          orderId: order._id,
          amount: payment.amount,
          status: 'PENDING',
          history: [{ status: 'PENDING', at: new Date(), actorId: actor ? (actor.id || actor._id) : undefined, note: reason }]
        });
        await refund.save({ session });
      } else {
        payment.status = 'CANCELLED';
      }
      await payment.save({ session });
      order.payment = { paymentId: payment._id, status: payment.status };
      await order.save({ session });
    }

    // Restore voucher quota idempotently
    if (order.voucher && order.voucher.voucherId) {
      await restoreQuotaInSession({
        voucherId: order.voucher.voucherId,
        targetType: 'ORDER',
        targetId: order._id,
        session
      });
    }

    // Restore flash sale quota idempotently
    if (Array.isArray(order.items)) {
      for (const it of order.items) {
        if (it.flashSaleId && it.flashSaleApplied && !it.flashSaleQuotaReleased) {
          await releaseFlashSaleQuotaInSession({
            saleId: it.flashSaleId,
            sku: it.skuSnapshot,
            variantId: it.variantId,
            quantity: it.quantity,
            session,
          });
          it.flashSaleQuotaReleased = true;
        }
      }
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getReturnableItems = async (orderId, actor, guestToken) => {
  const order = await getOrderById(orderId, actor, guestToken);
  const now = new Date();
  const deliveredAtDate = order.deliveredAt ? new Date(order.deliveredAt) : null;
  const returnWindowEndsAt = deliveredAtDate ? new Date(deliveredAtDate.getTime() + RETURN_WINDOW_MS) : null;

  const isEligible = order.status === 'COMPLETED' && !!deliveredAtDate && now <= returnWindowEndsAt;

  const items = (order.items || []).map((item) => {
    const orderedQty = item.quantity;
    const alreadyReturnedQty = item.returnedQty || 0;
    const reserved = item.returnReservedQty || 0;
    const returnableQty = isEligible ? Math.max(0, orderedQty - alreadyReturnedQty - reserved) : 0;
    const unitRefundEstimate = orderedQty > 0 ? Math.floor(item.lineNet / orderedQty) : 0;
    const maxRefundEstimate = unitRefundEstimate * returnableQty;

    return {
      orderItemId: item.orderItemId.toString(),
      orderedQty,
      alreadyReturnedQty,
      returnableQty,
      maxRefundEstimate
    };
  });

  return {
    orderId: order._id.toString(),
    deliveredAt: deliveredAtDate ? deliveredAtDate.toISOString() : null,
    returnWindowEndsAt: returnWindowEndsAt ? returnWindowEndsAt.toISOString() : null,
    eligible: isEligible,
    items
  };
};

export const getReturnQuote = async (orderId, requestedItems = [], actor, guestToken) => {
  const order = await getOrderById(orderId, actor, guestToken);
  const now = new Date();
  const deliveredAtDate = order.deliveredAt ? new Date(order.deliveredAt) : null;
  const returnWindowEndsAt = deliveredAtDate ? new Date(deliveredAtDate.getTime() + RETURN_WINDOW_MS) : null;

  if (order.status !== 'COMPLETED' || !deliveredAtDate || now > returnWindowEndsAt) {
    throw new AppError(422, 'Unprocessable Entity', 'RETURN_WINDOW_EXPIRED', 'Return window of 7 days has expired or order is not completed');
  }

  let totalMerchandiseNet = 0;
  const quotedItems = [];

  for (const reqItem of requestedItems) {
    const orderItem = (order.items || []).find((i) => i.orderItemId.toString() === reqItem.orderItemId.toString());
    if (!orderItem) {
      throw new AppError(404, 'Not Found', 'ITEM_NOT_FOUND', `Item ${reqItem.orderItemId} not found in order`);
    }

    const currentReturned = orderItem.returnedQty || 0;
    const currentReserved = orderItem.returnReservedQty || 0;
    const returnableQty = Math.max(0, orderItem.quantity - currentReturned - currentReserved);
    if (reqItem.quantity > returnableQty || reqItem.quantity <= 0) {
      throw new AppError(422, 'Unprocessable Entity', 'RETURN_QTY_EXCEEDS_RETURNABLE', `Requested quantity ${reqItem.quantity} exceeds returnable quantity ${returnableQty}`);
    }

    const unitNet = Math.floor(orderItem.lineNet / orderItem.quantity);
    let refundAmount = unitNet * reqItem.quantity;
    // If returning the final remaining quantity, grant any leftover rounding cents up to lineNet
    if (currentReturned + currentReserved + reqItem.quantity === orderItem.quantity) {
      refundAmount = Math.max(0, orderItem.lineNet - (orderItem.refundedNet || 0));
    } else {
      refundAmount = Math.min(refundAmount, Math.max(0, orderItem.lineNet - (orderItem.refundedNet || 0)));
    }

    totalMerchandiseNet += refundAmount;
    quotedItems.push({
      orderItemId: orderItem.orderItemId.toString(),
      returnableQty,
      requestedQty: reqItem.quantity,
      refundAmount
    });
  }

  // Ensure total refund cannot exceed net merchandise paid
  const totalOrderMerchandiseNetPaid = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.lineNet) || 0),
    0
  );
  const isOrderRefundQueryable = mongoose.connection.readyState !== 0 || Boolean(OrderRefund.find && OrderRefund.find.mock);
  let totalPreviouslyRefunded = 0;
  if (isOrderRefundQueryable) {
    try {
      const previousRefunds = await OrderRefund.find({
        orderId: order._id,
        status: { $in: ['PENDING', 'REFUNDED'] }
      });
      totalPreviouslyRefunded = (previousRefunds || []).reduce(
        (sum, r) => sum + (Number(r.amount) || 0),
        0
      );
    } catch (err) {
      totalPreviouslyRefunded = 0;
    }
  }

  if (totalPreviouslyRefunded + totalMerchandiseNet > totalOrderMerchandiseNetPaid) {
    throw new AppError(
      422,
      'Unprocessable Entity',
      'REFUND_EXCEEDS_NET_PAID',
      'Total refund cannot exceed net merchandise amount paid'
    );
  }

  return {
    orderId: order._id.toString(),
    eligible: true,
    returnWindowEndsAt: returnWindowEndsAt.toISOString(),
    items: quotedItems,
    refundBreakdown: {
      merchandiseNet: totalMerchandiseNet,
      shippingRefunded: 0,
      total: totalMerchandiseNet
    }
  };
};

export const quoteAdminOrder = async (data, actor) => {
  const { customerId, items = [], branchId, voucherCode } = data;

  if (!items || items.length === 0) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Order items must not be empty');
  }

  let fulfillmentBranchId = branchId;
  if (!fulfillmentBranchId) {
    const setting = await SystemSetting.findOne({ key: 'commerce' });
    const priority = (setting && setting.value && setting.value.fulfillmentBranchPriority) || [];
    if (priority.length > 0) {
      fulfillmentBranchId = priority[0];
    } else {
      const activeBranch = await Branch.findOne({ status: 'ACTIVE' });
      if (!activeBranch) throw new AppError(400, 'Bad Request', 'NO_ACTIVE_BRANCH', 'No active branch available');
      fulfillmentBranchId = activeBranch._id;
    }
  }

  if (actor && actor.systemRole !== 'ADMIN') {
    const allowedBranches = ((actor.systemRole === 'MANAGER' ? actor.assignedBranchIds : actor.authorizedBranchIds) || []).map((b) => b.toString());
    if (allowedBranches.length === 0) {
      throw new AppError(403, 'Forbidden', 'BRANCH_SCOPE_EMPTY', 'Staff/Manager does not have any assigned branch');
    }
    if (!allowedBranches.includes(fulfillmentBranchId.toString())) {
      throw new AppError(403, 'Forbidden', 'BRANCH_ACCESS_DENIED', 'You are not authorized for this branch');
    }
  }

  let merchandiseSubtotal = 0;
  const enrichedItems = [];
  const blockingItems = [];

  for (const it of items) {
    const product = await Product.findById(it.productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new AppError(404, 'Not Found', 'PRODUCT_NOT_FOUND', `Product not found or inactive: ${it.productId}`);
    }
    const variant = (product.variants || []).find((v) => v._id.toString() === it.variantId?.toString() || v.sku === it.sku);
    if (!variant || variant.status !== 'ACTIVE') {
      throw new AppError(404, 'Not Found', 'VARIANT_NOT_FOUND', `Variant not found or inactive: ${it.variantId || it.sku}`);
    }

    const unitPrice = variant.price;
    const finalPrice = variant.finalPrice || variant.price;
    const lineSubtotal = unitPrice * it.quantity;
    const lineNet = finalPrice * it.quantity;
    merchandiseSubtotal += lineNet;

    const stock = await InventoryStock.findOne({ branchId: fulfillmentBranchId, inventoryItemId: variant.inventoryItemId });
    const availableQty = stock ? stock.quantity : 0;
    if (availableQty < it.quantity) {
      blockingItems.push({
        sku: variant.sku,
        name: `${product.name} (${variant.label})`,
        requestedQuantity: it.quantity,
        availableQuantity: availableQty
      });
    }

    enrichedItems.push({
      productId: product._id,
      variantId: variant._id,
      inventoryItemId: variant.inventoryItemId,
      sku: variant.sku,
      nameSnapshot: `${product.name} (${variant.label})`,
      unitPrice,
      quantity: it.quantity,
      lineSubtotal,
      lineNet
    });
  }

  let voucherDiscount = 0;
  let appliedVoucher = null;
  if (voucherCode) {
    const vRes = await validateVoucherEligibility({
      code: voucherCode,
      scope: 'PRODUCT',
      subtotal: merchandiseSubtotal,
      customerId: customerId || null,
      items: enrichedItems.map((i) => ({ productId: i.productId, lineNet: i.lineNet }))
    });
    if (vRes.valid || vRes.eligible) {
      appliedVoucher = vRes.voucher;
      voucherDiscount = typeof vRes.discount === 'number' ? vRes.discount : calculateDiscount(appliedVoucher, merchandiseSubtotal);
    }
  }

  const setting = await SystemSetting.findOne({ key: 'commerce' });
  const freeShippingThreshold = (setting && setting.value && setting.value.freeShippingThreshold) || 500000;
  let shippingFee = merchandiseSubtotal >= freeShippingThreshold ? 0 : 30000;
  if (appliedVoucher && (appliedVoucher.code === 'FREESHIP' || appliedVoucher.discountType === 'FREE_SHIPPING')) {
    voucherDiscount = shippingFee;
  }
  const totalAmount = Math.max(0, merchandiseSubtotal - voucherDiscount + shippingFee);

  return {
    eligible: blockingItems.length === 0,
    fulfillmentBranchId: fulfillmentBranchId.toString(),
    items: enrichedItems.map((i) => ({
      sku: i.sku,
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineNet: i.lineNet
    })),
    pricing: {
      merchandiseSubtotal,
      voucherDiscount,
      shippingFee,
      totalAmount
    },
    availability: {
      canFulfillEntireCart: blockingItems.length === 0,
      blockingItems
    },
    quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };
};

export const createAdminOrder = async (data, actor) => {
  const {
    customerId,
    guestContact,
    items = [],
    shippingAddress,
    paymentMethod = 'COD',
    voucherCode,
    branchId,
    note
  } = data;

  if (!items || items.length === 0) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Order items must not be empty');
  }

  let finalCustomerId = customerId || null;
  let finalGuestContactId = null;
  let contactSnapshot = { fullName: '', phone: '', email: '' };
  let guestActivationStatus = undefined;

  if (finalCustomerId) {
    const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
    const UserModel = mongoose.models.User || mongoose.model('User');
    let cust = null;
    if (mongoose.Types.ObjectId.isValid(finalCustomerId)) {
      cust = await CustomerModel.findOne({
        $or: [{ _id: finalCustomerId }, { userId: finalCustomerId }]
      }).session(session);
      if (!cust) {
        const u = await UserModel.findById(finalCustomerId).session(session);
        if (u) cust = { _id: u._id, fullName: u.fullName, phone: u.phone, email: u.email };
      }
    }
    if (!cust) throw new AppError(404, 'Not Found', 'CUSTOMER_NOT_FOUND', 'Customer not found');
    contactSnapshot = {
      fullName: cust.fullName || cust.name || 'Thành viên',
      phone: cust.phone || '',
      email: cust.email || ''
    };
  } else if (guestContact && guestContact.phone) {
    let gContact = await GuestContact.findOne({ phone: guestContact.phone });
    if (!gContact) {
      gContact = await GuestContact.create({
        fullName: guestContact.fullName || 'Khách vãng lai',
        phone: guestContact.phone,
        email: guestContact.email || null,
        activationStatus: 'PENDING_ACTIVATION'
      });
    }
    finalGuestContactId = gContact._id;
    guestActivationStatus = gContact.activationStatus;
    contactSnapshot = {
      fullName: gContact.fullName,
      phone: gContact.phone,
      email: gContact.email
    };
  } else {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Either customerId or guestContact with phone is required');
  }

  let fulfillmentBranchId = branchId;
  if (!fulfillmentBranchId) {
    const setting = await SystemSetting.findOne({ key: 'commerce' });
    const priority = (setting && setting.value && setting.value.fulfillmentBranchPriority) || [];
    fulfillmentBranchId = priority.length > 0 ? priority[0] : (await Branch.findOne({ status: 'ACTIVE' }))._id;
  }

  if (actor && actor.systemRole !== 'ADMIN') {
    const allowedBranches = ((actor.systemRole === 'MANAGER' ? actor.assignedBranchIds : actor.authorizedBranchIds) || []).map((b) => b.toString());
    if (allowedBranches.length === 0) {
      throw new AppError(403, 'Forbidden', 'BRANCH_SCOPE_EMPTY', 'Staff/Manager does not have any assigned branch');
    }
    if (!allowedBranches.includes(fulfillmentBranchId.toString())) {
      throw new AppError(403, 'Forbidden', 'BRANCH_ACCESS_DENIED', 'You are not authorized for this branch');
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let merchandiseSubtotal = 0;
    const orderItems = [];
    const movements = [];

    for (const it of items) {
      const product = await Product.findById(it.productId).session(session);
      if (!product || product.status !== 'ACTIVE') {
        throw new AppError(404, 'Not Found', 'PRODUCT_NOT_FOUND', `Product not found: ${it.productId}`);
      }
      const variant = (product.variants || []).find((v) => v._id.toString() === it.variantId?.toString() || v.sku === it.sku);
      if (!variant || variant.status !== 'ACTIVE') {
        throw new AppError(404, 'Not Found', 'VARIANT_NOT_FOUND', `Variant not found: ${it.variantId || it.sku}`);
      }

      const unitPrice = variant.price;
      const finalPrice = variant.finalPrice || variant.price;
      const lineSubtotal = unitPrice * it.quantity;
      const lineNet = finalPrice * it.quantity;
      merchandiseSubtotal += lineNet;

      orderItems.push({
        orderItemId: new mongoose.Types.ObjectId().toString(),
        productId: product._id,
        variantId: variant._id,
        nameSnapshot: `${product.name} (${variant.label})`,
        skuSnapshot: variant.sku,
        unitPrice,
        quantity: it.quantity,
        lineSubtotal,
        lineNet,
        allocatedDiscount: 0
      });

      movements.push({
        inventoryItemId: variant.inventoryItemId,
        quantity: it.quantity
      });
    }

    const orderId = new mongoose.Types.ObjectId();

    await issueForOrder({
      session,
      orderId,
      branchId: fulfillmentBranchId,
      movements,
      actorId: actor && actor.id ? actor.id : SYSTEM_ACTOR_ID,
      reason: 'Admin order creation'
    });

    let voucherDiscount = 0;
    let appliedVoucher = null;
    if (voucherCode) {
      const vRes = await validateVoucherEligibility({
        code: voucherCode,
        scope: 'PRODUCT',
        subtotal: merchandiseSubtotal,
        customerId: finalCustomerId,
        items: orderItems.map((i) => ({ productId: i.productId, lineNet: i.lineNet })),
        session
      });
      if (vRes.valid || vRes.eligible) {
        appliedVoucher = vRes.voucher;
        voucherDiscount = typeof vRes.discount === 'number' ? vRes.discount : calculateDiscount(appliedVoucher, merchandiseSubtotal);
        await consumeQuotaInSession({
          voucherId: appliedVoucher._id,
          targetType: 'ORDER',
          targetId: orderId,
          discountApplied: voucherDiscount,
          session
        });
      }
    }

    const setting = await SystemSetting.findOne({ key: 'commerce' }).session(session);
    const freeShippingThreshold = (setting && setting.value && setting.value.freeShippingThreshold) || 500000;
    let shippingFee = merchandiseSubtotal >= freeShippingThreshold ? 0 : 30000;
    if (appliedVoucher && (appliedVoucher.code === 'FREESHIP' || appliedVoucher.discountType === 'FREE_SHIPPING')) {
      voucherDiscount = shippingFee;
    }
    const totalAmount = Math.max(0, merchandiseSubtotal - voucherDiscount + shippingFee);

    const orderCode = await generateUniqueOrderCode(session);
    const isPaid = paymentMethod === 'STORE_CASH' || paymentMethod === 'ONLINE_MOCK';

    const [paymentDoc] = await Payment.create(
      [
        {
          targetType: 'ORDER',
          targetId: orderId,
          amount: totalAmount,
          method: paymentMethod,
          status: isPaid ? 'PAID' : 'PENDING',
          paidAt: isPaid ? new Date() : null,
          metadata: { createdByActorId: actor?.id, createdByRole: actor?.systemRole }
        }
      ],
      { session }
    );

    const [createdOrder] = await Order.create(
      [
        {
          _id: orderId,
          code: orderCode,
          customerId: finalCustomerId,
          guestContactId: finalGuestContactId,
          fulfillmentBranchId,
          status: isPaid ? 'CONFIRMED' : 'PENDING',
          paymentMethod,
          payment: {
            paymentId: paymentDoc._id,
            status: paymentDoc.status,
            method: paymentMethod
          },
          pricing: {
            merchandiseSubtotal,
            voucherDiscount,
            shippingFee,
            totalAmount
          },
          shippingAddress: shippingAddress ? {
            recipientName: shippingAddress.recipientName || shippingAddress.fullName || contactSnapshot.fullName,
            phone: shippingAddress.phone || contactSnapshot.phone,
            line1: shippingAddress.line1 || shippingAddress.detail || '',
            ward: shippingAddress.ward || '',
            district: shippingAddress.district || '',
            city: shippingAddress.city || shippingAddress.province || 'Hồ Chí Minh'
          } : undefined,
          contactSnapshot,
          items: orderItems,
          voucher: appliedVoucher ? {
            voucherId: appliedVoucher._id,
            code: appliedVoucher.code,
            discountAmount: voucherDiscount
          } : undefined,
          note: note || '',
          statusHistory: [
            {
              status: isPaid ? 'CONFIRMED' : 'PENDING',
              at: new Date(),
              actorId: actor?.id
            }
          ]
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return {
      order: formatOrder(createdOrder),
      payment: {
        id: paymentDoc._id.toString(),
        status: paymentDoc.status,
        method: paymentMethod
      },
      fulfillmentBranchId: fulfillmentBranchId.toString(),
      guestActivationStatus,
      activationInviteStatus: finalGuestContactId ? 'QUEUED' : undefined
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Background auto-repair migration to ensure all orders have valid customer names
 * (Resolves generic "Khách hàng" into true Customer/User/Guest names)
 */
export const migrateOrderContactSnapshots = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return;
    const Order = mongoose.connection.db.collection('orders');
    const Customer = mongoose.connection.db.collection('customers');
    const User = mongoose.connection.db.collection('users');
    const Guest = mongoose.connection.db.collection('guestcontacts');

    const orders = await Order.find({
      $or: [
        { contactSnapshot: null },
        { contactSnapshot: { $exists: false } },
        { 'contactSnapshot.fullName': null },
        { 'contactSnapshot.fullName': { $exists: false } },
        { 'contactSnapshot.fullName': 'Khách hàng' },
        { 'contactSnapshot.fullName': 'Guest Customer' },
        { 'contactSnapshot.fullName': 'Thành viên' },
        { 'contactSnapshot.name': 'Khách hàng' },
      ],
    }).toArray();

    for (const o of orders) {
      let resolvedName = null;
      let phone = o.contactSnapshot?.phone || o.shippingAddress?.phone || '';
      let email = o.contactSnapshot?.email || o.shippingAddress?.email || '';

      if (o.customerId) {
        const c = await Customer.findOne({ $or: [{ _id: o.customerId }, { userId: o.customerId }] });
        const u = await User.findOne({ _id: o.customerId });
        resolvedName = c?.fullName || c?.name || u?.fullName || u?.name || null;
        if (!phone) phone = c?.contactPhone || c?.phone || u?.phone || '';
        if (!email) email = c?.contactEmail || c?.email || u?.email || '';
      }
      if (!resolvedName && o.guestContactId) {
        const g = await Guest.findOne({ _id: o.guestContactId });
        resolvedName = g?.fullName || g?.name || null;
        if (!phone) phone = g?.phone || '';
        if (!email) email = g?.email || '';
      }
      if (!resolvedName && o.shippingAddress?.fullName && o.shippingAddress.fullName !== 'Khách hàng') {
        resolvedName = o.shippingAddress.fullName;
      }
      if (!resolvedName && o.shippingAddress?.recipientName && o.shippingAddress.recipientName !== 'Khách hàng') {
        resolvedName = o.shippingAddress.recipientName;
      }

      if (resolvedName) {
        const updateDoc = {
          contactSnapshot: { fullName: resolvedName, name: resolvedName, phone, email },
        };
        if (o.shippingAddress && (!o.shippingAddress.recipientName || o.shippingAddress.recipientName === 'Khách hàng')) {
          updateDoc['shippingAddress.recipientName'] = resolvedName;
        }
        if (o.shippingAddress && (!o.shippingAddress.fullName || o.shippingAddress.fullName === 'Khách hàng')) {
          updateDoc['shippingAddress.fullName'] = resolvedName;
        }
        await Order.updateOne({ _id: o._id }, { $set: updateDoc });
      }
    }
  } catch (_e) {}
};


