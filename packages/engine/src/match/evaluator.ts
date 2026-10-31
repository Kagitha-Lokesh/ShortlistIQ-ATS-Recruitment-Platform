import { ResumeProfile, SkillEvidence } from '../extract/types.js';
import { JobRequirements, SkillRequirement } from '../jd/types.js';
import {
  MatchBreakdown,
  RequirementMatchResult,
  RequirementEvaluationStatus,
  EvidenceStrengthTier,
  RelatedSkillSuggestion
} from './types.js';
import { isSkillContextMatch } from './ontology.js';

const DEGREE_RANK: Record<string, number> = {
  high_school: 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
  other: 0
};

// Recognized related skill transfers (suggested to HR only, never an automatic pass)
const RELATED_SKILL_MAP: Record<string, string[]> = {
  React: ['Vue.js', 'Angular', 'Svelte'],
  'Vue.js': ['React', 'Angular'],
  Angular: ['React', 'Vue.js'],
  PostgreSQL: ['MySQL', 'Oracle', 'SQLite'],
  MySQL: ['PostgreSQL', 'MariaDB'],
  AWS: ['Azure', 'Google Cloud Platform'],
  Azure: ['AWS', 'Google Cloud Platform'],
  'Google Cloud Platform': ['AWS', 'Azure'],
  Python: ['Ruby', 'Go'],
  FastAPI: ['Flask', 'Django', 'Express.js']
};

/**
 * Deterministically evaluates a ResumeProfile against JobRequirements with verbatim evidence
 */
