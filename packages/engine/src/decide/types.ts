import { RequirementMatchResult } from '../match/types.js';
import { IntegrityFlag, ParseStatus } from '../ingest/types.js';

export type EngineRecommendation = 'recommended_shortlist' | 'recommended_not_shortlisted' | 'needs_review';

export type DecisionTrigger =
  | 'ALL_REQUIREMENTS_MET'
  | 'BELOW_CUTOFF'
  | 'BORDERLINE_SCORE'
  | 'PARSE_PARTIAL_OR_UNREADABLE'
  | 'MUST_HAVE_PARTIAL_OR_RELATED'
  | 'KNOCKOUT_FLAG'
  | 'SUSPICIOUS_INTEGRITY'
  | 'EXPERIENCE_CLOSE_THRESHOLD';

export interface KnockoutAnswerDetails {
  fieldId: string;
  question: string;
  answer: any;
  reason: string;
}

export interface HrActionRecord {
  action: 'confirmed_shortlist' | 'confirmed_reject' | 'override_shortlist' | 'override_reject' | 'requested_interview';
  userId: string;
  timestamp: string;
  notes?: string;
}

export interface DecisionAudit {
  recommendation: EngineRecommendation;
  score: number;
  cutoff: number;
  trigger: DecisionTrigger;
  triggerReason: string;
  passedMustHaves: string[];
  failedMustHaves: string[];
  partialRequirements: string[];
  integrityFlags: IntegrityFlag[];
  knockoutDetails: KnockoutAnswerDetails | null;
  parseStatus: ParseStatus;
  hrActionHistory: HrActionRecord[];
  isFinalDecision: boolean; // Always false until HR acts in UI
}
