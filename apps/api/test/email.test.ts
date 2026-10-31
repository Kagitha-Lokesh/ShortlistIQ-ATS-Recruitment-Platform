import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { runSeed } from '../prisma/seed.js';
import { jobQueue } from '../src/services/queue.js';
import { encryptToken, decryptToken } from '../src/services/crypto.js';
import {
  getCandidateRepository,
  getEmailSendRepository,
  getEmailAccountRepository,
  getEmailTemplateRepository,
  auditLogRepository
} from '../src/repositories/index.js';
import { CandidateDecision, DecisionSource, EmailSendStatus, BatchStatus } from '@prisma/client';

describe('Phase 9: OAuth Email, Template Engine & Throttled Dispatch API', () => {
  let seedData: Awaited<ReturnType<typeof runSeed>>;
  let orgId: string;
  let hrToken: string;
  let userId: string;
  let batchId: string;

  beforeEach(async () => {
    seedData = await runSeed();
    orgId = seedData.orgA.id;
    userId = seedData.hrA.id;
    hrToken = `mock-token:${seedData.hrA.id}:${seedData.hrA.fullName}`;

    // Clean existing email accounts for this user so each test has an isolated state
    const accountRepo = getEmailAccountRepository(orgId, userId);
    const existingAccounts = await accountRepo.findMany();
    for (const a of existingAccounts) {
      await accountRepo.delete(a.id);
    }

    // Create fresh isolated batch for email tests
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Email Dispatch Test Batch',
        jobTitle: 'Senior Full Stack Engineer',
        jdText: 'Looking for a Senior Full Stack Engineer with TypeScript and React.',
        cutoff: 70
      });
    batchId = batchRes.body.data.id;
  });

  describe('1. AES-256-GCM Encryption & OAuth Connection Security', () => {
    it('encrypts and decrypts refresh tokens with AES-256-GCM correctly', () => {
      const rawToken = '1//04xAbCdEfGhIjKlMnOpQrStUvWxYz123456789';
      const encrypted = encryptToken(rawToken);

      expect(encrypted).not.toBe(rawToken);
      expect(encrypted.split(':')).toHaveLength(3); // iv : authTag : cipherText

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(rawToken);
    });

    it('connects a Gmail / Outlook account and proves tokens never reach the browser', async () => {
      const connectRes = await request(app)
        .post('/api/v1/email/mock-connect')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          provider: 'gmail',
          address: 'talent.acquisition@acme-corp.com'
        });

      expect(connectRes.status).toBe(200);
      expect(connectRes.body.success).toBe(true);
      expect(connectRes.body.data.address).toBe('talent.acquisition@acme-corp.com');
      // Token MUST NEVER reach browser
      expect(connectRes.body.data.encryptedRefreshToken).toBeUndefined();
      expect(connectRes.body.data.refreshToken).toBeUndefined();

      // Verify list endpoint also strips token
      const listRes = await request(app)
        .get('/api/v1/email/accounts')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].address).toBe('talent.acquisition@acme-corp.com');
      expect(listRes.body.data[0].encryptedRefreshToken).toBeUndefined();
    });

    it('allows HR to disconnect an account, revoking the token and removing the record', async () => {
      // Connect account
      const connectRes = await request(app)
        .post('/api/v1/email/mock-connect')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          provider: 'outlook',
          address: 'recruiting@acme.microsoft.com'
        });

      const accountId = connectRes.body.data.id;

      // Disconnect
      const deleteRes = await request(app)
        .delete(`/api/v1/email/accounts/${accountId}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify list is empty
      const listRes = await request(app)
        .get('/api/v1/email/accounts')
        .set('Authorization', `Bearer ${hrToken}`);
      expect(listRes.body.data).toHaveLength(0);
    });
  });

  describe('2. Template Editor & Variable Rendering', () => {
    it('retrieves default templates and saves customized rich text templates', async () => {
      const getRes = await request(app)
        .get(`/api/v1/email/batches/${batchId}/templates`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data).toHaveLength(2); // Shortlisted and unshortlisted

      // Update shortlisted template
      const updateRes = await request(app)
        .put(`/api/v1/email/batches/${batchId}/templates`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          kind: 'shortlisted',
          subject: 'Congratulations {{candidate_name}}! Interview invitation from {{company}}',
          body: '<p>Hi {{candidate_name}}, we want to interview you for {{job_title}} at {{company}}!</p>'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.subject).toContain('{{candidate_name}}');
      expect(updateRes.body.data.body).toContain('{{job_title}}');
    });

    it('sends a test email preview with sample data to the logged-in HR address', async () => {
      // Connect sender account first
      await request(app)
        .post('/api/v1/email/mock-connect')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ provider: 'gmail', address: 'hr-sender@acme.com' });

      const testRes = await request(app)
        .post(`/api/v1/email/batches/${batchId}/test`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ kind: 'shortlisted' });

      expect(testRes.status).toBe(200);
      expect(testRes.body.success).toBe(true);
      expect(testRes.body.message).toContain('Test email sent successfully');
    });
  });

  describe('3. Batch Finalization, Guardrails & Idempotent Sending', () => {
    it('blocks batch finalization while ANY needs_review candidates exist', async () => {
      // Connect sender account
      await request(app)
        .post('/api/v1/email/mock-connect')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ provider: 'gmail' });

      // Create a candidate in needs_review state
      const candidateRepo = getCandidateRepository(orgId);
      await candidateRepo.create({
        batchId,
        fullName: 'Borderline Bob',
        email: 'bob.borderline@example.com',
        decision: CandidateDecision.needs_review
      });

      // Attempt to finalize batch
      const finalizeRes = await request(app)
        .post(`/api/v1/email/batches/${batchId}/finalize`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ confirmation: 'SEND' });

      expect(finalizeRes.status).toBe(400);
      expect(finalizeRes.body.error.code).toBe('HAS_NEEDS_REVIEW');
    });

    it('requires explicit confirmation string "SEND" to finalize', async () => {
      const finalizeRes = await request(app)
        .post(`/api/v1/email/batches/${batchId}/finalize`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ confirmation: 'YES' }); // Not 'SEND'

      expect(finalizeRes.status).toBe(400);
      expect(finalizeRes.body.error.code).toBe('CONFIRMATION_REQUIRED');
    });

    it('finalizes clean batch, dispatches emails, locks batch decisions, and guarantees no double sending', async () => {
      // 1. Connect sender account
      await request(app)
        .post('/api/v1/email/mock-connect')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ provider: 'gmail', address: 'recruiter@acme.com' });

      // 2. Setup 2 shortlisted candidates and 1 unshortlisted candidate
      const candidateRepo = getCandidateRepository(orgId);
      const c1 = await candidateRepo.create({
        batchId,
        fullName: 'Alice Shortlisted',
        email: 'alice@example.com',
        decision: CandidateDecision.shortlisted
      });
      const c2 = await candidateRepo.create({
        batchId,
        fullName: 'Charlie Shortlisted',
        email: 'charlie@example.com',
        decision: CandidateDecision.shortlisted
      });
      const c3 = await candidateRepo.create({
        batchId,
        fullName: 'David Unshortlisted',
        email: 'david@example.com',
        decision: CandidateDecision.unshortlisted
      });

      // 3. Finalize batch
      const finalizeRes = await request(app)
        .post(`/api/v1/email/batches/${batchId}/finalize`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ confirmation: 'SEND' });

      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.success).toBe(true);
      expect(finalizeRes.body.data.status).toBe('finalized');
      expect(finalizeRes.body.data.queuedCount).toBe(3);

      // Drain queue
      await jobQueue.drainLocalQueue();

      // 4. Verify all 3 emails sent in DB
      const sendRepo = getEmailSendRepository(orgId);
      const stats = await sendRepo.getStats(batchId);
      expect(stats.sent).toBe(3);
      expect(stats.queued).toBe(0);

      // 5. PROVE LOCKING: Decisions CANNOT be modified once batch is finalized
      const overrideRes = await request(app)
        .post(`/api/v1/batches/${batchId}/candidates/bulk-decision`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ candidateIds: [c3.id], decision: 'shortlisted' });

      expect(overrideRes.status).toBe(400);
      expect(overrideRes.body.error.code).toBe('BATCH_LOCKED');

      // 6. PROVE NO DOUBLE-SENDING: Re-running processEmailSend or worker skips already sent records
      const existingSends = await sendRepo.findByBatch(batchId);
      const send1 = existingSends[0];

      // Call processEmailSend directly with the same payload
      await jobQueue.processEmailSend({
        emailSendId: send1.id,
        batchId,
        candidateId: send1.candidateId,
        orgId,
        ownerId: userId
      });

      // Stats must still remain exactly 3 sent (no duplicate rows, no double-sends)
      const statsAfter = await sendRepo.getStats(batchId);
      expect(statsAfter.sent).toBe(3);

      // 7. Verify AuditLog: Check that finalization and sends are logged WITHOUT email body
      const auditLogs = await auditLogRepository.findByOrg(orgId);
      const finalizedLog = auditLogs.find((l) => l.action === 'BATCH_FINALIZED');
      expect(finalizedLog).toBeDefined();

      const sendLogs = auditLogs.filter((l) => l.action === 'EMAIL_SENT');
      expect(sendLogs.length).toBeGreaterThanOrEqual(3);
      for (const log of sendLogs) {
        const meta = log.meta as any;
        expect(meta).toHaveProperty('recipientEmail');
        expect(meta).toHaveProperty('senderAddress');
        // CRITICAL AUDIT RULE: NEVER LOG EMAIL BODIES!
        expect(meta.body).toBeUndefined();
        expect(meta.html).toBeUndefined();
      }
    });

    it('tracks delivery status and allows retrying failed email sends', async () => {
      // Connect sender account
      await request(app)
        .post('/api/v1/email/mock-connect')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ provider: 'gmail' });

      const candidateRepo = getCandidateRepository(orgId);
      const sendRepo = getEmailSendRepository(orgId);

      const candidate = await candidateRepo.create({
        batchId,
        fullName: 'Fail Candidate',
        email: 'fail@example.com',
        decision: CandidateDecision.shortlisted
      });

      // Create a failed email send record
      const send = await sendRepo.createQueued(batchId, candidate.id);
      await sendRepo.updateStatus(send.id, EmailSendStatus.failed, 'SMTP connection timeout');

      // Query sends list
      const sendsRes = await request(app)
        .get(`/api/v1/email/batches/${batchId}/sends`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(sendsRes.status).toBe(200);
      expect(sendsRes.body.data.sends).toHaveLength(1);
      expect(sendsRes.body.data.sends[0].status).toBe('failed');
      expect(sendsRes.body.data.sends[0].error).toBe('SMTP connection timeout');

      // Retry failed
      const retryRes = await request(app)
        .post(`/api/v1/email/batches/${batchId}/retry`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.retriedCount).toBe(1);

      // Drain queue
      await jobQueue.drainLocalQueue();

      // Verify it successfully delivered on retry
      const updatedSend = await sendRepo.findById(send.id);
      expect(updatedSend?.status).toBe(EmailSendStatus.sent);
    });
  });
});
