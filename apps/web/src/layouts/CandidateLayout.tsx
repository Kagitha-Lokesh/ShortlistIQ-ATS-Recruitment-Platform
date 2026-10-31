import React, { useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { APP_NAME } from '@shortlistiq/shared';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export const CandidateLayout: React.FC = () => {
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (mainRef.current) {
      gsap.fromTo(
        mainRef.current,
        { opacity: 0.88, y: 3 },
        { opacity: 1, y: 0, duration: 0.18, ease: 'power1.out' }
      );
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink-primary">
      {/* Top Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-ink-secondary hover:text-ink-primary p-1 rounded hover:bg-surface-subtle transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-ink-primary">{APP_NAME}</span>
              <span className="text-border-strong text-xs">/</span>
              <Link to="/checker" className="text-xs font-medium text-ink-secondary hover:text-ink-primary">
                ATS Resume Checker
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/checker"
              className="text-xs font-medium text-ink-primary hover:text-brand-accent px-2.5 py-1"
            >
              New Check
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full bg-surface-subtle text-ink-secondary border border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-state-success" />
              Privacy Protected
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface py-5 text-center text-xs text-ink-muted">
        <p className="max-w-4xl mx-auto px-6">
          Your resume is analyzed deterministically against exact job requirements. PII is excluded from algorithmic scoring.
        </p>
      </footer>
    </div>
  );
};
