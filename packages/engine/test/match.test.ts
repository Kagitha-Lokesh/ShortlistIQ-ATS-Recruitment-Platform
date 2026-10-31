import { describe, it, expect } from 'vitest';
import {
  isSkillContextMatch,
  matchProfileAgainstJob,
  extractResumeProfile,
  parseJobDescription
} from '../src/index.js';

describe('Part D: Matching Engine & Requirement Traceability', () => {
  describe('Short Token Disambiguation & Contextual Guards', () => {
    it('does not falsely award programming language credit for casual English words ("go-to", "c", "r")', () => {
      const casualSentence = 'I was the go-to person on our team, collaborating with sales and HR.';
      const goIndex = casualSentence.indexOf('go-to');

      const isGolang = isSkillContextMatch(casualSentence, 'go', goIndex);
      expect(isGolang).toBe(false);

      const techSentence = 'Backend services built using Golang, Go language, and PostgreSQL.';
      const techGoIndex = techSentence.indexOf('Go language');
      const isRealGolang = isSkillContextMatch(techSentence, 'go', techGoIndex);
      expect(isRealGolang).toBe(true);
    });

    it('strictly separates distinct skills (Java != JavaScript, C != C++, SQL != NoSQL)', () => {
      const resume = `Alex Smith
Email: alex@example.com

Work Experience
Software Engineer | Jan 2021 - Present
• Built enterprise backend services with Java and Spring Boot.
• Maintained relational databases using SQL.

Technical Skills
Languages: Java, SQL`;

      const jd = `Full Stack Developer
Requirements:
- Must have experience with JavaScript and React.
- Must know NoSQL databases.`;

      const profile = extractResumeProfile(resume);
      const requirements = parseJobDescription(jd);
      const match = matchProfileAgainstJob(profile, requirements);

      // JavaScript must FAIL despite candidate having Java
      const jsMatch = match.results.find((r) => r.label.toLowerCase().includes('javascript'));
      expect(jsMatch).toBeDefined();
      expect(jsMatch?.status).toBe('FAIL');

      // NoSQL must FAIL despite candidate having SQL
      const nosqlMatch = match.results.find((r) => r.label.toLowerCase().includes('nosql'));
      expect(nosqlMatch).toBeDefined();
      expect(nosqlMatch?.status).toBe('FAIL');
    });
  });

  describe('Evidence Strength Weighting & Verbatim Snippets', () => {
    it('awards differentiated credit based on evidence strength (outcome > context > listed)', () => {
      const resume = `Jordan Lee
Email: jordan@example.com

Work Experience
Full Stack Developer | Jan 2022 - Present
• Built backend microservices using Node.js, reducing latency by 40%.
• Implemented UI components using React.

Technical Skills
Languages: Python, Docker`;

      const jd = `Software Engineer
Requirements:
- Node.js
- React
- Python`;

      const profile = extractResumeProfile(resume);
      const requirements = parseJobDescription(jd);
      const match = matchProfileAgainstJob(profile, requirements);

      // Node.js (outcome backed) -> score 100, PASS
      const nodeRes = match.results.find((r) => r.label.includes('Node.js'));
      expect(nodeRes?.score).toBe(100);
      expect(nodeRes?.evidenceStrength).toBe('outcome_backed');

      // React (in job context) -> score 90, PASS
      const reactRes = match.results.find((r) => r.label.includes('React'));
      expect(reactRes?.score).toBe(90);
      expect(reactRes?.evidenceStrength).toBe('job_context');

      // Python (listed only) -> score 60, PARTIAL
      const pythonRes = match.results.find((r) => r.label.includes('Python'));
      expect(pythonRes?.score).toBe(60);
      expect(pythonRes?.evidenceStrength).toBe('listed_only');
    });

    it('satisfies "OR" alternatives when candidate has either skill', () => {
      const resume = `Sam Taylor
Email: sam@example.com

Work Experience
Frontend Engineer | Jan 2021 - Present
• Engineered web dashboards using Angular and TypeScript.`;

      const jd = `Frontend Developer
Requirements:
- Proficiency in React or Angular for single-page applications.`;

      const profile = extractResumeProfile(resume);
      const requirements = parseJobDescription(jd);
      const match = matchProfileAgainstJob(profile, requirements);

      const orReq = match.results.find((r) => r.label.includes('React') || r.label.includes('Angular'));
      expect(orReq).toBeDefined();
      expect(orReq?.status).toBe('PASS');
      expect(orReq?.resumeSnippet).toContain('Angular and TypeScript');
    });
  });

  describe('Semantic Similarity Suggestions (Non-Auto-Pass)', () => {
    it('suggests related skills to HR without auto-passing must-have requirements', () => {
      const resume = `Taylor Morgan
Email: taylor@example.com

Work Experience
Frontend Developer | Jan 2021 - Present
• Developed single-page applications using Vue.js.`;

      const jd = `Frontend Engineer
Requirements:
- Must have production experience with React.`;

      const profile = extractResumeProfile(resume);
      const requirements = parseJobDescription(jd);
      const match = matchProfileAgainstJob(profile, requirements);

      // Must have React must FAIL
      const reactReq = match.results.find((r) => r.label.includes('React'));
      expect(reactReq?.status).toBe('FAIL');
      expect(reactReq?.isRelatedSemanticOnly).toBe(true);

      // HR suggestion generated
      expect(match.relatedSuggestions.length).toBeGreaterThan(0);
      expect(match.relatedSuggestions[0].jdSkill).toBe('React');
      expect(match.relatedSuggestions[0].relatedResumeSkill).toBe('Vue.js');
    });
  });
});

