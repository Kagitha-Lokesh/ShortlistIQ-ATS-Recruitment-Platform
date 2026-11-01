import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Edit2,
  Copy,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  FileText,
  Loader2,
  CheckCheck,
  CheckCircle2,
  Info,
  Code2
} from 'lucide-react';
import { scoreResume } from '@shortlistiq/engine';
import { checksApi, CandidateCheckData, SuggestionItem, ApiError } from '../../lib/api.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { useToast } from '../../context/ToastContext.js';
import { getAtsCheck, updateAtsCheck } from '../../lib/atsStorage.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card, CardContent } from '../../components/ui/Card.js';

export const SuggestionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [check, setCheck] = useState<CandidateCheckData | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoadingCheck, setIsLoadingCheck] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'pending' | 'accepted'>('all');
  const [aiError, setAiError] = useState<string | null>(null);

  // Load candidate check
  useEffect(() => {
    if (!id) return;

    // Check localStorage first
    const cached = getAtsCheck(id);
    if (cached) {
      setCheck(cached as any);
      if (cached.suggestions && cached.suggestions.length > 0) {
        setSuggestions(cached.suggestions);
      }
      setIsLoadingCheck(false);
    } else {
      setIsLoadingCheck(true);
    }

    checksApi
      .getCheck(id)
      .then((res) => {
        setCheck(res.data);
        updateAtsCheck(id, res.data);
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          setSuggestions(res.data.suggestions);
          updateAtsCheck(id, { suggestions: res.data.suggestions });
        } else if (!cached?.suggestions?.length) {
          loadSuggestions(id);
        }
      })
      .catch((err) => {
        if (!cached) {
          setAiError(err.message || 'Failed to load candidate check.');
        }
      })
      .finally(() => setIsLoadingCheck(false));
  }, [id]);

  const loadSuggestions = (checkId: string) => {
    setIsLoadingSuggestions(true);
    setAiError(null);
    checksApi
      .getSuggestions(checkId)
      .then((res) => {
        setSuggestions(res.data);
        updateAtsCheck(checkId, { suggestions: res.data });
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setAiError(err.message);
        } else {
          setAiError('Unable to generate AI suggestions at this time. Please retry.');
        }
      })
      .finally(() => setIsLoadingSuggestions(false));
  };

  // Compute live updated resume text based on accepted suggestions
  const updatedResumeText = useMemo(() => {
    if (!check?.resumeText) return '';
    let text = check.resumeText;

    for (const s of suggestions) {
      if (s.status === 'accepted' || s.status === 'edited') {
        const replacement = s.finalText || s.proposedText;
        if (s.originalText && text.includes(s.originalText)) {
          text = text.replace(s.originalText, replacement);
        }
      }
    }
    return text;
  }, [check?.resumeText, suggestions]);

  // Recompute projected score dynamically using framework-free engine
  const projectedBreakdown = useMemo(() => {
    if (!updatedResumeText || !check?.jdText) return null;
    return scoreResume(updatedResumeText, check.jdText);
  }, [updatedResumeText, check?.jdText]);

  const originalScore = Math.round(check?.scoreBefore ?? 0);
  const projectedScore = Math.round(projectedBreakdown?.overallScore ?? originalScore);
  const scoreDelta = projectedScore - originalScore;

  // Handle suggestion status update
  const handleUpdateStatus = async (
    suggestionId: string,
    status: 'accepted' | 'rejected' | 'edited',
    customText?: string
  ) => {
    if (!id) return;

    const nextSuggestions = suggestions.map((s) => {
      if (s.id === suggestionId) {
        return {
          ...s,
          status,
          finalText: customText !== undefined ? customText : s.finalText
        };
      }
      return s;
    });
    setSuggestions(nextSuggestions);
    setEditingId(null);
    updateAtsCheck(id, { suggestions: nextSuggestions });

    let simulatedText = check?.resumeText || '';
    for (const s of nextSuggestions) {
      if (s.status === 'accepted' || s.status === 'edited') {
        const replacement = s.finalText || s.proposedText;
        if (s.originalText && simulatedText.includes(s.originalText)) {
          simulatedText = simulatedText.replace(s.originalText, replacement);
        }
      }
    }
    const newScore = check?.jdText ? scoreResume(simulatedText, check.jdText).overallScore : projectedScore;
    updateAtsCheck(id, { scoreAfter: newScore });

    try {
      await checksApi.updateSuggestion(id, suggestionId, {
        status,
        finalText: customText,
        projectedScore: newScore
      });
      showToast({
        type: 'info',
        title: 'Status Updated',
        message: `Suggestion marked as ${status}.`
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not synchronize suggestion status.'
      });
    }
  };

  const handleAcceptAllHighImpact = async () => {
    const highImpactPending = suggestions.filter(
      (s) => s.impact === 'high' && (s.status === 'pending' || s.status === 'rejected')
    );

    if (highImpactPending.length === 0) {
      showToast({
        type: 'info',
        title: 'Nothing to Accept',
        message: 'No pending high-impact suggestions to accept.'
      });
      return;
    }

    for (const s of highImpactPending) {
      await handleUpdateStatus(s.id, 'accepted');
    }
    showToast({
      type: 'success',
      title: 'Accepted',
      message: `Accepted ${highImpactPending.length} high-impact improvements.`
    });
  };

  const handleCopyEnhancedResume = () => {
    if (!updatedResumeText) return;
    navigator.clipboard.writeText(updatedResumeText);
    showToast({
      type: 'success',
      title: 'Copied',
      message: 'Enhanced resume text copied to clipboard.'
    });
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (activeFilter === 'high') return s.impact === 'high';
    if (activeFilter === 'pending') return s.status === 'pending';
    if (activeFilter === 'accepted') return s.status === 'accepted' || s.status === 'edited';
    return true;
  });

  if (isLoadingCheck) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            to={`/checks/${id}`}
            className="p-1.5 rounded hover:bg-surface-subtle text-ink-muted hover:text-ink-primary transition-colors"
            title="Back to Score Breakdown"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              ATS Optimization & Suggestions
            </h1>
            <p className="text-xs text-ink-secondary">
              Review and accept factual enhancements to boost your match score without fabricating credentials.
            </p>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAcceptAllHighImpact}
            disabled={suggestions.filter((s) => s.impact === 'high' && s.status === 'pending').length === 0}
            leftIcon={<CheckCheck className="w-3.5 h-3.5 text-state-success" />}
          >
            Accept All High-Impact
          </Button>
          <Link to={`/checks/${id}/export?tab=latex`}>
            <Button variant="outline" size="sm" leftIcon={<Code2 className="w-3.5 h-3.5 text-primary" />}>
              LaTeX Code
            </Button>
          </Link>
          <Link to={`/checks/${id}/export`}>
            <Button variant="primary" size="sm" rightIcon={<FileText className="w-3.5 h-3.5" />}>
              Customize & Export Resume
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Pane: Suggestions List (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Truth in Optimization Banner */}
          <div className="p-3 bg-surface-subtle border border-border rounded-lg flex items-start gap-2.5 text-xs text-ink-secondary">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-ink-primary block">Truthful Resume Optimization</span>
              <p className="text-[11px] text-ink-secondary mt-0.5 leading-relaxed">
                Suggestions only rephrase and elevate qualifications already grounded in your uploaded document. Never claim skills or responsibilities you have not performed.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-surface border border-border rounded-lg text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              All ({suggestions.length})
            </button>
            <button
              onClick={() => setActiveFilter('high')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeFilter === 'high' ? 'bg-primary text-primary-foreground font-semibold' : 'text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              High Impact ({suggestions.filter((s) => s.impact === 'high').length})
            </button>
            <button
              onClick={() => setActiveFilter('pending')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeFilter === 'pending' ? 'bg-primary text-primary-foreground font-semibold' : 'text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              Pending ({suggestions.filter((s) => s.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveFilter('accepted')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeFilter === 'accepted' ? 'bg-primary text-primary-foreground font-semibold' : 'text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              Accepted ({suggestions.filter((s) => s.status === 'accepted' || s.status === 'edited').length})
            </button>
          </div>

          {/* Loading State */}
          {isLoadingSuggestions && (
            <Card className="p-8 text-center space-y-3">
              <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
              <p className="text-xs font-semibold text-ink-primary">Generating Factual Resume Suggestions…</p>
              <p className="text-[11px] text-ink-muted max-w-sm mx-auto">
                Comparing resume text against job description keywords with zero hallucination enforcement.
              </p>
            </Card>
          )}

          {/* Error Banner */}
          {aiError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-state-danger space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>AI Suggestion Engine Temporarily Unavailable</span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                {aiError} All your deterministic scores and missing keywords are preserved.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => id && loadSuggestions(id)}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Retry Suggestions
              </Button>
            </div>
          )}

          {/* Suggestions Diff Cards */}
          {!isLoadingSuggestions && filteredSuggestions.length === 0 && !aiError && (
            <Card className="p-8 text-center text-xs text-ink-muted">
              No suggestions found for this filter.
            </Card>
          )}

          {!isLoadingSuggestions &&
            filteredSuggestions.map((s) => {
              const isAccepted = s.status === 'accepted' || s.status === 'edited';
              const isRejected = s.status === 'rejected';
              const isMissingEvidence = !s.originalText || s.originalText.trim().length === 0;

              return (
                <Card
                  key={s.id}
                  className={`p-5 space-y-3.5 transition-colors ${
                    isAccepted
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : isRejected
                      ? 'border-border opacity-60'
                      : 'border-border'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-primary uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-surface-subtle border border-border">
                        {s.section}
                      </span>
                      <Badge
                        variant={s.impact === 'high' ? 'shortlisted' : s.impact === 'medium' ? 'needs_review' : 'neutral'}
                        size="sm"
                      >
                        {s.impact.toUpperCase()} IMPACT
                      </Badge>
                    </div>

                    <span className="text-[11px] font-medium capitalize text-ink-muted">
                      Status: <strong className="text-ink-primary">{s.status}</strong>
                    </span>
                  </div>

                  {/* Question Box when resume lacks evidence */}
                  {isMissingEvidence && (
                    <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Evidence Clarification Question</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        The target job requests this capability, but your uploaded resume does not explicitly cite it. Have you used this skill in an academic or workplace project? If so, edit the text below to include your authentic project context before accepting.
                      </p>
                    </div>
                  )}

                  {/* Before (Original Text) */}
                  {s.originalText && (
                    <div>
                      <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
                        Current Resume Text
                      </span>
                      <div className="p-2.5 rounded bg-red-50 text-red-950 border border-red-200 text-xs font-mono line-through opacity-80 leading-relaxed break-words">
                        {s.originalText}
                      </div>
                    </div>
                  )}

                  {/* After (Proposed Enhancement) */}
                  <div>
                    <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
                      Proposed Factual Enhancement
                    </span>
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-xs font-mono p-2.5 rounded bg-surface border border-primary focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdateStatus(s.id, 'edited', editText)}
                          >
                            Save & Accept
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs font-mono leading-relaxed break-words">
                        {s.finalText || s.proposedText}
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    <strong className="text-ink-primary">Why this helps:</strong> {s.reason}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditText(s.finalText || s.proposedText);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary hover:underline"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Wording</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={isRejected ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => handleUpdateStatus(s.id, 'rejected')}
                        leftIcon={<X className="w-3.5 h-3.5 text-state-danger" />}
                      >
                        {isRejected ? 'Rejected' : 'Reject'}
                      </Button>
                      <Button
                        variant={isAccepted ? 'success' : 'primary'}
                        size="sm"
                        onClick={() => handleUpdateStatus(s.id, 'accepted')}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        {isAccepted ? 'Accepted' : 'Accept'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>

        {/* Right Pane: Live Projected Score & Preview (5 Cols, Sticky) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <Card className="p-5 space-y-4 shadow-subtle">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block">
                  Projected ATS Score
                </span>
                <span className="text-2xl font-extrabold text-ink-primary tabular-nums">
                  {projectedScore} <span className="text-xs font-normal text-ink-muted">/ 100</span>
                </span>
              </div>

              {scoreDelta !== 0 && (
                <div className={`px-2.5 py-1 rounded text-xs font-bold tabular-nums ${
                  scoreDelta > 0 ? 'bg-emerald-50 text-state-success border border-emerald-200' : 'bg-surface-subtle text-ink-muted'
                }`}>
                  {scoreDelta > 0 ? `+${scoreDelta} pts improvement` : `${scoreDelta} pts`}
                </div>
              )}
            </div>

            <p className="text-[11px] text-ink-muted leading-relaxed">
              *Projected score is a simulated deterministic match estimate based on currently accepted enhancements.
            </p>

            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <span className="text-ink-secondary">Optimization Progress</span>
                <span className="text-ink-primary tabular-nums">
                  {suggestions.filter((s) => s.status === 'accepted' || s.status === 'edited').length} of {suggestions.length} accepted
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-subtle border border-border overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{
                    width: `${suggestions.length ? (suggestions.filter((s) => s.status === 'accepted' || s.status === 'edited').length / suggestions.length) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyEnhancedResume}
                leftIcon={<Copy className="w-3.5 h-3.5" />}
              >
                Copy Text
              </Button>
              <div className="flex items-center gap-2">
                <Link to={`/checks/${id}/export?tab=latex`}>
                  <Button variant="outline" size="sm" leftIcon={<Code2 className="w-3.5 h-3.5 text-primary" />}>
                    LaTeX Code
                  </Button>
                </Link>
                <Link to={`/checks/${id}/export`}>
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Export
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Quick Guidance Box */}
          <Card className="p-4 bg-surface-subtle border-border space-y-2 text-xs text-ink-secondary">
            <h4 className="font-semibold text-ink-primary flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-state-success" />
              What Happens Next?
            </h4>
            <p className="leading-relaxed text-[11px]">
              When you proceed to the Export screen, accepted enhancements are automatically applied into structured ATS single-column templates or compiled directly into clean LaTeX.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
