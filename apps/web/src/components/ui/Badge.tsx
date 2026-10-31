import React from 'react';

export type BadgeVariant =
  | 'shortlisted'
  | 'needs_review'
  | 'unshortlisted'
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
