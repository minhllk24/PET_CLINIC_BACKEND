import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import User from '../models/User.js';

const DEMO_ACCOUNTS = [
  {
    username: 'admin',
    phone: '0900000000',
    fullName: 'System Administrator',
    email: 'admin@petclinic.com',
    password: 'Admin@1234',
    systemRole: 'ADMIN',
    accountStatus: 'ACTIVE',
  },
  {
    phone: '0901234567',
    fullName: 'Quản Lý Chi Nhánh 1',
    email: 'manager.q1@petclinic.com',
    password: 'Manager@1234',
    systemRole: 'MANAGER',
    assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001')],
    accountStatus: 'ACTIVE',
  },
  {
    phone: '0903333333',
    fullName: 'Bác Sĩ Thú Y Nguyễn Văn A',
    email: 'vet.nguyena@petclinic.com',
    password: 'Doctor@1234',
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001')],
    accountStatus: 'ACTIVE',
  },
  {
    phone: '0904444444',
    fullName: 'Lễ Tân Tiếp Đón Trần Thị B',
    email: 'reception.tranb@petclinic.com',
    password: 'Staff@1234',
    systemRole: 'STAFF',
    staffSubRole: 'RECEPTIONIST',
    assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001')],
    accountStatus: 'ACTIVE',
  },
  {
    phone: '0905555555',
    fullName: 'Khách Hàng Lê Văn C',
    email: 'customer.levanc@gmail.com',
    password: 'Customer@1234',
    systemRole: 'CUSTOMER',
    accountStatus: 'ACTIVE',
  },
  {
    phone: '0907777777',
    fullName: 'Khách Hàng Chưa Kích Hoạt',
    email: 'pending.user@gmail.com',
    password: 'Customer@1234',
    systemRole: 'CUSTOMER',
    accountStatus: 'PENDING_ACTIVATION',
  },
  {
    phone: '0906666666',
    fullName: 'Khách Hàng Bị Khóa',
    email: 'blocked.user@gmail.com',
    password: 'Customer@1234',
    systemRole: 'CUSTOMER',
    accountStatus: 'BLOCKED',
  },
];

const seedDemoUsers = async () => {
  try {
    console.log(`Connecting to MongoDB: ${config.mongoUri}...`);
    await mongoose.connect(config.mongoUri);
    logger.info('Connected to MongoDB for demo users seeding');

    const salt = await bcrypt.genSalt(12);

    for (const acc of DEMO_ACCOUNTS) {
      const existing = await User.findOne({ phone: acc.phone });
      if (existing) {
        if (acc.username && existing.username !== acc.username) {
          existing.username = acc.username;
          await existing.save();
          console.log(`[UPDATED] User ${acc.email} set username: ${acc.username}`);
        } else {
          console.log(`[EXISTS] User phone: ${acc.phone} (${acc.systemRole}${acc.staffSubRole ? ':' + acc.staffSubRole : ''})`);
        }
        continue;
      }

      const passwordHash = await bcrypt.hash(acc.password, salt);
      await User.create({
        username: acc.username || undefined,
        phone: acc.phone,
        fullName: acc.fullName,
        email: acc.email,
        passwordHash,
        systemRole: acc.systemRole,
        staffSubRole: acc.staffSubRole || null,
        assignedBranchIds: acc.assignedBranchIds || [],
        accountStatus: acc.accountStatus,
        activatedAt: acc.accountStatus === 'ACTIVE' ? new Date() : null,
      });

      console.log(`[CREATED] ${acc.systemRole.padEnd(8)} | Phone: ${acc.phone} | Pass: ${acc.password.padEnd(14)} | ${acc.fullName}`);
    }

    console.log('\n✅ Demo users seeded successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed demo users:', error);
    console.error('Failed to seed demo users:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

seedDemoUsers();
