import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireOrg } from '../../middleware/tenancy.js';
import { AppError } from '../../middleware/errorHandler.js';
import { emailRateLimiter } from '../../middleware/rateLimiter.js';
import {
  getEmailAccountRepository,
  getEmailTemplateRepository,
  getEmailSendRepository,
  getBatchRepository,
  getCandidateRepository,
  auditLogRepository,
  orgRepository
} from '../../repositories/index.js';
import { emailService } from '../../services/email/index.js';
import { encryptToken } from '../../services/crypto.js';
import { jobQueue } from '../../services/queue.js';
import {
  CandidateDecision,
  EmailSendStatus,
  EmailTemplateKind,
  BatchStatus
} from '@prisma/client';
import { logger } from '../../logger.js';

export const emailRouter = Router();

// ==========================================
// 1. OAUTH CONNECTIONS & EMAIL ACCOUNTS
// ==========================================

/**
 * GET /api/v1/email/accounts
 * List connected email accounts for current HR user.
 * Tokens NEVER reach the browser.
 */
emailRouter.get('/accounts', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const repo = getEmailAccountRepository(req.orgId!, req.user!.id);
    const accounts = await repo.findMany();

    // Map to safe public format (omit encryptedRefreshToken)
    const safeAccounts = accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      address: a.address,
      scopes: a.scopes,
      connectedAt: a.connectedAt
    }));

    res.json({
      success: true,
      data: safeAccounts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/email/oauth/connect/:provider
 * Generate authorization URL for Gmail or Outlook
 */
emailRouter.get(
  '/oauth/connect/:provider',
  requireAuth,
  requireRole('hr'),
  requireOrg,
  async (req, res, next) => {
    try {
      const provider = req.params.provider as 'gmail' | 'outlook';
      const redirectUri = (req.query.redirectUri as string) || `${req.protocol}://${req.get('host')}/api/v1/email/oauth/callback`;
      const state = Buffer.from(JSON.stringify({ userId: req.user!.id, orgId: req.orgId, provider })).toString('base64');

      const url = emailService.getOAuthUrl(provider, redirectUri, state);

      res.json({
        success: true,
        data: { url }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/email/oauth/callback
 * Handle OAuth code callback, encrypt refresh token with AES-256-GCM, and save account.
 */
emailRouter.post('/oauth/callback', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const { provider, code, redirectUri } = req.body;
    if (!provider || !code) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Provider and authorization code are required.');
    }

    const { address, refreshToken, scopes } = await emailService.exchangeOAuthCode(
      provider,
      code,
      redirectUri || `${req.protocol}://${req.get('host')}/api/v1/email/oauth/callback`
    );

    // Encrypt refresh token with AES-256-GCM
    const encryptedRefreshToken = encryptToken(refreshToken);

    const repo = getEmailAccountRepository(req.orgId!, req.user!.id);
    const account = await repo.upsert({
      provider,
      address,
      encryptedRefreshToken,
      scopes
    });

    await auditLogRepository.log({
      orgId: req.orgId!,
      actorId: req.user!.id,
      action: 'EMAIL_ACCOUNT_CONNECTED',
      entity: 'EmailAccount',
      entityId: account.id,
      meta: { provider, address }
    });

    res.json({
      success: true,
      data: {
        id: account.id,
        provider: account.provider,
        address: account.address,
        scopes: account.scopes,
        connectedAt: account.connectedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/email/mock-connect
 * For development & tests: connects a test Gmail or Outlook account immediately.
 */
emailRouter.post('/mock-connect', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const { provider = 'gmail', address } = req.body;
    const defaultAddress = provider === 'gmail' ? 'recruiter@acme-corp.com' : 'hr-team@acme-corp.onmicrosoft.com';
    const finalAddress = address || defaultAddress;

    const encryptedRefreshToken = encryptToken(`mock-refresh-token-${provider}-${Date.now()}`);
    const repo = getEmailAccountRepository(req.orgId!, req.user!.id);

    const account = await repo.upsert({
      provider,
      address: finalAddress,
      encryptedRefreshToken,
      scopes: provider === 'gmail' ? 'https://www.googleapis.com/auth/gmail.send' : 'Mail.Send'
    });

    res.json({
      success: true,
      data: {
        id: account.id,
        provider: account.provider,
        address: account.address,
        connectedAt: account.connectedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/email/accounts/:id
 * Disconnect and revoke email account
 */
emailRouter.delete('/accounts/:id', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const repo = getEmailAccountRepository(req.orgId!, req.user!.id);
    const account = await repo.findById(id);

    if (!account) {
      throw new AppError(404, 'NOT_FOUND', 'Email account not found.');
    }

    // Revoke with provider
    await emailService.revokeToken(account.provider as any, account.encryptedRefreshToken);
    await repo.delete(id);

    await auditLogRepository.log({
      orgId: req.orgId!,
      actorId: req.user!.id,
      action: 'EMAIL_ACCOUNT_DISCONNECTED',
      entity: 'EmailAccount',
      entityId: id,
      meta: { provider: account.provider, address: account.address }
    });

    res.json({
      success: true,
      message: 'Email account disconnected successfully.'
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. TEMPLATES & LIVE PREVIEW
// ==========================================

/**
 * GET /api/v1/email/batches/:batchId/templates
 * Retrieve shortlisted and unshortlisted templates for a batch
 */
emailRouter.get('/batches/:batchId/templates', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const templateRepo = getEmailTemplateRepository(req.orgId!);
    const templates = await templateRepo.findByBatch(batchId);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/email/batches/:batchId/templates
 * Update subject and body for shortlisted or unshortlisted template
 */
emailRouter.put('/batches/:batchId/templates', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const { kind, subject, body } = req.body;

    if (!kind || !['shortlisted', 'unshortlisted'].includes(kind)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Valid template kind (shortlisted or unshortlisted) is required.');
    }
    if (!subject || !subject.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Subject is required.');
    }
    if (!body || !body.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email body is required.');
    }

    const templateRepo = getEmailTemplateRepository(req.orgId!);
    const updated = await templateRepo.upsert({
      batchId,
      kind: kind as EmailTemplateKind,
      subject: subject.trim(),
      body: body.trim()
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/email/batches/:batchId/test
 * Sends a single test email with sample data to the logged-in HR's email address
 */
emailRouter.post('/batches/:batchId/test', requireAuth, requireRole('hr'), requireOrg, emailRateLimiter, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const { kind = 'shortlisted' } = req.body;

    const accountRepo = getEmailAccountRepository(req.orgId!, req.user!.id);
    const accounts = await accountRepo.findMany();
    const account = accounts[0];

    if (!account) {
      throw new AppError(
        400,
        'NO_SENDER_ACCOUNT',
        'No connected email account found. Please connect your Gmail or Outlook account first.'
      );
    }

    const batchRepo = getBatchRepository(req.orgId!);
    const batch = await batchRepo.findById(batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found.');

    const templateRepo = getEmailTemplateRepository(req.orgId!);
    const template = await templateRepo.findByBatchAndKind(batchId, kind as EmailTemplateKind);

    const org = await orgRepository.findById(req.orgId!);
    const company = org?.name || 'Recruiting Corp';

    const rendered = emailService.renderTemplate(template, {
      candidate_name: 'Jane Candidate (Test Sample)',
      job_title: batch.jobTitle,
      company
    });

    const hrEmail = req.user!.email;

    await emailService.sendEmail({
      provider: account.provider as any,
      encryptedRefreshToken: account.encryptedRefreshToken,
      fromAddress: account.address,
      toAddress: hrEmail,
      subject: `[TEST PREVIEW] ${rendered.subject}`,
      htmlBody: rendered.html
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${hrEmail}`
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 3. BATCH FINALIZATION & SENDING QUEUE
// ==========================================

/**
 * POST /api/v1/email/batches/:batchId/finalize
 * Finalize batch and enqueue personalized emails:
 * - BLOCKS if any candidate is in needs_review state
 * - Locks batch (status = 'finalized')
 * - Enqueues throttled pg-boss delivery jobs
 * - Audits finalization and dispatches
 */
emailRouter.post('/batches/:batchId/finalize', requireAuth, requireRole('hr'), requireOrg, emailRateLimiter, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const { confirmation } = req.body;

    if (confirmation !== 'SEND') {
      throw new AppError(400, 'CONFIRMATION_REQUIRED', 'Please type SEND to confirm finalization.');
    }

    const batchRepo = getBatchRepository(req.orgId!);
    const candidateRepo = getCandidateRepository(req.orgId!);
    const accountRepo = getEmailAccountRepository(req.orgId!, req.user!.id);
    const emailSendRepo = getEmailSendRepository(req.orgId!);

    const batch = await batchRepo.findById(batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found.');

    if (batch.status === BatchStatus.finalized) {
      throw new AppError(400, 'ALREADY_FINALIZED', 'This batch has already been finalized.');
    }

    // 1. Guardrail: Block finalizing while any needs_review candidate exists!
    const candidateCounts = await candidateRepo.countByBatch(batchId);
    if (candidateCounts.needsReview > 0) {
      throw new AppError(
        400,
        'HAS_NEEDS_REVIEW',
        `Cannot finalize batch with ${candidateCounts.needsReview} candidate(s) awaiting review. Please move each candidate to Shortlisted or Unshortlisted before sending decisions.`
      );
    }

    // 2. Verify connected sender
    const accounts = await accountRepo.findMany();
    const account = accounts[0];
    if (!account) {
      throw new AppError(
        400,
        'NO_SENDER_ACCOUNT',
        'Please connect a Gmail or Outlook account before finalizing and sending emails.'
      );
    }

    // 3. Lock the batch
    await batchRepo.update(batchId, {
      status: BatchStatus.finalized,
      finalizedAt: new Date()
    });

    // 4. Fetch candidates with definitive decisions
    const candidates = await candidateRepo.findManyByBatch(batchId);
    const emailableCandidates = candidates.filter(
      (c) =>
        (c.decision === CandidateDecision.shortlisted || c.decision === CandidateDecision.unshortlisted) &&
        c.email &&
        c.email !== 'NO_EMAIL' &&
        c.email.includes('@')
    );

    let queuedCount = 0;
    for (const cand of emailableCandidates) {
      // Create idempotent queued send row
      const emailSend = await emailSendRepo.createQueued(batchId, cand.id);

      // Enqueue throttled pg-boss job
      await jobQueue.enqueueEmailSend({
        emailSendId: emailSend.id,
        batchId,
        candidateId: cand.id,
        orgId: req.orgId!,
        ownerId: req.user!.id
      });

      queuedCount++;
    }

    // 5. AuditLog for finalization
    await auditLogRepository.log({
      orgId: req.orgId!,
      actorId: req.user!.id,
      action: 'BATCH_FINALIZED',
      entity: 'Batch',
      entityId: batchId,
      meta: {
        shortlistedCount: candidateCounts.shortlisted,
        unshortlistedCount: candidateCounts.unshortlisted,
        queuedCount,
        senderProvider: account.provider,
        senderAddress: account.address
      }
    });

    res.json({
      success: true,
      data: {
        batchId,
        status: 'finalized',
        finalizedAt: new Date(),
        queuedCount,
        shortlistedCount: candidateCounts.shortlisted,
        unshortlistedCount: candidateCounts.unshortlisted,
        senderAddress: account.address
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 4. DELIVERY STATUS TABLE & RETRIES
// ==========================================

/**
 * GET /api/v1/email/batches/:batchId/sends
 * List all email sends for a batch with recipient, status, and manual email indicators
 */
emailRouter.get('/batches/:batchId/sends', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const sendRepo = getEmailSendRepository(req.orgId!);
    const sends = await sendRepo.findByBatch(batchId);
    const stats = await sendRepo.getStats(batchId);

    res.json({
      success: true,
      data: {
        sends,
        stats
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/email/batches/:batchId/retry
 * Retries failed email sends
 */
emailRouter.post('/batches/:batchId/retry', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const sendRepo = getEmailSendRepository(req.orgId!);
    const retriedSends = await sendRepo.retryFailed(batchId);

    for (const send of retriedSends) {
      await jobQueue.enqueueEmailSend({
        emailSendId: send.id,
        batchId,
        candidateId: send.candidateId,
        orgId: req.orgId!,
        ownerId: req.user!.id
      });
    }

    res.json({
      success: true,
      retriedCount: retriedSends.length
    });
  } catch (error) {
    next(error);
  }
});

