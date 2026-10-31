import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  scoreResume,
  segmentSections,
  extractBasics,
  convertParsedToResumeData,
  validateIsJobDescription
} from '@shortlistiq/engine';
import {
  ResumeDataSchema,
  TemplateThemeOptionsSchema
} from '@shortlistiq/shared';
import { CheckStatus, SuggestionStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler.js';
import { candidateCheckRateLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth } from '../../middleware/auth.js';
import { parsePdf } from '../../services/pdf.js';
import { storageService, STORAGE_BUCKETS } from '../../services/storage.js';
import {
  candidateCheckRepository,
  suggestionRepository,
  orgRepository,
  auditLogRepository,
  candidateRepositoryGlobal
} from '../../repositories/index.js';
import { aiService } from '../../services/ai.js';
import {
  generateResumePdf,
  generateResumeDocx,
  verifyGeneratedPdf,
  generateResumeLatexPdf,
  generateLatexSource,
  compileLatexToPdf,
  assertExportGrounded
} from '../../services/export/index.js';
import { verifyTurnstile } from '../../services/turnstile.js';

export const checksRouter = Router();

// Configure Multer for in-memory PDF buffering (max 5 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

const UpdateSuggestionSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'edited']).optional(),
  finalText: z.string().optional()
});

/**
 * Helper to verify that caller owns or created the check
 */
async function getAuthorizedCheck(req: Request, checkId: string) {
  const userId = req.user?.id;
  const anonToken = req.anonToken;

  let check = null;
  if (userId) {
    check = await candidateCheckRepository.findByIdAndUser(checkId, userId);
  }
  if (!check && anonToken) {
    check = await candidateCheckRepository.findByIdAndToken(checkId, anonToken);
  }
  // Fallback: If caller has no token and no user (e.g. direct link in an environment without cookies/headers)
  if (!check && !userId && !anonToken) {
    const directCheck = await candidateCheckRepository.findById(checkId);
    if (directCheck && !directCheck.userId) {
      check = directCheck;
    }
  }

  if (!check) {
    throw new AppError(404, 'NOT_FOUND', 'Candidate check not found or access denied.');
  }

  return check;
}

/**
 * POST /api/v1/checks
 * Multipart upload: PDF file + job description text (+ optional jobTitle & company)
 * Applies daily check rate limits (3/day for guests, 10/day for signed-in users)
 */
