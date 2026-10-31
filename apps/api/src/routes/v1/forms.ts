import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import {
  CreateFormInputSchema,
  UpdateFormInputSchema,
  evaluateFormKnockoutRules,
  LOCKED_MANDATORY_FIELDS
} from '@shortlistiq/shared';
import {
  CandidateDecision,
  CandidateSource,
  CandidateStatus,
  DecisionSource
} from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireOrg } from '../../middleware/tenancy.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  getFormRepository,
  publicFormRepository,
  getCandidateRepository,
  getBatchRepository
} from '../../repositories/index.js';
import { storageService } from '../../services/storage.js';
import { parsePdf } from '../../services/pdf.js';
import { jobQueue } from '../../services/queue.js';
import { logger } from '../../logger.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';
import { verifyTurnstile } from '../../services/turnstile.js';

export const formsRouter = Router();

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only text-based PDF resumes are supported.'));
    }
  }
});

// Rate limiter for public form submissions: 15 submissions per 10 minutes per IP
const publicSubmissionLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'Too many applications submitted from this IP. Please try again later.'
});

// ==========================================
// PUBLIC FORM ENDPOINTS (No Auth Required)
// ==========================================

/**
 * GET /api/v1/forms/public/:slug
 * Fetch public form metadata and schema for the candidate application page.
 * Does NOT expose internal knockout rules to prevent gaming.
 */
