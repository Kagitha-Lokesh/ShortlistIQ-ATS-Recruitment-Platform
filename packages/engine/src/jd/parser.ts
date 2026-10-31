import {
  JobRequirements,
  SkillRequirement,
  SeniorityLevel,
  EducationRequirement,
  RequirementStrength
} from './types.js';
import { validateIsJobDescription, validateJobDescriptionQuality } from './validator.js';
import { SKILL_DICTIONARY } from '../skills/index.js';
import { DegreeLevel } from '../extract/types.js';

const SENIORITY_PATTERNS: Array<{ level: SeniorityLevel; regex: RegExp }> = [
  { level: 'lead', regex: /\b(principal|staff|lead|architect|head|director)\b/i },
  { level: 'senior', regex: /\b(senior|sr\.?)\b/i },
  { level: 'entry', regex: /\b(junior|jr\.?|associate|entry[- ]level|intern|internship|graduate)\b/i },
  { level: 'executive', regex: /\b(vp|vice president|chief|cto|cio|cpo)\b/i },
  { level: 'mid', regex: /\b(mid[- ]level|intermediate|experienced)\b/i }
];

const MUST_HAVE_PATTERNS = [
  /\bmust\s+have\b/i,
  /\brequired\b/i,
  /\bmandatory\b/i,
  /\bessential\b/i,
  /\bminimum\s+qualifications?\b/i,
  /\bcore\s+requirements?\b/i
];

const NICE_TO_HAVE_PATTERNS = [
  /\bnice\s+to\s+have\b/i,
  /\bpreferred\b/i,
  /\bplus\b/i,
  /\bbonus\b/i,
  /\bgood\s+to\s+have\b/i,
  /\boptional\b/i,
  /\badvantageous\b/i,
  /\bdesired\b/i
];

function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Parses job description text into typed, validated JobRequirements
 */
