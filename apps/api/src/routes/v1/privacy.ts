import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../middleware/errorHandler.js';
import {
  deletionRequestRepository,
  candidateRepositoryGlobal,
  auditLogRepository
} from '../../repositories/index.js';
import { storageService, STORAGE_BUCKETS } from '../../services/storage.js';
import { emailService } from '../../services/email/index.js';
import { jobQueue } from '../../services/queue.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireOrg } from '../../middleware/tenancy.js';
import { logger } from '../../logger.js';
import { verifyTurnstile } from '../../services/turnstile.js';

export const privacyRouter = Router();

// Strict rate limiter for privacy deletion request flow (5 requests per 15 minutes)
const deletionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many verification attempts. Please wait 15 minutes before trying again.'
    }
  }
});

const RequestDeletionSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  turnstileToken: z.string().optional()
});

const VerifyDeletionSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  code: z.string().length(6, 'Verification code must be exactly 6 digits')
});

/**
 * POST /api/v1/privacy/deletion-request
 * Public endpoint: Candidate submits email to initiate privacy data deletion
 */
privacyRouter.post(
  '/deletion-request',
  deletionRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = RequestDeletionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid email');
      }

      await verifyTurnstile(parsed.data.turnstileToken, req.ip);

      const email = parsed.data.email.toLowerCase().trim();
      const emailHash = crypto.createHash('sha256').update(email).digest('hex');

      // Generate 6-digit numeric verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minute validity

      await deletionRequestRepository.createOrUpdate({
        email,
        emailHash,
        codeHash,
        expiresAt
      });

      // Send verification code via platform email sender
      await emailService.sendPlatformEmail({
        to: email,
        subject: 'Your ShortlistIQ Data Deletion Verification Code',
        text: `Your verification code is: ${code}. This code expires in 15 minutes.`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #3730a3; margin-top: 0;">ShortlistIQ Data Privacy Request</h2>
            <p>You requested the permanent removal of all candidate records, submitted resumes, and evaluation data matching your email.</p>
            <p>Please enter the following 6-digit code on the verification page:</p>
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 12px;">This code will expire in 15 minutes. If you did not initiate this request, you can safely ignore this email.</p>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'A 6-digit verification code has been dispatched to your email address.',
        emailHash
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/privacy/verify-deletion
 * Public endpoint: Candidate submits 6-digit code to execute cross-org deletion
 */
privacyRouter.post(
  '/verify-deletion',
  deletionRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = VerifyDeletionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input');
      }

      const email = parsed.data.email.toLowerCase().trim();
      const code = parsed.data.code.trim();

      const emailHash = crypto.createHash('sha256').update(email).digest('hex');
      const providedCodeHash = crypto.createHash('sha256').update(code).digest('hex');

      const request = await deletionRequestRepository.findByEmailHash(emailHash);
      if (!request) {
        throw new AppError(400, 'INVALID_REQUEST', 'No deletion request found for this email.');
      }

      if (request.status === 'completed') {
        throw new AppError(400, 'ALREADY_COMPLETED', 'This deletion request has already been executed.');
      }

      if (request.expiresAt < new Date()) {
        throw new AppError(400, 'CODE_EXPIRED', 'Verification code has expired. Please request a new one.');
      }

      if (request.codeHash !== providedCodeHash) {
        throw new AppError(400, 'INVALID_CODE', 'Incorrect verification code. Please check and try again.');
      }

      // 1. Delete all candidate rows and collect storage resume paths
      const { deletedCount, deletedResumePaths, affectedOrgIds } =
        await candidateRepositoryGlobal.deleteByEmail(email);

      // 2. Remove files from storage
      for (const path of deletedResumePaths) {
        try {
          await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, path);
        } catch {
          // Ignored if file doesn't exist
        }
      }

      // 3. Notify all affected HR orgs without personal data (compliance audit log)
      for (const orgId of affectedOrgIds) {
        await auditLogRepository.log({
          orgId,
          actorId: 'system-privacy-officer',
          action: 'CANDIDATE_DATA_DELETED_BY_REQUEST',
          entity: 'Candidate',
          entityId: 'anonymized',
          meta: {
            message: 'Candidate record removed upon verified candidate privacy request.',
            removedAt: new Date().toISOString()
          }
        });
      }

      // 4. Mark request completed
      await deletionRequestRepository.markCompleted(request.id);

      // Audit log entry for system privacy event (NO personal email in meta)
      logger.info(
        { deletedCount, filesDeleted: deletedResumePaths.length, affectedOrgsCount: affectedOrgIds.length },
        'Candidate deletion request executed successfully'
      );

      res.json({
        success: true,
        message: 'All candidate records, resume files, and scores associated with your email have been permanently deleted across all organizations.',
        data: {
          recordsDeleted: deletedCount,
          filesDeleted: deletedResumePaths.length
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/privacy/run-lifecycle-cleanup
 * HR or system trigger to purge expired records on demand
 */
privacyRouter.post(
  '/run-lifecycle-cleanup',
  requireAuth,
  requireRole('hr'),
  requireOrg,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobQueue.runDataLifecycleCleanup();

      await auditLogRepository.log({
        orgId: req.orgId!,
        actorId: req.user!.id,
        action: 'DATA_LIFECYCLE_PURGE',
        entity: 'System',
        entityId: 'lifecycle',
        meta: {
          deletedCandidates: result.deletedCandidates,
          deletedChecks: result.deletedChecks,
          deletedFiles: result.deletedFiles
        }
      });

      res.json({
        success: true,
        message: 'Data lifecycle cleanup completed successfully.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);

