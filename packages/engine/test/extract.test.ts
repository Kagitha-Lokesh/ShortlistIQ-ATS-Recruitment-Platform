import { describe, it, expect } from 'vitest';
import {
  parseDateRange,
  parseSingleDate,
  mergeOverlappingDateRanges,
  extractContactInfo,
  extractResumeProfile,
  stripProtectedDemographics,
  verifyLlmAssistedProfile
} from '../src/index.js';

describe('Part B: Structured Resume Extraction & Profile', () => {
  describe('Flexible Date Parsing & Interval Union', () => {
    it('parses diverse date expressions (months, numeric, quarters, seasons, year-only)', () => {
      const d1 = parseSingleDate('Jan 2021');
      expect(d1?.getUTCFullYear()).toBe(2021);
      expect(d1?.getUTCMonth()).toBe(0);

      const d2 = parseSingleDate('06/2020');
      expect(d2?.getUTCFullYear()).toBe(2020);
      expect(d2?.getUTCMonth()).toBe(5);

      const d3 = parseSingleDate('Q3 2019');
      expect(d3?.getUTCFullYear()).toBe(2019);
      expect(d3?.getUTCMonth()).toBe(6); // July

      const d4 = parseSingleDate('Summer 2018');
      expect(d4?.getUTCFullYear()).toBe(2018);
      expect(d4?.getUTCMonth()).toBe(5); // June

      const d5 = parseSingleDate('2022');
      expect(d5?.getUTCFullYear()).toBe(2022);
    });

    it('merges overlapping concurrent roles without double counting months', () => {
      // Role 1: Jan 2022 to Dec 2022 (12 months)
      // Role 2 (Concurrent): Jun 2022 to Jun 2023 (13 months)
      // Disjoint sum would be 25 months; merged interval Jan 2022 to Jun 2023 is exactly 18 months!
      const r1 = parseDateRange('Jan 2022 - Dec 2022')!;
      const r2 = parseDateRange('Jun 2022 - Jun 2023')!;

      const { mergedRanges, totalMonths } = mergeOverlappingDateRanges([
        { startDate: r1.startDate, endDate: r1.endDate },
        { startDate: r2.startDate, endDate: r2.endDate }
      ]);

      expect(mergedRanges.length).toBe(1);
      expect(totalMonths).toBe(18); // NOT 25!
    });

    it('treats gaps neutrally between disjoint intervals', () => {
      // Role 1: Jan 2020 to Dec 2020 (12 months)
      // Gap: Jan 2021 to Dec 2021 (12 months gap)
      // Role 2: Jan 2022 to Dec 2022 (12 months)
      const r1 = parseDateRange('Jan 2020 - Dec 2020')!;
      const r2 = parseDateRange('Jan 2022 - Dec 2022')!;

      const { mergedRanges, totalMonths } = mergeOverlappingDateRanges([
        { startDate: r1.startDate, endDate: r1.endDate },
        { startDate: r2.startDate, endDate: r2.endDate }
      ]);

      expect(mergedRanges.length).toBe(2);
      expect(totalMonths).toBe(24); // Exactly 12 + 12 without gap penalty
    });
  });

  describe('Contact Validation & Typo Detection', () => {
    it('detects common typos in email domains and offers a non-blocking warning', () => {
      const text = 'Contact: test.candidate@gmial.com | Phone: (555) 234-5678';
      const contact = extractContactInfo(text);

      expect(contact.emails.length).toBe(1);
      expect(contact.emails[0].email).toBe('test.candidate@gmial.com');
      expect(contact.emails[0].typoWarning).toContain("Did you mean 'gmail.com'?");
    });
  });

  describe('ResumeProfile Extraction & Evidence Strength', () => {
    const sampleResume = `Johnathan Doe
Email: john@example.com | Phone: 555-123-4567
Austin, TX

Professional Summary
Senior engineer with 5 years building scalable distributed backends.

Work Experience
Senior Software Engineer | Apex Cloud | Jan 2022 - Present
• Engineered microservices using Node.js and TypeScript, reducing API latency by 35%.
• Deployed services using Docker and Kubernetes to AWS.

Junior Developer | Startup Labs | Jan 2020 - Dec 2021
• Maintained legacy React web components and REST APIs.

Education
B.S. in Computer Science | Texas Tech University | 2016 - 2020
CGPA: 3.8

Technical Skills
Languages: Python, Go, SQL
Frameworks: Express.js, Tailwind CSS`;

    it('extracts typed fields with verbatim evidence and accurate skill strength', () => {
      const profile = extractResumeProfile(sampleResume);

      // Experience extraction
      expect(profile.experience.length).toBe(2);
      expect(profile.totalExperienceYears).toBeGreaterThan(4.0);

      // Skill evidence strength differentiation
      // Node.js was used in a bullet with outcome ("reducing API latency by 35%")
      const nodeSkill = profile.skills.find((s) => s.canonicalSkill === 'Node.js');
      expect(nodeSkill).toBeDefined();
      expect(nodeSkill?.evidenceStrength).toBe('used_with_outcome');
      expect(nodeSkill?.evidence.snippet).toContain('reducing API latency by 35%');

      // React was used in a job bullet without quantifiable metric
      const reactSkill = profile.skills.find((s) => s.canonicalSkill === 'React');
      expect(reactSkill).toBeDefined();
      expect(reactSkill?.evidenceStrength).toBe('used_in_job');

      // Python was only listed in the Technical Skills section
      const pythonSkill = profile.skills.find((s) => s.canonicalSkill === 'Python');
      expect(pythonSkill).toBeDefined();
      expect(pythonSkill?.evidenceStrength).toBe('listed_only');

      // Education degree normalization
      expect(profile.education.length).toBe(1);
      expect(profile.education[0].normalizedDegreeLevel).toBe('bachelor');
      expect(profile.education[0].grade).toBe('3.8');
    });

    it('strips protected demographic attributes for blind review/scoring', () => {
      const profile = extractResumeProfile(sampleResume);
      const blindProfile = stripProtectedDemographics(profile);

      expect(blindProfile.demographicsStripped).toBe(true);
      expect(blindProfile.contact.primaryPhone).toBeNull();
      expect(blindProfile.contact.location.value).toBeNull();
      expect(blindProfile.education[0].institution.value).toBe('[REDACTED_INSTITUTION]');
      // Degree level preserved
      expect(blindProfile.education[0].normalizedDegreeLevel).toBe('bachelor');
    });
  });

  describe('LLM Second Opinion Verification', () => {
    it('accepts LLM output when evidence snippet is verbatim in source resume', () => {
      const resumeText = 'Engineered microservices using Node.js and TypeScript, reducing API latency by 35%.';
      const validLlmProfile = {
        skills: [
          {
            rawTerm: 'Node.js',
            canonicalSkill: 'Node.js',
            source: 'experience' as const,
            evidenceStrength: 'used_with_outcome' as const,
            monthsExperience: 24,
            evidence: {
              page: 1,
              snippet: 'Engineered microservices using Node.js and TypeScript, reducing API latency by 35%.'
            }
          }
        ]
      };

      const verification = verifyLlmAssistedProfile(validLlmProfile, resumeText);
      expect(verification.isValid).toBe(true);
      expect(verification.unverifiedSnippets.length).toBe(0);
    });

    it('rejects LLM output when quoted evidence does not exist verbatim in resume', () => {
      const resumeText = 'Engineered microservices using Node.js and TypeScript.';
      const hallucinatedLlmProfile = {
        skills: [
          {
            rawTerm: 'Node.js',
            canonicalSkill: 'Node.js',
            source: 'experience' as const,
            evidenceStrength: 'used_with_outcome' as const,
            monthsExperience: 24,
            evidence: {
              page: 1,
              snippet: 'Increased company revenue by $10M using Node.js architecture' // Hallucinated!
            }
          }
        ]
      };

      const verification = verifyLlmAssistedProfile(hallucinatedLlmProfile, resumeText);
      expect(verification.isValid).toBe(false);
      expect(verification.unverifiedSnippets.length).toBe(1);
    });
  });
});

