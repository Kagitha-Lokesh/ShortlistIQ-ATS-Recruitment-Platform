export type RequirementEvaluationStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'UNKNOWN';
export type EvidenceStrengthTier = 'outcome_backed' | 'job_context' | 'listed_only' | 'related_semantic' | 'none';

export interface RequirementMatchResult {
  requirementId: string;
  type: 'must_have_skill' | 'nice_to_have_skill' | 'experience_years' | 'education';
  label: string;
  status: RequirementEvaluationStatus;
  score: number; // 0 to 100 for this requirement
  weight: number;
  evidenceStrength: EvidenceStrengthTier;
  resumeSnippet: string | null;
  resumePage: number | null;
  jdClause: string;
  explanation: string;
  isRelatedSemanticOnly?: boolean;
}

export interface RelatedSkillSuggestion {
  jdSkill: string;
  relatedResumeSkill: string;
  explanation: string;
}

export interface MatchBreakdown {
  overallScore: number; // 0-100 explainable composite score
  mustHaveScore: number;
  niceToHaveScore: number;
  experienceScore: number;
  educationScore: number;
  results: RequirementMatchResult[];
  passedMustHavesCount: number;
  totalMustHavesCount: number;
  failedMustHavesCount: number;
  isAllMustHavesSatisfied: boolean;
  relatedSuggestions: RelatedSkillSuggestion[];
}

