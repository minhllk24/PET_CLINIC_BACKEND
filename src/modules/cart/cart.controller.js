import Cart from './models/Cart';

export const getCart = async (req, res, next) => {
  try {
    // Basic implementation finding cart by actor id or token (if guest)
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
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    // Add item logic
    cart.items.push(req.body);
    await cart.save();
    res.json(cart);
  } catch (error) { next(error); }
};

export const updateItem = async (req, res, next) => {
  try {
    const query = req.actor ? { customerId: req.actor.id } : { tokenHash: req.headers['x-guest-cart-token'] };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    const item = cart.items.id(req.params.itemId);
    if (item) {
      item.quantity = req.body.quantity;
      await cart.save();
    }
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
