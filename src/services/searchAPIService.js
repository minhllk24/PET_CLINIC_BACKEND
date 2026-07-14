import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- INTERNAL SEARCH HELPERS ---

const searchProducts = async (keyword, filters = {}) => {
  const { productCategoryId, minPrice, maxPrice } = filters;

  const andConditions = [
    {
      OR: [
        { product_name: { contains: keyword } },
        { description: { contains: keyword } }
      ]
    }
  ];

  if (productCategoryId) {
    andConditions.push({ product_category_id: toBigIntId(productCategoryId) });
  }
  if (minPrice !== undefined) {
    andConditions.push({ price: { gte: minPrice } });
  }
  if (maxPrice !== undefined) {
    andConditions.push({ price: { lte: maxPrice } });
  }

  const whereCondition = {
    status: 'active',
    AND: andConditions
  };

  const [count, items] = await prisma.$transaction([
    prisma.product.count({ where: whereCondition }),
    prisma.product.findMany({
      where: whereCondition,
      include: {
        category: true,
        product_images: { where: { is_primary: true } }
      },
      orderBy: { created_at: 'desc' }
    })
  ]);

  return {
    count,
    items: items.map(item => ({
      _type: 'product',
      ...item,
      _relevance: calculateRelevance(keyword, item.product_name, item.description)
    }))
  };
};

const searchServices = async (keyword, filters = {}) => {
  const { serviceCategoryId, minPrice, maxPrice } = filters;

  const andConditions = [
    {
      OR: [
        { service_name: { contains: keyword } },
        { description: { contains: keyword } }
      ]
    }
  ];

  if (serviceCategoryId) {
    andConditions.push({ service_category_id: toBigIntId(serviceCategoryId) });
  }
  if (minPrice !== undefined) {
    andConditions.push({ base_price: { gte: minPrice } });
  }
  if (maxPrice !== undefined) {
    andConditions.push({ base_price: { lte: maxPrice } });
  }

  const whereCondition = {
    status: 'active',
    AND: andConditions
  };

  const [count, items] = await prisma.$transaction([
    prisma.service.count({ where: whereCondition }),
    prisma.service.findMany({
      where: whereCondition,
      include: { category: true },
      orderBy: { service_id: 'desc' }
    })
  ]);

  return {
    count,
    items: items.map(item => ({
      _type: 'service',
      ...item,
      _relevance: calculateRelevance(keyword, item.service_name, item.description)
    }))
  };
};

