import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './logger.js';
import { jobQueue } from './services/queue.js';

const server = app.listen(env.PORT, () => {
  logger.info(`ShortlistIQ API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down API server gracefully...`);

  // Force shutdown after 10s if connections refuse to drain
  const forceTimer = setTimeout(() => {
    logger.warn('Forced shutdown timeout reached (10s). Terminating process.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    logger.info('HTTP server closed. Stopping background services...');
    try {
      await jobQueue.stop();
      logger.info('API server and services shut down cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during background services shutdown');
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


