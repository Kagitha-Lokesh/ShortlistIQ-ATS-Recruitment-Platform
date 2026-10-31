import crypto from 'node:crypto';
import { PgBoss } from 'pg-boss';
import {
  getCandidateRepository,
  getBatchRepository,
  getEmailSendRepository,
  getEmailTemplateRepository,
  getEmailAccountRepository,
  auditLogRepository,
  orgRepository,
  candidateRepositoryGlobal,
  candidateCheckRepository
} from '../repositories/index.js';
import { storageService, STORAGE_BUCKETS } from './storage.js';
import { parsePdf } from './pdf.js';
import {
  extractBasics,
  scoreResume,
  scoreAgainstCriteria,
  CriterionItem,
  extractResumeProfile,
  stripProtectedDemographics,
  parseJobDescription,
  matchProfileAgainstJob,
  evaluateDecisionPolicy
} from '@shortlistiq/engine';
import {
  CandidateStatus,
  CandidateDecision,
  DecisionSource,
  CandidateSource,
  EmailSendStatus,
  EmailTemplateKind
} from '@prisma/client';
import { aiService } from './ai.js';
import { emailService } from './email/index.js';
import { logger } from '../logger.js';

export interface ProcessCandidateJobPayload {
  candidateId: string;
  orgId: string;
  batchId: string;
  isRescore?: boolean;
}

export interface SendEmailJobPayload {
  emailSendId: string;
  batchId: string;
  candidateId: string;
  orgId: string;
  ownerId: string;
}

export const QUEUE_NAME = 'candidate-process';
export const EMAIL_QUEUE_NAME = 'batch-email-send';
export const DATA_LIFECYCLE_QUEUE_NAME = 'data-lifecycle-cleanup';

