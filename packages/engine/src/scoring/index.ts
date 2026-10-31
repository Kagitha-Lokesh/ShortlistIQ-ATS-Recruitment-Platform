import { extractBasics, CandidateBasics } from '../basics/index.js';
import { segmentSections, ResumeSections } from '../sections/index.js';
import { extractSkills, ExtractedSkillsResult } from '../skills/index.js';
import { calculateTfIdfMatch, TfIdfResult } from './tfidf.js';
import { calculateReadability, ReadabilityMetrics } from './readability.js';

export interface ScoreWeights {
  keywordWeight: number;    // default 0.35
  skillsWeight: number;     // default 0.30
  experienceWeight: number; // default 0.20
  formattingWeight: number; // default 0.10
  readabilityWeight: number;// default 0.05
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  keywordWeight: 0.35,
  skillsWeight: 0.30,
  experienceWeight: 0.20,
  formattingWeight: 0.10,
  readabilityWeight: 0.05
};

export interface ResumeScoreBreakdown {
  overallScore: number; // 0 - 100
  keywordScore: number; // 0 - 100
  skillsScore: number;  // 0 - 100
  experienceScore: number; // 0 - 100
  formattingScore: number; // 0 - 100
  readabilityScore: number;// 0 - 100
  detectedYearsExperience: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  matchedSkills: string[];
  sectionsDetected: string[];
  readability: ReadabilityMetrics;
  basics: CandidateBasics;
}

/**
 * Estimates years of experience from resume text and sections
 */
export function estimateExperienceYears(text: string): number {
  let highestYears = 0;

  // Patterns like "5+ years", "5 years of experience", "5 yrs"
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/gi,
    /experience\s*(?:of)?\s*(\d+)\+?\s*(?:years?|yrs?)/gi,
    /(?:over|more than)\s+(\d+)\s*(?:years?|yrs?)/gi
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > highestYears && parsed < 45) {
        highestYears = parsed;
      }
    }
  }

  // Also estimate from date ranges like "2018 - 2024" or "2019 - Present"
  const dateRangePattern = /\b(20[0-2]\d|199\d)\s*[-–—to]+\s*(20[0-2]\d|present|current)\b/gi;
  let totalSpanYears = 0;
  let match;
  const currentYear = new Date().getFullYear();

  while ((match = dateRangePattern.exec(text)) !== null) {
    const startYear = parseInt(match[1], 10);
    const endStr = match[2].toLowerCase();
    const endYear = (endStr === 'present' || endStr === 'current') ? currentYear : parseInt(endStr, 10);

    if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
      totalSpanYears += Math.min(15, endYear - startYear);
    }
  }

  return Math.max(highestYears, Math.min(30, totalSpanYears));
}

/**
 * Evaluates formatting, structure, section completeness, and contact presence
 */
export function evaluateFormattingAndStructure(
  text: string,
  sections: ResumeSections,
  basics: CandidateBasics
): { score: number; detectedSections: string[] } {
  let sectionPoints = 0;
  const detectedSections: string[] = [];

  const sectionWeights: Record<keyof Omit<ResumeSections, 'other'>, number> = {
    experience: 25,
    skills: 25,
    education: 15,
    summary: 10,
    projects: 10,
    certifications: 5
  };

  for (const [sec, weight] of Object.entries(sectionWeights) as [keyof Omit<ResumeSections, 'other'>, number][]) {
    if (sections[sec] && sections[sec].trim().length > 30) {
      detectedSections.push(sec);
      sectionPoints += weight;
    }
  }

  // Cap section points at 70
  let points = Math.min(70, sectionPoints);

  // Contact info completeness (up to 15 points)
  if (basics.email !== 'NO_EMAIL') points += 6;
  if (basics.phone) points += 5;
  if (basics.links.linkedin || basics.links.github) points += 4;

  // Word length check (ideal between 200 and 1500 words, up to 15 points)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 200 && wordCount <= 1500) {
    points += 15;
  } else if (wordCount > 100) {
    points += 8;
  }

  return {
    score: Math.min(100, Math.max(0, points)),
    detectedSections
  };
}

/**
 * 5. scoreResume(resumeText, jdText, criteria?):
 * Deterministic 0-100 score with complete breakdown.
 * Pure framework-free TypeScript.
 */
