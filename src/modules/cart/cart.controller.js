import Cart from './models/Cart';
import { checkVariantPurchasable } from '../catalog/stockAvailability.service';
import AppError from '../../utils/AppError';

export const getCart = async (req, res, next) => {
  try {
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    let cart = await Cart.findOne(query);
    if (!cart) {
      cart = new Cart(query);
      await cart.save();
    }
    res.json(cart);
  } catch (error) { next(error); }
};

export const addItem = async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    let cart = await Cart.findOne(query);
    if (!cart) {
      cart = new Cart(query);
    }

    // Check if item already exists in cart to compute total requested
    const existing = cart.items.find(
      i => i.productId.toString() === productId.toString() && 
           i.variantId && i.variantId.toString() === (variantId || '').toString()
    );
    const totalQty = existing ? existing.quantity + quantity : quantity;

    // Chặn nếu sản phẩm hết hàng hoặc vượt tồn khả dụng
    const { product, variant } = await checkVariantPurchasable(productId, variantId, totalQty);

    if (existing) {
      existing.quantity = totalQty;
    } else {
      cart.items.push({
        productId,
        variantId,
        quantity,
        price: variant.price
      });
    }

    await cart.save();
    res.status(201).json(cart);
  } catch (error) { next(error); }
};

export const updateItem = async (req, res, next) => {
  try {
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });

    const newQty = req.body.quantity;
    // Chặn nếu cập nhật số lượng vượt tồn
    await checkVariantPurchasable(item.productId, item.variantId, newQty);

    item.quantity = newQty;
    await cart.save();
    res.json(cart);
  } catch (error) { next(error); }
};

export const removeItem = async (req, res, next) => {
  try {
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    cart.items.pull(req.params.itemId);
    await cart.save();
    res.json(cart);
  } catch (error) { next(error); }
};
