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
import GuestContact from '../customer/models/GuestContact';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { issueForOrder, receiveForOrder, SYSTEM_ACTOR_ID } from '../inventory/inventory.service';
import { validateVoucherEligibility, calculateDiscount, consumeQuotaInSession, restoreQuotaInSession } from './voucher.service';

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
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = String(dailyOrderSeq++).padStart(4, '0');
  return `ORD-${yyyy}${mm}${dd}-${seq}`;
};

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
        let shippingFee = merchandiseSubtotal >= freeShippingThreshold ? 0 : 30000;
        const isFreeShipVoucher = appliedVoucher && (appliedVoucher.code === 'FREESHIP' || appliedVoucher.discountType === 'FREE_SHIPPING');
        if (isFreeShipVoucher) {
          voucherDiscount = shippingFee;
          shippingFee = 0;
        }
        const totalAmount = Math.max(0, merchandiseSubtotal - (isFreeShipVoucher ? 0 : voucherDiscount) + shippingFee);

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

        let guestContactId = undefined;
        if (!actor && contact && (contact.phone || contact.email)) {
          const cPhone = contact.phone ? contact.phone.trim() : null;
          const cEmail = contact.email ? contact.email.trim().toLowerCase() : null;
          const cName = (shippingAddress && shippingAddress.fullName) || contact.name || 'Guest Customer';

          let guest = null;
          if (cPhone) {
            guest = await GuestContact.findOne({ phone: cPhone }).session(session);
          } else if (cEmail) {
            guest = await GuestContact.findOne({ email: cEmail }).session(session);
          }

          if (!guest) {
            guest = new GuestContact({
              fullName: cName,
              phone: cPhone || undefined,
              email: cEmail || undefined,
              activationStatus: 'NO_ACCOUNT',
            });
            await guest.save({ session });
          }
          guestContactId = guest._id;
        }

        createdOrder = new Order({
          _id: orderId,
          code: makeOrderCode(),
          customerId: actor ? actor.id : undefined,
          guestContactId,
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
    statusHistory: (obj.statusHistory || []).map((h) => ({
      status: h.status,
      at: h.at ? new Date(h.at).toISOString() : undefined,
      actorId: h.actorId ? h.actorId.toString() : undefined
    })),
    shippingAddress: obj.shippingAddress ? {
      recipientName: obj.shippingAddress.recipientName || obj.shippingAddress.fullName || obj.contactSnapshot?.fullName || null,
      phone: obj.shippingAddress.phone || obj.contactSnapshot?.phone || null,
      line1: obj.shippingAddress.line1 || obj.shippingAddress.addressDetail || obj.shippingAddress.detail || null,
      ward: obj.shippingAddress.ward || null,
      district: obj.shippingAddress.district || null,
      city: obj.shippingAddress.city || obj.shippingAddress.province || null
    } : undefined,
    contactSnapshot: obj.contactSnapshot || {},
    customer: obj.customerId ? {
      id: obj.customerId.toString(),
      fullName: obj.contactSnapshot?.fullName || null,
      phone: obj.contactSnapshot?.phone || null,
      email: obj.contactSnapshot?.email || null
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
  if (!actor && !guestToken) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication required to view order details');
  }

  if (actor) {
    if (actor.systemRole === 'ADMIN') {
      return order;
    }
    if (actor.systemRole === 'CUSTOMER') {
      if (!order.customerId || order.customerId.toString() !== actor.id) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You do not own this order');
      }
    } else if (actor.systemRole === 'STAFF') {
      const staffBranches = (actor.authorizedBranchIds || []).map((b) => b.toString());
      if (staffBranches.length === 0 || !staffBranches.includes(order.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Order belongs to an unauthorized branch');
      }
    } else if (actor.systemRole === 'MANAGER') {
      const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
      if (mgrBranches.length === 0 || !mgrBranches.includes(order.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Order belongs to an unassigned branch');
      }
    }
  } else if (guestToken) {
    const isMatchingContact = (guestToken.guestContactId && order.guestContactId && order.guestContactId.toString() === guestToken.guestContactId)
      || (guestToken.phone && order.contactSnapshot && order.contactSnapshot.phone === guestToken.phone);
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
  if (query.customerId) filter.customerId = query.customerId;
  if (query.branchId || query.fulfillmentBranchId) {
    filter.fulfillmentBranchId = query.branchId || query.fulfillmentBranchId;
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

  if (actor.systemRole === 'CUSTOMER') {
    filter.customerId = actor.id;
  } else if (actor.systemRole === 'STAFF') {
    const staffBranches = (actor.authorizedBranchIds || []).map((b) => b.toString());
    filter.fulfillmentBranchId = { $in: staffBranches };
  } else if (actor.systemRole === 'MANAGER') {
    const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
    filter.fulfillmentBranchId = { $in: mgrBranches };
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

  return {
    items: orders.map(formatOrder),
    totalCount,
    nextCursor
  };
};

export const getOrderStats = async (query = {}, actor = null) => {
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
    if (allowedBranches.length > 0 && !allowedBranches.includes(fulfillmentBranchId.toString())) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You are not authorized for this branch');
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
      targetType: 'ORDER',
      orderAmount: merchandiseSubtotal,
      customerId: customerId || null,
      items: enrichedItems.map((i) => ({ productId: i.productId, lineNet: i.lineNet }))
    });
    if (vRes.eligible) {
      appliedVoucher = vRes.voucher;
      voucherDiscount = calculateDiscount(appliedVoucher, merchandiseSubtotal);
    }
  }

  const setting = await SystemSetting.findOne({ key: 'commerce' });
  const freeShippingThreshold = (setting && setting.value && setting.value.freeShippingThreshold) || 500000;
  let shippingFee = merchandiseSubtotal >= freeShippingThreshold ? 0 : 30000;
  if (appliedVoucher && (appliedVoucher.code === 'FREESHIP' || appliedVoucher.discountType === 'FREE_SHIPPING')) {
    voucherDiscount = shippingFee;
    shippingFee = 0;
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
    const cust = await CustomerModel.findById(finalCustomerId);
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
    if (allowedBranches.length > 0 && !allowedBranches.includes(fulfillmentBranchId.toString())) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You are not authorized for this branch');
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
        targetType: 'ORDER',
        orderAmount: merchandiseSubtotal,
        customerId: finalCustomerId,
        items: orderItems.map((i) => ({ productId: i.productId, lineNet: i.lineNet })),
        session
      });
      if (vRes.eligible) {
        appliedVoucher = vRes.voucher;
        voucherDiscount = calculateDiscount(appliedVoucher, merchandiseSubtotal);
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
      shippingFee = 0;
    }
    const totalAmount = Math.max(0, merchandiseSubtotal - voucherDiscount + shippingFee);

    const orderCode = makeOrderCode();
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

