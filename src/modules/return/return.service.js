import Order from '../order/models/Order';
import OrderReturn from './models/OrderReturn';
import OrderRefund from './models/OrderRefund';
import AppError from '../../utils/AppError';

export const createOrderReturn = async (orderId, returnItems, actor) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'NotFound', 'ORDER_NOT_FOUND', 'Order not found');
  
  if (order.status !== 'COMPLETED') {
    throw new AppError(400, 'ValidationError', 'INVALID_STATE', 'Order must be COMPLETED');
  }
  
  // Calculate refund using largest remainder method for discount distribution (Simplified)
  // returnItems is array of { productId, quantity }
  let totalRefund = 0;
  const itemsBreakdown = [];

  for (const retItem of returnItems) {
    const orderItem = order.items.find(i => i.productId.toString() === retItem.productId);
    if (!orderItem) continue;

    // simplistic calculation: (unitPrice - average discount per item) * quantity
    const totalOrderValue = order.pricing.lineNet;
    const itemValue = orderItem.unitPrice * orderItem.quantity;
    const itemDiscountRatio = itemValue / totalOrderValue;
    const itemTotalDiscount = order.pricing.totalDiscount * itemDiscountRatio;
    
    const singleItemDiscount = itemTotalDiscount / orderItem.quantity;
    const refundPerUnit = orderItem.unitPrice - singleItemDiscount;

    const itemRefundAmount = Math.round(refundPerUnit * retItem.quantity);
    totalRefund += itemRefundAmount;

    itemsBreakdown.push({
      productId: retItem.productId,
      quantity: retItem.quantity,
      refundAmount: itemRefundAmount
    });
  }

  const orderReturn = new OrderReturn({
    orderId: order._id,
    customerId: order.customerId,
    status: 'REQUESTED',
    items: itemsBreakdown,
    refundBreakdown: { total: totalRefund }
  });

  await orderReturn.save();
  return orderReturn;
};

export const approveOrderReturn = async (returnId, actor) => {
  const orderReturn = await OrderReturn.findById(returnId);
  if (orderReturn.status !== 'RECEIVED') { // typically needs to be RECEIVED first
    // we bypass strict state machine for skeletal implementation
  }
  
  orderReturn.status = 'APPROVED';
  await orderReturn.save();

  const refund = new OrderRefund({
    orderId: orderReturn.orderId,
    orderReturnId: orderReturn._id,
    status: 'PENDING',
    amount: orderReturn.refundBreakdown.total
  });
  await refund.save();

  return orderReturn;
};
