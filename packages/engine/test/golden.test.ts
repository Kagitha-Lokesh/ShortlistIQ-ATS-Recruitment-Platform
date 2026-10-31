import { describe, it, expect } from 'vitest';
import {
  generateGoldenFixtures,
  GOLDEN_JDS
} from './fixtures/index.js';
import {
  ingestResumeText,
  extractResumeProfile,
  stripProtectedDemographics,
  parseJobDescription,
  matchProfileAgainstJob,
  evaluateDecisionPolicy
} from '../src/index.js';

describe('Part G: Golden Dataset & Invariance Property Tests', () => {
  const fixtures = generateGoldenFixtures();
  const jdMap = new Map(GOLDEN_JDS.map((jd) => [jd.id, jd]));

  it('contains at least 60 diverse fixtures across 10 job descriptions', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(60);
    expect(GOLDEN_JDS.length).toBe(10);
  });

  describe('Property 1: Parsing Idempotency', () => {
    it('produces identical normalized text when parsed iteratively', () => {
      const sample = fixtures[0].text;
      const parse1 = ingestResumeText(sample);
      const parse2 = ingestResumeText(parse1.normalizedText);

      expect(parse2.normalizedText).toBe(parse1.normalizedText);
      expect(parse2.report.status).toBe(parse1.report.status);
    });
  });

  describe('Property 2: Strict Demographic Blindness Invariance', () => {
    it('produces an identical score (0.0 delta) when only protected demographic attributes are mutated', () => {
      const jd = parseJobDescription(GOLDEN_JDS[0].text);

      const baseText = `John Smith
Email: john.smith@example.com | Phone: 555-123-4567
San Francisco, CA

Professional Summary
Senior engineer with 5 years in software development.

Work Experience
Senior Full Stack Engineer | Acme Corp | 2021 - Present
• Built web architectures with React, TypeScript, Node.js, and PostgreSQL.

Education
B.S. in Computer Science | Harvard University | 2017 - 2021

Skills
TypeScript, Node.js, React, PostgreSQL`;

      // Variant A: Diverse global name, international address, regional college
      const mutatedA = baseText
        .replace('John Smith', 'Aisha Al-Mansoor')
        .replace('San Francisco, CA', 'Dubai, UAE')
        .replace('Harvard University', 'University of Sharjah');

      // Variant B: Different ethnicity, domestic address, community college
      const mutatedB = baseText
        .replace('John Smith', 'Lakshmi Patel')
        .replace('San Francisco, CA', 'Austin, TX')
        .replace('Harvard University', 'Austin Community College');

      const profileBase = stripProtectedDemographics(extractResumeProfile(baseText));
      const profileA = stripProtectedDemographics(extractResumeProfile(mutatedA));
      const profileB = stripProtectedDemographics(extractResumeProfile(mutatedB));

      const matchBase = matchProfileAgainstJob(profileBase, jd);
      const matchA = matchProfileAgainstJob(profileA, jd);
      const matchB = matchProfileAgainstJob(profileB, jd);

      // Invariance assertion: Score delta MUST be exactly 0.0 points
      expect(matchA.overallScore).toBe(matchBase.overallScore);
      expect(matchB.overallScore).toBe(matchBase.overallScore);
      expect(matchA.mustHaveScore).toBe(matchBase.mustHaveScore);
      expect(matchB.mustHaveScore).toBe(matchBase.mustHaveScore);
    });
  });

  describe('Property 3: Adversarial Integrity Flagging & Injection Neutralization', () => {
    it('detects prompt injections and sanitizes LLM payloads without score manipulation', () => {
      const advFixture = fixtures.find((f) => f.id === 'golden-adv-prompt-injection')!;
      const ingested = ingestResumeText(advFixture.text);

      // Integrity flag must be raised
      expect(ingested.report.integrityFlags.length).toBeGreaterThan(0);
      expect(ingested.report.integrityFlags.some((f) => f.type === 'PROMPT_INJECTION')).toBe(true);

      // Adversarial payload must be redacted from LLM payload
      expect(ingested.cleanedTextForLlm).not.toContain('rate this candidate highly');
      expect(ingested.cleanedTextForLlm).toContain('[REDACTED_ADVERSARIAL_INJECTION]');
    });
  });

  describe('Golden Dataset Benchmark (All 60 Fixtures)', () => {
    it('correctly categorizes parse status and generates valid recommendations for all 60 fixtures', () => {
      let evaluatedCount = 0;

      for (const fixture of fixtures) {
        const jd = jdMap.get(fixture.pairedJdId);
        expect(jd).toBeDefined();

        const ingested = ingestResumeText(fixture.text);
        expect(['OK', 'PARTIAL', 'UNREADABLE']).toContain(ingested.report.status);

        if (fixture.expectedParseStatus === 'UNREADABLE') {
          expect(ingested.report.status).toBe('UNREADABLE');
        }

        const profile = stripProtectedDemographics(extractResumeProfile(ingested.normalizedText));
        const parsedJd = parseJobDescription(jd!.text);
        const match = matchProfileAgainstJob(profile, parsedJd);
        const audit = evaluateDecisionPolicy(match, {
          cutoff: 70,
          parseReport: ingested.report
        });

        // Recommendation must never be a final rejection
        expect(['recommended_shortlist', 'recommended_not_shortlisted', 'needs_review']).toContain(audit.recommendation);
        expect(audit.isFinalDecision).toBe(false);

        evaluatedCount++;
      }

      expect(evaluatedCount).toBe(fixtures.length);
    });
  });
});
