import * as voucherService from './voucher.service';
import Cart from '../cart/models/Cart';
import Service from '../catalog/models/Service';

/**
 * Public/Customer/Guest: Validate voucher eligibility & calculate discount preview
 * Endpoint: POST /api/v1/vouchers/validate
 */
export const validateVoucher = async (req, res, next) => {
  try {
    const { code, scope, cartId, serviceIds, branchId } = req.body;
    let subtotal = 0;

    // Resolve subtotal based on scope to evaluate minCondition & percentage discount
    if (scope === 'ORDER') {
      let cart = null;
      if (cartId) {
        cart = await Cart.findById(cartId);
      } else if (req.actor) {
        cart = await Cart.findOne({ customerId: req.actor.id });
      } else if (req.headers['x-guest-cart-token']) {
        cart = await Cart.findOne({ tokenHash: req.headers['x-guest-cart-token'] });
      }

      if (cart && Array.isArray(cart.items)) {
        subtotal = cart.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
      }
    } else if (scope === 'SERVICE' && Array.isArray(serviceIds) && serviceIds.length > 0) {
      const services = await Service.find({ _id: { $in: serviceIds } });
      subtotal = services.reduce((sum, s) => sum + (Number(s.basePrice) || 0), 0);
    }

    const result = await voucherService.validateVoucherEligibility({
      code,
      scope,
      subtotal,
      cartId,
      serviceIds,
      branchId,
      customerId: req.actor ? req.actor.id : undefined
    });

    res.status(200).json({
      code: result.code,
      valid: result.valid,
      reason: result.reason,
      discount: result.discount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new voucher
 * Endpoint: POST /api/v1/vouchers
 */
export const createVoucher = async (req, res, next) => {
  try {
    const voucher = await voucherService.createVoucher(req.body);
    res.status(201).json(voucher);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin / Manager: List vouchers with optional status and scope filters
 * Endpoint: GET /api/v1/vouchers
 */
export const listVouchers = async (req, res, next) => {
  try {
    const { status, scope, limit, cursor, search, q } = req.query;
    const result = await voucherService.listVouchers({
      status,
      scope,
      limit,
      cursor,
      search: search || q
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update voucher details, effective dates, quota or status
 * Endpoint: PATCH /api/v1/vouchers/:id
 */
export const updateVoucher = async (req, res, next) => {
  try {
    const voucher = await voucherService.updateVoucher(req.params.id, req.body);
    res.status(200).json(voucher);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin / Manager: Get voucher details by ID
 * Endpoint: GET /api/v1/vouchers/:id
 */
export const getVoucherById = async (req, res, next) => {
  try {
    const voucher = await voucherService.getVoucherById(req.params.id);
    res.status(200).json(voucher);
  } catch (error) {
    next(error);
  }
};
