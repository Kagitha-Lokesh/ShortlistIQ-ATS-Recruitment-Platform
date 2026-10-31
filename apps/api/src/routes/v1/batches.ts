import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireOrg } from '../../middleware/tenancy.js';
import { validate } from '../../middleware/validate.js';
import { getBatchRepository, getCandidateRepository, auditLogRepository } from '../../repositories/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { storageService, STORAGE_BUCKETS } from '../../services/storage.js';
import { jobQueue } from '../../services/queue.js';
import { BatchStatus, CandidateStatus, CandidateDecision } from '@prisma/client';
import { aiService } from '../../services/ai.js';
import { scoreAgainstCriteria } from '@shortlistiq/engine';

export const batchRouter = Router();

batchRouter.use(requireAuth, requireRole('hr'), requireOrg);

const CreateBatchSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  jdText: z.string().min(1, 'Job description is required'),
  criteria: z.record(z.any()).optional().default({}),
  cutoff: z.coerce.number().int().min(0).max(100).optional().default(70),
  status: z.nativeEnum(BatchStatus).optional().default(BatchStatus.active)
});

const UpdateBatchSchema = z.object({
  name: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  jdText: z.string().min(1).optional(),
  criteria: z.record(z.any()).optional(),
  cutoff: z.coerce.number().int().min(0).max(100).optional(),
  status: z.nativeEnum(BatchStatus).optional()
});

const UpdateCandidateDecisionSchema = z.object({
  decision: z.nativeEnum(CandidateDecision)
});

const BulkDecisionSchema = z.object({
  candidateIds: z.array(z.string()),
  decision: z.nativeEnum(CandidateDecision)
});

const SaveCriteriaSchema = z.object({
  criteria: z.record(z.any()).optional(),
  cutoff: z.coerce.number().int().min(0).max(100).optional(),
  alwaysRequireMustHaves: z.boolean().optional()
});

// Multer memory storage configured with 5 MB per file and max 10 files per request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  }
});

// List all batches with candidate counts for current organization
batchRouter.get('/', async (req, res, next) => {
  try {
    const repo = getBatchRepository(req.orgId!);
    const batches = await repo.findManyWithCounts();
    res.json({ success: true, data: batches });
  } catch (error) {
    next(error);
  }
});

// Create new batch (draft or active) for current organization
batchRouter.post('/', validate({ body: CreateBatchSchema }), async (req, res, next) => {
  try {
    const { name, jobTitle, jdText, criteria, cutoff, status } = req.body;

    const repo = getBatchRepository(req.orgId!);
    const batch = await repo.create({
      name,
      jobTitle,
      jdText,
      criteria: criteria || {},
      cutoff: cutoff !== undefined ? Number(cutoff) : 70,
      ownerId: req.user!.id,
      status: status || BatchStatus.active
    });

    res.status(201).json({ success: true, data: batch });
  } catch (error) {
    next(error);
  }
});

