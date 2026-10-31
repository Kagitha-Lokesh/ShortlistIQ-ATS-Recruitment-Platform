import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export function requireOrg(req: Request, _res: Response, next: NextFunction) {
  const orgId = req.orgId || req.user?.orgId;

  if (!orgId) {
    return next(
      new AppError(
        403,
        'ORGANIZATION_REQUIRED',
        'Access requires an authenticated organization context.'
      )
    );
  }

  req.orgId = orgId;
  next();
}

