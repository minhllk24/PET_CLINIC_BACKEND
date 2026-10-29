import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import User from '../models/User.js';
import StaffProfile from '../modules/staff/models/StaffProfile.js';
import Shift from '../modules/staff/models/Shift.js';
import Branch from '../modules/branch/models/Branch.js';

const DEMO_ACCOUNTS = [
  // 1. Quản trị tối cao (Global) - ONLY TEXT
  {
    username: 'admin',
    fullName: 'System Administrator',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'ADMIN',
    accountStatus: 'ACTIVE',
    allBranches: true,
  },

  // 2. Ban Quản Lý (MANAGER) - ONLY TEXT
  {
    username: 'manager',
    fullName: 'Quản Lý Chi Nhánh 1 (Q1)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'MANAGER',
    accountStatus: 'ACTIVE',
  },
  {
    username: 'manager_dual',
    fullName: 'Quản Lý Điều Phối (Q1 & Q7)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'MANAGER',
    accountStatus: 'ACTIVE',
    multiBranch: true,
  },
  {
    username: 'manager_general',
    fullName: 'Tổng Quản Lý Điều Hành (3 Chi Nhánh)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'MANAGER',
    accountStatus: 'ACTIVE',
    allBranches: true,
  },

  // 3. Bác Sĩ Thú Y (VETERINARIAN) - ONLY TEXT
  {
    username: 'doctor',
    fullName: 'Bác Sĩ Thú Y Nguyễn Văn A (Q1)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    accountStatus: 'ACTIVE',
  },
  {
    username: 'vet_dual',
    fullName: 'Bác Sĩ Luân Phiên (Q1 & Q7)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    accountStatus: 'ACTIVE',
    multiBranch: true,
  },
  {
    username: 'vet_master',
    fullName: 'Bác Sĩ Trưởng Hội Chẩn (3 Chi Nhánh)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    accountStatus: 'ACTIVE',
    allBranches: true,
  },

  // 4. Lễ Tân Tiếp Đón (RECEPTIONIST) - ONLY TEXT
  {
    username: 'receptionist',
    fullName: 'Lễ Tân Tiếp Đón Trần Thị B (Q1)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'RECEPTIONIST',
    accountStatus: 'ACTIVE',
  },
  {
    username: 'receptionist_dual',
    fullName: 'Lễ Tân Điều Phối (Q7 & Bình Thạnh)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'RECEPTIONIST',
    accountStatus: 'ACTIVE',
    multiBranch: true,
  },

  // 5. Grooming & Spa (CARE_STAFF_GROOMER) - ONLY TEXT
  {
    username: 'groomer',
    fullName: 'Nhân Viên Grooming Phạm Văn D (Q1)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'CARE_STAFF_GROOMER',
    accountStatus: 'ACTIVE',
  },
  {
    username: 'care_dual',
    fullName: 'Chuyên Viên Spa Luân Phiên (Q1 & Bình Thạnh)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'CARE_STAFF_GROOMER',
    accountStatus: 'ACTIVE',
    multiBranch: true,
  },
  {
    username: 'care_master',
    fullName: 'Master Groomer Trưởng Nhóm (3 Chi Nhánh)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'CARE_STAFF_GROOMER',
    accountStatus: 'ACTIVE',
    allBranches: true,
  },

  // 6. Y Tá & Điều Dưỡng (NURSE) - ONLY TEXT
  {
    username: 'nurse',
    fullName: 'Y Tá Thú Y Hoàng Thị E (Q1)',
    password: 'K9#mQ$8xL!2vW*7z',
    systemRole: 'STAFF',
    staffSubRole: 'NURSE',
    accountStatus: 'ACTIVE',
  },

  // 7. Khách Hàng (CUSTOMER) - Giữ SĐT / Email thực tế để nhận OTP & Hóa đơn
  {
    username: 'customer',
    phone: '0905555555',
    fullName: 'Khách Hàng Lê Văn C',
    email: 'customer.levanc@gmail.com',
    password: 'cT6$vM2!pL9#zR8&',
    systemRole: 'CUSTOMER',
    accountStatus: 'ACTIVE',
  },
  {
    username: 'pending_user',
    phone: '0907777777',
    fullName: 'Khách Hàng Chưa Kích Hoạt',
    email: 'pending.user@gmail.com',
    password: 'pU3#zK8!vQ5$mY2@',
    systemRole: 'CUSTOMER',
    accountStatus: 'PENDING_ACTIVATION',
  },
  {
    username: 'blocked_user',
    phone: '0906666666',
    fullName: 'Khách Hàng Bị Khóa',
    email: 'blocked.user@gmail.com',
    password: 'bL9$rM2#vK4!zQ7@',
    systemRole: 'CUSTOMER',
    accountStatus: 'BLOCKED',
  },
];

