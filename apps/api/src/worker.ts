import dotenv from 'dotenv';
dotenv.config();

import { jobQueue } from './services/queue.js';
import { logger } from './logger.js';

async function runWorker() {
  logger.info('Starting ShortlistIQ Background Worker...');

  try {
    await jobQueue.registerWorker();
    logger.info('ShortlistIQ Background Worker running. Waiting for jobs (concurrency 4)...');
  } catch (err) {
    logger.error({ err }, 'Failed to start ShortlistIQ Background Worker');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker gracefully...`);
    try {
      await jobQueue.stop();
      logger.info('Worker shut down cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

runWorker();
