import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { isReducedMotion, MOTION_DURATIONS, MOTION_EASES } from '../../lib/motion.js';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'xl'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        panelRef.current?.focus();
      }, 50);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
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

      if (panelRef.current) {
        gsap.fromTo(
          panelRef.current,
          { x: 32, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: MOTION_DURATIONS.emphasis,
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
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
    full: 'max-w-full'
  };

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`w-screen ${widthStyles[size]} bg-surface border-l border-border shadow-raised flex flex-col focus:outline-none`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-4 bg-surface sticky top-0 z-10">
            <div className="min-w-0 flex-1">
              {typeof title === 'string' ? (
                <h2 id="drawer-title" className="text-sm font-semibold tracking-tight text-ink-primary truncate">{title}</h2>
              ) : (
                <div id="drawer-title">{title}</div>
              )}
              {subtitle && (
                <div className="mt-1 text-xs text-ink-secondary">{subtitle}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-subtle transition-colors flex-shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs text-ink-primary">
            {children}
          </div>

          {/* Optional Footer */}
          {footer && (
            <div className="p-4 border-t border-border bg-surface-subtle sticky bottom-0 z-10 flex items-center justify-between gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

