import { describe, it, expect, beforeEach } from 'vitest';
import { runSeed } from '../prisma/seed.js';
import {
  getBatchRepository,
  getCandidateRepository,
  getFormRepository,
  getEmailAccountRepository,
  candidateCheckRepository
} from '../src/repositories/index.js';

describe('Phase 2 Tenancy Isolation & Security Rules', () => {
  let seedData: Awaited<ReturnType<typeof runSeed>>;

  beforeEach(async () => {
    seedData = await runSeed();
  });

  describe('Batch Isolation between Organizations', () => {
    it('proves Org A cannot read Org B batches via findById', async () => {
      const batchRepoA = getBatchRepository(seedData.orgA.id);
      const crossOrgBatch = await batchRepoA.findById(seedData.batchB.id);

      expect(crossOrgBatch).toBeNull();
    });

    it('proves Org A cannot see Org B batches in findMany listings', async () => {
      const batchRepoA = getBatchRepository(seedData.orgA.id);
      const batchesA = await batchRepoA.findMany();

      expect(batchesA.length).toBeGreaterThan(0);
      const hasBatchB = batchesA.some((b) => b.id === seedData.batchB.id);
      expect(hasBatchB).toBe(false);
    });

    it('proves Org A cannot modify Org B batches', async () => {
      const batchRepoA = getBatchRepository(seedData.orgA.id);

      await expect(
        batchRepoA.update(seedData.batchB.id, { name: 'Hacked Batch Name' })
      ).rejects.toThrow('Batch not found in this organization');
    });

    it('proves Org A cannot delete Org B batches', async () => {
      const batchRepoA = getBatchRepository(seedData.orgA.id);

      await expect(batchRepoA.delete(seedData.batchB.id)).rejects.toThrow(
        'Batch not found in this organization'
      );
    });
  });

  describe('Candidate Isolation between Organizations', () => {
    it('proves Org A cannot read Org B candidate details via findById', async () => {
      const candidateRepoA = getCandidateRepository(seedData.orgA.id);
      const crossOrgCandidate = await candidateRepoA.findById(seedData.candidateB.id);

      expect(crossOrgCandidate).toBeNull();
    });

    it('proves Org A cannot query candidate lists of Org B batches', async () => {
      const candidateRepoA = getCandidateRepository(seedData.orgA.id);

      await expect(
        candidateRepoA.findManyByBatch(seedData.batchB.id)
      ).rejects.toThrow('Batch does not belong to this organization');
    });

    it('proves Org A cannot insert candidates into Org B batches', async () => {
      const candidateRepoA = getCandidateRepository(seedData.orgA.id);

      await expect(
        candidateRepoA.create({
          batchId: seedData.batchB.id,
          fullName: 'Malicious Candidate',
          email: 'infiltrator@test.com'
        })
      ).rejects.toThrow('Batch does not belong to this organization');
    });

    it('proves Org A cannot modify Org B candidate status or scores', async () => {
      const candidateRepoA = getCandidateRepository(seedData.orgA.id);

      await expect(
        candidateRepoA.update(seedData.candidateB.id, { score: 100 })
      ).rejects.toThrow('Batch does not belong to this organization');
    });
  });

  describe('Form Isolation between Organizations', () => {
    it('proves Org A cannot read Org B forms by batch', async () => {
      const formRepoA = getFormRepository(seedData.orgA.id);
      const forms = await formRepoA.findByBatch(seedData.batchB.id);

      expect(forms).toHaveLength(0);
    });

    it('proves Org A cannot create forms pointing to Org B batches', async () => {
      const formRepoA = getFormRepository(seedData.orgA.id);

      await expect(
        formRepoA.create({
          batchId: seedData.batchB.id,
          slug: 'illegal-form',
          title: 'Illegal Form',
          schema: {}
        })
      ).rejects.toThrow('Batch does not belong to this organization');
    });
  });

  describe('Email Account Isolation between Organizations', () => {
    it('proves Org A cannot access or list Org B connected email accounts', async () => {
      // Trying to query Org B email account using Org A context
      await expect(async () => {
        const repo = getEmailAccountRepository(seedData.orgA.id, seedData.hrB.id);
        await repo.findMany();
      }).rejects.toThrow('User does not belong to this organization');
    });
  });

  describe('Candidate Pre-Screening Guest Check Isolation', () => {
    it('proves a guest cannot read another guest check with their own anonToken', async () => {
      // Guest 1 trying to read Check 2 with token 1
      const crossRead = await candidateCheckRepository.findByIdAndToken(
        seedData.check2.id,
        seedData.check1.anonToken!
      );
      expect(crossRead).toBeNull();
    });

    it('proves a guest cannot read another guest check without a token', async () => {
      const emptyTokenRead = await candidateCheckRepository.findByIdAndToken(
        seedData.check2.id,
        ''
      );
      expect(emptyTokenRead).toBeNull();
    });

    it('allows a guest to read only their own check when presenting valid token', async () => {
      const validRead = await candidateCheckRepository.findByIdAndToken(
        seedData.check1.id,
        seedData.check1.anonToken!
      );
      expect(validRead).not.toBeNull();
      expect(validRead?.id).toBe(seedData.check1.id);
      expect(validRead?.jobTitle).toBe('Frontend Lead');
    });
  });
});

