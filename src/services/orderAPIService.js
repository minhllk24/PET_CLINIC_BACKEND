import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';
import { hashPassword } from '../utils/passwordHelpers';
import { sendGuestAccountEmail } from '../utils/emailHelpers';

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
          order_items: {
            include: {
              product: {
                select: {
                  product_name: true,
                  price: true,
                  product_images: {
                    where: { is_primary: true },
                    take: 1,
                    select: { image_url: true }
                  }
                }
              },
              variant: {
                select: { variant_name: true }
              }
            }
          }
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
          include: {
            product: {
              select: {
                product_name: true,
                price: true,
                product_images: {
                  where: { is_primary: true },
                  take: 1,
                  select: { image_url: true }
                }
              }
            },
            variant: {
              select: { variant_name: true }
            }
          }
        },
        payments: true,
        address: true,
        status_history: {
          orderBy: { changed_at: 'asc' }
        }
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

    const { address_id, payment_method, voucher_code, note } = data;
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
      const cart = await prisma.cart.findFirst({
        where: { user_id: userId, status: 'active' },
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
    let subtotalAmount = 0;
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
      subtotalAmount += price * item.quantity;
    }

    // Process Voucher (if any)
    let voucherId = null;
    let discountAmount = 0;
    let voucher = null;
    if (voucher_code) {
      const vCode = voucher_code.toUpperCase();
      voucher = await prisma.voucher.findUnique({ where: { voucher_code: vCode } });
      if (!voucher || voucher.status !== 'active') {
        return { EM: 'Voucher not valid or inactive', EC: -1, DT: '' };
      }

      const now = new Date();
      if (voucher.start_at && now < voucher.start_at) return { EM: 'Voucher not yet active', EC: -1, DT: '' };
      if (voucher.end_at && now > voucher.end_at) return { EM: 'Voucher expired', EC: -1, DT: '' };

      if (voucher.min_order_amount && subtotalAmount < parseFloat(voucher.min_order_amount)) {
        return { EM: `Minimum order value is ${parseFloat(voucher.min_order_amount)}`, EC: -1, DT: '' };
      }

      if (voucher.remaining_usage !== null && voucher.remaining_usage <= 0) {
        return { EM: 'Voucher usage limit reached', EC: -1, DT: '' };
      }

      // Check if user already used this voucher
      const userUsed = await prisma.voucherUsage.findFirst({
        where: { user_id: userId, voucher_id: voucher.voucher_id }
      });
      if (userUsed) {
        return { EM: 'You have already used this voucher', EC: -1, DT: '' };
      }

      voucherId = voucher.voucher_id;
      if (voucher.discount_type === 'percent') {
        discountAmount = subtotalAmount * (parseFloat(voucher.discount_value) / 100);
        if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
          discountAmount = parseFloat(voucher.max_discount_amount);
        }
      } else if (voucher.discount_type === 'fixed') {
        discountAmount = parseFloat(voucher.discount_value);
      }
      
      // Ensure discount doesn't exceed subtotal
      if (discountAmount > subtotalAmount) {
        discountAmount = subtotalAmount;
      }
    }

    const shippingFee = subtotalAmount >= 500000 ? 0 : 30000; // Free ship cho đơn từ 500k, dưới 500k phí ship mặc định 30k
    const finalAmount = subtotalAmount + shippingFee - discountAmount;

    // Snapshot address fields
    const recipientName = address.recipient_name;
    const recipientPhone = address.recipient_phone;
    const shippingAddress = `${address.address_line}${address.ward ? ', ' + address.ward : ''}${address.district ? ', ' + address.district : ''}${address.province ? ', ' + address.province : ''}`;

    const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Execute transaction
    const resultOrder = await prisma.$transaction(async (tx) => {
      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          order_code: orderCode,
          order_type: 'product',
          user_id: userId,
          address_id: addrId,
          voucher_id: voucherId,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          shipping_address: shippingAddress,
          subtotal_amount: subtotalAmount,
          discount_amount: discountAmount,
          points_discount_amount: 0,
          shipping_fee: shippingFee,
          total_amount: finalAmount,
          order_status: 'pending',
          payment_status: 'unpaid',
          note: note || null
        }
      });

      // 2. Create OrderItems & Update Product Stock
      for (let i = 0; i < cartItemsToCheckout.length; i++) {
        const item = cartItemsToCheckout[i];
        let price = parseFloat(item.product.price);
        let itemNameSnapshot = item.product.product_name;
        if (item.variant_id && variantsData[i]) {
          price = parseFloat(variantsData[i].price);
          itemNameSnapshot = `${item.product.product_name} - ${variantsData[i].variant_name}`;
        }

        await tx.orderItem.create({
          data: {
            order_id: newOrder.order_id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            item_type: 'product',
            item_name_snapshot: itemNameSnapshot,
            quantity: item.quantity,
            unit_price: price,
            total_price: price * item.quantity
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
      const newPayment = await tx.payment.create({
        data: {
          payment_code: paymentCode,
          user_id: userId,
          order_id: newOrder.order_id,
          payment_target_type: 'order',
          payment_method: payment_method, // 'cod' or 'online'
          subtotal_amount: subtotalAmount,
          voucher_discount_amount: discountAmount,
          points_used: 0,
          points_discount_amount: 0,
          final_amount: finalAmount,
          status: 'pending'
        }
      });

      // 4. Create VoucherUsage record + decrement remaining_usage
      if (voucherId) {
        await tx.voucherUsage.create({
          data: {
            voucher_id: voucherId,
            user_id: userId,
            payment_id: newPayment.payment_id,
            discount_amount: discountAmount
          }
        });
        if (voucher.remaining_usage !== null) {
          await tx.voucher.update({
            where: { voucher_id: voucherId },
            data: { remaining_usage: { decrement: 1 } }
          });
        }
      }

      // 5. Delete processed CartItems if using DB cart
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

const generateRandomPassword = () => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()_+';
  
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  const allChars = upper + lower + digits + special;
  for (let i = 0; i < 6; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

const guestCheckout = async (data) => {
  try {
    const {
      full_name,
      phone,
      email,
      address_line,
      ward,
      district,
      province,
      payment_method,
      voucher_code,
      note,
      items
    } = data;

    if (!full_name || !phone || !email || !address_line || !province || !payment_method || !items) {
      return { EM: 'Thiếu thông tin bắt buộc', EC: 1, DT: '' };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { EM: 'Không có sản phẩm nào để đặt hàng', EC: 1, DT: '' };
    }

    // Check items and stock
    let cartItemsToCheckout = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { product_id: toBigIntId(item.product_id) } });
      if (!product) {
        return { EM: `Không tìm thấy sản phẩm với ID: ${item.product_id}`, EC: -1, DT: '' };
      }
      cartItemsToCheckout.push({
        cart_item_id: null,
        product_id: product.product_id,
        variant_id: item.variant_id ? toBigIntId(item.variant_id) : null,
        quantity: parseInt(item.quantity) || 1,
        product: product
      });
    }

    // Check stock and calculate subtotal
    let subtotalAmount = 0;
    const variantsData = {}; // Cache variants
    for (let i = 0; i < cartItemsToCheckout.length; i++) {
      const item = cartItemsToCheckout[i];
      let availableStock = item.product.stock_quantity;
      let price = parseFloat(item.product.price);
      
      if (item.variant_id) {
        const variant = await prisma.productVariant.findUnique({ where: { variant_id: item.variant_id } });
        if (!variant) {
          return { EM: `Mẫu sản phẩm không hợp lệ: ${item.product.product_name}`, EC: -1, DT: '' };
        }
        availableStock = variant.stock_quantity;
        price = parseFloat(variant.price);
        variantsData[i] = variant;
      }

      if (availableStock < item.quantity) {
        return { EM: `Sản phẩm ${item.product.product_name} không đủ số lượng trong kho`, EC: 2, DT: '' };
      }
      subtotalAmount += price * item.quantity;
    }

    // Process Voucher (if any)
    let voucherId = null;
    let discountAmount = 0;
    let voucher = null;
    if (voucher_code) {
      const vCode = voucher_code.toUpperCase();
      voucher = await prisma.voucher.findUnique({ where: { voucher_code: vCode } });
      if (!voucher || voucher.status !== 'active') {
        return { EM: 'Voucher không hợp lệ hoặc không hoạt động', EC: -1, DT: '' };
      }

      const now = new Date();
      if (voucher.start_at && now < voucher.start_at) return { EM: 'Voucher chưa bắt đầu có hiệu lực', EC: -1, DT: '' };
      if (voucher.end_at && now > voucher.end_at) return { EM: 'Voucher đã hết hạn', EC: -1, DT: '' };

      if (voucher.min_order_amount && subtotalAmount < parseFloat(voucher.min_order_amount)) {
        return { EM: `Giá trị đơn hàng tối thiểu phải từ ${parseFloat(voucher.min_order_amount)}`, EC: -1, DT: '' };
      }

      if (voucher.remaining_usage !== null && voucher.remaining_usage <= 0) {
        return { EM: 'Voucher đã hết lượt sử dụng', EC: -1, DT: '' };
      }

      voucherId = voucher.voucher_id;
      if (voucher.discount_type === 'percent') {
        discountAmount = subtotalAmount * (parseFloat(voucher.discount_value) / 100);
        if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
          discountAmount = parseFloat(voucher.max_discount_amount);
        }
      } else if (voucher.discount_type === 'fixed') {
        discountAmount = parseFloat(voucher.discount_value);
      }
      
      // Ensure discount doesn't exceed subtotal
      if (discountAmount > subtotalAmount) {
        discountAmount = subtotalAmount;
      }
    }

    const shippingFee = subtotalAmount >= 500000 ? 0 : 30000; // Free ship cho đơn từ 500k, dưới 500k phí ship mặc định 30k
    const finalAmount = subtotalAmount + shippingFee - discountAmount;

    // Snapshot address fields
    const shippingAddress = `${address_line}${ward ? ', ' + ward : ''}${district ? ', ' + district : ''}${province ? ', ' + province : ''}`;

    const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const generatedPassword = generateRandomPassword();
    const hashedPassword = hashPassword(generatedPassword);

    // Execute transaction
    const resultOrder = await prisma.$transaction(async (tx) => {
      // 1. Check & delete inactive users with same email
      if (email) {
        const existingUserEmail = await tx.user.findFirst({ where: { email } });
        if (existingUserEmail) {
          if (existingUserEmail.status === 'inactive') {
            await tx.otpCode.deleteMany({ where: { user_id: existingUserEmail.user_id } });
            await tx.user.delete({ where: { user_id: existingUserEmail.user_id } });
          } else {
            throw new Error('Email đã tồn tại, vui lòng đăng nhập để mua hàng');
          }
        }
      }

      // 2. Check & delete inactive users with same phone
      if (phone) {
        const existingUserPhone = await tx.user.findFirst({ where: { phone } });
        if (existingUserPhone) {
          if (existingUserPhone.status === 'inactive') {
            await tx.otpCode.deleteMany({ where: { user_id: existingUserPhone.user_id } });
            await tx.user.delete({ where: { user_id: existingUserPhone.user_id } });
          } else {
            throw new Error('Số điện thoại đã tồn tại, vui lòng đăng nhập để mua hàng');
          }
        }
      }

      // 3. Get CUSTOMER role
      let customerRole = await tx.role.findUnique({ where: { role_code: 'CUSTOMER' } });
      if (!customerRole) {
        customerRole = await tx.role.create({
          data: { role_code: 'CUSTOMER', role_name: 'Customer' }
        });
      }

      // 4. Create Guest User
      const newGuestUser = await tx.user.create({
        data: {
          role_id: customerRole.role_id,
          full_name: full_name,
          email: email,
          phone: phone,
          password_hash: hashedPassword,
          status: 'active',
          require_password_change: true
        }
      });

      // 5. Create UserAddress record
      const guestAddress = await tx.userAddress.create({
        data: {
          user_id: newGuestUser.user_id,
          recipient_name: full_name,
          recipient_phone: phone,
          address_line: address_line,
          ward: ward || null,
          district: district || null,
          province: province,
          is_default: true
        }
      });

      // 6. Create Order
      const newOrder = await tx.order.create({
        data: {
          order_code: orderCode,
          order_type: 'product',
          user_id: newGuestUser.user_id,
          address_id: guestAddress.address_id,
          voucher_id: voucherId,
          recipient_name: full_name,
          recipient_phone: phone,
          shipping_address: shippingAddress,
          subtotal_amount: subtotalAmount,
          discount_amount: discountAmount,
          points_discount_amount: 0,
          shipping_fee: shippingFee,
          total_amount: finalAmount,
          order_status: 'pending',
          payment_status: 'unpaid',
          note: note || null
        }
      });

      // 7. Create OrderItems & Update Product Stock
      for (let i = 0; i < cartItemsToCheckout.length; i++) {
        const item = cartItemsToCheckout[i];
        let price = parseFloat(item.product.price);
        let itemNameSnapshot = item.product.product_name;
        if (item.variant_id && variantsData[i]) {
          price = parseFloat(variantsData[i].price);
          itemNameSnapshot = `${item.product.product_name} - ${variantsData[i].variant_name}`;
        }

        await tx.orderItem.create({
          data: {
            order_id: newOrder.order_id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            item_type: 'product',
            item_name_snapshot: itemNameSnapshot,
            quantity: item.quantity,
            unit_price: price,
            total_price: price * item.quantity
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

      // 8. Create Payment record
      const newPayment = await tx.payment.create({
        data: {
          payment_code: paymentCode,
          user_id: newGuestUser.user_id,
          order_id: newOrder.order_id,
          payment_target_type: 'order',
          payment_method: payment_method, // 'cod' or 'online'
          subtotal_amount: subtotalAmount,
          voucher_discount_amount: discountAmount,
          points_used: 0,
          points_discount_amount: 0,
          final_amount: finalAmount,
          status: 'pending'
        }
      });

      // 9. Create VoucherUsage record + decrement remaining_usage
      if (voucherId) {
        await tx.voucherUsage.create({
          data: {
            voucher_id: voucherId,
            user_id: newGuestUser.user_id,
            payment_id: newPayment.payment_id,
            discount_amount: discountAmount
          }
        });
        if (voucher.remaining_usage !== null) {
          await tx.voucher.update({
            where: { voucher_id: voucherId },
            data: { remaining_usage: { decrement: 1 } }
          });
        }
      }

      return newOrder;
    });

    // Send email asynchronously (non-blocking)
    sendGuestAccountEmail(email, generatedPassword, orderCode)
      .then(success => {
        if (!success) {
          console.warn(`Failed to send account credentials email to ${email}`);
        }
      })
      .catch(emailErr => {
        console.warn('Error sending guest checkout account email:', emailErr);
      });

    resultOrder.guest_account = {
      username: email || phone,
      password: generatedPassword
    };

    return {
      EM: 'Đơn hàng đã được tạo thành công. Thông tin tài khoản đã được gửi đến email của bạn.',
      EC: 0,
      DT: resultOrder
    };
  } catch (error) {
    console.error(error);
    if (error.message && (error.message.includes('Email đã tồn tại') || error.message.includes('Số điện thoại đã tồn tại'))) {
      return { EM: error.message, EC: 2, DT: '' };
    }
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getOrderCounts = async (user) => {
  try {
    const userId = toBigIntId(user.user_id);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const counts = await prisma.order.groupBy({
      by: ['order_status'],
      where: { user_id: userId },
      _count: { order_status: true }
    });

    const result = {
      all: 0,
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0
    };

    counts.forEach(c => {
      const status = c.order_status;
      const countVal = c._count.order_status;
      if (status in result) {
        result[status] = countVal;
        result.all += countVal;
      }
    });

    return { EM: 'Get order counts successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const cancelOrderByCustomer = async (id, user) => {
  try {
    const orderId = toBigIntId(id);
    if (!orderId) return { EM: 'Invalid order ID', EC: 1, DT: '' };

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: { order_items: true }
    });

    if (!order) return { EM: 'Đơn hàng không tồn tại', EC: -1, DT: '', statusCode: 404 };

    // Check ownership
    if (order.user_id.toString() !== user.user_id) {
      return { EM: 'Bạn không có quyền hủy đơn hàng này', EC: -1, DT: '', statusCode: 403 };
    }

    // Check status
    const allowedStatuses = ['pending', 'confirmed'];
    if (!allowedStatuses.includes(order.order_status)) {
      return { EM: `Không thể hủy đơn hàng đang ở trạng thái: ${order.order_status}`, EC: 2, DT: '' };
    }

    // Process transaction for cancel and return stock
    await prisma.$transaction(async (tx) => {
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
        } else if (item.product_id) {
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

    return { EM: 'Hủy đơn hàng thành công', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const repayOrder = async (id, user, data) => {
  try {
    const orderId = toBigIntId(id);
    const userId = toBigIntId(user.user_id);
    if (!orderId) return { EM: 'Invalid order ID', EC: 1, DT: '' };

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: { payments: true }
    });

    if (!order) return { EM: 'Order not found', EC: -1, DT: '' };

    // Check ownership
    if (order.user_id !== userId && user.role_code !== 'ADMIN') {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    // Check status
    if (order.payment_status !== 'unpaid' || order.order_status === 'cancelled') {
      return { EM: 'Chỉ có thể thanh toán lại cho đơn hàng chưa thanh toán và chưa bị hủy', EC: -1, DT: '' };
    }

    const payment_method = data.payment_method || 'online'; // Default to online for repay

    // Find the latest pending/failed payment
    const pendingPayment = order.payments.find(p => p.status === 'pending' || p.status === 'failed');
    
    let paymentRecord;
    
    if (pendingPayment) {
       // Update existing payment
       paymentRecord = await prisma.payment.update({
          where: { payment_id: pendingPayment.payment_id },
          data: { payment_method, status: 'pending' }
       });
    } else {
       // Create new payment record
       const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
       paymentRecord = await prisma.payment.create({
          data: {
            payment_code: paymentCode,
            user_id: userId,
            order_id: orderId,
            payment_target_type: 'order',
            payment_method: payment_method,
            subtotal_amount: order.subtotal_amount,
            voucher_discount_amount: order.discount_amount,
            points_used: 0,
            points_discount_amount: 0,
            final_amount: order.total_amount,
            status: 'pending'
          }
       });
    }

    // In a real app, generate payment URL (ZaloPay/Momo) here based on final_amount
    const mockPaymentUrl = `https://sandbox.zalopay.vn/mock-payment?amount=${order.total_amount}&orderId=${orderId}`;

    return { EM: 'Tạo yêu cầu thanh toán lại thành công', EC: 0, DT: { payment_url: mockPaymentUrl, order_id: orderId.toString() } };

  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getOrders,
  getOrderById,
  checkoutCart,
  guestCheckout,
  updateOrderStatus,
  getOrderCounts,
  cancelOrderByCustomer,
  repayOrder
};

