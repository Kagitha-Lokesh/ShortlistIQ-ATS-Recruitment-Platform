import React from 'react';
import { Card, CardContent } from '../ui/Card.js';
import { Skeleton } from '../ui/Skeleton.js';

export interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  subtext?: string;
  delta?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  description,
  subtext,
  delta,
  icon,
  isLoading = false,
  className = ''
}) => {
  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-between pb-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="w-5 h-5 rounded" />
        </div>
        <Skeleton className="h-7 w-20 my-1" />
        <Skeleton className="h-3 w-32 mt-2" />
      </Card>
    );
  }

  return (
    <Card className={`transition-colors hover:border-border-strong ${className}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-ink-secondary tracking-tight truncate">
            {title}
          </span>
          {icon && (
            <div className="text-ink-muted p-1 rounded bg-surface-subtle flex-shrink-0" aria-hidden="true">
              {icon}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-ink-primary tabular-nums">
            {value}
          </span>
          {delta && (
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                delta.isPositive
                  ? 'text-state-success'
                  : delta.isPositive === false
                  ? 'text-state-warning'
                  : 'text-ink-muted'
              }`}
            >
              {delta.value} {delta.label && <span className="text-ink-muted font-normal">{delta.label}</span>}
            </span>
          )}
        </div>

        {(description || subtext) && (
          <p className="mt-1 text-[11px] text-ink-muted leading-relaxed">
            {description || subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

