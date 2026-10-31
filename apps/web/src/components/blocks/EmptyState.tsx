import React from 'react';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = ''
}) => {
  return (
    <Card className={`p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-ink-muted mb-4" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink-primary tracking-tight">{title}</h3>
      <p className="text-xs text-ink-secondary mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>

      {(actionText || secondaryActionText) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {secondaryActionText && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          )}
          {actionText && onAction && (
            <Button variant="primary" size="sm" onClick={onAction}>
              {actionText}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

