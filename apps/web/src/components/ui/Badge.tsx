import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  XCircle,
  FileCheck,
  AlertTriangle,
  AlertOctagon
} from 'lucide-react';

export type BadgeVariant =
  | 'shortlisted'
  | 'needs_review'
  | 'unshortlisted'
  | 'failed'
  | 'parse_ok'
  | 'parse_partial'
  | 'parse_unreadable'
  | 'neutral'
  | 'outline'
  | 'must_have'
  | 'nice_to_have'
  | 'dealbreaker'
  | 'tier_outcome'
  | 'tier_job'
  | 'tier_listed'
  | 'tier_related';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
  shortlisted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  needs_review: 'bg-amber-50 text-amber-800 border-amber-300',
  unshortlisted: 'bg-slate-100 text-slate-700 border-slate-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
  parse_ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  parse_partial: 'bg-amber-50 text-amber-800 border-amber-200',
  parse_unreadable: 'bg-red-50 text-red-800 border-red-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  outline: 'bg-white text-slate-700 border-slate-300',
  must_have: 'bg-blue-50 text-blue-800 border-blue-200',
  nice_to_have: 'bg-slate-50 text-slate-600 border-slate-200',
  dealbreaker: 'bg-rose-50 text-rose-800 border-rose-200',
  tier_outcome: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  tier_job: 'bg-blue-100 text-blue-900 border-blue-200',
  tier_listed: 'bg-slate-100 text-slate-700 border-slate-200',
  tier_related: 'bg-purple-50 text-purple-800 border-purple-200'
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const sizeStyle = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border ${variantStyles[variant]} ${sizeStyle} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export interface DecisionStatusBadgeProps {
  decision: 'recommended_shortlist' | 'needs_review' | 'recommended_not_shortlisted' | 'shortlisted' | 'unshortlisted' | 'failed' | string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * High-stakes decision badge: NEVER relies on color alone; always pairs icon with verbatim text.
 */
export const DecisionStatusBadge: React.FC<DecisionStatusBadgeProps> = ({
  decision,
  size = 'md',
  className = ''
}) => {
  const norm = (decision || '').toLowerCase().replace(/[\s-]/g, '_');

  if (norm === 'recommended_shortlist' || norm === 'shortlisted') {
    return (
      <Badge variant="shortlisted" size={size} className={className}>
        <CheckCircle2 className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
        <span>Recommended Shortlist</span>
      </Badge>
    );
  }

  if (norm === 'needs_review') {
    return (
      <Badge variant="needs_review" size={size} className={className}>
        <AlertCircle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
        <span>Needs Review</span>
      </Badge>
    );
  }

  if (norm === 'failed') {
    return (
      <Badge variant="failed" size={size} className={className}>
        <XCircle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
        <span>Knockout Flagged</span>
      </Badge>
    );
  }

  return (
    <Badge variant="unshortlisted" size={size} className={className}>
      <MinusCircle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      <span>Not Shortlisted</span>
    </Badge>
  );
};

export interface ParseQualityBadgeProps {
  status: 'OK' | 'PARTIAL' | 'UNREADABLE' | string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Parse quality disclosure badge: always shows icon + text status.
 */
export const ParseQualityBadge: React.FC<ParseQualityBadgeProps> = ({
  status,
  size = 'md',
  className = ''
}) => {
  const norm = (status || 'OK').toUpperCase();

  if (norm === 'OK') {
    return (
      <Badge variant="parse_ok" size={size} className={className}>
        <FileCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
        <span>Parse Quality: OK</span>
      </Badge>
    );
  }

  if (norm === 'PARTIAL') {
    return (
      <Badge variant="parse_partial" size={size} className={className}>
        <AlertTriangle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
        <span>Parse Quality: Partial</span>
      </Badge>
    );
  }

  return (
    <Badge variant="parse_unreadable" size={size} className={className}>
      <AlertOctagon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      <span>Parse Quality: Unreadable</span>
    </Badge>
  );
};
