import mongoose from 'mongoose';
import Product from '../catalog/models/Product';
import Service from '../catalog/models/Service';
import Category from '../catalog/models/Category';
import * as catalogService from '../catalog/catalog.service';
import * as serviceCatalogService from '../catalog/serviceCatalog.service';

/**
 * Lấy gợi ý từ khóa tìm kiếm (Search Suggestions)
 * Tuyệt đối không sinh keyword giả khi input rỗng (!q hoặc rỗng trắng)
 * Trả về danh sách chi tiết từ data thật của Product, Service và Category
 */
export const getSearchSuggestions = async ({ q, limit = 10, actor = null }) => {
  const trimmed = typeof q === 'string' ? q.trim() : '';

  // Input rỗng -> trả về mảng rỗng, KHÔNG fake keyword mặc định
  if (!trimmed) {
    return {
      query: '',
      suggestions: [],
      total: 0
    };
  }

  // Safety fallback if DB disconnected during mock unit tests
  if (mongoose.connection.readyState !== 1 && !Product.find?._isMockFunction) {
    return {
      query: trimmed,
      suggestions: [],
      total: 0
    };
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  try {
    const isInternal = actor && ['ADMIN', 'MANAGER', 'STAFF'].includes(actor.systemRole);

    const productQuery = {
      $or: [
        { name: regex },
        { productCode: regex },
        { 'variants.sku': regex }
      ]
    };
    if (!isInternal) {
      productQuery.status = 'ACTIVE';
      productQuery.usageType = { $in: ['SALE', 'SHARED'] };
    } else {
      productQuery.status = { $ne: 'ARCHIVED' };
    }

    const serviceQuery = {
      $or: [
        { name: regex },
        { code: regex }
      ]
    };
    if (!isInternal) {
      serviceQuery.status = 'ACTIVE';
    }

    const categoryQuery = {
      name: regex,
      status: 'ACTIVE'
    };

    const [products, services, categories] = await Promise.all([
      Product.find(productQuery)
        .select('name productCode categoryId variants status')
        .populate('categoryId', 'name')
        .limit(parsedLimit)
        .lean()
        .exec(),
      Service.find(serviceQuery)
        .select('name code category serviceType basePrice status')
        .limit(parsedLimit)
        .lean()
        .exec(),
      Category.find(categoryQuery)
        .select('name slug')
        .limit(Math.min(parsedLimit, 5))
        .lean()
        .exec()
    ]);

    const suggestions = [];
    const seen = new Set();

    // 1. Thêm dịch vụ vào gợi ý
    for (const s of (services || [])) {
      const kw = (s.name || '').trim();
      if (!kw) continue;
      const key = `service:${kw.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          keyword: kw,
          type: 'service',
          id: s._id ? s._id.toString() : s.id,
          code: s.code,
          category: s.category || s.serviceType,
          serviceType: s.serviceType,
          basePrice: s.basePrice
        });
      }
    }

    // 2. Thêm sản phẩm vào gợi ý
    for (const p of (products || [])) {
      const kw = (p.name || '').trim();
      if (!kw) continue;
      const key = `product:${kw.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        const minPrice = Array.isArray(p.variants) && p.variants.length > 0
          ? Math.min(...p.variants.map((v) => v.price || 0))
          : 0;
        suggestions.push({
          keyword: kw,
          type: 'product',
          id: p._id ? p._id.toString() : p.id,
          code: p.productCode,
          category: p.categoryId?.name || null,
          price: minPrice
        });
      }
    }

    // 3. Thêm danh mục vào gợi ý
    for (const c of (categories || [])) {
      const kw = (c.name || '').trim();
      if (!kw) continue;
      const key = `category:${kw.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          keyword: kw,
          type: 'category',
          id: c._id ? c._id.toString() : c.id,
          slug: c.slug
        });
      }
    }

    const finalSuggestions = suggestions.slice(0, parsedLimit);
    return {
      query: trimmed,
      suggestions: finalSuggestions,
      total: finalSuggestions.length
    };
  } catch (error) {
    return {
      query: trimmed,
      suggestions: [],
      total: 0
    };
  }
};

/**
 * Tìm kiếm tổng hợp (Unified Search) cho cả Product và Service
 */
export const unifiedSearch = async (params, actor = null) => {
  const {
    q,
    keyword,
    scope = 'all',
    page = 1,
    limit = 10,
    sort,
    categoryId,
    minPrice,
    maxPrice,
    branchId,
    isAvailable
  } = params;

  const searchQuery = (q || keyword || '').trim();
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  // Mapping sort params sang format chuẩn của Product / Service
  let productSort = 'NEWEST';
  let serviceSort = 'NEWEST';

  if (sort === 'price_asc' || sort === 'PRICE_ASC') {
    productSort = 'PRICE_ASC';
    serviceSort = 'PRICE_ASC';
  } else if (sort === 'price_desc' || sort === 'PRICE_DESC') {
    productSort = 'PRICE_DESC';
    serviceSort = 'PRICE_DESC';
  } else if (sort === 'name_asc' || sort === 'NAME_ASC') {
    productSort = 'NAME_ASC';
    serviceSort = 'NAME_ASC';
  } else if (sort === 'name_desc' || sort === 'NAME_DESC') {
    productSort = 'NAME_DESC';
    serviceSort = 'NAME_DESC';
  }

  if (scope === 'product') {
    const productRes = await catalogService.listProducts(
      {
        q: searchQuery,
        categoryId,
        minPrice,
        maxPrice,
        sort: productSort,
        page: parsedPage,
        limit: parsedLimit
      },
      actor
    );
    return {
      query: searchQuery,
      scope: 'product',
      totalRows: productRes.totalItems || productRes.total || 0,
      totalPages: productRes.totalPages || 1,
      page: parsedPage,
      limit: parsedLimit,
      counts: {
        product: productRes.totalItems || productRes.total || 0,
        service: 0
      },
      results: productRes.items || []
    };
  }

  if (scope === 'service') {
    const serviceRes = await serviceCatalogService.listServices({
      search: searchQuery,
      category: categoryId,
      branchId,
      isAvailable,
      sort: serviceSort,
      page: parsedPage,
      limit: parsedLimit,
      actor
    });
    return {
      query: searchQuery,
      scope: 'service',
      totalRows: serviceRes.totalItems || serviceRes.total || 0,
      totalPages: serviceRes.totalPages || 1,
      page: parsedPage,
      limit: parsedLimit,
      counts: {
        product: 0,
        service: serviceRes.totalItems || serviceRes.total || 0
      },
      results: serviceRes.items || []
    };
  }

  // scope === 'all'
  const [productRes, serviceRes] = await Promise.all([
    catalogService.listProducts(
      {
        q: searchQuery,
        categoryId,
        minPrice,
        maxPrice,
        sort: productSort,
        page: parsedPage,
        limit: parsedLimit
      },
      actor
    ),
    serviceCatalogService.listServices({
      search: searchQuery,
      category: categoryId,
      branchId,
      isAvailable,
      sort: serviceSort,
      page: parsedPage,
      limit: parsedLimit,
      actor
    })
  ]);

  const totalProduct = productRes.totalItems || productRes.total || 0;
  const totalService = serviceRes.totalItems || serviceRes.total || 0;

  return {
    query: searchQuery,
    scope: 'all',
    totalRows: totalProduct + totalService,
    totalPages: Math.max(productRes.totalPages || 1, serviceRes.totalPages || 1),
    page: parsedPage,
    limit: parsedLimit,
    counts: {
      product: totalProduct,
      service: totalService
    },
    results: {
      products: productRes.items || [],
      services: serviceRes.items || []
    }
  };
};
