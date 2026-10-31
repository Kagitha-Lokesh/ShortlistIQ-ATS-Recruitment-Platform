import React, { useState, useEffect } from 'react';
import { shortlistApi } from '../../lib/api.js';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Sparkles,
  ExternalLink,
  Save,
  Check,
  UserCheck,
  UserX,
  Loader2
} from 'lucide-react';

interface CandidateDrawerProps {
  batchId: string;
  candidate: any | null;
  isOpen: boolean;
  onClose: () => void;
  onDecisionUpdated: (candidateId: string, decision: 'shortlisted' | 'unshortlisted') => void;
  isBatchFinalized?: boolean;
}

export const CandidateDrawer: React.FC<CandidateDrawerProps> = ({
  batchId,
  candidate,
  isOpen,
  onClose,
  onDecisionUpdated,
  isBatchFinalized = false
}) => {
  const [activeTab, setActiveTab] = useState<'evaluation' | 'resume' | 'notes'>('evaluation');
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);

  useEffect(() => {
    if (candidate) {
      setNotes(candidate.formAnswers?.notes || '');
      setSignedPdfUrl(null);
      if (candidate.resumePath) {
        fetchSignedPdfUrl();
      }
    }
  }, [candidate]);

  const fetchSignedPdfUrl = async () => {
    if (!candidate?.id) return;
    try {
      setIsLoadingPdf(true);
      const url = await shortlistApi.getResumePdfUrl(batchId, candidate.id);
      setSignedPdfUrl(url);
    } catch (err) {
      // Ignored
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleDecision = async (decision: 'shortlisted' | 'unshortlisted') => {
    if (!candidate) return;
    try {
      setIsUpdatingDecision(true);
      await shortlistApi.bulkUpdateDecisions(batchId, [candidate.id], decision);
      onDecisionUpdated(candidate.id, decision);
    } finally {
      setIsUpdatingDecision(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!candidate) return;
    try {
      setIsSavingNotes(true);
      await shortlistApi.updateCandidate(batchId, candidate.id, { notes });
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (!isOpen || !candidate) return null;

  const score = candidate.score ?? 0;
  const breakdown = candidate.breakdown || {};
  const criteriaResults: any[] = Array.isArray(candidate.criteriaResults)
    ? candidate.criteriaResults
    : [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-border bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-primary">{candidate.fullName}</h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  candidate.decision === 'shortlisted'
                    ? 'bg-emerald-100 text-state-success'
                    : candidate.decision === 'needs_review'
                    ? 'bg-amber-100 text-state-warning'
                    : candidate.decision === 'unshortlisted'
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {candidate.decision || 'Pending'}
              </span>
              {candidate.decisionSource === 'manual' && (
                <span className="text-[10px] bg-indigo-100 text-brand-indigo px-1.5 py-0.5 rounded font-semibold">
                  Manual Override
                </span>
              )}
            </div>
            <p className="text-xs text-slate-secondary mt-1">
              {candidate.email || 'No email on file'} {candidate.phone && `• ${candidate.phone}`}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-border px-5 bg-white text-xs font-semibold">
          {[
            { id: 'evaluation', label: 'Evaluation & Criteria' },
            { id: 'resume', label: 'PDF Resume' },
            { id: 'notes', label: 'HR Notes' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`py-3 px-4 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-brand-indigo text-brand-indigo font-bold'
                  : 'border-transparent text-slate-secondary hover:text-slate-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {activeTab === 'evaluation' && (
            <div className="space-y-6">
              {/* Score Ring & Breakdown Grid */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-center gap-6">
                {/* Score Circle */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke="#e2e8f0"
                        strokeWidth="7"
                        fill="none"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke={score >= 70 ? '#15803D' : score >= 65 ? '#B45309' : '#475569'}
                        strokeWidth="7"
                        strokeDasharray={213}
                        strokeDashoffset={213 - (213 * score) / 100}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span className="absolute text-xl font-bold text-slate-primary">{score}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase mt-1">
                    ATS Score
                  </span>
                </div>

                {/* 5 Component Breakdown Bars */}
                <div className="flex-1 w-full space-y-2">
                  {[
                    { label: 'Keywords Match', val: breakdown.keywordScore ?? score },
                    { label: 'Technical Skills', val: breakdown.skillsScore ?? score },
                    { label: 'Experience Relevance', val: breakdown.experienceScore ?? score },
                    { label: 'Resume Formatting', val: breakdown.formattingScore ?? 85 },
                    { label: 'Readability', val: breakdown.readabilityScore ?? 90 }
                  ].map(({ label, val }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-secondary">{label}</span>
                        <span className="font-semibold text-slate-primary">{val}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-indigo h-full rounded-full"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Strengths & Gaps Summary */}
              {candidate.aiSummary && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-lg space-y-2">
                  <div className="font-semibold text-slate-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-indigo" />
                    AI Strengths & Gaps Analysis
                  </div>
                  <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed font-sans">
                    {candidate.aiSummary.split('\n').map((line: string, i: number) => (
                      <p key={i} className="flex items-start gap-1.5">
                        <span className="text-brand-indigo font-bold">•</span>
                        <span>{line.replace(/^([•\-*]|\d+\.)\s*/, '')}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Criteria Checklist with Evidence Snippets */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-primary">
                  Criteria Checklist & Resume Evidence ({criteriaResults.length})
                </h3>

                {criteriaResults.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-slate-400 text-center">
                    No custom criteria evaluated yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criteriaResults.map((cr, idx) => (
                      <div
                        key={cr.criterionId || idx}
                        className={`p-3 rounded-lg border text-xs space-y-2 ${
                          cr.passed
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-red-50/40 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            {cr.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-state-success shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-state-danger shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="font-semibold text-slate-primary block">
                                {cr.label}
                              </span>
                              <span className="text-[11px] text-slate-secondary">
                                {cr.reason}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                              cr.type === 'dealbreaker'
                                ? 'bg-red-100 text-state-danger'
                                : cr.type === 'must-have' || cr.type === 'must_have'
                                ? 'bg-indigo-100 text-brand-indigo'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {cr.type}
                          </span>
                        </div>

                        {/* Evidence Snippet */}
                        {cr.evidenceSnippet && (
                          <div className="pl-6 pt-1 text-[11px] text-slate-600 border-l-2 border-slate-300 ml-2 italic">
                            "{cr.evidenceSnippet}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resume PDF Tab */}
          {activeTab === 'resume' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-primary">
                  Original Text-Based Resume
                </span>
                {signedPdfUrl && (
                  <a
                    href={signedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-indigo hover:underline font-semibold"
                  >
                    Open in New Window
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {isLoadingPdf ? (
                <div className="p-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-indigo" />
                  Generating secure signed preview URL...
                </div>
              ) : signedPdfUrl ? (
                <iframe
                  src={signedPdfUrl}
                  title="Candidate Resume"
                  className="w-full h-[550px] border border-slate-200 rounded-lg shadow-inner"
                />
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-300 rounded text-slate-400">
                  No preview available.
                </div>
              )}
            </div>
          )}

          {/* HR Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="font-semibold text-slate-primary block mb-1">
                  Internal Candidate Notes
                </label>
                <textarea
                  rows={8}
                  placeholder="Type interview notes, assessment observations, or referral notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSavingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Notes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-slate-border bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {isBatchFinalized
              ? 'Batch is finalized. Candidate decisions are permanently locked.'
              : 'Manual overrides are logged to organization audit trail.'}
          </div>

          <div className="flex items-center gap-2">
            {isBatchFinalized ? (
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
                Decisions Locked
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleDecision('unshortlisted')}
                  disabled={isUpdatingDecision}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <UserX className="w-3.5 h-3.5 text-state-danger" />
                  Unshortlist
                </button>

                <button
                  type="button"
                  onClick={() => handleDecision('shortlisted')}
                  disabled={isUpdatingDecision}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded text-white bg-state-success hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Shortlist Candidate
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

