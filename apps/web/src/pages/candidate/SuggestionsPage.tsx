import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  Check,
  X,
  Edit2,
  Copy,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  FileText,
  Loader2,
  CheckCheck
} from 'lucide-react';
import { scoreResume } from '@shortlistiq/engine';
import { checksApi, CandidateCheckData, SuggestionItem, ApiError } from '../../lib/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';

export const SuggestionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

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
    setIsLoadingCheck(true);
    checksApi
      .getCheck(id)
      .then((res) => {
        setCheck(res.data);
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          setSuggestions(res.data.suggestions);
        } else {
          loadSuggestions(id);
        }
      })
      .catch((err) => setAiError(err.message || 'Failed to load candidate check.'))
      .finally(() => setIsLoadingCheck(false));
  }, [id]);

  const loadSuggestions = (checkId: string) => {
    setIsLoadingSuggestions(true);
    setAiError(null);
    checksApi
      .getSuggestions(checkId)
      .then((res) => {
        setSuggestions(res.data);
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

  const originalScore = check?.scoreBefore ?? 0;
  const projectedScore = projectedBreakdown?.overallScore ?? originalScore;
  const scoreDelta = projectedScore - originalScore;

  // Handle suggestion status update
  const handleUpdateStatus = async (
    suggestionId: string,
    status: 'accepted' | 'rejected' | 'edited',
    customText?: string
  ) => {
    if (!id) return;

    // Optimistically update local state
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

    // Compute updated projected score for database sync
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

    try {
      await checksApi.updateSuggestion(id, suggestionId, {
        status,
        finalText: customText,
        projectedScore: newScore
      });
      addToast('info', `Suggestion marked as ${status}`);
    } catch {
      addToast('error', 'Failed to save suggestion update');
    }
  };

  // Accept all high impact suggestions with a single click
  const handleAcceptAllHighImpact = async () => {
    const highImpactPending = suggestions.filter(
      (s) => s.impact === 'high' && (s.status === 'pending' || s.status === 'rejected')
    );

    if (highImpactPending.length === 0) {
      addToast('info', 'No pending high-impact suggestions to accept.');
      return;
    }

    for (const s of highImpactPending) {
      await handleUpdateStatus(s.id, 'accepted');
    }
    addToast('success', `Accepted ${highImpactPending.length} high-impact improvements!`);
  };

  const handleCopyEnhancedResume = () => {
    if (!updatedResumeText) return;
    navigator.clipboard.writeText(updatedResumeText);
    addToast('success', 'Enhanced resume text copied to clipboard!');
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-border">
        <div className="flex items-center gap-3">
          <Link
            to={`/checks/${id}`}
            className="p-2 rounded hover:bg-slate-100 text-slate-secondary transition-colors"
            title="Back to Score Breakdown"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-indigo" />
              AI Resume Suggestions & Live Optimization
            </h1>
            <p className="text-xs text-slate-secondary">
              Review and accept factual enhancements to boost your ATS compatibility score without fabricating experience.
            </p>
          </div>
        </div>

        {/* Projected Score Badge & Quick Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAcceptAllHighImpact}
            disabled={suggestions.filter((s) => s.impact === 'high' && s.status === 'pending').length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Accept All High-Impact
          </button>
          <Link
            to={`/checks/${id}/export`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-border hover:bg-slate-50 transition-colors shadow-soft"
          >
            <FileText className="w-3.5 h-3.5 text-brand-indigo" />
            Customize & Export Resume
          </Link>
        </div>
      </div>

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Pane: Suggestions List (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-card border border-slate-border rounded-lg p-2 shadow-soft">
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeFilter === 'all' ? 'bg-brand-indigo text-white' : 'text-slate-secondary hover:bg-slate-100'
                }`}
              >
                All ({suggestions.length})
              </button>
              <button
                onClick={() => setActiveFilter('high')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeFilter === 'high' ? 'bg-brand-indigo text-white' : 'text-slate-secondary hover:bg-slate-100'
                }`}
              >
                High Impact ({suggestions.filter((s) => s.impact === 'high').length})
              </button>
              <button
                onClick={() => setActiveFilter('pending')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeFilter === 'pending' ? 'bg-brand-indigo text-white' : 'text-slate-secondary hover:bg-slate-100'
                }`}
              >
                Pending ({suggestions.filter((s) => s.status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveFilter('accepted')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeFilter === 'accepted' ? 'bg-brand-indigo text-white' : 'text-slate-secondary hover:bg-slate-100'
                }`}
              >
                Accepted ({suggestions.filter((s) => s.status === 'accepted' || s.status === 'edited').length})
              </button>
            </div>
          </div>

          {/* AI Loading State */}
          {isLoadingSuggestions && (
            <div className="bg-card border border-slate-border rounded-lg p-8 shadow-soft text-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-indigo animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-primary">Generating Factual Resume Suggestions...</p>
              <p className="text-xs text-slate-secondary max-w-md mx-auto">
                Comparing resume sections against missing target keywords with zero hallucination enforcement.
              </p>
            </div>
          )}

          {/* AI Failure / Fallback Alert with Retry Button */}
          {aiError && (
            <div className="p-5 rounded-lg bg-red-50 border border-red-200 text-slate-primary space-y-3">
              <div className="flex items-center gap-2 text-state-danger font-semibold text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                AI Suggestion Engine Temporarily Unavailable
              </div>
              <p className="text-xs text-slate-secondary leading-relaxed">
                {aiError} All your deterministic ATS scores and missing keywords are preserved below.
              </p>
              <button
                onClick={() => id && loadSuggestions(id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-white text-slate-primary border border-slate-border hover:bg-slate-50 transition-colors shadow-soft"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Suggestions
              </button>
            </div>
          )}

          {/* Suggestions Cards */}
          {!isLoadingSuggestions && filteredSuggestions.length === 0 && !aiError && (
            <div className="bg-card border border-slate-border rounded-lg p-8 text-center text-xs text-slate-secondary">
              No suggestions found matching this filter.
            </div>
          )}

          {!isLoadingSuggestions &&
            filteredSuggestions.map((s) => {
              const isAccepted = s.status === 'accepted' || s.status === 'edited';
              const isRejected = s.status === 'rejected';

              return (
                <div
                  key={s.id}
                  className={`bg-card border rounded-lg p-5 shadow-soft space-y-3 transition-colors ${
                    isAccepted
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : isRejected
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-border'
                  }`}
                >
                  {/* Card Header: Section + Impact Tag + Status */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-primary uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {s.section}
                      </span>
                      <span
                        className={`font-semibold text-[11px] px-2 py-0.5 rounded uppercase tracking-wider ${
                          s.impact === 'high'
                            ? 'bg-indigo-50 text-brand-indigo border border-indigo-200'
                            : s.impact === 'medium'
                            ? 'bg-amber-50 text-state-warning border border-amber-200'
                            : 'bg-slate-50 text-slate-secondary border border-slate-200'
                        }`}
                      >
                        {s.impact} Impact
                      </span>
                    </div>

                    <span className="text-[11px] font-medium capitalize text-slate-secondary">
                      Status: <strong className="text-slate-primary">{s.status}</strong>
                    </span>
                  </div>

                  {/* Original Text (Red Tint) */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-muted uppercase tracking-wider block mb-1">
                      Original Text
                    </span>
                    <div className="p-2.5 rounded bg-red-50 text-red-950 border border-red-200 text-xs font-mono line-through opacity-80 leading-relaxed">
                      {s.originalText}
                    </div>
                  </div>

                  {/* Proposed Text (Green Tint) */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-muted uppercase tracking-wider block mb-1">
                      Proposed Enhancement
                    </span>
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-xs font-mono p-2.5 rounded bg-white border border-brand-indigo focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-xs text-slate-secondary hover:underline"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(s.id, 'edited', editText)}
                            className="px-3 py-1 text-xs font-medium rounded text-white bg-brand-indigo hover:bg-brand-hover"
                          >
                            Save & Accept
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs font-mono leading-relaxed">
                        {s.finalText || s.proposedText}
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-slate-secondary italic leading-relaxed">
                    <strong>Reason:</strong> {s.reason}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-border/60">
                    <button
                      onClick={() => {
                        setEditingId(s.id);
                        setEditText(s.finalText || s.proposedText);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-secondary hover:text-slate-primary hover:underline"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Wording
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(s.id, 'rejected')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                          isRejected
                            ? 'bg-slate-200 text-slate-primary border-slate-300'
                            : 'text-state-danger border-slate-border hover:bg-red-50'
                        }`}
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>

                      <button
                        onClick={() => handleUpdateStatus(s.id, 'accepted')}
                        className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
                          isAccepted
                            ? 'bg-state-success text-white'
                            : 'bg-brand-indigo text-white hover:bg-brand-hover shadow-sm'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        {isAccepted ? 'Accepted' : 'Accept'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Pane: Projected Score & Live Resume Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 sticky top-6">
          {/* Projected Score Meter */}
          <div className="bg-card border border-slate-border rounded-lg shadow-soft p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-muted">
                Projected ATS Score
              </span>
              {scoreDelta > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-state-success border border-emerald-200">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{scoreDelta} pts improvement
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-secondary block mb-0.5">Original Score</span>
                <span className="text-2xl font-bold text-slate-muted">{originalScore}</span>
              </div>
              <div className="text-slate-muted text-lg font-light">→</div>
              <div>
                <span className="text-xs font-semibold text-brand-indigo block mb-0.5">Projected</span>
                <span className="text-3xl font-extrabold text-state-success">{projectedScore}</span>
              </div>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-state-success rounded-full transition-all duration-500"
                style={{ width: `${projectedScore}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-secondary leading-normal">
              Score is recomputed instantly using our local deterministic scoring engine as you accept or customize suggestions.
            </p>
          </div>

          {/* Live Resume Preview */}
          <div className="bg-card border border-slate-border rounded-lg shadow-soft p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-indigo" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-primary">
                  Live Resume Preview
                </h3>
              </div>
              <button
                onClick={handleCopyEnhancedResume}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-border hover:bg-slate-50 transition-colors shadow-soft"
              >
                <Copy className="w-3 h-3" />
                Copy Enhanced Text
              </button>
            </div>

            <div className="max-h-[500px] overflow-y-auto p-3.5 rounded bg-slate-50 border border-slate-border text-xs font-mono text-slate-primary whitespace-pre-wrap leading-relaxed select-text">
              {updatedResumeText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