export function scoreResume(
  resumeText: string,
  jdText: string,
  options?: {
    weights?: Partial<ScoreWeights>;
    minimumYearsExperience?: number;
    requiredSkills?: string[];
  }
): ResumeScoreBreakdown {
  const weights: ScoreWeights = {
    ...DEFAULT_SCORE_WEIGHTS,
    ...(options?.weights || {})
  };

  // 1. Extract Basics & Sections
  const basics = extractBasics(resumeText);
  const sections = segmentSections(resumeText);

  // 2. TF-IDF Keyword Match
  const tfIdfResult: TfIdfResult = calculateTfIdfMatch(resumeText, jdText);
  const keywordScore = tfIdfResult.score;

  // 3. Skills Match
  const skillsResult: ExtractedSkillsResult = extractSkills(resumeText, jdText);
  let skillsScore = 50;

  if (options?.requiredSkills && options.requiredSkills.length > 0) {
    const matchedCount = options.requiredSkills.filter((s) =>
      skillsResult.matchedSkills.some((ms) => ms.toLowerCase() === s.toLowerCase())
    ).length;
    skillsScore = Math.round((matchedCount / options.requiredSkills.length) * 100);
  } else if (jdText) {
    const jdSkills = extractSkills(jdText);
    const targetSkillCount = Math.max(1, jdSkills.matchedSkills.length);
    skillsScore = Math.min(100, Math.round((skillsResult.jdOverlapSkills.length / targetSkillCount) * 100));
  } else {
    // Baseline skills density
    skillsScore = Math.min(100, Math.round((skillsResult.totalCount / 10) * 100));
  }

  // 4. Experience Relevance
  const detectedYears = estimateExperienceYears(resumeText);
  const minRequiredYears = options?.minimumYearsExperience ?? 3;
  let experienceScore = 100;

  if (minRequiredYears > 0) {
    if (detectedYears >= minRequiredYears) {
      experienceScore = 100;
    } else {
      experienceScore = Math.round((detectedYears / minRequiredYears) * 85);
    }
  }

  // 5. Formatting & Structure
  const formattingResult = evaluateFormattingAndStructure(resumeText, sections, basics);
  const formattingScore = formattingResult.score;

  // 6. Readability
  const readability = calculateReadability(resumeText);
  const readabilityScore = readability.score;

  // 7. Weighted Composite Score
  const composite =
    keywordScore * weights.keywordWeight +
    skillsScore * weights.skillsWeight +
    experienceScore * weights.experienceWeight +
    formattingScore * weights.formattingWeight +
    readabilityScore * weights.readabilityWeight;

  const overallScore = Math.min(100, Math.max(0, Math.round(composite)));

  return {
    overallScore,
    keywordScore,
    skillsScore,
    experienceScore,
    formattingScore,
    readabilityScore,
    detectedYearsExperience: detectedYears,
    matchedKeywords: tfIdfResult.matchedKeywords,
    missingKeywords: tfIdfResult.missingKeywords,
    matchedSkills: skillsResult.matchedSkills,
    sectionsDetected: formattingResult.detectedSections,
    readability,
    basics
  };
}

// --- 6. scoreAgainstCriteria ---

export interface CriterionItem {
  id: string;
  label: string;
  type: 'must_have' | 'nice_to_have' | 'dealbreaker' | 'must-have' | 'nice-to-have';
  weight?: number; // 1 - 10
  keywords?: string[];
  minYears?: number;
}

export interface CriteriaEvaluationOptions {
  cutoff: number; // e.g. 70
  criteria: CriterionItem[];
  alwaysRequireAllMustHaves?: boolean;
  weights?: Partial<ScoreWeights>;
}

export interface CriterionEvaluationResult {
  criterionId: string;
  label: string;
  type: 'must_have' | 'nice_to_have' | 'dealbreaker' | 'must-have' | 'nice-to-have';
  weight?: number;
  passed: boolean;
  evidenceSnippet?: string;
  reason: string;
}

export interface CriteriaDecisionResult {
  overallScore: number;
  cutoff: number;
  decision: 'shortlisted' | 'unshortlisted' | 'needs_review';
  decisionReason: string;
  failedMustHavesCount: number;
  dealbreakerTriggered: boolean;
  criteriaResults: CriterionEvaluationResult[];
  breakdown: ResumeScoreBreakdown;
}

/**
 * Finds evidence snippet (surrounding sentence/line) in resume text for a matched keyword
 */
function findEvidenceSnippet(text: string, term: string): string | undefined {
  const lines = text.split('\n');
  const termLower = term.toLowerCase();

  for (const line of lines) {
    if (line.toLowerCase().includes(termLower)) {
      const clean = line.replace(/^[\s•*-]+/, '').trim();
      if (clean.length >= 15) {
        return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
      }
    }
  }

  return undefined;
}

/**
 * 6. scoreAgainstCriteria(candidateText, jdText, options):
 * Evaluates must-have, nice-to-have and dealbreaker criteria with evidence snippets.
 * Borderline detection: within 5 points of cutoff or exactly one failed must-have -> needs_review.
 */
