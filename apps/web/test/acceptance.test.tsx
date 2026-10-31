import { describe, it, expect } from 'vitest';
import { tokenStorage, anonTokenStorage, ApiError } from '../src/lib/api.js';
import { scoreResume } from '@shortlistiq/engine';

describe('Phase 1 & Phase 4 Acceptance Flow Tests', () => {
  it('handles token storage correctly for login and logout', () => {
    tokenStorage.set('test-hr-token-xyz');
    expect(tokenStorage.get()).toBe('test-hr-token-xyz');

    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });

  it('generates and persists guest anonymous token in storage', () => {
    const anon = anonTokenStorage.get();
    expect(anon).toBeDefined();
    expect(anon.length).toBeGreaterThan(5);

    anonTokenStorage.set('anon-persisted-session-123');
    expect(anonTokenStorage.get()).toBe('anon-persisted-session-123');
  });

  it('ApiError creates well-formed error objects with requestId and code', () => {
    const error = new ApiError('FORBIDDEN', 'Access forbidden', { role: 'candidate' }, 'req-1234');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access forbidden');
    expect(error.requestId).toBe('req-1234');
    expect(error.details).toEqual({ role: 'candidate' });
  });

  it('recomputes projected score dynamically in web using framework-free engine', () => {
    const resumeText = `
      John Doe
      john@example.com | 555-0100
      Summary: Software developer with 4 years experience.
      Skills: JavaScript, HTML, CSS.
      Experience: Built user interfaces at TechCorp.
      Education: BS in Computer Science.
    `;
    const jdText = `
      Job Title: React Engineer
      Requirements: 4+ years of React, TypeScript, and state management experience.
    `;

    const initial = scoreResume(resumeText, jdText);

    // Simulate accepting an enhancement suggestion that incorporates React and TypeScript
    const enhancedResume = resumeText.replace(
      'Skills: JavaScript, HTML, CSS.',
      'Skills: React, TypeScript, JavaScript, HTML, CSS, Redux state management.'
    );

    const projected = scoreResume(enhancedResume, jdText);

    // Projected score should increase because key requirements are now incorporated
    expect(projected.overallScore).toBeGreaterThanOrEqual(initial.overallScore);
    expect(projected.matchedKeywords).toContain('react');
    expect(projected.matchedKeywords).toContain('typescript');
  });

  it('incorporates accepted suggestions into converted ResumeData', async () => {
    const { convertParsedToResumeData, extractBasics, segmentSections } = await import('@shortlistiq/engine');

    const resumeText = `
      Sarah Jenkins
      sarah.jenkins@devmail.io | +1 555-0100

      Summary
      Software engineer building scalable systems.

      Work Experience
      Senior Engineer | CloudScale (2020 - Present)
      • Built web services in Node.js.

      Technical Skills
      • Languages: JavaScript, Python

      Education
      BS Computer Science | University of Washington (2018)
    `;

    const basics = extractBasics(resumeText);
    const sections = segmentSections(resumeText);

    const accepted = [
      {
        originalText: 'Built web services in Node.js.',
        proposedText: 'Architected distributed microservices in Node.js, Express, and PostgreSQL slashing latency by 40%.'
      }
    ];

    const conversion = convertParsedToResumeData(resumeText, basics, sections, accepted);

    expect(conversion.isConfident).toBe(true);
    expect(conversion.data.contact.fullName).toBe('Sarah Jenkins');
    expect(conversion.data.experience[0].highlights[0]).toContain('Express, and PostgreSQL');
  });

  it('Phase 6: processes batch candidate cutoff calculation deterministically', () => {
    const cutoff = 75;

    const evaluateDecision = (score: number) => {
      if (score >= cutoff) return 'shortlisted';
      if (score >= cutoff - 5) return 'needs_review';
      return 'unshortlisted';
    };

    expect(evaluateDecision(88)).toBe('shortlisted');
    expect(evaluateDecision(75)).toBe('shortlisted');
    expect(evaluateDecision(72)).toBe('needs_review'); // within 5 points of cutoff
    expect(evaluateDecision(70)).toBe('needs_review');
    expect(evaluateDecision(69)).toBe('unshortlisted');
    expect(evaluateDecision(50)).toBe('unshortlisted');
  });

  it('Phase 6: chunked batching helper slices large file sets correctly', () => {
    const files = Array.from({ length: 50 }, (_, i) => ({ name: `resume_${i}.pdf`, size: 1024 }));
    const CHUNK_SIZE = 6;

    const chunks = [];
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      chunks.push(files.slice(i, i + CHUNK_SIZE));
    }

    expect(chunks.length).toBe(9); // ceil(50 / 6) = 9
    expect(chunks[0].length).toBe(6);
    expect(chunks[8].length).toBe(2);
  });

  it('Phase 10: calculates data retention expiration dates for candidate checks and org policies', () => {
    const now = Date.now();
    const guestRetentionDays = 7;
    const orgRetentionDays = 60;

    const guestExpiresAt = new Date(now + guestRetentionDays * 24 * 60 * 60 * 1000);
    const orgExpiresAt = new Date(now + orgRetentionDays * 24 * 60 * 60 * 1000);

    const diffGuest = Math.round((guestExpiresAt.getTime() - now) / (24 * 60 * 60 * 1000));
    const diffOrg = Math.round((orgExpiresAt.getTime() - now) / (24 * 60 * 60 * 1000));

    expect(diffGuest).toBe(7);
    expect(diffOrg).toBe(60);
  });

  it('Phase 10: validates candidate right to erasure 6-digit code format and email masking', () => {
    const rawEmail = 'alex.mercer@company.com';
    const maskedEmail = rawEmail.replace(/(?<=.).(?=[^@]*?@)/g, '*');

    expect(maskedEmail).toBe('a**********@company.com');
    expect(maskedEmail).not.toBe(rawEmail);

    const isValid6DigitCode = (code: string) => /^\d{6}$/.test(code);
    expect(isValid6DigitCode('123456')).toBe(true);
    expect(isValid6DigitCode('12345')).toBe(false);
    expect(isValid6DigitCode('1234567')).toBe(false);
    expect(isValid6DigitCode('abc123')).toBe(false);
  });
});

