import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import Post from '../../src/modules/content/models/Post.js';
import { CANONICAL_BLOG_CATEGORIES, contentService } from '../../src/modules/content/content.service.js';
import { BLOG_POSTS_SEED, FIRST_AID_GUIDES_SEED, RESCUE_PETS_SEED } from '../../src/seeds/contentSeed.js';

const buildMockQueryChain = (docs) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(docs),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(docs),
});

describe('Blog & Content API + Seed Integrity Verification', () => {
  const origReadyState = mongoose.connection.readyState;

  beforeEach(() => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: origReadyState,
      configurable: true,
      writable: true,
    });
    jest.restoreAllMocks();
  });

  describe('1. Seed Data Quality & Completeness', () => {
    it('provides at least 6 PUBLISHED blog posts for each of the 4 canonical topics with real images & hashtags', () => {
      const publishedBlogs = BLOG_POSTS_SEED.filter((p) => p.status === 'PUBLISHED');
      expect(publishedBlogs.length).toBeGreaterThanOrEqual(24);

      const categoryNames = CANONICAL_BLOG_CATEGORIES.map((c) => c.name);
      expect(categoryNames).toEqual(['Sức khỏe', 'Dinh dưỡng', 'Tâm lý', 'Vệ sinh & Làm đẹp']);

      for (const catName of categoryNames) {
        const count = publishedBlogs.filter((p) => p.category === catName).length;
        expect(count).toBeGreaterThanOrEqual(6);
      }

      const titleSet = new Set();
      for (const post of BLOG_POSTS_SEED) {
        expect(categoryNames).toContain(post.category);
        expect(titleSet.has(post.title)).toBe(false);
        titleSet.add(post.title);
        expect(post.thumbnailUrl).toMatch(/^https:\/\//);
        expect(Array.isArray(post.hashtags) && post.hashtags.length).toBeGreaterThan(0);
        expect(Array.isArray(post.contentBlocks) && post.contentBlocks.length).toBeGreaterThan(0);
      }
    });

    it('provides 8 PUBLISHED First Aid guides across all 4 categories and valid partner info on Rescue Pets', () => {
      expect(FIRST_AID_GUIDES_SEED).toHaveLength(8);
      for (const cat of ['accident', 'poisoning', 'breathing', 'injury']) {
        expect(FIRST_AID_GUIDES_SEED.filter((g) => g.category === cat && g.status === 'PUBLISHED')).toHaveLength(2);
      }

      for (const pet of RESCUE_PETS_SEED) {
        expect(pet.supportPartnerId).toBeTruthy();
        expect(pet.supportPartnerUrl).toMatch(/^https:\/\//);
        expect(pet.supportPartnerPhone).toBeTruthy();
        expect(pet.supportNeeds).toBeTruthy();
      }
    });
  });

  describe('2. Public Blog Categories, Filters, Tags, Sort & Pagination Endpoints', () => {
    it('GET /api/v1/post-categories returns strictly the 4 canonical blog topics with postCounts', async () => {
      jest.spyOn(Post, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(
            BLOG_POSTS_SEED.filter((p) => p.status === 'PUBLISHED').map((p) => ({ category: p.category }))
          ),
        }),
      });

      const res = await request(app).get('/api/v1/post-categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.data.map((c) => c.name)).toEqual([
        'Sức khỏe',
        'Dinh dưỡng',
        'Tâm lý',
        'Vệ sinh & Làm đẹp',
      ]);
      expect(res.body.data.every((c) => c.postCount >= 6)).toBe(true);
      expect(res.body.data.some((c) => ['chan-thuong', 'tai-nan'].includes(c.slug))).toBe(false);
    });

    it('GET /api/v1/posts filters cleanly by category slug/id/name, tag, search & sort with full pagination metadata', async () => {
      const sampleDocs = BLOG_POSTS_SEED.slice(0, 3).map((p, idx) => ({
        _id: new mongoose.Types.ObjectId(),
        ...p,
        slug: `slug-${idx + 1}`,
        toObject: function () { return { ...this }; },
      }));

      const countSpy = jest.spyOn(Post, 'countDocuments').mockResolvedValue(12);
      const findChain = buildMockQueryChain(sampleDocs);
      const findSpy = jest.spyOn(Post, 'find').mockReturnValue(findChain);

      const res = await request(app)
        .get('/api/v1/posts')
        .query({
          category: 'suc-khoe',
          tag: '#tiem-phong',
          search: 'tiem phong',
          sort: 'popular',
          page: 2,
          limit: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(12);
      expect(res.body.data.totalRows).toBe(12);
      expect(res.body.data.totalCount).toBe(12);
      expect(res.body.data.totalPages).toBe(4);
      expect(res.body.data.hasNextPage).toBe(true);
      expect(res.body.data.hasPrevPage).toBe(true);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.posts).toHaveLength(3);

      // Verify DTO image & category aliases for FE compatibility
      const first = res.body.data.items[0];
      expect(first.thumbnailUrl).toMatch(/^https:\/\//);
      expect(first.thumbnail_url).toBe(first.thumbnailUrl);
      expect(first.thumbnail).toBe(first.thumbnailUrl);
      expect(first.imageUrl).toBe(first.thumbnailUrl);
      expect(first.categorySlug).toBe('suc-khoe');
      expect(first.tags.length).toBeGreaterThan(0);

      // Verify filter query didn't overwrite $or and defaulted to OFFICIAL_BLOG
      const executedFilter = countSpy.mock.calls[0][0];
      expect(executedFilter.status).toBe('PUBLISHED');
      expect(executedFilter.postType).toBe('OFFICIAL_BLOG');
      expect(executedFilter.category.$in).toContain('Sức khỏe');
      expect(executedFilter.$and).toHaveLength(2); // tag filter + search filter both preserved
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findChain.sort).toHaveBeenCalledWith({ viewCount: -1, publishedAt: -1, createdAt: -1 });
      expect(findChain.skip).toHaveBeenCalledWith(3);
      expect(findChain.limit).toHaveBeenCalledWith(3);
    });

    it('GET /api/v1/posts/recent, /featured, /trending, /tags & /:slug/related return formatted blog items with thumbnails', async () => {
      const sampleDocs = BLOG_POSTS_SEED.slice(0, 4).map((p, idx) => ({
        _id: new mongoose.Types.ObjectId(),
        ...p,
        slug: `blog-${idx + 1}`,
        toObject: function () { return { ...this }; },
      }));

      jest.spyOn(Post, 'find').mockReturnValue(buildMockQueryChain(sampleDocs));
      jest.spyOn(Post, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: sampleDocs[0]._id, category: 'Sức khỏe', postType: 'OFFICIAL_BLOG' }),
      });

      const [featuredRes, trendingRes, recentRes, tagsRes, relatedRes] = await Promise.all([
        request(app).get('/api/v1/posts/featured'),
        request(app).get('/api/v1/posts/trending'),
        request(app).get('/api/v1/posts/recent'),
        request(app).get('/api/v1/posts/tags'),
        request(app).get('/api/v1/posts/blog-1/related'),
      ]);

      for (const r of [featuredRes, trendingRes, recentRes, relatedRes]) {
        expect(r.status).toBe(200);
        expect(Array.isArray(r.body.data)).toBe(true);
        expect(r.body.data.length).toBeGreaterThan(0);
        expect(r.body.data[0].thumbnailUrl).toMatch(/^https:\/\//);
        expect(r.body.data[0].thumbnail_url).toBe(r.body.data[0].thumbnailUrl);
      }

      expect(tagsRes.status).toBe(200);
      expect(Array.isArray(tagsRes.body.data)).toBe(true);
      expect(tagsRes.body.data.some((t) => t.slug === 'tiem-phong')).toBe(true);
    });

    it('getPostBySlugPublic enriches blog detail with relatedPosts and recentPosts for Xem nhanh sidebar', async () => {
      const mainId = new mongoose.Types.ObjectId();
      const mainDoc = {
        _id: mainId,
        ...BLOG_POSTS_SEED[0],
        slug: 'lich-tiem-phong-vac-xin-dinh-ky-cho-cho-meo-ban-can-biet',
        toObject: function () { return { ...this }; },
      };
      const sidebarDocs = BLOG_POSTS_SEED.slice(1, 5).map((p, i) => ({
        _id: new mongoose.Types.ObjectId(),
        ...p,
        slug: `sidebar-${i}`,
        toObject: function () { return { ...this }; },
      }));

      jest.spyOn(Post, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mainDoc),
      });
      jest.spyOn(Post, 'updateOne').mockResolvedValue({});
      jest.spyOn(Post, 'find').mockReturnValue(buildMockQueryChain(sidebarDocs));

      const detail = await contentService.getPostBySlugPublic(mainDoc.slug);
      expect(detail.title).toBe(BLOG_POSTS_SEED[0].title);
      expect(detail.thumbnailUrl).toMatch(/^https:\/\//);
      expect(Array.isArray(detail.relatedPosts)).toBe(true);
      expect(detail.relatedPosts.length).toBeGreaterThan(0);
      expect(Array.isArray(detail.recentPosts)).toBe(true);
      expect(detail.quickViewPosts).toEqual(detail.recentPosts);
    });
  });
});

