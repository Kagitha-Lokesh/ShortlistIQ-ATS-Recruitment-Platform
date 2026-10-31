import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { APP_NAME } from '@shortlistiq/shared';
import { Button } from '../components/ui/Button.js';

export const PublicLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink-primary">
      {/* Top Navigation */}
      <header className="border-b border-border bg-surface sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs tracking-tight">
              SQ
            </div>
            <span className="font-semibold text-sm tracking-tight text-ink-primary">
              {APP_NAME}
            </span>
          </Link>

          <nav className="flex items-center gap-5">
            <Link
              to="/candidate"
              className="text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
            >
              Candidate Portal
            </Link>

            {profile ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/hr/dashboard')}
                >
                  HR Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                  }}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/auth/signin"
                  className="text-xs font-medium text-ink-primary hover:text-ink-secondary transition-colors px-2 py-1"
                >
                  Sign In
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/auth/signup-hr')}
                >
                  Sign Up as HR
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* High-Trust Footer */}
      <footer className="border-t border-border bg-surface py-6 text-xs text-ink-muted">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {APP_NAME}. Deterministic ATS & Transparent Recruitment Screening.</p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacy" className="hover:text-ink-primary underline transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-ink-primary underline transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link to="/privacy/delete-data" className="hover:text-red-700 underline transition-colors">
              Candidate Right to Erasure
            </Link>
            <span>•</span>
            <span className="text-emerald-700 font-medium">Tenant Isolated</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
