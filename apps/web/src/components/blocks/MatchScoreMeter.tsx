import React from 'react';

export interface MatchScoreMeterProps {
  score: number;
  label?: string;
  showTier?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MatchScoreMeter: React.FC<MatchScoreMeterProps> = ({
  score,
  label = 'Match Estimate vs. Job Requirements',
  showTier = true,
  size = 'md',
  className = ''
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  const getTierInfo = (s: number) => {
    if (s >= 80) {
      return {
        name: 'Strong Requirement Match',
        textColor: 'text-state-success',
        bgColor: 'bg-emerald-500'
      };
    }
    if (s >= 60) {
      return {
        name: 'Moderate Match (Needs Review)',
        textColor: 'text-state-warning',
        bgColor: 'bg-amber-500'
      };
    }
    return {
      name: 'Partial Match (Pending Review)',
      textColor: 'text-ink-secondary',
      bgColor: 'bg-slate-400'
    };
  };

  const tier = getTierInfo(clampedScore);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`space-y-1.5 ${className}`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-secondary">{label}</span>
        <span className="font-bold tabular-nums text-ink-primary">
          <span className={`text-base font-extrabold ${tier.textColor}`}>{clampedScore}</span>
          <span className="text-ink-muted text-xs font-normal"> / 100</span>
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 rounded-full bg-surface-subtle border border-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${tier.bgColor}`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-ink-muted">
        {showTier && (
          <span className={`font-semibold ${tier.textColor}`}>
            {tier.name}
          </span>
        )}
        <span className="text-ink-muted">
          Deterministic keyword match estimate • Non-predictive
        </span>
      </div>
    </div>
  );
};
