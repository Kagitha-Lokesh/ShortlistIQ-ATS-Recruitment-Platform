import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_NAME } from '@shortlistiq/shared';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export interface AppNavbarProps {
  navItems?: NavItem[];
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  navItems = [],
  actions,
  breadcrumbs,
  className = ''
}) => {
  const location = useLocation();

  return (
    <header className={`border-b border-border bg-surface sticky top-0 z-30 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-tight">
              SQ
            </div>
            <span className="font-semibold text-sm tracking-tight text-ink-primary hidden sm:inline">
              {APP_NAME}
            </span>
          </Link>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink-muted truncate">
              <span className="text-border-strong">/</span>
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-border-strong">/</span>}
                  {b.href ? (
                    <Link to={b.href} className="hover:text-ink-primary truncate transition-colors">
                      {b.label}
                    </Link>
                  ) : (
                    <span className="text-ink-primary font-medium truncate">{b.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {/* Center / Nav Items */}
        {navItems.length > 0 && (
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    isActive
                      ? 'bg-surface-subtle text-ink-primary font-semibold'
                      : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Action Slot */}
        {actions && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

