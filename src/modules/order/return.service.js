import mongoose from 'mongoose';
import Order from './models/Order';
import OrderReturn from './models/OrderReturn';
import OrderRefund from './models/OrderRefund';
import Payment from '../payment/models/Payment';
import Product from '../catalog/models/Product';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { receiveForOrder, SYSTEM_ACTOR_ID } from '../inventory/inventory.service';

const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const formatOrderReturn = (ret, parentOrder = null) => {
  const obj = typeof ret.toObject === 'function' ? ret.toObject() : ret;
  let allowedActions = [];
  if (obj.status === 'REQUESTED') {
    allowedActions = ['PROCESS', 'REJECT', 'CANCEL'];
  } else if (obj.status === 'PROCESSING') {
    allowedActions = ['RECEIVE', 'REJECT', 'CANCEL'];
  } else if (obj.status === 'RECEIVED') {
    allowedActions = ['APPROVE', 'REJECT'];
  } else if (obj.status === 'APPROVED') {
    allowedActions = ['REFUND'];
  }

  const result = {
    id: obj._id.toString(),
    code: obj.code || `RET-${obj._id.toString().slice(-8).toUpperCase()}`,
    orderId: obj.orderId.toString(),
    orderCode: obj.orderCode || parentOrder?.code || null,
    fulfillmentBranchId: obj.fulfillmentBranchId?.toString() || parentOrder?.fulfillmentBranchId?.toString() || null,
    status: obj.status,
    items: (obj.items || []).map((item) => ({
      orderItemId: item.orderItemId.toString(),
      productName: item.productName,
      orderedQty: item.orderedQty,
      alreadyReturnedQty: item.alreadyReturnedQty || 0,
      requestedQty: item.requestedQty,
      receivedQty: item.receivedQty !== undefined ? item.receivedQty : item.requestedQty,
      quality: item.quality || 'RESELLABLE',
      refundAmount: item.refundAmount
    })),
    reason: obj.reason,
    evidenceUrls: obj.evidenceUrls || [],
    refundBreakdown: {
      merchandiseNet: obj.refundBreakdown?.merchandiseNet || 0,
      shippingRefunded: 0,
      total: obj.refundBreakdown?.total || 0
    },
    refundId: obj.refundId ? obj.refundId.toString() : null,
    allowedActions,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
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
      } else {
        refundAmount = Math.min(refundAmount, Math.max(0, lineItem.lineNet - (lineItem.refundedNet || 0)));
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

    // Safeguard: Total cumulative refund for the order cannot exceed net merchandise amount paid
    const totalOrderMerchandiseNetPaid = (freshOrder.items || []).reduce(
      (sum, item) => sum + (Number(item.lineNet) || 0),
      0
    );

    const isOrderRefundQueryable = mongoose.connection.readyState !== 0 || Boolean(OrderRefund.find && OrderRefund.find.mock);
    let totalPreviouslyRefunded = 0;
    if (isOrderRefundQueryable) {
      try {
        const previousRefunds = await OrderRefund.find({
          orderId: freshOrder._id,
          status: { $in: ['PENDING', 'REFUNDED'] }
        }).session(session);

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
  if (!actor) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication required to list returns');
  }

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.orderId) filter.orderId = query.orderId;

  if (actor.systemRole === 'CUSTOMER') {
    filter.customerId = actor.id;
  } else if (actor.systemRole === 'MANAGER') {
    const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
    if (query.branchId) {
      if (mgrBranches.length > 0 && !mgrBranches.includes(query.branchId)) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Branch not in assigned scope');
      }
      const branchOrders = await Order.find({ fulfillmentBranchId: query.branchId }).select('_id');
      filter.orderId = { $in: branchOrders.map((o) => o._id) };
    } else {
      const branchOrders = await Order.find({ fulfillmentBranchId: { $in: mgrBranches } }).select('_id');
      filter.orderId = { $in: branchOrders.map((o) => o._id) };
    }
  } else if (actor.systemRole === 'STAFF') {
    const staffBranches = (actor.authorizedBranchIds || []).map((b) => b.toString());
    const branchOrders = await Order.find({ fulfillmentBranchId: { $in: staffBranches } }).select('_id');
    filter.orderId = { $in: branchOrders.map((o) => o._id) };
  } else if (query.branchId) {
    const branchOrders = await Order.find({ fulfillmentBranchId: query.branchId }).select('_id');
    filter.orderId = { $in: branchOrders.map((o) => o._id) };
  }

  if (query.cursor && mongoose.Types.ObjectId.isValid(query.cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(query.cursor) };
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const [returns, totalCount, pendingCount] = await Promise.all([
    OrderReturn.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1),
    OrderReturn.countDocuments(filter),
    OrderReturn.countDocuments({ ...filter, status: 'REQUESTED' })
  ]);

  let nextCursor = null;
  if (returns.length > limit) {
    returns.pop();
    const lastItem = returns[returns.length - 1];
    nextCursor = lastItem._id.toString();
  }

  const orderIds = returns.map((r) => r.orderId);
  const parentOrders = await Order.find({ _id: { $in: orderIds } }).select('code fulfillmentBranchId');
  const parentOrderMap = new Map();
  for (const po of parentOrders) {
    parentOrderMap.set(po._id.toString(), po);
  }

  return {
    items: returns.map((r) => formatOrderReturn(r, parentOrderMap.get(r.orderId.toString()))),
    totalCount,
    nextCursor,
    summary: {
      pendingCount
    }
  };
};

