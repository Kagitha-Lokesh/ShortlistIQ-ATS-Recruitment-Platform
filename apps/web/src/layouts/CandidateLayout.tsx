import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { APP_NAME } from '@shortlistiq/shared';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export const CandidateLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-primary">
      {/* Top Header */}
      <header className="border-b border-slate-border bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-slate-secondary hover:text-slate-primary p-1.5 rounded transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-slate-primary">{APP_NAME}</span>
              <span className="text-slate-secondary text-xs">/</span>
              <Link to="/checker" className="text-xs font-medium text-slate-secondary hover:text-slate-primary">
                ATS Checker
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/checker"
              className="text-xs font-medium text-slate-primary hover:text-brand-indigo px-2.5 py-1"
            >
              New Check
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-secondary border border-slate-border">
              <ShieldCheck className="w-3.5 h-3.5 text-state-success" />
              Privacy-First
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-border bg-white py-6 text-center text-xs text-slate-secondary">
        <p className="max-w-4xl mx-auto px-6">
          Your resume is analyzed deterministically. We never sell or log your personal contact details.
        </p>
      </footer>
    </div>
  );
};

