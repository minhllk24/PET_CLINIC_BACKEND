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
      fullName: 'System Administrator',
      phone: '0900000001',
      email: 'admin@drpetshouse.vn',
      systemRole: 'ADMIN',
      accountStatus: 'ACTIVE',
      assignedBranchIds: allBranchIds,
      authorizedBranchIds: allBranchIds,
      isGlobal: true,
      staffCode: 'ADMIN-001',
      hireDate: new Date('2022-01-01T00:00:00.000Z')
    },

    // 2. Ban Quản Lý (MANAGER) - Phủ Đơn chi nhánh, Đa chi nhánh và Toàn hệ thống
    {
      username: 'manager_q1',
      fullName: 'Nguyễn Quốc Tuấn',
      phone: '0901000001',
      email: 'tuan.nguyen@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch1._id],
      authorizedBranchIds: [branch1._id],
      staffCode: 'QL-001',
      hireDate: new Date('2023-02-15T00:00:00.000Z')
    },
    {
      username: 'manager_q7',
      fullName: 'Lê Thúy Hằng',
      phone: '0901000002',
      email: 'hang.le@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch2._id],
      authorizedBranchIds: [branch2._id],
      staffCode: 'QL-002',
      hireDate: new Date('2023-05-10T00:00:00.000Z')
    },
    {
      username: 'manager_bt',
      fullName: 'Hoàng Đình Trọng',
      phone: '0901000003',
      email: 'trong.hoang@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch3._id],
      authorizedBranchIds: [branch3._id],
      staffCode: 'QL-003',
      hireDate: new Date('2023-08-01T00:00:00.000Z')
    },
    {
      username: 'manager_dual',
      fullName: 'Phan Minh Triết',
      phone: '0901000004',
      email: 'triet.phan@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch1._id, branch2._id],
      authorizedBranchIds: [branch1._id, branch2._id],
      staffCode: 'QL-004',
      hireDate: new Date('2023-11-20T00:00:00.000Z')
    },
    {
      username: 'manager_dual_13',
      fullName: 'Đặng Gia Huy',
      phone: '0901000005',
      email: 'huy.dang@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch1._id, branch3._id],
      authorizedBranchIds: [branch1._id, branch3._id],
      staffCode: 'QL-005',
      hireDate: new Date('2024-01-05T00:00:00.000Z')
    },
    {
      username: 'manager_dual_23',
      fullName: 'Vũ Diệu Linh',
      phone: '0901000006',
      email: 'linh.vu@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [branch2._id, branch3._id],
      authorizedBranchIds: [branch2._id, branch3._id],
      staffCode: 'QL-006',
      hireDate: new Date('2024-03-12T00:00:00.000Z')
    },
    {
      username: 'manager_general',
      fullName: 'Trần Quốc Toản',
      phone: '0901000007',
      email: 'toan.tran@drpetshouse.vn',
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: allBranchIds,
      authorizedBranchIds: allBranchIds,
      staffCode: 'QL-007',
      hireDate: new Date('2022-06-01T00:00:00.000Z')
    },

    // 3. Bác Sĩ Thú Y (VETERINARIAN) - Phủ Đơn chi nhánh, Đa chi nhánh và Hội Chẩn Toàn Chuỗi
    {
      username: 'vet_q1',
      fullName: 'Nguyễn Văn An',
      phone: '0902000001',
      email: 'an.nguyen@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch1._id],
      shifts: [1, 2, 4, 5, 7],
      legacyAliases: ['doctor.an'],
      staffCode: 'BS-001',
      hireDate: new Date('2023-01-10T00:00:00.000Z')
    },
    {
      username: 'vet_q7',
      fullName: 'Lê Hoàng Nam',
      phone: '0902000002',
      email: 'nam.le@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch2._id],
      shifts: [2, 3, 4, 6, 7],
      legacyAliases: ['doctor.nam'],
      staffCode: 'BS-002',
      hireDate: new Date('2023-04-18T00:00:00.000Z')
    },
    {
      username: 'vet_bt',
      fullName: 'Trần Phương Thảo',
      phone: '0902000003',
      email: 'thao.tran@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch3._id],
      shifts: [1, 3, 5, 6, 7],
      legacyAliases: ['doctor.thao'],
      staffCode: 'BS-003',
      hireDate: new Date('2023-07-22T00:00:00.000Z')
    },
    {
      username: 'vet_dual',
      fullName: 'Phạm Minh Khôi',
      phone: '0902000004',
      email: 'khoi.pham@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [1, 2, 3, 5, 6],
      staffCode: 'BS-004',
      hireDate: new Date('2023-09-01T00:00:00.000Z')
    },
    {
      username: 'vet_dual_13',
      fullName: 'Đỗ Tuấn Hưng',
      phone: '0902000005',
      email: 'hung.do@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch1._id, branch3._id],
      shifts: [1, 3, 4, 6, 7],
      staffCode: 'BS-005',
      hireDate: new Date('2024-01-15T00:00:00.000Z')
    },
    {
      username: 'vet_dual_23',
      fullName: 'Vũ Bảo Long',
      phone: '0902000006',
      email: 'long.vu@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: [branch2._id, branch3._id],
      shifts: [2, 3, 4, 5, 7],
      staffCode: 'BS-006',
      hireDate: new Date('2024-02-28T00:00:00.000Z')
    },
    {
      username: 'vet_master',
      fullName: 'Trịnh Văn Thành',
      phone: '0902000007',
      email: 'thanh.trinh@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 3, 4, 5],
      staffCode: 'BS-007',
      hireDate: new Date('2021-10-01T00:00:00.000Z')
    },

    // 4. Chăm Sóc & Spa / Grooming (CARE_STAFF_GROOMER)
    {
      username: 'care_q1',
      fullName: 'Phạm Quốc Đạt',
      phone: '0903000001',
      email: 'dat.pham@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch1._id],
      shifts: [2, 3, 4, 6, 7],
      legacyAliases: ['groomer.dat'],
      staffCode: 'CS-001',
      hireDate: new Date('2023-03-01T00:00:00.000Z')
    },
    {
      username: 'care_q7',
      fullName: 'Đỗ Gia Huy',
      phone: '0903000002',
      email: 'huy.do@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch2._id],
      shifts: [1, 3, 4, 5, 6],
      legacyAliases: ['groomer.huy'],
      staffCode: 'CS-002',
      hireDate: new Date('2023-06-15T00:00:00.000Z')
    },
    {
      username: 'care_bt',
      fullName: 'Lê Anh Tuấn',
      phone: '0903000003',
      email: 'tuan.le@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch3._id],
      shifts: [1, 2, 4, 6, 7],
      legacyAliases: ['groomer.tuan'],
      staffCode: 'CS-003',
      hireDate: new Date('2023-09-10T00:00:00.000Z')
    },
    {
      username: 'care_dual',
      fullName: 'Nguyễn Mai Ly',
      phone: '0903000004',
      email: 'ly.nguyen@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch1._id, branch3._id],
      shifts: [1, 2, 4, 5, 7],
      staffCode: 'CS-004',
      hireDate: new Date('2023-11-01T00:00:00.000Z')
    },
    {
      username: 'care_dual_12',
      fullName: 'Võ Hoàng Yến',
      phone: '0903000005',
      email: 'yen.vo@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [2, 3, 5, 6, 7],
      staffCode: 'CS-005',
      hireDate: new Date('2024-02-01T00:00:00.000Z')
    },
    {
      username: 'care_dual_23',
      fullName: 'Bùi Tiến Dũng',
      phone: '0903000006',
      email: 'dung.bui@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: [branch2._id, branch3._id],
      shifts: [1, 3, 4, 5, 6],
      staffCode: 'CS-006',
      hireDate: new Date('2024-03-01T00:00:00.000Z')
    },
    {
      username: 'care_master',
      fullName: 'Trương Thùy Dung',
      phone: '0903000007',
      email: 'dung.truong@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'CARE_STAFF_GROOMER',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 3, 5, 6],
      staffCode: 'CS-007',
      hireDate: new Date('2022-08-15T00:00:00.000Z')
    },

    // 5. Lễ Tân & Tiếp Đón (RECEPTIONIST)
    {
      username: 'receptionist_q1',
      fullName: 'Trần Thị Bích',
      phone: '0904000001',
      email: 'bich.tran@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1._id],
      shifts: [1, 3, 4, 5, 6],
      legacyAliases: ['reception.bich'],
      staffCode: 'LT-001',
      hireDate: new Date('2023-02-01T00:00:00.000Z')
    },
    {
      username: 'receptionist_q7',
      fullName: 'Ngô Minh Khang',
      phone: '0904000002',
      email: 'khang.ngo@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch2._id],
      shifts: [1, 2, 3, 5, 7],
      legacyAliases: ['reception.khang'],
      staffCode: 'LT-002',
      hireDate: new Date('2023-05-15T00:00:00.000Z')
    },
    {
      username: 'receptionist_bt',
      fullName: 'Nguyễn Hải Yến',
      phone: '0904000003',
      email: 'yen.hai@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch3._id],
      shifts: [2, 3, 4, 5, 7],
      legacyAliases: ['reception.yen'],
      staffCode: 'LT-003',
      hireDate: new Date('2023-08-20T00:00:00.000Z')
    },
    {
      username: 'receptionist_dual',
      fullName: 'Phạm Ngọc Ánh',
      phone: '0904000004',
      email: 'anh.pham@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch2._id, branch3._id],
      shifts: [1, 2, 4, 5, 6],
      staffCode: 'LT-004',
      hireDate: new Date('2023-10-15T00:00:00.000Z')
    },
    {
      username: 'receptionist_dual_12',
      fullName: 'Đinh Thanh Hà',
      phone: '0904000005',
      email: 'ha.dinh@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [1, 3, 4, 6, 7],
      staffCode: 'LT-005',
      hireDate: new Date('2024-01-10T00:00:00.000Z')
    },
    {
      username: 'receptionist_dual_13',
      fullName: 'Lương Thu Trang',
      phone: '0904000006',
      email: 'trang.luong@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1._id, branch3._id],
      shifts: [2, 3, 5, 6, 7],
      staffCode: 'LT-006',
      hireDate: new Date('2024-02-15T00:00:00.000Z')
    },
    {
      username: 'receptionist_master',
      fullName: 'Vũ Ngọc Hân',
      phone: '0904000007',
      email: 'han.vu@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 4, 5, 7],
      staffCode: 'LT-007',
      hireDate: new Date('2022-09-01T00:00:00.000Z')
    },

    // 6. Y Tá & Điều Dưỡng (NURSE)
    {
      username: 'nurse_q1',
      fullName: 'Hoàng Thị Mai',
      phone: '0905000001',
      email: 'mai.hoang@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch1._id],
      shifts: [1, 2, 3, 5, 6],
      legacyAliases: ['nurse.mai'],
      staffCode: 'YT-001',
      hireDate: new Date('2023-03-10T00:00:00.000Z')
    },
    {
      username: 'nurse_q7',
      fullName: 'Vũ Thu Trang',
      phone: '0905000002',
      email: 'trang.vu@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch2._id],
      shifts: [1, 2, 4, 5, 6],
      legacyAliases: ['nurse.trang'],
      staffCode: 'YT-002',
      hireDate: new Date('2023-06-20T00:00:00.000Z')
    },
    {
      username: 'nurse_bt',
      fullName: 'Đặng Hồng Phúc',
      phone: '0905000003',
      email: 'phuc.dang@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch3._id],
      shifts: [1, 2, 3, 4, 6],
      legacyAliases: ['nurse.phuc'],
      staffCode: 'YT-003',
      hireDate: new Date('2023-09-05T00:00:00.000Z')
    },
    {
      username: 'nurse_dual',
      fullName: 'Lâm Thanh Tùng',
      phone: '0905000004',
      email: 'tung.lam@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: [branch1._id, branch2._id],
      shifts: [1, 3, 5, 6, 7],
      staffCode: 'YT-004',
      hireDate: new Date('2024-01-20T00:00:00.000Z')
    },
    {
      username: 'nurse_master',
      fullName: 'Nguyễn Thanh Phương',
      phone: '0905000005',
      email: 'phuong.nguyen@drpetshouse.vn',
      systemRole: 'STAFF',
      staffSubRole: 'NURSE',
      assignedBranchIds: allBranchIds,
      shifts: [1, 2, 3, 4, 6],
      staffCode: 'YT-005',
      hireDate: new Date('2022-05-15T00:00:00.000Z')
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
          phone: sUser.phone || undefined,
          email: sUser.email || undefined,
          passwordHash: commonPasswordHash,
          systemRole: sUser.systemRole,
          staffSubRole: sUser.staffSubRole || null,
          assignedBranchIds: branchIds,
          accountStatus: 'ACTIVE',
          activatedAt: new Date()
        }
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
            staffCode: sUser.staffCode || undefined,
            staffSubRole: sUser.staffSubRole,
            authorizedBranchIds: branchIds,
            homeBranchId: branchIds[0],
            hireDate: sUser.hireDate || new Date('2024-01-15T00:00:00.000Z'),
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

  // 5.3 Đơn hàng Đa dạng (Bao phủ toàn bộ các trạng thái Order, phân bổ 30 ngày trong Tháng 10/2026)
  const orderProduct1 = seededProducts[0]; // Royal Canin
  const orderProduct2 = seededProducts[1]; // Whiskas
  const orderProduct3 = seededProducts[2] || seededProducts[0];
  const orderProduct4 = seededProducts[3] || seededProducts[1];

  // Helper sinh timeline statusHistory chuẩn nghiệp vụ
  const makeStatusHistory = (status, baseDate) => {
    const t0 = new Date(baseDate);
    const t1 = new Date(t0.getTime() + 25 * 60 * 1000); // +25 phút
    const t2 = new Date(t0.getTime() + 2 * 3600 * 1000); // +2 giờ
    const t3 = new Date(t0.getTime() + 6 * 3600 * 1000); // +6 giờ
    const t4 = new Date(t0.getTime() + 26 * 3600 * 1000); // +26 giờ

    if (status === 'PENDING') {
      return [{ status: 'PENDING', at: t0, note: 'Khách hàng đặt hàng thành công qua Website' }];
    }
    if (status === 'CONFIRMED') {
      return [
        { status: 'PENDING', at: t0, note: 'Khách hàng đặt hàng thành công qua Website' },
        { status: 'CONFIRMED', at: t1, note: 'Nhân viên kinh doanh đã xác nhận đơn hàng qua điện thoại' }
      ];
    }
    if (status === 'PROCESSING') {
      return [
        { status: 'PENDING', at: t0, note: 'Khách hàng đặt hàng thành công qua Website' },
        { status: 'CONFIRMED', at: t1, note: 'Nhân viên kinh doanh đã xác nhận đơn hàng qua điện thoại' },
        { status: 'PROCESSING', at: t2, note: 'Kho trung tâm đã tiếp nhận, kiểm tra chất lượng và đóng gói' }
      ];
    }
    if (status === 'SHIPPED') {
      return [
        { status: 'PENDING', at: t0, note: 'Khách hàng đặt hàng thành công qua Website' },
        { status: 'CONFIRMED', at: t1, note: 'Nhân viên kinh doanh đã xác nhận đơn hàng qua điện thoại' },
        { status: 'PROCESSING', at: t2, note: 'Kho trung tâm đã tiếp nhận, kiểm tra chất lượng và đóng gói' },
        { status: 'SHIPPED', at: t3, note: 'Đã bàn giao kiện hàng cho đối tác vận chuyển GHTK / Ahamove' }
      ];
    }
    if (status === 'COMPLETED') {
      return [
        { status: 'PENDING', at: t0, note: 'Khách hàng đặt hàng thành công qua Website' },
        { status: 'CONFIRMED', at: t1, note: 'Nhân viên kinh doanh đã xác nhận đơn hàng qua điện thoại' },
        { status: 'PROCESSING', at: t2, note: 'Kho trung tâm đã tiếp nhận, kiểm tra chất lượng và đóng gói' },
        { status: 'SHIPPED', at: t3, note: 'Đã bàn giao kiện hàng cho đối tác vận chuyển GHTK / Ahamove' },
        { status: 'COMPLETED', at: t4, note: 'Khách hàng đã nhận hàng nguyên vẹn và hoàn tất thanh toán' }
      ];
    }
    if (status === 'CANCELLED') {
      return [
        { status: 'PENDING', at: t0, note: 'Khách hàng đặt hàng thành công qua Website' },
        { status: 'CANCELLED', at: t1, note: 'Khách hàng đổi ý, yêu cầu hủy đơn qua hotline CSKH' }
      ];
    }
    return [{ status, at: t0, note: `Trạng thái: ${status}` }];
  };

  // Thiết lập danh sách khách vãng lai sạch (Guests)
  const guestA = await GuestContact.findOneAndUpdate(
    { phone: '0981112233' },
    {
      $set: {
        phone: '0981112233',
        fullName: 'Nguyễn Thị Hồng',
        email: 'hong.nguyen@gmail.com',
        activationStatus: 'NO_ACCOUNT',
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date('2026-10-05T08:00:00.000Z')
      }
    },
    { upsert: true, new: true }
  );

  const guestB = await GuestContact.findOneAndUpdate(
    { phone: '0978889900' },
    {
      $set: {
        phone: '0978889900',
        fullName: 'Phạm Hoàng Long',
        email: 'long.pham@gmail.com',
        activationStatus: 'NO_ACCOUNT',
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date('2026-10-10T09:30:00.000Z')
      }
    },
    { upsert: true, new: true }
  );

  const guestC = await GuestContact.findOneAndUpdate(
    { phone: '0908888888' },
    {
      $set: {
        phone: '0908888888',
        fullName: 'Lê Thị Mai',
        email: 'mai.le@gmail.com',
        activationStatus: 'PENDING_ACTIVATION',
        activationInviteSentAt: new Date('2026-10-15T14:00:00.000Z'),
        activationToken: 'INVITE-ACT-MAI-888',
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date('2026-10-15T14:00:00.000Z')
      }
    },
    { upsert: true, new: true }
  );

  const guestD = await GuestContact.findOneAndUpdate(
    { phone: '0901234567' },
    {
      $set: {
        phone: '0901234567',
        fullName: 'Trần Thu Trang',
        email: 'trang.tran@gmail.com',
        activationStatus: 'ACTIVATED',
        activatedAt: new Date('2026-10-20T10:00:00.000Z'),
        userId: custUser2._id,
        customerId: customerProfile2._id,
        phoneVerifiedAt: new Date('2026-10-20T10:00:00.000Z')
      }
    },
    { upsert: true, new: true }
  );

  const guestE = await GuestContact.findOneAndUpdate(
    { phone: '0912345678' },
    {
      $set: {
        phone: '0912345678',
        fullName: 'Đỗ Minh Trí',
        email: 'tri.do@gmail.com',
        activationStatus: 'NO_ACCOUNT',
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date('2026-10-22T11:00:00.000Z')
      }
    },
    { upsert: true, new: true }
  );

  const guestF = await GuestContact.findOneAndUpdate(
    { phone: '0934567890' },
    {
      $set: {
        phone: '0934567890',
        fullName: 'Bùi Phương Oanh',
        email: 'oanh.bui@gmail.com',
        activationStatus: 'NO_ACCOUNT',
        userId: null,
        customerId: null,
        phoneVerifiedAt: new Date('2026-10-25T16:20:00.000Z')
      }
    },
    { upsert: true, new: true }
  );

  // Danh mục 32 đơn hàng thực tế trải dài tháng 10/2026
  const ORDER_DEFINITIONS = [
    // Tuần 1: 01/10 - 07/10
    { code: 'ORD-20261001-0001', cust: customerProfile1, user: custUser1, branch: branch1, status: 'COMPLETED', date: '2026-10-01T08:30:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct1, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' } },
    { code: 'ORD-20261002-0002', cust: customerProfile2, user: custUser2, branch: branch2, status: 'COMPLETED', date: '2026-10-02T09:15:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct2, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phong', detail: '102 Nguyễn Thị Thập' } },
    { code: 'ORD-20261003-0003', guest: guestA, branch: branch1, status: 'COMPLETED', date: '2026-10-03T10:00:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct1, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Võ Thị Sáu', detail: '280 Cách Mạng Tháng 8' } },
    { code: 'ORD-20261004-0004', cust: customerProfile1, user: custUser1, branch: branch3, status: 'CANCELLED', date: '2026-10-04T14:20:00.000Z', pay: 'COD', payStatus: 'CANCELLED', prod: orderProduct3, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 25', detail: '48 Điện Biên Phủ' } },
    { code: 'ORD-20261005-0005', cust: customerProfile2, user: custUser2, branch: branch1, status: 'COMPLETED', date: '2026-10-05T15:45:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct4, qty: 3, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Quy', detail: '18 Mai Văn Vĩnh' } },
    { code: 'ORD-20261006-0006', guest: guestB, branch: branch2, status: 'COMPLETED', date: '2026-10-06T11:30:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct2, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phú', detail: '56 Nguyễn Lương Bằng' } },
    { code: 'ORD-20261007-0007', cust: customerProfile1, user: custUser1, branch: branch1, status: 'COMPLETED', date: '2026-10-07T16:00:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct1, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Đa Kao', detail: '12 Nguyễn Đình Chiểu' } },

    // Tuần 2: 08/10 - 14/10
    { code: 'ORD-20261008-0008', cust: customerProfile2, user: custUser2, branch: branch3, status: 'COMPLETED', date: '2026-10-08T08:45:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct3, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 19', detail: '82 Nguyễn Cửu Vân' } },
    { code: 'ORD-20261009-0009', guest: guestC, branch: branch1, status: 'COMPLETED', date: '2026-10-09T10:30:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct1, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Tân Định', detail: '35 Trần Quang Khải' } },
    { code: 'ORD-20261010-0010', cust: customerProfile1, user: custUser1, branch: branch2, status: 'COMPLETED', date: '2026-10-10T14:10:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct2, qty: 4, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Thành', detail: '90 Lê Thị Riêng' } },
    { code: 'ORD-20261011-0011', guest: guestD, branch: branch3, status: 'COMPLETED', date: '2026-10-11T16:50:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct4, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 15', detail: '105 Bạch Đằng' } },
    { code: 'ORD-20261012-0012', cust: customerProfile2, user: custUser2, branch: branch1, status: 'CANCELLED', date: '2026-10-12T09:20:00.000Z', pay: 'COD', payStatus: 'CANCELLED', prod: orderProduct1, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Hưng', detail: '77 Lâm Văn Bền' } },
    { code: 'ORD-20261013-0013', cust: customerProfile1, user: custUser1, branch: branch2, status: 'COMPLETED', date: '2026-10-13T13:40:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct3, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' } },
    { code: 'ORD-20261014-0014', guest: guestE, branch: branch1, status: 'COMPLETED', date: '2026-10-14T15:15:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct2, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Võ Thị Sáu', detail: '142 Nguyễn Thị Minh Khai' } },

    // Tuần 3: 15/10 - 21/10
    { code: 'ORD-20261015-0015', cust: customerProfile2, user: custUser2, branch: branch3, status: 'COMPLETED', date: '2026-10-15T08:10:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct1, qty: 3, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 22', detail: '208 Nguyễn Hữu Cảnh' } },
    { code: 'ORD-20261016-0016', guest: guestF, branch: branch2, status: 'COMPLETED', date: '2026-10-16T10:45:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct4, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phong', detail: '25 Đường số 6' } },
    { code: 'ORD-20261017-0017', cust: customerProfile1, user: custUser1, branch: branch1, status: 'COMPLETED', date: '2026-10-17T11:30:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct2, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Nguyễn Thái Bình', detail: '68 Ký Con' } },
    { code: 'ORD-20261018-0018', cust: customerProfile2, user: custUser2, branch: branch2, status: 'COMPLETED', date: '2026-10-18T14:50:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct3, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Bình Thuận', detail: '39 Huỳnh Tấn Phát' } },
    { code: 'ORD-20261019-0019', guest: guestA, branch: branch3, status: 'COMPLETED', date: '2026-10-19T16:20:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct1, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 24', detail: '18 Phan Chu Trinh' } },
    { code: 'ORD-20261020-0020', cust: customerProfile1, user: custUser1, branch: branch1, status: 'COMPLETED', date: '2026-10-20T09:00:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct2, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Cầu Kho', detail: '52 Trần Hưng Đạo' } },
    { code: 'ORD-20261021-0021', cust: customerProfile2, user: custUser2, branch: branch2, status: 'COMPLETED', date: '2026-10-21T15:30:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct4, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Quy', detail: '94 Nguyễn Thị Thập' } },

    // Tuần 4: 22/10 - 28/10 (Các trạng thái Shipped, Processing, Confirmed)
    { code: 'ORD-20261022-0022', guest: guestB, branch: branch1, status: 'COMPLETED', date: '2026-10-22T08:40:00.000Z', pay: 'COD', payStatus: 'PAID', prod: orderProduct3, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '104 Tôn Đức Thắng' } },
    { code: 'ORD-20261023-0023', cust: customerProfile1, user: custUser1, branch: branch3, status: 'COMPLETED', date: '2026-10-23T11:15:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct1, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 17', detail: '42 Xô Viết Nghệ Tĩnh' } },
    { code: 'ORD-20261024-0024', cust: customerProfile2, user: custUser2, branch: branch2, status: 'CANCELLED', date: '2026-10-24T13:20:00.000Z', pay: 'COD', payStatus: 'CANCELLED', prod: orderProduct2, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Thuận Đông', detail: '15 Huỳnh Tấn Phát' } },
    { code: 'ORD-20261025-0025', guest: guestC, branch: branch1, status: 'SHIPPED', date: '2026-10-25T09:30:00.000Z', pay: 'COD', payStatus: 'PENDING', prod: orderProduct1, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Đa Kao', detail: '15 Điện Biên Phủ' } },
    { code: 'ORD-20261026-0026', cust: customerProfile1, user: custUser1, branch: branch2, status: 'SHIPPED', date: '2026-10-26T10:15:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct3, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phong', detail: '60 Nguyễn Thị Thập' } },
    { code: 'ORD-20261027-0027', cust: customerProfile2, user: custUser2, branch: branch3, status: 'PROCESSING', date: '2026-10-27T14:40:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PAID', prod: orderProduct2, qty: 3, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 25', detail: '88 D2 Văn Thánh' } },
    { code: 'ORD-20261028-0028', guest: guestD, branch: branch1, status: 'PROCESSING', date: '2026-10-28T16:00:00.000Z', pay: 'COD', payStatus: 'PENDING', prod: orderProduct4, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '20 Lê Duẩn' } },

    // Tuần 5: 29/10 - 31/10 (Các đơn mới nhất PENDING, CONFIRMED)
    { code: 'ORD-20261029-0029', cust: customerProfile1, user: custUser1, branch: branch1, status: 'CONFIRMED', date: '2026-10-29T08:15:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PENDING', prod: orderProduct1, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detail: '45 Lê Duẩn' } },
    { code: 'ORD-20261030-0030', guest: guestE, branch: branch2, status: 'CONFIRMED', date: '2026-10-30T10:30:00.000Z', pay: 'COD', payStatus: 'PENDING', prod: orderProduct2, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phú', detail: '12 Nguyễn Lương Bằng' } },
    { code: 'ORD-20261031-0031', cust: customerProfile2, user: custUser2, branch: branch3, status: 'PENDING', date: '2026-10-31T09:00:00.000Z', pay: 'COD', payStatus: 'PENDING', prod: orderProduct3, qty: 1, addr: { province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 19', detail: '45 Mê Linh' } },
    { code: 'ORD-20261031-0032', guest: guestF, branch: branch1, status: 'PENDING', date: '2026-10-31T11:45:00.000Z', pay: 'ONLINE_MOCK', payStatus: 'PENDING', prod: orderProduct1, qty: 2, addr: { province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Võ Thị Sáu', detail: '215 Nam Kỳ Khởi Nghĩa' } }
  ];

  const seededOrderMap = new Map();
  for (const o of ORDER_DEFINITIONS) {
    const contactName = o.user?.fullName || o.guest?.fullName || 'Khách hàng';
    const contactPhone = o.user?.phone || o.guest?.phone || '0900000000';
    const contactEmail = o.user?.email || o.guest?.email || 'customer@gmail.com';
    const variant = o.prod.variants[0];
    const unitPrice = variant.price;
    const finalPrice = variant.finalPrice || variant.price;
    const subtotal = unitPrice * o.qty;
    const totalAmount = finalPrice * o.qty + 30000;
    const statusHistory = makeStatusHistory(o.status, o.date);
    const deliveredAt = o.status === 'COMPLETED' ? new Date(new Date(o.date).getTime() + 26 * 3600 * 1000) : null;

    const savedOrder = await Order.findOneAndUpdate(
      { code: o.code },
      {
        $set: {
          code: o.code,
          customerId: o.cust?._id || null,
          guestContactId: o.guest?._id || null,
          fulfillmentBranchId: o.branch._id,
          status: o.status,
          paymentMethod: o.pay,
          payment: { status: o.payStatus },
          contactSnapshot: {
            fullName: contactName,
            phone: contactPhone,
            email: contactEmail
          },
          shippingAddress: o.addr,
          items: [
            {
              orderItemId: `item-${o.code}-1`,
              productId: o.prod._id,
              variantId: variant._id,
              nameSnapshot: `${o.prod.name} (${variant.label})`,
              skuSnapshot: variant.sku,
              unitPrice: unitPrice,
              quantity: o.qty,
              lineSubtotal: subtotal,
              lineNet: finalPrice * o.qty,
              allocatedDiscount: (unitPrice - finalPrice) * o.qty
            }
          ],
          pricing: {
            merchandiseSubtotal: subtotal,
            voucherDiscount: (unitPrice - finalPrice) * o.qty,
            shippingFee: 30000,
            totalAmount: totalAmount
          },
          statusHistory: statusHistory,
          deliveredAt: deliveredAt,
          createdAt: new Date(o.date),
          updatedAt: statusHistory[statusHistory.length - 1].at
        }
      },
      { upsert: true, new: true }
    );
    seededOrderMap.set(o.code, savedOrder);
  }
  console.log(`   ✅ Đã tạo ${ORDER_DEFINITIONS.length} đơn hàng nghiệp vụ (30 ngày Tháng 10/2026, đầy đủ statusHistory).`);

  // 5.4 Yêu cầu Đổi trả (OrderReturn) - Phân bổ 7 trạng thái trên 7 ĐƠN HÀNG HOÀN TẤT KHÁC NHAU
  const RETURN_CASES = [
    {
      code: 'RET-202610-001',
      orderCode: 'ORD-20261001-0001',
      status: 'REQUESTED',
      reason: 'Bao bì sản phẩm bị rách trong quá trình vận chuyển',
      quality: 'DAMAGED',
      rejectionNote: null,
      refundStatus: null
    },
    {
      code: 'RET-202610-002',
      orderCode: 'ORD-20261002-0002',
      status: 'PROCESSING',
      reason: 'Giao nhầm phân loại hương vị pate so với đơn đã đặt',
      quality: 'RESELLABLE',
      rejectionNote: null,
      refundStatus: null
    },
    {
      code: 'RET-202610-003',
      orderCode: 'ORD-20261003-0003',
      status: 'RECEIVED',
      reason: 'Sản phẩm lỗi khóa zip bao bì, hạt rơi ra ngoài',
      quality: 'RESELLABLE',
      receivedQty: 1,
      rejectionNote: null,
      refundStatus: null
    },
    {
      code: 'RET-202610-004',
      orderCode: 'ORD-20261005-0005',
      status: 'APPROVED',
      reason: 'Hạt ẩm mốc do lỗi đóng gói bảo quản từ nhà máy',
      quality: 'DAMAGED',
      rejectionNote: null,
      refundStatus: 'PENDING'
    },
    {
      code: 'RET-202610-005',
      orderCode: 'ORD-20261006-0006',
      status: 'REJECTED',
      reason: 'Khách báo thú cưng không chịu ăn sau khi đã dùng 80% bao',
      quality: 'DISCARDED',
      rejectionNote: 'Từ chối đổi trả: Sản phẩm đã khui và tiêu thụ quá 50% khối lượng, không nằm trong chính sách hỗ trợ.',
      refundStatus: null
    },
    {
      code: 'RET-202610-006',
      orderCode: 'ORD-20261007-0007',
      status: 'COMPLETED',
      reason: 'Sản phẩm cận hạn sử dụng dưới 2 tháng',
      quality: 'RESELLABLE',
      rejectionNote: null,
      refundStatus: 'REFUNDED'
    },
    {
      code: 'RET-202610-007',
      orderCode: 'ORD-20261008-0008',
      status: 'CANCELLED',
      reason: 'Khách hàng liên hệ báo người nhà đồng ý giữ lại sử dụng, xin hủy yêu cầu',
      quality: 'RESELLABLE',
      rejectionNote: null,
      refundStatus: null
    }
  ];

  for (const rc of RETURN_CASES) {
    const parentOrder = seededOrderMap.get(rc.orderCode);
    if (!parentOrder) continue;

    const returnItem = parentOrder.items[0];
    const refundAmount = returnItem.lineNet || returnItem.lineSubtotal;

    let refundDoc = null;
    if (rc.refundStatus) {
      refundDoc = await OrderRefund.findOneAndUpdate(
        { code: `REF-${rc.code}` },
        {
          $set: {
            code: `REF-${rc.code}`,
            cause: 'RETURN',
            orderId: parentOrder._id,
            amount: refundAmount,
            provider: 'MOCK',
            status: rc.refundStatus,
            refundedAt: rc.refundStatus === 'REFUNDED' ? new Date(Date.now() - 3600000 * 6) : null
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
          orderId: parentOrder._id,
          customerId: parentOrder.customerId || undefined,
          guestContactId: parentOrder.guestContactId || undefined,
          status: rc.status,
          reason: rc.reason,
          evidenceUrls: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&q=80'],
          refundId: refundDoc?._id || undefined,
          refundBreakdown: {
            merchandiseNet: refundAmount,
            shippingRefunded: 0,
            total: refundAmount
          },
          items: [
            {
              orderItemId: returnItem.orderItemId,
              productId: returnItem.productId,
              productName: returnItem.nameSnapshot,
              orderedQty: returnItem.quantity,
              alreadyReturnedQty: 0,
              requestedQty: returnItem.quantity,
              refundAmount: refundAmount,
              receivedQty: rc.receivedQty || 0,
              quality: rc.quality || 'RESELLABLE'
            }
          ],
          history: [
            {
              status: rc.status,
              at: new Date(parentOrder.createdAt.getTime() + 48 * 3600 * 1000),
              note: rc.rejectionNote || `Cập nhật trạng thái đổi trả: ${rc.status}`
            }
          ]
        }
      },
      { upsert: true }
    );
  }
  console.log(`   ✅ Đã phân bổ ${RETURN_CASES.length} yêu cầu đổi trả (RET-202610-001 đến 007) trên 7 đơn hàng thực tế.`);

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
