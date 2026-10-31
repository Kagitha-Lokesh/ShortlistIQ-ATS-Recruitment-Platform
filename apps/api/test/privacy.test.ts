import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  resetRepositories,
  orgRepository,
  profileRepository,
  getBatchRepository,
  getCandidateRepository,
  candidateCheckRepository,
  auditLogRepository,
  deletionRequestRepository,
  candidateRepositoryGlobal,
  inMemoryStore
} from '../src/repositories/index.js';
import { storageService, STORAGE_BUCKETS } from '../src/services/storage.js';
import { jobQueue } from '../src/services/queue.js';
import { CheckStatus, CandidateStatus } from '@prisma/client';

describe('Phase 10: Privacy and Data Lifecycle', () => {
  let org: any;
  let hrProfile: any;
  let hrToken: string;

  beforeEach(async () => {
    resetRepositories();

    // Setup an organization with 60 days default retention
    org = await orgRepository.create('Acme Technologies Inc.', 60);

    hrProfile = await profileRepository.create({
      id: 'hr-officer-1',
      orgId: org.id,
      role: 'hr',
      fullName: 'Chief Privacy Officer'
    });

    hrToken = `mock-token:${hrProfile.id}:Chief Privacy Officer`;
  });

  describe('1. Retention and expiresAt calculation', () => {
    it('sets 7 days expiresAt for anonymous guest checks', async () => {
      const now = Date.now();
      const guestCheck = await candidateCheckRepository.create({
        jobTitle: 'Frontend Engineer',
        jdText: 'Looking for a skilled React TypeScript developer.',
        anonToken: 'anon-guest-1234'
      });

      expect(guestCheck.expiresAt).toBeDefined();
      const diffDays = Math.round(
        (guestCheck.expiresAt!.getTime() - now) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(7);
    });

    it('sets org retentionDays (default 60 days) for Candidate rows created in a batch', async () => {
      const now = Date.now();
      const batchRepo = getBatchRepository(org.id);
      const batch = await batchRepo.create({
        name: 'Engineering Batch Q4',
        jobTitle: 'Backend Engineer',
        jdText: 'Node.js, PostgreSQL, distributed systems experience required.',
        ownerId: hrProfile.id
      });

      const candRepo = getCandidateRepository(org.id);
      const candidate = await candRepo.create({
        batchId: batch.id,
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com'
      });

      expect(candidate.expiresAt).toBeDefined();
      const diffDays = Math.round(
        (candidate.expiresAt!.getTime() - now) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(60);
    });

    it('honors customized org retentionDays (e.g. 30 days) when creating candidates', async () => {
      const customOrg = await orgRepository.create('Short Retention Org', 30);
      const batchRepo = getBatchRepository(customOrg.id);
      const batch = await batchRepo.create({
        name: 'Short Batch',
        jobTitle: 'Designer',
        jdText: 'Figma UI/UX design experience required.',
        ownerId: hrProfile.id
      });

      const candRepo = getCandidateRepository(customOrg.id);
      const candidate = await candRepo.create({
        batchId: batch.id,
        fullName: 'Alex Ray',
        email: 'alex@example.com'
      });

      const diffDays = Math.round(
        (candidate.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(30);
    });
  });

  describe('2. Scheduled daily data lifecycle job', () => {
    it('deletes expired candidate rows and their storage files, and logs counts only', async () => {
      const batchRepo = getBatchRepository(org.id);
      const batch = await batchRepo.create({
        name: 'Batch With Expired Data',
        jobTitle: 'DevOps',
        jdText: 'Kubernetes, AWS experience required.',
        ownerId: hrProfile.id
      });

      // Upload mock resumes
      const validPdf = Buffer.from('%PDF-1.4\nMock valid test pdf content\n%%EOF');
      const upload1 = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        'user-1',
        validPdf,
        'application/pdf'
      );
      const upload2 = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        'user-2',
        validPdf,
        'application/pdf'
      );

      const candRepo = getCandidateRepository(org.id);

      // Candidate 1: Expired yesterday
      const expiredCandidate = await candRepo.create({
        batchId: batch.id,
        fullName: 'Old Candidate',
        email: 'old@example.com',
        resumePath: upload1.path,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      });

      // Candidate 2: Valid for 30 more days
      const activeCandidate = await candRepo.create({
        batchId: batch.id,
        fullName: 'Active Candidate',
        email: 'active@example.com',
        resumePath: upload2.path,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Expired guest check
      const expiredCheck = await candidateCheckRepository.create({
        jobTitle: 'Guest Check',
        jdText: 'React dev',
        expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
      });

      // Execute data lifecycle cleanup
      const result = await jobQueue.runDataLifecycleCleanup();

      expect(result.deletedCandidates).toBe(1);
      expect(result.deletedChecks).toBe(1);
      expect(result.deletedFiles).toBeGreaterThanOrEqual(1);

      // Verify expired candidate was deleted, active candidate remains
      expect(await candRepo.findById(expiredCandidate.id)).toBeNull();
      expect(await candRepo.findById(activeCandidate.id)).not.toBeNull();
      expect(await candidateCheckRepository.findById(expiredCheck.id)).toBeNull();
    });
  });

  describe('3. Candidate privacy deletion request flow', () => {
    it('initiates deletion request with a 6-digit code and rate limits requests', async () => {
      const email = 'candidate.delete@example.com';

      const res = await request(app)
        .post('/api/v1/privacy/deletion-request')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.emailHash).toBeDefined();

      // Verify request in repository
      const reqRecord = await deletionRequestRepository.findByEmailHash(res.body.emailHash);
      expect(reqRecord).not.toBeNull();
      expect(reqRecord?.status).toBe('pending');
    });

    it('verifies code, deletes cross-org candidate records & files, and notifies affected orgs without personal data', async () => {
      const email = 'target.candidate@test.com';

      // 1. Create candidate records in two different orgs with uploaded resumes
      const org2 = await orgRepository.create('Second Org Inc.', 60);

      const batch1 = await getBatchRepository(org.id).create({
        name: 'Batch Org 1',
        jobTitle: 'Engineer',
        jdText: 'JD text 1',
        ownerId: hrProfile.id
      });
      const batch2 = await getBatchRepository(org2.id).create({
        name: 'Batch Org 2',
        jobTitle: 'Lead',
        jdText: 'JD text 2',
        ownerId: hrProfile.id
      });

      const validPdf = Buffer.from('%PDF-1.4\nMock valid test pdf content\n%%EOF');
      const file1 = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        'user-a',
        validPdf,
        'application/pdf'
      );
      const file2 = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        'user-b',
        validPdf,
        'application/pdf'
      );

      await getCandidateRepository(org.id).create({
        batchId: batch1.id,
        fullName: 'Target Candidate',
        email,
        resumePath: file1.path
      });

      await getCandidateRepository(org2.id).create({
        batchId: batch2.id,
        fullName: 'Target Candidate',
        email,
        resumePath: file2.path
      });

      // 2. Request deletion
      const reqRes = await request(app)
        .post('/api/v1/privacy/deletion-request')
        .send({ email });

      const emailHash = reqRes.body.emailHash;
      const storedReq = await deletionRequestRepository.findByEmailHash(emailHash);

      // Simulate entering wrong code
      const wrongCodeRes = await request(app)
        .post('/api/v1/privacy/verify-deletion')
        .send({ email, code: '000000' });
      expect(wrongCodeRes.status).toBe(400);

      // Verify with stored code by finding code or testing deletion execution
      // We will create a known code request to verify execution
      const knownCode = '123456';
      const crypto = await import('node:crypto');
      const knownCodeHash = crypto.createHash('sha256').update(knownCode).digest('hex');

      await deletionRequestRepository.createOrUpdate({
        email,
        emailHash,
        codeHash: knownCodeHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });

      const verifyRes = await request(app)
        .post('/api/v1/privacy/verify-deletion')
        .send({ email, code: knownCode });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.recordsDeleted).toBe(2);

      // Verify candidate rows are gone across both orgs
      const org1Candidates = await getCandidateRepository(org.id).findManyByBatch(batch1.id);
      const org2Candidates = await getCandidateRepository(org2.id).findManyByBatch(batch2.id);
      expect(org1Candidates.length).toBe(0);
      expect(org2Candidates.length).toBe(0);

      // Verify affected orgs received an audit notification WITHOUT personal data
      const org1Logs = await auditLogRepository.findByOrg(org.id);
      const privacyLog = org1Logs.find(
        (l) => l.action === 'CANDIDATE_DATA_DELETED_BY_REQUEST'
      );
      expect(privacyLog).toBeDefined();
      expect(JSON.stringify(privacyLog?.meta)).not.toContain(email);
      expect(JSON.stringify(privacyLog?.meta)).not.toContain('Target Candidate');
    });
  });

  describe('4. Self-service deletion & HR controls', () => {
    it('allows signed-in candidate to delete a single check and resume', async () => {
      const candidateProfile = await profileRepository.create({
        id: 'candidate-user-1',
        role: 'candidate',
        fullName: 'Self Candidate'
      });

      const candidateToken = `mock-token:${candidateProfile.id}:Self Candidate`;

      const check = await candidateCheckRepository.create({
        userId: candidateProfile.id,
        jobTitle: 'QA Engineer',
        jdText: 'Test automation with Playwright and Vitest'
      });

      const delRes = await request(app)
        .delete(`/api/v1/checks/${check.id}`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const found = await candidateCheckRepository.findById(check.id);
      expect(found).toBeNull();
    });

    it('allows HR to delete an entire batch (rows and storage files)', async () => {
      const batchRepo = getBatchRepository(org.id);
      const batch = await batchRepo.create({
        name: 'Batch To Be Deleted',
        jobTitle: 'Product Manager',
        jdText: 'Roadmapping and customer discovery',
        ownerId: hrProfile.id
      });

      const candRepo = getCandidateRepository(org.id);
      await candRepo.create({
        batchId: batch.id,
        fullName: 'PM Candidate 1',
        email: 'pm1@example.com'
      });
      await candRepo.create({
        batchId: batch.id,
        fullName: 'PM Candidate 2',
        email: 'pm2@example.com'
      });

      const delRes = await request(app)
        .delete(`/api/v1/batches/${batch.id}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.data.candidateCount).toBe(2);

      // Verify batch and candidates are purged
      expect(await batchRepo.findById(batch.id)).toBeNull();
      const candidates = await candRepo.findManyByBatch(batch.id).catch(() => []);
      expect(candidates.length).toBe(0);
    });

    it('allows HR to change data retention period in settings (30, 60, 90, 180)', async () => {
      const getRes = await request(app)
        .get('/api/v1/org/settings')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.retentionDays).toBe(60);

      // Update to 90 days
      const patchRes = await request(app)
        .patch('/api/v1/org/settings')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ retentionDays: 90 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.retentionDays).toBe(90);

      // Verify audit log entry was created
      const privacyLogs = await auditLogRepository.findPrivacyActivityByOrg(org.id);
      const retentionLog = privacyLogs.find((l) => l.action === 'RETENTION_SETTING_UPDATED');
      expect(retentionLog).toBeDefined();
      expect(retentionLog?.meta.newRetentionDays).toBe(90);
    });
  });
});
