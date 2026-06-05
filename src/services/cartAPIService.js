import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getCartByUserId = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    let cart = await prisma.cart.findUnique({
      where: { user_id: userId },
      include: {
        cart_items: {
          include: {
            product: {
              include: { product_images: { where: { is_primary: true } } }
            }
          }
        }
      }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { user_id: userId },
        include: { cart_items: true }
      });
    }

    return { EM: 'Get cart successful', EC: 0, DT: cart };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const addToCart = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    if (!data.product_id || !data.quantity) {
      return { EM: 'Missing product_id or quantity', EC: 1, DT: '' };
    }

    const productId = toBigIntId(data.product_id);
    const quantity = parseInt(data.quantity);
    const variantId = data.variant_id ? toBigIntId(data.variant_id) : null;

    // Get or create cart
    let cart = await prisma.cart.findUnique({ where: { user_id: userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { user_id: userId } });
    }

    // Check product exists and stock
    const product = await prisma.product.findUnique({ where: { product_id: productId } });
    if (!product || product.status !== 'active') {
      return { EM: 'Product not available', EC: -1, DT: '' };
    }

    let availableStock = product.stock_quantity;
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { variant_id: variantId } });
      if (!variant || variant.product_id !== productId) {
        return { EM: 'Invalid product variant', EC: -1, DT: '' };
      }
      availableStock = variant.stock_quantity;
    }

    if (availableStock < quantity) {
      return { EM: 'Not enough stock', EC: 2, DT: '' };
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { 
        cart_id: cart.cart_id, 
        product_id: productId,
        variant_id: variantId 
      }
    });

    let resultItem;
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (availableStock < newQuantity) {
        return { EM: 'Not enough stock to add more', EC: 2, DT: '' };
      }
      resultItem = await prisma.cartItem.update({
        where: { cart_item_id: existingItem.cart_item_id },
        data: { quantity: newQuantity }
      });
    } else {
      resultItem = await prisma.cartItem.create({
        data: {
          cart_id: cart.cart_id,
          product_id: productId,
          variant_id: variantId,
          quantity: quantity,
          is_selected: true
        }
      });
    }

    return { EM: 'Add to cart successful', EC: 0, DT: resultItem };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateCartItem = async (userIdStr, itemId, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const cartItemId = toBigIntId(itemId);
    if (!userId || !cartItemId) return { EM: 'Invalid ID', EC: 1, DT: '' };

    const cart = await prisma.cart.findUnique({ where: { user_id: userId } });
    if (!cart) return { EM: 'Cart not found', EC: -1, DT: '' };

    const item = await prisma.cartItem.findFirst({
      where: { cart_item_id: cartItemId, cart_id: cart.cart_id },
      include: { product: true }
    });

    if (!item) return { EM: 'Cart item not found', EC: -1, DT: '' };

    const updateData = {};
    if (data.quantity !== undefined) {
      const q = parseInt(data.quantity);
      if (q <= 0) {
        // Remove item if quantity <= 0
        await prisma.cartItem.delete({ where: { cart_item_id: cartItemId } });
        return { EM: 'Item removed from cart', EC: 0, DT: '' };
      }

      let availableStock = item.product.stock_quantity;
      if (item.variant_id) {
        const variant = await prisma.productVariant.findUnique({ where: { variant_id: item.variant_id } });
        if (variant) {
          availableStock = variant.stock_quantity;
        }
      }

      if (availableStock < q) {
        return { EM: 'Not enough stock', EC: 2, DT: '' };
      }
      updateData.quantity = q;
    }

    if (data.is_selected !== undefined) {
      updateData.is_selected = data.is_selected;
    }

    const updatedItem = await prisma.cartItem.update({
      where: { cart_item_id: cartItemId },
      data: updateData
    });

    return { EM: 'Update cart item successful', EC: 0, DT: updatedItem };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteCartItem = async (userIdStr, itemId) => {
  try {
    const userId = toBigIntId(userIdStr);
    const cartItemId = toBigIntId(itemId);
    if (!userId || !cartItemId) return { EM: 'Invalid ID', EC: 1, DT: '' };

    const cart = await prisma.cart.findUnique({ where: { user_id: userId } });
    if (!cart) return { EM: 'Cart not found', EC: -1, DT: '' };

    const item = await prisma.cartItem.findFirst({
      where: { cart_item_id: cartItemId, cart_id: cart.cart_id }
    });

    if (!item) return { EM: 'Cart item not found', EC: -1, DT: '' };

    await prisma.cartItem.delete({ where: { cart_item_id: cartItemId } });

    return { EM: 'Delete cart item successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getCartByUserId,
  addToCart,
  updateCartItem,
  deleteCartItem
};
