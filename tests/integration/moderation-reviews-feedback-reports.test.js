import mongoose from 'mongoose';
import * as reviewService from '../../src/modules/review/review.service.js';
import * as feedbackService from '../../src/modules/review/feedback.service.js';
import { contentService } from '../../src/modules/content/content.service.js';
import Review from '../../src/modules/review/models/Review.js';
import Feedback from '../../src/modules/review/models/Feedback.js';
import CommunityPost from '../../src/modules/content/models/CommunityPost.js';
import CommunityReport from '../../src/modules/content/models/CommunityReport.js';
import Customer from '../../src/modules/customer/models/Customer.js';

describe('Integration Test: Moderation Suite (MOD-01..12)', () => {
  const managerActor = { id: new mongoose.Types.ObjectId().toString(), systemRole: 'MANAGER' };
  const adminActor = { id: new mongoose.Types.ObjectId().toString(), systemRole: 'ADMIN' };
  const vetActor = { id: new mongoose.Types.ObjectId().toString(), fullName: 'BS. Tuấn', systemRole: 'VET' };
  const customerUserId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Reviews Moderation & Staff Reply (MOD-01..04)', () => {
    it('prevents repeat hide on already hidden review with 409 Conflict', async () => {
      const reviewId = new mongoose.Types.ObjectId();
      const mockReview = {
        _id: reviewId,
        hidden: true,
        status: 'HIDDEN',
      };
      jest.spyOn(Review, 'findById').mockResolvedValue(mockReview);

      await expect(reviewService.hideReview(reviewId, { reason: 'Vi phạm' }, managerActor))
        .rejects.toThrow('Đánh giá này đã ở trạng thái bị ẩn');
    });

    it('records moderation history and updates version on hide', async () => {
      const reviewId = new mongoose.Types.ObjectId();
      const mockReview = {
        _id: reviewId,
        hidden: false,
        status: 'ACTIVE',
        moderationHistory: [],
        version: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Review, 'findById').mockResolvedValue(mockReview);

      const res = await reviewService.hideReview(reviewId, { reason: 'Ngôn từ xúc phạm' }, managerActor);

      expect(mockReview.hidden).toBe(true);
      expect(mockReview.status).toBe('HIDDEN');
      expect(mockReview.version).toBe(2);
      expect(mockReview.moderationHistory).toHaveLength(1);
      expect(mockReview.moderationHistory[0].action).toBe('HIDE');
      expect(res.hidden).toBe(true);
    });

    it('allows staff to reply publicly to a customer review', async () => {
      const reviewId = new mongoose.Types.ObjectId();
      const mockReview = {
        _id: reviewId,
        comment: 'Dịch vụ tiêm phòng rất ân cần',
        moderationHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Review, 'findById').mockResolvedValue(mockReview);

      const res = await reviewService.replyReview(reviewId, {
        replyText: 'Cảm ơn bạn đã tin tưởng Dr.Pet Clinic!',
      }, vetActor);

      expect(mockReview.staffReply.text).toBe('Cảm ơn bạn đã tin tưởng Dr.Pet Clinic!');
      expect(mockReview.staffReply.repliedBy).toBe(vetActor.id);
      expect(mockReview.moderationHistory).toHaveLength(1);
      expect(mockReview.moderationHistory[0].action).toBe('REPLY');
    });
  });

  describe('2. Customer Feedback & Outbox Email Reply (MOD-05..08)', () => {
    it('computes allowedActions correctly and sends email reply transitioning to PROCESSED', async () => {
      const feedbackId = new mongoose.Types.ObjectId();
      const mockFeedback = {
        _id: feedbackId,
        name: 'Trần Văn B',
        email: 'tranvanb@gmail.com',
        subject: 'Cần tư vấn đặt lịch tiêm phòng',
        message: 'Bé cún nhà mình 2 tháng tuổi đã tiêm mũi 1',
        status: 'NEW',
        statusHistory: [{ status: 'NEW', at: new Date() }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Feedback, 'findById').mockResolvedValue(mockFeedback);

      const replied = await feedbackService.replyFeedback(feedbackId, {
        message: 'Chào bạn, bé 2 tháng tuổi đủ điều kiện tiêm mũi 2 5in1/6in1 nhé ạ!',
      }, managerActor);

      expect(replied.status).toBe('PROCESSED');
      expect(replied.replyDelivery.deliveryStatus).toBe('SENT');
      expect(replied.replyDelivery.sentBy).toBe(managerActor.id);
      expect(mockFeedback.statusHistory).toHaveLength(2);
      expect(mockFeedback.statusHistory[1].status).toBe('PROCESSED');
      expect(replied.allowedActions).toEqual([]); // PROCESSED has no further action
    });
  });

  describe('3. Community Violation Reports (MOD-09..12)', () => {
    it('rejects duplicate reports from the same customer on a post with 409', async () => {
      const postId = new mongoose.Types.ObjectId();
      jest.spyOn(CommunityPost, 'findById').mockResolvedValue({ _id: postId });
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId });
      jest.spyOn(CommunityReport, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      await expect(contentService.reportCommunityPost(postId, {
        reason: 'SPAM',
        description: 'Quảng cáo bán hàng trái phép',
      }, { id: customerUserId })).rejects.toThrow('Bạn đã gửi báo cáo cho bài viết này rồi');
    });

    it('submits violation report and increments post reportCount', async () => {
      const postId = new mongoose.Types.ObjectId();
      const mockPost = {
        _id: postId,
        title: 'Bán phụ kiện giá sỉ',
        content: 'Liên hệ zalo xxx',
        authorNameSnapshot: 'Spammer',
        createdAt: new Date(),
      };
      jest.spyOn(CommunityPost, 'findById').mockResolvedValue(mockPost);
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId });
      jest.spyOn(CommunityReport, 'findOne').mockResolvedValue(null);
      jest.spyOn(CommunityReport, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(CommunityReport, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));
      const postUpdateSpy = jest.spyOn(CommunityPost, 'findByIdAndUpdate').mockResolvedValue(true);

      const report = await contentService.reportCommunityPost(postId, {
        reason: 'SPAM',
        description: 'Spam bán hàng',
      }, { id: customerUserId });

      expect(report.status).toBe('PENDING');
      expect(report.reason).toBe('SPAM');
      expect(report.postSnapshot.title).toBe('Bán phụ kiện giá sỉ');
      expect(postUpdateSpy).toHaveBeenCalledWith(postId, {
        $inc: { reportCount: 1 },
        hasOpenReport: true,
      });
    });

    it('resolves report with HIDE_POST: atomically hides post and resolves all open reports', async () => {
      const reportId = new mongoose.Types.ObjectId();
      const postId = new mongoose.Types.ObjectId();
      const mockReport = {
        _id: reportId,
        postId,
        reportCode: 'REP-20261106-0001',
        reason: 'HARASSMENT',
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(CommunityReport, 'findById').mockResolvedValue(mockReport);
      const postUpdateSpy = jest.spyOn(CommunityPost, 'findByIdAndUpdate').mockResolvedValue(true);
      const reportsSyncSpy = jest.spyOn(CommunityReport, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

      const resolved = await contentService.resolveCommunityReport(reportId, {
        decision: 'HIDE_POST',
        moderationNote: 'Nội dung công kích người khác',
      }, adminActor);

      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.decision).toBe('HIDE_POST');
      expect(resolved.moderatorId).toBe(adminActor.id);
      expect(postUpdateSpy).toHaveBeenCalledWith(postId, expect.objectContaining({
        status: 'HIDDEN',
        hasOpenReport: false,
      }));
      expect(reportsSyncSpy).toHaveBeenCalledWith(
        {
          postId,
          _id: { $ne: reportId },
          status: { $in: ['PENDING', 'UNDER_REVIEW'] },
        },
        expect.objectContaining({
          status: 'RESOLVED',
          decision: 'HIDE_POST',
          resolvedByReportId: reportId,
        })
      );
    });
  });
});

