import React, { useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { APP_NAME } from '@shortlistiq/shared';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Building2,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton.js';
import { Button } from '../components/ui/Button.js';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export const HRLayout: React.FC = () => {
  const { profile, organization, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (mainRef.current) {
      gsap.fromTo(
        mainRef.current,
        { opacity: 0.85, y: 4 },
        { opacity: 1, y: 0, duration: 0.18, ease: 'power1.out' }
      );
    }
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <div className="space-y-4 text-center">
          <Skeleton className="w-10 h-10 rounded mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <p className="text-xs text-slate-muted">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  // Auth & Role Guard
  if (!profile || profile.role !== 'hr') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-ground">
        <div className="bg-surface border border-border rounded-lg p-8 max-w-md w-full shadow-soft text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-state-danger flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-ink-primary mb-2">Access Restricted</h2>
          <p className="text-xs text-ink-secondary mb-6 leading-relaxed">
            You must be signed in with an authorized HR account to access this organization dashboard.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => navigate('/auth/signin')}
          >
            Sign In as HR
          </Button>
        </div>
      </div>
    );
  }

  const navLinks = [
    { label: 'Batches & Screening', path: '/hr/dashboard', icon: LayoutDashboard },
    { label: 'Job Criteria', path: '/hr/jobs', icon: Briefcase },
    { label: 'Candidate Pipeline', path: '/hr/candidates', icon: Users },
    { label: 'Organization Settings', path: '/hr/settings', icon: Settings }
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/signin');
  };

  return (
    <div className="min-h-screen flex bg-ground text-ink-primary">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col fixed inset-y-0 z-30 select-none">
        {/* App & Org Header */}
        <div className="p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2.5 mb-3.5">
            <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center font-bold text-xs tracking-tight">
              SQ
            </div>
            <span className="font-semibold text-sm tracking-tight text-ink-primary">{APP_NAME}</span>
          </Link>

          {/* Org Card */}
          <div className="bg-surface-subtle border border-border rounded px-2.5 py-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ink-muted shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-primary truncate">
                {organization?.name || 'Workspace'}
              </p>
              <p className="text-[10px] text-ink-muted truncate tracking-wider uppercase font-medium">
                Recruitment Team
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-ink-primary font-semibold border-l-2 border-primary'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-ink-muted'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-border bg-surface-subtle">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-xs font-semibold text-ink-primary truncate">
                {profile.fullName || profile.email}
              </p>
              <p className="text-[10px] text-ink-muted truncate font-mono">{profile.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign Out"
              className="p-1.5 rounded text-ink-muted hover:text-state-danger hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-surface px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-secondary font-medium">{organization?.name || 'Org'}</span>
            <span className="text-border-strong">/</span>
            <span className="text-ink-primary font-semibold">
              {location.pathname.includes('/hr/batches/') ? 'Batch Review' : 'Overview'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-state-success border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-state-success" />
              Multi-tenant Isolated
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </header>

        {/* Animated Main Outlet Container */}
        <main ref={mainRef} className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
