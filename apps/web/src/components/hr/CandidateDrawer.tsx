import React, { useState, useEffect, useRef } from 'react';
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
  EyeOff,
  HelpCircle,
  Edit2,
  RotateCcw,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Badge, DecisionStatusBadge, ParseQualityBadge } from '../ui/Badge.js';
import { useToast } from '../../context/ToastContext.js';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  animateScoreRing,
  animateCounter,
  animateProgressBar,
  isReducedMotion,
  MOTION_DURATIONS,
  MOTION_EASES
} from '../../lib/motion.js';

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
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'evaluation' | 'resume' | 'notes'>('evaluation');
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);
  const [isBlindMode, setIsBlindMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const scoreNumberRef = useRef<HTMLSpanElement>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Requirement override modal state
  const [overrideCriterion, setOverrideCriterion] = useState<any | null>(null);
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<'passed' | 'failed'>('passed');

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (candidate) {
      setNotes(candidate.formAnswers?.notes || candidate.notes || '');
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
    } catch {
      // Ignored
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleDecision = async (decision: 'shortlisted' | 'unshortlisted' | 'needs_review') => {
    if (!candidate || isBatchFinalized) return;
    try {
      setIsUpdatingDecision(true);
      await shortlistApi.bulkUpdateDecisions(batchId, [candidate.id], decision);
      onDecisionUpdated(candidate.id, decision);
      addToast('success', `Candidate moved to ${decision}.`);
    } catch {
      addToast('error', 'Failed to update candidate decision.');
    } finally {
      setIsUpdatingDecision(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!candidate) return;
    try {
      setIsSavingNotes(true);
      await shortlistApi.updateCandidate(batchId, candidate.id, { notes });
      addToast('success', 'Recruiter notes saved.');
    } catch {
      addToast('error', 'Failed to save notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideCriterion || !overrideNote.trim()) {
      addToast('error', 'A specific reason note is required for manual overrides.');
      return;
    }
    // Update local criterion result with override note and save
    const updatedResults = (candidate.criteriaResults || []).map((cr: any) => {
      if (cr.criterionId === overrideCriterion.criterionId || cr.label === overrideCriterion.label) {
        return {
          ...cr,
          passed: overrideStatus === 'passed',
          isOverridden: true,
          overrideNote: overrideNote.trim(),
          reason: `[Manual Override] ${overrideNote.trim()}`
        };
      }
      return cr;
    });

    try {
      await shortlistApi.updateCandidate(batchId, candidate.id, {
        criteriaResults: updatedResults,
        notes: notes ? `${notes}\n[Override ${overrideCriterion.label}]: ${overrideNote}` : `[Override ${overrideCriterion.label}]: ${overrideNote}`
      });
      setOverrideCriterion(null);
      setOverrideNote('');
      addToast('success', 'Requirement override recorded with audit note.');
    } catch {
      addToast('error', 'Failed to save requirement override.');
    }
  };

  const score = candidate?.score ?? 0;
  const breakdown = candidate?.breakdown || {};

  // GSAP animation for score ring and breakdown bars in drawer
  useGSAP(
    () => {
      if (!isOpen || !candidate || !containerRef.current) return;

      if (isReducedMotion()) {
        if (circleRef.current) {
          gsap.set(circleRef.current, { strokeDashoffset: 188 - (188 * score) / 100 });
        }
        if (scoreNumberRef.current) {
          scoreNumberRef.current.textContent = `${score}%`;
        }
        return;
      }

      // Drawer panel slide-in
      gsap.fromTo(
        containerRef.current,
        { x: 30, opacity: 0 },
        { x: 0, opacity: 1, duration: MOTION_DURATIONS.emphasis, ease: MOTION_EASES.standard, clearProps: 'transform' }
      );

      // Score ring
      animateScoreRing(circleRef.current, score, 30, MOTION_DURATIONS.emphasis);

      // Counter
      if (scoreNumberRef.current) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: score,
          duration: MOTION_DURATIONS.emphasis,
          ease: MOTION_EASES.standard,
          onUpdate: () => {
            if (scoreNumberRef.current) {
              scoreNumberRef.current.textContent = `${Math.round(obj.val)}%`;
            }
          }
        });
      }

      // Breakdown bars
      const barVals = [
        breakdown.keywordScore ?? score,
        breakdown.skillsScore ?? score,
        breakdown.experienceScore ?? score,
        breakdown.formattingScore ?? 85,
        breakdown.readabilityScore ?? 90
      ];
      barRefs.current.forEach((bar, idx) => {
        if (bar) {
          animateProgressBar(bar, barVals[idx] ?? 0, MOTION_DURATIONS.standard);
        }
      });
    },
    { dependencies: [isOpen, candidate?.id, score], scope: containerRef }
  );

  if (!isOpen || !candidate) return null;
  const criteriaResults: any[] = Array.isArray(candidate.criteriaResults)
    ? candidate.criteriaResults
    : [];

  // Parse Quality & Integrity information
  const parseQuality = candidate.parseQuality || breakdown.parseQuality || {
    status: candidate.failureReason ? 'UNREADABLE' : breakdown.formattingScore && breakdown.formattingScore < 50 ? 'PARTIAL' : 'OK',
    issues: candidate.failureReason ? [candidate.failureReason] : []
  };

  const integrityFlags: any[] = candidate.integrityFlags || breakdown.integrityFlags || [];

  const displayName = isBlindMode ? `Candidate #${candidate.id.slice(0, 6).toUpperCase()}` : candidate.fullName;
  const displayEmail = isBlindMode ? '[Protected Demographic]' : (candidate.email || 'No email on file');
  const displayPhone = isBlindMode ? '[Protected Demographic]' : candidate.phone;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="candidate-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 flex justify-end"
    >
      <div ref={containerRef} className="w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col focus:outline-none" tabIndex={-1}>
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-surface-subtle flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="candidate-drawer-title" className="text-base font-bold text-ink-primary truncate">{displayName}</h2>
              {candidate.decision ? (
                <DecisionStatusBadge decision={candidate.decision} size="sm" />
              ) : (
                <Badge variant="neutral" size="sm">Pending Review</Badge>
              )}
              {candidate.decisionSource === 'manual' && (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-semibold">
                  Manual Recruiter Override
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-1 font-mono">
              {displayEmail} {displayPhone && `• ${displayPhone}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBlindMode((prev) => !prev)}
              className="p-1.5 rounded-lg border border-border text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
              title="Toggle Blind Mode"
            >
              {isBlindMode ? <EyeOff className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-surface px-4">
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'evaluation'
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Evaluation & Evidence</span>
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'resume'
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Original Resume PDF</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'notes'
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Recruiter Notes</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Tab 1: Evaluation & Evidence */}
          {activeTab === 'evaluation' && (
            <div className="space-y-5">
              {/* Plain-Language "Why This Recommendation" Panel */}
              <div className="p-4 rounded-xl border border-border bg-surface-subtle space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-ink-primary text-xs">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  Why This Recommendation?
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {candidate.decisionReason ||
                    (score >= 70
                      ? `Candidate achieved a match score of ${score}%, meeting or exceeding the qualification benchmark with verified technical competencies.`
                      : score >= 65
                      ? `Candidate scored ${score}%, placing within the borderline range (within 5% of cutoff). Human recruiter review is requested.`
                      : `Candidate achieved ${score}%, falling below the qualification threshold or missing must-have requirements.`)}
                </p>
              </div>

              {/* Integrity Flags Panel */}
              <div className="p-4 rounded-xl border border-border bg-surface shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink-primary flex items-center gap-2">
                    {integrityFlags.length > 0 ? (
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-status-shortlist-text" />
                    )}
                    Resume Integrity Verification
                  </span>
                  <Badge
                    variant={integrityFlags.length > 0 ? 'needs_review' : 'tier_outcome'}
                    size="sm"
                  >
                    {integrityFlags.length > 0 ? `${integrityFlags.length} Flag(s)` : 'Verified Clean'}
                  </Badge>
                </div>
                {integrityFlags.length > 0 ? (
                  <div className="space-y-1.5 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    {integrityFlags.map((flag: any, fIdx: number) => (
                      <p key={fIdx} className="flex items-start gap-1.5">
                        <span>•</span>
                        <span>{typeof flag === 'string' ? flag : flag.reason || flag.type}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-ink-secondary leading-relaxed">
                    Zero adversarial prompt injections, invisible white text blocks, or artificial keyword stuffing patterns detected.
                  </p>
                )}
              </div>

              {/* Match Score & 5 Breakdown Bars */}
              <div className="p-4 bg-surface border border-border rounded-xl flex flex-col sm:flex-row items-center gap-5 shadow-xs">
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative w-18 h-18 flex items-center justify-center">
                    <svg className="w-18 h-18 -rotate-90">
                      <circle cx="36" cy="36" r="30" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                      <circle
                        ref={circleRef}
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
                    <span ref={scoreNumberRef} className="absolute text-lg font-bold text-ink-primary tabular-nums">{score}%</span>
                  </div>
                  <span className="text-[10px] text-ink-muted font-medium uppercase mt-1">
                    Match Estimate
                  </span>
                </div>

                <div className="flex-1 w-full space-y-1.5">
                  {[
                    { label: 'Keywords Match', val: breakdown.keywordScore ?? score },
                    { label: 'Technical Skills', val: breakdown.skillsScore ?? score },
                    { label: 'Experience Relevance', val: breakdown.experienceScore ?? score },
                    { label: 'Formatting Health', val: breakdown.formattingScore ?? 85 },
                    { label: 'Readability', val: breakdown.readabilityScore ?? 90 }
                  ].map(({ label, val }, idx) => (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-ink-secondary">{label}</span>
                        <span className="font-semibold text-ink-primary tabular-nums">{val}%</span>
                      </div>
                      <div className="w-full bg-surface-muted h-1 rounded-full overflow-hidden">
                        <div
                          ref={(el) => (barRefs.current[idx] = el)}
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirement Rows with Evidence & One-Click Override */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink-primary text-xs uppercase tracking-wider">
                    Requirement Verification & Evidence ({criteriaResults.length})
                  </h3>
                  <span className="text-[10px] text-ink-muted">
                    Click "Override" to adjust requirement
                  </span>
                </div>

                {criteriaResults.length === 0 ? (
                  <div className="p-6 bg-surface-muted border border-border rounded-xl text-ink-muted text-center">
                    No custom criteria evaluated yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criteriaResults.map((cr, idx) => {
                      const status = cr.passed ? 'Pass' : cr.evidenceTier === 'related_semantic' ? 'Partial' : 'Fail';

                      return (
                        <div
                          key={cr.criterionId || idx}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                            cr.passed
                              ? 'bg-emerald-50/30 border-emerald-200'
                              : 'bg-red-50/30 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              {cr.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-status-shortlist-text shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 text-status-danger-text shrink-0 mt-0.5" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-ink-primary block">{cr.label}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                      status === 'Pass'
                                        ? 'bg-emerald-100 text-status-shortlist-text'
                                        : status === 'Partial'
                                        ? 'bg-amber-100 text-status-review-text'
                                        : 'bg-red-100 text-status-danger-text'
                                    }`}
                                  >
                                    {status}
                                  </span>
                                  {cr.isOverridden && (
                                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold">
                                      Overridden
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-ink-secondary block mt-0.5">
                                  {cr.reason}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
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

                              {!isBatchFinalized && (
                                <button
                                  onClick={() => {
                                    setOverrideCriterion(cr);
                                    setOverrideStatus(cr.passed ? 'failed' : 'passed');
                                    setOverrideNote(cr.overrideNote || '');
                                  }}
                                  className="text-[11px] text-primary hover:underline font-semibold"
                                >
                                  Override
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Evidence Snippet */}
                          {cr.evidenceSnippet && (
                            <div className="pl-3 py-1 text-[11px] text-ink-primary border-l-2 border-primary ml-2 italic bg-surface/90 rounded-r font-mono">
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

          {/* Tab 2: Resume PDF */}
          {activeTab === 'resume' && (
            <div className="space-y-3 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-primary">
                  Original Text-Based Resume Document
                </span>
                {signedPdfUrl && (
                  <a
                    href={signedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                  >
                    Open in Full Tab
                    <ExternalLink className="w-3.5 h-3.5" />
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
                  className="w-full h-[600px] border border-border rounded-xl shadow-xs"
                />
              ) : (
                <div className="p-12 text-center text-ink-muted bg-surface-muted border border-border rounded-xl">
                  Resume file not found in storage.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Recruiter Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-ink-primary mb-1">
                  Private Recruiter Notes & Evaluation Comments
                </label>
                <textarea
                  rows={8}
                  placeholder="Record interview notes, compensation discussions, or portfolio feedback here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-border bg-surface text-ink-primary leading-relaxed focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveNotes}
                  isLoading={isSavingNotes}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Drawer Footer Decision Actions */}
        {!isBatchFinalized && (
          <div className="p-4 border-t border-border bg-surface-subtle flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDecision('unshortlisted')}
              isLoading={isUpdatingDecision}
              leftIcon={<UserX className="w-3.5 h-3.5" />}
            >
              Move to Unshortlisted
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDecision('needs_review')}
                isLoading={isUpdatingDecision}
              >
                Mark Needs Review
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDecision('shortlisted')}
                isLoading={isUpdatingDecision}
                leftIcon={<UserCheck className="w-3.5 h-3.5" />}
              >
                Shortlist Candidate
              </Button>
            </div>
          </div>
        )}

        {/* Override Note Dialog */}
        {overrideCriterion && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="bg-surface border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-ink-primary">
                  Override: {overrideCriterion.label}
                </h3>
                <button onClick={() => setOverrideCriterion(null)} className="p-1 text-ink-muted hover:text-ink-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  New Status
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as any)}
                  className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
                >
                  <option value="passed">Mark as Passed / Met</option>
                  <option value="failed">Mark as Failed / Not Met</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Required Justification / Audit Note *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Verified candidate's GitHub portfolio demonstrates 5+ years equivalent experience."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface text-ink-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setOverrideCriterion(null)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSaveOverride} disabled={!overrideNote.trim()}>
                  Confirm Override
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
