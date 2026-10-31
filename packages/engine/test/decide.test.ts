import { describe, it, expect } from 'vitest';
import {
  evaluateDecisionPolicy,
  MatchBreakdown,
  ParseQualityReport
} from '../src/index.js';

describe('Part E: Decision Policy & High-Stakes Audit Gate', () => {
  const baseMatch: MatchBreakdown = {
    overallScore: 85,
    mustHaveScore: 90,
    niceToHaveScore: 80,
    experienceScore: 100,
    educationScore: 100,
    results: [
      {
        requirementId: 'req-ts',
        type: 'must_have_skill',
        label: 'TypeScript',
        status: 'PASS',
        score: 100,
        weight: 10,
        evidenceStrength: 'outcome_backed',
        resumeSnippet: 'TypeScript microservices',
        resumePage: 1,
        jdClause: 'TypeScript',
        explanation: 'Satisfied'
      }
    ],
    passedMustHavesCount: 1,
    totalMustHavesCount: 1,
    failedMustHavesCount: 0,
    isAllMustHavesSatisfied: true,
    relatedSuggestions: []
  };

  it('recommends shortlist when all mandatory requirements are satisfied and score >= cutoff', () => {
    const audit = evaluateDecisionPolicy(baseMatch, { cutoff: 70 });
    expect(audit.recommendation).toBe('recommended_shortlist');
    expect(audit.trigger).toBe('ALL_REQUIREMENTS_MET');
    expect(audit.isFinalDecision).toBe(false); // Retained for HR final confirmation
  });

  it('routes to needs_review when parse status is PARTIAL or UNREADABLE to protect candidate from engine flaws', () => {
    const partialReport: Partial<ParseQualityReport> = {
      status: 'PARTIAL',
      reasons: ['No standard section headings detected']
    };

    const audit = evaluateDecisionPolicy(baseMatch, {
      cutoff: 70,
      parseReport: partialReport as ParseQualityReport
    });

    expect(audit.recommendation).toBe('needs_review');
    expect(audit.trigger).toBe('PARSE_PARTIAL_OR_UNREADABLE');
    expect(audit.triggerReason).toContain('PARTIAL');
  });

  it('flags knockout question failures and routes to needs_review instead of auto-rejecting', () => {
    const audit = evaluateDecisionPolicy(baseMatch, {
      cutoff: 70,
      knockoutDetails: {
        fieldId: 'relocation',
        question: 'Are you willing to relocate to Austin, TX?',
        answer: false,
        reason: 'Candidate answered No to mandatory relocation'
      }
    });

    expect(audit.recommendation).toBe('needs_review');
    expect(audit.trigger).toBe('KNOCKOUT_FLAG');
    expect(audit.knockoutDetails?.answer).toBe(false);
  });

  it('routes borderline scores (within 5 points of cutoff) to needs_review', () => {
    const borderlineMatch: MatchBreakdown = {
      ...baseMatch,
      overallScore: 68 // Cutoff is 70; 68 is within 5 points
    };

    const audit = evaluateDecisionPolicy(borderlineMatch, { cutoff: 70 });
    expect(audit.recommendation).toBe('needs_review');
    expect(audit.trigger).toBe('BORDERLINE_SCORE');
  });

  it('routes candidates with missing must-haves to needs_review if verified related skills exist', () => {
    const missingWithRelated: MatchBreakdown = {
      ...baseMatch,
      overallScore: 60,
      isAllMustHavesSatisfied: false,
      failedMustHavesCount: 1,
      results: [
        {
          requirementId: 'req-react',
          type: 'must_have_skill',
          label: 'React',
          status: 'FAIL',
          score: 0,
          weight: 10,
          evidenceStrength: 'none',
          resumeSnippet: null,
          resumePage: null,
          jdClause: 'React',
          explanation: 'Missing React',
          isRelatedSemanticOnly: true
        }
      ],
      relatedSuggestions: [
        {
          jdSkill: 'React',
          relatedResumeSkill: 'Vue.js',
          explanation: 'Candidate has 3 years of verified Vue.js experience'
        }
      ]
    };

    const audit = evaluateDecisionPolicy(missingWithRelated, { cutoff: 70 });
    expect(audit.recommendation).toBe('needs_review');
    expect(audit.trigger).toBe('MUST_HAVE_PARTIAL_OR_RELATED');
  });

  it('routes candidates to needs_review when total experience is within 6 months of requirement', () => {
    const audit = evaluateDecisionPolicy(baseMatch, {
      cutoff: 70,
      experienceDeficitMonths: 4 // Deficit of 4 months
    });

    expect(audit.recommendation).toBe('needs_review');
    expect(audit.trigger).toBe('EXPERIENCE_CLOSE_THRESHOLD');
  });
});

