import mongoose from 'mongoose';
import app from './app';
import config from './shared/config';
import { logger } from './shared/logger';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB Connected successfully');

    // Start Express server
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`SERVER is running on PORT: ${config.port} in ${config.env} mode`);
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Shutting down server...');
      server.close(() => {
        logger.info('Server closed');
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
