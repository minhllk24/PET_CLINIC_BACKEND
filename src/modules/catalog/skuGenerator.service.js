import mongoose from 'mongoose';
import { getNextSequence } from '../../models/Counter';

/**
 * Sinh mã sản phẩm tự động theo định dạng: SP-000123
 */
export const generateProductCode = async () => {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return `SP-${String(Date.now() % 1000000).padStart(6, '0')}`;
    }
    const seq = await getNextSequence('productCode');
    return `SP-${String(seq).padStart(6, '0')}`;
  } catch (error) {
    return `SP-${String(Date.now() % 1000000).padStart(6, '0')}`;
  }
};

/**
 * Sinh mã SKU tự động theo định dạng: SP-000123-001
 * @param {string} productCode - Mã sản phẩm (ví dụ: SP-000123)
 * @param {number} seqNumber - Số thứ tự biến thể (ví dụ: 1 -> 001)
 */
export const formatVariantSku = (productCode, seqNumber) => {
  return `${productCode}-${String(seqNumber).padStart(3, '0')}`;
};

/**
 * Tính giá sau khuyến mại
 * finalPrice = round(basePrice * (100 - discountPercent) / 100)
 */
export const calculateFinalPrice = (basePrice, discountPercent = 0) => {
  const price = Math.max(Number(basePrice) || 0, 0);
  const discount = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
  return Math.round(price * (100 - discount) / 100);
};
