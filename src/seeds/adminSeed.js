import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import User from '../models/User.js';

const seedAdmin = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('Connected to MongoDB for admin seeding');

    const existingAdmin = await User.findOne({ systemRole: 'ADMIN' });
    if (existingAdmin) {
      logger.info(`Admin user already exists with phone: ${existingAdmin.phone}. Skipping creation.`);
      console.log(`Admin user already exists with phone: ${existingAdmin.phone}. Skipping creation.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('ChangeMeNow!1', salt);

    const admin = await User.create({
      phone: '0900000000',
      fullName: 'System Admin',
      passwordHash,
      systemRole: 'ADMIN',
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    });

    logger.info(`Default admin created with ID: ${admin._id}`);
    console.log('Default admin created successfully (Phone: 0900000000). Change password immediately.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed admin:', error);
    console.error('Failed to seed admin:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

seedAdmin();
