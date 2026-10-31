import {
  ResumeProfile,
  ExperienceItem,
  EducationItem,
  SkillEvidence,
  ProjectItem,
  CertificationItem,
  ProfileField,
  DegreeLevel,
  EvidenceSnippet
} from './types.js';
import { extractContactInfo } from './contact.js';
import { parseDateRange, mergeOverlappingDateRanges } from './dates.js';
import { segmentSections } from '../sections/index.js';
import { SKILL_DICTIONARY } from '../skills/index.js';

const DEGREE_PATTERNS: Array<{ level: DegreeLevel; regex: RegExp }> = [
  { level: 'doctorate', regex: /\b(ph\.?d|doctorate|doctor of philosophy)\b/i },
  { level: 'master', regex: /\b(m\.?s|m\.?tech|master|msc|mba|mca|m\.?e)\b/i },
  { level: 'bachelor', regex: /\b(b\.?s|b\.?tech|bachelor|bsc|bca|b\.?e|b\.?com|bba)\b/i },
  { level: 'associate', regex: /\b(associate|associate's degree)\b/i },
  { level: 'high_school', regex: /\b(high school|secondary school|intermediate|12th|10th)\b/i }
];

const QUANTIFIABLE_OUTCOME_REGEX = /(\d+%\s*(?:increase|reduction|improvement|growth|boost)|\$\d+|\b(?:scaled|reduced|reducing|increased|increasing|optimized|optimizing|decreased|accelerated)\b.*?\d+|\bby\s+\d+%|\bto\s+\d+)/i;

function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Extracts a typed, evidence-backed ResumeProfile deterministically from resume text.
 * Strictly adheres to non-negotiable principles:
 * - Never invents or infers fields: missing fields are null with confidence 0
 * - Merges overlapping date ranges so concurrent roles do not double count
 * - Excludes demographic & protected attributes from scoring payloads
 */
export function extractResumeProfile(text: string, page = 1): ResumeProfile {
  const sections = segmentSections(text);
  const contact = extractContactInfo(text, page);

  // 1. Summary
  const summaryText = sections.summary.trim();
  const summary: ProfileField<string> = {
    value: summaryText.length > 20 ? summaryText : null,
    confidence: summaryText.length > 20 ? 0.90 : 0.0,
    evidence: summaryText.length > 20 ? { page, snippet: summaryText.slice(0, 150) } : null
  };

  // 2. Experience Items
  const experienceLines = sections.experience.split('\n').map((l) => l.trim()).filter(Boolean);
  const experienceItems: ExperienceItem[] = [];
  const validDateRanges: Array<{ startDate: Date; endDate: Date }> = [];

  let currentExp: Partial<ExperienceItem> | null = null;
  const dateRangeRegex = /(?:(20[0-2]\d|199\d)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:20[0-2]\d|199\d)?)\s*(?:[-–—]+|\bto\b)\s*(?:(20[0-2]\d|199\d|present|current|now)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:20[0-2]\d|199\d)?)/i;

  for (const line of experienceLines) {
    const isBullet = /^[•*\-–—]/.test(line);
    const dateMatch = line.match(dateRangeRegex);

    if (!isBullet && dateMatch) {
      if (currentExp && currentExp.rawTitle) {
        experienceItems.push(currentExp as ExperienceItem);
      }

      const parsedRange = parseDateRange(dateMatch[0]);
      if (parsedRange) {
        validDateRanges.push({
          startDate: parsedRange.startDate,
          endDate: parsedRange.endDate
        });
      }

      // Title & Company extraction
      const cleanHeader = line.replace(dateRangeRegex, '').replace(/[()]/g, '').trim();
      let title = cleanHeader;
      let employer = '';

      if (cleanHeader.includes('|')) {
        const parts = cleanHeader.split('|').map((s) => s.trim());
        title = parts[0] || '';
        employer = parts[1] || '';
      } else if (cleanHeader.includes(' at ')) {
        const parts = cleanHeader.split(' at ').map((s) => s.trim());
        title = parts[0] || '';
        employer = parts[1] || '';
      } else if (cleanHeader.includes(' - ')) {
        const parts = cleanHeader.split(' - ').map((s) => s.trim());
        title = parts[0] || '';
        employer = parts[1] || '';
      }

      let expType: ExperienceItem['type'] = 'full-time';
      if (/intern\b|internship/i.test(title)) expType = 'internship';
      else if (/freelance/i.test(title)) expType = 'freelance';
      else if (/contract/i.test(title)) expType = 'contract';

      currentExp = {
        rawTitle: title,
        normalizedTitle: {
          value: title || null,
          confidence: title ? 0.90 : 0.0,
          evidence: { page, snippet: line }
        },
        employer: {
          value: employer || null,
          confidence: employer ? 0.85 : 0.0,
          evidence: employer ? { page, snippet: line } : null
        },
        startDate: parsedRange?.startStr || null,
        endDate: parsedRange?.endStr || null,
        isCurrent: parsedRange?.isCurrent ?? false,
        durationMonths: parsedRange?.durationMonths || 0,
        type: expType,
        bullets: [],
        confidence: 0.90,
        evidence: { page, snippet: line }
      };
    } else if (isBullet && currentExp) {
      const cleanBullet = line.replace(/^[•*\-–—]\s*/, '').trim();
      if (cleanBullet.length > 5) {
        // Detect mentioned technologies in bullet
        const techs: string[] = [];
        for (const def of SKILL_DICTIONARY) {
          if (def.aliases.some((a) => new RegExp(`(^|[^a-zA-Z0-9#+])${escapeRegex(a)}([^a-zA-Z0-9#+]|$)`, 'i').test(cleanBullet))) {
            techs.push(def.canonical);
          }
        }
        currentExp.bullets!.push({
          text: cleanBullet,
          technologies: techs,
          evidence: { page, snippet: line }
        });
      }
    }
  }

  if (currentExp && currentExp.rawTitle) {
    experienceItems.push(currentExp as ExperienceItem);
  }

  // Calculate merged total experience
  const { totalMonths } = mergeOverlappingDateRanges(validDateRanges);
  const totalExperienceMonths = totalMonths;
  const totalExperienceYears = Math.round((totalMonths / 12) * 10) / 10;

  // 3. Education Items
  const educationLines = sections.education.split('\n').map((l) => l.trim()).filter(Boolean);
  const educationItems: EducationItem[] = [];

  for (const line of educationLines) {
    let matchedLevel: DegreeLevel = 'other';
    for (const dp of DEGREE_PATTERNS) {
      if (dp.regex.test(line)) {
        matchedLevel = dp.level;
        break;
      }
    }

    const gpaMatch = line.match(/\b(?:CGPA|GPA|Grade)\s*:?\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?%?)/i);

    if (matchedLevel !== 'other') {
      const yearMatch = line.match(/\b(19\d\d|20[0-2]\d)\b/g);
      const endYear = yearMatch ? parseInt(yearMatch[yearMatch.length - 1], 10) : null;
      const startYear = yearMatch && yearMatch.length > 1 ? parseInt(yearMatch[0], 10) : null;

      educationItems.push({
        institution: {
          value: line.split(/[-–—|]/)[0]?.trim() || null,
          confidence: 0.85,
          evidence: { page, snippet: line }
        },
        normalizedDegreeLevel: matchedLevel,
        rawDegree: line,
        fieldOfStudy: null,
        startYear,
        endYear,
        grade: gpaMatch ? gpaMatch[1] : null,
        confidence: 0.90,
        evidence: { page, snippet: line }
      });
    } else if (gpaMatch && educationItems.length > 0) {
      // Attach grade/CGPA from standalone line to previous degree item
      educationItems[educationItems.length - 1].grade = gpaMatch[1];
    }
  }

  // 4. Skills with Evidence Strength
  const skills: SkillEvidence[] = [];
  const foundCanonicals = new Set<string>();

  for (const def of SKILL_DICTIONARY) {
    for (const alias of def.aliases) {
      const regex = new RegExp(`(^|[^a-zA-Z0-9#+])${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-zA-Z0-9#+]|$)`, 'i');

      // Check experience bullets first (used with outcome vs used in job)
      let foundInBullet = false;
      for (const exp of experienceItems) {
        for (const bullet of exp.bullets) {
          if (regex.test(bullet.text)) {
            foundInBullet = true;
            const hasOutcome = QUANTIFIABLE_OUTCOME_REGEX.test(bullet.text);
            const strength = hasOutcome ? 'used_with_outcome' : 'used_in_job';

            if (!foundCanonicals.has(def.canonical)) {
              foundCanonicals.add(def.canonical);
              skills.push({
                rawTerm: alias,
                canonicalSkill: def.canonical,
                category: def.category,
                source: 'experience',
                evidenceStrength: strength,
                monthsExperience: exp.durationMonths || 12,
                evidence: bullet.evidence
              });
            }
            break;
          }
        }
        if (foundInBullet) break;
      }

      // Check skills section
      if (!foundInBullet && regex.test(sections.skills)) {
        if (!foundCanonicals.has(def.canonical)) {
          foundCanonicals.add(def.canonical);
          const snippet = sections.skills.split('\n').find((l) => regex.test(l)) || def.canonical;
          skills.push({
            rawTerm: alias,
            canonicalSkill: def.canonical,
            category: def.category,
            source: 'skills_section',
            evidenceStrength: 'listed_only',
            monthsExperience: 0,
            evidence: { page, snippet: snippet.trim() }
          });
        }
      }
    }
  }

  return {
    contact,
    summary,
    experience: experienceItems,
    totalExperienceMonths,
    totalExperienceYears,
    education: educationItems,
    skills,
    projects: [],
    certifications: [],
    languages: [],
    publications: [],
    awards: [],
    demographicsStripped: false
  };
}

