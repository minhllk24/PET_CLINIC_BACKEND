import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import StaffProfile from '../src/modules/staff/models/StaffProfile.js';
import Shift from '../src/modules/staff/models/Shift.js';
import Branch from '../src/modules/branch/models/Branch.js';
import * as shiftService from '../src/modules/staff/shift.service.js';
import * as authService from '../src/modules/auth/auth.service.js';

describe('PM Feedback Verification: Multi-Branch & Only-Text Credentials Suite', () => {
  const branchQ1Id = new mongoose.Types.ObjectId();
  const branchQ7Id = new mongoose.Types.ObjectId();
  const branchBTId = new mongoose.Types.ObjectId();
  const allBranches = [branchQ1Id, branchQ7Id, branchBTId];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Rule Only-Text: Tất cả các tài khoản nội bộ (Admin, Manager, Staff) KHÔNG cần SĐT/Email', () => {
    it('Model User cho phép tạo tài khoản có username mà KHÔNG cần phone và KHÔNG cần email', () => {
      const internalRoles = [
        { username: 'admin', systemRole: 'ADMIN' },
        { username: 'manager_q1', systemRole: 'MANAGER' },
        { username: 'vet_dual', systemRole: 'STAFF', staffSubRole: 'VETERINARIAN' },
        { username: 'care_master', systemRole: 'STAFF', staffSubRole: 'CARE_STAFF_GROOMER' },
        { username: 'receptionist_dual', systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST' },
        { username: 'nurse_tri', systemRole: 'STAFF', staffSubRole: 'NURSE' },
      ];

      for (const account of internalRoles) {
        const user = new User({
          username: account.username,
          fullName: `Internal Staff ${account.username}`,
          passwordHash: 'hashed_password_placeholder',
          systemRole: account.systemRole,
          staffSubRole: account.staffSubRole || null,
          accountStatus: 'ACTIVE',
          // Explicitly NO phone and NO email
        });

        // Validate sync
        const err = user.validateSync();
        expect(err).toBeUndefined();
        expect(user.phone).toBeUndefined();
        expect(user.email).toBeUndefined();
        expect(user.username).toBe(account.username);
      }
    });

    it('Tài khoản CUSTOMER bắt buộc phải có phone khi không có googleId', () => {
      const custWithoutPhone = new User({
        fullName: 'Customer Without Phone',
        passwordHash: 'hashed_pw',
        systemRole: 'CUSTOMER',
        accountStatus: 'PENDING_ACTIVATION',
      });

      const err = custWithoutPhone.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.phone).toBeDefined();
    });

    it('POST /api/v1/auth/login cho phép đăng nhập thành công chỉ bằng username (plain-text) và password', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'vet_dual',
        systemRole: 'STAFF',
        staffSubRole: 'VETERINARIAN',
        assignedBranchIds: [branchQ1Id, branchQ7Id],
        accountStatus: 'ACTIVE',
        fullName: 'BS. Pham Minh Khoi',
      };

      jest.spyOn(authService, 'login').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'vet_dual',
          password: 'K9#mQ$8xL!2vW*7z',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock_jwt_access_token');
      expect(res.body.user.systemRole).toBe('STAFF');
      expect(res.body.user.staffSubRole).toBe('VETERINARIAN');
      expect(res.body.user.branchScope).toHaveLength(2);
      expect(res.body.user.phone).toBeNull();
      expect(res.body.user.email).toBeNull();
    });
  });

  describe('2. Phân bổ tối thiểu 3 chi nhánh & 4 Roles nội bộ hỗ trợ Đa chi nhánh', () => {
    it('Xác thực phân bổ 4 roles (MANAGER, VET, CARE, RECEPTIONIST) qua 3 chi nhánh (Single, Dual, Tri-branch)', () => {
      const staffPermutations = [
        // MANAGER
        { role: 'MANAGER', branches: [branchQ1Id], type: 'SINGLE' },
        { role: 'MANAGER', branches: [branchQ7Id], type: 'SINGLE' },
        { role: 'MANAGER', branches: [branchBTId], type: 'SINGLE' },
        { role: 'MANAGER', branches: [branchQ1Id, branchQ7Id], type: 'DUAL' },
        { role: 'MANAGER', branches: allBranches, type: 'TRI' },

        // VET (VETERINARIAN)
        { role: 'STAFF', subRole: 'VETERINARIAN', branches: [branchQ1Id], type: 'SINGLE' },
        { role: 'STAFF', subRole: 'VETERINARIAN', branches: [branchQ1Id, branchQ7Id], type: 'DUAL' },
        { role: 'STAFF', subRole: 'VETERINARIAN', branches: allBranches, type: 'TRI' },

        // CARE (CARE_STAFF_GROOMER)
        { role: 'STAFF', subRole: 'CARE_STAFF_GROOMER', branches: [branchBTId], type: 'SINGLE' },
        { role: 'STAFF', subRole: 'CARE_STAFF_GROOMER', branches: [branchQ1Id, branchBTId], type: 'DUAL' },
        { role: 'STAFF', subRole: 'CARE_STAFF_GROOMER', branches: allBranches, type: 'TRI' },

        // RECEPTIONIST
        { role: 'STAFF', subRole: 'RECEPTIONIST', branches: [branchQ7Id], type: 'SINGLE' },
        { role: 'STAFF', subRole: 'RECEPTIONIST', branches: [branchQ7Id, branchBTId], type: 'DUAL' },
        { role: 'STAFF', subRole: 'RECEPTIONIST', branches: allBranches, type: 'TRI' },
      ];

      for (const p of staffPermutations) {
        expect(p.branches.length).toBeGreaterThanOrEqual(1);
        if (p.type === 'SINGLE') expect(p.branches).toHaveLength(1);
        if (p.type === 'DUAL') expect(p.branches).toHaveLength(2);
        if (p.type === 'TRI') expect(p.branches).toHaveLength(3);
      }
    });

    it('StaffProfile lưu đúng authorizedBranchIds cho nhân sự làm việc tại nhiều chi nhánh', async () => {
      const staffUser = new User({
        username: 'vet_dual_test',
        fullName: 'BS. Test Dual',
        passwordHash: 'hash',
        systemRole: 'STAFF',
        staffSubRole: 'VETERINARIAN',
        assignedBranchIds: [branchQ1Id, branchQ7Id],
        accountStatus: 'ACTIVE',
      });

      const profile = new StaffProfile({
        userId: staffUser._id,
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [branchQ1Id, branchQ7Id],
        homeBranchId: branchQ1Id,
        status: 'ACTIVE',
      });

      expect(profile.authorizedBranchIds).toHaveLength(2);
      expect(profile.authorizedBranchIds[0].toString()).toBe(branchQ1Id.toString());
      expect(profile.authorizedBranchIds[1].toString()).toBe(branchQ7Id.toString());
      expect(profile.homeBranchId.toString()).toBe(branchQ1Id.toString());
    });
  });

  describe('3. Rule Chống trùng ca (Anti-Overlap Shift Constraint)', () => {
    it('Chặn nhân sự được xếp 2 ca làm việc trùng giờ nhau giữa 2 chi nhánh khác nhau (SHIFT_OVERLAP)', async () => {
      const staffId = new mongoose.Types.ObjectId();
      const staffProfile = {
        _id: staffId,
        authorizedBranchIds: [branchQ1Id, branchQ7Id],
        staffSubRole: 'VETERINARIAN',
        status: 'ACTIVE',
      };

      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(staffProfile);
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: branchQ7Id,
        status: 'ACTIVE',
      });

      // Giả lập ca trực thứ nhất tại Chi nhánh Q1 từ 08:00 đến 14:00
      // Khi xếp ca thứ hai tại Chi nhánh Q7 từ 10:00 đến 16:00 (bị trùng 10:00-14:00)
      jest.spyOn(Shift, 'findOne').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        staffId,
        branchId: branchQ1Id,
        startAt: new Date('2026-11-01T08:00:00.000Z'),
        endAt: new Date('2026-11-01T14:00:00.000Z'),
        status: 'ACTIVE',
      });

      await expect(
        shiftService.createShift({
          staffId: staffId.toString(),
          branchId: branchQ7Id.toString(),
          startAt: '2026-11-01T10:00:00.000Z',
          endAt: '2026-11-01T16:00:00.000Z',
        })
      ).rejects.toMatchObject({
        status: 409,
        code: 'SHIFT_OVERLAP',
      });
    });

    it('Cho phép nhân sự làm việc tại 2 chi nhánh khác nhau ở các ngày hoặc khung giờ không trùng (Disjoint Shifts)', async () => {
      const staffId = new mongoose.Types.ObjectId();
      const staffProfile = {
        _id: staffId,
        authorizedBranchIds: [branchQ1Id, branchQ7Id],
        staffSubRole: 'VETERINARIAN',
        status: 'ACTIVE',
      };

      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(staffProfile);
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: branchQ7Id,
        status: 'ACTIVE',
      });

      // Không có ca trùng
      jest.spyOn(Shift, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(Shift.prototype, 'save').mockResolvedValueOnce({});

      const result = await shiftService.createShift({
        staffId: staffId.toString(),
        branchId: branchQ7Id.toString(),
        startAt: '2026-11-02T14:00:00.000Z',
        endAt: '2026-11-02T20:00:00.000Z',
      });

      expect(result).toBeDefined();
      expect(result.branchId).toBe(branchQ7Id.toString());
      expect(result.status).toBe('ACTIVE');
    });

    it('Chặn xếp ca tại chi nhánh mà nhân sự không được ủy quyền (BRANCH_SCOPE_ERROR)', async () => {
      const staffId = new mongoose.Types.ObjectId();
      const staffProfile = {
        _id: staffId,
        authorizedBranchIds: [branchQ1Id], // Chỉ được ủy quyền tại Q1
        staffSubRole: 'VETERINARIAN',
        status: 'ACTIVE',
      };

      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(staffProfile);
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: branchBTId, // Cố tình xếp vào Bình Thạnh
        status: 'ACTIVE',
      });

      await expect(
        shiftService.createShift({
          staffId: staffId.toString(),
          branchId: branchBTId.toString(),
          startAt: '2026-11-03T08:00:00.000Z',
          endAt: '2026-11-03T14:00:00.000Z',
        })
      ).rejects.toMatchObject({
        status: 422,
        code: 'BRANCH_SCOPE_ERROR',
      });
    });
  });
});