const searchPosts = async (keyword, isCommunity = false) => {
  const whereCondition = {
    status: 'published',
    post_type: isCommunity ? 'community' : 'official_blog',
    OR: [
      { title: { contains: keyword } },
      { excerpt: { contains: keyword } },
      { hashtags: { contains: keyword } }
    ]
  };

  const [count, items] = await prisma.$transaction([
    prisma.post.count({ where: whereCondition }),
    prisma.post.findMany({
      where: whereCondition,
      select: {
        post_id: true,
        post_category_id: true,
        post_type: true,
        title: true,
        slug: true,
        thumbnail_url: true,
        excerpt: true,
        view_count: true,
        likes_count: true,
        hashtags: true,
        created_at: true,
        author: {
          select: { full_name: true, avatar_url: true }
        },
        category: {
          select: { post_category_id: true, category_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    })
  ]);

  return {
    count,
    items: items.map(item => ({
      _type: isCommunity ? 'community' : 'blog',
      ...item,
      _relevance: calculateRelevance(keyword, item.title, item.excerpt)
    }))
  };
};

const searchFirstAid = async (keyword) => {
  const whereCondition = {
    status: 'active',
    OR: [
      { title: { contains: keyword } },
      { summary: { contains: keyword } }
    ]
  };

  const [count, items] = await prisma.$transaction([
    prisma.firstAidGuide.count({ where: whereCondition }),
    prisma.firstAidGuide.findMany({
      where: whereCondition,
      select: {
        guide_id: true,
        title: true,
        slug: true,
        summary: true,
        thumbnail_url: true,
        view_count: true,
        created_at: true,
        category: {
          select: { category_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    })
  ]);

  return {
    count,
    items: items.map(item => ({
      _type: 'firstaid',
      ...item,
      _relevance: calculateRelevance(keyword, item.title, item.summary)
    }))
  };
};

// --- RELEVANCE SCORING ---

const calculateRelevance = (keyword, name, description) => {
  const kw = keyword.toLowerCase();
  const nameStr = (name || '').toLowerCase();
  const descStr = (description || '').toLowerCase();

  let score = 0;

  // Exact match in name → highest
  if (nameStr === kw) {
    score += 100;
  } else if (nameStr.startsWith(kw)) {
    score += 80;
  } else if (nameStr.includes(kw)) {
    score += 60;
  }

  // Match in description
  if (descStr.includes(kw)) {
    score += 20;
  }

  return score;
};

// --- SORT HELPERS ---

const getPrice = (item) => {
  if (item._type === 'product') return parseFloat(item.price) || 0;
  if (item._type === 'service') return parseFloat(item.base_price) || 0;
  return 0;
};

const getSortValue = (item, sortType) => {
  switch (sortType) {
    case 'best_selling':
      if (item._type === 'product') return item.sold_quantity || 0;
      if (item._type === 'service') return parseFloat(item.average_rating) || 0;
      return item.view_count || 0;

    case 'rating':
      if (item._type === 'product' || item._type === 'service') {
        return parseFloat(item.average_rating) || 0;
      }
      return item.view_count || 0;

    default:
      return 0;
  }
};

const sortResults = (results, sort) => {
  switch (sort) {
    case 'relevance':
      return results.sort((a, b) => b._relevance - a._relevance);

    case 'price_asc':
      return results.sort((a, b) => getPrice(a) - getPrice(b));

    case 'price_desc':
      return results.sort((a, b) => getPrice(b) - getPrice(a));

    case 'newest':
      return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    case 'best_selling':
    case 'rating':
      return results.sort((a, b) => getSortValue(b, sort) - getSortValue(a, sort));

    default:
      return results.sort((a, b) => b._relevance - a._relevance);
  }
};

// --- FACET COUNT HELPERS ---

const getProductCategoryFacets = async (keyword, filters = {}) => {
  const { minPrice, maxPrice } = filters;

  const andConditions = [
    {
      OR: [
        { product_name: { contains: keyword } },
        { description: { contains: keyword } }
      ]
    }
  ];

  if (minPrice !== undefined) {
    andConditions.push({ price: { gte: minPrice } });
  }
  if (maxPrice !== undefined) {
    andConditions.push({ price: { lte: maxPrice } });
  }

  const facets = await prisma.product.groupBy({
    by: ['product_category_id'],
    where: {
      status: 'active',
      AND: andConditions
    },
    _count: {
      product_id: true
    }
  });

  const countsMap = {};
  facets.forEach(f => {
    countsMap[f.product_category_id.toString()] = f._count.product_id;
  });
  return countsMap;
};

const getServiceCategoryFacets = async (keyword, filters = {}) => {
  const { minPrice, maxPrice } = filters;

  const andConditions = [
    {
      OR: [
        { service_name: { contains: keyword } },
        { description: { contains: keyword } }
      ]
    }
  ];

  if (minPrice !== undefined) {
    andConditions.push({ base_price: { gte: minPrice } });
  }
  if (maxPrice !== undefined) {
    andConditions.push({ base_price: { lte: maxPrice } });
  }

  const facets = await prisma.service.groupBy({
    by: ['service_category_id'],
    where: {
      status: 'active',
      AND: andConditions
    },
    _count: {
      service_id: true
    }
  });

  const countsMap = {};
  facets.forEach(f => {
    countsMap[f.service_category_id.toString()] = f._count.service_id;
  });
  return countsMap;
};

// --- MAIN SEARCH FUNCTION ---

const unifiedSearch = async (query) => {
  try {
    const keyword = (query.keyword || '').trim().substring(0, 100);
    if (!keyword) {
      return { EM: 'Keyword is required', EC: 1, DT: '' };
    }

    const scope = query.scope || 'all';
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const sort = query.sort || 'relevance';
    const userId = query.userId || null;

    const filters = {
      serviceCategoryId: query.serviceCategoryId || null,
      productCategoryId: query.productCategoryId || null,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined
    };

    // Validate price range
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) {
      filters.minPrice = undefined;
      filters.maxPrice = undefined;
    }

    // Run parallel queries based on scope and calculate facets
    const validScopes = ['all', 'service', 'product', 'blog', 'firstaid', 'community'];
    const activeScope = validScopes.includes(scope) ? scope : 'all';

    const promises = [];
    const scopeKeys = [];

    // Search queries
    if (activeScope === 'all' || activeScope === 'product') {
      promises.push(searchProducts(keyword, filters));
      scopeKeys.push('product');
    }
    if (activeScope === 'all' || activeScope === 'service') {
      promises.push(searchServices(keyword, filters));
      scopeKeys.push('service');
    }
    if (activeScope === 'all' || activeScope === 'blog') {
      promises.push(searchPosts(keyword, false));
      scopeKeys.push('blog');
    }
    if (activeScope === 'all' || activeScope === 'community') {
      promises.push(searchPosts(keyword, true));
      scopeKeys.push('community');
    }
    if (activeScope === 'all' || activeScope === 'firstaid') {
      promises.push(searchFirstAid(keyword));
      scopeKeys.push('firstaid');
    }

    // Facet queries (run in parallel for sidebar counts)
    const productFacetPromise = getProductCategoryFacets(keyword, filters);
    const serviceFacetPromise = getServiceCategoryFacets(keyword, filters);

    const [searchResults, productFacets, serviceFacets] = await Promise.all([
      Promise.all(promises),
      productFacetPromise,
      serviceFacetPromise
    ]);

    // Build counts and merge items
    const counts = { service: 0, product: 0, blog: 0, community: 0, firstaid: 0 };
    let allItems = [];

    searchResults.forEach((result, index) => {
      const key = scopeKeys[index];
      counts[key] = result.count;
      allItems = allItems.concat(result.items);
    });

    // If scope is not 'all', we still want to get counts for other scopes (for tab badges)
    if (activeScope !== 'all') {
      const countPromises = [];
      const countKeys = [];

      if (activeScope !== 'product') {
        countPromises.push(searchProducts(keyword, filters).then(r => r.count));
        countKeys.push('product');
      }
      if (activeScope !== 'service') {
        countPromises.push(searchServices(keyword, filters).then(r => r.count));
        countKeys.push('service');
      }
      if (activeScope !== 'blog') {
        countPromises.push(searchPosts(keyword, false).then(r => r.count));
        countKeys.push('blog');
      }
      if (activeScope !== 'community') {
        countPromises.push(searchPosts(keyword, true).then(r => r.count));
        countKeys.push('community');
      }
      if (activeScope !== 'firstaid') {
        countPromises.push(searchFirstAid(keyword).then(r => r.count));
        countKeys.push('firstaid');
      }

      const otherCounts = await Promise.all(countPromises);
      otherCounts.forEach((count, index) => {
        counts[countKeys[index]] = count;
      });
    }

    // Sort merged results
    const sortedItems = sortResults(allItems, sort);

    // Remove internal _relevance field before pagination
    const totalRows = sortedItems.length;
    const totalPages = Math.ceil(totalRows / limit);
    const skip = (page - 1) * limit;
    const paginatedItems = sortedItems.slice(skip, skip + limit).map(({ _relevance, ...item }) => item);

    // Fire-and-forget: log search
    logSearch(userId, keyword, activeScope, filters);

    return {
      EM: 'Search successful',
      EC: 0,
      DT: {
        keyword,
        scope: activeScope,
        totalRows,
        totalPages,
        counts,
        facetCounts: {
          productCategories: productFacets,
          serviceCategories: serviceFacets
        },
        results: paginatedItems
      }
    };
  } catch (error) {
    console.error('Unified search error:', error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- SEARCH SUGGESTIONS ---

const getSearchSuggestions = async (query) => {
  try {
    const q = (query.q || '').trim();
    const limit = parseInt(query.limit) || 10;

    let suggestions;
    if (q) {
      suggestions = await prisma.$queryRaw`
        SELECT keyword, COUNT(*) as search_count
        FROM search_logs
        WHERE keyword LIKE ${'%' + q + '%'}
        GROUP BY keyword
        ORDER BY search_count DESC
        LIMIT ${limit}
      `;
    } else {
      suggestions = await prisma.$queryRaw`
        SELECT keyword, COUNT(*) as search_count
        FROM search_logs
        GROUP BY keyword
        ORDER BY search_count DESC
        LIMIT ${limit}
      `;
    }

    return {
      EM: 'Get suggestions successful',
      EC: 0,
      DT: suggestions.map(s => ({
        keyword: s.keyword,
        count: Number(s.search_count)
      }))
    };
  } catch (error) {
    console.error('Search suggestions error:', error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- SEARCH LOG ---

const logSearch = (userId, keyword, scope, filters) => {
  const filtersJson = {};
  if (filters.serviceCategoryId) filtersJson.serviceCategoryId = filters.serviceCategoryId;
  if (filters.productCategoryId) filtersJson.productCategoryId = filters.productCategoryId;
  if (filters.minPrice !== undefined) filtersJson.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined) filtersJson.maxPrice = filters.maxPrice;

  prisma.searchLog.create({
    data: {
      user_id: userId ? toBigIntId(userId) : null,
      keyword: keyword.substring(0, 255),
      search_scope: scope,
      filters_json: Object.keys(filtersJson).length > 0 ? filtersJson : undefined
    }
  }).catch(err => console.error('Failed to log search:', err));
};

module.exports = {
  unifiedSearch,
  getSearchSuggestions
};
