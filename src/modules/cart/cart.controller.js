import Cart from './models/Cart';
import Product from '../catalog/models/Product';
import { checkVariantPurchasable } from '../catalog/stockAvailability.service';
import AppError from '../../utils/AppError';

export const formatCartResponse = async (cartDoc) => {
  if (!cartDoc) return null;
  const doc = cartDoc.toObject ? cartDoc.toObject() : JSON.parse(JSON.stringify(cartDoc));
  if (!Array.isArray(doc.items)) return doc;

  const productIds = doc.items.map(i => i.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const prodMap = new Map(products.map(p => [p._id.toString(), p]));

  doc.items = doc.items.filter(item => {
    const prod = prodMap.get(item.productId ? item.productId.toString() : '');
    return Boolean(prod && prod.name);
  }).map(item => {
    const prod = prodMap.get(item.productId ? item.productId.toString() : '') || {};
    const variant = Array.isArray(prod.variants)
      ? (prod.variants.find(v => v._id.toString() === (item.variantId || '').toString()) || prod.variants[0] || {})
      : {};
    const primaryImg = Array.isArray(prod.images) && prod.images.length > 0
      ? (prod.images.find(img => img.isPrimary) || prod.images[0])
      : null;
    const imgUrl = prod.thumbnailUrl || (primaryImg ? (primaryImg.url || primaryImg) : null);

    return {
      ...item,
      id: item._id ? item._id.toString() : `${item.productId}:${item.variantId || 'default'}`,
      cartItemId: item._id ? item._id.toString() : undefined,
      name: prod.name || item.name || '',
      image: imgUrl,
      thumbnailUrl: imgUrl,
      product: {
        id: prod._id,
        name: prod.name,
        price: prod.price,
        finalPrice: prod.finalPrice || prod.price,
        images: prod.images || [],
        thumbnailUrl: imgUrl,
        imageUrl: imgUrl,
        variants: prod.variants || []
      },
      variant: {
        id: variant._id,
        name: variant.label || variant.name,
        price: variant.finalPrice || variant.price
      }
    };
  });
  return doc;
};

export const getCart = async (req, res, next) => {
  try {
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    let cart = await Cart.findOne(query);
    if (!cart) {
      cart = new Cart(query);
      await cart.save();
    }
    const formatted = await formatCartResponse(cart);
    res.json(formatted);
  } catch (error) { next(error); }
};

export const addItem = async (req, res, next) => {
  try {
    let { productId, variantId, quantity = 1 } = req.body;
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    let cart = await Cart.findOne(query);
    if (!cart) {
      cart = new Cart(query);
    }

    if (!variantId && productId) {
      const prod = await Product.findById(productId);
      if (prod && Array.isArray(prod.variants) && prod.variants.length > 0) {
        const activeVariant = prod.variants.find(v => v.status === 'ACTIVE') || prod.variants[0];
        variantId = activeVariant._id;
      }
    }

    // Check if item already exists in cart to compute total requested
    const existing = cart.items.find(
      i => i.productId.toString() === (productId || '').toString() && 
           i.variantId && i.variantId.toString() === (variantId || '').toString()
    );
    const totalQty = existing ? existing.quantity + quantity : quantity;

    // Chặn nếu sản phẩm hết hàng hoặc vượt tồn khả dụng
    const { product, variant } = await checkVariantPurchasable(productId, variantId, totalQty);
    const resolvedVariantId = variant ? variant._id : variantId;
    const itemPrice = (variant && variant.finalPrice !== undefined && variant.finalPrice !== null) ? variant.finalPrice : (variant ? variant.price : 0);

    if (existing) {
      existing.quantity = totalQty;
      existing.price = itemPrice;
    } else {
      cart.items.push({
        productId,
        variantId: resolvedVariantId,
        quantity,
        price: itemPrice
      });
    }

    await cart.save();
    const formatted = await formatCartResponse(cart);
    res.status(201).json(formatted);
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
    if (newQty !== undefined) {
      await checkVariantPurchasable(item.productId, item.variantId, newQty);
      item.quantity = newQty;
    }
    await cart.save();
    const formatted = await formatCartResponse(cart);
    res.json(formatted);
  } catch (error) { next(error); }
};

export const removeItem = async (req, res, next) => {
  try {
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    cart.items.pull(req.params.itemId);
    await cart.save();
    const formatted = await formatCartResponse(cart);
    res.json(formatted);
  } catch (error) { next(error); }
};
