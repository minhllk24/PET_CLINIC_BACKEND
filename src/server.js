import mongoose from 'mongoose';
import app from './app';
import config from './shared/config';
import { logger } from './shared/logger';
import { startCronJobs } from './worker/cronjobs';
import { migrateMissingProductCodes } from './modules/catalog/catalog.service';
import { ensureFutureShifts, ensureRealisticAppointments } from './modules/staff/shift.service';
import { syncCustomerProfiles } from './modules/customer/customer.service';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB Connected successfully');

    // Align SlotReservation indexes (ensures partialFilterExpression on staff unique index)
    try {
      const coll = mongoose.connection.db.collection('slotreservations');
      const indexes = await coll.indexes();
      const staffIdx = indexes.find((i) => i.name === 'branchId_1_staffId_1_slotStartUnit_1_unitIndex_1');
      if (staffIdx && !staffIdx.partialFilterExpression) {
        await coll.dropIndex('branchId_1_staffId_1_slotStartUnit_1_unitIndex_1');
        await coll.createIndex(
          { branchId: 1, staffId: 1, slotStartUnit: 1, unitIndex: 1 },
          { unique: true, partialFilterExpression: { kind: 'STAFF' }, background: true }
        );
      }
    } catch (_idxErr) {}

    // Sync Customer profiles with User documents (ORD-03 / Admin Customer consistency)
    syncCustomerProfiles().catch((err) => {
      logger.warn('Customer profile sync warning:', err.message);
    });

    // Migrate missing product codes if any
    migrateMissingProductCodes().catch((err) => {
      logger.warn('Product code migration warning:', err.message);
    });

    // Ensure future clinical shifts are populated across all branches
    ensureFutureShifts().catch((err) => {
      logger.warn('Future shift migration warning:', err.message);
    });

    // Ensure realistic appointment booking distribution across upcoming dates
    ensureRealisticAppointments().catch((err) => {
      logger.warn('Realistic appointment migration warning:', err.message);
    });

    // Start Express server
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`SERVER is running on PORT: ${config.port} in ${config.env} mode`);
    });

    // Start background cron jobs
    startCronJobs();

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info('Shutting down server...');
      
      try {
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        logger.info('Server closed');
        
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
