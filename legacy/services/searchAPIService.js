import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- INTERNAL SEARCH HELPERS ---

const searchProducts = async (keyword, filters = {}) => {
  const { productCategoryId, minPrice, maxPrice, minRating, targetSpecies } = filters;

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
  if (minRating !== undefined) {
    andConditions.push({ average_rating: { gte: minRating } });
  }
  if (targetSpecies && targetSpecies !== 'all') {
    andConditions.push({
      OR: [
        { target_species: targetSpecies },
        { target_species: 'all' }
      ]
    });
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
  const { serviceCategoryId, minPrice, maxPrice, minRating, targetSpecies } = filters;

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
  if (minRating !== undefined) {
    andConditions.push({ average_rating: { gte: minRating } });
  }
  if (targetSpecies && targetSpecies !== 'all') {
    andConditions.push({
      OR: [
        { target_species: targetSpecies },
        { target_species: 'all' }
      ]
    });
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

const searchPosts = async (keyword, isCommunity = false, filters = {}) => {
  const { postCategoryId } = filters;

  const andConditions = [
    {
      OR: [
        { title: { contains: keyword } },
        { excerpt: { contains: keyword } },
        { hashtags: { contains: keyword } }
      ]
    }
  ];

  if (postCategoryId) {
    andConditions.push({ post_category_id: toBigIntId(postCategoryId) });
  }

  const whereCondition = {
    status: 'published',
    post_type: isCommunity ? 'community' : 'official_blog',
    AND: andConditions
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
    status: 'published',
    OR: [
      { title: { contains: keyword } },
      { situation_description: { contains: keyword } }
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
        situation_description: true,
        created_at: true,
        category: {
          select: { category_name: true }
        },
        media: {
          where: { media_type: 'image' },
          select: { file_url: true },
          take: 1
        },
        steps: {
          where: { image_url: { not: null } },
          select: { image_url: true },
          orderBy: { step_number: 'asc' },
          take: 1
        }
      },
      orderBy: { created_at: 'desc' }
    })
  ]);

  return {
    count,
    items: items.map(item => ({
      _type: 'firstaid',
      summary: item.situation_description,
      thumbnail_url: item.media?.[0]?.file_url || item.steps?.[0]?.image_url || null,
      view_count: 0,
      ...item,
      _relevance: calculateRelevance(keyword, item.title, item.situation_description)
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

const getPostCategoryFacets = async (keyword) => {
  const facets = await prisma.post.groupBy({
    by: ['post_category_id', 'post_type'],
    where: {
      status: 'published',
      OR: [
        { title: { contains: keyword } },
        { excerpt: { contains: keyword } },
        { hashtags: { contains: keyword } }
      ]
    },
    _count: { post_id: true }
  });

  const blogCounts = {};
  const communityCounts = {};

  facets.forEach(f => {
    if (f.post_type === 'official_blog') {
      if (f.post_category_id) {
        blogCounts[f.post_category_id.toString()] = (blogCounts[f.post_category_id.toString()] || 0) + f._count.post_id;
      }
    } else if (f.post_type === 'community') {
      if (f.post_category_id) {
        communityCounts[f.post_category_id.toString()] = (communityCounts[f.post_category_id.toString()] || 0) + f._count.post_id;
      }
    }
  });

  return { blog: blogCounts, community: communityCounts };
};

const getFirstAidCategoryFacets = async (keyword) => {
  const facets = await prisma.firstAidGuide.groupBy({
    by: ['first_aid_category_id'],
    where: {
      status: 'published',
      OR: [
        { title: { contains: keyword } },
        { situation_description: { contains: keyword } }
      ]
    },
    _count: { guide_id: true }
  });
  
  const countsMap = {};
  facets.forEach(f => {
    if (f.first_aid_category_id) {
      countsMap[f.first_aid_category_id.toString()] = f._count.guide_id;
    }
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
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
      minRating: query.minRating ? parseFloat(query.minRating) : undefined,
      targetSpecies: query.targetSpecies || null,
      postCategoryId: query.postCategoryId || null
    };

    // Validate price range
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) {
      filters.minPrice = undefined;
      filters.maxPrice = undefined;
    }

    // Run parallel queries based on scope and calculate facets
    const validScopes = ['all', 'service', 'product', 'blog', 'firstaid', 'community', 'article'];
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
    if (['all', 'article', 'blog'].includes(activeScope)) {
      promises.push(searchPosts(keyword, false, filters));
      scopeKeys.push('blog');
    }
    if (['all', 'article', 'community'].includes(activeScope)) {
      promises.push(searchPosts(keyword, true, filters));
      scopeKeys.push('community');
    }
    if (['all', 'article', 'firstaid'].includes(activeScope)) {
      promises.push(searchFirstAid(keyword));
      scopeKeys.push('firstaid');
    }

    // Facet queries (run in parallel for sidebar counts)
    const productFacetPromise = getProductCategoryFacets(keyword, filters);
    const serviceFacetPromise = getServiceCategoryFacets(keyword, filters);
    const postFacetPromise = getPostCategoryFacets(keyword);
    const firstAidFacetPromise = getFirstAidCategoryFacets(keyword);

    const [searchResults, productFacets, serviceFacets, postFacets, firstAidFacets] = await Promise.all([
      Promise.all(promises),
      productFacetPromise,
      serviceFacetPromise,
      postFacetPromise,
      firstAidFacetPromise
    ]);

    // Build counts and merge items
    const counts = { service: 0, product: 0, blog: 0, community: 0, firstaid: 0, article: 0 };
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
      if (!['blog', 'article'].includes(activeScope)) {
        countPromises.push(searchPosts(keyword, false, filters).then(r => r.count));
        countKeys.push('blog');
      }
      if (!['community', 'article'].includes(activeScope)) {
        countPromises.push(searchPosts(keyword, true, filters).then(r => r.count));
        countKeys.push('community');
      }
      if (!['firstaid', 'article'].includes(activeScope)) {
        countPromises.push(searchFirstAid(keyword).then(r => r.count));
        countKeys.push('firstaid');
      }

      // Compute aggregated article count
      counts.article = counts.blog + counts.community + counts.firstaid;

      const otherCounts = await Promise.all(countPromises);
      otherCounts.forEach((count, index) => {
        counts[countKeys[index]] = count;
      });
      
      // Update article count again in case blog/community/firstaid were in otherCounts
      counts.article = counts.blog + counts.community + counts.firstaid;
    } else {
      counts.article = counts.blog + counts.community + counts.firstaid;
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
          serviceCategories: serviceFacets,
          blogCategories: postFacets.blog,
          communityCategories: postFacets.community,
          firstAidCategories: firstAidFacets
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

    let logs = [];
    let products = [];
    let services = [];

    if (q) {
      logs = await prisma.$queryRaw`
        SELECT keyword, COUNT(*) as search_count
        FROM search_logs
        WHERE keyword LIKE ${'%' + q + '%'}
        GROUP BY keyword
        ORDER BY search_count DESC
        LIMIT ${limit}
      `;

      products = await prisma.product.findMany({
        where: { product_name: { contains: q }, status: 'active' },
        select: { product_name: true },
        take: 3
      });

      services = await prisma.service.findMany({
        where: { service_name: { contains: q }, status: 'active' },
        select: { service_name: true },
        take: 3
      });
    } else {
      logs = await prisma.$queryRaw`
        SELECT keyword, COUNT(*) as search_count
        FROM search_logs
        GROUP BY keyword
        ORDER BY search_count DESC
        LIMIT ${limit}
      `;
    }

    const uniqueKeywords = new Set();
    const result = [];

    // Ưu tiên đưa tên sản phẩm, dịch vụ lên trước nếu có search query
    services.forEach(s => {
      const kw = s.service_name;
      if (!uniqueKeywords.has(kw)) {
        uniqueKeywords.add(kw);
        result.push({ keyword: kw, count: 0, type: 'service' });
      }
    });

    products.forEach(p => {
      const kw = p.product_name;
      if (!uniqueKeywords.has(kw)) {
        uniqueKeywords.add(kw);
        result.push({ keyword: kw, count: 0, type: 'product' });
      }
    });

    // Lịch sử search
    logs.forEach(l => {
      const kw = l.keyword;
      if (!uniqueKeywords.has(kw)) {
        uniqueKeywords.add(kw);
        result.push({ keyword: kw, count: Number(l.search_count), type: 'history' });
      }
    });

    return {
      EM: 'Get suggestions successful',
      EC: 0,
      DT: result.slice(0, limit)
    };
  } catch (error) {
    console.error('Search suggestions error:', error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- SEARCH LOG ---

const logSearch = (userId, keyword, scope, filters) => {
  const loggableScopes = ['all', 'product', 'service', 'blog'];
  const safeScope = loggableScopes.includes(scope) ? scope : 'blog';
  const filtersJson = {};
  if (filters.serviceCategoryId) filtersJson.serviceCategoryId = filters.serviceCategoryId;
  if (filters.productCategoryId) filtersJson.productCategoryId = filters.productCategoryId;
  if (filters.minPrice !== undefined) filtersJson.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined) filtersJson.maxPrice = filters.maxPrice;

  prisma.searchLog.create({
    data: {
      user_id: userId ? toBigIntId(userId) : null,
      keyword: keyword.substring(0, 255),
      search_scope: safeScope,
      filters_json: Object.keys(filtersJson).length > 0 ? filtersJson : undefined
    }
  }).catch(err => console.error('Failed to log search:', err));
};

module.exports = {
  unifiedSearch,
  getSearchSuggestions
};
