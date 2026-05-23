import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- PRODUCT CATEGORY ---

const getAllCategories = async () => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { status: 'active' },
      include: {
        children: true
      }
    });
    return { EM: 'Get categories successful', EC: 0, DT: categories };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createCategory = async (data) => {
  try {
    if (!data.category_name) {
      return { EM: 'Missing category_name', EC: 1, DT: '' };
    }

    const newCat = await prisma.productCategory.create({
      data: {
        category_name: data.category_name,
        parent_id: data.parent_id ? toBigIntId(data.parent_id) : null,
        image_url: data.image_url || null,
        status: data.status || 'active'
      }
    });
    return { EM: 'Create category successful', EC: 0, DT: newCat };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateCategory = async (id, data) => {
  try {
    const catId = toBigIntId(id);
    if (!catId) return { EM: 'Invalid category ID', EC: 1, DT: '' };

    const existingCat = await prisma.productCategory.findUnique({ where: { product_category_id: catId } });
    if (!existingCat) return { EM: 'Category not found', EC: -1, DT: '' };

    const updateData = {};
    if (data.category_name) updateData.category_name = data.category_name;
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id ? toBigIntId(data.parent_id) : null;
    if (data.image_url) updateData.image_url = data.image_url;
    if (data.status) updateData.status = data.status;

    const updatedCat = await prisma.productCategory.update({
      where: { product_category_id: catId },
      data: updateData
    });
    return { EM: 'Update category successful', EC: 0, DT: updatedCat };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteCategory = async (id) => {
  try {
    const catId = toBigIntId(id);
    if (!catId) return { EM: 'Invalid category ID', EC: 1, DT: '' };

    // Soft delete
    await prisma.productCategory.update({
      where: { product_category_id: catId },
      data: { status: 'inactive' }
    });
    return { EM: 'Delete category successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};


// --- PRODUCT ---

const getAllProducts = async (query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = query.filter || '';
    const categoryId = query.category_id ? toBigIntId(query.category_id) : undefined;

    const whereCondition = {
      status: 'active',
      product_name: filter ? { contains: filter } : undefined,
      product_category_id: categoryId ? categoryId : undefined
    };

    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where: whereCondition }),
      prisma.product.findMany({
        where: whereCondition,
        include: {
          category: true,
          product_images: { where: { is_primary: true } }
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get products successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        products
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getDetailProduct = async (id) => {
  try {
    const productId = toBigIntId(id);
    if (!productId) return { EM: 'Invalid product ID', EC: 1, DT: '' };

    const product = await prisma.product.findUnique({
      where: { product_id: productId },
      include: {
        category: true,
        product_images: true
      }
    });

    if (!product) return { EM: 'Product not found', EC: -1, DT: '' };

    return { EM: 'Get product successful', EC: 0, DT: product };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createProduct = async (data) => {
  try {
    if (!data.product_name || !data.product_category_id) {
      return { EM: 'Missing product_name or category_id', EC: 1, DT: '' };
    }

    const catId = toBigIntId(data.product_category_id);

    const newProduct = await prisma.product.create({
      data: {
        product_name: data.product_name,
        product_category_id: catId,
        description: data.description || null,
        price: data.price ? parseFloat(data.price) : 0,
        stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : 0,
        status: data.status || 'active'
      }
    });

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const imageRecords = data.images.map((img, index) => ({
        product_id: newProduct.product_id,
        image_url: img,
        is_primary: index === 0
      }));
      await prisma.productImage.createMany({ data: imageRecords });
    }

    return { EM: 'Create product successful', EC: 0, DT: newProduct };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateProduct = async (id, data) => {
  try {
    const productId = toBigIntId(id);
    if (!productId) return { EM: 'Invalid product ID', EC: 1, DT: '' };

    const existingProduct = await prisma.product.findUnique({ where: { product_id: productId } });
    if (!existingProduct) return { EM: 'Product not found', EC: -1, DT: '' };

    const updateData = {};
    if (data.product_name) updateData.product_name = data.product_name;
    if (data.product_category_id) updateData.product_category_id = toBigIntId(data.product_category_id);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = parseFloat(data.price);
    if (data.stock_quantity !== undefined) updateData.stock_quantity = parseInt(data.stock_quantity);
    if (data.status) updateData.status = data.status;

    const updatedProduct = await prisma.product.update({
      where: { product_id: productId },
      data: updateData
    });

    // Handle images update if provided
    if (data.images && Array.isArray(data.images)) {
      await prisma.productImage.deleteMany({ where: { product_id: productId } });
      if (data.images.length > 0) {
        const imageRecords = data.images.map((img, index) => ({
          product_id: productId,
          image_url: img,
          is_primary: index === 0
        }));
        await prisma.productImage.createMany({ data: imageRecords });
      }
    }

    return { EM: 'Update product successful', EC: 0, DT: updatedProduct };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteProduct = async (id) => {
  try {
    const productId = toBigIntId(id);
    if (!productId) return { EM: 'Invalid product ID', EC: 1, DT: '' };

    // Soft delete
    await prisma.product.update({
      where: { product_id: productId },
      data: { status: 'inactive' }
    });

    return { EM: 'Delete product successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllProducts,
  getDetailProduct,
  createProduct,
  updateProduct,
  deleteProduct
};
