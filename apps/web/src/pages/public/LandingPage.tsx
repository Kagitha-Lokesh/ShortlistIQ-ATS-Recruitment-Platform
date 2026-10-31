import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  FileText,
  EyeOff,
  Scale,
  Building2,
  ChevronDown,
  HelpCircle,
  FileCheck,
  Search,
  SlidersHorizontal,
  Lock
} from 'lucide-react';
import { APP_NAME } from '@shortlistiq/shared';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card, CardContent } from '../../components/ui/Card.js';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const explainerRef = useRef<HTMLElement>(null);
  const hrSectionRef = useRef<HTMLElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Lazy-load landing motion module so heavy ScrollTrigger code is code-split
  useGSAP(
    () => {
      let cleanupFn: (() => void) | undefined;

      import('./landingMotion.js').then(({ initLandingMotion }) => {
        cleanupFn = initLandingMotion({
          heroElement: heroRef.current,
          explainerElement: explainerRef.current,
          hrSectionElement: hrSectionRef.current
        });
      });

      return () => {
        if (cleanupFn) {
          cleanupFn();
        }
      };
    },
    { scope: heroRef }
  );

  const faqs = [
    {
      q: 'Is this ATS score what actual employers’ software will output?',
      a: 'No single "universal ATS" algorithm exists across employers. ShortlistIQ provides a deterministic estimate of match against this specific job description’s explicit requirements. It identifies extractability issues and missing keyword evidence rather than simulating a proprietary black box.'
    },
    {
      q: 'Can the algorithm reject me automatically?',
      a: 'Never. In ShortlistIQ, automated outcomes are strictly advisory recommendations (Recommended Shortlist, Needs Review, or Recommended Not Shortlisted). Final decisions are made exclusively by human recruiters and hiring managers in the HR review interface.'
    },
    {
      q: 'How is my uploaded resume data protected?',
      a: 'All guest checks and candidate files are automatically purged after 30 days. PII is scrubbed before scoring calculations, and your resume text is never used to train machine learning models. You can also trigger immediate deletion via our self-service portal.'
    },
    {
      q: 'What if my resume uses multi-column or modern layouts?',
      a: 'Our ingestion engine uses 2D positional coordinate extraction. Instead of joining text line-by-line across columns, it reconstructs your resume in its true reading order, preventing column collision errors common in basic parsers.'
    }
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* 1. Restrained Editorial Hero */}
      <section ref={heroRef} className="max-w-4xl mx-auto text-center px-4 pt-12 sm:pt-16">
        <div className="hero-fade inline-flex mb-5">
          <Badge variant="outline" size="md" className="gap-1.5 py-1 px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-semibold text-ink-primary">Deterministic Ingest & Verification</span>
            <span className="text-ink-muted">•</span>
            <span className="text-ink-secondary">Zero Black-Box Guesswork</span>
          </Badge>
        </div>

        <h1 className="hero-fade text-3xl sm:text-5xl font-extrabold tracking-tight text-ink-primary leading-[1.12]">
          Screen resumes accurately with verbatim evidence.
        </h1>

        <p className="hero-fade text-sm sm:text-base text-ink-secondary mt-4 max-w-2xl mx-auto leading-relaxed">
          ShortlistIQ calculates deterministic keyword match estimates against exact job descriptions. No black-box AI rejections, no demographic bias, and 100% extractability verification.
        </p>

        {/* Action Buttons */}
        <div className="hero-fade mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => navigate('/checker')}
          >
            Check ATS Alignment Free (No Signup)
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/auth/signup-hr')}
          >
            HR Recruiter Workspace
          </Button>
        </div>

        <p className="hero-fade text-[11px] text-ink-muted mt-3">
          Scores are honest estimates against specific job criteria • Strict 30-day data retention
        </p>
      </section>

      {/* 2. Three-Step Explainer */}
      <section ref={explainerRef} className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted block">
            How It Works
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary mt-1">
            Three steps from raw PDF to verified ATS alignment
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <Card className="p-6 space-y-3 step-card">
            <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center font-bold text-xs text-ink-primary">
              01
            </div>
            <h3 className="text-sm font-bold text-ink-primary">Positional Document Parsing</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Upload any text-based PDF or DOCX resume. 2D coordinate extraction maps sections, dates, and bullet points without multi-column corruption.
            </p>
          </Card>

          {/* Step 2 */}
          <Card className="p-6 space-y-3 step-card">
            <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center font-bold text-xs text-ink-primary">
              02
            </div>
            <h3 className="text-sm font-bold text-ink-primary">Deterministic Match Scoring</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Every score breakdown is computed across 5 transparent pillars: TF-IDF keywords, required skills, work history, formatting, and education.
            </p>
          </Card>

          {/* Step 3 */}
          <Card className="p-6 space-y-3 step-card">
            <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center font-bold text-xs text-ink-primary">
              03
            </div>
            <h3 className="text-sm font-bold text-ink-primary">Verbatim Optimization & Export</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Review grounded rephrasings with before/after diffs. Export to 100% extractable single-column PDF or compile via LaTeX with zero formatting errors.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. Section for HR Teams */}
      <section ref={hrSectionRef} className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-10 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-surface-subtle border border-border text-ink-secondary">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>For Talent Acquisition & Hiring Teams</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary">
              Data-dense screening without autonomous rejection risk
            </h2>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Bulk upload batches of resumes with instant candidate tables, customizable dealbreaker knockout rules, and a side-by-side evidence inspection drawer. Toggle blind screening to eliminate demographic bias from hiring decisions.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-primary pt-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-state-success flex-shrink-0" />
                <span>Demographic Blind Review mode</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-state-success flex-shrink-0" />
                <span>Verbatim resume evidence side-by-side</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-state-success flex-shrink-0" />
                <span>Mandatory human sign-off audit trail</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-state-success flex-shrink-0" />
                <span>Multi-tenant database privacy</span>
              </li>
            </ul>
          </div>

          <div className="flex-shrink-0 text-center space-y-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/auth/signup-hr')}
            >
              Create Recruiter Account
            </Button>
            <p className="text-[11px] text-ink-muted">
              Free tier includes full batch screening & criteria setup
            </p>
          </div>
        </div>
      </section>

      {/* 4. Privacy & Data Rights Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-lg border border-border bg-surface-subtle/50 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-state-success" />
                <h2 className="text-base font-bold text-ink-primary">
                  Candidate Data Protection & Privacy Rights
                </h2>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Engineered to honor applicant dignity and international privacy regulations (GDPR, CCPA).
              </p>
            </div>

            <Link to="/privacy/delete-data">
              <Button variant="outline" size="sm" leftIcon={<Lock className="w-3.5 h-3.5" />}>
                Candidate Right to Erasure Portal
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-ink-secondary">
            <div className="space-y-1">
              <h3 className="font-semibold text-ink-primary">30-Day Automated Lifecycle</h3>
              <p className="leading-relaxed">
                Guest candidate checks and uploaded resume documents expire automatically after 30 days and are permanently purged from disk and database.
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-ink-primary">Pre-Scoring PII Stripping</h3>
              <p className="leading-relaxed">
                Candidate names, emails, phone numbers, postal addresses, and photos are stripped before algorithmic matching to prevent algorithmic discrimination.
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-ink-primary">Instant Self-Service Erasure</h3>
              <p className="leading-relaxed">
                Candidates can verify their email address and purge all historical applications, scores, and files across all hiring organizations anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Frequently Asked Questions */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
        <div className="text-center mb-6">
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted block">
            Got Questions?
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary mt-1">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-md border border-border bg-surface transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-semibold text-ink-primary hover:text-primary select-none"
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${
                      isOpen ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-ink-secondary leading-relaxed border-t border-border/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-border pt-10 text-xs text-ink-muted">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary text-white font-bold text-[10px] flex items-center justify-center">
              SQ
            </div>
            <span className="font-semibold text-ink-primary">{APP_NAME}</span>
            <span className="text-border-strong">•</span>
            <span>Deterministic ATS Resume Screening</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-ink-secondary">
            <Link to="/checker" className="hover:text-ink-primary transition-colors">
              Candidate Checker
            </Link>
            <Link to="/auth/signin" className="hover:text-ink-primary transition-colors">
              HR Sign In
            </Link>
            <Link to="/privacy/delete-data" className="hover:text-ink-primary transition-colors">
              Data Erasure
            </Link>
            <Link to="/privacy" className="hover:text-ink-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-ink-primary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
