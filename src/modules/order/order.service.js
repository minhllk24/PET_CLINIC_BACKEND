import mongoose from 'mongoose';
import Order from './models/Order';
import Payment from '../payment/models/Payment';
import Cart from '../cart/models/Cart';
import Branch from '../branch/models/Branch';
import InventoryStock from '../inventory/models/InventoryStock';
import InventoryTransaction from '../inventory/models/InventoryTransaction';
import AppError from '../../utils/AppError';

export const checkoutCreateOrder = async (data, actor, guestToken) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cartId, paymentMethod, shippingAddress, contactEmail, contactPhone } = data;
    
    // 1. Fetch Cart
    const query = actor ? { _id: cartId, customerId: actor.id } : { _id: cartId, tokenHash: guestToken };
    const cart = await Cart.findOne(query).session(session);
    if (!cart || cart.items.length === 0) {
      throw new AppError(400, 'ValidationError', 'EMPTY_CART', 'Cart is empty or not found');
    }

    // 2. Fulfillment Branch Resolver
    // Simplified: Find first branch that has enough stock for all items
    const branches = await Branch.find({ status: 'ACTIVE' }).sort({ createdAt: 1 }).session(session);
    let fulfillmentBranchId = null;

    for (const branch of branches) {
      let canFulfill = true;
      for (const item of cart.items) {
        const stock = await InventoryStock.findOne({ branchId: branch._id, inventoryItemId: item.productId }).session(session);
        if (!stock || stock.quantity < item.quantity) {
          canFulfill = false;
          break;
        }
      }
      if (canFulfill) {
        fulfillmentBranchId = branch._id;
        break;
      }
    }

    if (!fulfillmentBranchId) {
      throw new AppError(422, 'UnprocessableEntity', 'INSUFFICIENT_INVENTORY', 'No branch has sufficient inventory for all items');
    }

    // 3. Issue Inventory (Decrement)
    for (const item of cart.items) {
      const stock = await InventoryStock.findOne({ branchId: fulfillmentBranchId, inventoryItemId: item.productId }).session(session);
      stock.quantity -= item.quantity;
      await stock.save({ session });

      const tx = new InventoryTransaction({
        branchId: fulfillmentBranchId,
        inventoryItemId: item.productId,
        transactionType: 'ISSUE',
        quantity: item.quantity,
        stockAfter: stock.quantity,
        sourceType: 'ORDER',
        actorId: actor ? actor.id : null,
        postedAt: new Date()
      });
      // sourceId will be updated after Order is created
      await tx.save({ session });
      item._txId = tx._id;
    }

    // 4. Create Order
    // Calculate totals
    const lineNet = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // TODO: voucher discount calculation here
    const totalDiscount = 0; 
    const shippingFee = 30000; // Mock shipping fee
    const finalAmount = lineNet - totalDiscount + shippingFee;

    const order = new Order({
      customerId: actor ? actor.id : undefined,
      fulfillmentBranchId,
      status: 'PENDING',
      items: cart.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: 'Snapshot Name', // Mock snapshot
        quantity: item.quantity,
        unitPrice: item.price
      })),
      pricing: { lineNet, totalDiscount, shippingFee, finalAmount },
      shippingAddress,
      contactEmail,
      contactPhone
    });
    
    await order.save({ session });

    // Update tx sourceId
    for (const item of cart.items) {
      await InventoryTransaction.findByIdAndUpdate(item._txId, { sourceId: order._id }, { session });
    }

    // 5. Create Payment
    const payment = new Payment({
      targetType: 'ORDER',
      targetId: order._id,
      method: paymentMethod, // ONLINE_MOCK or COD
      status: 'PENDING',
      amount: finalAmount
    });
    await payment.save({ session });

    // 6. Clear cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
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

    // Compensating transaction: RECEIPT for each item
    for (const item of order.items) {
      const stock = await InventoryStock.findOne({ branchId: order.fulfillmentBranchId, inventoryItemId: item.productId }).session(session);
      stock.quantity += item.quantity;
      await stock.save({ session });

      const tx = new InventoryTransaction({
        branchId: order.fulfillmentBranchId,
        inventoryItemId: item.productId,
        transactionType: 'RECEIPT',
        quantity: item.quantity,
        stockAfter: stock.quantity,
        sourceType: 'ORDER',
        sourceId: order._id,
        actorId: actor ? actor.id : null,
        postedAt: new Date(),
        notes: 'Order Cancellation Compensation'
      });
      await tx.save({ session });
    }

    const payment = await Payment.findOne({ targetType: 'ORDER', targetId: order._id }).session(session);
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
