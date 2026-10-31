import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Cpu, FileText } from 'lucide-react';
import { APP_NAME } from '@shortlistiq/shared';

export const LandingPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-indigo-50 text-brand-indigo border border-indigo-100 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-indigo"></span>
          Deterministic ATS Screening & Privacy-First HR SaaS
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-primary mb-5 sm:text-5xl leading-tight">
          Screen resumes accurately with zero hallucination.
        </h1>

        <p className="text-base text-slate-secondary mb-8 leading-relaxed max-w-2xl mx-auto">
          ShortlistIQ uses deterministic local engine scoring for reliable, repeatable qualification. The LLM is restricted to suggestions and cached summaries. No dark mode, no gimmicks, no data leaks.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/checker"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
          >
            Try Free ATS Checker (No Signup)
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/auth/signup-hr"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded text-slate-primary bg-white border border-slate-border hover:bg-slate-50 transition-colors shadow-soft"
          >
            For Recruiters & HR
          </Link>
        </div>
      </section>

      {/* 3 Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-card border border-slate-border rounded-lg p-6 shadow-soft">
          <div className="w-9 h-9 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-indigo mb-4">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-primary mb-2">100% Deterministic Engine</h2>
          <p className="text-xs text-slate-secondary leading-relaxed">
            Scoring runs strictly in framework-free packages/engine with verified keyword and experience matching.
          </p>
        </div>

        <div className="bg-card border border-slate-border rounded-lg p-6 shadow-soft">
          <div className="w-9 h-9 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-state-success mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-primary mb-2">Strict Multi-Tenancy</h2>
          <p className="text-xs text-slate-secondary leading-relaxed">
            Every HR resource carries organization isolation at the database, repository, and middleware layers.
          </p>
        </div>

        <div className="bg-card border border-slate-border rounded-lg p-6 shadow-soft">
          <div className="w-9 h-9 rounded bg-amber-50 border border-amber-100 flex items-center justify-center text-state-warning mb-4">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-primary mb-2">Text-Based PDF Standard</h2>
          <p className="text-xs text-slate-secondary leading-relaxed">
            Image-only scans and corrupted PDFs are caught immediately with clear instructions for candidates to re-submit.
          </p>
        </div>
      </section>

      {/* Rules & Privacy Card */}
      <section className="bg-card border border-slate-border rounded-lg p-8 shadow-soft">
        <h2 className="text-lg font-bold text-slate-primary mb-4">Strict SaaS Commitments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-secondary">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
            <span>
              <Link to="/privacy/delete-data" className="text-brand-indigo underline font-semibold">
                Candidate Right to Erasure
              </Link>{' '}
              and automated data retention lifecycle supported.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
            <span>Zero personal data or resume text logged into server logs.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
            <span>Rate limiting enforced on all endpoints per IP and authenticated user.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-state-success flex-shrink-0 mt-0.5" />
            <span>WCAG AA compliant interface with calm, professional light palette.</span>
          </div>
        </div>
      </section>
    </div>
  );
};