export function scoreAgainstCriteria(
  resumeText: string,
  jdText: string,
  options: CriteriaEvaluationOptions
): CriteriaDecisionResult {
  const breakdown = scoreResume(resumeText, jdText, {
    weights: options.weights
  });

  const criteriaResults: CriterionEvaluationResult[] = [];
  let failedMustHavesCount = 0;
  let dealbreakerTriggered = false;
  let dealbreakerReason: string | null = null;

  for (const criterion of options.criteria) {
    let passed = false;
    let evidenceSnippet: string | undefined = undefined;
    let reason = '';

    // Check years of experience requirement
    if (criterion.minYears !== undefined) {
      if (breakdown.detectedYearsExperience >= criterion.minYears) {
        passed = true;
        evidenceSnippet = `Detected ${breakdown.detectedYearsExperience} years of experience in resume.`;
        reason = `Meets minimum ${criterion.minYears} years requirement (detected ${breakdown.detectedYearsExperience} years).`;
      } else {
        passed = false;
        reason = `Requires ${criterion.minYears} years of experience, but detected ${breakdown.detectedYearsExperience} years.`;
      }
    }

    // Check keyword requirements if specified
    if (criterion.keywords && criterion.keywords.length > 0) {
      const matched = criterion.keywords.filter((kw) => {
        const hasSkill = breakdown.matchedSkills.some((s) => s.toLowerCase() === kw.toLowerCase());
        const hasKeyword = breakdown.matchedKeywords.some((k) => k.toLowerCase() === kw.toLowerCase());
        const hasRaw = resumeText.toLowerCase().includes(kw.toLowerCase());
        return hasSkill || hasKeyword || hasRaw;
      });

      if (matched.length === criterion.keywords.length) {
        passed = true;
        const firstKw = matched[0];
        evidenceSnippet = findEvidenceSnippet(resumeText, firstKw) || `Found matching terms: ${matched.join(', ')}`;
        reason = `Satisfies required terms: ${matched.join(', ')}.`;
      } else {
        passed = false;
        const missing = criterion.keywords.filter((kw) => !matched.includes(kw));
        reason = `Missing required terms: ${missing.join(', ')}.`;
      }
    }

    if (!passed) {
      const isMustHave = criterion.type === 'must_have' || criterion.type === 'must-have';
      const isDealbreaker = criterion.type === 'dealbreaker';

      if (isMustHave) {
        failedMustHavesCount++;
      } else if (isDealbreaker) {
        dealbreakerTriggered = true;
        dealbreakerReason = reason || `Dealbreaker condition failed for: ${criterion.label}`;
      }
    }

    criteriaResults.push({
      criterionId: criterion.id,
      label: criterion.label,
      type: criterion.type,
      weight: criterion.weight ?? 5,
      passed,
      evidenceSnippet,
      reason
    });
  }

  // Overall Decision Logic with Borderline Detection:
  // - Dealbreaker triggered -> unshortlisted
  // - alwaysRequireAllMustHaves enabled and must-haves failed -> unshortlisted (or needs_review if borderline)
  // - Score >= cutoff AND failedMustHaves === 0 -> shortlisted
  // - Borderline cases -> needs_review:
  //     1. Score is within 5 points of cutoff (e.g. cutoff 75, score 70-79)
  //     2. Exactly 1 failed must-have requirement
  let decision: 'shortlisted' | 'unshortlisted' | 'needs_review' = 'unshortlisted';
  let decisionReason = '';

  const score = breakdown.overallScore;
  const cutoff = options.cutoff;
  const isNearCutoff = Math.abs(score - cutoff) <= 5;
  const isExactlyOneFailedMustHave = failedMustHavesCount === 1;

  if (dealbreakerTriggered) {
    decision = 'unshortlisted';
    decisionReason = `Dealbreaker criterion failed: ${dealbreakerReason || 'Mandatory dealbreaker condition was not met.'}`;
  } else if (options.alwaysRequireAllMustHaves && failedMustHavesCount > 0) {
    if (isExactlyOneFailedMustHave && isNearCutoff) {
      decision = 'needs_review';
      decisionReason = `Borderline: Exactly 1 must-have criterion failed with score near cutoff. Human review recommended.`;
    } else {
      decision = 'unshortlisted';
      decisionReason = `Mandatory must-have requirement failed (${failedMustHavesCount} must-have criteria failed).`;
    }
  } else if (isExactlyOneFailedMustHave) {
    decision = 'needs_review';
    decisionReason = `Borderline: Exactly 1 must-have criterion was not satisfied. Human review recommended.`;
  } else if (isNearCutoff) {
    decision = 'needs_review';
    decisionReason = `Borderline: Score of ${score} is within 5 points of the ${cutoff} cutoff. Human review recommended.`;
  } else if (score >= cutoff && failedMustHavesCount === 0) {
    decision = 'shortlisted';
    decisionReason = `Score of ${score} meets or exceeds the cutoff (${cutoff}) with all must-have criteria satisfied.`;
  } else {
    decision = 'unshortlisted';
    decisionReason = `Score of ${score} fell below the required cutoff of ${cutoff} (${failedMustHavesCount} must-have criteria failed).`;
  }

  return {
    overallScore: score,
    cutoff,
    decision,
    decisionReason,
    failedMustHavesCount,
    dealbreakerTriggered,
    criteriaResults,
    breakdown
  };
}
