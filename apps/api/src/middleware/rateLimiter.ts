import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests. Please slow down and try again later.'
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Per-user rate limiting if authenticated, else per-IP
      const user = (req as Request & { user?: { id: string } }).user;
      if (user && user.id) {
        return `user:${user.id}`;
      }
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          requestId: req.id
        }
      });
    }
  });
}

/**
 * Phase 4 Rate Limiter for Candidate Checks:
 * - Guests: 3 checks per day per IP
 * - Signed-in users: 10 checks per day per user
 */
export const candidateCheckRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req: Request) => {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return 1000; // Relaxed in test suite and local development
    }
    const user = (req as Request & { user?: { id: string } }).user;
    return user && user.id ? 10 : 3;
  },
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { id: string } }).user;
    if (user && user.id) {
      return `user:${user.id}:checks`;
    }
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}:checks`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const user = (req as Request & { user?: { id: string } }).user;
    const isGuest = !user?.id;
    const limit = isGuest ? 3 : 10;
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Daily resume check limit reached (${limit} checks per day for ${isGuest ? 'guests' : 'signed-in accounts'}). Please try again tomorrow.`,
        requestId: req.id
      }
    });
  }
});

/**
 * Phase 8 Rate Limiter for Public Application Form Submissions:
 * 10 submissions per 15 minutes per IP
 */
export const formSubmissionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: Request) => (process.env.NODE_ENV === 'test' ? 1000 : 10),
  keyGenerator: (req: Request) => `form:${req.ip || req.socket.remoteAddress || 'unknown'}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many application submissions from this IP address. Please wait a few minutes before trying again.',
        requestId: req.id
      }
    });
  }
});

/**
 * Phase 9 Rate Limiter for Sensitive Email Dispatch Operations:
 * 20 email actions per 15 minutes per user/IP
 */
export const emailRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: Request) => (process.env.NODE_ENV === 'test' ? 1000 : 20),
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { id: string } }).user;
    return user?.id ? `user:${user.id}:email` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}:email`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Email dispatch rate limit reached. Please wait before finalizing or sending more email batches.',
        requestId: req.id
      }
    });
  }
});


