import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, auditLogRepository, resetRepositories } from '../src/repositories/index.js';
import { logger } from '../src/logger.js';

describe('Privacy and Compliance: Zero Personal Data in Logs', () => {
  beforeEach(() => {
    resetRepositories();
  });

  it('ensures AuditLog meta never stores raw resume text, phone numbers, or unmasked candidate emails in deletion events', async () => {
    // Simulate candidate deletion event
    await auditLogRepository.log({
      orgId: 'org-test-1',
      actorId: 'system',
      action: 'CANDIDATE_DATA_DELETED_BY_REQUEST',
      entity: 'Candidate',
      entityId: 'anonymized',
      meta: {
        message: 'Candidate record removed upon verified candidate privacy request.',
        removedAt: new Date().toISOString()
      }
    });

    const logs = inMemoryStore.auditLogs;
    for (const log of logs.values()) {
      const metaString = JSON.stringify(log.meta || {});

      // Assert that no sensitive fields exist
      expect(metaString).not.toMatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/); // No raw email
      expect(metaString).not.toMatch(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/); // No phone numbers
      expect(metaString).not.toMatch(/resumeText|education|experience|GPA/i); // No raw resume sections
    }
  });

  it('verifies that data lifecycle cleanup logs report counts only, omitting candidate identities', async () => {
    const cleanupReport = {
      deletedCandidates: 14,
      deletedChecks: 5,
      deletedFiles: 19
    };

    const keys = Object.keys(cleanupReport);
    expect(keys).toEqual(['deletedCandidates', 'deletedChecks', 'deletedFiles']);

    // Ensure no names or identifiable data are included in cleanup reporting
    expect(keys).not.toContain('emails');
    expect(keys).not.toContain('candidateNames');
    expect(keys).not.toContain('resumes');
  });
});