// Get batch by ID with live candidate counts (scoped to organization)
batchRouter.get('/:id', async (req, res, next) => {
  try {
    const batchRepo = getBatchRepository(req.orgId!);
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchId = req.params.id as string;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    const counts = await candidateRepo.countByBatch(batch.id);

    res.json({
      success: true,
      data: {
        ...batch,
        candidateCounts: counts
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update batch details (save draft, edit criteria, or publish)
batchRouter.patch('/:id', validate({ body: UpdateBatchSchema }), async (req, res, next) => {
  try {
    const repo = getBatchRepository(req.orgId!);
    const { name, jobTitle, jdText, criteria, cutoff, status } = req.body;
    const batchId = req.params.id as string;

    const updated = await repo.update(batchId, {
      ...(name && { name }),
      ...(jobTitle && { jobTitle }),
      ...(jdText && { jdText }),
      ...(criteria !== undefined && { criteria }),
      ...(cutoff !== undefined && { cutoff: Number(cutoff) }),
      ...(status && { status })
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// List candidates for batch (scoped to organization, with optional filters)
batchRouter.get('/:id/candidates', async (req, res, next) => {
  try {
    const repo = getCandidateRepository(req.orgId!);
    const batchId = req.params.id as string;
    const { status, decision } = req.query;

    const candidates = await repo.findManyByBatch(batchId, {
      ...(status && { status: status as any }),
      ...(decision && { decision: decision as any })
    });

    res.json({ success: true, data: candidates });
  } catch (error) {
    next(error);
  }
});

// Bulk upload candidates (chunks of 5 to 10 files)
batchRouter.post(
  '/:id/candidates/upload',
  upload.array('files', 10),
  async (req, res, next) => {
    try {
      const batchRepo = getBatchRepository(req.orgId!);
      const candidateRepo = getCandidateRepository(req.orgId!);
      const batchId = req.params.id as string;

      const batch = await batchRepo.findById(batchId);
      if (!batch) {
        throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one PDF file to upload.');
      }

      const createdCandidates = [];

      for (const file of files) {
        let resumePath: string | null = null;
        let isCorrupt = false;

        try {
          const uploadRes = await storageService.uploadFile(
            STORAGE_BUCKETS.RESUMES,
            req.orgId!,
            file.buffer,
            file.mimetype || 'application/pdf'
          );
          resumePath = uploadRes.path;
        } catch (err) {
          isCorrupt = true;
        }

        if (isCorrupt || !resumePath) {
          // File failed validation/upload (corrupt or non-pdf)
          const failedCandidate = await candidateRepo.create({
            batchId: batch.id,
            fullName: file.originalname.replace(/\.pdf$/i, ''),
            email: '',
            status: CandidateStatus.failed,
            failureReason: 'CORRUPT'
          });
          createdCandidates.push(failedCandidate);
          continue;
        }

        // Create pending candidate
        const candidate = await candidateRepo.create({
          batchId: batch.id,
          fullName: file.originalname.replace(/\.pdf$/i, ''),
          email: '',
          resumePath,
          status: CandidateStatus.pending
        });

        // Enqueue background processing job
        await jobQueue.enqueueCandidateProcess({
          candidateId: candidate.id,
          orgId: req.orgId!,
          batchId: batch.id
        });

        createdCandidates.push(candidate);
      }

      res.status(201).json({
        success: true,
        data: createdCandidates,
        uploadedCount: createdCandidates.length
      });
    } catch (error) {
      next(error);
    }
  }
);

// Retry failed candidates in batch
batchRouter.post('/:id/candidates/retry', async (req, res, next) => {
  try {
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchRepo = getBatchRepository(req.orgId!);
    const batchId = req.params.id as string;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    const retriedCandidates = await candidateRepo.retryFailed(batch.id);

    // Re-enqueue all retried candidates
    for (const candidate of retriedCandidates) {
      await jobQueue.enqueueCandidateProcess({
        candidateId: candidate.id,
        orgId: req.orgId!,
        batchId: batch.id
      });
    }

    res.json({
      success: true,
      retriedCount: retriedCandidates.length,
      data: retriedCandidates
    });
  } catch (error) {
    next(error);
  }
});

// Update candidate details (e.g. manually provide email for NO_EMAIL candidates, notes)
batchRouter.patch('/:id/candidates/:candidateId', async (req, res, next) => {
  try {
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchRepo = getBatchRepository(req.orgId!);
    const { email, fullName, phone, notes } = req.body;
    const batchId = req.params.id as string;
    const candidateId = req.params.candidateId as string;

    const batch = await batchRepo.findById(batchId);
    if (batch?.status === BatchStatus.finalized) {
      throw new AppError(400, 'BATCH_LOCKED', 'This batch has been finalized. Candidate details cannot be modified.');
    }

    const candidate = await candidateRepo.findById(candidateId);
    if (!candidate || candidate.batchId !== batchId) {
      throw new AppError(404, 'NOT_FOUND', 'Candidate not found in this batch.');
    }

    const shouldRequeue =
      candidate.status === CandidateStatus.failed &&
      candidate.failureReason === 'NO_EMAIL' &&
      Boolean(email);

    const updated = await candidateRepo.update(candidate.id, {
      ...(email && { email }),
      ...(fullName && { fullName }),
      ...(phone !== undefined && { phone }),
      ...(notes !== undefined && { formAnswers: { ...(candidate.formAnswers as any), notes } }),
      ...(shouldRequeue && { status: CandidateStatus.pending, failureReason: null })
    });

    if (shouldRequeue) {
      await jobQueue.enqueueCandidateProcess({
        candidateId: candidate.id,
        orgId: req.orgId!,
        batchId
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Phase 7: AI Criteria Suggestions from Job Description (ONE cached LLM call)
batchRouter.post('/:id/criteria/suggest', async (req, res, next) => {
  try {
    const batchRepo = getBatchRepository(req.orgId!);
    const batchId = req.params.id as string;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    const suggestedChips = await aiService.suggestCriteriaItemsFromJd(batch.jobTitle, batch.jdText);
    res.json({ success: true, data: suggestedChips });
  } catch (error) {
    next(error);
  }
});

// Phase 7: Criteria Preview - Scores up to 5 sample candidates without saving
batchRouter.post('/:id/criteria/preview', async (req, res, next) => {
  try {
    const batchRepo = getBatchRepository(req.orgId!);
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchId = req.params.id as string;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    if (batch.status === BatchStatus.finalized) {
      throw new AppError(400, 'BATCH_LOCKED', 'This batch has been finalized. Criteria cannot be modified.');
    }

    const { criteria, cutoff, alwaysRequireAllMustHaves } = req.body;
    const effectiveCutoff = cutoff !== undefined ? Number(cutoff) : (batch.cutoff ?? 70);

    const candidates = await candidateRepo.findManyByBatch(batchId);
    const sampleCandidates = candidates.filter((c) => c.resumeText).slice(0, 5);

    const previewResults = sampleCandidates.map((c) => {
      const evaluation = scoreAgainstCriteria(c.resumeText!, batch.jdText, {
        cutoff: effectiveCutoff,
        criteria: Array.isArray(criteria) ? criteria : [],
        alwaysRequireAllMustHaves: Boolean(alwaysRequireAllMustHaves)
      });

      return {
        candidateId: c.id,
        fullName: c.fullName,
        email: c.email,
        score: evaluation.overallScore,
        decision: evaluation.decision,
        decisionReason: evaluation.decisionReason,
        failedMustHavesCount: evaluation.failedMustHavesCount,
        dealbreakerTriggered: evaluation.dealbreakerTriggered,
        criteriaResults: evaluation.criteriaResults
      };
    });

    res.json({ success: true, data: previewResults });
  } catch (error) {
    next(error);
  }
});

// Phase 7: Save Criteria & Cutoff, then enqueue background re-score job per candidate
batchRouter.put('/:id/criteria', async (req, res, next) => {
  try {
    const batchRepo = getBatchRepository(req.orgId!);
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchId = req.params.id as string;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    if (batch.status === BatchStatus.finalized) {
      throw new AppError(400, 'BATCH_LOCKED', 'This batch has been finalized. Criteria cannot be modified.');
    }

    const { criteria, cutoff, alwaysRequireAllMustHaves } = req.body;

    const updatedBatch = await batchRepo.update(batchId, {
      criteria: {
        items: Array.isArray(criteria) ? criteria : (criteria?.items || []),
        alwaysRequireAllMustHaves: Boolean(alwaysRequireAllMustHaves)
      },
      ...(cutoff !== undefined && { cutoff: Number(cutoff) })
    });

    // Enqueue re-score job for all candidates in the batch
    const candidates = await candidateRepo.findManyByBatch(batchId);
    let enqueuedCount = 0;

    for (const c of candidates) {
      if (c.status !== CandidateStatus.failed || c.failureReason === 'DUPLICATE') {
        await jobQueue.enqueueCandidateProcess({
          candidateId: c.id,
          orgId: req.orgId!,
          batchId,
          isRescore: true
        });
        enqueuedCount++;
      }
    }

    res.json({
      success: true,
      data: updatedBatch,
      enqueuedCount
    });
  } catch (error) {
    next(error);
  }
});

// Phase 7: Bulk Candidate Decision Override (moves to shortlisted, unshortlisted, needs_review)
batchRouter.post('/:id/candidates/bulk-decision', validate({ body: BulkDecisionSchema }), async (req, res, next) => {
  try {
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchRepo = getBatchRepository(req.orgId!);
    const batchId = req.params.id as string;
    const { candidateIds, decision } = req.body;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    if (batch.status === BatchStatus.finalized) {
      throw new AppError(400, 'BATCH_LOCKED', 'This batch has been finalized. Candidate decisions cannot be modified.');
    }

    if (!Array.isArray(candidateIds) || candidateIds.length === 0 || !decision) {
      throw new AppError(400, 'VALIDATION_ERROR', 'candidateIds array and target decision are required.');
    }

    if (!['shortlisted', 'unshortlisted', 'needs_review'].includes(decision)) {
      throw new AppError(400, 'INVALID_DECISION', 'Invalid decision value.');
    }

    const updatedCandidates = await candidateRepo.bulkUpdateDecision(
      batchId,
      candidateIds,
      decision as CandidateDecision,
      req.user!.id
    );

    res.json({
      success: true,
      updatedCount: updatedCandidates.length,
      data: updatedCandidates
    });
  } catch (error) {
    next(error);
  }
});

// Phase 7: Fetch Short-Lived Signed URL for Candidate Resume PDF Preview
batchRouter.get('/:id/candidates/:candidateId/resume-url', async (req, res, next) => {
  try {
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchId = req.params.id as string;
    const candidateId = req.params.candidateId as string;

    const candidate = await candidateRepo.findById(candidateId);
    if (!candidate || candidate.batchId !== batchId) {
      throw new AppError(404, 'NOT_FOUND', 'Candidate not found in this batch.');
    }

    if (!candidate.resumePath) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'No resume file associated with this candidate.');
    }

    const signed = await storageService.createSignedUrl(
      STORAGE_BUCKETS.RESUMES,
      candidate.resumePath,
      req.orgId!,
      300 // 5 minutes
    );

    res.json({ success: true, data: signed });
  } catch (error) {
    next(error);
  }
});

// Phase 7: Export Candidates to CSV
batchRouter.get('/:id/export/csv', async (req, res, next) => {
  try {
    const batchRepo = getBatchRepository(req.orgId!);
    const candidateRepo = getCandidateRepository(req.orgId!);
    const batchId = req.params.id as string;

    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization.');
    }

    const candidates = await candidateRepo.findManyByBatch(batchId);

    // Escape CSV values
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'ID',
      'Name',
      'Email',
      'Phone',
      'Score',
      'Decision',
      'Decision Source',
      'Matched Must Haves',
      'Status',
      'Failure Reason'
    ];

    const rows = candidates.map((c) => {
      let matchedMustHaves = '';
      if (Array.isArray(c.criteriaResults)) {
        const mustHaves = c.criteriaResults.filter(
          (cr: any) => cr.type === 'must_have' || cr.type === 'must-have'
        );
        const passedCount = mustHaves.filter((cr: any) => cr.passed).length;
        matchedMustHaves = `${passedCount}/${mustHaves.length}`;
      }

      return [
        escapeCsv(c.id),
        escapeCsv(c.fullName),
        escapeCsv(c.email),
        escapeCsv(c.phone),
        escapeCsv(c.score),
        escapeCsv(c.decision),
        escapeCsv(c.decisionSource),
        escapeCsv(matchedMustHaves),
        escapeCsv(c.status),
        escapeCsv(c.failureReason)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${batch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_candidates.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

// Phase 10: Delete a Batch (rows and files)
batchRouter.delete('/:id', async (req, res, next) => {
  try {
    const batchRepo = getBatchRepository(req.orgId!);
    const batchId = req.params.id as string;

    const { deleted, candidateCount, resumePaths, batchName } = await batchRepo.delete(batchId);

    // Clean up all storage files associated with the batch
    for (const path of resumePaths) {
      try {
        await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, path);
      } catch {
        // Ignored
      }
    }

    // Write audit log entry (no personal data)
    await auditLogRepository.log({
      orgId: req.orgId!,
      actorId: req.user!.id,
      action: 'BATCH_DELETED',
      entity: 'Batch',
      entityId: batchId,
      meta: {
        batchName,
        candidateCount,
        filesDeleted: resumePaths.length
      }
    });

    res.json({
      success: true,
      message: `Batch '${batchName}' and ${candidateCount} candidate records were deleted.`,
      data: {
        batchId,
        candidateCount,
        filesDeleted: resumePaths.length
      }
    });
  } catch (error) {
    next(error);
  }
});