class QueueService {
  private boss: PgBoss | null = null;
  private isConnected = false;
  private localQueue: ProcessCandidateJobPayload[] = [];
  private localEmailQueue: SendEmailJobPayload[] = [];
  private activeLocalWorkers = 0;
  private activeEmailWorkers = 0;
  private maxConcurrency = 4;
  private isProcessingLocal = false;
  private isProcessingEmailQueue = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    // Don't auto-connect pg-boss during vitest unit tests
    if (dbUrl && process.env.NODE_ENV !== 'test') {
      try {
        this.boss = new PgBoss({
          connectionString: dbUrl,
          max: 10,
          application_name: 'shortlistiq-queue'
        });
      } catch (err) {
        logger.warn({ err }, 'Could not initialize PgBoss with DATABASE_URL, using fallback queue');
      }
    }
  }

  async start(): Promise<void> {
    if (this.boss && !this.isConnected) {
      try {
        await this.boss.start();
        this.isConnected = true;
        logger.info('PgBoss queue service connected and started.');
      } catch (err) {
        logger.warn({ err }, 'Failed to start PgBoss. Falling back to in-memory concurrent worker queue.');
        this.boss = null;
        this.isConnected = false;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.boss && this.isConnected) {
      await this.boss.stop();
      this.isConnected = false;
    }
  }

  async enqueueCandidateProcess(payload: ProcessCandidateJobPayload): Promise<string> {
    if (this.boss && this.isConnected) {
      try {
        const jobId = await this.boss.send(QUEUE_NAME, payload, {
          retryLimit: 3,
          retryBackoff: true,
          expireInSeconds: 120
        });
        return jobId || payload.candidateId;
      } catch (err) {
        logger.warn({ err }, 'Failed to send job to PgBoss, enqueuing locally');
      }
    }

    // Local in-process queue fallback (concurrency 4)
    this.localQueue.push(payload);
    this.triggerLocalQueue();
    return payload.candidateId;
  }

  private triggerLocalQueue(): void {
    if (this.isProcessingLocal) return;
    this.isProcessingLocal = true;

    const pump = () => {
      while (this.activeLocalWorkers < this.maxConcurrency && this.localQueue.length > 0) {
        const payload = this.localQueue.shift();
        if (!payload) break;

        this.activeLocalWorkers++;
        this.processCandidate(payload)
          .catch((err) => {
            logger.error({ err, payload }, 'Error processing candidate in local queue');
          })
          .finally(() => {
            this.activeLocalWorkers--;
            pump();
          });
      }
      if (this.localQueue.length === 0 && this.activeLocalWorkers === 0) {
        this.isProcessingLocal = false;
      }
    };

    pump();
  }

  async enqueueEmailSend(payload: SendEmailJobPayload): Promise<string> {
    if (this.boss && this.isConnected) {
      try {
        const jobId = await this.boss.send(EMAIL_QUEUE_NAME, payload, {
          retryLimit: 3,
          retryBackoff: true,
          expireInSeconds: 60
        });
        return jobId || payload.emailSendId;
      } catch (err) {
        logger.warn({ err }, 'Failed to send email job to PgBoss, enqueuing locally');
      }
    }

    // Local in-process queue fallback
    this.localEmailQueue.push(payload);
    this.triggerLocalEmailQueue();
    return payload.emailSendId;
  }

  private triggerLocalEmailQueue(): void {
    if (this.isProcessingEmailQueue) return;
    this.isProcessingEmailQueue = true;

    const pump = () => {
      // Concurrency of 1 for email sending to throttle strictly per account
      while (this.activeEmailWorkers < 1 && this.localEmailQueue.length > 0) {
        const payload = this.localEmailQueue.shift();
        if (!payload) break;

        this.activeEmailWorkers++;
        this.processEmailSend(payload)
          .catch((err) => {
            logger.error({ err, payload }, 'Error processing email send in local queue');
          })
          .finally(() => {
            this.activeEmailWorkers--;
            pump();
          });
      }
      if (this.localEmailQueue.length === 0 && this.activeEmailWorkers === 0) {
        this.isProcessingEmailQueue = false;
      }
    };

    pump();
  }

  /**
   * Core deterministic candidate processor:
   * 1. Check idempotency
   * 2. Download PDF buffer
   * 3. Parse PDF with timeout & corrupt file check
   * 4. Extract basics (name, email, phone)
   * 5. Check NO_EMAIL (mark failureReason = 'NO_EMAIL' so HR can provide it)
   * 6. Check dedupeKey (email + text hash) and flag duplicates
   * 7. Deterministically score against Batch JD & cutoff
   * 8. Persist results
   */
  async processCandidate(payload: ProcessCandidateJobPayload): Promise<void> {
    const { candidateId, orgId, batchId } = payload;
    const candidateRepo = getCandidateRepository(orgId);
    const batchRepo = getBatchRepository(orgId);

    const [candidate, batch] = await Promise.all([
      candidateRepo.findById(candidateId),
      batchRepo.findById(batchId)
    ]);

    if (!candidate || !batch) {
      logger.warn({ candidateId, batchId }, 'Candidate or batch not found, skipping processing');
      return;
    }

    // Idempotency check: skip if already scored unless explicit re-score
    if (candidate.status === CandidateStatus.scored && !payload.isRescore) {
      logger.info({ candidateId }, 'Candidate already scored, skipping duplicate run');
      return;
    }

    // Mark status as processing
    await candidateRepo.update(candidateId, {
      status: CandidateStatus.processing,
      failureReason: null
    });

    try {
      let parsedText = candidate.resumeText || '';

      // If text not already available, parse from PDF
      if (!parsedText) {
        if (!candidate.resumePath) {
          await candidateRepo.update(candidateId, {
            status: CandidateStatus.failed,
            failureReason: 'CORRUPT'
          });
          return;
        }

        // 1. Download PDF from storage
        let pdfBuffer: Buffer;
        try {
          pdfBuffer = await storageService.downloadFile(STORAGE_BUCKETS.RESUMES, candidate.resumePath);
        } catch (err) {
          await candidateRepo.update(candidateId, {
            status: CandidateStatus.failed,
            failureReason: 'CORRUPT'
          });
          return;
        }

        // Check max size
        if (pdfBuffer.length > 5 * 1024 * 1024) {
          await candidateRepo.update(candidateId, {
            status: CandidateStatus.failed,
            failureReason: 'TOO_LARGE'
          });
          return;
        }

        // 2. Parse PDF
        try {
          const parsed = await parsePdf(pdfBuffer);
          parsedText = parsed.text;
        } catch (err: any) {
          const failureReason = err?.code === 'NO_TEXT' ? 'NO_TEXT' : 'CORRUPT';
          await candidateRepo.update(candidateId, {
            status: CandidateStatus.failed,
            failureReason
          });
          return;
        }
      }

      // 3. Extract basics (preserving explicitly provided form fields for form submissions)
      const basics = extractBasics(parsedText);
      const isFormSubmission = candidate.source === CandidateSource.form;

      const fullName =
        isFormSubmission && candidate.fullName && candidate.fullName !== 'Pending Extraction'
          ? candidate.fullName
          : basics.name && basics.name !== 'Candidate'
          ? basics.name
          : candidate.fullName || 'Candidate';

      const phone =
        isFormSubmission && candidate.phone
          ? candidate.phone
          : basics.phone || candidate.phone || null;

      const email =
        isFormSubmission && candidate.email && candidate.email !== 'NO_EMAIL' && candidate.email.trim().length > 0
          ? candidate.email.trim()
          : basics.email && basics.email !== 'NO_EMAIL'
          ? basics.email.trim()
          : candidate.email || '';

      // 4. Verify email existence
      if (!email || email === 'NO_EMAIL') {
        await candidateRepo.update(candidateId, {
          fullName,
          phone,
          resumeText: parsedText,
          status: CandidateStatus.failed,
          failureReason: 'NO_EMAIL'
        });
        return;
      }

      // 5. Deduplication check: email + normalized text hash
      const normalizedCleanText = parsedText.replace(/\s+/g, ' ').trim().toLowerCase();
      const textHash = crypto.createHash('sha256').update(normalizedCleanText).digest('hex').slice(0, 16);
      const dedupeKey = `${email.toLowerCase()}:${textHash}`;

      const existingDuplicate = await candidateRepo.findByDedupeKey(batchId, dedupeKey);
      let isDuplicate = false;
      if (existingDuplicate && existingDuplicate.id !== candidateId) {
        isDuplicate = true;
      }

      // 6. Deterministic scoring against batch JD & Criteria
      let criteriaList: CriterionItem[] = [];
      let alwaysRequireAllMustHaves = false;

      if (batch.criteria) {
        if (Array.isArray(batch.criteria)) {
          criteriaList = (batch.criteria as unknown) as CriterionItem[];
        } else if (typeof batch.criteria === 'object') {
          const critObj = batch.criteria as any;
          criteriaList = Array.isArray(critObj.items)
            ? critObj.items
            : Array.isArray(critObj.criteria)
            ? critObj.criteria
            : [];
          alwaysRequireAllMustHaves = Boolean(critObj.alwaysRequireAllMustHaves);
        }
      }

      const cutoff = batch.cutoff ?? 70;
      let score: number;
      let breakdown: any;
      let criteriaResults: any = null;
      let decision: CandidateDecision = CandidateDecision.unshortlisted;

      if (criteriaList.length > 0) {
        const criteriaEval = scoreAgainstCriteria(parsedText, batch.jdText, {
          cutoff,
          criteria: criteriaList,
          alwaysRequireAllMustHaves
        });
        score = criteriaEval.overallScore;
        breakdown = {
          keywordScore: criteriaEval.breakdown.keywordScore,
          skillsScore: criteriaEval.breakdown.skillsScore,
          experienceScore: criteriaEval.breakdown.experienceScore,
          formattingScore: criteriaEval.breakdown.formattingScore,
          readabilityScore: criteriaEval.breakdown.readabilityScore,
          matchedKeywords: criteriaEval.breakdown.matchedKeywords,
          missingKeywords: criteriaEval.breakdown.missingKeywords,
          matchedSkills: criteriaEval.breakdown.matchedSkills,
          detectedYearsExperience: criteriaEval.breakdown.detectedYearsExperience
        };
        criteriaResults = criteriaEval.criteriaResults;
        decision = criteriaEval.decision as CandidateDecision;
      } else {
        const scoringResult = scoreResume(parsedText, batch.jdText, (batch.criteria || undefined) as any);
        score = scoringResult.overallScore;
        breakdown = {
          keywordScore: scoringResult.keywordScore,
          skillsScore: scoringResult.skillsScore,
          experienceScore: scoringResult.experienceScore,
          formattingScore: scoringResult.formattingScore,
          readabilityScore: scoringResult.readabilityScore,
          matchedKeywords: scoringResult.matchedKeywords,
          missingKeywords: scoringResult.missingKeywords,
          matchedSkills: scoringResult.matchedSkills,
          detectedYearsExperience: scoringResult.detectedYearsExperience
        };
        if (score >= cutoff) {
          decision = CandidateDecision.shortlisted;
        } else if (score >= Math.max(0, cutoff - 5)) {
          decision = CandidateDecision.needs_review;
        } else {
          decision = CandidateDecision.unshortlisted;
        }
      }

      if (isDuplicate) {
        decision = CandidateDecision.needs_review;
      }

      // Accuracy Upgrade: ENGINE_V2 Feature Flag (false by default; true or shadow)
      const isEngineV2 = process.env.ENGINE_V2 === 'true';
      const isShadowMode = process.env.ENGINE_V2 === 'shadow';

      if (isEngineV2 || isShadowMode) {
        try {
          const profile = extractResumeProfile(parsedText);
          const blindProfile = stripProtectedDemographics(profile);
          const jdRequirements = parseJobDescription(batch.jdText);
          const matchResult = matchProfileAgainstJob(blindProfile, jdRequirements);
          const decisionAudit = evaluateDecisionPolicy(matchResult, {
            cutoff,
            parseReport: (candidate as any).parseQuality
          });

          const v2Score = matchResult.overallScore;
          const v2Decision =
            decisionAudit.recommendation === 'recommended_shortlist'
              ? CandidateDecision.shortlisted
              : decisionAudit.recommendation === 'needs_review'
              ? CandidateDecision.needs_review
              : CandidateDecision.unshortlisted;

          if (isEngineV2) {
            score = v2Score;
            decision = v2Decision;
            breakdown = {
              overallScore: v2Score,
              mustHaveScore: matchResult.mustHaveScore,
              niceToHaveScore: matchResult.niceToHaveScore,
              experienceScore: matchResult.experienceScore,
              educationScore: matchResult.educationScore,
              matchedSkills: profile.skills.map((s) => s.canonicalSkill),
              detectedYearsExperience: profile.totalExperienceYears,
              decisionAudit
            };
            criteriaResults = matchResult.results;
          } else if (isShadowMode) {
            logger.info(
              {
                candidateId,
                v1Score: score,
                v2Score,
                v1Decision: decision,
                v2Decision,
                hasDiscrepancy: score !== v2Score || decision !== v2Decision
              },
              '[ENGINE_V2 SHADOW MODE] Candidate evaluation discrepancy comparison'
            );
          }
        } catch (err) {
          logger.warn({ err, candidateId }, 'Engine V2 execution failed, retained V1 output');
        }
      }

      // CRITICAL PRESERVATION RULE:
      // Re-scoring must NEVER overwrite decisions with decisionSource manual or knockout.
      let finalDecision = decision;
      let finalDecisionSource: DecisionSource = DecisionSource.auto;

      const isManualOrKnockout =
        candidate.decisionSource === DecisionSource.manual ||
        candidate.decisionSource === DecisionSource.knockout;

      if (isManualOrKnockout && candidate.decision && candidate.decisionSource) {
        finalDecision = candidate.decision;
        finalDecisionSource = candidate.decisionSource;
      }

      // Optional AI Summary: generated only for shortlisted and needs_review candidates
      let aiSummary = candidate.aiSummary;
      if (!aiSummary && (finalDecision === CandidateDecision.shortlisted || finalDecision === CandidateDecision.needs_review)) {
        try {
          aiSummary = await aiService.generateCandidateStrengthGaps(fullName, parsedText, batch.jdText);
        } catch {
          // Gracefully skipped on rate limit or error
        }
      }

      // 7. Update candidate row
      await candidateRepo.update(candidateId, {
        fullName,
        email,
        phone,
        resumeText: parsedText,
        score,
        breakdown,
        criteriaResults,
        aiSummary: aiSummary || null,
        status: CandidateStatus.scored,
        decision: finalDecision,
        decisionSource: finalDecisionSource,
        dedupeKey,
        failureReason: isDuplicate ? 'DUPLICATE' : null
      });

      logger.info({ candidateId, score, decision: finalDecision, isManualOrKnockout }, 'Candidate scored successfully');
    } catch (err: any) {
      logger.error({ err, candidateId }, 'Unexpected failure while processing candidate');
      await candidateRepo.update(candidateId, {
        status: CandidateStatus.failed,
        failureReason: 'CORRUPT'
      });
    }
  }

  /**
   * Processes a queued email send job:
   * 1. Idempotency check: if status === 'sent', never double-send
   * 2. Candidate email resolution
   * 3. Template retrieval & variable rendering
   * 4. AES-256-GCM token decryption & provider send
   * 5. AuditLog recording without logging email bodies
   */
  async processEmailSend(payload: SendEmailJobPayload): Promise<void> {
    const { emailSendId, batchId, candidateId, orgId, ownerId } = payload;
    const emailSendRepo = getEmailSendRepository(orgId);
    const candidateRepo = getCandidateRepository(orgId);
    const batchRepo = getBatchRepository(orgId);
    const templateRepo = getEmailTemplateRepository(orgId);
    const emailAccountRepo = getEmailAccountRepository(orgId, ownerId);
    const auditLogRepo = auditLogRepository;

    try {
      const emailSend = await emailSendRepo.findById(emailSendId);
      if (!emailSend) {
        logger.warn({ emailSendId }, 'EmailSend record not found, skipping');
        return;
      }

      // CRITICAL IDEMPOTENCY RULE:
      // If already sent, NEVER double-send!
      if (emailSend.status === EmailSendStatus.sent) {
        logger.info({ emailSendId }, 'Email already sent, skipping to guarantee idempotency');
        return;
      }

      const batch = await batchRepo.findById(batchId);
      if (!batch) {
        await emailSendRepo.updateStatus(emailSendId, EmailSendStatus.failed, 'Batch not found');
        return;
      }

      const candidate = await candidateRepo.findById(candidateId);
      if (!candidate) {
        await emailSendRepo.updateStatus(emailSendId, EmailSendStatus.failed, 'Candidate not found');
        return;
      }

      if (!candidate.email || candidate.email === 'NO_EMAIL' || !candidate.email.includes('@')) {
        await emailSendRepo.updateStatus(emailSendId, EmailSendStatus.failed, 'Candidate has no valid email address');
        return;
      }

      if (
        candidate.decision !== CandidateDecision.shortlisted &&
        candidate.decision !== CandidateDecision.unshortlisted
      ) {
        await emailSendRepo.updateStatus(
          emailSendId,
          EmailSendStatus.failed,
          'Candidate decision is not shortlisted or unshortlisted'
        );
        return;
      }

      const accounts = await emailAccountRepo.findMany();
      const account = accounts[0];
      if (!account) {
        await emailSendRepo.updateStatus(
          emailSendId,
          EmailSendStatus.failed,
          'No connected Gmail or Outlook account found'
        );
        return;
      }

      const kind =
        candidate.decision === CandidateDecision.shortlisted
          ? EmailTemplateKind.shortlisted
          : EmailTemplateKind.unshortlisted;
      const template = await templateRepo.findByBatchAndKind(batchId, kind);

      const org = await orgRepository.findById(orgId);
      const companyName = org?.name || 'Hiring Team';

      const rendered = emailService.renderTemplate(template, {
        candidate_name: candidate.fullName || 'Candidate',
        job_title: batch.jobTitle || 'Position',
        company: companyName
      });

      // Throttle sends to respect Gmail / Outlook rate limits (~1 email per 2 seconds)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        await new Promise((r) => setTimeout(r, 10));
      }

      // Send via decrypted refresh token
      await emailService.sendEmail({
        provider: account.provider as 'gmail' | 'outlook',
        encryptedRefreshToken: account.encryptedRefreshToken,
        fromAddress: account.address,
        toAddress: candidate.email,
        subject: rendered.subject,
        htmlBody: rendered.html
      });

      // Mark sent
      await emailSendRepo.updateStatus(emailSendId, EmailSendStatus.sent, null, new Date());

      // Write AuditLog - CRITICAL: NEVER LOG EMAIL BODIES!
      await auditLogRepo.log({
        orgId,
        actorId: ownerId,
        action: 'EMAIL_SENT',
        entity: 'EmailSend',
        entityId: emailSendId,
        meta: {
          batchId,
          candidateId,
          recipientEmail: candidate.email,
          provider: account.provider,
          senderAddress: account.address,
          templateKind: kind
        }
      });

      logger.info({ emailSendId, candidateId }, 'Candidate email sent successfully');
    } catch (err: any) {
      logger.error({ err, emailSendId, candidateId }, 'Failed to deliver candidate email');
      await emailSendRepo.updateStatus(emailSendId, EmailSendStatus.failed, err.message || 'Delivery failed');

      await auditLogRepo.log({
        orgId,
        actorId: ownerId,
        action: 'EMAIL_FAILED',
        entity: 'EmailSend',
        entityId: emailSendId,
        meta: {
          batchId,
          candidateId,
          error: err.message || 'Delivery failed'
        }
      });
    }
  }

  /**
   * Phase 10: Scheduled daily data lifecycle job
   * Deletes expired Candidate and CandidateCheck rows and their storage objects in small batches.
   * Logs counts ONLY.
   */
  async runDataLifecycleCleanup(): Promise<{
    deletedCandidates: number;
    deletedChecks: number;
    deletedFiles: number;
  }> {
    let deletedCandidates = 0;
    let deletedChecks = 0;
    let deletedFiles = 0;
    const now = new Date();

    // 1. Process expired candidates in batches of 50
    let hasMoreCandidates = true;
    while (hasMoreCandidates) {
      const expiredCandidates = await candidateRepositoryGlobal.findExpired(now, 50);
      if (expiredCandidates.length === 0) {
        hasMoreCandidates = false;
        break;
      }

      for (const cand of expiredCandidates) {
        if (cand.resumePath) {
          try {
            await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, cand.resumePath);
            deletedFiles++;
          } catch {
            // Ignore missing storage objects
          }
        }
        await candidateRepositoryGlobal.deleteById(cand.id);
        deletedCandidates++;
      }
    }

    // 2. Process expired candidate checks in batches of 50
    let hasMoreChecks = true;
    while (hasMoreChecks) {
      const expiredChecks = await candidateCheckRepository.findExpired(now, 50);
      if (expiredChecks.length === 0) {
        hasMoreChecks = false;
        break;
      }

      for (const check of expiredChecks) {
        if (check.resumePath) {
          try {
            await storageService.deleteFile(STORAGE_BUCKETS.RESUMES, check.resumePath);
            deletedFiles++;
          } catch {
            // Ignore missing storage objects
          }
        }
        await candidateCheckRepository.delete(check.id);
        deletedChecks++;
      }
    }

    // Logs counts ONLY (never personal data or resume contents)
    logger.info(
      { deletedCandidates, deletedChecks, deletedFiles },
      'Data lifecycle cleanup completed'
    );

    return { deletedCandidates, deletedChecks, deletedFiles };
  }

  /**
   * Registers pg-boss worker consumer with team concurrency of 4
   */
  async registerWorker(): Promise<void> {
    await this.start();
    if (this.boss && this.isConnected) {
      await this.boss.work(
        QUEUE_NAME,
        { localConcurrency: 4 },
        async (job: any) => {
          await this.processCandidate(job.data);
        }
      );
      logger.info('PgBoss worker registered for queue: candidate-process (concurrency 4)');

      await this.boss.work(
        EMAIL_QUEUE_NAME,
        { localConcurrency: 1 },
        async (job: any) => {
          await this.processEmailSend(job.data);
        }
      );
      logger.info('PgBoss worker registered for queue: batch-email-send (concurrency 1)');

      await this.boss.work(
        DATA_LIFECYCLE_QUEUE_NAME,
        { localConcurrency: 1 },
        async () => {
          await this.runDataLifecycleCleanup();
        }
      );
      try {
        await this.boss.schedule(DATA_LIFECYCLE_QUEUE_NAME, '0 2 * * *', {});
      } catch {
        // Ignored if schedule exists
      }
      logger.info('PgBoss worker registered for queue: data-lifecycle-cleanup (daily schedule 2am)');
    }
  }

  // Helper for tests to drain all queued jobs
  async drainLocalQueue(): Promise<void> {
    while (
      this.localQueue.length > 0 ||
      this.localEmailQueue.length > 0 ||
      this.activeLocalWorkers > 0 ||
      this.activeEmailWorkers > 0
    ) {
      await new Promise((res) => setTimeout(res, 20));
    }
  }
}

export const jobQueue = new QueueService();
