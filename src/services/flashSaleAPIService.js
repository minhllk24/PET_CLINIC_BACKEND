import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

/**
 * Get currently active flash sale, or the closest upcoming flash sale.
 */
const getActiveFlashSale = async () => {
  try {
    const now = new Date();

    // 1. Find currently active flash sale
    let flashSale = await prisma.flashSale.findFirst({
      where: {
        status: 'active',
        start_time: { lte: now },
        end_time: { gte: now }
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                product_images: { where: { is_primary: true } },
                category: true
              }
            }
          }
        }
      }
    });

    // 2. If no active flash sale, find closest upcoming one
    if (!flashSale) {
      flashSale = await prisma.flashSale.findFirst({
        where: {
          status: 'active',
          start_time: { gt: now }
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  product_images: { where: { is_primary: true } },
                  category: true
                }
              }
            }
          }
        },
        orderBy: {
          start_time: 'asc'
        }
      });
    }

    return {
      EM: flashSale ? 'Get active flash sale successful' : 'No active or upcoming flash sale found',
      EC: 0,
      DT: flashSale
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

/**
 * Create a new Flash Sale with optional items.
 * discount_price is calculated automatically based on discount_percentage.
 */
const createFlashSale = async (data) => {
  try {
    if (!data.name || !data.start_time || !data.end_time) {
      return { EM: 'Missing required fields: name, start_time, or end_time', EC: 1, DT: '' };
    }

    const items = data.items || [];
    const productIds = items.map(item => toBigIntId(item.product_id)).filter(Boolean);

    // Fetch original product prices
    const products = await prisma.product.findMany({
      where: { product_id: { in: productIds } }
    });
    const productMap = new Map(products.map(p => [p.product_id.toString(), p]));

    const itemsToCreate = [];
    for (const item of items) {
      const prodId = toBigIntId(item.product_id);
      if (!prodId) continue;

      const product = productMap.get(prodId.toString());
      if (!product) continue;

      const originalPrice = parseFloat(product.price);
      const discountPct = parseInt(item.discount_percentage) || 0;
      // Calculate discount_price automatically
      const discountPrice = originalPrice * (1 - discountPct / 100);

      itemsToCreate.push({
        product_id: prodId,
        discount_percentage: discountPct,
        discount_price: discountPrice,
        stock_quantity: parseInt(item.stock_quantity) || 0,
        sold_quantity: 0
      });
    }

    const newFlashSale = await prisma.flashSale.create({
      data: {
        name: data.name,
        start_time: new Date(data.start_time),
        end_time: new Date(data.end_time),
        status: data.status || 'active',
        items: {
          create: itemsToCreate
        }
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                product_images: { where: { is_primary: true } }
              }
            }
          }
        }
      }
    });

    return { EM: 'Create flash sale successful', EC: 0, DT: newFlashSale };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

/**
 * Update an existing Flash Sale and its items.
 */
const updateFlashSale = async (id, data) => {
  try {
    const flashSaleId = toBigIntId(id);
    if (!flashSaleId) return { EM: 'Invalid Flash Sale ID', EC: 1, DT: '' };

    const existing = await prisma.flashSale.findUnique({ where: { flash_sale_id: flashSaleId } });
    if (!existing) return { EM: 'Flash Sale not found', EC: -1, DT: '' };

    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.start_time) updateData.start_time = new Date(data.start_time);
    if (data.end_time) updateData.end_time = new Date(data.end_time);
    if (data.status) updateData.status = data.status;

    if (data.items) {
      const productIds = data.items.map(item => toBigIntId(item.product_id)).filter(Boolean);

      // Fetch original product prices
      const products = await prisma.product.findMany({
        where: { product_id: { in: productIds } }
      });
      const productMap = new Map(products.map(p => [p.product_id.toString(), p]));

      const itemsToCreate = [];
      for (const item of data.items) {
        const prodId = toBigIntId(item.product_id);
        if (!prodId) continue;

        const product = productMap.get(prodId.toString());
        if (!product) continue;

        const originalPrice = parseFloat(product.price);
        const discountPct = parseInt(item.discount_percentage) || 0;
        // Calculate discount_price automatically
        const discountPrice = originalPrice * (1 - discountPct / 100);

        itemsToCreate.push({
          product_id: prodId,
          discount_percentage: discountPct,
          discount_price: discountPrice,
          stock_quantity: parseInt(item.stock_quantity) || 0,
          sold_quantity: parseInt(item.sold_quantity) || 0
        });
      }

      // Re-create relations: clear all current items and populate new ones
      updateData.items = {
        deleteMany: {},
        create: itemsToCreate
      };
    }

    const updated = await prisma.flashSale.update({
      where: { flash_sale_id: flashSaleId },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              include: {
                product_images: { where: { is_primary: true } }
              }
            }
          }
        }
      }
    });

    return { EM: 'Update flash sale successful', EC: 0, DT: updated };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

/**
 * Delete a Flash Sale.
 */
const deleteFlashSale = async (id) => {
  try {
    const flashSaleId = toBigIntId(id);
    if (!flashSaleId) return { EM: 'Invalid Flash Sale ID', EC: 1, DT: '' };

    const existing = await prisma.flashSale.findUnique({ where: { flash_sale_id: flashSaleId } });
    if (!existing) return { EM: 'Flash Sale not found', EC: -1, DT: '' };

    await prisma.flashSale.delete({ where: { flash_sale_id: flashSaleId } });

    return { EM: 'Delete flash sale successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getActiveFlashSale,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale
};