formsRouter.get('/public/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const form = await publicFormRepository.findBySlug(slug);

    if (!form) {
      throw new AppError(404, 'FORM_NOT_FOUND', 'The requested application form does not exist.');
    }

    // Fetch batch job title and company if available
    const batchRepo = getBatchRepository(form.orgId);
    const batch = await batchRepo.findById(form.batchId);

    res.json({
      success: true,
      data: {
        id: form.id,
        slug: form.slug,
        title: form.title,
        jobTitle: batch?.jobTitle || form.title,
        isPublished: form.isPublished,
        schema: form.schema,
        createdAt: form.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/forms/public/:slug/submit
 * Public candidate submission with:
 * - Rate limiting
 * - Honeypot check
 * - Cloudflare Turnstile verification
 * - Closed form check
 * - Schema validation
 * - PDF extraction & validation
 * - Immediate Knockout evaluation (decisionSource: knockout)
 * - Automatic scoring enqueue for passing candidates
 */
formsRouter.post(
  '/public/:slug/submit',
  publicSubmissionLimiter,
  upload.single('resume'),
  async (req, res, next) => {
    try {
      const slug = req.params.slug as string;
      const form = await publicFormRepository.findBySlug(slug);

      if (!form) {
        throw new AppError(404, 'FORM_NOT_FOUND', 'This application form was not found.');
      }

      // 1. Check if the form is published / closed
      if (!form.isPublished) {
        throw new AppError(
          400,
          'FORM_CLOSED',
          'This application form is closed and is no longer accepting new submissions.'
        );
      }

      // 2. Honeypot check (anti-bot)
      const honeypotVal = req.body.honeypot || req.body._hp || req.body.website;
      if (honeypotVal && String(honeypotVal).trim().length > 0) {
        logger.warn({ slug, ip: req.ip }, 'Honeypot triggered on public application form');
        throw new AppError(400, 'BOT_DETECTED', 'Spam detection triggered.');
      }

      // 3. Cloudflare Turnstile Verification
      const turnstileToken = req.body.turnstileToken || req.body['cf-turnstile-response'];
      await verifyTurnstile(turnstileToken, req.ip);

      // 4. Validate mandatory candidate basics & consent
      const fullName = (req.body.fullName || '').trim();
      const email = (req.body.email || '').trim().toLowerCase();
      const phone = (req.body.phone || '').trim();
      const consent = req.body.consent === true || req.body.consent === 'true';

      if (!fullName || fullName.length < 2) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Full name is required.');
      }
      if (!email || !email.includes('@')) {
        throw new AppError(400, 'VALIDATION_ERROR', 'A valid contact email address is required.');
      }
      if (!phone || phone.length < 3) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Phone number is required.');
      }
      if (!consent) {
        throw new AppError(
          400,
          'CONSENT_REQUIRED',
          'You must consent to data processing and retention to submit this application.'
        );
      }

      // 5. Validate Resume PDF file
      if (!req.file || !req.file.buffer) {
        throw new AppError(400, 'MISSING_RESUME', 'Please upload your resume in PDF format.');
      }

      const pdfBuffer = req.file.buffer;
      const pdfExtraction = await parsePdf(pdfBuffer);
      const parsedText = pdfExtraction.text || '';

      if (parsedText.length < 100) {
        throw new AppError(
          400,
          'NO_TEXT',
          'The uploaded resume contains no extractable text or is an image scan. Please upload a standard text PDF.'
        );
      }

      // 6. Parse and validate form custom answers against schema
      let answers: Record<string, any> = {};
      if (req.body.answers) {
        if (typeof req.body.answers === 'string') {
          try {
            answers = JSON.parse(req.body.answers);
          } catch {
            answers = {};
          }
        } else if (typeof req.body.answers === 'object') {
          answers = req.body.answers;
        }
      }

      // Verify custom required fields
      const schemaFields: any[] = (form.schema as any)?.fields || [];
      for (const field of schemaFields) {
        if (field.required && !field.isLocked) {
          const answerVal = answers[field.id];
          if (answerVal === undefined || answerVal === null || String(answerVal).trim() === '') {
            throw new AppError(400, 'VALIDATION_ERROR', `Missing required answer for "${field.label}"`);
          }
        }
      }

      // 7. Store Resume PDF file
      const fileKey = `forms/${form.id}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploadResult = await storageService.uploadFile('resumes', fileKey, pdfBuffer, 'application/pdf');
      const resumePath = uploadResult.path;

      // 8. Generate deduplication key
      const textHash = crypto.createHash('sha256').update(parsedText.slice(0, 500)).digest('hex').slice(0, 16);
      const dedupeKey = `${email}:${textHash}`;

      // 9. Evaluate Knockout Rules
      const knockoutRules = Array.isArray(form.knockoutRules) ? (form.knockoutRules as any[]) : [];
      const knockoutResult = evaluateFormKnockoutRules(knockoutRules, answers);

      const candidateRepo = getCandidateRepository(form.orgId);
      const consentAt = new Date();

      if (knockoutResult.knockedOut) {
        // Immediate Auto-Rejection (Knockout)
        // Candidate remains visible to HR with decision: unshortlisted, decisionSource: knockout, failureReason: knockout reason
        const candidate = await candidateRepo.create({
          batchId: form.batchId,
          source: CandidateSource.form,
          fullName,
          email,
          phone,
          resumePath,
          resumeText: parsedText,
          formAnswers: answers,
          status: CandidateStatus.scored,
          decision: CandidateDecision.unshortlisted,
          decisionSource: DecisionSource.knockout,
          score: 0,
          failureReason: `Knockout: ${knockoutResult.reason}`,
          dedupeKey,
          consentAt
        });

        const referenceNumber = `APP-${candidate.id.slice(0, 8).toUpperCase()}`;

        logger.info(
          { candidateId: candidate.id, batchId: form.batchId, ruleId: knockoutResult.ruleId },
          'Candidate auto-rejected via form knockout rule'
        );

        return res.status(201).json({
          success: true,
          referenceNumber,
          decision: 'unshortlisted',
          knockout: true,
          message: 'Your application has been received and recorded.'
        });
      }

      // 10. Non-knockout: Create pending candidate and enqueue background scoring
      const candidate = await candidateRepo.create({
        batchId: form.batchId,
        source: CandidateSource.form,
        fullName,
        email,
        phone,
        resumePath,
        resumeText: parsedText,
        formAnswers: answers,
        status: CandidateStatus.pending,
        dedupeKey,
        consentAt
      });

      // Enqueue background worker processing
      await jobQueue.enqueueCandidateProcess({
        candidateId: candidate.id,
        orgId: form.orgId,
        batchId: form.batchId
      });

      const referenceNumber = `APP-${candidate.id.slice(0, 8).toUpperCase()}`;

      logger.info(
        { candidateId: candidate.id, batchId: form.batchId },
        'Candidate application submitted and enqueued for scoring'
      );

      res.status(201).json({
        success: true,
        referenceNumber,
        message: 'Application submitted successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// HR PROTECTED FORM ENDPOINTS
// ==========================================

/**
 * GET /api/v1/forms/batch/:batchId
 * List all forms created for a specific batch, with submission counts.
 */
formsRouter.get('/batch/:batchId', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const batchId = req.params.batchId as string;
    const formRepo = getFormRepository(req.orgId!);
    const forms = await formRepo.findByBatch(batchId);

    res.json({
      success: true,
      data: forms
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/forms
 * Create a new application form attached to a batch.
 */
formsRouter.post('/', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const parsed = CreateFormInputSchema.parse(req.body);
    const formRepo = getFormRepository(req.orgId!);

    const form = await formRepo.create({
      batchId: parsed.batchId,
      title: parsed.title,
      slug: parsed.slug,
      schema: parsed.schema,
      knockoutRules: parsed.knockoutRules,
      isPublished: parsed.isPublished ?? true
    });

    res.status(201).json({
      success: true,
      data: form
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/forms/:id
 * Get details of a single form by ID.
 */
formsRouter.get('/:id', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const formRepo = getFormRepository(req.orgId!);
    const form = await formRepo.findById(id);

    if (!form) {
      throw new AppError(404, 'NOT_FOUND', 'Form not found in this organization');
    }

    res.json({
      success: true,
      data: form
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/forms/:id
 * Update an existing form's schema, title, knockout rules or publish state.
 */
formsRouter.put('/:id', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const parsed = UpdateFormInputSchema.parse(req.body);
    const formRepo = getFormRepository(req.orgId!);

    const updated = await formRepo.update(id, parsed);

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/forms/:id/toggle-publish
 * Toggle form published state (Closing stops new submissions without deleting data).
 */
formsRouter.post('/:id/toggle-publish', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const formRepo = getFormRepository(req.orgId!);

    const toggled = await formRepo.togglePublished(id);

    res.json({
      success: true,
      data: toggled
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/forms/:id
 * Delete a form.
 */
formsRouter.delete('/:id', requireAuth, requireRole('hr'), requireOrg, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const formRepo = getFormRepository(req.orgId!);
    await formRepo.delete(id);

    res.json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});