export function matchProfileAgainstJob(
  profile: ResumeProfile,
  jd: JobRequirements
): MatchBreakdown {
  const results: RequirementMatchResult[] = [];
  const relatedSuggestions: RelatedSkillSuggestion[] = [];

  // 1. Evaluate Must-Have Skills
  let passedMustHaves = 0;
  let mustHaveScoreSum = 0;

  for (const req of jd.mustHaveSkills) {
    const candidateSkillTargets = [req.canonical, ...req.alternatives];

    let bestMatch: SkillEvidence | null = null;
    let bestTier: EvidenceStrengthTier = 'none';
    let bestScore = 0;

    for (const target of candidateSkillTargets) {
      const found = profile.skills.find(
        (s) => s.canonicalSkill.toLowerCase() === target.toLowerCase()
      );

      if (found) {
        let tier: EvidenceStrengthTier = 'listed_only';
        let score = 60;

        if (found.evidenceStrength === 'used_with_outcome') {
          tier = 'outcome_backed';
          score = 100;
        } else if (found.evidenceStrength === 'used_in_job') {
          tier = 'job_context';
          score = 90;
        }

        if (score > bestScore) {
          bestScore = score;
          bestTier = tier;
          bestMatch = found;
        }
      }
    }

    if (bestMatch) {
      const status: RequirementEvaluationStatus = bestScore >= 80 ? 'PASS' : 'PARTIAL';
      if (status === 'PASS') passedMustHaves++;

      results.push({
        requirementId: req.id,
        type: 'must_have_skill',
        label: req.canonical + (req.alternatives.length > 0 ? ` (or ${req.alternatives.join(', ')})` : ''),
        status,
        score: bestScore,
        weight: 10,
        evidenceStrength: bestTier,
        resumeSnippet: bestMatch.evidence.snippet,
        resumePage: bestMatch.evidence.page,
        jdClause: req.raw,
        explanation: `Satisfied via ${bestMatch.canonicalSkill} (${bestTier.replace('_', ' ')}).`
      });
      mustHaveScoreSum += bestScore;
    } else {
      // Check for related skills to suggest to HR (strictly labeled as related, never auto-pass)
      const relatedTargets = RELATED_SKILL_MAP[req.canonical] || [];
      const relatedFound = profile.skills.find((s) => relatedTargets.includes(s.canonicalSkill));

      if (relatedFound) {
        relatedSuggestions.push({
          jdSkill: req.canonical,
          relatedResumeSkill: relatedFound.canonicalSkill,
          explanation: `Candidate has verified experience in ${relatedFound.canonicalSkill}, which is related to required ${req.canonical}.`
        });
      }

      results.push({
        requirementId: req.id,
        type: 'must_have_skill',
        label: req.canonical + (req.alternatives.length > 0 ? ` (or ${req.alternatives.join(', ')})` : ''),
        status: 'FAIL',
        score: 0,
        weight: 10,
        evidenceStrength: 'none',
        resumeSnippet: null,
        resumePage: null,
        jdClause: req.raw,
        explanation: `No verified evidence for ${req.canonical}${req.alternatives.length > 0 ? ` or alternatives (${req.alternatives.join(', ')})` : ''} found in resume.`,
        isRelatedSemanticOnly: Boolean(relatedFound)
      });
    }
  }

  // 2. Evaluate Nice-to-Have Skills
  let niceToHaveScoreSum = 0;
  for (const req of jd.niceToHaveSkills) {
    const candidateSkillTargets = [req.canonical, ...req.alternatives];
    let bestMatch: SkillEvidence | null = null;
    let bestScore = 0;
    let bestTier: EvidenceStrengthTier = 'none';

    for (const target of candidateSkillTargets) {
      const found = profile.skills.find(
        (s) => s.canonicalSkill.toLowerCase() === target.toLowerCase()
      );
      if (found) {
        let tier: EvidenceStrengthTier = 'listed_only';
        let score = 50;
        if (found.evidenceStrength === 'used_with_outcome') {
          tier = 'outcome_backed';
          score = 100;
        } else if (found.evidenceStrength === 'used_in_job') {
          tier = 'job_context';
          score = 85;
        }

        if (score > bestScore) {
          bestScore = score;
          bestTier = tier;
          bestMatch = found;
        }
      }
    }

    if (bestMatch) {
      results.push({
        requirementId: req.id,
        type: 'nice_to_have_skill',
        label: req.canonical,
        status: bestScore >= 75 ? 'PASS' : 'PARTIAL',
        score: bestScore,
        weight: 5,
        evidenceStrength: bestTier,
        resumeSnippet: bestMatch.evidence.snippet,
        resumePage: bestMatch.evidence.page,
        jdClause: req.raw,
        explanation: `Preferred skill satisfied via ${bestMatch.canonicalSkill}.`
      });
      niceToHaveScoreSum += bestScore;
    } else {
      results.push({
        requirementId: req.id,
        type: 'nice_to_have_skill',
        label: req.canonical,
        status: 'FAIL',
        score: 0,
        weight: 5,
        evidenceStrength: 'none',
        resumeSnippet: null,
        resumePage: null,
        jdClause: req.raw,
        explanation: `Preferred skill ${req.canonical} not mentioned.`
      });
    }
  }

  // 3. Evaluate Total Experience Years (Never penalize gaps)
  let experienceScore = 100;
  let expStatus: RequirementEvaluationStatus = 'PASS';
  let expExplanation = '';

  const detectedYears = profile.totalExperienceYears;
  const minRequiredYears = jd.minTotalYearsExperience;

  if (minRequiredYears > 0) {
    if (detectedYears >= minRequiredYears) {
      experienceScore = 100;
      expStatus = 'PASS';
      expExplanation = `Detected ${detectedYears} years of cumulative relevant experience, meeting required ${minRequiredYears} years.`;
    } else {
      experienceScore = Math.round((detectedYears / minRequiredYears) * 85);
      expStatus = 'PARTIAL';
      expExplanation = `Detected ${detectedYears} years of cumulative experience (below ${minRequiredYears} years requested). Gaps treated neutrally.`;
    }
  } else {
    expExplanation = `Detected ${detectedYears} years of experience. No minimum threshold required by JD.`;
  }

  results.push({
    requirementId: 'req-experience-overall',
    type: 'experience_years',
    label: `Experience: ${minRequiredYears > 0 ? `${minRequiredYears}+ Years` : 'Any'}`,
    status: expStatus,
    score: experienceScore,
    weight: 15,
    evidenceStrength: detectedYears > 0 ? 'job_context' : 'none',
    resumeSnippet: profile.experience[0]?.evidence?.snippet || `Detected ${detectedYears} total years`,
    resumePage: 1,
    jdClause: `${minRequiredYears}+ years experience`,
    explanation: expExplanation
  });

  // 4. Evaluate Education
  let educationScore = 100;
  let eduStatus: RequirementEvaluationStatus = 'PASS';
  let eduSnippet: string | null = null;
  let eduExplanation = '';

  if (jd.education) {
    const requiredRank = DEGREE_RANK[jd.education.level] || 3;
    const highestCandRank = Math.max(
      0,
      ...profile.education.map((e) => DEGREE_RANK[e.normalizedDegreeLevel] || 0)
    );

    const highestCandEdu = profile.education.find(
      (e) => (DEGREE_RANK[e.normalizedDegreeLevel] || 0) === highestCandRank
    );

    if (highestCandRank >= requiredRank) {
      educationScore = 100;
      eduStatus = 'PASS';
      eduSnippet = highestCandEdu?.evidence?.snippet || null;
      eduExplanation = `Meets degree requirement (${highestCandEdu?.normalizedDegreeLevel || 'degree'}). Institution prestige excluded from scoring.`;
    } else if (jd.education.allowEquivalentExperience && detectedYears >= (minRequiredYears || 3) + 2) {
      educationScore = 95;
      eduStatus = 'PASS';
      eduSnippet = `Equivalent experience satisfied: ${detectedYears} years work history`;
      eduExplanation = `Satisfies 'or equivalent experience' clause based on ${detectedYears} years of demonstrated experience.`;
    } else {
      educationScore = 50;
      eduStatus = 'PARTIAL';
      eduSnippet = highestCandEdu?.evidence?.snippet || null;
      eduExplanation = `Requested ${jd.education.level} degree, detected ${highestCandEdu?.normalizedDegreeLevel || 'none'}.`;
    }
  } else {
    eduExplanation = 'No specific degree requirements configured in job description.';
  }

  results.push({
    requirementId: 'req-education-degree',
    type: 'education',
    label: jd.education ? `Degree: ${jd.education.level}` : 'Education',
    status: eduStatus,
    score: educationScore,
    weight: 10,
    evidenceStrength: eduStatus === 'PASS' ? 'job_context' : 'none',
    resumeSnippet: eduSnippet,
    resumePage: 1,
    jdClause: jd.education ? `${jd.education.level} degree` : 'Education',
    explanation: eduExplanation
  });

  // 5. Compute Explainable Overall Composite Score (0-100)
  const totalMust = jd.mustHaveSkills.length;
  const totalNice = jd.niceToHaveSkills.length;

  const mustHaveAvg = totalMust > 0 ? mustHaveScoreSum / totalMust : 100;
  const niceToHaveAvg = totalNice > 0 ? niceToHaveScoreSum / totalNice : 100;

  // Composite Weight distribution:
  // Must-Haves: 50%
  // Nice-to-Haves: 20%
  // Experience: 20%
  // Education: 10%
  const composite =
    mustHaveAvg * 0.50 +
    niceToHaveAvg * 0.20 +
    experienceScore * 0.20 +
    educationScore * 0.10;

  const overallScore = Math.min(100, Math.max(0, Math.round(composite)));

  return {
    overallScore,
    mustHaveScore: Math.round(mustHaveAvg),
    niceToHaveScore: Math.round(niceToHaveAvg),
    experienceScore,
    educationScore,
    results,
    passedMustHavesCount: passedMustHaves,
    totalMustHavesCount: totalMust,
    failedMustHavesCount: totalMust - passedMustHaves,
    isAllMustHavesSatisfied: totalMust > 0 ? passedMustHaves === totalMust : true,
    relatedSuggestions
  };
}

