import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { APP_NAME } from '@shortlistiq/shared';

export const PublicLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-primary">
      {/* Top Navigation */}
      <header className="border-b border-slate-border bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-brand-indigo flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="font-bold text-base tracking-tight text-slate-primary">
              {APP_NAME}
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/candidate"
              className="text-xs font-medium text-slate-secondary hover:text-slate-primary transition-colors"
            >
              Candidate Portal
            </Link>

            {profile ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/hr/dashboard"
                  className="text-xs font-medium px-3 py-1.5 rounded bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-sm"
                >
                  HR Dashboard
                </Link>
                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                  }}
                  className="text-xs font-medium text-slate-secondary hover:text-slate-primary transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/auth/signin"
                  className="text-xs font-medium text-slate-primary hover:text-brand-indigo transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth/signup-hr"
                  className="text-xs font-medium px-3.5 py-1.5 rounded bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-sm"
                >
                  Sign Up as HR
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-border bg-white py-8 text-xs text-slate-secondary">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {APP_NAME}. Deterministic ATS & Privacy-First Screening.</p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacy" className="hover:text-brand-indigo underline transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-brand-indigo underline transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link to="/privacy/delete-data" className="hover:text-state-danger underline transition-colors">
              Candidate Right to Erasure
            </Link>
            <span>•</span>
            <span>Multi-Tenant Isolated</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

