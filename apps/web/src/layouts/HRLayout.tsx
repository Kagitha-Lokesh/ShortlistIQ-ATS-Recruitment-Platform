import React from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton.js';

export const HRLayout: React.FC = () => {
  const { profile, organization, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="w-12 h-12 rounded mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <p className="text-xs text-slate-secondary">Loading HR Workspace...</p>
        </div>
      </div>
    );
  }

  // Auth & Role Guard
  if (!profile || profile.role !== 'hr') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="bg-white border border-slate-border rounded-lg p-8 max-w-md w-full shadow-soft text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-state-danger flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-primary mb-2">Access Restricted</h2>
          <p className="text-xs text-slate-secondary mb-6 leading-relaxed">
            You must be signed in with an authorized HR account to access this organization dashboard.
          </p>
          <button
            onClick={() => navigate('/auth/signin')}
            className="w-full py-2 px-4 text-xs font-medium rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
          >
            Sign In as HR
          </button>
        </div>
      </div>
    );
  }

  const navLinks = [
    { label: 'Dashboard', path: '/hr/dashboard', icon: LayoutDashboard },
    { label: 'Job Listings', path: '/hr/jobs', icon: Briefcase },
    { label: 'Candidate Pipeline', path: '/hr/candidates', icon: Users },
    { label: 'Organization Settings', path: '/hr/settings', icon: Settings }
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/signin');
  };

  return (
    <div className="min-h-screen flex bg-background text-slate-primary">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-slate-border bg-white flex flex-col fixed inset-y-0 z-30">
        {/* App & Org Header */}
        <div className="p-5 border-b border-slate-border">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded bg-brand-indigo flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-primary">{APP_NAME}</span>
          </Link>

          {/* Org Badge */}
          <div className="bg-slate-50 border border-slate-border rounded p-2.5 flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-slate-secondary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-primary truncate">
                {organization?.name || 'My Organization'}
              </p>
              <p className="text-[10px] text-slate-secondary truncate uppercase tracking-wider">
                HR Workspace
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-brand-indigo font-semibold'
                    : 'text-slate-secondary hover:text-slate-primary hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-indigo' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-slate-border bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-xs font-semibold text-slate-primary truncate">
                {profile.fullName || profile.email}
              </p>
              <p className="text-[10px] text-slate-secondary truncate">{profile.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign Out"
              className="p-1.5 rounded text-slate-secondary hover:text-state-danger hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-border bg-white px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-secondary font-medium">{organization?.name || 'Org'}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-primary font-semibold">Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-state-success border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-state-success"></span>
              Multi-tenant Isolated
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs font-medium px-3 py-1.5 rounded border border-slate-border text-slate-primary hover:bg-slate-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Body Content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

