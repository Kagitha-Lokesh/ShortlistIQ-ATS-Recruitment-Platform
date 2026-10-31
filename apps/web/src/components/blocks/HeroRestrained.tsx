import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button.js';
import { ShieldCheck, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface HeroRestrainedProps {
  headline?: string;
  subheadline?: string;
  candidateCtaText?: string;
  hrCtaText?: string;
  className?: string;
}

export const HeroRestrained: React.FC<HeroRestrainedProps> = ({
  headline = 'High-Stakes Resume Screening Rooted in Verbatim Evidence',
  subheadline = 'ShortlistIQ eliminates algorithmic black-box bias. Every score is a deterministic estimate verified with exact resume quotes and line-by-line job requirements.',
  candidateCtaText = 'Check My Resume for Free',
  hrCtaText = 'HR Organization Access',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!containerRef.current) return;

    gsap.fromTo(
      containerRef.current.querySelectorAll('.hero-fade'),
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        stagger: 0.08,
        ease: 'power2.out'
      }
    );
  }, { scope: containerRef });

  return (
    <section
      ref={containerRef}
      className={`py-12 sm:py-20 max-w-4xl mx-auto text-center px-4 ${className}`}
    >
      {/* Transparency Pill */}
      <div className="hero-fade inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-50 rounded-full border border-emerald-200 mb-6 shadow-subtle">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
        <span>100% Deterministic Match Estimates • No Autonomous Rejections</span>
      </div>

      {/* Main Headline */}
      <h1 className="hero-fade text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink-primary leading-[1.15]">
        {headline}
      </h1>

      {/* Subheadline */}
      <p className="hero-fade text-sm sm:text-base text-ink-secondary mt-4 max-w-2xl mx-auto leading-relaxed">
        {subheadline}
      </p>

      {/* Dual CTA */}
      <div className="hero-fade mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/checker">
          <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
            {candidateCtaText}
          </Button>
        </Link>
        <Link to="/auth/signin">
          <Button variant="outline" size="lg">
            {hrCtaText}
          </Button>
        </Link>
      </div>

      {/* Trust Signifiers */}
      <div className="hero-fade mt-10 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-ink-primary block">Verbatim Evidence</span>
            <span className="text-ink-muted">Exact resume snippets mapped to exact JD requirements.</span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-ink-primary block">Human Decision Gate</span>
            <span className="text-ink-muted">No candidate is rejected automatically without HR confirmation.</span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-ink-primary block">Blind Screening Guard</span>
            <span className="text-ink-muted">Protected attributes stripped before algorithmic matching.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
