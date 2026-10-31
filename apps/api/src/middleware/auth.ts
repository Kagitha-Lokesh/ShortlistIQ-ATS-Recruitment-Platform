import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Profile } from '@shortlistiq/shared';
import { env } from '../config/env.js';
import { dbService } from '../services/db.js';
import { profileRepository } from '../repositories/index.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      orgId?: string | null;
      anonToken?: string;
    }
  }
}

/**
 * Resolves or issues an anonymous token for guest candidate checks
 */
export function resolveAnonToken(req: Request, res: Response, next: NextFunction) {
  let token =
    (req.headers['x-anon-token'] as string) ||
    req.cookies?.['shortlistiq_anon_token'];

  if (!token) {
    token = uuidv4();
    res.cookie('shortlistiq_anon_token', token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
  }

  req.anonToken = token;
  // Always expose the anon token header in responses for API clients that don't use cookies
  res.setHeader('x-anon-token', token);
  next();
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Unauthenticated, candidate pages or public routes proceed
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    let userId: string | null = null;
    let userEmail: string | null = null;

    // 1. Check for local mock/dev token
    if (token === 'mock-hr-token' || token.startsWith('mock-')) {
      const parts = token.split(':');
      userId = parts[1] || 'mock-hr-user';
      userEmail = parts[2] || 'hr@company.com';
    } else if (env.SUPABASE_JWT_SECRET) {
      // 2. Real Supabase JWT verification
      const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as { sub?: string; email?: string };
      userId = decoded.sub || null;
      userEmail = decoded.email || null;
    } else {
      // 3. In dev without secret, attempt decoded payload or fallback
      try {
        const decoded = jwt.decode(token) as { sub?: string; email?: string } | null;
        if (decoded?.sub) {
          userId = decoded.sub;
          userEmail = decoded.email || null;
        }
      } catch {
        // Ignored
      }
    }

    if (userId) {
      let p = await profileRepository.findById(userId);
      let email = userEmail;

      if (!p) {
        const dbProfile = await dbService.getProfileById(userId);
        if (dbProfile) {
          p = {
            id: dbProfile.id,
            orgId: dbProfile.orgId,
            role: dbProfile.role as 'hr' | 'candidate',
            fullName: dbProfile.fullName,
            createdAt: new Date(dbProfile.createdAt),
            updatedAt: new Date(dbProfile.updatedAt)
          };
          email = dbProfile.email;
        }
      }

      if (!p && userEmail) {
        const dbProfile = await dbService.getProfileByEmail(userEmail);
        if (dbProfile) {
          p = {
            id: dbProfile.id,
            orgId: dbProfile.orgId,
            role: dbProfile.role as 'hr' | 'candidate',
            fullName: dbProfile.fullName,
            createdAt: new Date(dbProfile.createdAt),
            updatedAt: new Date(dbProfile.updatedAt)
          };
          email = dbProfile.email;
        }
      }

      if (p) {
        req.user = {
          id: p.id,
          orgId: p.orgId,
          role: p.role,
          fullName: p.fullName || null,
          email: email || `${p.id}@company.com`,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
          updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt)
        };
        req.orgId = p.orgId;
      }
    }

    next();
  } catch (error) {
    return next(new AppError(401, 'INVALID_TOKEN', 'The session token is invalid or has expired.'));
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required to access this resource.'));
  }
  next();
}

export function requireRole(role: 'hr' | 'candidate') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }
    if (req.user.role !== role) {
      return next(new AppError(403, 'FORBIDDEN', `Access restricted to ${role} role only.`));
    }
    if (role === 'hr' && !req.user.orgId) {
      return next(new AppError(403, 'MISSING_ORGANIZATION', 'HR user is not assigned to any organization.'));
    }
    next();
  };
}
