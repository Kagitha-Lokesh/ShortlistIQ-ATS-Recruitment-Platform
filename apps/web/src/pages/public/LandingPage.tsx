import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Cpu, FileText, Scale, EyeOff } from 'lucide-react';
import { APP_NAME } from '@shortlistiq/shared';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    if (heroRef.current) {
      tl.fromTo(
        heroRef.current.children,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }
      );
    }

    if (cardsRef.current) {
      tl.fromTo(
        cardsRef.current.children,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.06 },
        '-=0.2'
      );
    }
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">
      {/* Editorial Hero Section */}
      <section ref={heroRef} className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex">
          <Badge variant="outline" size="md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-700"></span>
            Transparent Recruitment Screening & ATS Alignment
          </Badge>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink-primary leading-tight">
          Screen resumes accurately with zero hallucination.
        </h1>

        <p className="text-sm sm:text-base text-ink-secondary leading-relaxed max-w-2xl mx-auto">
          ShortlistIQ evaluates candidate resumes with deterministic parsing, verbatim evidence citations, and strict demographic blindness. Designed for high-stakes hiring where people's livelihoods are on the line.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => navigate('/checker')}
          >
            Try Free ATS Checker (No Signup)
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/auth/signup-hr')}
          >
            For Recruiters & Hiring Teams
          </Button>
        </div>
      </section>

      {/* 3 Core Ethical & Accuracy Pillars */}
      <section ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface border border-border rounded-md p-5 shadow-subtle space-y-2">
          <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center text-ink-primary">
            <Cpu className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink-primary">Deterministic Ingest & Matching</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            2D coordinate layout reconstruction rebuilds multi-column resumes without line interleaving. Matches are backed by exact verbatim snippets.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-md p-5 shadow-subtle space-y-2">
          <div className="w-8 h-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
            <EyeOff className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink-primary">Strict Demographic Blindness</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Name, gender, contact info, photo, and institution prestige are stripped prior to scoring. Recruiter blind-mode prevents unconscious bias.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-md p-5 shadow-subtle space-y-2">
          <div className="w-8 h-8 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
            <Scale className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink-primary">Zero Automated Rejections</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            No candidate is ever rejected by the machine alone. Outcomes are advisory: recommended shortlist, recommended not shortlisted, or routed to human review.
          </p>
        </div>
      </section>

      {/* High-Trust Commitments Card */}
      <section className="bg-surface border border-border rounded-md p-6 sm:p-8 shadow-subtle space-y-4">
        <div>
          <h2 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
            High-Stakes Screening Commitments
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Engineered to prioritize human oversight, data privacy, and explainable recruitment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-secondary pt-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success shrink-0 mt-0.5" />
            <span>
              <Link to="/privacy/delete-data" className="text-ink-primary underline font-semibold hover:text-brand-accent">
                Candidate Right to Erasure
              </Link>{' '}
              and 30-day automated data retention lifecycle.
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success shrink-0 mt-0.5" />
            <span>Zero personal candidate data or resume text logged to server metrics.</span>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success shrink-0 mt-0.5" />
            <span>Multi-tenant organization data isolation enforced at Postgres database layer.</span>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success shrink-0 mt-0.5" />
            <span>WCAG 2.1 AA accessible, calm light theme without dark mode or visual distractions.</span>
          </div>
        </div>
      </section>
    </div>
  );
};