checksRouter.post(
  '/',
  candidateCheckRateLimiter,
  upload.any(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await verifyTurnstile(req.body.turnstileToken || req.body['cf-turnstile-response'], req.ip);

      const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : (req.files as any)?.file?.[0] || (req.files as any)?.resume?.[0]);
      if (!file) {
        throw new AppError(400, 'MISSING_FILE', 'A PDF resume file is required.');
      }

      const jdText = typeof req.body.jdText === 'string' ? req.body.jdText.trim() : '';
      if (!jdText || jdText.length < 30) {
        throw new AppError(
          400,
          'INVALID_JD',
          'Job description is required and must contain at least 30 characters.'
        );
      }

      // Candidate-side checker accuracy: verify text resembles a legitimate job description
      const jdValidation = validateIsJobDescription(jdText);
      if (!jdValidation.isValid) {
        throw new AppError(
          400,
          'INVALID_JD',
          jdValidation.reason || 'The provided text does not appear to be a job description. Please paste a job description with requirements or responsibilities.'
        );
      }

      const jobTitle = typeof req.body.jobTitle === 'string' && req.body.jobTitle.trim()
        ? req.body.jobTitle.trim()
        : 'Target Position';

      const company = typeof req.body.company === 'string' && req.body.company.trim()
        ? req.body.company.trim()
        : null;

      // Clone buffer to prevent transferable memory detachment
      const fileBuffer = Buffer.from(file.buffer);

      // 1. Extract and validate text from PDF
      const pdfResult = await parsePdf(fileBuffer);
      const resumeText = pdfResult.text;

      // 2. Deterministic ATS scoring using framework-free engine
      const breakdown = scoreResume(resumeText, jdText);

      // 3. Upload PDF to private Supabase bucket
      const ownerId = req.user?.id || req.anonToken || 'guest';
      const uploadResult = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        ownerId,
        Buffer.from(file.buffer),
        file.mimetype || 'application/pdf'
      );

      // Phase 10: Retention calculation
      // 7 days for guests; org retention setting (30, 60, 90, default 60) for signed in users
      let retentionDays = 7;
      if (req.user?.id) {
        retentionDays = 60;
        if (req.user.orgId) {
          const org = await orgRepository.findById(req.user.orgId);
          if (org?.retentionDays) {
            retentionDays = org.retentionDays;
          }
        }
      }
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      // 4. Persist check in repository
      const check = await candidateCheckRepository.create({
        userId: req.user?.id || null,
        anonToken: req.anonToken || null,
        jobTitle,
        company,
        jdText,
        resumeText,
        resumePath: uploadResult.path,
        scoreBefore: breakdown.overallScore,
        scoreAfter: breakdown.overallScore,
        breakdown,
        status: CheckStatus.completed,
        expiresAt
      });

      res.status(201).json({
        success: true,
        data: {
          id: check.id,
          jobTitle: check.jobTitle,
          company: check.company,
          scoreBefore: check.scoreBefore,
          scoreAfter: check.scoreAfter,
          breakdown: check.breakdown,
          status: check.status,
          createdAt: check.createdAt
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/checks
 * Returns check history for authenticated user
 */
checksRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checks = await candidateCheckRepository.findByUserId(req.user!.id);
    res.json({
      success: true,
      data: checks.map((c) => ({
        id: c.id,
        jobTitle: c.jobTitle,
        company: c.company,
        scoreBefore: c.scoreBefore,
        scoreAfter: c.scoreAfter,
        status: c.status,
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/checks/:id
 * Retrieves check details and any existing suggestions
 */
checksRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    const check = await getAuthorizedCheck(req, checkId);
    const suggestions = await suggestionRepository.findByCheckId(check.id);

    res.json({
      success: true,
      data: {
        id: check.id,
        jobTitle: check.jobTitle,
        company: check.company,
        jdText: check.jdText,
        resumeText: check.resumeText,
        scoreBefore: check.scoreBefore,
        scoreAfter: check.scoreAfter,
        breakdown: check.breakdown,
        status: check.status,
        createdAt: check.createdAt,
        suggestions
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/checks/:id/suggestions
 * Makes ONE call to OpenRouter with resume sections, JD, and missing keywords.
 * Returns factual suggestions adhering to strict anti-hallucination rules.
 */
checksRouter.post('/:id/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    const check = await getAuthorizedCheck(req, checkId);

    // Return existing suggestions if already generated
    const existing = await suggestionRepository.findByCheckId(check.id);
    if (existing.length > 0) {
      return res.json({
        success: true,
        data: existing
      });
    }

    if (!check.resumeText) {
      throw new AppError(400, 'NO_RESUME_TEXT', 'Resume text is missing for this check.');
    }

    // Segment resume sections and gather missing keywords from breakdown
    const sections = segmentSections(check.resumeText);
    const missingKeywords = ((check.breakdown as any)?.missingKeywords as string[]) || [];

    const llmSuggestions = await aiService.generateSuggestionsForCheck({
      resumeSections: sections,
      jdText: check.jdText,
      missingKeywords
    });

    const created = await suggestionRepository.createMany(
      llmSuggestions.map((s) => ({
        checkId: check.id,
        section: s.section,
        originalText: s.originalText,
        proposedText: s.proposedText,
        reason: s.reason,
        impact: s.impact
      }))
    );

    res.status(201).json({
      success: true,
      data: created
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/checks/:id/suggestions/:suggestionId
 * Updates suggestion status ('accepted' | 'rejected' | 'edited') or final text
 */
checksRouter.patch(
  '/:id/suggestions/:suggestionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checkId = req.params.id as string;
      const suggestionId = req.params.suggestionId as string;
      const check = await getAuthorizedCheck(req, checkId);
      const parsed = UpdateSuggestionSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid suggestion update payload');
      }

      const suggestion = await suggestionRepository.findById(suggestionId);
      if (!suggestion || suggestion.checkId !== check.id) {
        throw new AppError(404, 'NOT_FOUND', 'Suggestion not found for this check.');
      }

      const updated = await suggestionRepository.update(suggestion.id, {
        status: parsed.data.status as SuggestionStatus | undefined,
        finalText: parsed.data.finalText
      });

      // If client provided a recomputed scoreAfter, update the candidate check
      if (typeof req.body.projectedScore === 'number') {
        await candidateCheckRepository.update(check.id, {
          scoreAfter: Math.min(100, Math.max(0, Math.round(req.body.projectedScore)))
        });
      }

      res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/checks/:id/resume-data
 * Converts parsed resume and accepted suggestions into structured ResumeData schema
 */
checksRouter.get('/:id/resume-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    const check = await getAuthorizedCheck(req, checkId);

    if (!check.resumeText) {
      throw new AppError(400, 'NO_RESUME_TEXT', 'Resume text is missing for this check.');
    }

    const basics = extractBasics(check.resumeText);
    const sections = segmentSections(check.resumeText);
    const suggestions = await suggestionRepository.findByCheckId(check.id);
    const accepted = suggestions.filter((s) => s.status === 'accepted' || s.status === 'edited');

    const conversion = convertParsedToResumeData(check.resumeText, basics, sections, accepted);

    res.json({
      success: true,
      data: {
        resumeData: conversion.data,
        isConfident: conversion.isConfident,
        missingFields: conversion.missingFields
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/checks/:id/export/pdf
 * Generates ATS-compliant PDF using standard embedded fonts, re-parses it to verify
 * ATS compliance and final score, and returns binary or verification payload.
 */
checksRouter.post('/:id/export/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    let check: any = null;
    try {
      check = await getAuthorizedCheck(req, checkId);
    } catch (e) {
      if (!req.body.resumeData) throw e;
    }

    const resumeParsed = ResumeDataSchema.safeParse(req.body.resumeData);
    if (!resumeParsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid resume data format');
    }

    const optionsParsed = TemplateThemeOptionsSchema.safeParse(req.body.options || {});
    const options = optionsParsed.success
      ? optionsParsed.data
      : { template: 'modern' as const, accentColor: 'indigo' as const, fontSize: 'medium' as const, margins: 'normal' as const };

    const pdfBuffer = await generateResumePdf(resumeParsed.data, options);

    // Re-parse with Phase 3 engine to verify 100% extractability and compute verified ATS score
    const verification = await verifyGeneratedPdf(pdfBuffer, check?.jdText || '');

    // If authenticated user, save in Supabase storage generated bucket
    if (req.user?.id) {
      await storageService.uploadFile(
        STORAGE_BUCKETS.GENERATED,
        req.user.id,
        pdfBuffer,
        'application/pdf'
      );
    }

    // Direct download stream
    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(resumeParsed.data.contact.fullName || 'Resume').replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    }

    res.json({
      success: true,
      data: {
        verification,
        base64: pdfBuffer.toString('base64')
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/checks/:id/export/docx
 * Generates native Word (.docx) resume with standard headings and single-column formatting
 */
checksRouter.post('/:id/export/docx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    let _check: any = null;
    try {
      _check = await getAuthorizedCheck(req, checkId);
    } catch (e) {
      if (!req.body.resumeData) throw e;
    }

    const resumeParsed = ResumeDataSchema.safeParse(req.body.resumeData);
    if (!resumeParsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid resume data format');
    }

    const optionsParsed = TemplateThemeOptionsSchema.safeParse(req.body.options || {});
    const options = optionsParsed.success
      ? optionsParsed.data
      : { template: 'modern' as const, accentColor: 'indigo' as const, fontSize: 'medium' as const, margins: 'normal' as const };

    const docxBuffer = await generateResumeDocx(resumeParsed.data, options);

    // If authenticated user, save in Supabase storage
    if (req.user?.id) {
      await storageService.uploadFile(
        STORAGE_BUCKETS.GENERATED,
        req.user.id,
        docxBuffer,
        'application/pdf' // mock storage accepts buffer
      );
    }

    const filename = `${(resumeParsed.data.contact.fullName || 'Resume').replace(/[^a-zA-Z0-9]/g, '_')}_Resume.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.send(docxBuffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/checks/:id/export/latex-source
 * Generates and returns raw LaTeX source code for the candidate's resume so they can view and edit it in the UI.
 */
checksRouter.post('/:id/export/latex-source', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    let _check: any = null;
    try {
      _check = await getAuthorizedCheck(req, checkId);
    } catch (e) {
      if (!req.body.resumeData) throw e;
    }

    const resumeParsed = ResumeDataSchema.safeParse(req.body.resumeData);
    if (!resumeParsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid resume data format');
    }

    const optionsParsed = TemplateThemeOptionsSchema.safeParse(req.body.options || {});
    const latexOpts = optionsParsed.success ? optionsParsed.data : {};

    const latexSource = generateLatexSource(resumeParsed.data, latexOpts);

    res.json({
      success: true,
      data: {
        latexSource
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/checks/:id/export/latex-pdf
 * Compiles a LaTeX resume PDF server-side.
 * Supports compiling either user-edited custom LaTeX code (latexSource) or structured ResumeData.
 * Uses free cloud LaTeX compiler — no Overleaf, no external redirect needed.
 */
checksRouter.post('/:id/export/latex-pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checkId = req.params.id as string;
    let _check: any = null;
    try {
      _check = await getAuthorizedCheck(req, checkId);
    } catch (e) {
      if (!req.body.resumeData && !req.body.latexSource) throw e;
    }

    let pdfBuffer: Buffer;
    let candidateName = 'Resume';

    if (typeof req.body.latexSource === 'string' && req.body.latexSource.trim().length > 0) {
      // Compile user-edited custom LaTeX code directly
      pdfBuffer = await compileLatexToPdf(req.body.latexSource);
      if (req.body.resumeData?.contact?.fullName) {
        candidateName = req.body.resumeData.contact.fullName;
      }
    } else {
      // Standard generation from ResumeData
      const resumeParsed = ResumeDataSchema.safeParse(req.body.resumeData);
      if (!resumeParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid resume data format');
      }

      const optionsParsed = TemplateThemeOptionsSchema.safeParse(req.body.options || {});
      const latexOpts = optionsParsed.success ? optionsParsed.data : {};

      pdfBuffer = await generateResumeLatexPdf(resumeParsed.data, latexOpts);
      candidateName = resumeParsed.data.contact.fullName || 'Resume';
    }

    const filename = `${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}_LaTeX.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Export-Format', 'latex-pdf');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/checks/self/data
 * Signed-in candidate deletes all checks, generated resumes, and application records
 */
checksRouter.delete('/self/data', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // 1. Delete all candidate checks and their storage files
    const { deletedCount: checkCount, resumePaths } = await candidateCheckRepository.deleteByUserId(userId);
    for (const path of resumePaths) {
      try {
        await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, path);
      } catch {
        // Ignored
      }
    }

    // 2. Delete all application candidate rows matching candidate's email across orgs
    let applicationCount = 0;
    if (userEmail) {
      const { deletedCount, deletedResumePaths, affectedOrgIds } =
        await candidateRepositoryGlobal.deleteByEmail(userEmail);
      applicationCount = deletedCount;
      for (const path of deletedResumePaths) {
        try {
          await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, path);
        } catch {
          // Ignored
        }
      }

      // Notify affected HR orgs without personal data
      for (const orgId of affectedOrgIds) {
        await auditLogRepository.log({
          orgId,
          actorId: userId,
          action: 'CANDIDATE_DATA_DELETED_BY_REQUEST',
          entity: 'Candidate',
          entityId: 'anonymized',
          meta: {
            message: 'Candidate requested self-service deletion of application records.',
            deletedAt: new Date().toISOString()
          }
        });
      }
    }

    res.json({
      success: true,
      message: 'All checks, resume documents, and application data have been permanently deleted.',
      data: {
        checksDeleted: checkCount,
        applicationsDeleted: applicationCount
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/checks/:id
 * Signed-in candidate can delete an individual check and its storage object
 */
checksRouter.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const check = await candidateCheckRepository.findByIdAndUser(id, req.user!.id);
    if (!check) {
      throw new AppError(404, 'NOT_FOUND', 'Candidate check not found or access denied.');
    }

    if (check.resumePath) {
      try {
        await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, check.resumePath);
      } catch {
        // Ignored
      }
    }

    await candidateCheckRepository.delete(id);

    res.json({
      success: true,
      message: 'Candidate check and associated files successfully deleted.'
    });
  } catch (err) {
    next(err);
  }
});
