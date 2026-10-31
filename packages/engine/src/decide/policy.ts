import { MatchBreakdown } from '../match/types.js';
import { ParseQualityReport } from '../ingest/types.js';
import {
  DecisionAudit,
  EngineRecommendation,
  DecisionTrigger,
  KnockoutAnswerDetails
} from './types.js';

export interface DecisionPolicyOptions {
  cutoff: number; // e.g. 70
  parseReport?: ParseQualityReport;
  knockoutDetails?: KnockoutAnswerDetails | null;
  experienceDeficitMonths?: number;
}

/**
 * High-Stakes Decision Policy:
 * Strictly ensures no candidate is ever rejected by machine logic alone.
 * Evaluates triggers and routes borderline / ambiguous cases to needs_review.
 */
export function evaluateDecisionPolicy(
  match: MatchBreakdown,
  options: DecisionPolicyOptions
): DecisionAudit {
  const { cutoff, parseReport, knockoutDetails, experienceDeficitMonths } = options;
  const score = match.overallScore;

  const passedMustHaves = match.results
    .filter((r) => r.type === 'must_have_skill' && r.status === 'PASS')
    .map((r) => r.label);

  const failedMustHaves = match.results
    .filter((r) => r.type === 'must_have_skill' && r.status === 'FAIL')
    .map((r) => r.label);

  const partialRequirements = match.results
    .filter((r) => r.status === 'PARTIAL')
    .map((r) => r.label);

  const integrityFlags = parseReport?.integrityFlags || [];
  const parseStatus = parseReport?.status || 'OK';

  let recommendation: EngineRecommendation = 'recommended_not_shortlisted';
  let trigger: DecisionTrigger = 'BELOW_CUTOFF';
  let triggerReason = `Match score (${score}) fell below the required cutoff of ${cutoff}.`;

  // 1. Parse Status Gate: PARTIAL or UNREADABLE must NEVER produce rejection
  if (parseStatus === 'PARTIAL' || parseStatus === 'UNREADABLE') {
    recommendation = 'needs_review';
    trigger = 'PARSE_PARTIAL_OR_UNREADABLE';
    triggerReason = `Document parse status is ${parseStatus} (${parseReport?.reasons.join('; ') || 'formatting/OCR anomalies'}). Human review required to protect candidate from parsing defects.`;
  }
  // 2. Knockout Question Failed: Flag for HR confirmation, do NOT auto-reject
  else if (knockoutDetails) {
    recommendation = 'needs_review';
    trigger = 'KNOCKOUT_FLAG';
    triggerReason = `Knockout rule triggered for question "${knockoutDetails.question}": ${knockoutDetails.reason}. Flagged for HR review and confirmation.`;
  }
  // 3. High Severity Integrity Flags (Microscopic text, prompt injections)
  else if (integrityFlags.some((f) => f.severity === 'high')) {
    recommendation = 'needs_review';
    trigger = 'SUSPICIOUS_INTEGRITY';
    triggerReason = 'Integrity alert detected in document structure. Human review recommended.';
  }
  // 4. Borderline Match Score (within 5 points of cutoff)
  else if (Math.abs(score - cutoff) <= 5) {
    recommendation = 'needs_review';
    trigger = 'BORDERLINE_SCORE';
    triggerReason = `Borderline score: Overall match score of ${score} is within 5 points of the ${cutoff} cutoff.`;
  }
  // 5. Must-Have Missing but Partial or Related Skill Exists
  else if (failedMustHaves.length > 0 && (partialRequirements.length > 0 || match.relatedSuggestions.length > 0)) {
    recommendation = 'needs_review';
    trigger = 'MUST_HAVE_PARTIAL_OR_RELATED';
    triggerReason = `Candidate lacks an exact must-have match, but has verified related experience (${match.relatedSuggestions.map((s) => `${s.relatedResumeSkill} for ${s.jdSkill}`).join(', ') || 'partial proficiency'}).`;
  }
  // 6. Experience Threshold Close (within 6 months)
  else if (experienceDeficitMonths !== undefined && experienceDeficitMonths > 0 && experienceDeficitMonths <= 6) {
    recommendation = 'needs_review';
    trigger = 'EXPERIENCE_CLOSE_THRESHOLD';
    triggerReason = `Total experience is within 6 months of minimum requirement (${experienceDeficitMonths} months remaining). Human discretion advised.`;
  }
  // 7. All Must-Haves Met and Score >= Cutoff
  else if (match.isAllMustHavesSatisfied && score >= cutoff) {
    recommendation = 'recommended_shortlist';
    trigger = 'ALL_REQUIREMENTS_MET';
    triggerReason = `Candidate achieved match score of ${score} (meets cutoff ${cutoff}) with all mandatory requirements satisfied.`;
  }
  // 8. Clear Below Cutoff (Still advisory, never final reject)
  else {
    recommendation = 'recommended_not_shortlisted';
    trigger = 'BELOW_CUTOFF';
    triggerReason = `Candidate scored ${score} against ${cutoff} cutoff (${failedMustHaves.length} must-have criteria unfulfilled). Advisory recommendation only; HR retains final hiring decision.`;
  }

  return {
    recommendation,
    score,
    cutoff,
    trigger,
    triggerReason,
    passedMustHaves,
    failedMustHaves,
    partialRequirements,
    integrityFlags,
    knockoutDetails: knockoutDetails || null,
    parseStatus,
    hrActionHistory: [],
    isFinalDecision: false
  };
}

