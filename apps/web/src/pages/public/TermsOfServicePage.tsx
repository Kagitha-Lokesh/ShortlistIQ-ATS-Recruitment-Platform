import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, ShieldCheck, Scale, AlertCircle } from 'lucide-react';
import { APP_NAME } from '@shortlistiq/shared';

export const TermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-indigo transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {APP_NAME}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-indigo">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-primary">Terms of Service</h1>
              <p className="text-xs text-slate-secondary">Last updated: October 31, 2026</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
            Welcome to {APP_NAME}. By accessing or using our recruitment platform, ATS scoring engine, public application forms, and applicant management workflows, you agree to comply with and be bound by the following terms.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm space-y-8 text-xs text-slate-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary">1. Permitted Use of the Platform</h2>
            <p>
              {APP_NAME} provides hiring teams and job seekers with deterministic resume parsing, rubric evaluation, and recruitment communication workflows. You agree not to upload malicious files, scrape applicant databases, or attempt to circumvent multi-tenant access controls.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary">2. Candidate Rights & Privacy</h2>
            <p>
              Candidate resumes submitted through {APP_NAME} are subject to strict automated retention policies and may be erased at any time through our <Link to="/privacy/delete-data" className="text-brand-indigo underline font-medium">Data Deletion Portal</Link>. Recruiters must comply with local employment non-discrimination regulations when defining screening criteria and knockout rules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary">3. Automated Screening Disclaimers</h2>
            <p>
              While {APP_NAME} produces deterministic keyword and experience matching scores, final hiring decisions rest solely with human hiring managers and organizational recruiters. Our platform does not make autonomous employment determinations without human oversight.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary">4. Service Availability & Rate Limits</h2>
            <p>
              We enforce fair-usage rate limits and email dispatch throttling (~1 message per 2 seconds) to preserve third-party provider deliverability and system stability.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

