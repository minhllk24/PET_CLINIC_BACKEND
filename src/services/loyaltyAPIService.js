import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- VOUCHERS ---
const getAllVouchers = async () => {
  try {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get vouchers successful', EC: 0, DT: vouchers };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createVoucher = async (data) => {
  try {
    const code = data.code?.toUpperCase();
    if (!code) return { EM: 'Missing voucher code', EC: 1, DT: '' };

    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (existing) return { EM: 'Voucher code already exists', EC: 1, DT: '' };

    const newVoucher = await prisma.voucher.create({
      data: {
        code,
        discount_type: data.discount_type || 'percentage',
        discount_value: parseFloat(data.discount_value) || 0,
        max_discount: data.max_discount ? parseFloat(data.max_discount) : null,
        min_order_value: data.min_order_value ? parseFloat(data.min_order_value) : null,
        start_date: data.start_date ? new Date(data.start_date) : new Date(),
        end_date: data.end_date ? new Date(data.end_date) : null,
        usage_limit: data.usage_limit ? parseInt(data.usage_limit) : null,
        status: data.status || 'active'
      }
    });

    return { EM: 'Create voucher successful', EC: 0, DT: newVoucher };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const applyVoucher = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const code = data.code?.toUpperCase();
    const orderValue = parseFloat(data.order_value);

    if (!code || isNaN(orderValue)) {
      return { EM: 'Missing code or order_value', EC: 1, DT: '' };
    }

    const voucher = await prisma.voucher.findUnique({ where: { code } });
    if (!voucher || voucher.status !== 'active') {
      return { EM: 'Voucher not valid or inactive', EC: -1, DT: '' };
    }

    const now = new Date();
    if (voucher.start_date && now < voucher.start_date) return { EM: 'Voucher not yet active', EC: -1, DT: '' };
    if (voucher.end_date && now > voucher.end_date) return { EM: 'Voucher expired', EC: -1, DT: '' };

    if (voucher.min_order_value && orderValue < parseFloat(voucher.min_order_value)) {
      return { EM: `Minimum order value is ${voucher.min_order_value}`, EC: -1, DT: '' };
    }

    if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) {
      return { EM: 'Voucher usage limit reached', EC: -1, DT: '' };
    }

    // Check if user already used this voucher
    const userUsed = await prisma.voucherUsage.findFirst({
      where: { user_id: userId, voucher_id: voucher.voucher_id }
    });
    if (userUsed) {
      return { EM: 'You have already used this voucher', EC: -1, DT: '' };
    }

    let discountAmount = 0;
    if (voucher.discount_type === 'percentage') {
      discountAmount = orderValue * (parseFloat(voucher.discount_value) / 100);
      if (voucher.max_discount && discountAmount > parseFloat(voucher.max_discount)) {
        discountAmount = parseFloat(voucher.max_discount);
      }
    } else {
      discountAmount = parseFloat(voucher.discount_value);
    }

    return { EM: 'Voucher valid', EC: 0, DT: { discountAmount, voucher_id: voucher.voucher_id } };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- LOYALTY ---
const getMyPoints = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { loyalty_points: true }
    });

    return { EM: 'Get points successful', EC: 0, DT: { points: user.loyalty_points } };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getMyTransactions = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    const trans = await prisma.loyaltyPointTransaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    return { EM: 'Get point transactions successful', EC: 0, DT: trans };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getAllVouchers,
  createVoucher,
  applyVoucher,
  getMyPoints,
  getMyTransactions
};
