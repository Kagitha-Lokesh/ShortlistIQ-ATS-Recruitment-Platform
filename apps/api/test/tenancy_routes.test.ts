import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { dbService } from '../src/services/db.js';
import { storageService, STORAGE_BUCKETS } from '../src/services/storage.js';
import {
  orgRepository,
  profileRepository,
  getBatchRepository,
  getCandidateRepository,
  getFormRepository,
  getEmailAccountRepository,
  getEmailTemplateRepository,
  candidateCheckRepository
} from '../src/repositories/index.js';
import { EmailTemplateKind } from '@prisma/client';

describe('Phase 11: Route-Level Tenancy & Security Hardening Tests', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    dbService.resetMockStore();
    storageService.resetMockStorage();

    // Setup Organization A & User A
    const orgA = await orgRepository.create({ name: 'Acme Corp' });
    orgAId = orgA.id;
    userAId = 'user-a-uuid';
    await profileRepository.create({
      id: userAId,
      orgId: orgAId,
      fullName: 'Alice HR',
      role: 'hr'
    });
    tokenA = `mock-user:${userAId}:alice@acme.com`;

    // Setup Organization B & User B
    const orgB = await orgRepository.create({ name: 'Beta Ltd' });
    orgBId = orgB.id;
    userBId = 'user-b-uuid';
    await profileRepository.create({
      id: userBId,
      orgId: orgBId,
      fullName: 'Bob HR',
      role: 'hr'
    });
    tokenB = `mock-user:${userBId}:bob@beta.com`;
  });

  describe('Batches & Candidates Route Isolation', () => {
    it('blocks Org B from accessing Org A batch details', async () => {
      const batchRepoA = getBatchRepository(orgAId);
      const batchA = await batchRepoA.create({
        name: 'Batch A Job',
        jobTitle: 'Backend Engineer',
        jdText: 'Looking for a senior backend engineer with Node.js and Postgres',
        ownerId: userAId
      });

      const res = await request(app)
        .get(`/api/v1/batches/${batchA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('blocks Org B from updating or deleting Org A batches', async () => {
      const batchRepoA = getBatchRepository(orgAId);
      const batchA = await batchRepoA.create({
        name: 'Batch A Job',
        jobTitle: 'Backend Engineer',
        jdText: 'Looking for a senior backend engineer with Node.js and Postgres',
        ownerId: userAId
      });

      const patchRes = await request(app)
        .patch(`/api/v1/batches/${batchA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Batch Name' });

      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/batches/${batchA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deleteRes.status).toBe(404);
    });

    it('blocks Org B from viewing or updating candidates in Org A batches', async () => {
      const batchRepoA = getBatchRepository(orgAId);
      const candidateRepoA = getCandidateRepository(orgAId);

      const batchA = await batchRepoA.create({
        name: 'Batch A Job',
        jobTitle: 'Backend Engineer',
        jdText: 'Looking for a senior backend engineer with Node.js and Postgres',
        ownerId: userAId
      });

      const candidateA = await candidateRepoA.create({
        batchId: batchA.id,
        fullName: 'Charlie Applicant',
        email: 'charlie@applicant.com',
        source: 'upload',
        resumeText: 'Experience in Node.js, Express, and PostgreSQL.'
      });

      const listRes = await request(app)
        .get(`/api/v1/batches/${batchA.id}/candidates`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(listRes.status).toBe(404);

      const patchCandidateRes = await request(app)
        .patch(`/api/v1/batches/${batchA.id}/candidates/${candidateA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ decision: 'shortlisted' });

      expect(patchCandidateRes.status).toBe(404);
    });
  });

  describe('Application Forms Route Isolation', () => {
    it('blocks Org B from accessing, modifying, or deleting Org A forms', async () => {
      const batchRepoA = getBatchRepository(orgAId);
      const formRepoA = getFormRepository(orgAId);

      const batchA = await batchRepoA.create({
        name: 'Batch A Job',
        jobTitle: 'Backend Engineer',
        jdText: 'Looking for a senior backend engineer with Node.js and Postgres',
        ownerId: userAId
      });

      const formA = await formRepoA.create({
        batchId: batchA.id,
        title: 'Acme Backend Application Form',
        slug: 'acme-backend-dev',
        schema: { fields: [] },
        knockoutRules: { rules: [] },
        isPublished: true
      });

      const getRes = await request(app)
        .get(`/api/v1/forms/${formA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(404);

      const updateRes = await request(app)
        .put(`/api/v1/forms/${formA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'Hacked Form Title' });

      expect(updateRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/forms/${formA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deleteRes.status).toBe(404);
    });
  });

  describe('Email & OAuth Route Isolation', () => {
    it('blocks Org B from deleting Org A email accounts or tampering with batch templates', async () => {
      const accountRepoA = getEmailAccountRepository(orgAId, userAId);
      const batchRepoA = getBatchRepository(orgAId);
      const templateRepoA = getEmailTemplateRepository(orgAId);

      const accountA = await accountRepoA.create({
        provider: 'gmail',
        address: 'alice@acme.com',
        encryptedRefreshToken: 'enc_token_a',
        scopes: ['gmail.send']
      });

      const batchA = await batchRepoA.create({
        name: 'Batch A Job',
        jobTitle: 'Backend Engineer',
        jdText: 'Looking for a senior backend engineer with Node.js and Postgres',
        ownerId: userAId
      });

      await templateRepoA.upsert({
        batchId: batchA.id,
        kind: EmailTemplateKind.shortlisted,
        subject: 'Shortlisted at Acme',
        body: 'Congratulations {{candidate_name}}'
      });

      const deleteAccountRes = await request(app)
        .delete(`/api/v1/email/accounts/${accountA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deleteAccountRes.status).toBe(404);

      const getTemplatesRes = await request(app)
        .get(`/api/v1/email/batches/${batchA.id}/templates`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getTemplatesRes.status).toBe(404);

      const finalizeRes = await request(app)
        .post(`/api/v1/email/batches/${batchA.id}/finalize`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ confirmation: 'SEND' });

      expect(finalizeRes.status).toBe(404);
    });
  });

  describe('Storage Tenant Isolation', () => {
    it('strictly forbids cross-tenant file signed URL requests', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      
      const { path } = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        orgAId,
        validPdfBuffer,
        'application/pdf'
      );

      await expect(
        storageService.createSignedUrl(STORAGE_BUCKETS.RESUMES, path, orgBId, 300)
      ).rejects.toThrow('Tenant boundary violation');
    });
  });

  describe('Candidate Check Isolation', () => {
    it('blocks User B from accessing or deleting User A resume checks', async () => {
      const checkA = await candidateCheckRepository.create({
        userId: userAId,
        jobTitle: 'Frontend Engineer',
        jdText: 'Looking for a React developer with at least 3 years experience.',
        resumeText: 'React developer with 4 years experience building web apps.',
        scoreBefore: 85,
        scoreAfter: 85,
        breakdown: {}
      });

      const getRes = await request(app)
        .get(`/api/v1/checks/${checkA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/checks/${checkA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deleteRes.status).toBe(404);
    });
  });

  describe('Health & Readiness Endpoints', () => {
    it('returns healthy status on /health and /ready probes', async () => {
      const healthRes = await request(app).get('/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('ok');
      expect(healthRes.body.service).toBe('api');

      const readyRes = await request(app).get('/ready');
      expect(readyRes.status).toBe(200);
      expect(readyRes.body.status).toBe('ready');
      expect(readyRes.body.components.database).toBe('up');
      expect(readyRes.body.components.storage).toBe('up');
    });
  });
});
