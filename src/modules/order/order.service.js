import mongoose from 'mongoose';
import Order from './models/Order';
import Payment from '../payment/models/Payment';
import Cart from '../cart/models/Cart';
import Branch from '../branch/models/Branch';
import InventoryStock from '../inventory/models/InventoryStock';
import InventoryTransaction from '../inventory/models/InventoryTransaction';
import SystemSetting from '../settings/models/SystemSetting';
import Product from '../catalog/models/Product';
import OrderRefund from './models/OrderRefund';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { issueForOrder, receiveForOrder, SYSTEM_ACTOR_ID } from '../inventory/inventory.service';
import { validateVoucherEligibility, consumeQuotaInSession, restoreQuotaInSession } from './voucher.service';

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

const makeOrderCode = () => `ORD-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;

export const checkoutCreateOrder = async (data, actor, guestToken) => {
  const { cartId, paymentMethod, shippingAddress, contact, voucherCode, note } = data;
  if (!['ONLINE_MOCK', 'COD'].includes(paymentMethod)) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Order paymentMethod must be ONLINE_MOCK or COD');
  }

  const query = actor ? { _id: cartId, customerId: actor.id } : { _id: cartId, tokenHash: guestToken };
  const cart = await Cart.findOne(query);
  if (!cart || cart.items.length === 0) {
    throw new AppError(400, 'Validation Error', 'EMPTY_CART', 'Cart is empty or not found');
  }

  const resolvedItems = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new AppError(422, 'Unprocessable Entity', ErrorCodes.PRODUCT_NOT_PURCHASABLE, 'Product is not purchasable');
    }
    const variant = product.variants && item.variantId
      ? (product.variants.id ? product.variants.id(item.variantId) : product.variants.find((entry) => entry._id.toString() === item.variantId.toString()))
      : null;
    if (!variant || variant.status !== 'ACTIVE' || !variant.inventoryItemId) {
      throw new AppError(422, 'Unprocessable Entity', ErrorCodes.PRODUCT_NOT_PURCHASABLE, 'Product variant is not purchasable');
    }
    resolvedItems.push({
      productId: item.productId,
      variantId: item.variantId,
      inventoryItemId: variant.inventoryItemId,
      nameSnapshot: `${product.name} - ${variant.label}`,
      skuSnapshot: variant.sku,
      quantity: item.quantity,
      unitPrice: variant.finalPrice || variant.price
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

    const session = await mongoose.startSession();
    let createdOrder;
    try {
      await session.withTransaction(async () => {
        const currentCart = await Cart.findOne(query).session(session);
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

        const freeShippingThreshold = (setting && setting.value && setting.value.freeShippingThreshold) || 500000;
        const shippingFee = merchandiseSubtotal >= freeShippingThreshold ? 0 : 30000;
        const totalAmount = Math.max(0, merchandiseSubtotal - voucherDiscount + shippingFee);

        let allocatedSum = 0;
        const orderItems = resolvedItems.map((item, idx) => {
          const lineSubtotal = item.unitPrice * item.quantity;
          let allocatedDiscount = 0;
          if (voucherDiscount > 0 && merchandiseSubtotal > 0) {
            if (idx === resolvedItems.length - 1) {
              allocatedDiscount = voucherDiscount - allocatedSum;
            } else {
              allocatedDiscount = Math.round((lineSubtotal / merchandiseSubtotal) * voucherDiscount);
              allocatedSum += allocatedDiscount;
            }
          }
          const lineNet = Math.max(0, lineSubtotal - allocatedDiscount);
          return {
            orderItemId: new mongoose.Types.ObjectId().toString(),
            productId: item.productId,
            variantId: item.variantId,
            nameSnapshot: item.nameSnapshot,
            skuSnapshot: item.skuSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineSubtotal,
            allocatedDiscount,
            lineNet,
            returnReservedQty: 0,
            returnedQty: 0,
            refundedNet: 0
          };
        });

        createdOrder = new Order({
          _id: orderId,
          code: makeOrderCode(),
          customerId: actor ? actor.id : undefined,
          fulfillmentBranchId: branch._id,
          status: 'PENDING',
          paymentMethod,
          items: orderItems,
          pricing: { merchandiseSubtotal, voucherDiscount, shippingFee, totalAmount },
          voucher: appliedVoucher ? { voucherId: appliedVoucher._id, code: appliedVoucher.code } : undefined,
          shippingAddress,
          contactSnapshot: contact ? { email: contact.email, phone: contact.phone } : {},
          statusHistory: [{ status: 'PENDING', at: new Date(), actorId: actor ? actor.id : undefined }]
        });
        await createdOrder.save({ session });

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
        await currentCart.save({ session });
      });
      return createdOrder;
    } catch (error) {
      if (![ErrorCodes.INSUFFICIENT_INVENTORY, ErrorCodes.CONCURRENCY_CONFLICT].includes(error.code)) throw error;
      lastInventoryError = error;
    } finally {
      await session.endSession();
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

  const result = {
    id: obj._id.toString(),
    code: obj.code,
    customerId: obj.customerId ? obj.customerId.toString() : null,
    fulfillmentBranchId: obj.fulfillmentBranchId.toString(),
    status: obj.status,
    items: (obj.items || []).map((item) => ({
      orderItemId: item.orderItemId.toString(),
      productId: item.productId.toString(),
      ...(item.variantId ? { variantId: item.variantId.toString() } : {}),
      ...(item.skuSnapshot ? { skuSnapshot: item.skuSnapshot } : {}),
      name: item.nameSnapshot,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineSubtotal: item.lineSubtotal,
      allocatedDiscount: item.allocatedDiscount,
      lineNet: item.lineNet,
      returnedQty: item.returnedQty || 0
    })),
    pricing: {
      merchandiseSubtotal: obj.pricing.merchandiseSubtotal,
      voucherDiscount: obj.pricing.voucherDiscount,
      shippingFee: obj.pricing.shippingFee,
      totalAmount: obj.pricing.totalAmount
    },
    voucherCode: obj.voucher && obj.voucher.code ? obj.voucher.code : null,
    shippingAddress: obj.shippingAddress,
    contactSnapshot: obj.contactSnapshot || {},
    paymentMethod: obj.paymentMethod,
    payment: obj.payment && obj.payment.paymentId ? {
      paymentId: obj.payment.paymentId.toString(),
      status: obj.payment.status
    } : undefined,
    deliveredAt: deliveredAtDate ? deliveredAtDate.toISOString() : null,
    returnWindowEndsAt: returnWindowEndsAtDate ? returnWindowEndsAtDate.toISOString() : null,
    allowedActions,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : undefined
  };

  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

export const getOrderById = async (orderId, actor, guestToken) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

  // Verify ownership / access permission
  if (actor) {
    if (actor.systemRole === 'CUSTOMER') {
      if (!order.customerId || order.customerId.toString() !== actor.id) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You do not own this order');
      }
    } else if (actor.systemRole === 'STAFF') {
      const staffBranches = (actor.authorizedBranchIds || []).map((b) => b.toString());
      if (staffBranches.length > 0 && !staffBranches.includes(order.fulfillmentBranchId.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Order belongs to a different branch');
      }
    } else if (actor.systemRole === 'MANAGER') {
      const mgrBranches = (actor.assignedBranchIds || []).map((b) => b.toString());
      if (mgrBranches.length > 0 && !mgrBranches.includes(order.fulfillmentBranchId.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Order belongs to an unassigned branch');
      }
    }
  } else if (guestToken) {
    // Guest verification via contactSnapshot phone or token
  }

  return order;
};

export const listOrders = async (query = {}, actor) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = query.customerId;
  if (query.branchId) filter.fulfillmentBranchId = query.branchId;

  if (actor) {
    if (actor.systemRole === 'CUSTOMER') {
      filter.customerId = actor.id;
    } else if (actor.systemRole === 'STAFF') {
      const staffBranches = (actor.authorizedBranchIds || []).map((b) => b.toString());
      if (staffBranches.length > 0) {
        filter.fulfillmentBranchId = { $in: staffBranches };
      }
    } else if (actor.systemRole === 'MANAGER') {
      const mgrBranches = (actor.assignedBranchIds || []).map((b) => b.toString());
      if (mgrBranches.length > 0) {
        filter.fulfillmentBranchId = { $in: mgrBranches };
      }
    }
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit);
  return {
    items: orders.map(formatOrder),
    nextCursor: null
  };
};

export const confirmOrder = async (orderId, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

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

  if (order.status !== 'PROCESSING') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot ship order in ${order.status} state`);
  }

  order.status = 'SHIPPED';
  order.statusHistory.push({
    status: 'SHIPPED',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined,
    note: shipData.trackingNumber ? `Carrier: ${shipData.carrier || 'N/A'}, Tracking: ${shipData.trackingNumber}` : undefined
  });
  await order.save();
  return order;
};

export const markDelivered = async (orderId, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

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
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

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
        const refund = new OrderRefund({
          code: `REF-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`,
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

    const returnableQty = Math.max(0, orderItem.quantity - (orderItem.returnedQty || 0) - (orderItem.returnReservedQty || 0));
    if (reqItem.quantity > returnableQty || reqItem.quantity <= 0) {
      throw new AppError(422, 'Unprocessable Entity', 'RETURN_QTY_EXCEEDS_RETURNABLE', `Requested quantity ${reqItem.quantity} exceeds returnable quantity ${returnableQty}`);
    }

    const unitNet = Math.floor(orderItem.lineNet / orderItem.quantity);
    let refundAmount = unitNet * reqItem.quantity;
    // If returning the final remaining quantity, grant any leftover rounding cents up to lineNet
    if ((orderItem.returnedQty || 0) + reqItem.quantity === orderItem.quantity) {
      refundAmount = Math.max(0, orderItem.lineNet - (orderItem.refundedNet || 0));
    }

    totalMerchandiseNet += refundAmount;
    quotedItems.push({
      orderItemId: orderItem.orderItemId.toString(),
      returnableQty,
      requestedQty: reqItem.quantity,
      refundAmount
    });
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
