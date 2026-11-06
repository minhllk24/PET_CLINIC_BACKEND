import mongoose from 'mongoose';
import Post from '../src/modules/content/models/Post.js';
import CommunityPost from '../src/modules/content/models/CommunityPost.js';
import RescuePet from '../src/modules/content/models/RescuePet.js';
import AdoptionRequest from '../src/modules/content/models/AdoptionRequest.js';
import Customer from '../src/modules/customer/models/Customer.js';
import Order from '../src/modules/order/models/Order.js';
import Appointment from '../src/modules/booking/models/Appointment.js';
import InventoryStock from '../src/modules/inventory/models/InventoryStock.js';
import Payment from '../src/modules/payment/models/Payment.js';
import { contentService } from '../src/modules/content/content.service.js';
import { dashboardService } from '../src/modules/dashboard/dashboard.service.js';

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
  // 4. DASHBOARD SERVICE REAL DATA AGGREGATION
  // =========================================================================
  describe('4. Real-data Dashboard Aggregations (OpenAPI compliant)', () => {
    it('aggregates real metrics for Admin (Orders, Appointments, Revenue, Low Stock)', async () => {
      jest.spyOn(Order, 'aggregate').mockResolvedValue([
        { _id: 'DELIVERED', count: 10, revenue: 5000000 },
        { _id: 'COMPLETED', count: 5, revenue: 3000000 },
        { _id: 'CANCELLED', count: 2, revenue: 0 },
      ]);

      jest.spyOn(Appointment, 'aggregate').mockResolvedValue([
        { _id: 'COMPLETED', count: 8 },
        { _id: 'CONFIRMED', count: 4 },
      ]);

      jest.spyOn(InventoryStock, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(Customer, 'countDocuments').mockResolvedValue(15);
      jest.spyOn(Payment, 'aggregate').mockResolvedValue([
        { _id: null, totalClinicRevenue: 2400000 },
      ]);

      const summary = await dashboardService.getDashboardSummary({ preset: 'this_month' }, {
        id: adminId,
        systemRole: 'ADMIN',
      });

      expect(summary.orders).toBe(17);
      expect(summary.appointments).toBe(12);
      expect(summary.revenue.amount).toBe(10400000); // 8tr commerce + 2.4tr clinic
      expect(summary.revenue.currency).toBe('VND');
      expect(summary.newCustomers).toBe(15);
      expect(summary.lowStockItems).toBe(3);
      expect(summary.breakdown.commerceRevenue).toBe(8000000);
      expect(summary.breakdown.clinicRevenue).toBe(2400000);
    });

    it('enforces RBAC for Manager: blocks access to unassigned branch', async () => {
      const managerActor = {
        id: managerId,
        systemRole: 'MANAGER',
        assignedBranchIds: [branch1Id],
      };

      await expect(dashboardService.getDashboardSummary({ branchId: branch2Id.toString() }, managerActor))
        .rejects.toThrow('Bạn không có quyền truy cập dữ liệu của chi nhánh này');
    });

    it('allows Manager to view dashboard for assigned branch', async () => {
      const managerActor = {
        id: managerId,
        systemRole: 'MANAGER',
        assignedBranchIds: [branch1Id],
      };

      jest.spyOn(Order, 'aggregate').mockResolvedValue([
        { _id: 'DELIVERED', count: 4, revenue: 2000000 },
      ]);
      jest.spyOn(Appointment, 'aggregate').mockResolvedValue([
        { _id: 'COMPLETED', count: 3 },
      ]);
      jest.spyOn(InventoryStock, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Customer, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(Payment, 'aggregate').mockResolvedValue([
        { _id: null, totalClinicRevenue: 600000 },
      ]);

      const summary = await dashboardService.getDashboardSummary({ branchId: branch1Id.toString() }, managerActor);
      expect(summary.orders).toBe(4);
      expect(summary.appointments).toBe(3);
      expect(summary.revenue.amount).toBe(2600000);
    });

    it('returns low stock alerts with product and branch information', async () => {
      const mockStockItem = {
        _id: new mongoose.Types.ObjectId(),
        quantity: 2,
        branchId: { _id: branch1Id, name: 'Chi nhánh Quận 1', code: 'BR-000001' },
        inventoryItemId: { _id: new mongoose.Types.ObjectId(), sku: 'SP-RC-001', name: 'Royal Canin Mini', barcode: '8930001' },
      };

      jest.spyOn(InventoryStock, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockStockItem]),
      });

      const alerts = await dashboardService.getLowStockAlerts({ threshold: 5 }, { systemRole: 'ADMIN' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].quantity).toBe(2);
      expect(alerts[0].item.sku).toBe('SP-RC-001');
      expect(alerts[0].branch.name).toBe('Chi nhánh Quận 1');
    });
  });
});
