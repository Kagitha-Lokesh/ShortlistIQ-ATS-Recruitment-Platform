import React from 'react';
import { Switch } from '../ui/Switch.js';
import { EyeOff, ShieldCheck, Info } from 'lucide-react';

export interface BlindReviewBarProps {
  isBlindReview: boolean;
  onToggleBlindReview: (enabled: boolean) => void;
  overrideNote?: string;
  className?: string;
}

export const BlindReviewBar: React.FC<BlindReviewBarProps> = ({
  isBlindReview,
  onToggleBlindReview,
  overrideNote,
  className = ''
}) => {
  return (
    <div
      role="region"
      aria-label="Evaluation Integrity and Blind Review Mode"
      className={`rounded-lg border border-border bg-surface p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-subtle ${className}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            isBlindReview ? 'bg-primary text-white' : 'bg-surface-subtle text-ink-muted'
          }`}
          aria-hidden="true"
        >
          <EyeOff className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-primary">
              Blind Screening Mode
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              EEOC & Bias Compliant
            </span>
          </div>
          <p className="text-[11px] text-ink-secondary mt-0.5">
            {isBlindReview
              ? 'Candidate PII (name, gender, photo, age, university prestige, address) is masked from evaluator view.'
              : 'Full candidate profile details are visible to authorized evaluators.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pl-11 sm:pl-0">
        <div className="flex items-center gap-2">
          <label htmlFor="blind-review-toggle" className="text-xs font-medium text-ink-secondary cursor-pointer select-none">
            {isBlindReview ? 'PII Masked' : 'Mask PII'}
          </label>
          <Switch
            id="blind-review-toggle"
            checked={isBlindReview}
            onChange={onToggleBlindReview}
            aria-label="Toggle blind screening mode to mask candidate PII"
          />
        </div>
      </div>
    </div>
  );
};

