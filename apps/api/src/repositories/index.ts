import { v4 as uuidv4 } from 'uuid';
import {
  Batch,
  Candidate,
  Form,
  EmailAccount,
  CandidateCheck,
  Suggestion,
  Org,
  Profile,
  BatchStatus,
  CandidateStatus,
  CandidateSource,
  CandidateDecision,
  DecisionSource,
  AuditLog,
  CheckStatus,
  SuggestionStatus,
  EmailTemplate,
  EmailSend,
  EmailTemplateKind,
  EmailSendStatus,
  DeletionRequest,
  DeletionStatus
} from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';

// In-memory multi-tenant store for deterministic testing & offline dev
export interface StoreState {
  orgs: Map<string, Org>;
  profiles: Map<string, Profile>;
  batches: Map<string, Batch>;
  forms: Map<string, Form>;
  candidates: Map<string, Candidate>;
  emailAccounts: Map<string, EmailAccount>;
  emailTemplates: Map<string, EmailTemplate>;
  emailSends: Map<string, EmailSend>;
  candidateChecks: Map<string, CandidateCheck>;
  suggestions: Map<string, Suggestion>;
  deletionRequests: Map<string, DeletionRequest>;
  llmCaches: Map<string, any>;
  auditLogs: Map<string, AuditLog>;
}

export const inMemoryStore: StoreState = {
  orgs: new Map(),
  profiles: new Map(),
  batches: new Map(),
  forms: new Map(),
  candidates: new Map(),
  emailAccounts: new Map(),
  emailTemplates: new Map(),
  emailSends: new Map(),
  candidateChecks: new Map(),
  suggestions: new Map(),
  deletionRequests: new Map(),
  llmCaches: new Map(),
  auditLogs: new Map()
};

export function resetRepositories() {
  inMemoryStore.orgs.clear();
  inMemoryStore.profiles.clear();
  inMemoryStore.batches.clear();
  inMemoryStore.forms.clear();
  inMemoryStore.candidates.clear();
  inMemoryStore.emailAccounts.clear();
  inMemoryStore.emailTemplates.clear();
  inMemoryStore.emailSends.clear();
  inMemoryStore.candidateChecks.clear();
  inMemoryStore.suggestions.clear();
  inMemoryStore.deletionRequests.clear();
  inMemoryStore.llmCaches.clear();
  inMemoryStore.auditLogs.clear();
}

/**
 * Org Repository
 */
