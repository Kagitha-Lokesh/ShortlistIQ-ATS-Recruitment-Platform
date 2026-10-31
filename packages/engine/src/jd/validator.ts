import { JdQualityIssue, SkillRequirement } from './types.js';

// Established release years for modern technologies
const TECH_RELEASE_YEARS: Record<string, number> = {
  fastapi: 2018,
  kubernetes: 2014,
  k8s: 2014,
  rust: 2015,
  swift: 2014,
  kotlin: 2011,
  nextjs: 2016,
  'next.js': 2016,
  flutter: 2017,
  graphql: 2015,
  svelte: 2016,
  tailwind: 2017,
  'tailwind css': 2017,
  docker: 2013,
  solidity: 2014,
  remix: 2021
};

const DISCRIMINATORY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(young\s+and\s+energetic|youthful)\b/i, reason: 'Potentially age-discriminatory wording.' },
  { pattern: /\bdigital\s+native\b/i, reason: 'Age-biased terminology excluding experienced workers.' },
  { pattern: /\brecent\s+graduates?\s+only\b/i, reason: 'Arbitrarily excludes qualified non-recent graduates.' },
  { pattern: /\bnative\s+(english|german|french|spanish)\s+speaker\b/i, reason: 'Nationality or origin bias; specify professional working proficiency instead.' },
  { pattern: /\b(rockstar|ninja|guru|wizard)\b/i, reason: 'Vague cultural jargon known to discourage diverse applicants.' },
  { pattern: /\bcultural\s+fit\b/i, reason: 'Subjective criterion prone to unconscious bias; specify values or teamwork expectations.' }
];

const NON_JD_INDICATORS = [
  /^(curriculum\s+vitae|resume|personal\s+profile)\b/i,
  /\b(education|experience|projects|skills)\s*:\s*\w+/i,
  /^import\s+.*\s+from\s+/m,
  /^function\s+\w+\(/m,
  /^class\s+\w+\s+{/m
];

/**
 * Validates whether raw input text is a legitimate job description.
 */
export function validateIsJobDescription(text: string): { isValid: boolean; reason?: string } {
  const clean = text.trim();
  if (clean.length < 120) {
    return {
      isValid: false,
      reason: 'The provided text is too short to be a job description (minimum 120 characters required).'
    };
  }

  // Check if text looks like a resume or code snippet instead of a job description
  for (const indicator of NON_JD_INDICATORS) {
    if (indicator.test(clean) && !/\b(requirements|qualifications|responsibilities|looking\s+for|we\s+are\s+hiring)\b/i.test(clean)) {
      return {
        isValid: false,
        reason: 'The text appears to be a resume or code snippet rather than a job description.'
      };
    }
  }

  // Check for typical JD intent signals
  const jdKeywords = [
    /\b(responsibilities|qualifications|requirements|job\s+summary|role\s+overview)\b/i,
    /\b(looking\s+for|seeking|we\s+offer|candidate\s+should|must\s+have)\b/i,
    /\b(experience\s+with|proficient\s+in|familiarity\s+with|years\s+of\s+experience)\b/i
  ];

  const matchedSignals = jdKeywords.filter((re) => re.test(clean)).length;
  if (matchedSignals === 0 && clean.length < 300) {
    return {
      isValid: false,
      reason: 'The text lacks standard job description components (qualifications, responsibilities, or role requirements).'
    };
  }

  return { isValid: true };
}

/**
 * Scans a parsed job description for quality issues:
 * - Unrealistic years of experience (e.g. 10 years of a 6-year-old technology)
 * - Excessively long must-have lists (> 10 items)
 * - Potentially discriminatory or biased phrasing
 */
export function validateJobDescriptionQuality(
  text: string,
  mustHaves: SkillRequirement[],
  currentYear = new Date().getFullYear()
): JdQualityIssue[] {
  const issues: JdQualityIssue[] = [];

  // 1. Check for Unrealistic Experience Combinations
  for (const req of mustHaves) {
    const term = req.canonical.toLowerCase();
    const releaseYear = TECH_RELEASE_YEARS[term];
    if (releaseYear && req.minYears !== undefined) {
      const maxPossibleYears = currentYear - releaseYear;
      if (req.minYears > maxPossibleYears) {
        issues.push({
          type: 'UNREALISTIC_EXPERIENCE',
          severity: 'error',
          message: `Requires ${req.minYears} years of experience in ${req.canonical}, but ${req.canonical} was released in ${releaseYear} (maximum possible: ${maxPossibleYears} years).`,
          snippet: req.raw
        });
      }
    }
  }

  // 2. Check for Excessively Long Must-Have List
  if (mustHaves.length > 9) {
    issues.push({
      type: 'LONG_MUST_HAVE_LIST',
      severity: 'warning',
      message: `Job description specifies ${mustHaves.length} mandatory must-have skills. Restrictive criteria lists disproportionately filter out qualified candidates. Consider moving some to preferred/nice-to-have.`
    });
  }

  // 3. Scan for Potentially Discriminatory or Biased Language
  for (const item of DISCRIMINATORY_PATTERNS) {
    const match = text.match(item.pattern);
    if (match) {
      issues.push({
        type: 'DISCRIMINATORY_LANGUAGE',
        severity: 'warning',
        message: item.reason,
        snippet: match[0]
      });
    }
  }

  return issues;
}
