import mongoose from 'mongoose';
import Post from '../src/modules/content/models/Post.js';
import CommunityPost from '../src/modules/content/models/CommunityPost.js';
import RescuePet from '../src/modules/content/models/RescuePet.js';
import AdoptionRequest from '../src/modules/content/models/AdoptionRequest.js';
import Customer from '../src/modules/customer/models/Customer.js';
import Order from '../src/modules/order/models/Order.js';
import OrderRefund from '../src/modules/order/models/OrderRefund.js';
import Appointment from '../src/modules/booking/models/Appointment.js';
import InventoryStock from '../src/modules/inventory/models/InventoryStock.js';
import Product from '../src/modules/catalog/models/Product.js';
import Branch from '../src/modules/branch/models/Branch.js';
import Payment from '../src/modules/payment/models/Payment.js';
import { contentService } from '../src/modules/content/content.service.js';
import { dashboardService } from '../src/modules/dashboard/dashboard.service.js';
import {
  computeKpiComparison,
  determineGranularity,
  generateBucketKeys,
  normalizeNonNegativeZero,
  parseStrictVnDate,
  resolveVnDateRange,
} from '../src/modules/dashboard/dashboard.utils.js';

describe('Task 4.8: Content Management & Real-data Dashboard (Phase 1, 2, 3)', () => {
  const adminId = new mongoose.Types.ObjectId();
  const managerId = new mongoose.Types.ObjectId();
  const customerUserId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const branch1Id = new mongoose.Types.ObjectId();
  const branch2Id = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. CONTENT SERVICE: BLOG & FIRST AID
  // =========================================================================
  describe('1. Blog & First Aid Management', () => {
    it('creates a new blog post with automatic slugification', async () => {
      jest.spyOn(Post, 'findOne').mockResolvedValue(null);
      jest.spyOn(Post, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const post = await contentService.createPost({
        title: 'Chăm sóc răng miệng cho thú cưng',
        postType: 'OFFICIAL_BLOG',
        category: 'Chăm sóc sức khỏe',
        content: 'Nội dung chi tiết...',
      }, adminId);

      expect(post.title).toBe('Chăm sóc răng miệng cho thú cưng');
      expect(post.slug).toBe('cham-soc-rang-mieng-cho-thu-cung');
      expect(post.status).toBe('DRAFT');
      expect(post.authorId).toBe(adminId);
    });

    it('transitions post status to PUBLISHED and sets publishedAt', async () => {
      const postId = new mongoose.Types.ObjectId();
      const mockPost = {
        _id: postId,
        title: 'Cẩm nang sơ cứu',
        status: 'DRAFT',
        publishedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(contentService, 'getPostById').mockResolvedValue(mockPost);

      const updated = await contentService.updatePostStatus(postId, 'PUBLISHED');
      expect(updated.status).toBe('PUBLISHED');
      expect(updated.publishedAt).toBeInstanceOf(Date);
      expect(mockPost.save).toHaveBeenCalled();
    });

    it('retrieves distinct categories and featured posts', async () => {
      jest.spyOn(Post, 'distinct').mockResolvedValue(['Dinh dưỡng', 'Y tế & Bệnh học']);
      const categories = await contentService.getPostCategories();

      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('Dinh dưỡng');
      expect(categories[0].slug).toBe('dinh-duong');
    });
  });

  // =========================================================================
  // 2. COMMUNITY POSTS & MODERATION
  // =========================================================================
  describe('2. Community Posts & Moderation Queue', () => {
    it('creates community post in PENDING status for member customer', async () => {
      jest.spyOn(Customer, 'findOne').mockResolvedValue({
        _id: customerId,
        fullName: 'Lê Văn Cường',
        avatarUrl: 'https://cdn.example.com/avatar.jpg',
      });

      jest.spyOn(CommunityPost, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const post = await contentService.createCommunityPost({
        title: 'Chia sẻ kinh nghiệm nuôi mèo con',
        content: 'Mèo con rất thích ăn pate...',
      }, { id: customerUserId, fullName: 'Lê Văn Cường' });

      expect(post.status).toBe('PENDING');
      expect(post.authorCustomerId).toBe(customerId);
      expect(post.authorNameSnapshot).toBe('Lê Văn Cường');
    });

    it('allows Admin/Manager to approve a community post', async () => {
      const postId = new mongoose.Types.ObjectId();
      const mockPost = {
        _id: postId,
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(CommunityPost, 'findById').mockResolvedValue(mockPost);

      const approved = await contentService.moderateCommunityPost(postId, { status: 'APPROVED' }, managerId);
      expect(approved.status).toBe('APPROVED');
      expect(approved.moderatedBy).toBe(managerId);
      expect(approved.moderatedAt).toBeInstanceOf(Date);
      expect(mockPost.save).toHaveBeenCalled();
    });

    it('requires a rejectionReason when rejecting a community post', async () => {
      const postId = new mongoose.Types.ObjectId();
      await expect(contentService.moderateCommunityPost(postId, { status: 'REJECTED' }, managerId))
        .rejects.toThrow('Cần cung cấp lý do từ chối bài viết');
    });
  });

  // =========================================================================
  // 3. RESCUE PETS & ADOPTION REQUESTS
  // =========================================================================
  describe('3. Rescue Pets & Adoption Flow', () => {
    it('creates a rescue pet with LOOKING_FOR_HOME status and generated petCode', async () => {
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(RescuePet, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const pet = await contentService.createRescuePet({
        petName: 'Miu Miu',
        species: 'CAT',
        breed: 'Mèo mướp',
        ageDescription: '5 tháng tuổi',
        healthStatus: 'Khỏe mạnh, đã tiêm 1 mũi',
        rescueStory: 'Được tìm thấy gần công viên...',
        images: ['https://cdn.petclinic.vn/rescue/miu.jpg'],
      });

      expect(pet.petCode).toBe('RES-0006');
      expect(pet.status).toBe('LOOKING_FOR_HOME');
      expect(pet.petName).toBe('Miu Miu');
    });

    it('submits adoption request in PENDING status', async () => {
      const rescuePetId = new mongoose.Types.ObjectId();
      jest.spyOn(RescuePet, 'findById').mockResolvedValue({
        _id: rescuePetId,
        status: 'LOOKING_FOR_HOME',
      });
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId });
      jest.spyOn(AdoptionRequest, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(AdoptionRequest, 'create').mockImplementation((doc) => Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      }));

      const req = await contentService.createAdoptionRequest({
        rescuePetId,
        fullName: 'Nguyễn Thị Hoa',
        phone: '0987654321',
        email: 'hoa.nguyen@example.com',
        address: 'Quận 7, TP.HCM',
        housingType: 'Nhà riêng có sân',
      }, { id: customerUserId });

      expect(req.status).toBe('PENDING');
      expect(req.applicantInfo.fullName).toBe('Nguyễn Thị Hoa');
      expect(req.rescuePetId).toBe(rescuePetId);
      expect(req.requestCode).toMatch(/^ADO-\d{8}-0003$/);
    });

    it('approving adoption request automatically marks RescuePet as ADOPTED', async () => {
      const rescuePetId = new mongoose.Types.ObjectId();
      const requestId = new mongoose.Types.ObjectId();
      const mockReq = {
        _id: requestId,
        rescuePetId,
        customerId,
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AdoptionRequest, 'findById').mockResolvedValue(mockReq);
      const petUpdateSpy = jest.spyOn(RescuePet, 'findByIdAndUpdate').mockResolvedValue({
        _id: rescuePetId,
        status: 'ADOPTED',
      });

      const reviewed = await contentService.reviewAdoptionRequest(requestId, {
        status: 'APPROVED',
        reviewNote: 'Đủ điều kiện chăm sóc',
      }, adminId);

      expect(reviewed.status).toBe('APPROVED');
      expect(petUpdateSpy).toHaveBeenCalledWith(rescuePetId, expect.objectContaining({
        status: 'ADOPTED',
        adoptedByCustomerId: customerId,
      }));
    });
  });

  // =========================================================================
  // 4. DASHBOARD SERVICE REAL DATA AGGREGATION & UTILS (M23 UNIT TESTS)
  // =========================================================================
  describe('4. Real-data Dashboard Aggregations & Utils (M23 Mocked Unit Tests)', () => {
    const mockDashboardAggregations = ({
      orderRev = 8000000,
      prevOrderRev = 5000000,
      serviceRev = 2400000,
      prevServiceRev = 1500000,
      refundAmt = 400000,
      prevRefundAmt = 0,
      orderCounts = [
        { _id: 'COMPLETED', count: 10 },
        { _id: 'PENDING', count: 5 },
        { _id: 'CANCELLED', count: 2 },
      ],
      prevOrderCount = 12,
      aptCounts = [
        { _id: 'COMPLETED', count: 8 },
        { _id: 'CONFIRMED', count: 4 },
      ],
      prevAptCount = 9,
      activeCustCount = 15,
      prevActiveCustCount = 10,
      lowStockTotal = 3,
      bucketDate = '2026-11-10',
    } = {}) => {
      jest.spyOn(Order, 'aggregate').mockImplementation(async (pipeline) => {
        const hasUnion = pipeline.some((s) => s.$unionWith);
        if (hasUnion) {
          const hasFacet = pipeline.some((s) => s.$facet);
          if (hasFacet) {
            return [{
              totalDistinct: [{ count: activeCustCount }],
              bucketPairs: [{ _id: { rawKey: bucketDate, customerId: customerId.toString() } }],
            }];
          }
          return [{ count: prevActiveCustCount }];
        }
        const matchStatus = pipeline.find((s) => s.$match && s.$match.status === 'COMPLETED');
        if (matchStatus) {
          const grp = pipeline.find((s) => s.$group);
          if (grp?.$group?._id === 'TOTAL') {
            return [{ _id: 'TOTAL', amount: prevOrderRev }];
          }
          return [{ _id: bucketDate, amount: orderRev }];
        }
        if (pipeline.some((s) => s.$facet)) {
          return [{
            byStatus: orderCounts,
            byBucket: [{ _id: bucketDate, count: orderCounts.reduce((a, b) => a + b.count, 0) }],
          }];
        }
        return [{ count: prevOrderCount }];
      });

      jest.spyOn(Appointment, 'aggregate').mockImplementation(async (pipeline) => {
        const matchStatus = pipeline.find((s) => s.$match && s.$match.status === 'COMPLETED');
        if (matchStatus) {
          const grp = pipeline.find((s) => s.$group);
          if (grp?.$group?._id === 'TOTAL') {
            return [{ _id: 'TOTAL', amount: prevServiceRev }];
          }
          return [{ _id: bucketDate, amount: serviceRev }];
        }
        if (pipeline.some((s) => s.$facet)) {
          return [{
            byStatus: aptCounts,
            byBucket: [{ _id: bucketDate, count: aptCounts.reduce((a, b) => a + b.count, 0) }],
          }];
        }
        return [{ count: prevAptCount }];
      });

      jest.spyOn(OrderRefund, 'aggregate').mockImplementation(async (pipeline) => {
        const grp = pipeline.find((s) => s.$group);
        if (grp?.$group?._id === 'TOTAL') {
          return [{ _id: 'TOTAL', amount: prevRefundAmt }];
        }
        return [{ _id: bucketDate, amount: refundAmt }];
      });

      jest.spyOn(InventoryStock, 'aggregate').mockImplementation(async (pipeline) => {
        if (pipeline.some((s) => s.$count === 'total')) {
          return [{ total: lowStockTotal }];
        }
        return [];
      });
    };

    it('resolves strict VN calendar dates, leap years, presets, and previous windows accurately', () => {
      expect(() => parseStrictVnDate('2026-02-30', 'from')).toThrow();
      expect(() => parseStrictVnDate('2026/11/01', 'from')).toThrow();
      expect(parseStrictVnDate('2024-02-29', 'from')).toBe('2024-02-29');

      const range = resolveVnDateRange({ from: '2026-11-01', to: '2026-11-10', timezone: 'Asia/Ho_Chi_Minh' });
      expect(range.days).toBe(10);
      expect(range.granularity).toBe('day');
      expect(range.previousFrom).toBe('2026-10-22');
      expect(range.previousTo).toBe('2026-10-31');
      expect(range.startUtc.toISOString()).toBe('2026-10-31T17:00:00.000Z');
      expect(range.endExclusiveUtc.toISOString()).toBe('2026-11-10T17:00:00.000Z');

      expect(() => resolveVnDateRange({ from: '2026-11-10' })).toThrow();
      expect(() => resolveVnDateRange({ from: '2026-11-10', to: '2026-11-01' })).toThrow();
      expect(() => resolveVnDateRange({ from: '2025-01-01', to: '2026-11-01' })).toThrow();
      expect(() => resolveVnDateRange({ preset: 'today', timezone: 'UTC' })).toThrow();

      expect(determineGranularity(1)).toBe('hour');
      expect(generateBucketKeys('2026-11-11', '2026-11-11', 'hour')).toHaveLength(24);
      expect(determineGranularity(31)).toBe('day');
      expect(determineGranularity(32)).toBe('week');
      expect(determineGranularity(180)).toBe('week');
      expect(determineGranularity(181)).toBe('month');

      expect(computeKpiComparison(120, 100)).toEqual({ current: 120, previous: 100, delta: 20, changePercent: 20 });
      expect(computeKpiComparison(100, 0).changePercent).toBeNull();
      expect(computeKpiComparison(50, -200).changePercent).toBeNull();
      expect(Object.is(normalizeNonNegativeZero(-0), 0)).toBe(true);
    });

    it('aggregates M23 summary + backward-compatible legacy keys for Admin', async () => {
      mockDashboardAggregations({
        orderRev: 8000000,
        prevOrderRev: 5000000,
        serviceRev: 2400000,
        prevServiceRev: 1500000,
        refundAmt: 400000,
        prevRefundAmt: 0,
        activeCustCount: 15,
        prevActiveCustCount: 10,
        lowStockTotal: 3,
      });

      const summary = await dashboardService.getDashboardSummary(
        { from: '2026-11-01', to: '2026-11-11' },
        { id: adminId, systemRole: 'ADMIN' }
      );

      expect(summary.orders).toBe(17);
      expect(summary.appointments).toBe(12);
      expect(summary.revenue.amount).toBe(10000000); // 8tr + 2.4tr - 0.4tr
      expect(summary.revenue.currency).toBe('VND');
      expect(summary.newCustomers).toBe(15);
      expect(summary.lowStockItems).toBe(3);

      expect(summary.kpis.revenue.current).toBe(10000000);
      expect(summary.kpis.revenue.previous).toBe(6500000);
      expect(summary.kpis.revenue.delta).toBe(3500000);
      expect(summary.kpis.revenue.trend).toHaveLength(11);
      expect(summary.orderCountsByStatus.COMPLETED).toBe(10);
      expect(summary.appointmentCountsByStatus.NO_SHOW).toBe(0);
      expect(summary.breakdown.refundAdjustment).toBe(-400000);
      expect(summary.breakdown.commerceRevenue).toBe(7600000);
      expect(summary.breakdown.clinicRevenue).toBe(2400000);
    });

    it('enforces RBAC: rejects unassigned Manager branch, empty Manager scope, invalid ObjectId, and missing ADMIN branch', async () => {
      await expect(dashboardService.getDashboardSummary({ branchId: 'not-an-id' }, { id: adminId, systemRole: 'ADMIN' }))
        .rejects.toThrow('Invalid branchId format');

      await expect(dashboardService.getDashboardSummary({}, { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [] }))
        .rejects.toThrow('Manager account is not assigned to any branch');

      await expect(
        dashboardService.getDashboardSummary(
          { branchId: branch2Id.toString() },
          { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branch1Id] }
        )
      ).rejects.toThrow('You do not have access to this branch');

      jest.spyOn(Branch, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });
      await expect(
        dashboardService.getDashboardSummary({ branchId: branch2Id.toString() }, { id: adminId, systemRole: 'ADMIN' })
      ).rejects.toThrow('Branch not found');
    });

    it('allows Manager to view dashboard for assigned branch', async () => {
      mockDashboardAggregations({
        orderRev: 2000000,
        prevOrderRev: 1000000,
        serviceRev: 600000,
        prevServiceRev: 500000,
        refundAmt: 0,
        orderCounts: [{ _id: 'COMPLETED', count: 4 }],
        aptCounts: [{ _id: 'COMPLETED', count: 3 }],
        lowStockTotal: 1,
      });

      const summary = await dashboardService.getDashboardSummary(
        { branchId: branch1Id.toString(), from: '2026-11-01', to: '2026-11-11' },
        { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branch1Id] }
      );
      expect(summary.orders).toBe(4);
      expect(summary.appointments).toBe(3);
      expect(summary.revenue.amount).toBe(2600000);
      expect(summary.range.branchIds).toEqual([branch1Id.toString()]);
    });

    it('returns low stock alerts sorted by severity with Product image resolution and null for MATERIAL', async () => {
      const itemProdId = new mongoose.Types.ObjectId();
      const itemMatId = new mongoose.Types.ObjectId();
      const prodDocId = new mongoose.Types.ObjectId();

      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([
        {
          meta: [{ total: 2, unconfiguredCount: 1 }],
          items: [
            {
              _id: new mongoose.Types.ObjectId(),
              inventoryItemId: itemProdId,
              branchId: branch1Id,
              branchName: 'Chi nhánh Quận 1',
              branchCode: 'BR-000001',
              sku: 'SP-RC-001',
              name: 'Royal Canin Mini',
              unit: 'Bao',
              kind: 'PRODUCT',
              quantity: 0,
              lowStockThreshold: 5,
              thresholdConfigured: true,
              status: 'OUT_OF_STOCK',
            },
            {
              _id: new mongoose.Types.ObjectId(),
              inventoryItemId: itemMatId,
              branchId: branch1Id,
              branchName: 'Chi nhánh Quận 1',
              branchCode: 'BR-000001',
              sku: 'MAT-001',
              name: 'Gạc y tế',
              unit: 'Cuộn',
              kind: 'MATERIAL',
              quantity: 2,
              lowStockThreshold: 10,
              thresholdConfigured: true,
              status: 'LOW_STOCK',
            },
          ],
        },
      ]);

      jest.spyOn(Product, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: prodDocId,
              images: [{ url: 'https://cdn.example.com/primary.jpg', isPrimary: true }],
              variants: [{ inventoryItemId: itemProdId, sku: 'SP-RC-001', image: 'https://cdn.example.com/variant.jpg' }],
            },
          ]),
        }),
      });

      const alerts = await dashboardService.getLowStockAlerts({ limit: 10 }, { id: adminId, systemRole: 'ADMIN' });
      expect(alerts.total).toBe(2);
      expect(alerts.unconfiguredCount).toBe(1);
      expect(alerts.items).toHaveLength(2);
      expect(alerts.items[0].sku).toBe('SP-RC-001');
      expect(alerts.items[0].status).toBe('OUT_OF_STOCK');
      expect(alerts.items[0].imageUrl).toBe('https://cdn.example.com/variant.jpg');
      expect(alerts.items[1].sku).toBe('MAT-001');
      expect(alerts.items[1].imageUrl).toBeNull();
    });
  });
});
