import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

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
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-state-success flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-state-danger flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-state-warning flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-brand-indigo flex-shrink-0" />
  };

  const borderAccents = {
    success: 'border-l-4 border-l-state-success',
    error: 'border-l-4 border-l-state-danger',
    warning: 'border-l-4 border-l-state-warning',
    info: 'border-l-4 border-l-brand-indigo'
  };

  return (
    <div
      role="alert"
      className={`bg-white border border-slate-border rounded shadow-soft p-4 flex items-start gap-3 w-80 max-w-full transition-all ${borderAccents[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-slate-primary">{toast.title}</h4>
        {toast.message && (
          <p className="text-xs text-slate-secondary mt-0.5 leading-relaxed break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-slate-secondary hover:text-slate-primary p-0.5 rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

