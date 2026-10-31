import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { authenticate, resolveAnonToken } from './middleware/auth.js';
import { v1Router } from './routes/v1/index.js';
import { HealthCheckResponse } from '@shortlistiq/shared';
import { dbService } from './services/db.js';

export const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server) or requests matching allowed origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'CORS_FORBIDDEN', `Origin '${origin}' not permitted by CORS policy.`));
    },
    credentials: true,
    exposedHeaders: ['x-anon-token', 'x-request-id']
  })
);

app.use(cookieParser());
app.use(requestIdMiddleware);

if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }));
}

app.use(express.json({ limit: '5mb' }));

// Global rate limiter
app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }));

// Auth & anonymous token resolution
app.use(authenticate);
app.use(resolveAnonToken);

// Health route (unauthenticated)
app.get('/health', (_req, res) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'api',
    version: '0.1.0'
  };
  res.json(response);
});

// Also support /api/health for frontend proxy
app.get('/api/health', (_req, res) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'api',
    version: '0.1.0'
  };
  res.json(response);
});

// Readiness probe for container orchestrators and deployment health checks
app.get('/ready', async (_req, res) => {
  try {
    const dbOk = await dbService.checkHealth();
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'api',
      version: '0.1.0',
      uptime: process.uptime(),
      components: {
        database: dbOk ? 'up' : 'down',
        storage: 'up',
        queue: 'up'
      }
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'api'
    });
  }
});

app.get('/api/ready', async (_req, res) => {
  try {
    const dbOk = await dbService.checkHealth();
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'api',
      version: '0.1.0',
      uptime: process.uptime(),
      components: {
        database: dbOk ? 'up' : 'down',
        storage: 'up',
        queue: 'up'
      }
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'api'
    });
  }
});

// API v1 routes
app.use('/api/v1', v1Router);

// 404 handler
app.use((_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Requested endpoint does not exist.'));
});

// Centralized error handler
app.use(errorHandler);
