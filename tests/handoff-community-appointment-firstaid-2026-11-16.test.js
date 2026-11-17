import mongoose from 'mongoose';
import { contentService } from '../src/modules/content/content.service.js';
import * as bookingService from '../src/modules/booking/booking.service.js';
import CommunityPost from '../src/modules/content/models/CommunityPost.js';
import CommunityComment from '../src/modules/content/models/CommunityComment.js';
import Post from '../src/modules/content/models/Post.js';
import Customer from '../src/modules/customer/models/Customer.js';
import Appointment from '../src/modules/booking/models/Appointment.js';
import RescuePet from '../src/modules/content/models/RescuePet.js';

describe('Handoff 2026-11-16 Verification: Community, Appointment, FirstAid', () => {
  const customerUserId = new mongoose.Types.ObjectId();
  const customerDocId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const staffProfileId = new mongoose.Types.ObjectId();
  const managerUserId = new mongoose.Types.ObjectId();
  const branch1Id = new mongoose.Types.ObjectId();
  const branch2Id = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. COMMUNITY POSTS (P0 & P1)
  // =========================================================================
  describe('1. Community Posts Requirements', () => {
    test('TC-01: Customer post is forced to PENDING status and cannot be bypassed', async () => {
      jest.spyOn(Customer, 'findOne').mockResolvedValue({
        _id: customerDocId,
        userId: customerUserId,
        fullName: 'Nguyễn Văn A',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      const createSpy = jest.spyOn(CommunityPost, 'create').mockImplementation(async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        toObject: () => ({ _id: new mongoose.Types.ObjectId(), ...doc }),
      }));

      const result = await contentService.createCommunityPost(
        {
          title: 'Chia sẻ kinh nghiệm nuôi mèo',
          content: 'Nội dung bài viết bổ ích...',
          type: 'MEO_VAT',
          status: 'APPROVED', // Client cố tình inject APPROVED
        },
        { id: customerUserId.toString(), systemRole: 'CUSTOMER' }
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING', // Bắt buộc lưu PENDING
          type: 'MEO_VAT',
          typeLabel: 'Mẹo vặt',
        })
      );
      expect(result.status).toBe('PENDING');
    });

    test('TC-02: Rejects temporary blob URLs in imageUrls', async () => {
      jest.spyOn(Customer, 'findOne').mockResolvedValue({
        _id: customerDocId,
        userId: customerUserId,
      });

      await expect(
        contentService.createCommunityPost(
          {
            title: 'Ảnh mèo cưng',
            content: 'Nội dung...',
            imageUrls: ['blob:http://localhost:4200/abc-123'],
          },
          { id: customerUserId.toString(), systemRole: 'CUSTOMER' }
        )
      ).rejects.toThrow('Không chấp nhận ảnh dạng blob URL');
    });

    test('TC-03: Public feed query only returns APPROVED posts', async () => {
      const countSpy = jest.spyOn(CommunityPost, 'countDocuments').mockResolvedValue(5);
      const findSpy = jest.spyOn(CommunityPost, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { _id: new mongoose.Types.ObjectId(), title: 'Post 1', status: 'APPROVED' },
        ]),
      });

      await contentService.getCommunityPostsPublic({ page: 1, limit: 10 });

      expect(countSpy).toHaveBeenCalledWith({ status: 'APPROVED' });
      expect(findSpy).toHaveBeenCalledWith({ status: 'APPROVED' });
    });
  });

  // =========================================================================
  // 2. FIRST AID GUIDES (P1)
  // =========================================================================
  describe('2. First Aid Guide DTO Contracts', () => {
    test('TC-04: Returns urgent boolean and clean video_url / videoUrl', async () => {
      jest.spyOn(Post, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          title: 'Sơ cứu hóc dị vật',
          slug: 'hoc-di-vat',
          urgencyLevel: 'URGENT',
          videoUrl: 'https://youtube.com/watch?v=123',
          toObject: () => ({
            _id: '507f1f77bcf86cd799439011',
            title: 'Sơ cứu hóc dị vật',
            urgencyLevel: 'URGENT',
            videoUrl: 'https://youtube.com/watch?v=123',
          }),
        }),
      });
      jest.spyOn(Post, 'updateOne').mockResolvedValue({});

      const result = await contentService.getPostBySlugPublic('hoc-di-vat');

      expect(result.urgent).toBe(true);
      expect(result.urgencyLevel).toBe('URGENT');
      expect(result.video_url).toBe('https://youtube.com/watch?v=123');
      expect(result.videoUrl).toBe('https://youtube.com/watch?v=123');
    });

    test('TC-05: Returns null for video_url when empty or missing', async () => {
      jest.spyOn(Post, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          title: 'Vết thương ngoài da',
          slug: 'vet-thuong',
          urgencyLevel: 'NORMAL',
          videoUrl: '   ',
          toObject: () => ({
            title: 'Vết thương ngoài da',
            urgencyLevel: 'NORMAL',
            videoUrl: '   ',
          }),
        }),
      });
      jest.spyOn(Post, 'updateOne').mockResolvedValue({});

      const result = await contentService.getPostBySlugPublic('vet-thuong');

      expect(result.urgent).toBe(false);
      expect(result.video_url).toBeNull();
      expect(result.videoUrl).toBeNull();
    });
  });

  // =========================================================================
  // 3. APPOINTMENT START VALIDATIONS (P0)
  // =========================================================================
  describe('3. Appointment Start Validations', () => {
    test('TC-06: Start rejects if appointment has NOT checked-in', async () => {
      const aptMock = {
        _id: new mongoose.Types.ObjectId(),
        status: 'CONFIRMED',
        checkInStatus: 'NOT_CHECKED_IN',
        checkedInAt: null,
        branchId: branch1Id,
        services: [
          {
            serviceId: new mongoose.Types.ObjectId(),
            assignedStaffId: staffProfileId,
            requiredStaffRole: 'VETERINARIAN',
          },
        ],
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(aptMock),
      });

      await expect(
        bookingService.startSegment(aptMock._id, aptMock.services[0].serviceId, {
          id: staffUserId.toString(),
          systemRole: 'STAFF',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [branch1Id],
        })
      ).rejects.toThrow('Bệnh nhân chưa hoàn tất thủ tục Check-in tại quầy');
    });

    test('TC-07: Start rejects if assignedStaffId is missing', async () => {
      const aptMock = {
        _id: new mongoose.Types.ObjectId(),
        status: 'CHECKED_IN',
        checkInStatus: 'CHECKED_IN',
        checkedInAt: new Date(),
        branchId: branch1Id,
        services: [
          {
            serviceId: new mongoose.Types.ObjectId(),
            assignedStaffId: null, // Chưa gán staff
          },
        ],
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(aptMock),
      });

      await expect(
        bookingService.startSegment(aptMock._id, aptMock.services[0].serviceId, {
          id: staffUserId.toString(),
          systemRole: 'STAFF',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [branch1Id],
        })
      ).rejects.toThrow('Dịch vụ này chưa được phân công nhân viên chuyên môn');
    });
  });

  // =========================================================================
  // 4. RESCUE PET MANAGER BRANCH SCOPE (P0)
  // =========================================================================
  describe('4. Rescue Pet Branch Scope Enforcement', () => {
    test('TC-08: Rejects Manager creating rescue pet without branchId', async () => {
      await expect(
        contentService.createRescuePet(
          {
            petName: 'Mimi',
            species: 'CAT',
            healthStatus: 'STABLE',
            rescueStory: 'Được cứu hộ tại công viên',
            images: ['https://example.com/cat.jpg'],
            branchId: null, // Manager không gửi branchId
          },
          {
            id: managerUserId.toString(),
            systemRole: 'MANAGER',
            assignedBranchIds: [branch1Id.toString()],
          }
        )
      ).rejects.toThrow('Tài khoản Quản lý (Manager) bắt buộc phải chỉ định chi nhánh cứu trợ');
    });
  });
});
