import React, { useRef, useState, useEffect } from 'react';
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
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  Command,
  X,
  Menu,
  ChevronDown,
  User,
  Plus,
  ExternalLink
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

  // Sidebar collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shortlistiq_hr_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer open state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Command search dialog state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // User menu open state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut for Command Search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle sidebar collapse
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('shortlistiq_hr_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useGSAP(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (mainRef.current) {
      gsap.fromTo(
        mainRef.current,
        { opacity: 0.9, y: 3 },
        { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }
      );
    }
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted">
        <div className="space-y-4 text-center">
          <Skeleton className="w-10 h-10 rounded-md mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <p className="text-xs text-ink-muted">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  // Auth & Role Guard
  if (!profile || profile.role !== 'hr') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-muted">
        <div className="bg-surface border border-border rounded-xl p-8 max-w-md w-full shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-status-danger-text flex items-center justify-center mx-auto border border-red-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-ink-primary">Access Restricted</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            You must be signed in with an authorized HR administrator account to access this recruitment workspace.
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

  // Breadcrumb generator
  const getBreadcrumbs = () => {
    const parts = [{ label: organization?.name || 'Workspace', href: '/hr/dashboard' }];
    if (location.pathname.startsWith('/hr/batches/new')) {
      parts.push({ label: 'Screening Batches', href: '/hr/dashboard' });
      parts.push({ label: 'Create Batch', href: '/hr/batches/new' });
    } else if (location.pathname.includes('/hr/batches/')) {
      parts.push({ label: 'Screening Batches', href: '/hr/dashboard' });
      parts.push({ label: 'Batch Review', href: location.pathname });
    } else if (location.pathname.startsWith('/hr/settings')) {
      parts.push({ label: 'Organization Settings', href: '/hr/settings' });
    } else if (location.pathname.startsWith('/hr/jobs')) {
      parts.push({ label: 'Job Criteria', href: '/hr/jobs' });
    } else if (location.pathname.startsWith('/hr/candidates')) {
      parts.push({ label: 'Candidate Pipeline', href: '/hr/candidates' });
    } else {
      parts.push({ label: 'Screening Dashboard', href: '/hr/dashboard' });
    }
    return parts;
  };

  const breadcrumbs = getBreadcrumbs();

  // Search quick actions
  const quickActions = [
    { label: 'Batches & Screening Dashboard', path: '/hr/dashboard', category: 'Navigation' },
    { label: 'Create New Screening Batch', path: '/hr/batches/new', category: 'Actions' },
    { label: 'Organization Privacy & Retention Settings', path: '/hr/settings', category: 'Settings' },
    { label: 'Candidate Single Resume Checker', path: '/checker', category: 'Public Tools' }
  ].filter(
    (item) =>
      !searchQuery.trim() ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-surface-muted text-ink-primary">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop + Responsive Drawer) */}
      <aside
        className={`border-r border-border bg-surface flex flex-col fixed inset-y-0 z-50 select-none transition-all duration-200 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand & Organization Header */}
        <div className={`p-4 border-b border-border flex items-center justify-between ${isCollapsed ? 'px-2' : ''}`}>
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-tight shrink-0 shadow-xs">
              SQ
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="font-semibold text-sm tracking-tight text-ink-primary block leading-none">
                  {APP_NAME}
                </span>
                <span className="text-[10px] text-ink-muted uppercase tracking-wider font-mono">
                  ATS Suite
                </span>
              </div>
            )}
          </Link>

          {/* Collapse Toggle (Desktop) */}
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1.5 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Close Button (Mobile) */}
          <button
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden p-1.5 rounded-md text-ink-muted hover:text-ink-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Organization Card (Expanded Only) */}
        {!isCollapsed && (
          <div className="p-3 border-b border-border bg-surface-subtle/50">
            <div className="bg-surface border border-border rounded-lg p-2.5 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 rounded bg-surface-subtle border border-border flex items-center justify-center shrink-0 text-ink-secondary">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-primary truncate">
                  {organization?.name || 'Workspace'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-shortlist-text" />
                  <span className="text-[10px] text-ink-muted font-medium">Isolated Tenant</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Batch CTA Button */}
        <div className="p-3">
          <Link
            to="/hr/batches/new"
            onClick={() => setIsMobileOpen(false)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
              isCollapsed
                ? 'w-10 h-10 p-0 mx-auto bg-primary text-primary-foreground hover:bg-primary-hover'
                : 'w-full bg-primary text-primary-foreground hover:bg-primary-hover'
            }`}
            title="Create New Batch"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>New Screening Batch</span>}
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/hr/dashboard' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-ink-muted'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-border bg-surface-subtle/50">
          <div className="flex items-center justify-between gap-2">
            {!isCollapsed ? (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-primary truncate">
                  {profile.fullName || 'HR Recruiter'}
                </p>
                <p className="text-[10px] text-ink-muted truncate font-mono">{profile.email}</p>
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-[11px] font-bold text-ink-secondary mx-auto">
                {(profile.fullName?.[0] || profile.email?.[0] || 'U').toUpperCase()}
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign Out"
                className="p-1.5 rounded-md text-ink-muted hover:text-status-danger-text hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
          isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-surface px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-hover"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.href + idx}>
                    {idx > 0 && <span className="text-ink-muted font-normal">/</span>}
                    {isLast ? (
                      <span className="font-semibold text-ink-primary truncate max-w-[200px] sm:max-w-none">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        to={crumb.href}
                        className="text-ink-secondary hover:text-ink-primary transition-colors truncate max-w-[120px] sm:max-w-none"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right Header: Command Search + Status + Profile Menu */}
          <div className="flex items-center gap-3">
            {/* Command Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-ink-secondary bg-surface-muted border border-border rounded-lg hover:border-border-strong hover:bg-surface transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-ink-muted" />
              <span>Search batches, settings...</span>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-muted bg-surface border border-border rounded">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </button>

            {/* Isolated Tenant Badge */}
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-emerald-50 text-status-shortlist-text border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-status-shortlist-text" />
              Isolated Multi-Tenant Node
            </span>

            {/* User Dropdown Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-border hover:bg-surface-hover text-ink-primary transition-colors"
                aria-expanded={isUserMenuOpen}
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                  {(profile.fullName?.[0] || profile.email?.[0] || 'U').toUpperCase()}
                </div>
                <span className="text-xs font-medium hidden sm:inline max-w-[120px] truncate">
                  {profile.fullName || 'Recruiter'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-md py-1.5 z-50 text-xs">
                  <div className="px-3.5 py-2.5 border-b border-border">
                    <p className="font-semibold text-ink-primary truncate">
                      {profile.fullName || 'HR Recruiter'}
                    </p>
                    <p className="text-[11px] text-ink-muted truncate font-mono mt-0.5">
                      {profile.email}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-muted border border-border text-ink-secondary">
                      <Building2 className="w-3 h-3" />
                      {organization?.name || 'Workspace'}
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/hr/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-ink-secondary hover:text-ink-primary hover:bg-surface-hover"
                    >
                      <Settings className="w-3.5 h-3.5 text-ink-muted" />
                      Workspace Settings
                    </Link>
                    <Link
                      to="/checker"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-ink-secondary hover:text-ink-primary hover:bg-surface-hover"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-ink-muted" />
                      Candidate Resume Checker
                    </Link>
                  </div>

                  <div className="border-t border-border pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-status-danger-text hover:bg-red-50"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main ref={mainRef} className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Command Search Modal Dialog */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-950/40 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-ink-muted shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Jump to a page or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent text-ink-primary placeholder:text-ink-muted focus:outline-none"
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions List */}
            <div className="max-h-72 overflow-y-auto p-2 divide-y divide-border/50 text-xs">
              {quickActions.length === 0 ? (
                <div className="p-6 text-center text-ink-muted">
                  No matching workspace actions found.
                </div>
              ) : (
                quickActions.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      setIsSearchOpen(false);
                      navigate(item.path);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-surface-hover transition-colors"
                  >
                    <span className="font-medium text-ink-primary">{item.label}</span>
                    <span className="text-[10px] text-ink-muted font-mono uppercase bg-surface-muted px-2 py-0.5 rounded border border-border">
                      {item.category}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="bg-surface-muted px-4 py-2 border-t border-border flex items-center justify-between text-[11px] text-ink-muted">
              <span>Press <kbd className="font-mono bg-surface px-1 py-0.5 rounded border border-border">ESC</kbd> to exit</span>
              <span>ShortlistIQ Quick Navigator</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
