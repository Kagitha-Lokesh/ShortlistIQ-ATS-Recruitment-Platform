import { Router } from 'express';
import { authRouter } from './auth.js';
import { batchRouter } from './batches.js';
import { checksRouter } from './checks.js';
import { formsRouter } from './forms.js';
import { emailRouter } from './email.js';
import { privacyRouter } from './privacy.js';
import { orgRouter } from './org.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireOrg } from '../../middleware/tenancy.js';
import { getBatchRepository } from '../../repositories/index.js';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/batches', batchRouter);
v1Router.use('/checks', checksRouter);
v1Router.use('/forms', formsRouter);
v1Router.use('/email', emailRouter);
v1Router.use('/privacy', privacyRouter);
v1Router.use('/org', orgRouter);

// HR protected dashboard endpoint
v1Router.get('/hr/dashboard', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const repo = getBatchRepository(req.orgId!);
    const stats = await repo.getStats();
    const recentBatches = await repo.findManyWithCounts();

    res.json({
      success: true,
      data: {
        organizationId: req.orgId,
        stats,
        recentBatches
      }
    });
  } catch (error) {
    next(error);
  }
});
