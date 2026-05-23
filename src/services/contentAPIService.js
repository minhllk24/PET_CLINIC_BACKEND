import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- POSTS ---
const getPosts = async (query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = query.type; // 'official_blog' or 'community_post'

    const whereCondition = { status: 'published' };
    if (type) whereCondition.post_type = type;

    const [total, posts] = await prisma.$transaction([
      prisma.post.count({ where: whereCondition }),
      prisma.post.findMany({
        where: whereCondition,
        include: { author: { select: { full_name: true, avatar_url: true } } },
        skip,
        take: limit,
        orderBy: { published_at: 'desc' }
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
        comments: {
          include: { user: { select: { full_name: true, avatar_url: true } } },
          orderBy: { created_at: 'asc' }
        }
      }
    });
    if (!post) return { EM: 'Post not found', EC: -1, DT: '' };

    return { EM: 'Get post successful', EC: 0, DT: post };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createPost = async (user, data) => {
  try {
    const userId = toBigIntId(user.user_id);
    const postType = user.role_code === 'ADMIN' ? 'official_blog' : 'community_post';

    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const newPost = await prisma.post.create({
      data: {
        author_id: userId,
        post_type: postType,
        title: data.title,
        slug,
        content: data.content,
        thumbnail_url: data.thumbnail_url || null,
        status: data.status || 'published',
        published_at: new Date()
      }
    });

    return { EM: 'Create post successful', EC: 0, DT: newPost };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- FIRST AID GUIDES ---
const getFirstAidGuides = async () => {
  try {
    const guides = await prisma.firstAidGuide.findMany({
      where: { status: 'published' },
      include: { category: true },
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get guides successful', EC: 0, DT: guides };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createFirstAidGuide = async (user, data) => {
  try {
    if (user.role_code !== 'ADMIN') return { EM: 'Permission denied', EC: -1, DT: '' };

    const newGuide = await prisma.firstAidGuide.create({
      data: {
        category_id: data.category_id ? toBigIntId(data.category_id) : null,
        title: data.title,
        content: data.content,
        video_url: data.video_url || null,
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
  getFirstAidGuides,
  createFirstAidGuide,
  getAiChatSessions,
  createAiChatSession
};
