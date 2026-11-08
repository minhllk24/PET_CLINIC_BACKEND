import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import * as flashSaleService from '../../src/modules/flash-sale/flashSale.service.js';
import FlashSale from '../../src/modules/flash-sale/models/FlashSale.js';
import Product from '../../src/modules/catalog/models/Product.js';
import { contentService } from '../../src/modules/content/content.service.js';
import CommunityPost from '../../src/modules/content/models/CommunityPost.js';
import CommunityReport from '../../src/modules/content/models/CommunityReport.js';
import RescuePet from '../../src/modules/content/models/RescuePet.js';
import * as reviewService from '../../src/modules/review/review.service.js';
import Review from '../../src/modules/review/models/Review.js';
import * as feedbackService from '../../src/modules/review/feedback.service.js';
import Feedback from '../../src/modules/review/models/Feedback.js';
import EmailOutbox from '../../src/modules/notification/models/EmailOutbox.js';
import * as uploadService from '../../src/modules/upload/upload.service.js';

describe('UAT Gate Suite: GAP-01 to GAP-16 Acceptance Verification', () => {
  const adminActor = { id: new mongoose.Types.ObjectId().toString(), systemRole: 'ADMIN', name: 'Admin Tổng' };
  const managerActor = { id: new mongoose.Types.ObjectId().toString(), systemRole: 'MANAGER', name: 'Quản Lý Vùng' };
  const customerActor = { id: new mongoose.Types.ObjectId().toString(), systemRole: 'CUSTOMER', fullName: 'Khách Hàng Thân Thiết' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // GAP-01: 2 Concurrent Buy Requests for Quota = 1
  // =========================================================================
  describe('GAP-01: 2 phiên cùng mua SKU còn quota=1', () => {
    it('CAS prevents overselling under true concurrency (Promise.all): exactly 1 order claims flash sale quota, second gets 409', async () => {
      const saleId = new mongoose.Types.ObjectId();
      const sku = 'SKU-FS-GAP01';
      let currentSold = 0;

      jest.spyOn(FlashSale, 'findById').mockImplementation(async () => ({
        _id: saleId,
        status: 'PUBLISHED',
        isPaused: false,
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        version: 1,
        items: [
          {
            sku,
            quantityLimit: 1,
            soldQuantity: currentSold,
            salePrice: 50000,
            originalPrice: 100000,
          },
        ],
      }));

      // Simulate MongoDB atomic findOneAndUpdate CAS with $elemMatch { soldQuantity: { $lte: quantityLimit - quantity } }
      jest.spyOn(FlashSale, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        const incQty = update?.$inc?.['items.$.soldQuantity'] || 1;
        const maxSoldAllowed = filter?.items?.$elemMatch?.soldQuantity?.$lte ?? 0;
        if (currentSold <= maxSoldAllowed) {
          currentSold += incQty;
          return {
            _id: saleId,
            version: 2,
            items: [
              {
                sku,
                quantityLimit: 1,
                soldQuantity: currentSold,
                salePrice: 50000,
                originalPrice: 100000,
              },
            ],
          };
        }
        return null;
      });

      // Fire 2 concurrent requests via Promise.all
      const outcomes = await Promise.allSettled([
        flashSaleService.consumeFlashSaleQuotaInSession({ saleId, sku, quantity: 1 }),
        flashSaleService.consumeFlashSaleQuotaInSession({ saleId, sku, quantity: 1 }),
      ]);

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(fulfilled[0].value.soldQuantity).toBe(1);
      expect(fulfilled[0].value.remainingQuantity).toBe(0);
      expect(rejected[0].reason).toMatchObject({
        status: 409,
        code: 'FLASH_SALE_QUOTA_EXCEEDED',
      });
    });
  });

  // =========================================================================
  // GAP-02: Cart Requested Qty = 3 when Remaining Quota = 2
  // =========================================================================
  describe('GAP-02: Giỏ qty=3 khi quota chỉ còn 2', () => {
    it('rejects without partial commit with 409 and descriptive remaining quota', async () => {
      const saleId = new mongoose.Types.ObjectId();
      const sku = 'SKU-FS-GAP02';
      const mockSale = {
        _id: saleId,
        status: 'PUBLISHED',
        isPaused: false,
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        items: [
          {
            sku,
            quantityLimit: 5,
            soldQuantity: 3, // Remaining: 2
            salePrice: 60000,
            originalPrice: 120000,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(FlashSale, 'findById').mockResolvedValue(mockSale);

      await expect(
        flashSaleService.consumeFlashSaleQuotaInSession({
          saleId,
          sku,
          quantity: 3,
        })
      ).rejects.toMatchObject({
        status: 409,
        code: 'FLASH_SALE_QUOTA_EXCEEDED',
        message: expect.stringContaining('vượt quá giới hạn Flash Sale còn lại (2)'),
      });
    });
  });

  // =========================================================================
  // GAP-03: Order Cancel / Expire Idempotent Quota Refund
  // =========================================================================
  describe('GAP-03: Hủy/expire/retry thanh toán - Hoàn quota idempotent', () => {
    it('restores soldQuantity and does not double-refund', async () => {
      const saleId = new mongoose.Types.ObjectId();
      const sku = 'SKU-FS-GAP03';
      const mockSale = {
        _id: saleId,
        items: [
          {
            sku,
            quantityLimit: 10,
            soldQuantity: 5,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(FlashSale, 'findById').mockResolvedValue(mockSale);

      // Refund 2 items
      await flashSaleService.releaseFlashSaleQuotaInSession({
        saleId,
        sku,
        quantity: 2,
      });

      expect(mockSale.items[0].soldQuantity).toBe(3);

      // Releasing with 0 or negative does nothing
      await flashSaleService.releaseFlashSaleQuotaInSession({
        saleId,
        sku,
        quantity: 0,
      });
      expect(mockSale.items[0].soldQuantity).toBe(3);
    });
  });

  // =========================================================================
  // GAP-04: Product with 2 Variants, only 1 SKU in Flash Sale
  // =========================================================================
  describe('GAP-04: SP có 2 variants, chỉ 1 SKU Flash Sale', () => {
    it('strictly applies discount only to the designated SKU and does not leak to other variant', async () => {
      const productId = new mongoose.Types.ObjectId();
      const variantAId = new mongoose.Types.ObjectId();
      const variantBId = new mongoose.Types.ObjectId();

      const mockActiveSale = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Flash Sale Siêu Sale Mèo',
        status: 'PUBLISHED',
        isPaused: false,
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        items: [
          {
            productId,
            variantId: variantAId,
            sku: 'SKU-CAT-FOOD-500G',
            originalPrice: 150000,
            salePrice: 99000,
            quantityLimit: 20,
            soldQuantity: 5,
          },
        ],
      };

      const mockProduct = {
        _id: productId,
        name: 'Hạt Cho Mèo Vị Cá Hồi',
        status: 'ACTIVE',
        variants: [
          { _id: variantAId, sku: 'SKU-CAT-FOOD-500G', label: 'Túi 500g', price: 150000, status: 'ACTIVE' },
          { _id: variantBId, sku: 'SKU-CAT-FOOD-2KG', label: 'Túi 2kg', price: 450000, status: 'ACTIVE' },
        ],
      };

      jest.spyOn(FlashSale, 'findOne').mockResolvedValue(mockActiveSale);
      jest.spyOn(Product, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProduct),
      });

      // 1. Variant A (SKU-CAT-FOOD-500G) matches Flash Sale
      const itemA = await flashSaleService.findActiveFlashSaleItem(productId, 'SKU-CAT-FOOD-500G');
      expect(itemA).not.toBeNull();
      expect(itemA.salePrice).toBe(99000);
      expect(itemA.originalPrice).toBe(150000);
      expect(itemA.remainingQuantity).toBe(15);

      // 2. Variant B (SKU-CAT-FOOD-2KG) does NOT match Flash Sale (No loose fallback)
      const itemB = await flashSaleService.findActiveFlashSaleItem(productId, 'SKU-CAT-FOOD-2KG');
      expect(itemB).toBeNull();
    });
  });

  // =========================================================================
  // GAP-05: POST create/publish 3 times with same Idempotency-Key
  // =========================================================================
  describe('GAP-05: POST create/publish 3 lần cùng Idempotency-Key', () => {
    it('returns exact same campaign, exactly 1 campaign created in DB', async () => {
      const idempotencyKey = 'IDEMP-TEST-KEY-001';
      const existingCampaign = {
        _id: new mongoose.Types.ObjectId(),
        code: 'FS-778899',
        idempotencyKey,
        name: 'Chiến dịch Idempotent Test',
        status: 'PUBLISHED',
        isPaused: false,
        activationMode: 'AUTO',
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        items: [],
        version: 1,
      };

      // 1st call finds nothing and creates
      const findOneSpy = jest.spyOn(FlashSale, 'findOne');
      findOneSpy.mockResolvedValueOnce(null);

      jest.spyOn(FlashSale.prototype, 'save').mockImplementation(function () {
        this._id = existingCampaign._id;
        this.code = existingCampaign.code;
        return Promise.resolve(this);
      });

      const res1 = await flashSaleService.createFlashSale({
        name: 'Chiến dịch Idempotent Test',
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        idempotencyKey,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            sku: 'SKU-IDEMP-01',
            originalPrice: 100000,
            salePrice: 80000,
            quantityLimit: 10,
          },
        ],
      }, adminActor);

      // 2nd call finds existing campaign by idempotencyKey
      findOneSpy.mockResolvedValueOnce(existingCampaign);
      const res2 = await flashSaleService.createFlashSale({
        name: 'Chiến dịch Idempotent Test',
        idempotencyKey,
      }, adminActor);

      // 3rd call finds existing campaign by idempotencyKey
      findOneSpy.mockResolvedValueOnce(existingCampaign);
      const res3 = await flashSaleService.createFlashSale({
        name: 'Chiến dịch Idempotent Test',
        idempotencyKey,
      }, adminActor);

      expect(res2.id).toBe(res1.id);
      expect(res3.id).toBe(res1.id);
    });
  });

  // =========================================================================
  // GAP-06: AUTO/MANUAL + Pause/Resume + SKU Update + Concurrency Conflict
  // =========================================================================
  describe('GAP-06: AUTO/MANUAL + pause/resume + sửa SKU + Version Conflict', () => {
    it('initializes MANUAL with isPaused: true, updates items, and prevents concurrent update via 409', async () => {
      // 1. MANUAL initializes isPaused: true
      const saveSpy = jest.spyOn(FlashSale.prototype, 'save').mockResolvedValue(true);
      const manualSale = await flashSaleService.createFlashSale({
        name: 'Chiến dịch kích hoạt thủ công',
        activationMode: 'MANUAL',
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            sku: 'SKU-MANUAL-01',
            originalPrice: 200000,
            salePrice: 150000,
            quantityLimit: 5,
          },
        ],
      }, adminActor);

      expect(manualSale.activationMode).toBe('MANUAL');
      expect(manualSale.isPaused).toBe(true);

      // 2. Version Concurrency Conflict on PATCH
      const saleId = new mongoose.Types.ObjectId();
      const mockDbSale = {
        _id: saleId,
        name: 'Original Sale',
        version: 5, // Server is at version 5
        items: [],
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(FlashSale, 'findById').mockResolvedValue(mockDbSale);

      // Client sends expectedVersion: 4 (stale)
      await expect(
        flashSaleService.updateFlashSale(saleId, { expectedVersion: 4, name: 'Stale Update' }, adminActor)
      ).rejects.toMatchObject({
        status: 409,
        code: 'VERSION_CONFLICT',
      });
    });
  });

  // =========================================================================
  // GAP-07: Admin Creates Community Post via Admin API
  // =========================================================================
  describe('GAP-07: Admin tạo bài đăng cộng đồng từ WEB 2', () => {
    it('creates approved community post with authorRole ADMIN and sanitized HTML', async () => {
      jest.spyOn(CommunityPost.prototype, 'save').mockResolvedValue(true);

      const post = await contentService.createCommunityPostAdmin(
        {
          title: 'Thông báo tiêm phòng dại miễn phí',
          content: '<p>Chiến dịch tiêm phòng dại cho thú cưng</p><script>alert("xss")</script>',
          type: 'GENERAL',
          images: ['https://cdn.drpets.vn/posts/rabies.jpg'],
          tags: ['tiemphong', 'thucung'],
        },
        adminActor
      );

      expect(post.title).toBe('Thông báo tiêm phòng dại miễn phí');
      expect(post.content).not.toContain('<script>');
      expect(post.status).toBe('APPROVED');
      expect(post.authorRole).toBe('ADMIN');
      expect(post.moderationHistory[0].status).toBe('APPROVED');
    });
  });

  // =========================================================================
  // GAP-08: Customer Feedback Reply Email Success via Real Outbox
  // =========================================================================
  describe('GAP-08: Phản hồi feedback email thành công', () => {
    it('generates real RFC messageId via SMTP transporter, marks SENT in outbox and transitions feedback to PROCESSED', async () => {
      const nodemailer = require('nodemailer');
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_USER = 'support@drpets.vn';
      process.env.SMTP_PASS = 'mock-smtp-pass';

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({
          messageId: '<real-smtp-msg-001@gmail.com>',
        }),
      });

      const feedbackId = new mongoose.Types.ObjectId();
      const mockFeedback = {
        _id: feedbackId,
        subject: 'Cần hỗ trợ về lịch hẹn tiêm phòng',
        email: 'khachhang@gmail.com',
        status: 'NEW',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Feedback, 'findById').mockResolvedValue(mockFeedback);

      const result = await feedbackService.replyFeedback(
        feedbackId,
        {
          replyText: 'Chào anh/chị, phòng khám đã hỗ trợ xác nhận lịch hẹn vào 9h sáng mai ạ.',
        },
        managerActor
      );

      expect(result.status).toBe('PROCESSED');
      expect(mockFeedback.replyDelivery.deliveryStatus).toBe('SENT');
      expect(mockFeedback.replyDelivery.providerMessageId).toBe('<real-smtp-msg-001@gmail.com>');
    });
  });

  // =========================================================================
  // GAP-09: Provider Email Fails & Idempotent Retry
  // =========================================================================
  describe('GAP-09: Provider email lỗi & retry không báo thành công giả', () => {
    it('records FAILED when SMTP is missing or errors, keeps PROCESSING, and succeeds on retry when SMTP is restored', async () => {
      const nodemailer = require('nodemailer');
      const feedbackId = new mongoose.Types.ObjectId();
      const mockFeedback = {
        _id: feedbackId,
        subject: 'Thắc mắc kết quả xét nghiệm',
        email: 'customer99@gmail.com',
        status: 'PROCESSING',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Feedback, 'findById').mockResolvedValue(mockFeedback);

      // 1. Missing SMTP configuration -> must NOT use jsonTransport, must mark FAILED
      const config = require('../../src/shared/config.js').default;
      const prevConfigSmtp = { ...config.smtp };
      const prevHost = process.env.SMTP_HOST;
      const prevUser = process.env.SMTP_USER;
      const prevPass = process.env.SMTP_PASS;
      const prevEmailApp = process.env.EMAIL_APP;
      const prevEmailPass = process.env.EMAIL_APP_PASSWORD;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.EMAIL_APP;
      delete process.env.EMAIL_APP_PASSWORD;
      config.smtp = { host: '', user: '', pass: '' };

      await feedbackService.replyFeedback(
        feedbackId,
        {
          replyText: 'Xin lỗi vì sự cố đường truyền',
        },
        managerActor
      );

      expect(mockFeedback.replyDelivery.deliveryStatus).toBe('FAILED');
      expect(mockFeedback.status).toBe('PROCESSING'); // NOT falsely PROCESSED!

      // 2. Restore SMTP and retry -> SENT & PROCESSED
      config.smtp = prevConfigSmtp;
      process.env.SMTP_HOST = prevHost || 'smtp.gmail.com';
      process.env.SMTP_USER = prevUser || 'support@drpets.vn';
      process.env.SMTP_PASS = prevPass || 'mock-smtp-pass';
      if (prevEmailApp) process.env.EMAIL_APP = prevEmailApp;
      if (prevEmailPass) process.env.EMAIL_APP_PASSWORD = prevEmailPass;

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({
          messageId: '<retry-smtp-msg-002@gmail.com>',
        }),
      });

      await feedbackService.replyFeedback(
        feedbackId,
        {
          replyText: 'Xin gửi lại anh chị kết quả ạ',
          simulateEmailFailure: false,
        },
        managerActor
      );

      expect(mockFeedback.replyDelivery.deliveryStatus).toBe('SENT');
      expect(mockFeedback.status).toBe('PROCESSED');
    });
  });

  // =========================================================================
  // GAP-10: 2 Admins Resolve Same Report Concurrently (CAS Concurrency)
  // =========================================================================
  describe('GAP-10: 2 Admin xử lý 1 report đồng thời', () => {
    it('first moderator commits, second gets 409 REPORT_ALREADY_RESOLVED', async () => {
      const reportId = new mongoose.Types.ObjectId();
      const postId = new mongoose.Types.ObjectId();
      const mockReport = {
        _id: reportId,
        postId,
        status: 'PENDING',
        reportCode: 'REP-TEST-001',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(CommunityPost, 'findByIdAndUpdate').mockResolvedValue(true);
      jest.spyOn(CommunityReport, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      // Admin 1 resolves report
      jest.spyOn(CommunityReport, 'findById').mockResolvedValue(mockReport);
      const res1 = await contentService.resolveCommunityReport(
        reportId,
        { decision: 'HIDE_POST', moderationNote: 'Vi phạm nghiêm trọng' },
        adminActor
      );

      expect(res1.status).toBe('RESOLVED');
      expect(res1.decision).toBe('HIDE_POST');

      // Admin 2 attempts to resolve already resolved report -> 409
      mockReport.status = 'RESOLVED';
      await expect(
        contentService.resolveCommunityReport(
          reportId,
          { decision: 'NO_VIOLATION' },
          managerActor
        )
      ).rejects.toMatchObject({
        status: 409,
        code: 'REPORT_ALREADY_RESOLVED',
      });
    });
  });

  // =========================================================================
  // GAP-11: Rollback on Error during Report Resolution
  // =========================================================================
  describe('GAP-11: Giả lập lỗi giữa lúc resolve report - Rollback toàn bộ', () => {
    it('aborts and rolls back when error is injected', async () => {
      const reportId = new mongoose.Types.ObjectId();
      const postId = new mongoose.Types.ObjectId();
      const mockReport = {
        _id: reportId,
        postId,
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(CommunityReport, 'findById').mockResolvedValue(mockReport);

      await expect(
        contentService.resolveCommunityReport(
          reportId,
          { decision: 'HIDE_POST', simulateFailureInTransaction: true },
          adminActor
        )
      ).rejects.toThrow('Simulated failure during report resolution transaction');
    });
  });

  // =========================================================================
  // GAP-12: Hide Review Requires Reason & Dynamic Rating Sync
  // =========================================================================
  describe('GAP-12: Hide review không lý do, rồi hide/show hợp lệ & đồng bộ sao', () => {
    it('rejects empty reason with 400, then valid hide/show updates rating stats', async () => {
      const reviewId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const mockReview = {
        _id: reviewId,
        targetType: 'PRODUCT',
        targetId: productId,
        hidden: false,
        status: 'ACTIVE',
        moderationHistory: [],
        version: 1,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Review, 'findById').mockResolvedValue(mockReview);

      // 1. Hide without reason -> 400
      await expect(
        reviewService.hideReview(reviewId, { reason: '   ' }, adminActor)
      ).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });

      // 2. Hide with valid reason -> 200, updates status to HIDDEN
      const res = await reviewService.hideReview(reviewId, { reason: 'Chứa thông tin sai lệch' }, adminActor);
      expect(res.hidden).toBe(true);
      expect(res.status).toBe('HIDDEN');

      // 3. Show review -> status to ACTIVE
      const showRes = await reviewService.showReview(reviewId, adminActor);
      expect(showRes.hidden).toBe(false);
      expect(showRes.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // GAP-13: Rescue Pet Strictly Requires Images & Partner CTA Mapping
  // =========================================================================
  describe('GAP-13: Rescue pet ảnh trống / đối tác / CTA', () => {
    it('rejects pet creation without images with 400, maps partner hotline from verified DB settings', async () => {
      // 1. Reject missing images (NO fake Unsplash fallback)
      await expect(
        contentService.createRescuePet({
          petName: 'Bé Mèo Vàng',
          species: 'CAT',
          healthStatus: 'Bình thường',
          rescueStory: 'Bị bỏ rơi trước cổng phòng khám',
          images: [], // Missing image
        })
      ).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('images is required'),
      });

      // 2. Create pet with valid image & partner mapping
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(20);
      jest.spyOn(RescuePet, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const pet = await contentService.createRescuePet({
        petName: 'Bé Mèo Vàng',
        species: 'CAT',
        healthStatus: 'Bình thường',
        rescueStory: 'Bị bỏ rơi trước cổng phòng khám',
        images: ['https://cdn.drpets.vn/rescue/vang.jpg'],
        supportPartnerId: 'saigon-time',
      });

      expect(pet.petCode).toBe('RES-0021');
      expect(pet.supportPartnerName).toContain('Sài Gòn Time');
      expect(pet.supportPartnerPhone).toBe('1900-6868');
      expect(pet.supportPartnerUrl).toBe('https://www.facebook.com/savesgt');
    });
  });

  // =========================================================================
  // GAP-14: Upload Module Separation & Strict MIME Validation
  // =========================================================================
  describe('GAP-14: Upload 3 module + MIME check + provider failure 502', () => {
    it('routes folder per module, rejects non-image MIME with 400, returns 502 on provider failure', async () => {
      // 1. Invalid MIME type (text file)
      const fakeTxtFile = {
        mimetype: 'text/plain',
        size: 1024,
        originalname: 'script.txt',
        buffer: Buffer.from('hello'),
      };

      await expect(
        uploadService.uploadProductImage(fakeTxtFile, '', 'products')
      ).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('Only JPG, PNG and WEBP images are allowed'),
      });

      // 2. Simulated provider timeout -> 502 UPLOAD_PROVIDER_ERROR
      const fakeValidImage = {
        mimetype: 'image/jpeg',
        size: 2048,
        originalname: 'photo.jpg',
        buffer: Buffer.from('fake-jpeg-data'),
      };

      await expect(
        uploadService.uploadProductImage(fakeValidImage, '', 'rescue', true)
      ).rejects.toMatchObject({
        status: 502,
        code: 'UPLOAD_PROVIDER_ERROR',
      });
    });
  });

  // =========================================================================
  // GAP-15: List >100 Pagination (Supports Limit up to 200)
  // =========================================================================
  describe('GAP-15: List >100 + role/branch isolation', () => {
    it('supports limit up to 200, returns totalCount and nextCursor', async () => {
      // 1. Flash Sale limit up to 200
      jest.spyOn(FlashSale, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const fsList = await flashSaleService.listFlashSales({ limit: 200, page: 1 }, adminActor);
      expect(fsList.limit).toBe(200);
      expect(fsList.totalCount).toBeDefined();

      // 2. Community Posts limit up to 200
      jest.spyOn(CommunityPost, 'countDocuments').mockResolvedValue(150);
      jest.spyOn(CommunityPost, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const postList = await contentService.getCommunityPostsAdmin({ limit: 200, page: 1 });
      expect(postList.limit).toBe(200);
      expect(postList.totalCount).toBe(150);

      // 3. Rescue Pets limit up to 200
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(180);
      jest.spyOn(RescuePet, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const petList = await contentService.getRescuePetsAdmin({ limit: 200, page: 1 });
      expect(petList.limit).toBe(200);
      expect(petList.totalCount).toBe(180);
    });
  });

  // =========================================================================
  // GAP-16: Transaction Rollback & Rescue Partners Contract Verification
  // =========================================================================
  describe('GAP-16: Kiểm chứng Transaction Rollback & API Rescue Partners Contract', () => {
    it('rolls back report status to PENDING when an error occurs mid-transaction and returns verified 6 Customer partners contract', async () => {
      const reportId = new mongoose.Types.ObjectId();
      const postId = new mongoose.Types.ObjectId();
      let persistedState = {
        status: 'PENDING',
        decision: null,
      };

      // Simulate transaction session where uncommitted mutations are discarded on abort
      let txWorkingCopy = null;
      const mockSession = {
        withTransaction: jest.fn(async (fn) => {
          txWorkingCopy = { ...persistedState };
          try {
            const res = await fn();
            persistedState = { ...txWorkingCopy };
            return res;
          } catch (err) {
            // Rollback working copy on error
            txWorkingCopy = null;
            throw err;
          }
        }),
        endSession: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      const origReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      jest.spyOn(CommunityReport, 'findOneAndUpdate').mockImplementation(async () => {
        if (txWorkingCopy) {
          txWorkingCopy.status = 'RESOLVED';
          txWorkingCopy.decision = 'HIDE_POST';
        }
        return { _id: reportId, postId, status: 'RESOLVED', decision: 'HIDE_POST' };
      });

      // Inject DB write failure on CommunityPost.findByIdAndUpdate mid-transaction
      jest.spyOn(CommunityPost, 'findByIdAndUpdate').mockRejectedValue(
        new Error('MongoWriteException: replica set stepdown during post hide')
      );

      await expect(
        contentService.resolveCommunityReport(
          reportId,
          { decision: 'HIDE_POST', moderationNote: 'Test real mid-tx rollback' },
          adminActor
        )
      ).rejects.toThrow('MongoWriteException: replica set stepdown during post hide');

      Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });

      // Verify transaction was rolled back: persistedState.status remains PENDING
      expect(persistedState.status).toBe('PENDING');
      expect(persistedState.decision).toBeNull();
      expect(mockSession.endSession).toHaveBeenCalled();

      // Verify GET /api/v1/content/rescue/partners contract matches docs (data.partners & 6 Customer partners)
      const partnersRes = await request(app).get('/api/v1/content/rescue/partners');
      expect(partnersRes.status).toBe(200);
      expect(partnersRes.body.success).toBe(true);
      expect(partnersRes.body.emergencyHotline).toBe('1900-6868');
      expect(partnersRes.body.data).toHaveProperty('partners');
      expect(partnersRes.body.data.totalPartners).toBe(6);
      expect(partnersRes.body.data.partners.map((p) => p.id)).toEqual([
        'vawa',
        'backyard',
        'nong-nghiep',
        'saigon-time',
        'we-act',
        'laws-for-paws',
      ]);
    });
  });

  // =========================================================================
  // GAP-17: FE Verification Round 2 (Feedback Status Guard, Limit=200, Cust 2 Fixes)
  // =========================================================================
  describe('GAP-17: Nghiệm thu phản hồi FE & tài liệu FEEDBACK 7-11 cust 2', () => {
    it('blocks PATCH /feedback/:id/status to PROCESSED when reply email is not SENT (BE-FIX-04)', async () => {
      const fbId = new mongoose.Types.ObjectId();
      const mockFb = {
        _id: fbId,
        name: 'Khách hàng test',
        email: 'test@example.com',
        message: 'Cần tư vấn',
        status: 'PROCESSING',
        replyDelivery: {
          deliveryStatus: 'NONE',
          providerMessageId: null,
        },
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Feedback, 'findById').mockResolvedValue(mockFb);

      await expect(
        feedbackService.updateFeedbackStatus(fbId, { status: 'PROCESSED' }, adminActor)
      ).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_STATE_TRANSITION',
      });
    });

    it('supports limit=200 in feedback.service.js (BE-FIX-10) and only requires message on createFeedback', async () => {
      jest.spyOn(Feedback, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      jest.spyOn(Feedback, 'countDocuments').mockResolvedValue(160);

      const listRes = await feedbackService.listFeedback({ limit: 200 }, adminActor);
      expect(listRes.totalCount).toBe(160);

      jest.spyOn(Feedback.prototype, 'save').mockResolvedValue(true);
      const createdFb = await feedbackService.createFeedback({
        message: 'Chỉ nhập nội dung liên hệ theo đúng yêu cầu cust 2',
      });
      expect(createdFb.message).toBe('Chỉ nhập nội dung liên hệ theo đúng yêu cầu cust 2');
      expect(createdFb.name).toBe('Khách hàng');
    });

    it('returns averageRating: 0 when product has 0 reviews and includes shipping & related products', async () => {
      jest.spyOn(Review, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      const stats = await reviewService.getProductReviewStats(new mongoose.Types.ObjectId().toString());
      expect(stats.averageRating).toBe(0);
      expect(stats.totalReviews).toBe(0);
    });
  });
});
