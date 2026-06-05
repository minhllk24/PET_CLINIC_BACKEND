import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getOrders = async (user, query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereCondition = {};
    if (user.role_code !== 'ADMIN') {
      whereCondition.user_id = toBigIntId(user.user_id);
    }

    if (query.status) {
      whereCondition.order_status = query.status;
    }

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where: whereCondition }),
      prisma.order.findMany({
        where: whereCondition,
        include: {
          payments: true,
          order_items: true
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get orders successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        orders
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getOrderById = async (id, user) => {
  try {
    const orderId = toBigIntId(id);
    if (!orderId) return { EM: 'Invalid order ID', EC: 1, DT: '' };

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        order_items: {
          include: { product: { select: { product_name: true, price: true } } }
        },
        payments: true,
        address: true
      }
    });

    if (!order) return { EM: 'Order not found', EC: -1, DT: '' };

    if (user.role_code !== 'ADMIN' && user.user_id !== order.user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    return { EM: 'Get order successful', EC: 0, DT: order };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const checkoutCart = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const { address_id, payment_method } = data;
    if (!address_id || !payment_method) {
      return { EM: 'Missing address_id or payment_method', EC: 1, DT: '' };
    }

    const addrId = toBigIntId(address_id);

    // Verify address
    const address = await prisma.userAddress.findUnique({ where: { address_id: addrId } });
    if (!address || address.user_id !== userId) {
      return { EM: 'Invalid address', EC: 1, DT: '' };
    }

    // Check if items are passed directly from frontend (localStorage)
    let cartItemsToCheckout = [];
    let isDirectCheckout = false;

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      isDirectCheckout = true;
      for (const item of data.items) {
        const product = await prisma.product.findUnique({ where: { product_id: toBigIntId(item.product_id) } });
        if (!product) {
          return { EM: `Product not found: ${item.product_id}`, EC: -1, DT: '' };
        }
        cartItemsToCheckout.push({
          cart_item_id: null,
          product_id: product.product_id,
          variant_id: item.variant_id ? toBigIntId(item.variant_id) : null,
          quantity: parseInt(item.quantity) || 1,
          product: product
        });
      }
    } else {
      // Fallback: Get cart items from DB that are selected
      const cart = await prisma.cart.findUnique({
        where: { user_id: userId },
        include: { cart_items: { where: { is_selected: true }, include: { product: true } } }
      });

      if (!cart || cart.cart_items.length === 0) {
        return { EM: 'Cart is empty or no item selected', EC: -1, DT: '' };
      }
      cartItemsToCheckout = cart.cart_items;
    }

    if (cartItemsToCheckout.length === 0) {
      return { EM: 'No items to checkout', EC: -1, DT: '' };
    }

    // Check stock and calculate total
    let totalAmount = 0;
    const variantsData = {}; // Cache variants
    for (let i = 0; i < cartItemsToCheckout.length; i++) {
      const item = cartItemsToCheckout[i];
      let availableStock = item.product.stock_quantity;
      let price = parseFloat(item.product.price);
      
      if (item.variant_id) {
        const variant = await prisma.productVariant.findUnique({ where: { variant_id: item.variant_id } });
        if (!variant) {
          return { EM: `Invalid variant for product: ${item.product.product_name}`, EC: -1, DT: '' };
        }
        availableStock = variant.stock_quantity;
        price = parseFloat(variant.price);
        variantsData[i] = variant;
      }

      if (availableStock < item.quantity) {
        return { EM: `Not enough stock for product: ${item.product.product_name}`, EC: 2, DT: '' };
      }
      totalAmount += price * item.quantity;
    }

    const shippingFee = 30000; // Fixed shipping fee for simplicity
    const finalAmount = totalAmount + shippingFee;

    // Execute transaction
    const resultOrder = await prisma.$transaction(async (tx) => {
      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          user_id: userId,
          address_id: addrId,
          total_amount: totalAmount,
          shipping_fee: shippingFee,
          discount_amount: 0,
          final_amount: finalAmount,
          order_status: 'pending',
          payment_status: 'unpaid'
        }
      });

      // 2. Create OrderItems & Update Product Stock
      for (let i = 0; i < cartItemsToCheckout.length; i++) {
        const item = cartItemsToCheckout[i];
        let price = parseFloat(item.product.price);
        if (item.variant_id && variantsData[i]) {
          price = parseFloat(variantsData[i].price);
        }

        await tx.orderItem.create({
          data: {
            order_id: newOrder.order_id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            price: price
          }
        });

        if (item.variant_id) {
          await tx.productVariant.update({
            where: { variant_id: item.variant_id },
            data: { stock_quantity: { decrement: item.quantity } }
          });
          await tx.product.update({
            where: { product_id: item.product_id },
            data: { sold_quantity: { increment: item.quantity } }
          });
        } else {
          await tx.product.update({
            where: { product_id: item.product_id },
            data: {
              stock_quantity: { decrement: item.quantity },
              sold_quantity: { increment: item.quantity }
            }
          });
        }
      }

      // 3. Create Payment record
      await tx.payment.create({
        data: {
          target_type: 'order',
          target_id: newOrder.order_id,
          user_id: userId,
          amount: finalAmount,
          payment_method: payment_method,
          payment_status: 'pending'
        }
      });

      // 4. Delete processed CartItems if using DB cart
      if (!isDirectCheckout) {
        const cartItemIds = cartItemsToCheckout.map(i => i.cart_item_id);
        await tx.cartItem.deleteMany({
          where: { cart_item_id: { in: cartItemIds } }
        });
      }

      return newOrder;
    });

    return { EM: 'Checkout successful', EC: 0, DT: resultOrder };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateOrderStatus = async (id, status) => {
  try {
    const orderId = toBigIntId(id);
    if (!orderId) return { EM: 'Invalid order ID', EC: 1, DT: '' };

    const validStatuses = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return { EM: 'Invalid status', EC: 1, DT: '' };
    }

    const order = await prisma.order.findUnique({ where: { order_id: orderId }, include: { order_items: true } });
    if (!order) return { EM: 'Order not found', EC: -1, DT: '' };

    // Transaction for cancellation
    if (status === 'cancelled' && order.order_status !== 'cancelled') {
      await prisma.$transaction(async (tx) => {
        // Return stock
        for (const item of order.order_items) {
          if (item.variant_id) {
            await tx.productVariant.update({
              where: { variant_id: item.variant_id },
              data: { stock_quantity: { increment: item.quantity } }
            });
            await tx.product.update({
              where: { product_id: item.product_id },
              data: { sold_quantity: { decrement: item.quantity } }
            });
          } else {
            await tx.product.update({
              where: { product_id: item.product_id },
              data: {
                stock_quantity: { increment: item.quantity },
                sold_quantity: { decrement: item.quantity }
              }
            });
          }
        }
        await tx.order.update({
          where: { order_id: orderId },
          data: { order_status: 'cancelled' }
        });
      });
      return { EM: 'Order cancelled and stock returned', EC: 0, DT: '' };
    }

    const updatedOrder = await prisma.order.update({
      where: { order_id: orderId },
      data: { order_status: status }
    });

    return { EM: 'Update status successful', EC: 0, DT: updatedOrder };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getOrders,
  getOrderById,
  checkoutCart,
  updateOrderStatus
};
