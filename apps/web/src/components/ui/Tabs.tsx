import React, { createContext, useContext, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { isReducedMotion, MOTION_DURATIONS, MOTION_EASES } from '../../lib/motion.js';

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className = '' }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className = '' }) => {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 border-b border-border w-full ${className}`}
    >
      {children}
    </div>
  );
};

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className = '',
  icon
}) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs');

  const isSelected = ctx.value === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isSelected}
      onClick={() => ctx.onValueChange(value)}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors select-none ${
        isSelected
          ? 'border-primary text-ink-primary font-semibold'
          : 'border-transparent text-ink-muted hover:text-ink-primary hover:border-border'
      } ${className}`}
    >
      {icon}
      {children}
    </button>
  );
};

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className = '' }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsContent must be used within Tabs');

  const contentRef = useRef<HTMLDivElement>(null);
  const isSelected = ctx.value === value;

  useGSAP(
    () => {
      if (!isSelected || !contentRef.current || isReducedMotion()) return;

      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 4 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION_DURATIONS.standard,
          ease: MOTION_EASES.standard,
          clearProps: 'transform'
        }
      );
    },
    { dependencies: [isSelected], scope: contentRef }
  );

  if (!isSelected) return null;

  return (
    <div ref={contentRef} role="tabpanel" className={`pt-4 ${className}`}>
      {children}
    </div>
  );
};

