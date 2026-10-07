import mongoose from 'mongoose';
import app from './app';
import config from './shared/config';
import { logger } from './shared/logger';
import { startCronJobs } from './worker/cronjobs';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB Connected successfully');

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
