import { describe, it, expect } from 'vitest';
import {
  parseJobDescription,
  validateIsJobDescription,
  validateJobDescriptionQuality
} from '../src/index.js';

describe('Part C: Job Description Analysis & Quality Gate', () => {
  describe('Structured Job Description Parsing', () => {
    const sampleJd = `Senior Full Stack Engineer
We are seeking an experienced Senior Full Stack Engineer with 5+ years of software development experience.

Requirements:
- Must have strong experience with TypeScript and Node.js.
- Proficiency in React or Angular for frontend development.
- Bachelor's degree in Computer Science or equivalent practical experience.

Preferred Qualifications:
- Experience with Docker and Kubernetes is a plus.
- Knowledge of GraphQL is an advantage.`;

    it('parses title, seniority, overall years, and distinguishes must-have vs nice-to-have', () => {
      const requirements = parseJobDescription(sampleJd);

      expect(requirements.isValidJobDescription).toBe(true);
      expect(requirements.seniority).toBe('senior');
      expect(requirements.minTotalYearsExperience).toBe(5);

      // Must have skills
      const tsSkill = requirements.mustHaveSkills.find((s) => s.canonical === 'TypeScript');
      expect(tsSkill).toBeDefined();
      expect(tsSkill?.strength).toBe('must_have');

      // Nice to have skills
      const dockerSkill = requirements.niceToHaveSkills.find((s) => s.canonical === 'Docker');
      expect(dockerSkill).toBeDefined();
      expect(dockerSkill?.strength).toBe('nice_to_have');

      // Education & equivalent experience allowed
      expect(requirements.education?.level).toBe('bachelor');
      expect(requirements.education?.allowEquivalentExperience).toBe(true);
    });

    it('identifies "OR" alternatives as single unified requirements satisfied by either skill', () => {
      const requirements = parseJobDescription(sampleJd);

      // "React or Angular"
      const orSkill = requirements.mustHaveSkills.find((s) => s.alternatives.length > 0);
      expect(orSkill).toBeDefined();
      expect(['React', 'Angular']).toContain(orSkill?.canonical);
      expect(orSkill?.alternatives.length).toBe(1);
    });
  });

  describe('Non-JD Text Gate (Candidate-side Checker Protection)', () => {
    it('flags excessively short text as not a valid job description', () => {
      const shortText = 'Need dev.';
      const result = validateIsJobDescription(shortText);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('flags pasted code snippets as not a valid job description', () => {
      const codeText = `import React from 'react';
export function App() {
  const [count, setCount] = React.useState(0);
  return <div>{count}</div>;
}
function calculateSum(a: number, b: number): number {
  return a + b;
}`;
      const result = validateIsJobDescription(codeText);
      expect(result.isValid).toBe(false);
    });
  });

  describe('JD Quality & Discriminatory Language Detection', () => {
    it('flags unrealistic tech experience (e.g. 10 years of FastAPI)', () => {
      const unrealisticJd = `Senior Backend Developer
We are looking for a Senior Backend Developer to join our core engineering team.
Requirements:
- 10+ years of experience in FastAPI and microservices.
- Strong knowledge of PostgreSQL and Docker.
- Experience building scalable cloud services.`;

      const requirements = parseJobDescription(unrealisticJd);
      const issue = requirements.qualityIssues.find((i) => i.type === 'UNREALISTIC_EXPERIENCE');
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('FastAPI was released in 2018');
    });

    it('flags potentially discriminatory and exclusionary phrases to HR before screening', () => {
      const biasedJd = `Looking for a young and energetic digital native for our fast-paced startup. Must be a native English speaker with rockstar energy.`;
      const requirements = parseJobDescription(biasedJd);

      const biasedIssues = requirements.qualityIssues.filter((i) => i.type === 'DISCRIMINATORY_LANGUAGE');
      expect(biasedIssues.length).toBeGreaterThanOrEqual(2);
    });
  });
});
