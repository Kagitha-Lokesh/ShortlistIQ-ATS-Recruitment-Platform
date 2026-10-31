import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepIndex,
  onStepClick,
  className = ''
}) => {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          const isPending = idx > currentStepIndex;
          const isClickable = onStepClick && idx <= currentStepIndex;

          return (
            <li
              key={step.id}
              className={`relative flex-1 ${idx !== steps.length - 1 ? 'pr-4 sm:pr-8' : ''}`}
            >
              {/* Connector Line */}
              {idx !== steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute top-4 left-8 -right-0 h-0.5 transition-colors ${
                    isCompleted ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(idx)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group relative flex items-center gap-3 text-left w-full transition-colors ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                {/* Step Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all border z-10 select-none ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isCurrent
                      ? 'bg-surface text-primary border-primary ring-2 ring-primary/20'
                      : 'bg-surface text-ink-muted border-border'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : idx + 1}
                </div>

                {/* Step Text */}
                <div className="hidden sm:block min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isCurrent
                        ? 'text-ink-primary'
                        : isCompleted
                        ? 'text-ink-primary'
                        : 'text-ink-muted'
                    }`}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-[11px] text-ink-muted truncate">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

