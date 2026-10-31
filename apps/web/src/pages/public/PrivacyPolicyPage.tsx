import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Trash2, Clock, CheckCircle2, FileText } from 'lucide-react';
import { APP_NAME } from '@shortlistiq/shared';

export const PrivacyPolicyPage: React.FC = () => {
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
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-primary">Privacy Policy & Data Lifecycle</h1>
              <p className="text-xs text-slate-secondary">Effective Date: October 31, 2026 • Version 2.0</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
            At {APP_NAME}, we hold candidate and recruiter privacy as foundational tenets of our recruitment automation architecture. This policy outlines how candidate resumes, evaluations, and organizational communications are processed, retained, and automatically purged.
          </p>
        </div>

        {/* Policy Sections */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm space-y-8 text-xs text-slate-700 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-indigo" />
              1. Automated Data Retention & Expiration Policy
            </h2>
            <p>
              Unlike legacy ATS systems that archive resumes indefinitely, {APP_NAME} enforces deterministic data expiration policies:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>
                <strong>Guest ATS Checks:</strong> Pre-screening checks and uploaded resumes by guest candidates automatically expire and are purged after <strong>7 days</strong>.
              </li>
              <li>
                <strong>Hiring Organization Batches:</strong> Candidate application records and uploaded resumes expire according to the hiring organization's designated retention policy (<strong>30, 60, or 90 days</strong>; default 60 days).
              </li>
              <li>
                <strong>Daily Purge Engine:</strong> A scheduled daily automated lifecycle job purges expired database records and completely deletes associated storage files from encrypted buckets in small, verified batches.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-state-danger" />
              2. Candidate Right to Erasure (Self-Service Deletion)
            </h2>
            <p>
              Under global privacy regulations including GDPR and CCPA, candidates maintain the absolute right to have their personal data erased at any time:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>
                Candidates can visit our self-service <Link to="/privacy/delete-data" className="text-brand-indigo underline font-medium">Data Deletion Portal</Link>, enter their email, verify a 6-digit confirmation code, and execute instantaneous deletion across every hiring organization on the platform.
              </li>
              <li>
                Signed-in candidates can delete individual ATS pre-screen checks or delete all profile and application records directly with one click.
              </li>
              <li>
                Affected hiring organizations are notified via anonymous compliance audit logs (confirming a record was removed upon verified request, without disclosing personal information).
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-state-success" />
              3. Multi-Tenant Isolation & Zero Personal Data in Logs
            </h2>
            <p>
              Our infrastructure employs strict multi-tenancy controls ensuring organizational data is never intermingled or exposed across companies:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>
                <strong>Encrypted Credentials:</strong> OAuth tokens for Gmail and Microsoft Outlook are encrypted at rest using AES-256-GCM and never sent to browser clients.
              </li>
              <li>
                <strong>Log Sanitization:</strong> Our operational logs and audit logs strictly exclude raw resume text, candidate phone numbers, and unmasked email addresses.
              </li>
              <li>
                <strong>No Third-Party AI Training:</strong> Candidate resume texts are never utilized to train public foundation models. LLM evaluations use ephemeral inferences with zero data retention.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-primary flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              4. Contact Our Data Protection Team
            </h2>
            <p>
              If you have any questions or concerns regarding our privacy practices or automated data retention mechanisms, please contact our Data Protection Team at <span className="font-mono text-brand-indigo font-semibold">privacy@shortlistiq.com</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

