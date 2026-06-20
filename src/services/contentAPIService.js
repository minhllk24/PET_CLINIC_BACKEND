import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- POSTS ---
const getPosts = async (query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = query.type; // 'official_blog' or 'community' (mapped from community_post if needed)
    const categoryId = query.categoryId;
    const excludeId = query.excludeId;

    const whereCondition = { status: 'published', is_featured: false };
    if (type) {
      whereCondition.post_type = type === 'community_post' ? 'community' : type;
    }
    if (categoryId) {
      whereCondition.post_category_id = toBigIntId(categoryId);
    }
    if (excludeId) {
      whereCondition.post_id = { not: toBigIntId(excludeId) };
    }

    const [total, posts] = await prisma.$transaction([
      prisma.post.count({ where: whereCondition }),
      prisma.post.findMany({
        where: whereCondition,
        select: {
          post_id: true,
          post_category_id: true,
          author_user_id: true,
          post_type: true,
          title: true,
          slug: true,
          thumbnail_url: true,
          excerpt: true,
          likes_count: true,
          hashtags: true,
          view_count: true,
          created_at: true,
          updated_at: true,
          author: {
            select: {
              full_name: true,
              avatar_url: true
            }
          },
          category: {
            select: {
              post_category_id: true,
              category_name: true
            }
          },
          _count: {
            select: { comments: true }
          }
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return { EM: 'Get posts successful', EC: 0, DT: { totalRows: total, totalPages: Math.ceil(total/limit), posts } };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getPostBySlug = async (slug) => {
  try {
    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: { select: { full_name: true, avatar_url: true } },
        category: { select: { post_category_id: true, category_name: true } },
        comments: {
          include: { user: { select: { full_name: true, avatar_url: true } } },
          orderBy: { created_at: 'asc' }
        }
      }
    });
    if (!post) return { EM: 'Post not found', EC: -1, DT: '' };

    // Tăng view_count (fire-and-forget, không block response)
    prisma.post.update({
      where: { slug },
      data: { view_count: { increment: 1 } }
    }).catch(err => console.error('Failed to increment view_count:', err));

    return { EM: 'Get post successful', EC: 0, DT: post };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createPost = async (user, data) => {
  try {
    const userId = toBigIntId(user.user_id);
    const postType = user.role_code === 'ADMIN' ? 'official_blog' : 'community';

    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const newPost = await prisma.post.create({
      data: {
        author_user_id: userId,
        post_category_id: toBigIntId(data.post_category_id),
        post_type: postType,
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        content: data.content,
        thumbnail_url: data.thumbnail_url || null,
        status: data.status || 'published'
      }
    });

    return { EM: 'Create post successful', EC: 0, DT: newPost };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getFeaturedPost = async () => {
  try {
    const post = await prisma.post.findFirst({
      where: {
        status: 'published',
        is_featured: true
      },
      select: {
        post_id: true,
        post_category_id: true,
        author_user_id: true,
        post_type: true,
        title: true,
        slug: true,
        thumbnail_url: true,
        excerpt: true,
        likes_count: true,
        hashtags: true,
        view_count: true,
        created_at: true,
        updated_at: true,
        author: {
          select: {
            full_name: true,
            avatar_url: true
          }
        },
        category: {
          select: {
            post_category_id: true,
            category_name: true
          }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get featured post successful', EC: 0, DT: post };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getTrendingPosts = async (query) => {
  try {
    const limit = parseInt(query.limit) || 4;
    const posts = await prisma.post.findMany({
      where: {
        status: 'published'
      },
      select: {
        post_id: true,
        post_category_id: true,
        author_user_id: true,
        post_type: true,
        title: true,
        slug: true,
        thumbnail_url: true,
        excerpt: true,
        likes_count: true,
        hashtags: true,
        view_count: true,
        created_at: true,
        updated_at: true,
        author: {
          select: {
            full_name: true,
            avatar_url: true
          }
        },
        category: {
          select: {
            post_category_id: true,
            category_name: true
          }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: {
        view_count: 'desc'
      },
      take: limit
    });
    return { EM: 'Get trending posts successful', EC: 0, DT: posts };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getPostCategories = async () => {
  try {
    const categories = await prisma.postCategory.findMany({
      where: {
        status: 'active'
      },
      select: {
        post_category_id: true,
        category_name: true,
        status: true
      },
      orderBy: {
        category_name: 'asc'
      }
    });
    return { EM: 'Get post categories successful', EC: 0, DT: categories };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- FIRST AID GUIDES ---
const getFirstAidGuides = async (query = {}) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const categoryId = query.categoryId;
    const search = query.search;
    const excludeId = query.excludeId;

    const whereCondition = { status: 'published' };
    if (categoryId) {
      whereCondition.first_aid_category_id = toBigIntId(categoryId);
    }
    if (search) {
      whereCondition.OR = [
        { title: { contains: search } },
        { situation_description: { contains: search } }
      ];
    }
    if (excludeId) {
      whereCondition.guide_id = { not: toBigIntId(excludeId) };
    }

    const [total, guides] = await prisma.$transaction([
      prisma.firstAidGuide.count({ where: whereCondition }),
      prisma.firstAidGuide.findMany({
        where: whereCondition,
        include: { category: true },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get guides successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        guides
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getFirstAidGuideBySlug = async (slug) => {
  try {
    const guide = await prisma.firstAidGuide.findUnique({
      where: { slug, status: 'published' },
      include: {
        category: true,
        steps: { orderBy: { step_number: 'asc' } },
        media: true
      }
    });

    if (!guide) return { EM: 'Guide not found', EC: -1, DT: '' };
    return { EM: 'Get guide detail successful', EC: 0, DT: guide };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getFirstAidCategories = async () => {
  try {
    const categories = await prisma.firstAidCategory.findMany({
      where: { status: 'active' },
      orderBy: { category_name: 'asc' }
    });
    return { EM: 'Get categories successful', EC: 0, DT: categories };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createFirstAidGuide = async (user, data) => {
  try {
    if (user.role_code !== 'ADMIN') return { EM: 'Permission denied', EC: -1, DT: '' };

    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const newGuide = await prisma.firstAidGuide.create({
      data: {
        first_aid_category_id: toBigIntId(data.first_aid_category_id),
        title: data.title,
        slug,
        situation_description: data.situation_description,
        emergency_phone: data.emergency_phone || '0868686868',
        video_url: data.video_url || null,
        created_by_admin_id: toBigIntId(user.user_id),
        status: data.status || 'published'
      }
    });

    return { EM: 'Create guide successful', EC: 0, DT: newGuide };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- AI CHAT ---
const getAiChatSessions = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    const sessions = await prisma.aIChatSession.findMany({
      where: { user_id: userId },
      orderBy: { started_at: 'desc' }
    });
    return { EM: 'Get sessions successful', EC: 0, DT: sessions };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createAiChatSession = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    const session = await prisma.aIChatSession.create({
      data: {
        user_id: userId,
        status: 'active',
        disclaimer_shown: true
      }
    });
    return { EM: 'Create session successful', EC: 0, DT: session };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getPosts,
  getPostBySlug,
  createPost,
  getFeaturedPost,
  getTrendingPosts,
  getPostCategories,
  getFirstAidGuides,
  getFirstAidGuideBySlug,
  getFirstAidCategories,
  createFirstAidGuide,
  getAiChatSessions,
  createAiChatSession
};
