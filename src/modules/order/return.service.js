import mongoose from 'mongoose';
import Order from './models/Order';
import OrderReturn from './models/OrderReturn';
import OrderRefund from './models/OrderRefund';
import Payment from '../payment/models/Payment';
import AppError from '../../utils/AppError';

const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const formatOrderReturn = (ret) => {
  const obj = typeof ret.toObject === 'function' ? ret.toObject() : ret;
  const result = {
    id: obj._id.toString(),
    orderId: obj.orderId.toString(),
    status: obj.status,
    items: (obj.items || []).map((item) => ({
      orderItemId: item.orderItemId.toString(),
      productName: item.productName,
      orderedQty: item.orderedQty,
      alreadyReturnedQty: item.alreadyReturnedQty || 0,
      requestedQty: item.requestedQty,
      refundAmount: item.refundAmount
    })),
    reason: obj.reason,
    refundBreakdown: {
      merchandiseNet: obj.refundBreakdown.merchandiseNet,
      shippingRefunded: 0,
      total: obj.refundBreakdown.total
    },
    refundId: obj.refundId ? obj.refundId.toString() : null,
    history: (obj.history || []).map((h) => ({
      status: h.status,
      at: h.at ? new Date(h.at).toISOString() : new Date().toISOString(),
      ...(h.actorId ? { actorId: h.actorId.toString() } : {}),
      ...(h.note ? { note: h.note } : {})
    }))
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

export const formatOrderRefund = (refund) => {
  const obj = typeof refund.toObject === 'function' ? refund.toObject() : refund;
  const result = {
    id: obj._id.toString(),
    cause: obj.cause,
    orderReturnId: obj.orderReturnId ? obj.orderReturnId.toString() : null,
    orderId: obj.orderId.toString(),
    amount: obj.amount,
    status: obj.status,
    provider: 'MOCK',
    refundedAt: obj.refundedAt ? new Date(obj.refundedAt).toISOString() : null
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

export const createReturn = async (data, actor, guestToken) => {
  const { orderId, items = [], reason, evidenceUrls = [] } = data;
  if (!items || items.length === 0) {
    throw new AppError(400, 'Bad Request', 'EMPTY_RETURN_ITEMS', 'Return items cannot be empty');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

  if (actor && actor.systemRole === 'CUSTOMER' && order.customerId && order.customerId.toString() !== actor.id) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You do not own this order');
  }

  const now = new Date();
  const deliveredAtDate = order.deliveredAt ? new Date(order.deliveredAt) : null;
  const returnWindowEndsAt = deliveredAtDate ? new Date(deliveredAtDate.getTime() + RETURN_WINDOW_MS) : null;

  if (order.status !== 'COMPLETED' || !deliveredAtDate || now > returnWindowEndsAt) {
    throw new AppError(422, 'Unprocessable Entity', 'RETURN_WINDOW_EXPIRED', 'Return window of 7 days has expired or order is not completed');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const freshOrder = await Order.findById(orderId).session(session);
    let totalMerchandiseNet = 0;
    const returnItems = [];

    for (const reqItem of items) {
      const lineItem = freshOrder.items.find((i) => i.orderItemId.toString() === reqItem.orderItemId.toString());
      if (!lineItem) {
        throw new AppError(404, 'Not Found', 'ITEM_NOT_FOUND', `Item ${reqItem.orderItemId} not found in order`);
      }

      const currentReserved = lineItem.returnReservedQty || 0;
      const currentReturned = lineItem.returnedQty || 0;
      const returnableQty = Math.max(0, lineItem.quantity - currentReturned - currentReserved);

      if (reqItem.quantity <= 0 || reqItem.quantity > returnableQty) {
        throw new AppError(422, 'Unprocessable Entity', 'RETURN_QTY_EXCEEDS_RETURNABLE', `Requested quantity ${reqItem.quantity} exceeds returnable quantity ${returnableQty}`);
      }

      // Proportional net refund calculation
      const unitNet = Math.floor(lineItem.lineNet / lineItem.quantity);
      let refundAmount = unitNet * reqItem.quantity;
      if (currentReturned + currentReserved + reqItem.quantity === lineItem.quantity) {
        refundAmount = Math.max(0, lineItem.lineNet - (lineItem.refundedNet || 0));
      }

      totalMerchandiseNet += refundAmount;
      lineItem.returnReservedQty = currentReserved + reqItem.quantity;

      returnItems.push({
        orderItemId: lineItem.orderItemId.toString(),
        productId: lineItem.productId,
        productName: lineItem.nameSnapshot,
        orderedQty: lineItem.quantity,
        alreadyReturnedQty: currentReturned,
        requestedQty: reqItem.quantity,
        refundAmount
      });
    }

    await freshOrder.save({ session });

    const orderReturn = new OrderReturn({
      code: `RET-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`,
      orderId: freshOrder._id,
      customerId: freshOrder.customerId,
      guestContactId: freshOrder.guestContactId,
      status: 'REQUESTED',
      reason,
      evidenceUrls,
      items: returnItems,
      refundBreakdown: {
        merchandiseNet: totalMerchandiseNet,
        shippingRefunded: 0,
        total: totalMerchandiseNet
      },
      history: [{
        status: 'REQUESTED',
        at: new Date(),
        actorId: actor ? (actor.id || actor._id) : undefined
      }]
    });

    await orderReturn.save({ session });
    await session.commitTransaction();
    session.endSession();
    return orderReturn;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const listReturns = async (query = {}, actor) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.orderId) filter.orderId = query.orderId;

  if (actor && actor.systemRole === 'CUSTOMER') {
    filter.customerId = actor.id;
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const returns = await OrderReturn.find(filter).sort({ createdAt: -1 }).limit(limit);

  return {
    items: returns.map(formatOrderReturn),
    nextCursor: null
  };
};

export const getReturnById = async (returnId, actor) => {
  const ret = await OrderReturn.findById(returnId);
  if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

  if (actor && actor.systemRole === 'CUSTOMER' && ret.customerId && ret.customerId.toString() !== actor.id) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You do not own this return');
  }

  return ret;
};

export const processReturn = async (returnId, actor) => {
  const ret = await OrderReturn.findById(returnId);
  if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

  if (ret.status !== 'REQUESTED') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot process return in ${ret.status} state`);
  }

  ret.status = 'PROCESSING';
  ret.history.push({
    status: 'PROCESSING',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined
  });
  await ret.save();
  return ret;
};

export const receiveReturn = async (returnId, actor) => {
  const ret = await OrderReturn.findById(returnId);
  if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

  if (ret.status !== 'PROCESSING') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot receive return in ${ret.status} state`);
  }

  ret.status = 'RECEIVED';
  ret.history.push({
    status: 'RECEIVED',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined
  });
  await ret.save();
  return ret;
};

export const approveReturn = async (returnId, approveData = {}, actor) => {
  // Role verification: single-level approval only by MANAGER or ADMIN
  if (!actor || !['MANAGER', 'ADMIN'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Only Manager or Admin can approve returns');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ret = await OrderReturn.findById(returnId).session(session);
    if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

    if (ret.status !== 'RECEIVED') {
      throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot approve return in ${ret.status} state`);
    }

    const order = await Order.findById(ret.orderId).session(session);
    if (!order) throw new AppError(404, 'Not Found', 'ORDER_NOT_FOUND', 'Order not found');

    // Update Order item return quantities
    for (const retItem of ret.items) {
      const lineItem = order.items.find((i) => i.orderItemId.toString() === retItem.orderItemId.toString());
      if (lineItem) {
        lineItem.returnReservedQty = Math.max(0, (lineItem.returnReservedQty || 0) - retItem.requestedQty);
        lineItem.returnedQty = (lineItem.returnedQty || 0) + retItem.requestedQty;
        lineItem.refundedNet = (lineItem.refundedNet || 0) + retItem.refundAmount;
      }
    }
    await order.save({ session });

    // Create OrderRefund document in PENDING state
    const refund = new OrderRefund({
      code: `REF-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`,
      cause: 'RETURN',
      orderReturnId: ret._id,
      orderId: order._id,
      amount: ret.refundBreakdown.total,
      status: 'PENDING',
      history: [{
        status: 'PENDING',
        at: new Date(),
        actorId: actor ? (actor.id || actor._id) : undefined,
        note: approveData.note || 'Return approved'
      }]
    });
    await refund.save({ session });

    ret.status = 'APPROVED';
    ret.refundId = refund._id;
    ret.history.push({
      status: 'APPROVED',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : undefined,
      note: approveData.note || ''
    });
    await ret.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ret;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const rejectReturn = async (returnId, rejectData = {}, actor) => {
  // Role verification: only MANAGER or ADMIN can reject
  if (!actor || !['MANAGER', 'ADMIN'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Only Manager or Admin can reject returns');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ret = await OrderReturn.findById(returnId).session(session);
    if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

    if (!['PROCESSING', 'RECEIVED'].includes(ret.status)) {
      throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot reject return in ${ret.status} state`);
    }

    const order = await Order.findById(ret.orderId).session(session);
    if (order) {
      // Release returnReservedQty on Order items
      for (const retItem of ret.items) {
        const lineItem = order.items.find((i) => i.orderItemId.toString() === retItem.orderItemId.toString());
        if (lineItem) {
          lineItem.returnReservedQty = Math.max(0, (lineItem.returnReservedQty || 0) - retItem.requestedQty);
        }
      }
      await order.save({ session });
    }

    ret.status = 'REJECTED';
    ret.history.push({
      status: 'REJECTED',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : undefined,
      note: rejectData.reason || rejectData.note || 'Rejected by manager'
    });
    await ret.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ret;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const cancelReturn = async (returnId, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ret = await OrderReturn.findById(returnId).session(session);
    if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

    if (actor && actor.systemRole === 'CUSTOMER' && ret.customerId && ret.customerId.toString() !== actor.id) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You do not own this return');
    }

    if (!['REQUESTED', 'PROCESSING'].includes(ret.status)) {
      throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot cancel return in ${ret.status} state`);
    }

    const order = await Order.findById(ret.orderId).session(session);
    if (order) {
      for (const retItem of ret.items) {
        const lineItem = order.items.find((i) => i.orderItemId.toString() === retItem.orderItemId.toString());
        if (lineItem) {
          lineItem.returnReservedQty = Math.max(0, (lineItem.returnReservedQty || 0) - retItem.requestedQty);
        }
      }
      await order.save({ session });
    }

    ret.status = 'CANCELLED';
    ret.history.push({
      status: 'CANCELLED',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : undefined
    });
    await ret.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ret;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getOrderRefundById = async (refundId, actor) => {
  const refund = await OrderRefund.findById(refundId);
  if (!refund) throw new AppError(404, 'Not Found', 'ORDER_REFUND_NOT_FOUND', 'Order refund not found');
  return refund;
};

export const processOrderRefund = async (refundId, actor) => {
  if (!actor || !['MANAGER', 'ADMIN'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Only Manager or Admin can process order refunds');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const refund = await OrderRefund.findById(refundId).session(session);
    if (!refund) throw new AppError(404, 'Not Found', 'ORDER_REFUND_NOT_FOUND', 'Order refund not found');

    if (refund.status !== 'PENDING') {
      throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot process refund in ${refund.status} state`);
    }

    // Mock processing success
    refund.status = 'REFUNDED';
    refund.refundedAt = new Date();
    refund.history.push({
      status: 'REFUNDED',
      at: refund.refundedAt,
      actorId: actor ? (actor.id || actor._id) : undefined,
      note: 'Refund processed via MOCK provider'
    });
    await refund.save({ session });

    // Update target Payment refundedAmount
    const payment = await Payment.findOne({ 'target.type': 'ORDER', 'target.id': refund.orderId }).session(session);
    if (payment) {
      payment.refundedAmount = (payment.refundedAmount || 0) + refund.amount;
      if (payment.refundedAmount >= payment.amount) {
        payment.status = 'REFUNDED';
      } else {
        payment.status = 'REFUND_PENDING';
      }
      await payment.save({ session });
    }

    // If linked to OrderReturn, complete the OrderReturn
    if (refund.cause === 'RETURN' && refund.orderReturnId) {
      const ret = await OrderReturn.findById(refund.orderReturnId).session(session);
      if (ret && ret.status === 'APPROVED') {
        ret.status = 'COMPLETED';
        ret.history.push({
          status: 'COMPLETED',
          at: new Date(),
          actorId: actor ? (actor.id || actor._id) : undefined,
          note: 'Refund completed'
        });
        await ret.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();
    return refund;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