export function parseJobDescription(jdText: string, jobTitleOverride?: string): JobRequirements {
  const isJdCheck = validateIsJobDescription(jdText);

  if (!isJdCheck.isValid) {
    return {
      title: jobTitleOverride || null,
      seniority: 'unknown',
      employmentType: 'unknown',
      minTotalYearsExperience: 0,
      mustHaveSkills: [],
      niceToHaveSkills: [],
      education: null,
      certifications: [],
      languages: [],
      locationConstraints: [],
      responsibilities: [],
      domainKeywords: [],
      qualityIssues: [
        {
          type: 'NOT_A_JOB_DESCRIPTION',
          severity: 'error',
          message: isJdCheck.reason || 'Input text does not resemble a job description.'
        }
      ],
      isValidJobDescription: false,
      validationReason: isJdCheck.reason,
      version: 1,
      isConfirmedByHr: false
    };
  }

  const lines = jdText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Title & Seniority
  let title = jobTitleOverride || null;
  if (!title) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const l = lines[i];
      if (/developer|engineer|manager|analyst|architect|consultant|specialist|designer|scientist|lead/i.test(l) && l.length < 60) {
        title = l;
        break;
      }
    }
  }

  let seniority: SeniorityLevel = 'mid';
  const combinedTitleAndHeader = `${title || ''} ${lines.slice(0, 5).join(' ')}`;
  for (const sp of SENIORITY_PATTERNS) {
    if (sp.regex.test(combinedTitleAndHeader)) {
      seniority = sp.level;
      break;
    }
  }

  // 2. Minimum Overall Years of Experience
  let minTotalYears = 0;
  const expMatch = jdText.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+)?experience/i);
  if (expMatch) {
    minTotalYears = parseInt(expMatch[1], 10);
  } else if (seniority === 'senior') {
    minTotalYears = 5;
  } else if (seniority === 'lead') {
    minTotalYears = 7;
  } else if (seniority === 'entry') {
    minTotalYears = 0;
  }

  // 3. Extract Skills with Strength & "OR" Alternatives
  const mustHaveSkills: SkillRequirement[] = [];
  const niceToHaveSkills: SkillRequirement[] = [];
  const processedCanonicals = new Set<string>();

  // Check for explicit "OR" alternatives (e.g. "React or Angular", "Python or Go")
  const orAlternativesPattern = /\b([a-zA-Z0-9#+.]{2,})\s+(?:or|\/)\s+([a-zA-Z0-9#+.]{2,})\b/gi;
  let orMatch: RegExpExecArray | null;

  while ((orMatch = orAlternativesPattern.exec(jdText)) !== null) {
    const rawLeft = orMatch[1].trim();
    const rawRight = orMatch[2].trim();

    const defLeft = SKILL_DICTIONARY.find((d) => d.aliases.some((a) => a.toLowerCase() === rawLeft.toLowerCase()));
    const defRight = SKILL_DICTIONARY.find((d) => d.aliases.some((a) => a.toLowerCase() === rawRight.toLowerCase()));

    if (defLeft && defRight && defLeft.canonical !== defRight.canonical) {
      const canonical = defLeft.canonical;
      const alternative = defRight.canonical;

      if (!processedCanonicals.has(canonical) && !processedCanonicals.has(alternative)) {
        processedCanonicals.add(canonical);
        processedCanonicals.add(alternative);

        // Check if line context contains nice-to-have or must-have wording
        const contextLine = lines.find((l) => l.includes(orMatch![0])) || '';
        const isPreferred = NICE_TO_HAVE_PATTERNS.some((p) => p.test(contextLine));
        const strength: RequirementStrength = isPreferred ? 'nice_to_have' : 'must_have';

        const req: SkillRequirement = {
          id: `req-or-${canonical.toLowerCase()}-${alternative.toLowerCase()}`,
          raw: orMatch[0],
          canonical,
          alternatives: [alternative],
          strength
        };

        if (strength === 'must_have') {
          mustHaveSkills.push(req);
        } else {
          niceToHaveSkills.push(req);
        }
      }
    }
  }

  // Check all other skills in dictionary
  for (const def of SKILL_DICTIONARY) {
    if (processedCanonicals.has(def.canonical)) continue;

    for (const alias of def.aliases) {
      const aliasRegex = new RegExp(`(^|[^a-zA-Z0-9#+])${escapeRegex(alias)}([^a-zA-Z0-9#+]|$)`, 'i');
      if (aliasRegex.test(jdText)) {
        processedCanonicals.add(def.canonical);

        // Find surrounding line context to determine strength and min years
        const matchingLine = lines.find((l) => aliasRegex.test(l)) || '';
        const isPreferred = NICE_TO_HAVE_PATTERNS.some((p) => p.test(matchingLine));
        const isNegated = /\b(no|without|not)\s+[a-zA-Z0-9#+.]*\s*$/i.test(matchingLine.slice(0, matchingLine.indexOf(alias)));

        // Extract per-skill years if specified: e.g. "3+ years of Python"
        let skillYears: number | undefined;
        const skillYearMatch = matchingLine.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
        if (skillYearMatch) {
          skillYears = parseInt(skillYearMatch[1], 10);
        }

        const strength: RequirementStrength = isPreferred ? 'nice_to_have' : 'must_have';
        const req: SkillRequirement = {
          id: `req-${def.canonical.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          raw: matchingLine || def.canonical,
          canonical: def.canonical,
          alternatives: [],
          minYears: skillYears,
          strength,
          isNegated
        };

        if (strength === 'must_have') {
          mustHaveSkills.push(req);
        } else {
          niceToHaveSkills.push(req);
        }
        break;
      }
    }
  }

  // 4. Education Requirement
  let education: EducationRequirement | null = null;
  const eduPattern = /\b(bachelor|b\.?s|master|m\.?s|ph\.?d|doctorate|degree)\b/i;
  const eduLine = lines.find((l) => eduPattern.test(l));

  if (eduLine) {
    let level: DegreeLevel = 'bachelor';
    if (/master|m\.?s|m\.?tech|mba/i.test(eduLine)) level = 'master';
    else if (/ph\.?d|doctorate/i.test(eduLine)) level = 'doctorate';

    const allowEquivalent = /\b(or\s+equivalent(?:\s+experience|\s+work\s+experience)?|equivalent\s+practical\s+experience)\b/i.test(eduLine);

    education = {
      level,
      allowEquivalentExperience: allowEquivalent,
      strength: 'must_have'
    };
  }

  // 5. Scan Quality Issues
  const qualityIssues = validateJobDescriptionQuality(jdText, mustHaveSkills);

  return {
    title,
    seniority,
    employmentType: /\bremote\b/i.test(jdText) ? 'remote' : 'full-time',
    minTotalYearsExperience: minTotalYears,
    mustHaveSkills,
    niceToHaveSkills,
    education,
    certifications: [],
    languages: [],
    locationConstraints: [],
    responsibilities: [],
    domainKeywords: [],
    qualityIssues,
    isValidJobDescription: true,
    version: 1,
    isConfirmedByHr: false
  };
}
