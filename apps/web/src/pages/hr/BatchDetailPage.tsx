import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi } from '../../lib/api.js';
import { BulkUploader } from '../../components/hr/BulkUploader.js';
import { CriteriaBuilderModal } from '../../components/hr/CriteriaBuilderModal.js';
import { CandidateDrawer } from '../../components/hr/CandidateDrawer.js';
import { BatchFormsModal } from '../../components/hr/BatchFormsModal.js';
import { EmailSettingsModal } from '../../components/hr/EmailSettingsModal.js';
import { EmailTemplateEditorModal } from '../../components/hr/EmailTemplateEditorModal.js';
import { FinalizeBatchModal } from '../../components/hr/FinalizeBatchModal.js';
import { EmailDeliveryView } from '../../components/hr/EmailDeliveryView.js';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Copy,
  Mail,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
  Download,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUpDown,
  Filter,
  FileText,
  Lock,
  Send,
  FileCode,
  Trash2,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  Keyboard,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { useToast } from '../../context/ToastContext.js';

export const BatchDetailPage: React.FC = () => {
  const { id: batchId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [showEmailSettingsModal, setShowEmailSettingsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [mainView, setMainView] = useState<'candidates' | 'delivery'>('candidates');

  // Candidate selection & drawer
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number>(0);

  // Filters & sorting
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'mustHaves'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Blind Review Mode (anonymizes candidates to eliminate bias)
  const [isBlindMode, setIsBlindMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shortlistiq_blind_review') === 'true';
    } catch {
      return false;
    }
  });

  const toggleBlindMode = () => {
    setIsBlindMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('shortlistiq_blind_review', String(next));
      } catch {}
      return next;
    });
  };

  // NO_EMAIL resolution state
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [customEmailValue, setCustomEmailValue] = useState('');
  const [isJdExpanded, setIsJdExpanded] = useState(false);

  // Poll Batch Details every 2s while candidates are processing/pending
  const { data: batch, isLoading: isBatchLoading } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      if (!batchId) throw new Error('Missing batch ID');
      return shortlistApi.getBatch(batchId);
    },
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      const counts = query.state.data?.candidateCounts;
      const isProcessing = counts && (counts.pending > 0 || counts.processing > 0);
      return isProcessing ? 2000 : false;
    }
  });

  // Poll Candidates every 2s while candidates are processing/pending
  const { data: candidates = [], isLoading: isCandidatesLoading } = useQuery({
    queryKey: ['batch-candidates', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      return shortlistApi.getCandidates(batchId);
    },
    enabled: Boolean(batchId),
    refetchInterval: () => {
      const counts = batch?.candidateCounts;
      const isProcessing = counts && (counts.pending > 0 || counts.processing > 0);
      return isProcessing ? 2000 : false;
    }
  });

  // Mutation: Retry Failed Candidates
  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!batchId) return;
      return shortlistApi.retryFailed(batchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
      addToast('info', 'Retrying failed candidates...');
    }
  });

  // Mutation: Update Candidate Email (resolve NO_EMAIL)
  const updateCandidateMutation = useMutation({
    mutationFn: async ({ candidateId, email }: { candidateId: string; email: string }) => {
      if (!batchId) return;
      return shortlistApi.updateCandidate(batchId, candidateId, { email });
    },
    onSuccess: () => {
      setEditingEmailId(null);
      setCustomEmailValue('');
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
      addToast('success', 'Candidate email updated and re-scored.');
    }
  });

  // Mutation: Bulk Update Decisions
  const bulkDecisionMutation = useMutation({
    mutationFn: async ({
      candidateIds,
      decision
    }: {
      candidateIds: string[];
      decision: 'shortlisted' | 'unshortlisted';
    }) => {
      if (!batchId) return;
      return shortlistApi.bulkUpdateDecisions(batchId, candidateIds, decision);
    },
    onSuccess: (_, vars) => {
      setSelectedCandidateIds([]);
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
      addToast('success', `Moved ${vars.candidateIds.length} candidate(s) to ${vars.decision}.`);
    }
  });

  // Export CSV handler
  const handleExportCsv = async () => {
    if (!batchId || !batch) return;
    try {
      setIsExportingCsv(true);
      await shortlistApi.downloadBatchCsv(batchId, `${batch.name.replace(/[^a-zA-Z0-9]/g, '_')}_Candidates.csv`);
      addToast('success', 'Exported candidates to CSV.');
    } catch {
      addToast('error', 'Failed to export candidate CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Delete Batch handler
  const handleDeleteBatch = async () => {
    if (!batchId || deleteConfirmText !== 'DELETE') return;
    try {
      setIsDeletingBatch(true);
      await shortlistApi.deleteBatch(batchId);
      addToast('success', 'Batch permanently deleted.');
      navigate('/hr/dashboard');
    } catch {
      addToast('error', 'Failed to delete batch.');
      setIsDeletingBatch(false);
    }
  };

  // Filter & Sort Candidates
  const filteredAndSortedCandidates = useMemo(() => {
    let result = [...candidates];

    // Filter by Tab
    if (filterDecision === 'shortlisted') {
      result = result.filter((c: any) => c.decision === 'shortlisted');
    } else if (filterDecision === 'needs_review') {
      result = result.filter((c: any) => c.decision === 'needs_review');
    } else if (filterDecision === 'unshortlisted') {
      result = result.filter((c: any) => c.decision === 'unshortlisted');
    } else if (filterDecision === 'failed') {
      result = result.filter((c: any) => c.failureReason || c.status === 'failed');
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c: any) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q) ||
          (c.breakdown?.matchedKeywords || []).some((kw: string) => kw.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === 'score') {
        const scoreA = a.score ?? -1;
        const scoreB = b.score ?? -1;
        comparison = scoreA - scoreB;
      } else if (sortBy === 'name') {
        const nameA = a.fullName || '';
        const nameB = b.fullName || '';
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === 'mustHaves') {
        const mustHavesA = (a.criteriaResults || []).filter((cr: any) => cr.type === 'must-have' && cr.passed).length;
        const mustHavesB = (b.criteriaResults || []).filter((cr: any) => cr.type === 'must-have' && cr.passed).length;
        comparison = mustHavesA - mustHavesB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [candidates, filterDecision, searchQuery, sortBy, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedCandidates.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedCandidates.slice(start, start + pageSize);
  }, [filteredAndSortedCandidates, currentPage, pageSize]);

  // Bulk selection helpers
  const allCurrentPageSelected =
    paginatedCandidates.length > 0 &&
    paginatedCandidates.every((c: any) => selectedCandidateIds.includes(c.id));

  const toggleSelectAllCurrentPage = () => {
    if (allCurrentPageSelected) {
      const pageIds = new Set(paginatedCandidates.map((c: any) => c.id));
      setSelectedCandidateIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedCandidates.map((c: any) => c.id);
      setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  // Keyboard Shortcuts Listener for Fast Review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveCandidateIndex((prev) => Math.min(paginatedCandidates.length - 1, prev + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveCandidateIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cand = paginatedCandidates[activeCandidateIndex];
        if (cand) setSelectedCandidate(cand);
      } else if (e.key === 'Escape') {
        setSelectedCandidate(null);
        setSelectedCandidateIds([]);
      } else if (e.key.toLowerCase() === 'b') {
        toggleBlindMode();
      } else if (e.key.toLowerCase() === 's') {
        const cand = selectedCandidate || paginatedCandidates[activeCandidateIndex];
        if (cand && batch && batch.status !== 'finalized') {
          bulkDecisionMutation.mutate({ candidateIds: [cand.id], decision: 'shortlisted' });
        }
      } else if (e.key.toLowerCase() === 'u') {
        const cand = selectedCandidate || paginatedCandidates[activeCandidateIndex];
        if (cand && batch && batch.status !== 'finalized') {
          bulkDecisionMutation.mutate({ candidateIds: [cand.id], decision: 'unshortlisted' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paginatedCandidates, activeCandidateIndex, selectedCandidate, batch]);

  if (isBatchLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-base font-semibold text-ink-primary">Batch not found</h2>
        <Link to="/hr/dashboard" className="text-xs text-primary underline mt-2 block">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const counts = batch.candidateCounts || {
    total: 0,
    pending: 0,
    processing: 0,
    scored: 0,
    failed: 0,
    shortlisted: 0,
    unshortlisted: 0,
    needsReview: 0
  };

  const isBatchFinalized = batch.status === 'finalized';
  const isProcessing = counts.pending > 0 || counts.processing > 0;
  const processedCount = counts.scored + counts.failed;
  const progressPercent = counts.total > 0 ? Math.round((processedCount / counts.total) * 100) : 0;
  const remainingCount = Math.max(0, counts.total - processedCount);
  const estimatedSecondsRemaining = Math.ceil(remainingCount / 4);

  const criteriaCount = Array.isArray(batch.criteria?.rules)
    ? batch.criteria.rules.length
    : Array.isArray(batch.criteria)
    ? batch.criteria.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link
            to="/hr/dashboard"
            className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-primary">{batch.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1.5 ${
                isBatchFinalized
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : batch.status === 'active'
                  ? 'bg-emerald-50 text-status-shortlist-text border border-emerald-200'
                  : 'bg-surface-muted text-ink-secondary border border-border'
              }`}
            >
              {isBatchFinalized && <Lock className="w-3 h-3 text-amber-700" />}
              {batch.status}
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Target Role: <span className="font-semibold text-ink-primary">{batch.jobTitle}</span> • Cutoff:{' '}
            <span className="font-semibold text-primary">{batch.cutoff}%</span> • Criteria Rules:{' '}
            <span className="font-semibold text-ink-primary">{criteriaCount} active</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Blind Review Toggle */}
          <button
            onClick={toggleBlindMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              isBlindMode
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface border-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
            }`}
            title="Toggle Blind Review Mode (anonymizes candidates to eliminate bias)"
          >
            {isBlindMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Blind Review</span>
            <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-surface-muted text-ink-muted">
              {isBlindMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Forms Button */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileText className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowFormsModal(true)}
          >
            Forms
          </Button>

          {/* Criteria Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isBatchFinalized}
            leftIcon={<Sliders className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowCriteriaModal(true)}
            title={isBatchFinalized ? 'Criteria locked because batch is finalized' : 'Configure Criteria'}
          >
            Criteria
          </Button>

          {/* Templates Button */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileCode className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowTemplatesModal(true)}
          >
            Email Templates
          </Button>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isExportingCsv || candidates.length === 0}
            isLoading={isExportingCsv}
            leftIcon={<Download className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={handleExportCsv}
            title="Export candidates to CSV"
          >
            Export CSV
          </Button>

          {/* Add Resumes Button */}
          {!isBatchFinalized && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowUploadModal(!showUploadModal)}
            >
              Add Resumes
            </Button>
          )}

          {/* Finalize / Delivery Button */}
          {isBatchFinalized ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Lock className="w-3.5 h-3.5 text-amber-700" />}
              onClick={() => setMainView('delivery')}
            >
              Finalized (View Emails)
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Send className="w-3.5 h-3.5" />}
              onClick={() => setShowFinalizeModal(true)}
            >
              Finalize & Send Emails
            </Button>
          )}

          {/* Delete Batch Button */}
          <button
            onClick={() => setShowDeleteBatchModal(true)}
            title="Delete batch"
            className="p-2 text-ink-muted hover:text-status-danger-text rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Accordion Job Description Preview */}
      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <button
          onClick={() => setIsJdExpanded(!isJdExpanded)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-hover/70 transition-colors"
        >
          <div className="text-xs font-semibold text-ink-primary flex items-center gap-2">
            <span>Job Description & Evaluation Standards</span>
            <span className="text-[11px] text-ink-muted font-normal">
              ({batch.jdText?.length || 0} characters)
            </span>
          </div>
          <div className="text-xs text-ink-secondary flex items-center gap-1 font-medium">
            {isJdExpanded ? 'Hide description' : 'View full description'}
            {isJdExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isJdExpanded && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <pre className="text-xs text-ink-secondary font-sans whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-surface-muted p-3.5 rounded-lg border border-border">
              {batch.jdText}
            </pre>
          </div>
        )}
      </div>

      {/* Add Resumes Inline Dropzone Drawer */}
      {showUploadModal && !isBatchFinalized && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">Add More Candidate Resumes</h3>
              <p className="text-xs text-ink-secondary">
                Upload text-based PDF resumes. Resumes are queued and parsed automatically by background workers.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(false)}
              className="p-1 rounded text-ink-muted hover:text-ink-primary"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <BulkUploader
            batchId={batchId}
            autoUpload={true}
            onUploadComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
              queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
            }}
          />
        </div>
      )}

      {/* Navigation Tabs: Candidate Pipeline vs Email Delivery Logs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setMainView('candidates')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            mainView === 'candidates'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <span>Candidate Pipeline</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-muted border border-border font-mono text-ink-secondary">
            {candidates.length}
          </span>
        </button>

        <button
          onClick={() => setMainView('delivery')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            mainView === 'delivery'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email Delivery Logs</span>
          {isBatchFinalized && (
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-50 text-status-shortlist-text font-bold uppercase border border-emerald-200">
              Active
            </span>
          )}
        </button>
      </div>

      {mainView === 'delivery' ? (
        <EmailDeliveryView batchId={batchId!} />
      ) : (
        <>
          {/* Live Screening Status Tracker Banner */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink-primary">Screening & Shortlisting Status</h2>
                {isProcessing && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Parsing & Scoring Active
                  </span>
                )}
                {!isProcessing && counts.total > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-status-shortlist-text border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Processing Complete
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isProcessing && (
                  <span className="text-xs text-ink-secondary flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-ink-muted" />
                    ~{estimatedSecondsRemaining}s ETA
                  </span>
                )}
                {counts.failed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryMutation.mutate()}
                    isLoading={retryMutation.isPending}
                    leftIcon={<RefreshCw className="w-3 h-3" />}
                  >
                    Retry {counts.failed} Failed
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>
                  <strong>{processedCount}</strong> of <strong>{counts.total}</strong> resumes evaluated ({progressPercent}%)
                </span>
                <span className="font-mono text-[11px] text-ink-muted">
                  {counts.scored} scored • {counts.failed} failed • {counts.pending + counts.processing} remaining
                </span>
              </div>
              <div className="w-full bg-surface-muted h-2 rounded-full overflow-hidden border border-border/50">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isProcessing ? 'bg-primary' : 'bg-status-shortlist-text'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bulk Action Bar (when candidates are selected) */}
          {selectedCandidateIds.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-primary">
                  {selectedCandidateIds.length} candidate(s) selected
                </span>
                <span className="text-xs text-ink-muted">• Bulk Review Action</span>
              </div>

              <div className="flex items-center gap-2">
                {!isBatchFinalized && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        bulkDecisionMutation.mutate({
                          candidateIds: selectedCandidateIds,
                          decision: 'shortlisted'
                        })
                      }
                      isLoading={bulkDecisionMutation.isPending}
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      Move to Shortlisted
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        bulkDecisionMutation.mutate({
                          candidateIds: selectedCandidateIds,
                          decision: 'unshortlisted'
                        })
                      }
                      isLoading={bulkDecisionMutation.isPending}
                      leftIcon={<UserX className="w-3.5 h-3.5" />}
                    >
                      Move to Unshortlisted
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCandidateIds([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Candidate Pipeline Table */}
          <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
            {/* Table Filters & Exact Tabs */}
            <div className="p-4 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface-subtle/50">
              {/* Exact Status Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All Candidates', count: candidates.length },
                  { id: 'shortlisted', label: 'Recommended Shortlist', count: counts.shortlisted },
                  { id: 'needs_review', label: 'Needs Review', count: counts.needsReview },
                  { id: 'unshortlisted', label: 'Recommended Not Shortlisted', count: counts.unshortlisted },
                  { id: 'failed', label: 'Failed / Corrupt', count: counts.failed }
                ].map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setFilterDecision(id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      filterDecision === id
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        filterDecision === id
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-surface-muted text-ink-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search, Sort, and Keyboard Hint */}
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search candidate, skill..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border bg-surface text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-ink-muted bg-surface-muted border border-border px-2 py-1 rounded-md" title="Shortcuts: j/k navigate • Enter inspect • s shortlist • u unshortlist • b blind mode">
                  <Keyboard className="w-3 h-3" />
                  <span className="font-mono">j/k/s/u</span>
                </div>
              </div>
            </div>

            {/* Candidates Dense Table */}
            {isCandidatesLoading ? (
              <div className="p-8">
                <CardSkeleton />
              </div>
            ) : filteredAndSortedCandidates.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted">
                No candidates found matching the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-subtle border-b border-border text-ink-muted uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={toggleSelectAllCurrentPage}
                          className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">Candidate Profile</th>
                      <th className="py-3 px-3 text-center">Score</th>
                      <th className="py-3 px-3 text-center">Must-Haves</th>
                      <th className="py-3 px-4">Key Skills</th>
                      <th className="py-3 px-3 text-center">Status & Decision</th>
                      <th className="py-3 px-3 text-center">Parse Quality</th>
                      <th className="py-3 px-3 text-center">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedCandidates.map((candidate: any, idx: number) => {
                      const isNoEmail = candidate.failureReason === 'NO_EMAIL';
                      const isEditingThisEmail = editingEmailId === candidate.id;
                      const isSelected = selectedCandidateIds.includes(candidate.id);
                      const isKeyboardActive = idx === activeCandidateIndex;

                      // Must-haves calculation
                      const criteriaResults = Array.isArray(candidate.criteriaResults) ? candidate.criteriaResults : [];
                      const mustHaves = criteriaResults.filter((c: any) => c.type === 'must-have' || c.type === 'must_have');
                      const passedMustHaves = mustHaves.filter((c: any) => c.passed).length;

                      // Key Skills chips
                      const matchedSkills = candidate.breakdown?.matchedKeywords || [];
                      const displayedSkills = matchedSkills.slice(0, 3);
                      const overflowSkillsCount = Math.max(0, matchedSkills.length - 3);

                      // Parse quality
                      const parseQuality = candidate.parseQuality || (candidate.failureReason ? 'UNREADABLE' : candidate.breakdown?.formattingScore && candidate.breakdown?.formattingScore < 50 ? 'PARTIAL' : 'OK');

                      // Integrity flag check
                      const hasIntegrityFlags = (candidate.integrityFlags && candidate.integrityFlags.length > 0) || (candidate.breakdown?.integrityFlags && candidate.breakdown.integrityFlags.length > 0);

                      // Anonymized names for Blind Mode
                      const displayName = isBlindMode ? `Candidate #${candidate.id.slice(0, 6).toUpperCase()}` : candidate.fullName;
                      const displayEmail = isBlindMode ? '[Protected Demographic]' : (candidate.email || '—');

                      return (
                        <tr
                          key={candidate.id}
                          onClick={() => {
                            setActiveCandidateIndex(idx);
                            setSelectedCandidate(candidate);
                          }}
                          className={`hover:bg-surface-hover/80 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/5'
                              : isKeyboardActive
                              ? 'bg-surface-muted ring-1 ring-inset ring-primary/30'
                              : ''
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td
                            className="py-3.5 px-4 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectCandidate(candidate.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* Candidate Profile */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-ink-primary hover:text-primary transition-colors text-sm">
                              {displayName}
                            </div>
                            {isNoEmail ? (
                              isEditingThisEmail ? (
                                <div
                                  className="flex items-center gap-1.5 mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={customEmailValue}
                                    onChange={(e) => setCustomEmailValue(e.target.value)}
                                    className="text-xs px-2 py-0.5 border border-primary rounded-md focus:outline-none w-44 bg-surface text-ink-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() =>
                                      updateCandidateMutation.mutate({
                                        candidateId: candidate.id,
                                        email: customEmailValue
                                      })
                                    }
                                    disabled={!customEmailValue || updateCandidateMutation.isPending}
                                    className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary-hover disabled:opacity-50"
                                    title="Save Email & Rescore"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEmailId(candidate.id);
                                    setCustomEmailValue('');
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors mt-0.5"
                                >
                                  <Mail className="w-2.5 h-2.5" />
                                  Provide Missing Email
                                </button>
                              )
                            ) : (
                              <div className="text-[11px] text-ink-muted font-mono">{displayEmail}</div>
                            )}
                          </td>

                          {/* Score Badge */}
                          <td className="py-3.5 px-3 text-center">
                            {candidate.score !== null && candidate.score !== undefined ? (
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs tabular-nums ${
                                  candidate.score >= batch.cutoff
                                    ? 'bg-emerald-50 text-status-shortlist-text border border-emerald-200'
                                    : candidate.score >= batch.cutoff - 5
                                    ? 'bg-amber-50 text-status-review-text border border-amber-200'
                                    : 'bg-surface-muted text-ink-secondary border border-border'
                                }`}
                              >
                                {candidate.score}
                              </span>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>

                          {/* Must-Haves (x of y) */}
                          <td className="py-3.5 px-3 text-center">
                            {mustHaves.length > 0 ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                                  passedMustHaves === mustHaves.length
                                    ? 'bg-emerald-50 text-status-shortlist-text border border-emerald-200'
                                    : passedMustHaves > 0
                                    ? 'bg-amber-50 text-status-review-text border border-amber-200'
                                    : 'bg-red-50 text-status-danger-text border border-red-200'
                                }`}
                              >
                                {passedMustHaves} / {mustHaves.length}
                              </span>
                            ) : (
                              <span className="text-ink-muted text-[11px]">N/A</span>
                            )}
                          </td>

                          {/* Key Skills Chips */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {displayedSkills.map((sk: string, sIdx: number) => (
                                <span
                                  key={sIdx}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-muted text-ink-secondary border border-border/80"
                                >
                                  {sk}
                                </span>
                              ))}
                              {overflowSkillsCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-ink-muted bg-surface-subtle">
                                  +{overflowSkillsCount}
                                </span>
                              )}
                              {matchedSkills.length === 0 && (
                                <span className="text-ink-muted text-[11px]">—</span>
                              )}
                            </div>
                          </td>

                          {/* Decision Chip (Icon + Text) */}
                          <td className="py-3.5 px-3 text-center">
                            {candidate.decision === 'shortlisted' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-50 text-status-shortlist-text border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-status-shortlist-text" />
                                Shortlisted
                              </span>
                            )}
                            {candidate.decision === 'needs_review' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 text-status-review-text border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-status-review-text" />
                                Needs Review
                              </span>
                            )}
                            {candidate.decision === 'unshortlisted' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-muted text-ink-secondary border border-border">
                                <UserX className="w-3 h-3 text-ink-muted" />
                                Unshortlisted
                              </span>
                            )}
                            {(!candidate.decision || candidate.status === 'processing') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-ink-muted bg-surface-muted">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Parse Quality Badge */}
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                parseQuality === 'OK'
                                  ? 'bg-emerald-50 text-status-shortlist-text border border-emerald-200'
                                  : parseQuality === 'PARTIAL'
                                  ? 'bg-amber-50 text-status-review-text border border-amber-200'
                                  : 'bg-red-50 text-status-danger-text border border-red-200'
                              }`}
                            >
                              {parseQuality}
                            </span>
                          </td>

                          {/* Integrity Flag Icon */}
                          <td className="py-3.5 px-3 text-center">
                            {hasIntegrityFlags ? (
                              <span title="Integrity flag detected (e.g. hidden text, date anomaly)" className="inline-flex text-amber-600">
                                <AlertTriangle className="w-4 h-4" />
                              </span>
                            ) : (
                              <span title="Clean integrity verification" className="inline-flex text-status-shortlist-text">
                                <ShieldCheck className="w-4 h-4" />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between text-xs text-ink-secondary bg-surface-subtle/30">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, totalItems)} of {totalItems} candidates
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="font-mono text-ink-primary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Candidate Drawer */}
      {selectedCandidate && (
        <CandidateDrawer
          batchId={batchId!}
          candidate={selectedCandidate}
          isOpen={Boolean(selectedCandidate)}
          isBatchFinalized={isBatchFinalized}
          onClose={() => setSelectedCandidate(null)}
          onDecisionUpdated={(candidateId, newDecision) => {
            queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
            queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
            setSelectedCandidate((prev: any) => (prev ? { ...prev, decision: newDecision } : null));
          }}
        />
      )}

      {/* Modals */}
      {showCriteriaModal && (
        <CriteriaBuilderModal
          batchId={batchId!}
          isOpen={showCriteriaModal}
          currentCriteria={batch.criteria}
          currentCutoff={batch.cutoff}
          onClose={() => setShowCriteriaModal(false)}
          onCriteriaSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
            queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
          }}
        />
      )}

      {showFormsModal && (
        <BatchFormsModal
          batchId={batchId!}
          batchName={batch.jobTitle || batch.name}
          isOpen={showFormsModal}
          onClose={() => setShowFormsModal(false)}
        />
      )}

      {showEmailSettingsModal && (
        <EmailSettingsModal
          isOpen={showEmailSettingsModal}
          onClose={() => setShowEmailSettingsModal(false)}
        />
      )}

      {showTemplatesModal && (
        <EmailTemplateEditorModal
          batchId={batchId!}
          batchTitle={batch.jobTitle || batch.name}
          isOpen={showTemplatesModal}
          onClose={() => setShowTemplatesModal(false)}
        />
      )}

      {showFinalizeModal && (
        <FinalizeBatchModal
          batchId={batchId!}
          batchName={batch.name}
          candidateCounts={counts}
          isOpen={showFinalizeModal}
          onClose={() => setShowFinalizeModal(false)}
          onFinalizedSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
            queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
            setMainView('delivery');
          }}
        />
      )}

      {/* Delete Batch Confirmation Dialog */}
      {showDeleteBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-status-danger-text">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-ink-primary">Delete Screening Batch?</h3>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              This action is permanent and irreversible. All {counts.total} candidate records, scoring evaluations, and stored resumes will be deleted.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-ink-primary mb-1">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full text-xs p-2 border border-border rounded-lg bg-surface text-ink-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowDeleteBatchModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={deleteConfirmText !== 'DELETE' || isDeletingBatch}
                isLoading={isDeletingBatch}
                onClick={handleDeleteBatch}
              >
                Delete Everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
