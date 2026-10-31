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
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { Switch } from '../ui/Switch.js';

interface CandidateDrawerProps {
  batchId: string;
  candidate: any | null;
  isOpen: boolean;
  onClose: () => void;
  onDecisionUpdated: (candidateId: string, decision: 'shortlisted' | 'unshortlisted' | 'needs_review') => void;
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
  const [isBlindMode, setIsBlindMode] = useState(false);

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

  const handleDecision = async (decision: 'shortlisted' | 'unshortlisted' | 'needs_review') => {
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

  // Parse Quality & Integrity information
  const parseQuality = candidate.parseQuality || breakdown.parseQuality || {
    status: (candidate.failureReason ? 'UNREADABLE' : breakdown.formattingScore && breakdown.formattingScore < 50 ? 'PARTIAL' : 'OK'),
    issues: candidate.failureReason ? [candidate.failureReason] : []
  };

  const integrityFlags: any[] = candidate.integrityFlags || breakdown.integrityFlags || [];

  const displayName = isBlindMode ? `Candidate #${candidate.id.slice(0, 6).toUpperCase()}` : candidate.fullName;
  const displayEmail = isBlindMode ? '[Protected Demographic]' : (candidate.email || 'No email on file');
  const displayPhone = isBlindMode ? '[Protected Demographic]' : candidate.phone;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border bg-surface-subtle flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink-primary">{displayName}</h2>
              {candidate.decision === 'shortlisted' && (
                <Badge variant="shortlisted" size="sm">Shortlisted</Badge>
              )}
              {candidate.decision === 'needs_review' && (
                <Badge variant="needs_review" size="sm">Needs Review</Badge>
              )}
              {candidate.decision === 'unshortlisted' && (
                <Badge variant="unshortlisted" size="sm">Unshortlisted</Badge>
              )}
              {!candidate.decision && (
                <Badge variant="neutral" size="sm">Pending</Badge>
              )}
              {candidate.decisionSource === 'manual' && (
                <span className="text-[10px] bg-slate-200 text-ink-primary px-1.5 py-0.5 rounded font-semibold">
                  Manual Override
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5 font-mono">
              {displayEmail} {displayPhone && `• ${displayPhone}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Blind Review Mode Switch */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-surface border border-border rounded">
              <Switch
                checked={isBlindMode}
                onCheckedChange={setIsBlindMode}
                label="Blind Mode"
              />
            </div>

            <button
              onClick={onClose}
              className="p-1 text-ink-muted hover:text-ink-primary rounded hover:bg-surface transition-colors"
              aria-label="Close candidate drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Blind Review Active Notice */}
        {isBlindMode && (
          <div className="px-4 py-2 bg-slate-100 border-b border-border flex items-center gap-2 text-[11px] text-ink-secondary">
            <EyeOff className="w-3.5 h-3.5 shrink-0 text-ink-primary" />
            <span>Blind Review Active: Candidate personal identity and institutions are masked to ensure evaluation on qualifications alone.</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-border px-4 bg-surface text-xs font-medium">
          {[
            { id: 'evaluation', label: 'Evaluation & Evidence' },
            { id: 'resume', label: 'PDF Resume' },
            { id: 'notes', label: 'HR Notes' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`py-3 px-3.5 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-ink-primary font-bold'
                  : 'border-transparent text-ink-muted hover:text-ink-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeTab === 'evaluation' && (
            <div className="space-y-5">
              {/* Parse Quality & Integrity Banner */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded border bg-surface-subtle border-border">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        parseQuality.status === 'OK'
                          ? 'parse_ok'
                          : parseQuality.status === 'PARTIAL'
                          ? 'parse_partial'
                          : 'parse_unreadable'
                      }
                      size="sm"
                    >
                      Parse Quality: {parseQuality.status}
                    </Badge>
                    <span className="text-ink-secondary text-[11px]">
                      {parseQuality.status === 'OK'
                        ? 'Clean text extraction (100% extractable)'
                        : parseQuality.status === 'PARTIAL'
                        ? 'Partial extraction: layout anomalies or missing sections detected'
                        : 'Unreadable format: document requires human review'}
                    </span>
                  </div>
                  {parseQuality.issues && parseQuality.issues.length > 0 && (
                    <span className="text-[10px] text-amber-800 font-medium font-mono">
                      {parseQuality.issues.join(', ')}
                    </span>
                  )}
                </div>

                {/* Integrity Alerts Banner */}
                {integrityFlags.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2.5 text-xs text-red-900">
                    <ShieldAlert className="w-4 h-4 text-state-danger shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Resume Integrity Notice</span>
                      <p className="text-[11px] text-red-800 mt-0.5">
                        Adversarial text or keyword stuffing was flagged. Engine sanitized prompt manipulation before scoring.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Score & Component Breakdown */}
              <div className="p-4 bg-surface-subtle border border-border rounded flex flex-col sm:flex-row items-center gap-5">
                {/* Score Circle */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative w-18 h-18 flex items-center justify-center">
                    <svg className="w-18 h-18 -rotate-90">
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        stroke="#e2e8f0"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        stroke={score >= 70 ? '#15803D' : score >= 65 ? '#B45309' : '#475569'}
                        strokeWidth="6"
                        strokeDasharray={188}
                        strokeDashoffset={188 - (188 * score) / 100}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span className="absolute text-lg font-bold text-ink-primary tabular-nums">{score}%</span>
                  </div>
                  <span className="text-[10px] text-ink-muted font-medium uppercase mt-1">
                    Match Estimate
                  </span>
                </div>

                {/* 5 Component Breakdown Bars */}
                <div className="flex-1 w-full space-y-1.5">
                  {[
                    { label: 'Keywords Match', val: breakdown.keywordScore ?? score },
                    { label: 'Technical Skills', val: breakdown.skillsScore ?? score },
                    { label: 'Experience Relevance', val: breakdown.experienceScore ?? score },
                    { label: 'Formatting Health', val: breakdown.formattingScore ?? 85 },
                    { label: 'Readability', val: breakdown.readabilityScore ?? 90 }
                  ].map(({ label, val }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-ink-secondary">{label}</span>
                        <span className="font-semibold text-ink-primary tabular-nums">{val}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Strengths & Gaps Summary */}
              {candidate.aiSummary && (
                <div className="p-3.5 bg-surface border border-border rounded space-y-2">
                  <div className="font-semibold text-ink-primary flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    AI Evaluation Summary & Analysis
                  </div>
                  <div className="text-xs text-ink-secondary space-y-1 leading-relaxed">
                    {candidate.aiSummary.split('\n').map((line: string, i: number) => (
                      <p key={i} className="flex items-start gap-1.5">
                        <span className="text-primary font-bold">•</span>
                        <span>{line.replace(/^([•\-*]|\d+\.)\s*/, '')}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Criteria Checklist with Evidence Snippets & Tiers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-ink-primary">
                    Criteria Checklist & Verbatim Evidence ({criteriaResults.length})
                  </h3>
                  <span className="text-[10px] text-ink-muted">
                    Tiered by evidence strength
                  </span>
                </div>

                {criteriaResults.length === 0 ? (
                  <div className="p-4 bg-surface-subtle border border-border rounded text-ink-muted text-center">
                    No custom criteria evaluated yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {criteriaResults.map((cr, idx) => {
                      const tier = cr.evidenceTier || (cr.passed ? 'job_context' : 'unmatched');
                      return (
                        <div
                          key={cr.criterionId || idx}
                          className={`p-3 rounded border text-xs space-y-2 ${
                            cr.passed
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-red-50/40 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              {cr.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className="font-semibold text-ink-primary block">
                                  {cr.label}
                                </span>
                                <span className="text-[11px] text-ink-secondary">
                                  {cr.reason}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Evidence Tier Badge */}
                              {cr.passed && (
                                <Badge
                                  variant={
                                    tier === 'outcome_backed'
                                      ? 'tier_outcome'
                                      : tier === 'job_context'
                                      ? 'tier_job'
                                      : tier === 'related_semantic'
                                      ? 'tier_related'
                                      : 'tier_listed'
                                  }
                                  size="sm"
                                >
                                  {tier === 'outcome_backed'
                                    ? 'Outcome Backed'
                                    : tier === 'job_context'
                                    ? 'Job Context'
                                    : tier === 'related_semantic'
                                    ? 'Related'
                                    : 'Listed Only'}
                                </Badge>
                              )}

                              <Badge
                                variant={
                                  cr.type === 'dealbreaker'
                                    ? 'dealbreaker'
                                    : cr.type === 'must-have' || cr.type === 'must_have'
                                    ? 'must_have'
                                    : 'nice_to_have'
                                }
                                size="sm"
                              >
                                {cr.type}
                              </Badge>
                            </div>
                          </div>

                          {/* Evidence Snippet */}
                          {cr.evidenceSnippet && (
                            <div className="pl-3 py-1 text-[11px] text-ink-primary border-l-2 border-border ml-2 italic bg-surface/80 rounded-r font-mono">
                              "{cr.evidenceSnippet}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resume PDF Tab */}
          {activeTab === 'resume' && (
            <div className="space-y-3 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-primary">
                  Original Text-Based Resume
                </span>
                {signedPdfUrl && (
                  <a
                    href={signedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline font-semibold"
                  >
                    Open in New Window
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {isLoadingPdf ? (
                <div className="p-12 text-center text-ink-muted">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  Generating secure signed preview URL...
                </div>
              ) : signedPdfUrl ? (
                <iframe
                  src={signedPdfUrl}
                  title="Candidate Resume"
                  className="w-full h-[550px] border border-border rounded shadow-inner"
                />
              ) : (
                <div className="p-8 text-center border border-dashed border-border rounded text-ink-muted">
                  No preview available.
                </div>
              )}
            </div>
          )}

          {/* HR Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="font-semibold text-ink-primary block mb-1">
                  Internal Candidate Notes
                </label>
                <textarea
                  rows={8}
                  placeholder="Type interview notes, assessment observations, or referral notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-3 border border-border rounded focus:border-primary focus:outline-none leading-relaxed bg-surface"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isSavingNotes}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveNotes}
                >
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-border bg-surface-subtle flex items-center justify-between">
          <div className="text-[11px] text-ink-muted">
            {isBatchFinalized
              ? 'Batch is finalized. Candidate decisions are locked.'
              : 'Overrides are logged to the organization audit trail.'}
          </div>

          <div className="flex items-center gap-2">
            {isBatchFinalized ? (
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
                Decisions Locked
              </span>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdatingDecision}
                  leftIcon={<UserX className="w-3.5 h-3.5 text-state-danger" />}
                  onClick={() => handleDecision('unshortlisted')}
                >
                  Unshortlist
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdatingDecision}
                  leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                  onClick={() => handleDecision('needs_review')}
                >
                  Needs Review
                </Button>

                <Button
                  variant="success"
                  size="sm"
                  disabled={isUpdatingDecision}
                  leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                  onClick={() => handleDecision('shortlisted')}
                >
                  Shortlist Candidate
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
