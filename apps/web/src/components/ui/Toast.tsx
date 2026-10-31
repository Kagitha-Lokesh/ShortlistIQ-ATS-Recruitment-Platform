import React, { useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { isReducedMotion, MOTION_DURATIONS, MOTION_EASES } from '../../lib/motion.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const toastRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!toastRef.current || isReducedMotion()) return;

      gsap.fromTo(
        toastRef.current,
        { opacity: 0, y: 12, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: MOTION_DURATIONS.standard,
          ease: MOTION_EASES.standard
        }
      );
    },
    { scope: toastRef }
  );

  const handleDismiss = () => {
    if (!toastRef.current || isReducedMotion()) {
      onDismiss(toast.id);
      return;
    }

    gsap.to(toastRef.current, {
      opacity: 0,
      y: -8,
      scale: 0.98,
      duration: MOTION_DURATIONS.micro,
      ease: MOTION_EASES.exit,
      onComplete: () => onDismiss(toast.id)
    });
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-state-success flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-state-danger flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-state-warning flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-brand flex-shrink-0" />
  };

  const borderAccents = {
    success: 'border-l-4 border-l-state-success',
    error: 'border-l-4 border-l-state-danger',
    warning: 'border-l-4 border-l-state-warning',
    info: 'border-l-4 border-l-brand'
  };

  return (
    <div
      ref={toastRef}
      role="alert"
      className={`bg-surface border border-border rounded shadow-raised p-4 flex items-start gap-3 w-80 max-w-full text-ink-primary ${borderAccents[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-ink-primary">{toast.title}</h4>
        {toast.message && (
          <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="text-ink-muted hover:text-ink-primary p-0.5 rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

