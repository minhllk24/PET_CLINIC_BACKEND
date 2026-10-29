/* eslint-disable no-console */
/**
 * PRODUCTION-GRADE REALISTIC UAT SEED SCRIPT
 * Chuỗi phòng khám & bệnh viện thú y Dr. Pet's House
 *
 * Chức năng:
 * 1. Clean up chọn lọc dữ liệu rác cũ (test products, invalid shifts, rogue categories).
 * 2. Thiết lập 3 chi nhánh thực tế & Cấu hình thương mại (Fulfillment Priority).
 * 3. Đội ngũ nhân sự đầy đủ 3 chi nhánh (Bác sĩ, Y tá, Lễ tân, Groomer) với ca trực thực tế (Sáng/Chiều, có ngày nghỉ).
 * 4. 4 Danh mục chuẩn hóa & 10 Sản phẩm thực tế có ảnh CDN Unsplash sắc nét + Tồn kho đầy đủ cả 3 chi nhánh.
 * 5. Đầy đủ các trường hợp:
 *    - Khách hàng có tài khoản (Customer Profile, Thú cưng Pet, Đơn hàng đa trạng thái, Lịch hẹn có ServiceRecord).
 *    - Khách vãng lai (Guest): Có Đơn hàng & Lịch hẹn nhưng KHÔNG CÓ TÀI KHOẢN (GuestContact: NO_ACCOUNT, PENDING_ACTIVATION).
 * 6. Vouchers khuyến mãi (9 mã demo bao phủ mọi scope).
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';

import Branch from '../modules/branch/models/Branch.js';
import SystemSetting from '../modules/settings/models/SystemSetting.js';
import User from '../models/User.js';
import Customer from '../modules/customer/models/Customer.js';
import GuestContact from '../modules/customer/models/GuestContact.js';
import Pet from '../modules/customer/models/Pet.js';
import StaffProfile from '../modules/staff/models/StaffProfile.js';
import Shift from '../modules/staff/models/Shift.js';
import Category from '../modules/catalog/models/Category.js';
import Product from '../modules/catalog/models/Product.js';
import Service from '../modules/catalog/models/Service.js';
import InventoryItem from '../modules/inventory/models/InventoryItem.js';
import InventoryStock from '../modules/inventory/models/InventoryStock.js';
import Order from '../modules/order/models/Order.js';
import Appointment from '../modules/booking/models/Appointment.js';
import ServiceRecord from '../modules/execution/models/ServiceRecord.js';
import { seedVouchers } from './voucherSeed.js';
import { seedServiceCatalog } from './serviceCatalogSeed.js';

export const runProductionUatSeed = async () => {
  console.log('\n========================================================================');
  console.log('🐾 [DR. PET\'S HOUSE] KHỞI CHẠY BỘ DỮ LIỆU THỰC TẾ (REALISTIC UAT SEED)');
  console.log(`   Database : ${config.mongoUri?.replace(/:([^@]+)@/, ':****@')}`);
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongoUri);
  }

  const salt = await bcrypt.genSalt(12);
  const commonPasswordHash = await bcrypt.hash('K9#mQ$8xL!2vW*7z', salt);

  // ========================================================================
  // BƯỚC 1: DỌN DẸP CHỌN LỌC DỮ LIỆU RÁC (IDEMPOTENT CLEAN-UP)
  // ========================================================================
  console.log('🧹 Bước 1: Dọn dẹp các sản phẩm test rác, ca làm việc cũ...');
  const deleteRes = await Product.deleteMany({
    $or: [
      { name: /test/i },
      { name: /thử nghiệm/i },
      { name: 'Product name' },
      { productCode: /SP-000555/i },
      { productCode: /SP-000888/i },
      { productCode: /SP-000999/i },
      { productCode: /PROD-BATH/i }
    ]
  });
  console.log(`   ✅ Đã dọn dẹp ${deleteRes.deletedCount} sản phẩm test rác.`);

  // Xóa ca làm việc cũ bị lặp full tuần
  await Shift.deleteMany({});
  console.log('   ✅ Đã làm mới ca làm việc (Shifts) để phân bổ ca thực tế.');

  // ========================================================================
  // BƯỚC 2: CHUẨN HÓA 3 CHI NHÁNH THỰC TẾ & COMMERCE SETTING
  // ========================================================================
  console.log('\n🏥 Bước 2: Thiết lập 3 chi nhánh thực tế & Cấu hình thương mại...');

  const standardOpeningHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    open: '08:00',
    close: '20:30'
  }));

  const BRANCH_DEFS = [
    {
      code: 'BR-000001',
      name: "Dr. Pet's House - Chi nhánh Quận 1",
      phone: '02838221111',
      address: 'Số 120 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
      openingHours: standardOpeningHours,
      status: 'ACTIVE'
    },
    {
      code: 'BR-000002',
      name: "Dr. Pet's House - Chi nhánh Quận 7",
      phone: '02837752222',
      address: 'Số 450 Nguyễn Thị Thập, Phường Tân Quy, Quận 7, TP. Hồ Chí Minh',
      openingHours: standardOpeningHours,
      status: 'ACTIVE'
    },
    {
      code: 'BR-000003',
      name: "Dr. Pet's House - Chi nhánh Bình Thạnh",
      phone: '02835113333',
      address: 'Số 85 Bạch Đằng, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh',
      openingHours: standardOpeningHours,
      status: 'ACTIVE'
    }
  ];

  const branchDocs = [];
  for (const bDef of BRANCH_DEFS) {
    const doc = await Branch.findOneAndUpdate(
      { code: bDef.code },
      { $set: bDef },
      { upsert: true, new: true }
    );
    branchDocs.push(doc);
    console.log(`   - Chi nhánh: ${doc.code} | ${doc.name} (${doc._id})`);
  }

  const [branch1, branch2, branch3] = branchDocs;
  const allBranchIds = [branch1._id, branch2._id, branch3._id];

  // Thiết lập Commerce Fulfillment Priority
  await SystemSetting.updateOne(
    { key: 'commerce' },
    {
      $set: {
        key: 'commerce',
        value: {
          fulfillmentBranchPriority: allBranchIds,
          freeShippingThreshold: 500000,
          standardShippingFee: 30000
        }
      }
    },
    { upsert: true }
  );
  console.log('   ✅ Đã cấu hình Commerce: Ưu tiên chi nhánh [Q1 -> Q7 -> Bình Thạnh], Freeship đơn >= 500k.');

  // ========================================================================
  // BƯỚC 3: ĐỘI NGŨ NHÂN SỰ ĐA CHI NHÁNH & PHÂN CA THỰC TẾ (100% ONLY TEXT CREDENTIALS)
  // ========================================================================
  console.log('\n👨‍⚕️ Bước 3: Thiết lập đội ngũ nhân sự và phân ca làm việc thực tế...');

  const STAFF_USERS = [
    // 1. Quản trị tối cao (Global Scope - Toàn hệ thống)
    {
      username: 'admin',
      fullName: 'System Administrator (Quản Trị Tối Cao)',
      systemRole: 'ADMIN',
      accountStatus: 'ACTIVE',
      assignedBranchIds: allBranchIds,
      authorizedBranchIds: allBranchIds,
      isGlobal: true,
    },

    // 2. Ban Quản Lý (MANAGER) - Phủ Đơn chi nhánh, Đa chi nhánh và Toàn hệ thống
    {
      username: 'manager_q1',
      fullName: 'Quản Lý Nguyễn Quốc Tuấn (Trụ sở Q1)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch1._id],
      authorizedBranchIds: [branch1._id],
    },
    {
      username: 'manager_q7',
      fullName: 'Quản Lý Lê Thúy Hằng (Phú Mỹ Hưng Q7)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch2._id],
      authorizedBranchIds: [branch2._id],
    },
    {
      username: 'manager_bt',
      fullName: 'Quản Lý Hoàng Đình Trọng (Bình Thạnh)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch3._id],
      authorizedBranchIds: [branch3._id],
    },
    {
      username: 'manager_dual',
      fullName: 'Quản Lý Điều Phối Phan Minh Triết (Q1 & Q7)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch1._id, branch2._id],
      authorizedBranchIds: [branch1._id, branch2._id],
    },
    {
      username: 'manager_dual_13',
      fullName: 'Quản Lý Điều Phối Đặng Gia Huy (Q1 & Bình Thạnh)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch1._id, branch3._id],
      authorizedBranchIds: [branch1._id, branch3._id],
    },
    {
      username: 'manager_dual_23',
      fullName: 'Quản Lý Điều Phối Vũ Diệu Linh (Q7 & Bình Thạnh)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch2._id, branch3._id],
      authorizedBranchIds: [branch2._id, branch3._id],
    },
    {
      username: 'manager_general',
      fullName: 'Tổng Quản Lý Điều Hành Trần Quốc Toản (3 Chi Nhánh)',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: allBranchIds,
      authorizedBranchIds: allBranchIds,
    },

    // 3. Bác Sĩ Thú Y (VETERINARIAN) - Phủ Đơn chi nhánh, Đa chi nhánh và Hội Chẩn Toàn Chuỗi
    {
      username: 'vet_q1',
      fullName: 'BS. Nguyễn Văn An (Trụ sở Q1)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch1._id],
      shifts: [1, 2, 4, 5, 7], // Làm thứ 2, 3, 5, 6, CN (nghỉ thứ 4, thứ 7)
      legacyAliases: ['doctor.an'],
    },
    {
      username: 'vet_q7',
      fullName: 'BS. Lê Hoàng Nam (Phú Mỹ Hưng Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch2._id],
      shifts: [2, 3, 4, 6, 7],
      legacyAliases: ['doctor.nam'],
    },
    {
      username: 'vet_bt',
      fullName: 'BS. Trần Phương Thảo (Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch3._id],
      shifts: [1, 3, 5, 6, 7],
      legacyAliases: ['doctor.thao'],
    },
    {
      username: 'vet_dual',
      fullName: 'BS. Phạm Minh Khôi (Trực luân phiên Q1 & Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [1, 2, 3, 5, 6],
    },
    {
      username: 'vet_dual_13',
      fullName: 'BS. Đỗ Tuấn Hưng (Trực luân phiên Q1 & Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch1._id, branch3._id],
      shifts: [1, 3, 4, 6, 7],
    },
    {
      username: 'vet_dual_23',
      fullName: 'BS. Vũ Bảo Long (Trực luân phiên Q7 & Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch2._id, branch3._id],
      shifts: [2, 3, 4, 5, 7],
    },
    {
      username: 'vet_master',
      fullName: 'BS CKII. Trịnh Văn Thành (Bác Sĩ Trưởng Hội Chẩn 3 Chi Nhánh)',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 3, 4, 5],
    },

    // 4. Chăm Sóc & Spa / Grooming (CARE_STAFF_GROOMER) - Phủ Đơn, Đa chi nhánh và Master Spa
    {
      username: 'care_q1',
      fullName: 'Groomer Phạm Quốc Đạt (Trụ sở Q1)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch1._id],
      shifts: [2, 3, 4, 6, 7],
      legacyAliases: ['groomer.dat'],
    },
    {
      username: 'care_q7',
      fullName: 'Groomer Đỗ Gia Huy (Phú Mỹ Hưng Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch2._id],
      shifts: [1, 3, 4, 5, 6],
      legacyAliases: ['groomer.huy'],
    },
    {
      username: 'care_bt',
      fullName: 'Groomer Lê Anh Tuấn (Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch3._id],
      shifts: [1, 2, 4, 6, 7],
      legacyAliases: ['groomer.tuan'],
    },
    {
      username: 'care_dual',
      fullName: 'Chuyên Viên Spa Nguyễn Mai Ly (Q1 & Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch1._id, branch3._id],
      shifts: [1, 2, 4, 5, 7],
    },
    {
      username: 'care_dual_12',
      fullName: 'Chuyên Viên Spa Võ Hoàng Yến (Q1 & Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [2, 3, 5, 6, 7],
    },
    {
      username: 'care_dual_23',
      fullName: 'Chuyên Viên Spa Bùi Tiến Dũng (Q7 & Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch2._id, branch3._id],
      shifts: [1, 3, 4, 5, 6],
    },
    {
      username: 'care_master',
      fullName: 'Master Groomer Trương Thùy Dung (Trưởng Nhóm Spa 3 Cơ Sở)',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 3, 5, 6],
    },

    // 5. Lễ Tân & Tiếp Đón (RECEPTIONIST) - Phủ Đơn, Đa chi nhánh và Trưởng Lễ Tân CSKH
    {
      username: 'receptionist_q1',
      fullName: 'Lễ Tân Trần Thị Bích (Trụ sở Q1)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1._id],
      shifts: [1, 3, 4, 5, 6],
      legacyAliases: ['reception.bich'],
    },
    {
      username: 'receptionist_q7',
      fullName: 'Lễ Tân Ngô Minh Khang (Phú Mỹ Hưng Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch2._id],
      shifts: [1, 2, 3, 5, 7],
      legacyAliases: ['reception.khang'],
    },
    {
      username: 'receptionist_bt',
      fullName: 'Lễ Tân Nguyễn Hải Yến (Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch3._id],
      shifts: [2, 3, 4, 5, 7],
      legacyAliases: ['reception.yen'],
    },
    {
      username: 'receptionist_dual',
      fullName: 'Lễ Tân Phạm Ngọc Ánh (Q7 & Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch2._id, branch3._id],
      shifts: [1, 2, 4, 5, 6],
    },
    {
      username: 'receptionist_dual_12',
      fullName: 'Lễ Tân Đinh Thanh Hà (Q1 & Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [1, 3, 4, 6, 7],
    },
    {
      username: 'receptionist_dual_13',
      fullName: 'Lễ Tân Lương Thu Trang (Q1 & Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1._id, branch3._id],
      shifts: [2, 3, 5, 6, 7],
    },
    {
      username: 'receptionist_master',
      fullName: 'Trưởng Nhóm Lễ Tân CSKH Vũ Ngọc Hân (Toàn Chuỗi)',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 4, 5, 7],
    },

    // 6. Y Tá & Điều Dưỡng (NURSE) - Phủ Đơn, Đa chi nhánh và Điều Dưỡng Trưởng
    {
      username: 'nurse_q1',
      fullName: 'Y Tá Hoàng Thị Mai (Trụ sở Q1)',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch1._id],
      shifts: [1, 2, 3, 5, 6],
      legacyAliases: ['nurse.mai'],
    },
    {
      username: 'nurse_q7',
      fullName: 'Y Tá Vũ Thu Trang (Phú Mỹ Hưng Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch2._id],
      shifts: [1, 2, 4, 5, 6],
      legacyAliases: ['nurse.trang'],
    },
    {
      username: 'nurse_bt',
      fullName: 'Y Tá Đặng Hồng Phúc (Bình Thạnh)',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch3._id],
      shifts: [1, 2, 3, 4, 6],
      legacyAliases: ['nurse.phuc'],
    },
    {
      username: 'nurse_dual',
      fullName: 'Y Tá Điều Dưỡng Lâm Thanh Tùng (Q1 & Q7)',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [1, 3, 5, 6, 7],
    },
    {
      username: 'nurse_master',
      fullName: 'Điều Dưỡng Trưởng Nguyễn Thanh Phương (Toàn Chuỗi)',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 3, 4, 6],
    },
  ];

  const today = new Date();
  let totalShiftsCreated = 0;
  const staffProfileMap = new Map();

  for (const sUser of STAFF_USERS) {
    const branchIds = sUser.assignedBranchIds || (sUser.branch ? [sUser.branch._id] : allBranchIds);

    const userDoc = await User.findOneAndUpdate(
      { username: sUser.username },
      {
        $set: {
          username: sUser.username,
          fullName: sUser.fullName,
          passwordHash: commonPasswordHash,
          systemRole: sUser.systemRole,
          staffSubRole: sUser.staffSubRole || null,
          assignedBranchIds: branchIds,
          accountStatus: 'ACTIVE',
          activatedAt: new Date()
        },
        $unset: { phone: 1, email: 1 } // Đảm bảo ONLY TEXT: Không yêu cầu SĐT / Email cho nhân sự nội bộ
      },
      { upsert: true, new: true }
    );

    // Đồng bộ legacy alias (nếu có) để tương thích 100% với các test/code cũ
    if (Array.isArray(sUser.legacyAliases)) {
      for (const aliasUsername of sUser.legacyAliases) {
        await User.findOneAndUpdate(
          { username: aliasUsername },
          {
            $set: {
              username: aliasUsername,
              fullName: sUser.fullName,
              passwordHash: commonPasswordHash,
              systemRole: sUser.systemRole,
              staffSubRole: sUser.staffSubRole || null,
              assignedBranchIds: branchIds,
              accountStatus: 'ACTIVE',
              activatedAt: new Date()
            },
            $unset: { phone: 1, email: 1 }
          },
          { upsert: true }
        );
      }
    }

    if (sUser.systemRole === 'STAFF') {
      const profile = await StaffProfile.findOneAndUpdate(
        { userId: userDoc._id },
        {
          $set: {
            userId: userDoc._id,
            staffSubRole: sUser.staffSubRole,
            authorizedBranchIds: branchIds,
            homeBranchId: branchIds[0],
            status: 'ACTIVE'
          }
        },
        { upsert: true, new: true }
      );
      staffProfileMap.set(sUser.username, profile);
      if (Array.isArray(sUser.legacyAliases)) {
        for (const alias of sUser.legacyAliases) {
          staffProfileMap.set(alias, profile);
        }
      }

      // Phân bổ ca làm thực tế trong 7 ngày tới với Anti-Overlap Rule:
      // - Ca Sáng: 08:00 - 14:00, Ca Chiều: 14:00 - 20:00
      // - Với nhân viên đa chi nhánh: luân phiên các chi nhánh được ủy quyền, tuyệt đối không trùng giờ
      if (Array.isArray(sUser.shifts)) {
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const shiftDate = new Date(today);
          shiftDate.setDate(today.getDate() + dayOffset);
          const dayOfWeek = shiftDate.getDay() === 0 ? 7 : shiftDate.getDay(); // 1 (Mon) -> 7 (Sun)

          if (sUser.shifts.includes(dayOfWeek)) {
            const dateStr = shiftDate.toISOString().split('T')[0];
            const isMorning = (dayOffset % 2 === 0);
            const startHour = isMorning ? '08:00:00' : '14:00:00';
            const endHour = isMorning ? '14:00:00' : '20:00:00';

            // Phân bổ branch luân phiên từ authorizedBranchIds mà không trùng giờ
            const targetBranchId = branchIds[dayOffset % branchIds.length];

            await Shift.create({
              staffId: profile._id,
              branchId: targetBranchId,
              staffSubRole: sUser.staffSubRole,
              startAt: new Date(`${dateStr}T${startHour}.000Z`),
              endAt: new Date(`${dateStr}T${endHour}.000Z`),
              status: 'ACTIVE'
            });
            totalShiftsCreated++;
          }
        }
      }
    }
  }
  console.log(`   ✅ Đã tạo ${STAFF_USERS.length} tài khoản nhân sự (100% ONLY TEXT) & ${totalShiftsCreated} ca trực thực tế (ANTI-OVERLAP).`);

  // ========================================================================
  // BƯỚC 4: DANH MỤC & SẢN PHẨM E-COMMERCE CHUẨN ĐẸP CÓ ẢNH CDN
  // ========================================================================
  console.log('\n📦 Bước 4: Thiết lập 4 danh mục chuẩn & 10 sản phẩm thương mại có hình ảnh CDN...');

  const CORE_CATEGORIES = [
    { name: 'Thức ăn & Dinh dưỡng', slug: 'thuc-an-dinh-duong', status: 'ACTIVE' },
    { name: 'Vệ sinh & Khử mùi', slug: 'cham-soc-ve-sinh', status: 'ACTIVE' },
    { name: 'Y tế & Chăm sóc sức khỏe', slug: 'y-te-thuoc', status: 'ACTIVE' },
    { name: 'Phụ kiện & Đồ chơi thú cưng', slug: 'phu-kien-do-choi', status: 'ACTIVE' }
  ];

  const categoryMap = new Map();
  for (const cat of CORE_CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { slug: cat.slug },
      { $set: cat },
      { upsert: true, new: true }
    );
    categoryMap.set(cat.slug, doc._id);
  }

  const REALISTIC_PRODUCTS = [
    {
      code: 'SP-RC-MINI-001',
      name: 'Thức ăn hạt cao cấp cho chó nhỏ Royal Canin Mini Adult',
      categorySlug: 'thuc-an-dinh-duong',
      origin: 'Pháp',
      productType: 'VARIANT',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&q=80', isPrimary: true },
        { id: 'img-2', url: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=600&q=80', isPrimary: false }
      ],
      description: 'Hỗ trợ duy trì cân nặng lý tưởng, tăng cường sức khỏe da lông và hệ tiêu hóa cho giống chó nhỏ từ 10 tháng đến 8 tuổi.',
      variants: [
        { label: 'Túi 2kg', price: 340000, discountPercent: 5 },
        { label: 'Túi 8kg', price: 1150000, discountPercent: 10 }
      ]
    },
    {
      code: 'SP-WHISKAS-002',
      name: 'Pate thơm ngon cho mèo Whiskas vị cá thu và cá hồi biển',
      categorySlug: 'thuc-an-dinh-duong',
      origin: 'Thái Lan',
      productType: 'VARIANT',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&q=80', isPrimary: true },
        { id: 'img-2', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&q=80', isPrimary: false }
      ],
      description: 'Bổ sung Omega 3, 6 và kẽm giúp lông bóng mượt, cung cấp đủ độ ẩm phòng ngừa sỏi thận cho mèo.',
      variants: [
        { label: 'Gói 85g', price: 18000, discountPercent: 0 },
        { label: 'Hộp 12 gói (85g)', price: 200000, discountPercent: 8 }
      ]
    },
    {
      code: 'SP-CATURE-003',
      name: 'Cát đậu nành hữu cơ xả bồn cầu Cature Tofu Clumping Litter',
      categorySlug: 'cham-soc-ve-sinh',
      origin: 'Mỹ',
      productType: 'SIMPLE',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&q=80', isPrimary: true }
      ],
      description: 'Vón hút nhanh chóng sau 3 giây, 99.5% không bụi, khử mùi tự nhiên 100% phân hủy sinh học có thể xả bồn cầu.',
      variants: [
        { label: 'Túi 6L (2.4kg)', price: 135000, discountPercent: 0 }
      ]
    },
    {
      code: 'SP-BRAVECTO-004',
      name: 'Viên nhai đặc trị ve rận, bọ chét và ghẻ demodex Bravecto Chewable',
      categorySlug: 'y-te-thuoc',
      origin: 'Áo',
      productType: 'VARIANT',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80', isPrimary: true }
      ],
      description: 'Hiệu quả bảo vệ vượt trội kéo dài 12 tuần chỉ với 1 viên duy nhất, an toàn cho chó mang thai và cho con bú.',
      variants: [
        { label: 'Cho chó 4.5 - 10kg', price: 650000, discountPercent: 0 },
        { label: 'Cho chó 10 - 20kg', price: 720000, discountPercent: 0 }
      ]
    },
    {
      code: 'SP-SOS-SHAMPOO-005',
      name: 'Sữa tắm thảo dược dưỡng lông mềm mượt SOS dành cho thú cưng',
      categorySlug: 'cham-soc-ve-sinh',
      origin: 'Đài Loan',
      productType: 'VARIANT',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1527526029430-319f10814151?w=600&q=80', isPrimary: true }
      ],
      description: 'Chiết xuất từ thiên nhiên giúp diệt khuẩn, lưu hương thơm dễ chịu tới 10 ngày, khử sạch mùi hôi cơ thể thú cưng.',
      variants: [
        { label: 'Chai SOS Xanh dương (Sáng lông)', price: 110000, discountPercent: 0 },
        { label: 'Chai SOS Nâu đỏ (Dưỡng màu lông)', price: 110000, discountPercent: 0 }
      ]
    },
    {
      code: 'SP-KONG-TOY-006',
      name: 'Đồ chơi gặm cao su tự nhiên siêu bền KONG Classic Dog Toy',
      categorySlug: 'phu-kien-do-choi',
      origin: 'Mỹ',
      productType: 'SIMPLE',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=600&q=80', isPrimary: true }
      ],
      description: 'Kích thích vận động trí não, chống cắn phá đồ đạc trong nhà, có thể nhồi hạt hoặc bơ đậu phộng vào bên trong.',
      variants: [
        { label: 'Size M (Cho chó 7 - 16kg)', price: 215000, discountPercent: 5 }
      ]
    },
    {
      code: 'SP-ALFALFA-007',
      name: 'Cỏ khô Alfalfa tự nhiên giàu đạm và canxi cho Thỏ & Bọ Ú',
      categorySlug: 'thuc-an-dinh-duong',
      origin: 'Úc',
      productType: 'SIMPLE',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&q=80', isPrimary: true }
      ],
      description: 'Cỏ khô xanh thơm, chứa hàm lượng chất xơ cao hỗ trợ mài răng và kích thích tiêu hóa khỏe mạnh.',
      variants: [
        { label: 'Gói 500g', price: 95000, discountPercent: 0 }
      ]
    },
    {
      code: 'SP-RIO-BIRD-008',
      name: 'Hạt dinh dưỡng hỗn hợp đa hạt phong phú cho Vẹt & Chim cảnh Rio',
      categorySlug: 'thuc-an-dinh-duong',
      origin: 'Đức',
      productType: 'SIMPLE',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600&q=80', isPrimary: true }
      ],
      description: 'Tập hợp các loại hạt ngũ cốc, hạt kê và khoáng chất cần thiết giúp chim cảnh hót hay, mượt lông.',
      variants: [
        { label: 'Hộp 500g', price: 88000, discountPercent: 0 }
      ]
    },
    {
      code: 'SP-GIMCAT-009',
      name: 'Gel dinh dưỡng bổ sung 12 loại Vitamin thiết yếu cho Mèo GimCat Paste',
      categorySlug: 'y-te-thuoc',
      origin: 'Đức',
      productType: 'SIMPLE',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&q=80', isPrimary: true }
      ],
      description: 'Tăng cường hệ miễn dịch tự nhiên, bồi bổ cho mèo biếng ăn, ốm dậy hoặc mèo con đang phát triển.',
      variants: [
        { label: 'Tuýp 50g', price: 165000, discountPercent: 0 }
      ]
    },
    {
      code: 'SP-PETBED-010',
      name: 'Nệm tròn lông vũ êm ái chống lạnh chống trượt cho Chó Mèo',
      categorySlug: 'phu-kien-do-choi',
      origin: 'Việt Nam',
      productType: 'VARIANT',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600&q=80', isPrimary: true }
      ],
      description: 'Chất liệu bông PP mềm mại, nâng niu giấc ngủ cho thú cưng, đáy chống thấm nước và chống xê dịch.',
      variants: [
        { label: 'Size S (Dưới 5kg)', price: 190000, discountPercent: 0 },
        { label: 'Size L (Dưới 15kg)', price: 290000, discountPercent: 10 }
      ]
    }
  ];

  const seededProducts = [];
  for (const p of REALISTIC_PRODUCTS) {
    const catId = categoryMap.get(p.categorySlug);

    // Chuẩn bị biến thể và InventoryItem
    const formattedVariants = [];
    let seq = 1;

    for (const v of p.variants) {
      const sku = `${p.code}-${String(seq).padStart(2, '0')}`;
      const finalPrice = Math.round(v.price * (1 - (v.discountPercent || 0) / 100));

      // Tạo InventoryItem tương ứng
      const invItem = await InventoryItem.findOneAndUpdate(
        { sku },
        {
          $set: {
            sku,
            name: `${p.name} (${v.label})`,
            category: p.categorySlug,
            unit: 'Cái',
            status: 'ACTIVE'
          }
        },
        { upsert: true, new: true }
      );

      // Cấp tồn kho cho cả 3 chi nhánh
      for (const br of branchDocs) {
        const qty = br.code === 'BR-000001' ? 120 : (br.code === 'BR-000002' ? 60 : 40);
        await InventoryStock.findOneAndUpdate(
          { branchId: br._id, inventoryItemId: invItem._id },
          {
            $set: {
              branchId: br._id,
              inventoryItemId: invItem._id,
              quantity: qty,
              threshold: 10
            }
          },
          { upsert: true }
        );
      }

      formattedVariants.push({
        sku,
        label: v.label,
        price: v.price,
        discountPercent: v.discountPercent || 0,
        finalPrice,
        inventoryItemId: invItem._id,
        status: 'ACTIVE'
      });
      seq++;
    }

    const prodDoc = await Product.findOneAndUpdate(
      { productCode: p.code },
      {
        $set: {
          productCode: p.code,
          name: p.name,
          categoryId: catId,
          productType: p.productType,
          usageType: 'SALE',
          status: 'ACTIVE',
          origin: p.origin,
          description: p.description,
          images: p.images,
          variants: formattedVariants
        }
      },
      { upsert: true, new: true }
    );
    seededProducts.push(prodDoc);
    console.log(`   - [SẢN PHẨM] ${p.code} | ${p.name.slice(0, 38)}... (Ảnh CDN: ${p.images.length})`);
  }

  // ========================================================================
  // BƯỚC 5: KHÁCH HÀNG CÓ TÀI KHOẢN (REGISTERED CUSTOMER, PETS & TRANSACTIONS)
  // ========================================================================
  console.log('\n👤 Bước 5: Thiết lập Khách hàng thành viên, Thú cưng & Đơn hàng mẫu...');

  const custUser = await User.findOneAndUpdate(
    { username: 'customer' },
    {
      $set: {
        username: 'customer',
        fullName: 'Lê Văn Cường',
        phone: '0905555555',
        email: 'customer.levanc@gmail.com',
        passwordHash: commonPasswordHash,
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        activatedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  const customerProfile = await Customer.findOneAndUpdate(
    { userId: custUser._id },
    {
      $set: {
        userId: custUser._id,
        contactPhone: custUser.phone,
        contactEmail: custUser.email,
        activationStatus: 'ACTIVATED',
        accountStatus: 'ACTIVE',
        activityBranchIds: [branch1._id, branch2._id]
      }
    },
    { upsert: true, new: true }
  );

  // Tạo Thú cưng liên kết
  const petBuddy = await Pet.findOneAndUpdate(
    { customerId: customerProfile._id, name: 'Buddy' },
    {
      $set: {
        customerId: customerProfile._id,
        name: 'Buddy',
        species: 'DOG',
        breed: 'Golden Retriever',
        gender: 'MALE',
        ageYears: 3,
        weightKg: 28,
        medicalNotes: 'Tiêm phòng đầy đủ, lông dày, không dị ứng thuốc.'
      }
    },
    { upsert: true, new: true }
  );

  const petLuna = await Pet.findOneAndUpdate(
    { customerId: customerProfile._id, name: 'Luna' },
    {
      $set: {
        customerId: customerProfile._id,
        name: 'Luna',
        species: 'CAT',
        breed: 'Mèo Anh lông ngắn',
        gender: 'FEMALE',
        ageYears: 2,
        weightKg: 4.2,
        medicalNotes: 'Đã triệt sản, tiền sử sỏi thận nhẹ đã chữa khỏi.'
      }
    },
    { upsert: true, new: true }
  );
  console.log(`   ✅ Đã liên kết tài khoản Khách hàng ${custUser.fullName} và 2 thú cưng (Buddy, Luna).`);

  // Đơn hàng của Khách có tài khoản (Bao phủ các trạng thái)
  const orderProduct1 = seededProducts[0]; // Royal Canin
  const orderProduct2 = seededProducts[1]; // Whiskas

  const CUST_ORDERS = [
    {
      code: 'ORD-CUST-COMPLETED-01',
      status: 'COMPLETED',
      paymentMethod: 'ONLINE_MOCK',
      deliveredAt: new Date(Date.now() - 3600000 * 24 * 2)
    },
    {
      code: 'ORD-CUST-SHIPPED-02',
      status: 'SHIPPED',
      paymentMethod: 'COD',
      deliveredAt: null
    },
    {
      code: 'ORD-CUST-PROCESSING-03',
      status: 'PROCESSING',
      paymentMethod: 'ONLINE_MOCK',
      deliveredAt: null
    },
    {
      code: 'ORD-CUST-CANCELLED-04',
      status: 'CANCELLED',
      paymentMethod: 'COD',
      deliveredAt: null
    }
  ];

  for (const o of CUST_ORDERS) {
    await Order.findOneAndUpdate(
      { code: o.code },
      {
        $set: {
          code: o.code,
          customerId: customerProfile._id,
          fulfillmentBranchId: branch1._id,
          status: o.status,
          paymentMethod: o.paymentMethod,
          payment: { status: o.status === 'CANCELLED' ? 'CANCELLED' : (o.paymentMethod === 'ONLINE_MOCK' ? 'PAID' : 'PENDING') },
          contactSnapshot: {
            fullName: custUser.fullName,
            phone: custUser.phone,
            email: custUser.email
          },
          shippingAddress: {
            province: 'Thành phố Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường Bến Nghé',
            detail: 'Số 45 Lê Duẩn'
          },
          items: [
            {
              orderItemId: 'item-1',
              productId: orderProduct1._id,
              variantId: orderProduct1.variants[0]._id,
              nameSnapshot: `${orderProduct1.name} (${orderProduct1.variants[0].label})`,
              skuSnapshot: orderProduct1.variants[0].sku,
              unitPrice: orderProduct1.variants[0].price,
              quantity: 1,
              lineSubtotal: orderProduct1.variants[0].price,
              lineNet: orderProduct1.variants[0].finalPrice,
              allocatedDiscount: orderProduct1.variants[0].price - orderProduct1.variants[0].finalPrice
            }
          ],
          pricing: {
            merchandiseSubtotal: orderProduct1.variants[0].price,
            voucherDiscount: 0,
            shippingFee: 30000,
            totalAmount: orderProduct1.variants[0].finalPrice + 30000
          },
          deliveredAt: o.deliveredAt
        }
      },
      { upsert: true }
    );
  }
  console.log(`   ✅ Đã tạo ${CUST_ORDERS.length} đơn hàng mẫu cho Khách có tài khoản (COMPLETED, SHIPPED, PROCESSING, CANCELLED).`);

  // ========================================================================
  // BƯỚC 6: KHÁCH VÃNG LAI (GUEST KHÔNG CÓ TÀI KHOẢN NHƯNG CÓ ĐƠN & LỊCH HẸN)
  // ========================================================================
  console.log('\n🚶 Bước 6: Thiết lập các trường hợp Khách vãng lai (Guest KHÔNG CÓ TÀI KHOẢN)...');

  // 1. Guest A: Đặt đơn hàng mua cát và pate nhưng không tạo tài khoản
  const guestA = await GuestContact.findOneAndUpdate(
    { phone: '0981112233' },
    {
      $set: {
        phone: '0981112233',
        fullName: 'Nguyễn Thị Hồng (Khách vãng lai)',
        email: 'guest.hong@gmail.com',
        activationStatus: 'NO_ACCOUNT', // Hoàn toàn chưa có tài khoản User / Customer!
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  await Order.findOneAndUpdate(
    { code: 'ORD-GUEST-HOT-01' },
    {
      $set: {
        code: 'ORD-GUEST-HOT-01',
        customerId: null, // Đơn hàng của Guest: customerId là null!
        guestContactId: guestA._id,
        fulfillmentBranchId: branch1._id,
        status: 'COMPLETED',
        paymentMethod: 'COD',
        payment: { status: 'PAID' },
        contactSnapshot: {
          fullName: guestA.fullName,
          phone: guestA.phone,
          email: guestA.email
        },
        shippingAddress: {
          province: 'Thành phố Hồ Chí Minh',
          district: 'Quận 3',
          ward: 'Phường Võ Thị Sáu',
          detail: 'Hẻm 280 Cách Mạng Tháng 8'
        },
        items: [
          {
            orderItemId: 'item-guest-1',
            productId: orderProduct2._id,
            variantId: orderProduct2.variants[0]._id,
            nameSnapshot: `${orderProduct2.name} (${orderProduct2.variants[0].label})`,
            skuSnapshot: orderProduct2.variants[0].sku,
            unitPrice: orderProduct2.variants[0].price,
            quantity: 5,
            lineSubtotal: orderProduct2.variants[0].price * 5,
            lineNet: orderProduct2.variants[0].finalPrice * 5,
            allocatedDiscount: 0
          }
        ],
        pricing: {
          merchandiseSubtotal: orderProduct2.variants[0].price * 5,
          voucherDiscount: 0,
          shippingFee: 30000,
          totalAmount: orderProduct2.variants[0].finalPrice * 5 + 30000
        },
        deliveredAt: new Date(Date.now() - 3600000 * 12)
      }
    },
    { upsert: true }
  );
  console.log(`   ✅ [GUEST ĐƠN HÀNG] Đã tạo đơn ${'ORD-GUEST-HOT-01'} cho ${guestA.fullName} (KHÔNG CÓ TÀI KHOẢN).`);

  // 2. Guest B: Đặt lịch hẹn khám thú cưng tại phòng khám nhưng chưa đăng ký tài khoản
  const guestB = await GuestContact.findOneAndUpdate(
    { phone: '0978889900' },
    {
      $set: {
        phone: '0978889900',
        fullName: 'Phạm Hoàng Long (Khách vãng lai)',
        email: 'guest.long@gmail.com',
        activationStatus: 'NO_ACCOUNT', // Không có tài khoản!
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  // Đảm bảo Service Catalog (12 dịch vụ Y tế & Spa) được nạp
  await seedServiceCatalog();
  const medicalService = (await Service.findOne({ serviceType: 'MEDICAL' })) || (await Service.findOne());
  const groomingService = (await Service.findOne({ serviceType: 'GROOMING' })) || (await Service.findOne());
  const doctorAnProfile = staffProfileMap.get('doctor.an');
  const groomerDatProfile = staffProfileMap.get('groomer.dat');

  // A. Lịch hẹn của Khách có tài khoản (Đã hoàn tất + Có Hồ sơ Bệnh án ServiceRecord)
  if (medicalService && doctorAnProfile) {
    const pastStart = new Date(Date.now() - 3600000 * 24 * 3); // 3 ngày trước
    const pastEnd = new Date(pastStart.getTime() + 3600000);

    const custApt = await Appointment.findOneAndUpdate(
      { code: 'APT-CUST-COMPLETED-01' },
      {
        $set: {
          code: 'APT-CUST-COMPLETED-01',
          customerId: customerProfile._id,
          petId: petBuddy._id,
          branchId: branch1._id,
          serviceType: 'MEDICAL',
          paymentMethod: 'PAY_AT_STORE',
          status: 'COMPLETED',
          scheduledStart: pastStart,
          scheduledEnd: pastEnd,
          scheduledDurationMinutes: 60,
          contactSnapshot: {
            fullName: custUser.fullName,
            phone: custUser.phone,
            email: custUser.email
          },
          petSnapshot: {
            name: petBuddy.name,
            species: petBuddy.species,
            breed: petBuddy.breed,
            weightKg: petBuddy.weightKg
          },
          services: [
            {
              serviceId: medicalService._id,
              serviceName: medicalService.name || 'Khám tổng quát & Kê đơn điều trị',
              serviceType: 'MEDICAL',
              unitPrice: 250000,
              durationMinutes: 60,
              requiredStaffRole: 'VETERINARIAN',
              sequence: 1,
              scheduledStart: pastStart,
              scheduledEnd: pastEnd,
              assignedStaffId: doctorAnProfile._id,
              executionStatus: 'COMPLETED'
            }
          ],
          pricing: {
            subtotal: 250000,
            voucherDiscount: 0,
            finalAmount: 250000,
            depositAmount: 75000,
            paidAmount: 250000,
            balanceAmount: 0
          }
        }
      },
      { upsert: true, new: true }
    );

    // Tạo Bệnh án ServiceRecord đã được Bác sĩ ký duyệt Finalize
    await ServiceRecord.findOneAndUpdate(
      { appointmentId: custApt._id },
      {
        $set: {
          appointmentId: custApt._id,
          petId: petBuddy._id,
          branchId: branch1._id,
          serviceIds: [medicalService._id],
          assignedStaffIds: [doctorAnProfile._id],
          reviewerStaffId: doctorAnProfile._id,
          recordType: 'MEDICAL',
          status: 'FINALIZED',
          actualStartAt: pastStart,
          actualEndAt: pastEnd,
          professional: {
            diagnosis: 'Viêm da dị ứng nhẹ vùng cổ, đã xử lý sát trùng và kê thuốc bôi.',
            treatmentPlan: 'Bôi dung dịch sát trùng Betadine 2 lần/ngày, uống vitamin dưỡng lông trong 7 ngày.'
          }
        }
      },
      { upsert: true }
    );
    console.log(`   ✅ [CUST LỊCH HẸN] Đã tạo lịch hẹn COMPLETED ${custApt.code} kèm Bệnh án ServiceRecord đã ký duyệt.`);
  }

  // B. Lịch hẹn của Khách vãng lai Guest B (CONFIRMED ngày mai, cọc 30%, KHÔNG CÓ TÀI KHOẢN)
  if (medicalService && doctorAnProfile) {
    const aptStart = new Date(Date.now() + 3600000 * 24); // Ngày mai
    const aptEnd = new Date(aptStart.getTime() + 3600000);

    const guestApt = await Appointment.findOneAndUpdate(
      { code: 'APT-GUEST-CLINIC-01' },
      {
        $set: {
          code: 'APT-GUEST-CLINIC-01',
          customerId: null, // Không có customerId!
          guestContactId: guestB._id,
          branchId: branch1._id,
          serviceType: 'MEDICAL',
          paymentMethod: 'PAY_AT_STORE',
          status: 'CONFIRMED',
          scheduledStart: aptStart,
          scheduledEnd: aptEnd,
          scheduledDurationMinutes: 60,
          contactSnapshot: {
            fullName: guestB.fullName,
            phone: guestB.phone,
            email: guestB.email
          },
          petSnapshot: {
            name: 'Miu Miu',
            species: 'CAT',
            breed: 'Mèo Ba Tư',
            weightKg: 3.5,
            ageYears: 1
          },
          services: [
            {
              serviceId: medicalService._id,
              serviceName: medicalService.name || 'Khám tổng quát & Tiêm vaccine',
              serviceType: 'MEDICAL',
              unitPrice: 200000,
              durationMinutes: 60,
              requiredStaffRole: 'VETERINARIAN',
              sequence: 1,
              scheduledStart: aptStart,
              scheduledEnd: aptEnd,
              assignedStaffId: doctorAnProfile._id,
              executionStatus: 'NOT_STARTED'
            }
          ],
          pricing: {
            subtotal: 200000,
            voucherDiscount: 0,
            finalAmount: 200000,
            depositAmount: 60000, // Cọc 30%
            paidAmount: 60000,
            balanceAmount: 140000
          }
        }
      },
      { upsert: true, new: true }
    );
    console.log(`   ✅ [GUEST LỊCH HẸN] Đã tạo lịch hẹn ${guestApt.code} cho ${guestB.fullName} (Mèo Miu Miu, Cọc 30%, KHÔNG CÓ TÀI KHOẢN).`);
  }

  // 3. Guest C: Khách vãng lai đã hoàn tất dịch vụ và đang nhận lời mời kích hoạt tài khoản
  await GuestContact.findOneAndUpdate(
    { phone: '0912345678' },
    {
      $set: {
        phone: '0912345678',
        fullName: 'Trần Minh Đức (Khách nhận mời kích hoạt)',
        email: 'guest.duc@gmail.com',
        activationStatus: 'PENDING_ACTIVATION', // Trạng thái chờ kích hoạt
        activationInviteSentAt: new Date(),
        activationToken: 'INVITE-ACT-778899',
        userId: null,
        customerId: null
      }
    },
    { upsert: true }
  );
  console.log(`   ✅ [GUEST KÍCH HOẠT] Đã tạo hồ sơ Guest PENDING_ACTIVATION (sẵn sàng test flow kích hoạt tài khoản).`);

  // ========================================================================
  // BƯỚC 7: NẠP VOUCHERS KHUYẾN MÃI DEMO
  // ========================================================================
  console.log('\n🎟️ Bước 7: Đồng bộ 9 mã Voucher khuyến mãi đa dạng...');
  await seedVouchers();

  // ========================================================================
  // BÁO CÁO TỔNG KẾT
  // ========================================================================
  const finalBranchCount = await Branch.countDocuments({ status: 'ACTIVE' });
  const finalStaffCount = await StaffProfile.countDocuments({ status: 'ACTIVE' });
  const finalShiftCount = await Shift.countDocuments({ status: 'ACTIVE' });
  const finalProductCount = await Product.countDocuments({ status: 'ACTIVE' });
  const finalOrderCount = await Order.countDocuments({});
  const finalAptCount = await Appointment.countDocuments({});

  console.log('\n========================================================================');
  console.log('🎉 TỔNG KẾT BỘ DỮ LIỆU THỰC TẾ (PRODUCTION UAT) ĐÃ HOÀN TẤT THÀNH CÔNG');
  console.log('========================================================================');
  console.log(`| Chi nhánh hoạt động (Branches)    : ${String(finalBranchCount).padEnd(4)} cơ sở (Q1, Q7, Bình Thạnh)`);
  console.log(`| Nhân sự chuyên môn (StaffProfiles): ${String(finalStaffCount).padEnd(4)} nhân sự (Đủ Bác sĩ, Y tá, Lễ tân, Groomer)`);
  console.log(`| Ca trực thực tế (Shifts)          : ${String(finalShiftCount).padEnd(4)} ca (Ca Sáng / Ca Chiều, có ngày nghỉ)`);
  console.log(`| Sản phẩm thương mại (Products)    : ${String(finalProductCount).padEnd(4)} sản phẩm (100% CÓ ẢNH CDN CHUẨN ĐẸP)`);
  console.log(`| Đơn hàng mẫu (Orders)             : ${String(finalOrderCount).padEnd(4)} đơn (Bao phủ cả Khách thành viên & Khách vãng lai)`);
  console.log(`| Lịch hẹn mẫu (Appointments)       : ${String(finalAptCount).padEnd(4)} lịch (Bao phủ cả Khách thành viên & Khách vãng lai)`);
  console.log('========================================================================\n');

  return true;
};

// Thực thi nếu gọi trực tiếp qua terminal
const isDirectCli = process.argv[1] && (process.argv[1].endsWith('productionUatSeed.js') || process.argv[1].endsWith('productionUatSeed'));
if (isDirectCli) {
  runProductionUatSeed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Lỗi khi chạy Production UAT Seed:', err);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
