import express, { Express } from 'express';
import { config } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { storageService } from './services/storage.service';
import bucketRoutes from './routes/bucket.routes';
import objectRoutes from './routes/object.routes';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50gb' }));
app.use(requestLogger);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'object-storage',
  });
});

// Apply authentication to all routes except /health
app.use(authMiddleware);

// Routes
app.use('/buckets', bucketRoutes);
app.use('/buckets', objectRoutes);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize storage and start server
async function startServer() {
  try {
    // Ensure data directory exists
    await storageService.ensureDataDir();

    // Start server
    app.listen(config.port, () => {
      logger.info(`Object Storage Server started`, {
        port: config.port,
        dataDir: config.dataDir,
        dbPath: config.dbPath,
      });
      logger.info(`Health check available at http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
