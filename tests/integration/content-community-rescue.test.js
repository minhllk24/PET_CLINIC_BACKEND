import mongoose from 'mongoose';
import { contentService } from '../../src/modules/content/content.service.js';
import Post from '../../src/modules/content/models/Post.js';
import CommunityPost from '../../src/modules/content/models/CommunityPost.js';
import CommunityComment from '../../src/modules/content/models/CommunityComment.js';
import Customer from '../../src/modules/customer/models/Customer.js';
import RescuePet from '../../src/modules/content/models/RescuePet.js';

describe('Integration Test: Content Studio, Community & Rescue (CM-01..15)', () => {
  const authorUserId = new mongoose.Types.ObjectId();
  const customerUserId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Official Blog: HTML Sanitizer & Slug Uniqueness (CM-01..03)', () => {
    it('sanitizes malicious script tags and inline events from content', async () => {
      const maliciousHtml = '<p>An toàn</p><script>alert("hacked")</script><img src="x" onerror="steal()"/>';
      jest.spyOn(Post, 'findOne').mockResolvedValue(null);
      jest.spyOn(Post, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const post = await contentService.createPost({
        title: 'Hướng dẫn tắm cho cún con',
        category: 'cham-soc',
        content: maliciousHtml,
        contentBlocks: [
          { type: 'PARAGRAPH', html: '<b onclick="malicious()">Bold</b>' },
        ],
      }, authorUserId);

      expect(post.content).not.toContain('<script>');
      expect(post.content).not.toContain('onerror');
      expect(post.content).toContain('<p>An toàn</p>');
      expect(post.contentBlocks[0].html).not.toContain('onclick');
    });

    it('rejects explicit slug when slug already exists with 409 SLUG_ALREADY_EXISTS', async () => {
      jest.spyOn(Post, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), slug: 'huong-dan-nuoi-meo' });

      await expect(contentService.createPost({
        title: 'Hướng dẫn nuôi mèo mới',
        slug: 'huong-dan-nuoi-meo',
        category: 'cham-soc',
        content: 'Nội dung bài viết',
      }, authorUserId)).rejects.toThrow('Đường dẫn bài viết (slug) đã tồn tại');
    });
  });

  describe('2. First Aid: Normalized Steps & Urgency Level (CM-04..06)', () => {
    it('normalizes steps with stepNumber, titles and descriptions', async () => {
      jest.spyOn(Post, 'findOne').mockResolvedValue(null);
      jest.spyOn(Post, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const guide = await contentService.createPost({
        title: 'Sơ cứu khi chó bị sốc nhiệt',
        category: 'tai-nan',
        postType: 'FIRST_AID',
        urgencyLevel: 'URGENT',
        content: 'Các bước xử trí khẩn cấp sốc nhiệt',
        steps: [
          { step_title: 'Đưa cún vào bóng râm', description: 'Tránh ánh nắng trực tiếp', image_url: 'http://img.png' },
          { title: 'Chườm mát vùng bụng', instruction: 'Dùng khăn ẩm mát 20-25 độ C' },
        ],
      }, authorUserId);

      expect(guide.postType).toBe('FIRST_AID');
      expect(guide.urgencyLevel).toBe('URGENT');
      expect(guide.steps).toHaveLength(2);
      expect(guide.steps[0].title).toBe('Đưa cún vào bóng râm');
      expect(guide.steps[0].stepNumber).toBe(1);
      expect(guide.steps[1].title).toBe('Chườm mát vùng bụng');
      expect(guide.steps[1].stepNumber).toBe(2);
    });
  });

  describe('3. Community: Nested Comments, Replies & Likes (CM-07..10)', () => {
    it('adds comment to approved post and increments commentsCount', async () => {
      const postId = new mongoose.Types.ObjectId();
      const mockPost = {
        _id: postId,
        title: 'Bé cún đáng yêu',
        status: 'APPROVED',
      };
      jest.spyOn(CommunityPost, 'findById').mockResolvedValue(mockPost);
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId, fullName: 'Nguyễn Văn A' });
      jest.spyOn(CommunityComment, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));
      const incSpy = jest.spyOn(CommunityPost, 'findByIdAndUpdate').mockResolvedValue(true);

      const comment = await contentService.addCommunityComment(postId, {
        content: 'Bé cưng quá ạ!',
      }, { id: customerUserId });

      expect(comment.content).toBe('Bé cưng quá ạ!');
      expect(comment.authorNameSnapshot).toBe('Nguyễn Văn A');
      expect(incSpy).toHaveBeenCalledWith(postId, { $inc: { commentsCount: 1 } });
    });

    it('adds reply to comment and increments commentsCount', async () => {
      const commentId = new mongoose.Types.ObjectId();
      const postId = new mongoose.Types.ObjectId();
      const mockComment = {
        _id: commentId,
        postId,
        replies: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CommunityComment, 'findById').mockResolvedValue(mockComment);
      const incSpy = jest.spyOn(CommunityPost, 'findByIdAndUpdate').mockResolvedValue(true);

      const staffActor = { id: new mongoose.Types.ObjectId(), fullName: 'Bác sĩ Minh', systemRole: 'VET' };
      const updatedComment = await contentService.addCommentReply(commentId, {
        content: 'Cảm ơn bạn đã quan tâm đến sức khỏe bé!',
      }, staffActor);

      expect(updatedComment.replies).toHaveLength(1);
      expect(updatedComment.replies[0].authorName).toBe('Bác sĩ Minh');
      expect(updatedComment.replies[0].authorRole).toBe('VET');
      expect(incSpy).toHaveBeenCalledWith(postId, { $inc: { commentsCount: 1 } });
    });

    it('increments and decrements likes atomically', async () => {
      const postId = new mongoose.Types.ObjectId();
      jest.spyOn(CommunityPost, 'findById').mockResolvedValue({ _id: postId });
      jest.spyOn(CommunityPost, 'findByIdAndUpdate')
        .mockResolvedValueOnce({ likesCount: 5 })
        .mockResolvedValueOnce({ likesCount: 4 });

      const liked = await contentService.likeCommunityPost(postId, { id: customerUserId });
      expect(liked.likesCount).toBe(5);

      const unliked = await contentService.unlikeCommunityPost(postId, { id: customerUserId });
      expect(unliked.likesCount).toBe(4);
    });
  });

  describe('4. Partner Rescue: Optional Pet Fields & Partner Network (CM-11..15)', () => {
    it('creates rescue pet with optional breed, gender, age and partner metadata', async () => {
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(12);
      jest.spyOn(RescuePet, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const pet = await contentService.createRescuePet({
        petName: 'Miu Miu Lang Thang',
        species: 'CAT',
        healthStatus: 'Khỏe mạnh, đã tiêm phòng dại',
        rescueStory: 'Được cứu hộ từ bờ kênh',
        supportPartnerId: 'partner-01',
        supportPartnerName: 'Trạm Cứu Hộ Chó Mèo Sài Gòn Time',
        ownershipType: 'PARTNER_MAINTAINED',
      });

      expect(pet.petCode).toBe('RES-0013');
      expect(pet.breed).toBe('Chưa xác định');
      expect(pet.gender).toBe('UNKNOWN');
      expect(pet.supportPartnerName).toContain('Sài Gòn Time');
      expect(pet.ownershipType).toBe('PARTNER_MAINTAINED');
    });
  });
});

