import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireOrg } from '../../middleware/tenancy.js';
import { orgRepository, auditLogRepository } from '../../repositories/index.js';
import { AppError } from '../../middleware/errorHandler.js';

export const orgRouter = Router();

orgRouter.use(requireAuth, requireRole('hr'), requireOrg);

const UpdateOrgSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  retentionDays: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(180)]).optional()
});

/**
 * GET /api/v1/org/settings
 * Fetches organization details and data retention policy
 */
orgRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await orgRepository.findById(req.orgId!);
    if (!org) {
      throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found.');
    }

    res.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        retentionDays: org.retentionDays || 60,
        createdAt: org.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/org/settings
 * Updates organization retention settings (30, 60, 90, 180 days)
 */
orgRouter.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateOrgSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid retention settings');
    }

    const { name, retentionDays } = parsed.data;
    const org = await orgRepository.findById(req.orgId!);
    if (!org) {
      throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found.');
    }

    const updated = await orgRepository.update(req.orgId!, {
      ...(name ? { name } : {}),
      ...(retentionDays ? { retentionDays } : {})
    });

    if (retentionDays && retentionDays !== org.retentionDays) {
      await auditLogRepository.log({
        orgId: req.orgId!,
        actorId: req.user!.id,
        action: 'RETENTION_SETTING_UPDATED',
        entity: 'Org',
        entityId: req.orgId!,
        meta: {
          previousRetentionDays: org.retentionDays || 60,
          newRetentionDays: retentionDays
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        retentionDays: updated.retentionDays,
        updatedAt: updated.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/org/privacy-activity
 * Returns recent anonymized privacy and deletion audit logs for the organization
 */
orgRouter.get('/privacy-activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await auditLogRepository.findPrivacyActivityByOrg(req.orgId!);

    res.json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        createdAt: log.createdAt,
        meta: log.meta
      }))
    });
  } catch (err) {
    next(err);
  }
});

