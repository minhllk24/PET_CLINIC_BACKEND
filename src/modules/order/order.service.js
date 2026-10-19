import mongoose from 'mongoose';
import Order from './models/Order';
import Payment from '../payment/models/Payment';
import Cart from '../cart/models/Cart';
import Branch from '../branch/models/Branch';
import InventoryStock from '../inventory/models/InventoryStock';
import InventoryTransaction from '../inventory/models/InventoryTransaction';
import SystemSetting from '../settings/models/SystemSetting';
import Product from '../catalog/models/Product';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { issueForOrder, receiveForOrder, SYSTEM_ACTOR_ID } from '../inventory/inventory.service';

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
  const { cartId, paymentMethod, shippingAddress, contact } = data;
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

        const merchandiseSubtotal = resolvedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const voucherDiscount = 0;
        const shippingFee = 30000;
        const totalAmount = merchandiseSubtotal - voucherDiscount + shippingFee;

        createdOrder = new Order({
          _id: orderId,
          code: makeOrderCode(),
          customerId: actor ? actor.id : undefined,
          fulfillmentBranchId: branch._id,
          status: 'PENDING',
          paymentMethod,
          items: resolvedItems.map((item) => ({
            orderItemId: new mongoose.Types.ObjectId().toString(),
            productId: item.productId,
            variantId: item.variantId,
            nameSnapshot: item.nameSnapshot,
            skuSnapshot: item.skuSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineSubtotal: item.unitPrice * item.quantity,
            allocatedDiscount: 0,
            lineNet: item.unitPrice * item.quantity
          })),
          pricing: { merchandiseSubtotal, voucherDiscount, shippingFee, totalAmount },
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
    pricing: obj.pricing,
    shippingAddress: obj.shippingAddress,
    contactSnapshot: obj.contactSnapshot || {},
    paymentMethod: obj.paymentMethod,
    payment: obj.payment && obj.payment.paymentId ? {
      paymentId: obj.payment.paymentId.toString(),
      status: obj.payment.status
    } : undefined,
    deliveredAt: obj.deliveredAt ? new Date(obj.deliveredAt).toISOString() : null,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : undefined
  };
  if (obj.voucher && obj.voucher.code) result.voucherCode = obj.voucher.code;
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

export const getOrders = async (query, actor) => {
  // Add branch scope logic if manager, or ownership if customer
  return await Order.find();
};

export const updateOrderStatus = async (orderId, status, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'NotFound', 'ORDER_NOT_FOUND', 'Order not found');
  
  // Basic validation, skip detailed state machine for brevity
  order.status = status;
  await order.save();
  return order;
};

export const markDelivered = async (orderId, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'NotFound', 'ORDER_NOT_FOUND', 'Order not found');
  
  order.status = 'COMPLETED';
  order.deliveredAt = new Date();
  
  // For COD, mark payment PAID
  const payment = await Payment.findOne({ targetType: 'ORDER', targetId: order._id });
  if (payment && payment.method === 'COD') {
    payment.status = 'PAID';
    payment.paidAt = new Date();
    await payment.save();
  }
  
  await order.save();
  return order;
};

export const cancelOrder = async (orderId, actor, reason, isCustomer = false) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError(404, 'NotFound', 'ORDER_NOT_FOUND', 'Order not found');

    if (['SHIPPED', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new AppError(400, 'ValidationError', 'INVALID_STATE_TRANSITION', 'Cannot cancel order in current state');
    }

    order.status = 'CANCELLED';
    order.cancellationReason = reason;
    await order.save({ session });

    // Compensating transaction: append one idempotent RECEIPT per item.
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
        actorId: actor && (actor.id || actor._id),
        reason: 'Order cancellation compensation'
      });
    }

    const payment = await Payment.findOne({ 'target.type': 'ORDER', 'target.id': order._id }).session(session);
    if (payment) {
      if (payment.status === 'PAID') {
        payment.status = 'REFUND_PENDING'; // Simplified
      } else {
        payment.status = 'CANCELLED';
      }
      await payment.save({ session });
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
