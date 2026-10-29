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
import OrderReturn from '../modules/order/models/OrderReturn.js';
import OrderRefund from '../modules/order/models/OrderRefund.js';
import Appointment from '../modules/booking/models/Appointment.js';
import ServiceRecord from '../modules/execution/models/ServiceRecord.js';
import { seedVouchers } from './voucherSeed.js';
import { seedServiceCatalog } from './serviceCatalogSeed.js';
import { runMigrateLegacyProducts } from './migrateLegacyProducts.js';

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
  // BƯỚC 1: DỌN DẸP TRIỆT ĐỂ DỮ LIỆU RÁC (IDEMPOTENT CLEAN-UP)
  // ========================================================================
  console.log('🧹 Bước 1: Dọn dẹp triệt để các sản phẩm rác, danh mục cũ và ca làm việc...');

  const OFFICIAL_PRODUCT_CODES = [
    'SP-RC-MINI-001',
    'SP-WHISKAS-002',
    'SP-CATURE-003',
    'SP-BRAVECTO-004',
    'SP-SOS-SHAMPOO-005',
    'SP-KONG-TOY-006',
    'SP-ALFALFA-007',
    'SP-RIO-BIRD-008',
    'SP-GIMCAT-009',
    'SP-PETBED-010',
    'SP-LEASH-011',
    'SP-CATTOY-012'
  ];

  const OFFICIAL_CATEGORY_SLUGS = [
    'thuc-an',
    'do-dung-thiet-yeu',
    'cham-soc-suc-khoe',
    'do-choi',
    'phu-kien'
  ];

  // 1.1 Xóa tất cả các sản phẩm rác cũ (mã SP-000..., SP-UAT..., hoặc không thuộc danh sách 12 sản phẩm chuẩn & 100 sản phẩm di trú)
  const deleteRes = await Product.deleteMany({
    $or: [
      {
        productCode: {
          $nin: OFFICIAL_PRODUCT_CODES,
          $not: /^SP-LEG-/
        }
      },
      { name: /test/i },
      { name: /thử nghiệm/i },
      { name: 'Product name' },
      { productCode: /SP-000/i },
      { productCode: /SP-UAT-/i }
    ]
  });
  console.log(`   ✅ Đã dọn dẹp ${deleteRes.deletedCount} sản phẩm rác/không hợp lệ.`);

  // 1.2 Dọn dẹp InventoryItem cũ của các sản phẩm rác
  const deleteInvRes = await InventoryItem.deleteMany({
    $or: [
      { sku: { $regex: /^SP-(000|UAT)/i } },
      { name: /test/i }
    ]
  });
  console.log(`   ✅ Đã dọn dẹp ${deleteInvRes.deletedCount} tồn kho mặt hàng cũ.`);

  // 1.3 Dọn dẹp danh mục rác cũ ngoài 4 danh mục chuẩn
  const deleteCatRes = await Category.deleteMany({
    slug: { $nin: OFFICIAL_CATEGORY_SLUGS }
  });
  console.log(`   ✅ Đã dọn dẹp ${deleteCatRes.deletedCount} danh mục lộn xộn/rác cũ.`);

  // 1.4 Xóa ca làm việc cũ bị lặp full tuần
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
  console.log('\n📦 Bước 4: Thiết lập 5 danh mục chuẩn theo UI & các sản phẩm thương mại có hình ảnh CDN...');

  const CORE_CATEGORIES = [
    { name: 'Thức ăn', slug: 'thuc-an', status: 'ACTIVE' },
    { name: 'Đồ dùng thiết yếu', slug: 'do-dung-thiet-yeu', status: 'ACTIVE' },
    { name: 'Chăm sóc sức khỏe', slug: 'cham-soc-suc-khoe', status: 'ACTIVE' },
    { name: 'Đồ chơi', slug: 'do-choi', status: 'ACTIVE' },
    { name: 'Phụ kiện', slug: 'phu-kien', status: 'ACTIVE' }
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
      categorySlug: 'thuc-an',
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
      categorySlug: 'thuc-an',
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
      categorySlug: 'do-dung-thiet-yeu',
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
      categorySlug: 'cham-soc-suc-khoe',
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
      categorySlug: 'do-dung-thiet-yeu',
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
      categorySlug: 'do-choi',
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
      categorySlug: 'thuc-an',
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
      categorySlug: 'thuc-an',
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
      categorySlug: 'cham-soc-suc-khoe',
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
      name: 'Nệm tròn lông vũ êm ái chống lạnh chống trượt cho Chó Mèo Cozy Cloud',
      categorySlug: 'phu-kien',
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
    },
    {
      code: 'SP-LEASH-011',
      name: 'Dây dắt kèm yếm ngực phản quang trợ lực đi dạo cho Chó Mèo',
      categorySlug: 'phu-kien',
      origin: 'Hàn Quốc',
      productType: 'VARIANT',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&q=80', isPrimary: true }
      ],
      description: 'Chất liệu vải Oxford thoáng khí êm ái, viền dạ quang phát sáng an toàn khi đi dạo ban đêm.',
      variants: [
        { label: 'Size S (Dưới 6kg)', price: 125000, discountPercent: 0 },
        { label: 'Size M (6 - 14kg)', price: 165000, discountPercent: 5 }
      ]
    },
    {
      code: 'SP-CATTOY-012',
      name: 'Cần câu mèo gắn chuông lông vũ kích thích vận động Funny Cat Stick',
      categorySlug: 'do-choi',
      origin: 'Nhật Bản',
      productType: 'SIMPLE',
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=600&q=80', isPrimary: true }
      ],
      description: 'Cán sợi carbon dẻo dai đàn hồi cao, gắn lông vũ tự nhiên và chuông nhỏ thu hút sự chú ý của mèo.',
      variants: [
        { label: 'Chiều dài 90cm', price: 45000, discountPercent: 0 }
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

  // 4.3 Tích hợp 100 sản phẩm di trú từ MySQL (tổng quy mô: 112 sản phẩm)
  console.log('\n📦 Bước 4.3: Tích hợp 100 sản phẩm di trú từ MySQL (tổng quy mô: 112 sản phẩm)...');
  await runMigrateLegacyProducts();

  // ========================================================================
  // BƯỚC 5: KHÁCH HÀNG CÓ TÀI KHOẢN (REGISTERED CUSTOMER, PETS & TRANSACTIONS)
  // ========================================================================
  console.log('\n👤 Bước 5: Thiết lập Khách hàng thành viên, Thú cưng & Đơn hàng mẫu...');

  // ========================================================================
  // BƯỚC 5: KHÁCH HÀNG CÓ TÀI KHOẢN (REGISTERED CUSTOMERS, PETS & TRANSACTIONS)
  // ========================================================================
  console.log('\n👤 Bước 5: Thiết lập Khách hàng thành viên, Thú cưng, Đơn hàng & Yêu cầu đổi trả mẫu...');

  // 5.1 Khách hàng 1: Lê Văn Cường (Quận 1 & Quận 7 - 2 Thú cưng)
  const custUser1 = await User.findOneAndUpdate(
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

  const customerProfile1 = await Customer.findOneAndUpdate(
    { userId: custUser1._id },
    {
      $set: {
        userId: custUser1._id,
        contactPhone: custUser1.phone,
        contactEmail: custUser1.email,
        activationStatus: 'ACTIVATED',
        accountStatus: 'ACTIVE',
        activityBranchIds: [branch1._id, branch2._id]
      }
    },
    { upsert: true, new: true }
  );

  const petBuddy = await Pet.findOneAndUpdate(
    { customerId: customerProfile1._id, name: 'Buddy' },
    {
      $set: {
        customerId: customerProfile1._id,
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
    { customerId: customerProfile1._id, name: 'Luna' },
    {
      $set: {
        customerId: customerProfile1._id,
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

  // 5.2 Khách hàng 2: Trần Văn Hùng (Chi nhánh Quận 7 - 1 Thú cưng)
  const custUser2 = await User.findOneAndUpdate(
    { username: 'customer_q7' },
    {
      $set: {
        username: 'customer_q7',
        fullName: 'Trần Văn Hùng',
        phone: '0903334455',
        email: 'hung.tran@gmail.com',
        passwordHash: commonPasswordHash,
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        activatedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  const customerProfile2 = await Customer.findOneAndUpdate(
    { userId: custUser2._id },
    {
      $set: {
        userId: custUser2._id,
        contactPhone: custUser2.phone,
        contactEmail: custUser2.email,
        activationStatus: 'ACTIVATED',
        accountStatus: 'ACTIVE',
        activityBranchIds: [branch2._id]
      }
    },
    { upsert: true, new: true }
  );

  const petLuLu = await Pet.findOneAndUpdate(
    { customerId: customerProfile2._id, name: 'LuLu' },
    {
      $set: {
        customerId: customerProfile2._id,
        name: 'LuLu',
        species: 'DOG',
        breed: 'Poodle',
        gender: 'FEMALE',
        ageYears: 2,
        weightKg: 4.5,
        medicalNotes: 'Sức khỏe tốt, đã tiêm phòng dại và tẩy giun định kỳ.'
      }
    },
    { upsert: true, new: true }
  );
  console.log(`   ✅ Đã tạo 2 tài khoản Khách hàng thành viên (${custUser1.fullName}, ${custUser2.fullName}) và 3 thú cưng (Buddy, Luna, LuLu).`);

  // 5.3 Đơn hàng của Khách có tài khoản (Bao phủ toàn bộ các trạng thái Order)
  const orderProduct1 = seededProducts[0]; // Royal Canin
  const orderProduct2 = seededProducts[1]; // Whiskas

  const CUST_ORDERS = [
    {
      code: 'ORD-CUST-PENDING-01',
      customerId: customerProfile1._id,
      branchId: branch1._id,
      status: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      deliveredAt: null,
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' }
    },
    {
      code: 'ORD-CUST-CONFIRMED-02',
      customerId: customerProfile1._id,
      branchId: branch1._id,
      status: 'CONFIRMED',
      paymentMethod: 'ONLINE_MOCK',
      paymentStatus: 'PENDING',
      deliveredAt: null,
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' }
    },
    {
      code: 'ORD-CUST-PROCESSING-03',
      customerId: customerProfile1._id,
      branchId: branch1._id,
      status: 'PROCESSING',
      paymentMethod: 'ONLINE_MOCK',
      paymentStatus: 'PAID',
      deliveredAt: null,
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' }
    },
    {
      code: 'ORD-CUST-SHIPPED-04',
      customerId: customerProfile1._id,
      branchId: branch1._id,
      status: 'SHIPPED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      deliveredAt: null,
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' }
    },
    {
      code: 'ORD-CUST-COMPLETED-05',
      customerId: customerProfile1._id,
      branchId: branch1._id,
      status: 'COMPLETED',
      paymentMethod: 'ONLINE_MOCK',
      paymentStatus: 'PAID',
      deliveredAt: new Date(Date.now() - 3600000 * 24 * 3),
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' }
    },
    {
      code: 'ORD-CUST-COMPLETED-06',
      customerId: customerProfile2._id,
      branchId: branch2._id,
      status: 'COMPLETED',
      paymentMethod: 'ONLINE_MOCK',
      paymentStatus: 'PAID',
      deliveredAt: new Date(Date.now() - 3600000 * 24 * 1),
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phong', detail: '102 Nguyễn Thị Thập' }
    },
    {
      code: 'ORD-CUST-CANCELLED-07',
      customerId: customerProfile1._id,
      branchId: branch1._id,
      status: 'CANCELLED',
      paymentMethod: 'COD',
      paymentStatus: 'CANCELLED',
      deliveredAt: null,
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' }
    }
  ];

  const seededOrderMap = new Map();
  for (const o of CUST_ORDERS) {
    const isCust2 = o.customerId.toString() === customerProfile2._id.toString();
    const contactUser = isCust2 ? custUser2 : custUser1;

    const savedOrder = await Order.findOneAndUpdate(
      { code: o.code },
      {
        $set: {
          code: o.code,
          customerId: o.customerId,
          fulfillmentBranchId: o.branchId,
          status: o.status,
          paymentMethod: o.paymentMethod,
          payment: { status: o.paymentStatus },
          contactSnapshot: {
            fullName: contactUser.fullName,
            phone: contactUser.phone,
            email: contactUser.email
          },
          shippingAddress: o.address,
          items: [
            {
              orderItemId: `item-${o.code}-1`,
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
      { upsert: true, new: true }
    );
    seededOrderMap.set(o.code, savedOrder);
  }
  console.log(`   ✅ Đã tạo ${CUST_ORDERS.length} đơn hàng thành viên (PENDING, CONFIRMED, PROCESSING, SHIPPED, COMPLETED, CANCELLED).`);

  // 5.4 Yêu cầu Đổi trả (OrderReturn) - Bao phủ trọn vẹn 7 trạng thái
  const targetCompletedOrder = seededOrderMap.get('ORD-CUST-COMPLETED-05');
  if (targetCompletedOrder) {
    const RETURN_CASES = [
      { code: 'RET-REQ-01', status: 'REQUESTED', reason: 'Bao bì sản phẩm bị rách khi giao hàng' },
      { code: 'RET-PROC-02', status: 'PROCESSING', reason: 'Giao nhầm phân loại thức ăn chó' },
      { code: 'RET-RECV-03', status: 'RECEIVED', reason: 'Sản phẩm lỗi khóa zip bao bì', quality: 'RESELLABLE', receivedQty: 1 },
      { code: 'RET-APPR-04', status: 'APPROVED', reason: 'Hạt ẩm mốc do lỗi đóng gói từ nhà máy', hasRefund: 'PENDING' },
      { code: 'RET-REJ-05', status: 'REJECTED', reason: 'Khách không thích mùi vị sản phẩm', rejectionNote: 'Từ chối: Sản phẩm đã khui và tiêu thụ hơn 50%' },
      { code: 'RET-COMP-06', status: 'COMPLETED', reason: 'Sản phẩm cận ngày hết hạn sử dụng', hasRefund: 'REFUNDED' },
      { code: 'RET-CANC-07', status: 'CANCELLED', reason: 'Khách hàng đổi ý muốn tiếp tục giữ lại sản phẩm' }
    ];

    for (const rc of RETURN_CASES) {
      let refundDoc = null;
      if (rc.hasRefund) {
        refundDoc = await OrderRefund.findOneAndUpdate(
          { code: `REF-${rc.code}` },
          {
            $set: {
              code: `REF-${rc.code}`,
              cause: 'RETURN',
              orderId: targetCompletedOrder._id,
              amount: 340000,
              provider: 'MOCK',
              status: rc.hasRefund,
              refundedAt: rc.hasRefund === 'REFUNDED' ? new Date(Date.now() - 3600000 * 12) : null
            }
          },
          { upsert: true, new: true }
        );
      }

      await OrderReturn.findOneAndUpdate(
        { code: rc.code },
        {
          $set: {
            code: rc.code,
            orderId: targetCompletedOrder._id,
            customerId: customerProfile1._id,
            status: rc.status,
            reason: rc.reason,
            evidenceUrls: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&q=80'],
            refundId: refundDoc?._id || undefined,
            refundBreakdown: {
              merchandiseNet: 340000,
              shippingRefunded: 0,
              total: 340000
            },
            items: [
              {
                orderItemId: `item-ORD-CUST-COMPLETED-05-1`,
                productId: orderProduct1._id,
                productName: orderProduct1.name,
                orderedQty: 1,
                alreadyReturnedQty: 0,
                requestedQty: 1,
                refundAmount: 340000,
                receivedQty: rc.receivedQty || 0,
                quality: rc.quality || 'RESELLABLE'
              }
            ],
            history: [
              {
                status: rc.status,
                at: new Date(),
                note: rc.rejectionNote || `Cập nhật trạng thái đổi trả ${rc.status}`
              }
            ]
          }
        },
        { upsert: true }
      );
    }
    console.log(`   ✅ Đã tạo ${RETURN_CASES.length} yêu cầu đổi trả (REQUESTED, PROCESSING, RECEIVED, APPROVED, REJECTED, COMPLETED, CANCELLED).`);
  }

  // ========================================================================
  // BƯỚC 6: KHÁCH VÃNG LAI (GUEST KHÔNG TÀI KHOẢN) & TOÀN BỘ 7 TRẠNG THÁI LỊCH HẸN
  // ========================================================================
  console.log('\n🚶 Bước 6: Thiết lập các trường hợp Khách vãng lai (Guest KHÔNG CÓ TÀI KHOẢN) & 7 trạng thái Lịch hẹn...');

  // 6.1 Khách vãng lai 1 (Guest A): Đặt đơn hàng mua cát và pate nhưng không tạo tài khoản (NO_ACCOUNT)
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
  console.log(`   ✅ [GUEST 1 - NO_ACCOUNT] Đã tạo đơn ${'ORD-GUEST-HOT-01'} cho ${guestA.fullName} (KHÔNG CÓ TÀI KHOẢN).`);

  // 6.2 Khách vãng lai 2 (Guest B): Đặt lịch hẹn khám thú cưng tại phòng khám nhưng chưa đăng ký tài khoản (NO_ACCOUNT)
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

  // 6.3 Khách vãng lai 3 (Guest C): Đang chờ kích hoạt tài khoản (PENDING_ACTIVATION)
  const guestC = await GuestContact.findOneAndUpdate(
    { phone: '0908888888' },
    {
      $set: {
        phone: '0908888888',
        fullName: 'Lê Thị Mai (Khách chờ kích hoạt)',
        email: 'guest.mai@gmail.com',
        activationStatus: 'PENDING_ACTIVATION',
        activationInviteSentAt: new Date(),
        activationToken: 'INVITE-ACT-MAI-888',
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  await Order.findOneAndUpdate(
    { code: 'ORD-GUEST-PENDING-02' },
    {
      $set: {
        code: 'ORD-GUEST-PENDING-02',
        customerId: null,
        guestContactId: guestC._id,
        fulfillmentBranchId: branch1._id,
        status: 'SHIPPED',
        paymentMethod: 'COD',
        payment: { status: 'PENDING' },
        contactSnapshot: {
          fullName: guestC.fullName,
          phone: guestC.phone,
          email: guestC.email
        },
        shippingAddress: {
          province: 'Thành phố Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Đa Kao',
          detail: '15 Điện Biên Phủ'
        },
        items: [
          {
            orderItemId: 'item-guest-2',
            productId: orderProduct1._id,
            variantId: orderProduct1.variants[0]._id,
            nameSnapshot: `${orderProduct1.name} (${orderProduct1.variants[0].label})`,
            skuSnapshot: orderProduct1.variants[0].sku,
            unitPrice: orderProduct1.variants[0].price,
            quantity: 1,
            lineSubtotal: orderProduct1.variants[0].price,
            lineNet: orderProduct1.variants[0].finalPrice,
            allocatedDiscount: 0
          }
        ],
        pricing: {
          merchandiseSubtotal: orderProduct1.variants[0].price,
          voucherDiscount: 0,
          shippingFee: 30000,
          totalAmount: orderProduct1.variants[0].finalPrice + 30000
        }
      }
    },
    { upsert: true }
  );
  console.log(`   ✅ [GUEST 3 - PENDING_ACTIVATION] Đã tạo đơn SHIPPED ORD-GUEST-PENDING-02 cho ${guestC.fullName}.`);

  // 6.4 Khách vãng lai 4 (Guest D): Đã kích hoạt tài khoản thành công (ACTIVATED liên kết Customer 2)
  await GuestContact.findOneAndUpdate(
    { phone: '0901234567' },
    {
      $set: {
        phone: '0901234567',
        fullName: 'Trần Thu Trang (Khách đã kích hoạt)',
        email: 'trang.tran@gmail.com',
        activationStatus: 'ACTIVATED',
        activatedAt: new Date(),
        userId: custUser2._id,
        customerId: customerProfile2._id,
        phoneVerifiedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log(`   ✅ [GUEST 4 - ACTIVATED] Đã tạo hồ sơ Guest ACTIVATED liên kết CustomerProfile2.`);

  // 6.5 Đảm bảo Service Catalog (12 dịch vụ Y tế & Spa) được nạp
  await seedServiceCatalog();
  const medicalService = (await Service.findOne({ serviceType: 'MEDICAL' })) || (await Service.findOne());
  const groomingService = (await Service.findOne({ serviceType: 'GROOMING' })) || (await Service.findOne());
  const doctorAnProfile = staffProfileMap.get('doctor.an');
  const groomerDatProfile = staffProfileMap.get('groomer.dat');

  // 6.6 Toàn bộ 7 trạng thái Lịch hẹn (Appointments)
  if (medicalService && groomingService && doctorAnProfile && groomerDatProfile) {
    const APPOINTMENT_SEEDS = [
      {
        code: 'APT-CUST-PEND-PAY-01',
        status: 'PENDING_PAYMENT',
        serviceType: 'MEDICAL',
        service: medicalService,
        staff: doctorAnProfile,
        customer: customerProfile1,
        pet: petBuddy,
        user: custUser1,
        startHoursOffset: 48,
        depositStatus: 'PENDING'
      },
      {
        code: 'APT-CUST-PEND-CONF-02',
        status: 'PENDING_CONFIRMATION',
        serviceType: 'GROOMING',
        service: groomingService,
        staff: groomerDatProfile,
        customer: customerProfile1,
        pet: petLuna,
        user: custUser1,
        startHoursOffset: 24,
        depositStatus: 'NOT_REQUIRED'
      },
      {
        code: 'APT-CUST-CONFIRMED-03',
        status: 'CONFIRMED',
        serviceType: 'MEDICAL',
        service: medicalService,
        staff: doctorAnProfile,
        customer: customerProfile1,
        pet: petBuddy,
        user: custUser1,
        startHoursOffset: 12,
        depositStatus: 'HELD'
      },
      {
        code: 'APT-CUST-INPROGRESS-04',
        status: 'IN_PROGRESS',
        serviceType: 'GROOMING',
        service: groomingService,
        staff: groomerDatProfile,
        customer: customerProfile1,
        pet: petLuna,
        user: custUser1,
        startHoursOffset: 0,
        depositStatus: 'NOT_REQUIRED',
        execStatus: 'IN_PROGRESS'
      },
      {
        code: 'APT-CUST-COMPLETED-05',
        status: 'COMPLETED',
        serviceType: 'MEDICAL',
        service: medicalService,
        staff: doctorAnProfile,
        customer: customerProfile1,
        pet: petBuddy,
        user: custUser1,
        startHoursOffset: -72,
        depositStatus: 'APPLIED',
        execStatus: 'COMPLETED',
        hasServiceRecord: true
      },
      {
        code: 'APT-CUST-CANCELLED-06',
        status: 'CANCELLED',
        serviceType: 'MEDICAL',
        service: medicalService,
        staff: doctorAnProfile,
        customer: customerProfile1,
        pet: petLuna,
        user: custUser1,
        startHoursOffset: -24,
        depositStatus: 'NOT_REQUIRED',
        cancel: { by: 'CUSTOMER', reason: 'Khách hàng bận lịch công tác đột xuất' }
      },
      {
        code: 'APT-CUST-NOSHOW-07',
        status: 'NO_SHOW',
        serviceType: 'GROOMING',
        service: groomingService,
        staff: groomerDatProfile,
        customer: customerProfile1,
        pet: petBuddy,
        user: custUser1,
        startHoursOffset: -12,
        depositStatus: 'FORFEITED',
        note: 'Khách không đến theo giờ hẹn và không liên lạc được'
      }
    ];

    for (const apt of APPOINTMENT_SEEDS) {
      const aptStart = new Date(Date.now() + 3600000 * apt.startHoursOffset);
      const aptEnd = new Date(aptStart.getTime() + 3600000);
      const unitPrice = apt.service.price || (apt.serviceType === 'MEDICAL' ? 250000 : 200000);

      const savedApt = await Appointment.findOneAndUpdate(
        { code: apt.code },
        {
          $set: {
            code: apt.code,
            customerId: apt.customer._id,
            petId: apt.pet._id,
            branchId: branch1._id,
            serviceType: apt.serviceType,
            paymentMethod: 'PAY_AT_STORE',
            status: apt.status,
            scheduledStart: aptStart,
            scheduledEnd: aptEnd,
            scheduledDurationMinutes: 60,
            contactSnapshot: {
              fullName: apt.user.fullName,
              phone: apt.user.phone,
              email: apt.user.email
            },
            petSnapshot: {
              name: apt.pet.name,
              species: apt.pet.species,
              breed: apt.pet.breed,
              weightKg: apt.pet.weightKg
            },
            services: [
              {
                serviceId: apt.service._id,
                serviceName: apt.service.name || 'Dịch vụ chuẩn phòng khám',
                serviceType: apt.serviceType,
                unitPrice,
                durationMinutes: 60,
                requiredStaffRole: apt.serviceType === 'MEDICAL' ? 'VETERINARIAN' : 'CARE_STAFF_GROOMER',
                sequence: 1,
                scheduledStart: aptStart,
                scheduledEnd: aptEnd,
                assignedStaffId: apt.staff._id,
                executionStatus: apt.execStatus || 'NOT_STARTED'
              }
            ],
            pricing: {
              subtotal: unitPrice,
              voucherDiscount: 0,
              finalAmount: unitPrice,
              depositAmount: apt.depositStatus !== 'NOT_REQUIRED' ? 60000 : 0,
              paidAmount: apt.status === 'COMPLETED' ? unitPrice : (apt.depositStatus === 'HELD' ? 60000 : 0),
              balanceAmount: apt.status === 'COMPLETED' ? 0 : unitPrice
            },
            deposit: {
              status: apt.depositStatus
            },
            cancel: apt.cancel ? { ...apt.cancel, at: new Date() } : undefined,
            note: apt.note || undefined
          }
        },
        { upsert: true, new: true }
      );

      // Nếu là COMPLETED, tạo kèm Bệnh án ServiceRecord đã ký duyệt
      if (apt.hasServiceRecord) {
        await ServiceRecord.findOneAndUpdate(
          { appointmentId: savedApt._id },
          {
            $set: {
              appointmentId: savedApt._id,
              petId: apt.pet._id,
              branchId: branch1._id,
              serviceIds: [apt.service._id],
              assignedStaffIds: [apt.staff._id],
              reviewerStaffId: apt.staff._id,
              recordType: 'MEDICAL',
              status: 'FINALIZED',
              actualStartAt: aptStart,
              actualEndAt: aptEnd,
              professional: {
                diagnosis: 'Viêm da dị ứng nhẹ vùng cổ, đã xử lý sát trùng và kê thuốc bôi.',
                treatmentPlan: 'Bôi dung dịch sát trùng Betadine 2 lần/ngày, uống vitamin dưỡng lông trong 7 ngày.'
              }
            }
          },
          { upsert: true }
        );
      }
    }
    console.log(`   ✅ Đã tạo ${APPOINTMENT_SEEDS.length} lịch hẹn thành viên (PENDING_PAYMENT, PENDING_CONFIRMATION, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW).`);

    // 6.7 Lịch hẹn Khách vãng lai Guest B (CONFIRMED, Mèo Miu Miu, Cọc 30%, KHÔNG CÓ TÀI KHOẢN)
    const guestAptStart = new Date(Date.now() + 3600000 * 24);
    const guestAptEnd = new Date(guestAptStart.getTime() + 3600000);
    await Appointment.findOneAndUpdate(
      { code: 'APT-GUEST-CLINIC-01' },
      {
        $set: {
          code: 'APT-GUEST-CLINIC-01',
          customerId: null,
          guestContactId: guestB._id,
          branchId: branch1._id,
          serviceType: 'MEDICAL',
          paymentMethod: 'PAY_AT_STORE',
          status: 'CONFIRMED',
          scheduledStart: guestAptStart,
          scheduledEnd: guestAptEnd,
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
              scheduledStart: guestAptStart,
              scheduledEnd: guestAptEnd,
              assignedStaffId: doctorAnProfile._id,
              executionStatus: 'NOT_STARTED'
            }
          ],
          pricing: {
            subtotal: 200000,
            voucherDiscount: 0,
            finalAmount: 200000,
            depositAmount: 60000,
            paidAmount: 60000,
            balanceAmount: 140000
          },
          deposit: { status: 'HELD' }
        }
      },
      { upsert: true }
    );
    console.log(`   ✅ [GUEST 2 - LỊCH HẸN] Đã tạo lịch hẹn APT-GUEST-CLINIC-01 cho ${guestB.fullName} (Mèo Miu Miu, Cọc 30%, KHÔNG CÓ TÀI KHOẢN).`);

    // 6.8 Lịch hẹn Khách vãng lai Guest C (IN_PROGRESS, Mèo Bông, Grooming spa)
    const guestCAptStart = new Date();
    const guestCAptEnd = new Date(guestCAptStart.getTime() + 3600000);
    await Appointment.findOneAndUpdate(
      { code: 'APT-GUEST-GROOM-02' },
      {
        $set: {
          code: 'APT-GUEST-GROOM-02',
          customerId: null,
          guestContactId: guestC._id,
          branchId: branch1._id,
          serviceType: 'GROOMING',
          paymentMethod: 'PAY_AT_STORE',
          status: 'IN_PROGRESS',
          scheduledStart: guestCAptStart,
          scheduledEnd: guestCAptEnd,
          scheduledDurationMinutes: 60,
          contactSnapshot: {
            fullName: guestC.fullName,
            phone: guestC.phone,
            email: guestC.email
          },
          petSnapshot: {
            name: 'Bông',
            species: 'CAT',
            breed: 'Mèo Anh',
            weightKg: 4.0,
            ageYears: 2
          },
          services: [
            {
              serviceId: groomingService._id,
              serviceName: groomingService.name || 'Grooming & Spa Thú Cưng',
              serviceType: 'GROOMING',
              unitPrice: 200000,
              durationMinutes: 60,
              requiredStaffRole: 'CARE_STAFF_GROOMER',
              sequence: 1,
              scheduledStart: guestCAptStart,
              scheduledEnd: guestCAptEnd,
              assignedStaffId: groomerDatProfile._id,
              executionStatus: 'IN_PROGRESS'
            }
          ],
          pricing: {
            subtotal: 200000,
            voucherDiscount: 0,
            finalAmount: 200000,
            depositAmount: 0,
            paidAmount: 0,
            balanceAmount: 200000
          },
          deposit: { status: 'NOT_REQUIRED' }
        }
      },
      { upsert: true }
    );
    console.log(`   ✅ [GUEST 3 - LỊCH HẸN] Đã tạo lịch hẹn IN_PROGRESS APT-GUEST-GROOM-02 cho ${guestC.fullName} (Mèo Bông).`);
  }

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
  const finalReturnCount = await OrderReturn.countDocuments({});
  const finalRefundCount = await OrderRefund.countDocuments({});
  const finalAptCount = await Appointment.countDocuments({});
  const finalGuestCount = await GuestContact.countDocuments({});

  console.log('\n========================================================================');
  console.log('🎉 TỔNG KẾT BỘ DỮ LIỆU THỰC TẾ (PRODUCTION UAT) ĐÃ HOÀN TẤT THÀNH CÔNG');
  console.log('========================================================================');
  console.log(`| Chi nhánh hoạt động (Branches)    : ${String(finalBranchCount).padEnd(4)} cơ sở (Q1, Q7, Bình Thạnh)`);
  console.log(`| Nhân sự chuyên môn (StaffProfiles): ${String(finalStaffCount).padEnd(4)} nhân sự (Đủ Bác sĩ, Y tá, Lễ tân, Groomer)`);
  console.log(`| Ca trực thực tế (Shifts)          : ${String(finalShiftCount).padEnd(4)} ca (Ca Sáng / Ca Chiều, có ngày nghỉ)`);
  console.log(`| Sản phẩm thương mại (Products)    : ${String(finalProductCount).padEnd(4)} sản phẩm (100% CÓ ẢNH CDN CHUẨN ĐẸP)`);
  console.log(`| Đơn hàng mẫu (Orders)             : ${String(finalOrderCount).padEnd(4)} đơn (Bao phủ cả Khách thành viên & Khách vãng lai)`);
  console.log(`| Yêu cầu đổi trả (Returns)         : ${String(finalReturnCount).padEnd(4)} yêu cầu (Bao phủ 7 trạng thái đổi trả)`);
  console.log(`| Hoàn tiền đổi trả (Refunds)       : ${String(finalRefundCount).padEnd(4)} hoàn tiền (Bao phủ PENDING & REFUNDED)`);
  console.log(`| Lịch hẹn mẫu (Appointments)       : ${String(finalAptCount).padEnd(4)} lịch (Bao phủ 7 trạng thái + Khách vãng lai)`);
  console.log(`| Khách vãng lai (GuestContacts)    : ${String(finalGuestCount).padEnd(4)} hồ sơ (Bao phủ 4 trường hợp Guest)`);
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