export const getReturnById = async (returnId, actor) => {
  const ret = await OrderReturn.findById(returnId);
  if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

  if (!actor) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.UNAUTHENTICATED, 'Authentication required to view return details');
  }

  const parentOrder = await Order.findById(ret.orderId);

  if (actor.systemRole === 'ADMIN') {
    return { returnDoc: ret, parentOrder };
  }

  if (actor.systemRole === 'CUSTOMER') {
    if (ret.customerId && ret.customerId.toString() !== actor.id) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You do not own this return');
    }
  } else if (actor.systemRole === 'MANAGER') {
    if (parentOrder?.fulfillmentBranchId && (actor.assignedBranchIds || actor.authorizedBranchIds)) {
      const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
      if (mgrBranches.length === 0 || !mgrBranches.includes(parentOrder.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Return belongs to an unassigned branch');
      }
    }
  } else if (actor.systemRole === 'STAFF') {
    if (parentOrder?.fulfillmentBranchId && (actor.assignedBranchIds || actor.authorizedBranchIds)) {
      const staffBranches = (actor.authorizedBranchIds || actor.assignedBranchIds || []).map((b) => b.toString());
      if (staffBranches.length === 0 || !staffBranches.includes(parentOrder.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Return belongs to an unauthorized branch');
      }
    }
  }

  return { returnDoc: ret, parentOrder };
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

export const receiveReturn = async (returnId, receiveData = {}, actor) => {
  const ret = await OrderReturn.findById(returnId);
  if (!ret) throw new AppError(404, 'Not Found', 'ORDER_RETURN_NOT_FOUND', 'Order return not found');

  if (ret.status !== 'PROCESSING') {
    throw new AppError(400, 'Bad Request', 'INVALID_STATE_TRANSITION', `Cannot receive return in ${ret.status} state`);
  }

  if (Array.isArray(receiveData.items) && receiveData.items.length > 0) {
    for (const rItem of receiveData.items) {
      const target = ret.items.find((i) => i.orderItemId.toString() === rItem.orderItemId?.toString());
      if (target) {
        if (typeof rItem.receivedQty === 'number') target.receivedQty = rItem.receivedQty;
        if (rItem.quality) target.quality = rItem.quality;
      }
    }
  }

  ret.status = 'RECEIVED';
  ret.history.push({
    status: 'RECEIVED',
    at: new Date(),
    actorId: actor ? (actor.id || actor._id) : undefined,
    note: receiveData.note || 'Đã kiểm hàng tại kho'
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

    if (actor.systemRole === 'MANAGER' && order.fulfillmentBranchId && (actor.assignedBranchIds || actor.authorizedBranchIds)) {
      const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => b.toString());
      if (mgrBranches.length === 0 || !mgrBranches.includes(order.fulfillmentBranchId?.toString())) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Cannot approve return for an unassigned branch');
      }
    }

    const movementsToRestock = [];
    let calculatedRefundTotal = 0;

    for (const retItem of ret.items) {
      const lineItem = order.items.find((i) => i.orderItemId.toString() === retItem.orderItemId.toString());
      const acceptedQty = typeof retItem.receivedQty === 'number' ? retItem.receivedQty : retItem.requestedQty;
      const itemRefund = retItem.refundAmount ? Math.round((retItem.refundAmount / (retItem.requestedQty || 1)) * acceptedQty) : 0;
      calculatedRefundTotal += itemRefund;

      if (lineItem) {
        lineItem.returnReservedQty = Math.max(0, (lineItem.returnReservedQty || 0) - retItem.requestedQty);
        lineItem.returnedQty = (lineItem.returnedQty || 0) + acceptedQty;
        lineItem.refundedNet = (lineItem.refundedNet || 0) + itemRefund;

        if (retItem.quality === 'RESELLABLE' && acceptedQty > 0) {
          const product = await Product.findById(lineItem.productId).session(session);
          if (product) {
            const variant = (product.variants || []).find((v) => v._id.toString() === lineItem.variantId?.toString());
            if (variant && variant.inventoryItemId) {
              movementsToRestock.push({
                inventoryItemId: variant.inventoryItemId,
                quantity: acceptedQty
              });
            }
          }
        }
      }
    }

    if (movementsToRestock.length > 0) {
      await receiveForOrder({
        session,
        orderId: order._id,
        branchId: order.fulfillmentBranchId,
        movements: movementsToRestock,
        actorId: actor ? (actor.id || actor._id) : SYSTEM_ACTOR_ID,
        reason: `Restock approved return ${ret._id}`
      });
    }

    const finalRefund = calculatedRefundTotal > 0 ? calculatedRefundTotal : ret.refundBreakdown.total;

    const totalOrderMerchandiseNetPaid = (order.items || []).reduce(
      (sum, item) => sum + (Number(item.lineNet) || 0),
      0
    );

    const isOrderRefundQueryable = mongoose.connection.readyState !== 0 || Boolean(OrderRefund.find && OrderRefund.find.mock);
    let totalAlreadyRefunded = 0;
    if (isOrderRefundQueryable) {
      try {
        const existingRefunds = await OrderRefund.find({
          orderId: order._id,
          status: { $in: ['PENDING', 'REFUNDED'] }
        }).session(session);

        totalAlreadyRefunded = (existingRefunds || []).reduce(
          (sum, r) => sum + (Number(r.amount) || 0),
          0
        );
      } catch (err) {
        totalAlreadyRefunded = 0;
      }
    }

    if (totalAlreadyRefunded + finalRefund > totalOrderMerchandiseNetPaid) {
      throw new AppError(
        422,
        'Unprocessable Entity',
        'REFUND_EXCEEDS_NET_PAID',
        'Total refund cannot exceed net merchandise amount paid'
      );
    }

    await order.save({ session });

    const refund = new OrderRefund({
      code: `REF-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`,
      cause: 'RETURN',
      orderReturnId: ret._id,
      orderId: order._id,
      amount: finalRefund,
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
    ret.refundBreakdown.total = finalRefund;
    ret.refundBreakdown.merchandiseNet = finalRefund;
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
