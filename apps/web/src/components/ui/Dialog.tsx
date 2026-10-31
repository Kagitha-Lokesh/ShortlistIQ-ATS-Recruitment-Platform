import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { isReducedMotion, MOTION_DURATIONS, MOTION_EASES } from '../../lib/motion.js';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useGSAP(
    () => {
      if (!isOpen || isReducedMotion()) return;

      if (backdropRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: MOTION_DURATIONS.standard, ease: MOTION_EASES.standard }
        );
      }

      if (surfaceRef.current) {
        gsap.fromTo(
          surfaceRef.current,
          { opacity: 0, scale: 0.98, y: 6 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: MOTION_DURATIONS.standard,
            ease: MOTION_EASES.standard,
            clearProps: 'transform'
          }
        );
      }
    },
    { dependencies: [isOpen], scope: containerRef }
  );

  if (!isOpen) return null;

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Surface */}
      <div
        ref={surfaceRef}
        className={`relative w-full ${widthStyles[maxWidth]} bg-surface border border-border rounded-lg shadow-raised text-ink-primary overflow-hidden flex flex-col z-10`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink-primary">{title}</h2>
            {description && (
              <p className="text-xs text-ink-secondary mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary p-1 rounded hover:bg-surface-subtle transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)] text-xs text-ink-primary">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-border bg-surface-subtle flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

