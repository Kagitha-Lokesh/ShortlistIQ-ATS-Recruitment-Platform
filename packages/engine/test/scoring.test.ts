import { describe, it, expect } from 'vitest';
import {
  extractBasics,
  segmentSections,
  extractSkills,
  scoreResume,
  scoreAgainstCriteria,
  calculateTfIdfMatch,
  calculateReadability
} from '../src/index.js';
import { resumes } from './fixtures/resumes.js';
import { jdSeniorFullStack, jdStaffDevOps, jdProductManager } from './fixtures/jds.js';

describe('Phase 3 Framework-Free Parsing & Scoring Engine', () => {
  describe('1. extractBasics (Contact & Identity Extraction)', () => {
    it('extracts name, email, phone, and links from well-formed resume', () => {
      const basics = extractBasics(resumes.seniorReactEngineer);
      expect(basics.name).toBe('Sarah Jenkins');
      expect(basics.email).toBe('sarah.jenkins@devmail.io');
      expect(basics.phone).toContain('555');
      expect(basics.links.linkedin).toContain('linkedin.com/in/sarahjenkins');
      expect(basics.links.github).toContain('github.com/sarahj-dev');
    });

    it('returns NO_EMAIL when no email is present in the resume', () => {
      const basics = extractBasics(resumes.resumeWithoutEmail);
      expect(basics.email).toBe('NO_EMAIL');
      expect(basics.name).toBe('David Miller');
      expect(basics.phone).toContain('555');
      expect(basics.links.github).toContain('github.com/dmiller-dev');
    });

    it('extracts international phone formats cleanly', () => {
      const basics = extractBasics(resumes.backendGoDeveloper);
      expect(basics.name).toBe('Tomasz Nowak');
      expect(basics.phone).toContain('+48');
    });
  });

  describe('2. segmentSections (Heading Synonym Recognition)', () => {
    it('segments standard sections across different heading synonyms', () => {
      const sections = segmentSections(resumes.seniorReactEngineer);
      expect(sections.summary).toContain('Senior Full Stack Engineer');
      expect(sections.skills).toContain('TypeScript');
      expect(sections.experience).toContain('Apex Solutions');
      expect(sections.education).toContain('University of Washington');
    });

    it('handles different section names like Executive Summary, Core Competencies', () => {
      const sections = segmentSections(resumes.productManager);
      expect(sections.summary).toContain('Data-driven Product Manager');
      expect(sections.skills).toContain('Roadmap Planning');
      expect(sections.experience).toContain('SaaSTech Global');
      expect(sections.education).toContain('Boston University');
    });
  });

  describe('3. extractSkills (~500 Skill Dictionary & JD Overlap)', () => {
    it('resolves aliases correctly (e.g. k8s -> Kubernetes, js -> JavaScript)', () => {
      const result = extractSkills(resumes.staffDevOpsEngineer);
      expect(result.matchedSkills).toContain('Kubernetes');
      expect(result.matchedSkills).toContain('AWS');
      expect(result.matchedSkills).toContain('Terraform');
      expect(result.matchedSkills).toContain('Docker');
      expect(result.matchedSkills).toContain('Prometheus');
      expect(result.matchedSkills).toContain('Grafana');
    });

    it('identifies overlap skills between resume and job description', () => {
      const result = extractSkills(resumes.seniorReactEngineer, jdSeniorFullStack);
      expect(result.jdOverlapSkills).toContain('React');
      expect(result.jdOverlapSkills).toContain('TypeScript');
      expect(result.jdOverlapSkills).toContain('Node.js');
      expect(result.jdOverlapSkills).toContain('PostgreSQL');
    });
  });

  describe('4. scoreResume (Deterministic Scoring & TF-IDF Breakdown)', () => {
    it('scores an ideal match high with comprehensive breakdown', () => {
      const result = scoreResume(resumes.seniorReactEngineer, jdSeniorFullStack);

      expect(result.overallScore).toBeGreaterThanOrEqual(75);
      expect(result.keywordScore).toBeGreaterThan(60);
      expect(result.skillsScore).toBeGreaterThanOrEqual(70);
      expect(result.experienceScore).toBe(100);
      expect(result.formattingScore).toBeGreaterThanOrEqual(70);
      expect(result.readabilityScore).toBeGreaterThan(60);
      expect(result.matchedKeywords).toContain('react');
      expect(result.matchedKeywords).toContain('typescript');
      expect(result.basics.email).toBe('sarah.jenkins@devmail.io');
    });

    it('scores an unqualified candidate low', () => {
      const result = scoreResume(resumes.minimalDesignerResume, jdStaffDevOps);
      expect(result.overallScore).toBeLessThan(45);
      expect(result.skillsScore).toBeLessThan(30);
    });

    it('is 100% stable and deterministic across multiple invocations', () => {
      const run1 = scoreResume(resumes.staffDevOpsEngineer, jdStaffDevOps);
      const run2 = scoreResume(resumes.staffDevOpsEngineer, jdStaffDevOps);
      expect(run1).toEqual(run2);
    });

    it('supports custom configurable weights', () => {
      // Heavily weigh experience over keywords
      const customWeights = {
        keywordWeight: 0.1,
        skillsWeight: 0.1,
        experienceWeight: 0.7,
        formattingWeight: 0.05,
        readabilityWeight: 0.05
      };

      const result = scoreResume(resumes.seniorReactEngineer, jdSeniorFullStack, {
        weights: customWeights
      });
      expect(result.overallScore).toBeGreaterThan(80);
    });
  });

  describe('5. scoreAgainstCriteria (Criteria Evaluation & Borderline Detection)', () => {
    const fullStackCriteria = {
      cutoff: 75,
      criteria: [
        {
          id: 'crit-react',
          label: 'React & TypeScript Mastery',
          type: 'must_have' as const,
          keywords: ['React', 'TypeScript']
        },
        {
          id: 'crit-node',
          label: 'Node.js Backend & SQL',
          type: 'must_have' as const,
          keywords: ['Node.js', 'PostgreSQL']
        },
        {
          id: 'crit-exp',
          label: '4+ Years Experience',
          type: 'must_have' as const,
          minYears: 4
        },
        {
          id: 'crit-docker',
          label: 'Docker & Containerization',
          type: 'nice_to_have' as const,
          keywords: ['Docker']
        }
      ]
    };

    it('shortlists strong candidate meeting all must-haves and exceeding cutoff', () => {
      const evalResult = scoreAgainstCriteria(
        resumes.seniorReactEngineer,
        jdSeniorFullStack,
        fullStackCriteria
      );

      expect(evalResult.decision).toBe('shortlisted');
      expect(evalResult.overallScore).toBeGreaterThanOrEqual(75);
      expect(evalResult.failedMustHavesCount).toBe(0);

      // Verify evidence snippet extraction
      const reactCrit = evalResult.criteriaResults.find((c) => c.criterionId === 'crit-react');
      expect(reactCrit?.passed).toBe(true);
      expect(reactCrit?.evidenceSnippet).toBeDefined();
    });

    it('flags borderline candidate for human review when exactly 1 must-have fails', () => {
      // Candidate missing TypeScript (only has JavaScript)
      const borderlineResume = `
        Alex Mercer
        alex@test.io | +1 555-0100

        Summary: Full stack developer with 5 years experience in React and Node.js.
        Skills: React, JavaScript, Node.js, PostgreSQL.
        Experience: 2019 to Present at InnoSoft.
      `;

      const evalResult = scoreAgainstCriteria(
        borderlineResume,
        jdSeniorFullStack,
        fullStackCriteria
      );

      // Failed crit-react (missing TypeScript), but passed crit-node and crit-exp
      expect(evalResult.decision).toBe('needs_review');
      expect(evalResult.failedMustHavesCount).toBe(1);
      expect(evalResult.decisionReason).toContain('Borderline: Exactly 1 must-have criterion was not satisfied');
    });

    it('flags candidate for human review when score is within 5 points of cutoff', () => {
      const borderlineCriteria = {
        cutoff: 82, // Candidate scores ~80-85, within 5 points
        criteria: [
          {
            id: 'c1',
            label: 'React',
            type: 'must_have' as const,
            keywords: ['React']
          }
        ]
      };

      const evalResult = scoreAgainstCriteria(
        resumes.seniorReactEngineer,
        jdSeniorFullStack,
        borderlineCriteria
      );

      expect(['shortlisted', 'needs_review']).toContain(evalResult.decision);
      if (Math.abs(evalResult.overallScore - 82) <= 5) {
        expect(evalResult.decision).toBe('needs_review');
      }
    });

    it('unshortlists immediately when a dealbreaker criterion fails', () => {
      const dealbreakerCriteria = {
        cutoff: 60,
        criteria: [
          {
            id: 'crit-dealbreaker',
            label: 'Must have active Top Secret Clearance',
            type: 'dealbreaker' as const,
            keywords: ['Top Secret Clearance']
          }
        ]
      };

      const evalResult = scoreAgainstCriteria(
        resumes.seniorReactEngineer,
        jdSeniorFullStack,
        dealbreakerCriteria
      );

      expect(evalResult.dealbreakerTriggered).toBe(true);
      expect(evalResult.decision).toBe('unshortlisted');
      expect(evalResult.decisionReason).toContain('Dealbreaker');
    });
  });

  describe('6. Performance Benchmark: 100 Resumes Process in Seconds', () => {
    it('processes 100 full resume scoring evaluations in under 3 seconds', () => {
      const allResumeTexts = Object.values(resumes);
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const text = allResumeTexts[i % allResumeTexts.length];
        const result = scoreResume(text, jdSeniorFullStack);
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
      }

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(3000); // Pure CPU execution under 3 seconds
    });
  });
});