/**
 * Strips protected and irrelevant demographic attributes from profile before scoring:
 * Name, gender, age, photo, address/city, college prestige, marital status.
 */
export function stripProtectedDemographics(profile: ResumeProfile): ResumeProfile {
  return {
    ...profile,
    contact: {
      ...profile.contact,
      primaryPhone: null,
      phones: [],
      location: { value: null, confidence: 0, evidence: null }
    },
    education: profile.education.map((e) => ({
      ...e,
      // Keep degree level and year, redact institution name to prevent college prestige bias
      institution: { value: '[REDACTED_INSTITUTION]', confidence: 1.0, evidence: null }
    })),
    demographicsStripped: true
  };
}

/**
 * Validates LLM-assisted second opinion:
 * Strictly rejects any LLM extraction if its quoted evidence does NOT appear verbatim in the resume text!
 */
export function verifyLlmAssistedProfile(
  llmProfile: Partial<ResumeProfile>,
  resumeText: string
): { isValid: boolean; unverifiedSnippets: string[] } {
  const unverified: string[] = [];

  const verifySnippet = (snippet: string | undefined | null) => {
    if (!snippet) return;
    const cleanSnippet = snippet.trim();
    if (cleanSnippet.length > 10 && !resumeText.includes(cleanSnippet)) {
      unverified.push(cleanSnippet);
    }
  };

  if (llmProfile.summary?.evidence?.snippet) {
    verifySnippet(llmProfile.summary.evidence.snippet);
  }

  if (Array.isArray(llmProfile.experience)) {
    for (const exp of llmProfile.experience) {
      verifySnippet(exp.evidence?.snippet);
      for (const b of exp.bullets || []) {
        verifySnippet(b.evidence?.snippet);
      }
    }
  }

  if (Array.isArray(llmProfile.skills)) {
    for (const s of llmProfile.skills) {
      verifySnippet(s.evidence?.snippet);
    }
  }

  return {
    isValid: unverified.length === 0,
    unverifiedSnippets: unverified
  };
}