export const orgRepository = {
  async create(name: string, retentionDays: number = 60, id?: string): Promise<Org> {
    const org: Org = {
      id: id || uuidv4(),
      name,
      retentionDays,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryStore.orgs.set(org.id, org);
    return org;
  },

  async findById(id: string): Promise<Org | null> {
    return inMemoryStore.orgs.get(id) || null;
  },

  async updateRetentionDays(id: string, retentionDays: number): Promise<Org> {
    const org = inMemoryStore.orgs.get(id);
    if (!org) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    org.retentionDays = retentionDays;
    org.updatedAt = new Date();
    inMemoryStore.orgs.set(id, org);
    return org;
  },

  async update(id: string, data: Partial<Org>): Promise<Org> {
    const org = inMemoryStore.orgs.get(id);
    if (!org) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    const updated: Org = {
      ...org,
      ...data,
      id: org.id,
      updatedAt: new Date()
    };
    inMemoryStore.orgs.set(id, updated);
    return updated;
  }
};

/**
 * Profile Repository
 */
export const profileRepository = {
  async create(data: {
    id?: string;
    orgId?: string | null;
    role: 'hr' | 'candidate';
    fullName?: string | null;
  }): Promise<Profile> {
    const profile: Profile = {
      id: data.id || uuidv4(),
      orgId: data.orgId || null,
      role: data.role,
      fullName: data.fullName || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryStore.profiles.set(profile.id, profile);
    return profile;
  },

  async findById(id: string): Promise<Profile | null> {
    return inMemoryStore.profiles.get(id) || null;
  }
};

/**
 * Batch Repository - ALWAYS scoped strictly by orgId
 */
export function getBatchRepository(orgId: string) {
  if (!orgId) throw new AppError(403, 'TENANCY_VIOLATION', 'orgId is required to access batches');

  return {
    async findMany(filters?: { status?: BatchStatus }): Promise<Batch[]> {
      const results: Batch[] = [];
      for (const batch of inMemoryStore.batches.values()) {
        if (batch.orgId === orgId) {
          if (!filters?.status || batch.status === filters.status) {
            results.push(batch);
          }
        }
      }
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async findManyWithCounts(): Promise<Array<Batch & { candidateCounts: { total: number; scored: number; pending: number; processing: number; failed: number; shortlisted: number } }>> {
      const batches = await this.findMany();
      return batches.map(batch => {
        let total = 0;
        let scored = 0;
        let pending = 0;
        let processing = 0;
        let failed = 0;
        let shortlisted = 0;

        for (const c of inMemoryStore.candidates.values()) {
          if (c.batchId === batch.id) {
            total++;
            if (c.status === CandidateStatus.scored) scored++;
            else if (c.status === CandidateStatus.pending) pending++;
            else if (c.status === CandidateStatus.processing) processing++;
            else if (c.status === CandidateStatus.failed) failed++;

            if (c.decision === CandidateDecision.shortlisted) shortlisted++;
          }
        }

        return {
          ...batch,
          candidateCounts: { total, scored, pending, processing, failed, shortlisted }
        };
      });
    },

    async getStats(): Promise<{ activeBatches: number; resumesProcessed: number; shortlistedThisMonth: number; emailsSent: number }> {
      let activeBatches = 0;
      for (const batch of inMemoryStore.batches.values()) {
        if (batch.orgId === orgId && batch.status !== BatchStatus.archived) {
          activeBatches++;
        }
      }

      let resumesProcessed = 0;
      let shortlistedThisMonth = 0;
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      for (const candidate of inMemoryStore.candidates.values()) {
        const batch = inMemoryStore.batches.get(candidate.batchId);
        if (batch && batch.orgId === orgId) {
          if (candidate.status === CandidateStatus.scored) {
            resumesProcessed++;
          }
          if (candidate.decision === CandidateDecision.shortlisted) {
            const candDate = candidate.createdAt;
            if (candDate.getMonth() === currentMonth && candDate.getFullYear() === currentYear) {
              shortlistedThisMonth++;
            }
          }
        }
      }

      return {
        activeBatches,
        resumesProcessed,
        shortlistedThisMonth,
        emailsSent: 0 // Email sends tracked in Phase 8
      };
    },

    async findById(id: string): Promise<Batch | null> {
      const batch = inMemoryStore.batches.get(id);
      if (!batch || batch.orgId !== orgId) {
        return null;
      }
      return batch;
    },

    async create(data: {
      name: string;
      jobTitle: string;
      jdText: string;
      criteria?: any;
      cutoff?: number;
      ownerId: string;
      status?: BatchStatus;
    }): Promise<Batch> {
      const batch: Batch = {
        id: uuidv4(),
        orgId,
        ownerId: data.ownerId,
        name: data.name,
        jobTitle: data.jobTitle,
        jdText: data.jdText,
        criteria: data.criteria || {},
        cutoff: data.cutoff ?? 70,
        status: data.status || BatchStatus.draft,
        finalizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.batches.set(batch.id, batch);
      return batch;
    },

    async update(id: string, data: Partial<Batch>): Promise<Batch> {
      const batch = inMemoryStore.batches.get(id);
      if (!batch || batch.orgId !== orgId) {
        throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization');
      }

      const updated: Batch = {
        ...batch,
        ...data,
        id: batch.id,
        orgId: batch.orgId,
        updatedAt: new Date()
      };
      inMemoryStore.batches.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<{ deleted: boolean; candidateCount: number; resumePaths: string[]; batchName: string }> {
      const batch = inMemoryStore.batches.get(id);
      if (!batch || batch.orgId !== orgId) {
        throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization');
      }

      const resumePaths: string[] = [];
      let candidateCount = 0;
      for (const [candId, cand] of inMemoryStore.candidates.entries()) {
        if (cand.batchId === id) {
          candidateCount++;
          if (cand.resumePath) resumePaths.push(cand.resumePath);
          inMemoryStore.candidates.delete(candId);
        }
      }

      for (const [formId, form] of inMemoryStore.forms.entries()) {
        if (form.batchId === id) inMemoryStore.forms.delete(formId);
      }
      for (const [tmplId, tmpl] of inMemoryStore.emailTemplates.entries()) {
        if (tmpl.batchId === id) inMemoryStore.emailTemplates.delete(tmplId);
      }
      for (const [sendId, send] of inMemoryStore.emailSends.entries()) {
        if (send.batchId === id) inMemoryStore.emailSends.delete(sendId);
      }

      inMemoryStore.batches.delete(id);
      return { deleted: true, candidateCount, resumePaths, batchName: batch.name };
    }
  };
}

/**
 * Candidate Repository - ALWAYS scoped strictly by orgId (via batch relation)
 */
export function getCandidateRepository(orgId: string) {
  if (!orgId) throw new AppError(403, 'TENANCY_VIOLATION', 'orgId is required to access candidates');

  const verifyBatchOwnership = (batchId: string): Batch => {
    const batch = inMemoryStore.batches.get(batchId);
    if (!batch || batch.orgId !== orgId) {
      throw new AppError(404, 'NOT_FOUND', 'Batch does not belong to this organization');
    }
    return batch;
  };

  return {
    async findManyByBatch(batchId: string, filters?: { status?: CandidateStatus; decision?: CandidateDecision }): Promise<Candidate[]> {
      verifyBatchOwnership(batchId);

      const results: Candidate[] = [];
      for (const candidate of inMemoryStore.candidates.values()) {
        if (candidate.batchId === batchId) {
          if (filters?.status && candidate.status !== filters.status) continue;
          if (filters?.decision && candidate.decision !== filters.decision) continue;
          results.push(candidate);
        }
      }
      return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    },

    async countByBatch(batchId: string) {
      verifyBatchOwnership(batchId);

      let total = 0;
      let pending = 0;
      let processing = 0;
      let scored = 0;
      let failed = 0;
      let shortlisted = 0;
      let unshortlisted = 0;
      let needsReview = 0;

      for (const candidate of inMemoryStore.candidates.values()) {
        if (candidate.batchId === batchId) {
          total++;
          if (candidate.status === CandidateStatus.pending) pending++;
          else if (candidate.status === CandidateStatus.processing) processing++;
          else if (candidate.status === CandidateStatus.scored) scored++;
          else if (candidate.status === CandidateStatus.failed) failed++;

          if (candidate.decision === CandidateDecision.shortlisted) shortlisted++;
          else if (candidate.decision === CandidateDecision.unshortlisted) unshortlisted++;
          else if (candidate.decision === CandidateDecision.needs_review) needsReview++;
        }
      }

      return {
        total,
        pending,
        processing,
        scored,
        failed,
        shortlisted,
        unshortlisted,
        needsReview
      };
    },

    async findById(id: string): Promise<Candidate | null> {
      const candidate = inMemoryStore.candidates.get(id);
      if (!candidate) return null;

      const batch = inMemoryStore.batches.get(candidate.batchId);
      if (!batch || batch.orgId !== orgId) {
        return null; // Tenancy boundary prevents access
      }
      return candidate;
    },

    async findByDedupeKey(batchId: string, dedupeKey: string): Promise<Candidate | null> {
      verifyBatchOwnership(batchId);
      for (const candidate of inMemoryStore.candidates.values()) {
        if (candidate.batchId === batchId && candidate.dedupeKey === dedupeKey) {
          return candidate;
        }
      }
      return null;
    },

    async create(data: {
      batchId: string;
      fullName?: string;
      email?: string;
      phone?: string | null;
      resumePath?: string | null;
      resumeText?: string | null;
      source?: CandidateSource;
      status?: CandidateStatus;
      decision?: CandidateDecision | null;
      decisionSource?: DecisionSource | null;
      score?: number | null;
      breakdown?: any;
      formAnswers?: any;
      failureReason?: string | null;
      dedupeKey?: string | null;
      consentAt?: Date | null;
      expiresAt?: Date | null;
    }): Promise<Candidate> {
      verifyBatchOwnership(data.batchId);

      const org = inMemoryStore.orgs.get(orgId);
      const retentionDays = org?.retentionDays || 60;
      const defaultExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      const candidate: Candidate = {
        id: uuidv4(),
        batchId: data.batchId,
        source: data.source || CandidateSource.upload,
        fullName: data.fullName || 'Pending Extraction',
        email: data.email || '',
        phone: data.phone || null,
        resumePath: data.resumePath || null,
        resumeText: data.resumeText || null,
        formAnswers: data.formAnswers || null,
        score: data.score !== undefined ? data.score : null,
        breakdown: data.breakdown || null,
        criteriaResults: null,
        aiSummary: null,
        status: data.status || CandidateStatus.pending,
        decision: data.decision || null,
        decisionSource: data.decisionSource || null,
        failureReason: data.failureReason || null,
        dedupeKey: data.dedupeKey || null,
        consentAt: data.consentAt || new Date(),
        expiresAt: data.expiresAt !== undefined ? data.expiresAt : defaultExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.candidates.set(candidate.id, candidate);
      return candidate;
    },

    async delete(id: string): Promise<{ deleted: boolean; resumePath: string | null }> {
      const candidate = inMemoryStore.candidates.get(id);
      if (!candidate) return { deleted: false, resumePath: null };
      verifyBatchOwnership(candidate.batchId);

      // Clean up email sends
      for (const [sendId, send] of inMemoryStore.emailSends.entries()) {
        if (send.candidateId === id) inMemoryStore.emailSends.delete(sendId);
      }

      inMemoryStore.candidates.delete(id);
      return { deleted: true, resumePath: candidate.resumePath };
    },

    async createMany(items: Array<{
      batchId: string;
      fullName?: string;
      email?: string;
      resumePath: string;
      source?: CandidateSource;
    }>): Promise<Candidate[]> {
      const created: Candidate[] = [];
      for (const item of items) {
        created.push(await this.create(item));
      }
      return created;
    },

    async retryFailed(batchId: string): Promise<Candidate[]> {
      verifyBatchOwnership(batchId);
      const retried: Candidate[] = [];
      for (const candidate of inMemoryStore.candidates.values()) {
        if (candidate.batchId === batchId && candidate.status === CandidateStatus.failed) {
          const updated: Candidate = {
            ...candidate,
            status: CandidateStatus.pending,
            failureReason: null,
            updatedAt: new Date()
          };
          inMemoryStore.candidates.set(candidate.id, updated);
          retried.push(updated);
        }
      }
      return retried;
    },

    async update(id: string, data: Partial<Candidate>): Promise<Candidate> {
      const candidate = inMemoryStore.candidates.get(id);
      if (!candidate) {
        throw new AppError(404, 'NOT_FOUND', 'Candidate not found');
      }

      verifyBatchOwnership(candidate.batchId);

      const updated: Candidate = {
        ...candidate,
        ...data,
        id: candidate.id,
        batchId: candidate.batchId,
        updatedAt: new Date()
      };
      inMemoryStore.candidates.set(id, updated);
      return updated;
    },

    async updateDecision(
      candidateId: string,
      decision: CandidateDecision,
      actorId: string,
      decisionSource: DecisionSource = DecisionSource.manual
    ): Promise<Candidate> {
      const candidate = inMemoryStore.candidates.get(candidateId);
      if (!candidate) {
        throw new AppError(404, 'NOT_FOUND', 'Candidate not found');
      }
      verifyBatchOwnership(candidate.batchId);

      const prevDecision = candidate.decision;
      const updated: Candidate = {
        ...candidate,
        decision,
        decisionSource,
        updatedAt: new Date()
      };
      inMemoryStore.candidates.set(candidateId, updated);

      if (decisionSource === DecisionSource.manual) {
        await auditLogRepository.log({
          orgId,
          actorId,
          action: 'CANDIDATE_DECISION_OVERRIDE',
          entity: 'Candidate',
          entityId: candidateId,
          meta: {
            previousDecision: prevDecision,
            newDecision: decision,
            decisionSource: 'manual'
          }
        });
      }

      return updated;
    },

    async bulkUpdateDecision(
      batchId: string,
      candidateIds: string[],
      decision: CandidateDecision,
      actorId: string
    ): Promise<Candidate[]> {
      verifyBatchOwnership(batchId);
      const updatedList: Candidate[] = [];
      for (const id of candidateIds) {
        const candidate = inMemoryStore.candidates.get(id);
        if (candidate && candidate.batchId === batchId) {
          const updated = await this.updateDecision(id, decision, actorId, DecisionSource.manual);
          updatedList.push(updated);
        }
      }
      return updatedList;
    }
  };
}

/**
 * Form Repository - ALWAYS scoped strictly by orgId
 */
export function getFormRepository(orgId: string) {
  if (!orgId) throw new AppError(403, 'TENANCY_VIOLATION', 'orgId is required to access forms');

  const getSubmissionsForBatch = (batchId: string): number => {
    let count = 0;
    for (const c of inMemoryStore.candidates.values()) {
      if (c.batchId === batchId && c.source === CandidateSource.form) {
        count++;
      }
    }
    return count;
  };

  return {
    async findByBatch(batchId: string): Promise<Array<Form & { submissionCount: number }>> {
      const results: Array<Form & { submissionCount: number }> = [];
      const subCount = getSubmissionsForBatch(batchId);
      for (const form of inMemoryStore.forms.values()) {
        if (form.orgId === orgId && form.batchId === batchId) {
          results.push({
            ...form,
            submissionCount: subCount
          });
        }
      }
      return results;
    },

    async findById(id: string): Promise<(Form & { submissionCount: number }) | null> {
      const form = inMemoryStore.forms.get(id);
      if (!form || form.orgId !== orgId) return null;
      const subCount = getSubmissionsForBatch(form.batchId);
      return {
        ...form,
        submissionCount: subCount
      };
    },

    async create(data: {
      batchId: string;
      slug: string;
      title: string;
      schema: any;
      knockoutRules?: any;
      isPublished?: boolean;
    }): Promise<Form> {
      const batch = inMemoryStore.batches.get(data.batchId);
      if (!batch || batch.orgId !== orgId) {
        throw new AppError(404, 'NOT_FOUND', 'Batch does not belong to this organization');
      }

      for (const existing of inMemoryStore.forms.values()) {
        if (existing.slug === data.slug) {
          throw new AppError(
            409,
            'SLUG_EXISTS',
            'A form with this public URL slug already exists. Please choose another slug.'
          );
        }
      }

      const form: Form = {
        id: uuidv4(),
        orgId,
        batchId: data.batchId,
        slug: data.slug,
        title: data.title,
        schema: data.schema,
        knockoutRules: data.knockoutRules || null,
        isPublished: data.isPublished !== undefined ? data.isPublished : true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.forms.set(form.id, form);
      return form;
    },

    async update(id: string, data: Partial<Form>): Promise<Form> {
      const form = inMemoryStore.forms.get(id);
      if (!form || form.orgId !== orgId) {
        throw new AppError(404, 'NOT_FOUND', 'Form not found in this organization');
      }

      if (data.slug && data.slug !== form.slug) {
        for (const existing of inMemoryStore.forms.values()) {
          if (existing.id !== id && existing.slug === data.slug) {
            throw new AppError(409, 'SLUG_EXISTS', 'A form with this public URL slug already exists.');
          }
        }
      }

      const updated: Form = {
        ...form,
        ...data,
        id: form.id,
        orgId: form.orgId,
        batchId: form.batchId,
        updatedAt: new Date()
      };
      inMemoryStore.forms.set(id, updated);
      return updated;
    },

    async togglePublished(id: string): Promise<Form> {
      const form = inMemoryStore.forms.get(id);
      if (!form || form.orgId !== orgId) {
        throw new AppError(404, 'NOT_FOUND', 'Form not found in this organization');
      }
      return this.update(id, { isPublished: !form.isPublished });
    },

    async delete(id: string): Promise<boolean> {
      const form = inMemoryStore.forms.get(id);
      if (!form || form.orgId !== orgId) {
        throw new AppError(404, 'NOT_FOUND', 'Form not found');
      }
      return inMemoryStore.forms.delete(id);
    }
  };
}

/**
 * Public Form Lookup (by slug, for candidate applications)
 */
export const publicFormRepository = {
  async findBySlug(slug: string): Promise<Form | null> {
    for (const form of inMemoryStore.forms.values()) {
      if (form.slug === slug) {
        return form;
      }
    }
    return null;
  }
};

/**
 * Email Account Repository - Scoped by owner and organization
 */
export function getEmailAccountRepository(orgId: string, ownerId: string) {
  if (!orgId || !ownerId) {
    throw new AppError(403, 'TENANCY_VIOLATION', 'orgId and ownerId are required');
  }

  const verifyOwnerInOrg = () => {
    const profile = inMemoryStore.profiles.get(ownerId);
    if (!profile || profile.orgId !== orgId) {
      throw new AppError(403, 'FORBIDDEN', 'User does not belong to this organization');
    }
  };

  return {
    async findMany(): Promise<EmailAccount[]> {
      verifyOwnerInOrg();
      const results: EmailAccount[] = [];
      for (const account of inMemoryStore.emailAccounts.values()) {
        if (account.ownerId === ownerId) {
          results.push(account);
        }
      }
      return results;
    },

    async findById(id: string): Promise<EmailAccount | null> {
      verifyOwnerInOrg();
      const account = inMemoryStore.emailAccounts.get(id);
      if (!account || account.ownerId !== ownerId) return null;
      return account;
    },

    async create(data: {
      provider: string;
      address: string;
      encryptedRefreshToken: string;
      scopes: string;
    }): Promise<EmailAccount> {
      verifyOwnerInOrg();
      const account: EmailAccount = {
        id: uuidv4(),
        ownerId,
        provider: data.provider,
        address: data.address,
        encryptedRefreshToken: data.encryptedRefreshToken,
        scopes: data.scopes,
        connectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.emailAccounts.set(account.id, account);
      return account;
    },

    async upsert(data: {
      provider: string;
      address: string;
      encryptedRefreshToken: string;
      scopes: string;
    }): Promise<EmailAccount> {
      verifyOwnerInOrg();
      for (const existing of inMemoryStore.emailAccounts.values()) {
        if (existing.ownerId === ownerId && existing.provider === data.provider) {
          const updated: EmailAccount = {
            ...existing,
            address: data.address,
            encryptedRefreshToken: data.encryptedRefreshToken,
            scopes: data.scopes,
            connectedAt: new Date(),
            updatedAt: new Date()
          };
          inMemoryStore.emailAccounts.set(existing.id, updated);
          return updated;
        }
      }
      return this.create(data);
    },

    async delete(id: string): Promise<boolean> {
      verifyOwnerInOrg();
      const account = inMemoryStore.emailAccounts.get(id);
      if (!account || account.ownerId !== ownerId) {
        throw new AppError(404, 'NOT_FOUND', 'Email account not found');
      }
      return inMemoryStore.emailAccounts.delete(id);
    }
  };
}

/**
 * Email Template Repository - Scoped by organization
 */
export function getEmailTemplateRepository(orgId: string) {
  if (!orgId) throw new AppError(403, 'TENANCY_VIOLATION', 'orgId is required');

  const verifyBatchInOrg = (batchId: string) => {
    const batch = inMemoryStore.batches.get(batchId);
    if (!batch || batch.orgId !== orgId) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization');
    }
  };

  const getDefaultTemplate = (batchId: string, kind: EmailTemplateKind): EmailTemplate => {
    if (kind === EmailTemplateKind.shortlisted) {
      return {
        id: uuidv4(),
        batchId,
        kind,
        subject: 'Update regarding your application for {{job_title}} at {{company}}',
        body: '<p>Dear {{candidate_name}},</p><p>We are pleased to inform you that your qualifications closely match our requirements for the <strong>{{job_title}}</strong> role at <strong>{{company}}</strong>. Our hiring team would like to invite you to the next stage of our recruitment process.</p><p>We will be in touch with interview scheduling details shortly.</p><p>Best regards,<br/>The Hiring Team at {{company}}</p>',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    return {
      id: uuidv4(),
      batchId,
      kind,
      subject: 'Your application for {{job_title}} at {{company}}',
      body: '<p>Dear {{candidate_name}},</p><p>Thank you for taking the time to apply for the <strong>{{job_title}}</strong> position at <strong>{{company}}</strong>. After careful consideration of all applications, we have decided to proceed with other candidates whose experience more closely aligns with our current needs.</p><p>We truly appreciate your interest and wish you the very best in your search.</p><p>Best regards,<br/>The Hiring Team at {{company}}</p>',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  };

  return {
    async findByBatch(batchId: string): Promise<EmailTemplate[]> {
      verifyBatchInOrg(batchId);
      const results: EmailTemplate[] = [];
      for (const t of inMemoryStore.emailTemplates.values()) {
        if (t.batchId === batchId) {
          results.push(t);
        }
      }

      // If missing default templates, populate defaults
      if (!results.some((t) => t.kind === EmailTemplateKind.shortlisted)) {
        const defaultShortlisted = getDefaultTemplate(batchId, EmailTemplateKind.shortlisted);
        inMemoryStore.emailTemplates.set(defaultShortlisted.id, defaultShortlisted);
        results.push(defaultShortlisted);
      }
      if (!results.some((t) => t.kind === EmailTemplateKind.unshortlisted)) {
        const defaultUnshortlisted = getDefaultTemplate(batchId, EmailTemplateKind.unshortlisted);
        inMemoryStore.emailTemplates.set(defaultUnshortlisted.id, defaultUnshortlisted);
        results.push(defaultUnshortlisted);
      }

      return results;
    },

    async findByBatchAndKind(batchId: string, kind: EmailTemplateKind): Promise<EmailTemplate> {
      verifyBatchInOrg(batchId);
      for (const t of inMemoryStore.emailTemplates.values()) {
        if (t.batchId === batchId && t.kind === kind) {
          return t;
        }
      }
      const def = getDefaultTemplate(batchId, kind);
      inMemoryStore.emailTemplates.set(def.id, def);
      return def;
    },

    async upsert(data: {
      batchId: string;
      kind: EmailTemplateKind;
      subject: string;
      body: string;
    }): Promise<EmailTemplate> {
      verifyBatchInOrg(data.batchId);
      for (const existing of inMemoryStore.emailTemplates.values()) {
        if (existing.batchId === data.batchId && existing.kind === data.kind) {
          const updated: EmailTemplate = {
            ...existing,
            subject: data.subject,
            body: data.body,
            updatedAt: new Date()
          };
          inMemoryStore.emailTemplates.set(existing.id, updated);
          return updated;
        }
      }

      const created: EmailTemplate = {
        id: uuidv4(),
        batchId: data.batchId,
        kind: data.kind,
        subject: data.subject,
        body: data.body,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.emailTemplates.set(created.id, created);
      return created;
    }
  };
}

/**
 * Email Send Repository - Tracking and idempotency per batch & candidate
 */
export function getEmailSendRepository(orgId: string) {
  if (!orgId) throw new AppError(403, 'TENANCY_VIOLATION', 'orgId is required');

  const verifyBatchInOrg = (batchId: string) => {
    const batch = inMemoryStore.batches.get(batchId);
    if (!batch || batch.orgId !== orgId) {
      throw new AppError(404, 'NOT_FOUND', 'Batch not found in this organization');
    }
  };

  return {
    async findByBatch(batchId: string): Promise<any[]> {
      verifyBatchInOrg(batchId);
      const results: any[] = [];

      for (const send of inMemoryStore.emailSends.values()) {
        if (send.batchId === batchId) {
          const candidate = inMemoryStore.candidates.get(send.candidateId);
          results.push({
            ...send,
            candidateName: candidate?.fullName || 'Unknown Candidate',
            candidateEmail: candidate?.email || '',
            candidatePhone: candidate?.phone || null,
            decision: candidate?.decision || null,
            isManualEmail: candidate?.decisionSource === DecisionSource.manual
          });
        }
      }

      // Sort by createdAt desc
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async findById(id: string): Promise<EmailSend | null> {
      const send = inMemoryStore.emailSends.get(id);
      if (!send) return null;
      verifyBatchInOrg(send.batchId);
      return send;
    },

    async findByBatchAndCandidate(batchId: string, candidateId: string): Promise<EmailSend | null> {
      verifyBatchInOrg(batchId);
      for (const send of inMemoryStore.emailSends.values()) {
        if (send.batchId === batchId && send.candidateId === candidateId) {
          return send;
        }
      }
      return null;
    },

    async createQueued(batchId: string, candidateId: string): Promise<EmailSend> {
      verifyBatchInOrg(batchId);
      // Idempotency check: unique([batchId, candidateId])
      const existing = await this.findByBatchAndCandidate(batchId, candidateId);
      if (existing) {
        return existing;
      }

      const send: EmailSend = {
        id: uuidv4(),
        batchId,
        candidateId,
        status: EmailSendStatus.queued,
        error: null,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.emailSends.set(send.id, send);
      return send;
    },

    async updateStatus(
      id: string,
      status: EmailSendStatus,
      error: string | null = null,
      sentAt: Date | null = null
    ): Promise<EmailSend> {
      const send = inMemoryStore.emailSends.get(id);
      if (!send) {
        throw new AppError(404, 'NOT_FOUND', 'Email send record not found');
      }

      const updated: EmailSend = {
        ...send,
        status,
        error,
        sentAt: sentAt || (status === EmailSendStatus.sent ? new Date() : send.sentAt),
        updatedAt: new Date()
      };
      inMemoryStore.emailSends.set(id, updated);
      return updated;
    },

    async retryFailed(batchId: string): Promise<EmailSend[]> {
      verifyBatchInOrg(batchId);
      const retried: EmailSend[] = [];
      for (const send of inMemoryStore.emailSends.values()) {
        if (send.batchId === batchId && (send.status === EmailSendStatus.failed || send.status === EmailSendStatus.bounced)) {
          const updated: EmailSend = {
            ...send,
            status: EmailSendStatus.queued,
            error: null,
            updatedAt: new Date()
          };
          inMemoryStore.emailSends.set(send.id, updated);
          retried.push(updated);
        }
      }
      return retried;
    },

    async getStats(batchId: string): Promise<{ total: number; sent: number; queued: number; failed: number; bounced: number }> {
      verifyBatchInOrg(batchId);
      let total = 0;
      let sent = 0;
      let queued = 0;
      let failed = 0;
      let bounced = 0;

      for (const send of inMemoryStore.emailSends.values()) {
        if (send.batchId === batchId) {
          total++;
          if (send.status === EmailSendStatus.sent) sent++;
          else if (send.status === EmailSendStatus.queued) queued++;
          else if (send.status === EmailSendStatus.failed) failed++;
          else if (send.status === EmailSendStatus.bounced) bounced++;
        }
      }

      return { total, sent, queued, failed, bounced };
    }
  };
}

/**
 * Global Candidate Repository (for system lifecycle & privacy operations across orgs)
 */
export const candidateRepositoryGlobal = {
  async findExpired(beforeDate: Date = new Date(), limit: number = 50): Promise<Candidate[]> {
    const results: Candidate[] = [];
    for (const candidate of inMemoryStore.candidates.values()) {
      if (candidate.expiresAt && candidate.expiresAt <= beforeDate) {
        results.push(candidate);
        if (results.length >= limit) break;
      }
    }
    return results;
  },

  async deleteById(id: string): Promise<{ deleted: boolean; resumePath: string | null; batchId: string | null }> {
    const candidate = inMemoryStore.candidates.get(id);
    if (!candidate) return { deleted: false, resumePath: null, batchId: null };

    // Clean up email sends
    for (const [sendId, send] of inMemoryStore.emailSends.entries()) {
      if (send.candidateId === id) inMemoryStore.emailSends.delete(sendId);
    }

    inMemoryStore.candidates.delete(id);
    return { deleted: true, resumePath: candidate.resumePath, batchId: candidate.batchId };
  },

  async deleteByEmail(email: string): Promise<{
    deletedCount: number;
    deletedResumePaths: string[];
    affectedOrgIds: string[];
  }> {
    const targetEmail = email.toLowerCase().trim();
    const deletedResumePaths: string[] = [];
    const affectedOrgIdsSet = new Set<string>();
    let deletedCount = 0;

    for (const [id, candidate] of inMemoryStore.candidates.entries()) {
      if (candidate.email && candidate.email.toLowerCase().trim() === targetEmail) {
        deletedCount++;
        if (candidate.resumePath) {
          deletedResumePaths.push(candidate.resumePath);
        }
        const batch = inMemoryStore.batches.get(candidate.batchId);
        if (batch) {
          affectedOrgIdsSet.add(batch.orgId);
        }
        // Clean up email sends
        for (const [sendId, send] of inMemoryStore.emailSends.entries()) {
          if (send.candidateId === id) inMemoryStore.emailSends.delete(sendId);
        }
        inMemoryStore.candidates.delete(id);
      }
    }

    return {
      deletedCount,
      deletedResumePaths,
      affectedOrgIds: Array.from(affectedOrgIdsSet)
    };
  }
};

/**
 * Candidate Check Repository (Guest pre-screening)
 * Enforces: A guest cannot read another guest's check!
 */
export const candidateCheckRepository = {
  async create(data: {
    jobTitle: string;
    company?: string | null;
    jdText: string;
    resumeText?: string | null;
    resumePath?: string | null;
    userId?: string | null;
    anonToken?: string | null;
    scoreBefore?: number | null;
    scoreAfter?: number | null;
    breakdown?: any;
    status?: CheckStatus;
    expiresAt?: Date | null;
  }): Promise<CandidateCheck> {
    const defaultExpiresAt = data.userId
      ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days signed-in default
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);  // 7 days guest checks

    const check: CandidateCheck = {
      id: uuidv4(),
      userId: data.userId || null,
      anonToken: data.anonToken || null,
      jobTitle: data.jobTitle,
      company: data.company || null,
      jdText: data.jdText,
      resumeText: data.resumeText || null,
      resumePath: data.resumePath || null,
      scoreBefore: data.scoreBefore ?? null,
      scoreAfter: data.scoreAfter ?? null,
      breakdown: data.breakdown ?? null,
      status: data.status || CheckStatus.pending,
      expiresAt: data.expiresAt !== undefined ? data.expiresAt : defaultExpiresAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryStore.candidateChecks.set(check.id, check);
    return check;
  },

  async findById(id: string): Promise<CandidateCheck | null> {
    return inMemoryStore.candidateChecks.get(id) || null;
  },

  async update(id: string, data: Partial<CandidateCheck>): Promise<CandidateCheck> {
    const existing = inMemoryStore.candidateChecks.get(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Candidate check not found');
    }
    const updated: CandidateCheck = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };
    inMemoryStore.candidateChecks.set(id, updated);
    return updated;
  },

  async delete(id: string): Promise<{ deleted: boolean; resumePath: string | null }> {
    const check = inMemoryStore.candidateChecks.get(id);
    if (!check) return { deleted: false, resumePath: null };

    // Clean up suggestions
    for (const [sugId, sug] of inMemoryStore.suggestions.entries()) {
      if (sug.checkId === id) inMemoryStore.suggestions.delete(sugId);
    }

    inMemoryStore.candidateChecks.delete(id);
    return { deleted: true, resumePath: check.resumePath };
  },

  async deleteByUserId(userId: string): Promise<{ deletedCount: number; resumePaths: string[] }> {
    const resumePaths: string[] = [];
    let deletedCount = 0;

    for (const [id, check] of inMemoryStore.candidateChecks.entries()) {
      if (check.userId === userId) {
        deletedCount++;
        if (check.resumePath) resumePaths.push(check.resumePath);
        for (const [sugId, sug] of inMemoryStore.suggestions.entries()) {
          if (sug.checkId === id) inMemoryStore.suggestions.delete(sugId);
        }
        inMemoryStore.candidateChecks.delete(id);
      }
    }

    return { deletedCount, resumePaths };
  },

  async findExpired(beforeDate: Date = new Date(), limit: number = 50): Promise<CandidateCheck[]> {
    const results: CandidateCheck[] = [];
    for (const check of inMemoryStore.candidateChecks.values()) {
      if (check.expiresAt && check.expiresAt <= beforeDate) {
        results.push(check);
        if (results.length >= limit) break;
      }
    }
    return results;
  },

  async findByIdAndToken(id: string, anonToken: string): Promise<CandidateCheck | null> {
    if (!anonToken) return null;
    const check = inMemoryStore.candidateChecks.get(id);
    if (!check || check.anonToken !== anonToken) {
      return null; // Tenancy boundary prevents access
    }
    return check;
  },

  async findByIdAndUser(id: string, userId: string): Promise<CandidateCheck | null> {
    if (!userId) return null;
    const check = inMemoryStore.candidateChecks.get(id);
    if (!check || check.userId !== userId) {
      return null;
    }
    return check;
  },

  async findByUserId(userId: string): Promise<CandidateCheck[]> {
    if (!userId) return [];
    const results: CandidateCheck[] = [];
    for (const check of inMemoryStore.candidateChecks.values()) {
      if (check.userId === userId) {
        results.push(check);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
};

/**
 * Suggestion Repository
 */
export const suggestionRepository = {
  async create(data: {
    checkId: string;
    section: string;
    originalText: string;
    proposedText: string;
    reason: string;
    impact?: string | null;
    status?: SuggestionStatus;
    finalText?: string | null;
  }): Promise<Suggestion> {
    const suggestion: Suggestion = {
      id: uuidv4(),
      checkId: data.checkId,
      section: data.section,
      originalText: data.originalText,
      proposedText: data.proposedText,
      reason: data.reason,
      impact: data.impact || 'medium',
      status: data.status || SuggestionStatus.pending,
      finalText: data.finalText || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryStore.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  },

  async createMany(
    items: Array<{
      checkId: string;
      section: string;
      originalText: string;
      proposedText: string;
      reason: string;
      impact?: string | null;
      status?: SuggestionStatus;
      finalText?: string | null;
    }>
  ): Promise<Suggestion[]> {
    const results: Suggestion[] = [];
    for (const item of items) {
      const s = await this.create(item);
      results.push(s);
    }
    return results;
  },

  async findByCheckId(checkId: string): Promise<Suggestion[]> {
    const results: Suggestion[] = [];
    for (const s of inMemoryStore.suggestions.values()) {
      if (s.checkId === checkId) {
        results.push(s);
      }
    }
    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async findById(id: string): Promise<Suggestion | null> {
    return inMemoryStore.suggestions.get(id) || null;
  },

  async update(
    id: string,
    data: { status?: SuggestionStatus; finalText?: string | null }
  ): Promise<Suggestion> {
    const existing = inMemoryStore.suggestions.get(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Suggestion not found');
    }
    const updated: Suggestion = {
      ...existing,
      ...(data.status ? { status: data.status } : {}),
      ...(data.finalText !== undefined ? { finalText: data.finalText } : {}),
      updatedAt: new Date()
    };
    inMemoryStore.suggestions.set(id, updated);
    return updated;
  }
};

/**
 * LLM Cache Repository
 * Caches every LLM response keyed by hash of inputs
 */
export const llmCacheRepository = {
  async get<T>(key: string): Promise<T | null> {
    const cached = inMemoryStore.llmCaches.get(key);
    if (!cached) return null;
    return cached.response as T;
  },

  async set(key: string, response: any): Promise<void> {
    inMemoryStore.llmCaches.set(key, {
      id: uuidv4(),
      key,
      response,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
};

/**
 * Deletion Request Repository (for candidate privacy deletion request flow)
 */
export const deletionRequestRepository = {
  async createOrUpdate(data: {
    email: string;
    emailHash: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<DeletionRequest> {
    const existing = inMemoryStore.deletionRequests.get(data.emailHash);
    const req: DeletionRequest = {
      id: existing ? existing.id : uuidv4(),
      email: data.email,
      emailHash: data.emailHash,
      codeHash: data.codeHash,
      status: DeletionStatus.pending,
      expiresAt: data.expiresAt,
      verifiedAt: null,
      createdAt: existing ? existing.createdAt : new Date(),
      updatedAt: new Date()
    };
    inMemoryStore.deletionRequests.set(data.emailHash, req);
    return req;
  },

  async findByEmailHash(emailHash: string): Promise<DeletionRequest | null> {
    return inMemoryStore.deletionRequests.get(emailHash) || null;
  },

  async markCompleted(id: string): Promise<DeletionRequest> {
    for (const req of inMemoryStore.deletionRequests.values()) {
      if (req.id === id) {
        req.status = DeletionStatus.completed;
        req.verifiedAt = new Date();
        req.updatedAt = new Date();
        inMemoryStore.deletionRequests.set(req.emailHash, req);
        return req;
      }
    }
    throw new AppError(404, 'NOT_FOUND', 'Deletion request not found');
  }
};

/**
 * Audit Log Repository
 */
export const auditLogRepository = {
  async log(data: {
    orgId: string;
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    meta?: any;
  }): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: uuidv4(),
      orgId: data.orgId,
      actorId: data.actorId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      meta: data.meta || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryStore.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  },

  async findByEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    const results: AuditLog[] = [];
    for (const log of inMemoryStore.auditLogs.values()) {
      if (log.entity === entity && log.entityId === entityId) {
        results.push(log);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async findByOrg(orgId: string): Promise<AuditLog[]> {
    const results: AuditLog[] = [];
    for (const log of inMemoryStore.auditLogs.values()) {
      if (log.orgId === orgId) {
        results.push(log);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async findPrivacyActivityByOrg(orgId: string): Promise<AuditLog[]> {
    const privacyActions = new Set([
      'CANDIDATE_DATA_DELETED_BY_REQUEST',
      'BATCH_DELETED',
      'DATA_LIFECYCLE_PURGE',
      'RETENTION_SETTING_UPDATED'
    ]);
    const results: AuditLog[] = [];
    for (const log of inMemoryStore.auditLogs.values()) {
      if (log.orgId === orgId && privacyActions.has(log.action)) {
        results.push(log);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
};