export const seedDemoUsers = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    logger.info('Connected to MongoDB for demo users seeding');

    // Dynamically resolve branches from DB
    const branches = await Branch.find({ status: 'ACTIVE' }).limit(3);
    const branch1Id = branches[0]?._id || (await Branch.findOne({ code: 'BR-000001' }))?._id || new mongoose.Types.ObjectId('6ad08e4417bf41f5954234c3');
    const branch2Id = branches[1]?._id || (await Branch.findOne({ code: 'BR-000002' }))?._id || branch1Id;
    const branch3Id = branches[2]?._id || (await Branch.findOne({ code: 'BR-000003' }))?._id || branch1Id;
    const allBranchIds = branches.length > 0 ? branches.map((b) => b._id) : [branch1Id, branch2Id, branch3Id];
    console.log(`[DEMO_USERS] Active branches: ${allBranchIds.length} cơ sở (Q1, Q7, Bình Thạnh)`);

    const salt = await bcrypt.genSalt(12);

    for (const acc of DEMO_ACCOUNTS) {
      let targetBranchIds = [];
      if (acc.allBranches) {
        targetBranchIds = allBranchIds;
      } else if (acc.multiBranch) {
        targetBranchIds = [branch1Id, branch2Id];
      } else if (['MANAGER', 'STAFF'].includes(acc.systemRole)) {
        targetBranchIds = [branch1Id];
      }

      let userRecord;
      const existing = await User.findOne({
        $or: [
          ...(acc.phone ? [{ phone: acc.phone }] : []),
          ...(acc.username ? [{ username: acc.username }] : []),
          ...(acc.email ? [{ email: acc.email }] : []),
        ],
      });
      if (existing) {
        let isUpdated = false;
        const unsetFields = {};
        if (acc.username && existing.username !== acc.username) {
          existing.username = acc.username;
          isUpdated = true;
        }
        if (acc.staffSubRole && existing.staffSubRole !== acc.staffSubRole) {
          existing.staffSubRole = acc.staffSubRole;
          isUpdated = true;
        }
        if (acc.systemRole && existing.systemRole !== acc.systemRole) {
          existing.systemRole = acc.systemRole;
          isUpdated = true;
        }
        if (targetBranchIds.length > 0) {
          existing.assignedBranchIds = targetBranchIds;
          isUpdated = true;
        }
        // If acc has no phone/email (like only-text admin), unset phone & email from DB
        if (!acc.phone && existing.phone) {
          unsetFields.phone = 1;
          existing.phone = undefined;
          isUpdated = true;
        }
        if (!acc.email && existing.email) {
          unsetFields.email = 1;
          existing.email = undefined;
          isUpdated = true;
        }
        // Always sync passwordHash if password changed
        const isPasswordMatch = await bcrypt.compare(acc.password, existing.passwordHash);
        if (!isPasswordMatch) {
          existing.passwordHash = await bcrypt.hash(acc.password, salt);
          isUpdated = true;
        }
        if (isUpdated) {
          if (Object.keys(unsetFields).length > 0) {
            await User.updateOne({ _id: existing._id }, { $unset: unsetFields });
          }
          await existing.save();
          console.log(`[UPDATED] User ${existing.username || existing.phone} -> role: ${acc.systemRole}${acc.staffSubRole ? ':' + acc.staffSubRole : ''}`);
        } else {
          console.log(`[EXISTS] User: ${(existing.username || '-').padEnd(12)} | Phone: ${acc.phone || 'NONE (Only Text)'} (${acc.systemRole}${acc.staffSubRole ? ':' + acc.staffSubRole : ''})`);
        }
        userRecord = existing;
      } else {
        const passwordHash = await bcrypt.hash(acc.password, salt);
        userRecord = await User.create({
          username: acc.username || undefined,
          phone: acc.phone || undefined,
          fullName: acc.fullName,
          email: acc.email || undefined,
          passwordHash,
          systemRole: acc.systemRole,
          staffSubRole: acc.staffSubRole || null,
          assignedBranchIds: targetBranchIds,
          accountStatus: acc.accountStatus,
          activatedAt: acc.accountStatus === 'ACTIVE' ? new Date() : null,
        });

        console.log(`[CREATED] ${acc.systemRole.padEnd(8)} | User: ${(acc.username || '-').padEnd(12)} | Phone: ${acc.phone || 'NONE (Only Text)'} | ${acc.fullName}`);
      }

      // If user is STAFF, ensure StaffProfile and Shifts exist
      if (userRecord.systemRole === 'STAFF' && userRecord.staffSubRole) {
        let profile = await StaffProfile.findOne({ userId: userRecord._id });
        const branchIds = targetBranchIds.length > 0 ? targetBranchIds : [defaultBranchId];

        if (!profile) {
          profile = await StaffProfile.create({
            userId: userRecord._id,
            staffSubRole: userRecord.staffSubRole,
            authorizedBranchIds: branchIds,
            homeBranchId: branchIds[0],
            status: 'ACTIVE',
          });
          console.log(`  └─ [STAFF_PROFILE] Created profile for ${userRecord.username} (${userRecord.staffSubRole})`);
        } else {
          profile.authorizedBranchIds = branchIds;
          profile.homeBranchId = branchIds[0];
          profile.staffSubRole = userRecord.staffSubRole;
          profile.status = 'ACTIVE';
          await profile.save();
          console.log(`  └─ [STAFF_PROFILE] Updated profile for ${userRecord.username} (${userRecord.staffSubRole})`);
        }

        // Seed 7 sample shifts (08:00 - 17:00) starting today if none exist
        const shiftCount = await Shift.countDocuments({ staffId: profile._id });
        if (shiftCount === 0 && branchIds.length > 0) {
          const today = new Date();
          for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const shiftDate = new Date(today);
            shiftDate.setDate(today.getDate() + dayOffset);
            const dateStr = shiftDate.toISOString().split('T')[0];

            await Shift.create({
              staffId: profile._id,
              branchId: branchIds[dayOffset % branchIds.length],
              staffSubRole: userRecord.staffSubRole,
              startAt: new Date(`${dateStr}T08:00:00.000Z`),
              endAt: new Date(`${dateStr}T17:00:00.000Z`),
              status: 'ACTIVE',
            });
          }
          console.log(`  └─ [SHIFTS] Seeded 7 sample shifts (08:00-17:00) for ${userRecord.username}`);
        }
      }
    }

    console.log('\n========================================================================');
    console.log('           BẢNG TÀI KHOẢN DEMO ĐÃ CẬP NHẬT (MẬT KHẨU MẠNH THỰC TẾ)        ');
    console.log('========================================================================');
    console.log('| Username       | Role     | SubRole          | Mật khẩu (Password)    |');
    console.log('|----------------|----------|------------------|------------------------|');
    for (const acc of DEMO_ACCOUNTS) {
      console.log(
        `| ${acc.username.padEnd(14)} | ${acc.systemRole.padEnd(8)} | ${(acc.staffSubRole || '-').padEnd(16)} | ${acc.password.padEnd(22)} |`
      );
    }
    console.log('========================================================================\n');
    console.log('✅ Demo users seeded successfully!');
    return true;
  } catch (error) {
    logger.error('Failed to seed demo users:', error);
    console.error('Failed to seed demo users:', error.message);
    throw error;
  }
};

// If run directly via CLI
const isDirectCli = process.argv[1] && (process.argv[1].endsWith('demoUsersSeed.js') || process.argv[1].endsWith('demoUsersSeed'));
if (isDirectCli) {
  seedDemoUsers()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
