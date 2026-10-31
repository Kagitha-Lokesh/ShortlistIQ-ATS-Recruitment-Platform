import React, { useState, useMemo } from 'react';
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
  Trash2
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';

export const BatchDetailPage: React.FC = () => {
  const { id: batchId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // State
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
  const navigate = useNavigate();

  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'mustHaves'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

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
    onSuccess: () => {
      setSelectedCandidateIds([]);
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
    }
  });

  // Export CSV handler
  const handleExportCsv = async () => {
    if (!batchId || !batch) return;
    try {
      setIsExportingCsv(true);
      await shortlistApi.downloadBatchCsv(batchId, `${batch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_candidates.csv`);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Delete Batch handler
  const handleDeleteBatch = async () => {
    if (!batchId || deleteConfirmText.trim() !== 'DELETE') return;
    try {
      setIsDeletingBatch(true);
      await shortlistApi.deleteBatch(batchId);
      navigate('/hr/dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to delete batch');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Filtered and Sorted Candidates
  const filteredAndSortedCandidates = useMemo(() => {
    let result = candidates.filter((c: any) => {
      if (filterDecision === 'shortlisted' && c.decision !== 'shortlisted') return false;
      if (filterDecision === 'needs_review' && c.decision !== 'needs_review') return false;
      if (filterDecision === 'unshortlisted' && c.decision !== 'unshortlisted') return false;
      if (filterDecision === 'failed' && c.status !== 'failed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.fullName?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }

      return true;
    });

    // Sorting
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

  // Pagination calculations
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
        <h2 className="text-base font-semibold text-slate-primary">Batch not found</h2>
        <Link to="/hr/dashboard" className="text-xs text-brand-indigo underline mt-2 block">
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
      {/* Back and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-border pb-5">
        <div>
          <Link
            to="/hr/dashboard"
            className="inline-flex items-center gap-1 text-xs text-slate-secondary hover:text-brand-indigo mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-primary">{batch.name}</h1>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase flex items-center gap-1 ${
                isBatchFinalized
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : batch.status === 'active'
                  ? 'bg-emerald-50 text-state-success border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isBatchFinalized && <Lock className="w-3 h-3" />}
              {batch.status}
            </span>
          </div>
          <p className="text-xs text-slate-secondary mt-1">
            Target Role: <span className="font-semibold text-slate-primary">{batch.jobTitle}</span> • Cutoff:{' '}
            <span className="font-semibold text-brand-indigo">{batch.cutoff}%</span> • Criteria Rules:{' '}
            <span className="font-semibold text-slate-primary">{criteriaCount} active</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Email Accounts Button */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Mail className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowEmailSettingsModal(true)}
            title="Configure Gmail or Outlook OAuth"
          >
            Email Accounts
          </Button>

          {/* Email Templates Button */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileCode className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowTemplatesModal(true)}
          >
            Templates
          </Button>

          {/* Application Forms Button */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileText className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowFormsModal(true)}
          >
            Forms
          </Button>

          {/* Configure Criteria Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isBatchFinalized}
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
            onClick={() => setShowCriteriaModal(true)}
            title={isBatchFinalized ? 'Criteria locked because batch is finalized' : 'Configure Criteria'}
          >
            Criteria
          </Button>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isExportingCsv || candidates.length === 0}
            isLoading={isExportingCsv}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCsv}
            title="Export candidates to CSV"
          >
            Export CSV
          </Button>

          {/* Delete Batch Button */}
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-state-danger" />}
            onClick={() => setShowDeleteBatchModal(true)}
            title="Permanently delete batch and candidate files"
          >
            Delete Batch
          </Button>

          {/* Add Resumes Button */}
          {!isBatchFinalized && (
            <Button
              variant="secondary"
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
              leftIcon={<Lock className="w-3.5 h-3.5 text-amber-600" />}
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
        </div>
      </div>

      {/* Accordion Job Description Preview */}
      <div className="bg-white border border-slate-border rounded-lg shadow-soft overflow-hidden">
        <button
          onClick={() => setIsJdExpanded(!isJdExpanded)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
        >
          <div className="text-xs font-semibold text-slate-primary flex items-center gap-2">
            <span>Job Description & Evaluation Standards</span>
            <span className="text-[11px] text-slate-400 font-normal">
              ({batch.jdText?.length || 0} characters)
            </span>
          </div>
          <div className="text-xs text-slate-secondary flex items-center gap-1">
            {isJdExpanded ? 'Hide' : 'View full text'}
            {isJdExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isJdExpanded && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3">
            <pre className="text-xs text-slate-600 font-sans whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-slate-50 p-3 rounded border border-slate-100">
              {batch.jdText}
            </pre>
          </div>
        )}
      </div>

      {/* Upload Dropdown Banner if toggled */}
      {showUploadModal && (
        <div className="bg-white border-2 border-brand-indigo/30 rounded-lg p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-primary">Upload Additional Resumes</h3>
            <button
              onClick={() => setShowUploadModal(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
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

      {/* Primary View Switcher: Candidate Pipeline vs Email Delivery Logs */}
      <div className="flex border-b border-slate-border">
        <button
          onClick={() => setMainView('candidates')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            mainView === 'candidates'
              ? 'border-brand-indigo text-brand-indigo bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Candidate Pipeline</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
            {candidates.length}
          </span>
        </button>

        <button
          onClick={() => setMainView('delivery')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            mainView === 'delivery'
              ? 'border-brand-indigo text-brand-indigo bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email Delivery Logs</span>
          {isBatchFinalized && (
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-state-success font-bold uppercase">
              Active
            </span>
          )}
        </button>
      </div>

      {/* Finalized Warning Banner */}
      {isBatchFinalized && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <div>
              <span className="font-semibold">Batch Finalized & Decisions Locked:</span> Candidate evaluations, scoring thresholds, and manual decisions are frozen. Outbound decision emails have been queued.
            </div>
          </div>
          {mainView !== 'delivery' && (
            <button
              onClick={() => setMainView('delivery')}
              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-200/80 hover:bg-amber-200 text-amber-900 rounded font-semibold text-xs whitespace-nowrap transition-colors"
            >
              <Mail className="w-3 h-3" />
              Check Delivery Status &rarr;
            </button>
          )}
        </div>
      )}

      {mainView === 'delivery' ? (
        <EmailDeliveryView batchId={batchId!} />
      ) : (
        <>
          {/* Live Processing Tracker Card */}
          <div className="bg-white border border-slate-border rounded-lg p-6 shadow-soft space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-border pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-primary">Screening & Shortlisting Status</h2>
            {isProcessing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-brand-indigo border border-indigo-200 animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                Parsing & Scoring Active
              </span>
            )}
            {!isProcessing && counts.total > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-state-success border border-emerald-200">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Processing Complete
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isProcessing && (
              <span className="text-xs text-slate-secondary flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                ETA: ~{estimatedSecondsRemaining}s remaining
              </span>
            )}

            {counts.failed > 0 && (
              <button
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded text-state-danger bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                Retry Failed ({counts.failed})
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-secondary">
            <span>
              <strong>{processedCount}</strong> of <strong>{counts.total}</strong> resumes evaluated
            </span>
            <span className="font-semibold text-slate-primary">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isProcessing ? 'bg-brand-indigo' : 'bg-state-success'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 4 Stat Breakdown Bars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-surface-subtle border border-border rounded-md">
            <div className="text-xl font-bold text-ink-primary tabular-nums tracking-tight">{counts.total}</div>
            <div className="text-[11px] text-ink-secondary mt-0.5">Total Candidates</div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
            <div className="text-xl font-bold text-emerald-800 tabular-nums tracking-tight">{counts.shortlisted}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">Shortlisted (≥{batch.cutoff}%)</div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <div className="text-xl font-bold text-amber-800 tabular-nums tracking-tight">{counts.needsReview}</div>
            <div className="text-[11px] text-amber-700 mt-0.5 font-medium">Needs Review (Borderline)</div>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-xl font-bold text-red-800 tabular-nums tracking-tight">{counts.failed}</div>
            <div className="text-[11px] text-red-700 mt-0.5 font-medium">Unreadable / Ingest Failure</div>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedCandidateIds.length > 0 && (
        <div className="sticky top-4 z-20 bg-slate-900 text-white rounded-lg px-4 py-3 shadow-lg flex items-center justify-between gap-4 border border-slate-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-brand-indigo text-white font-bold text-xs">
              {selectedCandidateIds.length}
            </span>
            <span className="text-xs font-medium">candidates selected</span>
          </div>

          <div className="flex items-center gap-2">
            {isBatchFinalized ? (
              <span className="text-xs font-semibold text-amber-300">
                Batch is finalized & locked. Decisions cannot be changed.
              </span>
            ) : (
              <>
                <button
                  onClick={() =>
                    bulkDecisionMutation.mutate({
                      candidateIds: selectedCandidateIds,
                      decision: 'shortlisted'
                    })
                  }
                  disabled={bulkDecisionMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-state-success hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Move to Shortlisted
                </button>

                <button
                  onClick={() =>
                    bulkDecisionMutation.mutate({
                      candidateIds: selectedCandidateIds,
                      decision: 'unshortlisted'
                    })
                  }
                  disabled={bulkDecisionMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                  Move to Unshortlisted
                </button>
              </>
            )}

            <button
              onClick={() => setSelectedCandidateIds([])}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Review Dashboard Table */}
      <div className="bg-white border border-slate-border rounded-lg shadow-soft overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: 'all', label: 'All', count: candidates.length },
              { id: 'shortlisted', label: 'Shortlisted', count: counts.shortlisted },
              { id: 'needs_review', label: 'Needs Review', count: counts.needsReview },
              { id: 'unshortlisted', label: 'Unshortlisted', count: counts.unshortlisted },
              { id: 'failed', label: 'Failed', count: counts.failed }
            ].map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => {
                  setFilterDecision(id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  filterDecision === id
                    ? 'bg-brand-indigo text-white shadow-xs'
                    : 'text-slate-secondary hover:text-slate-primary hover:bg-slate-100'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    filterDecision === id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Sort controls */}
          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs py-1.5 px-2 border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-brand-indigo bg-white"
              >
                <option value="score">Sort by Score</option>
                <option value="mustHaves">Sort by Must-Haves</option>
                <option value="name">Sort by Name</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 border border-slate-300 rounded text-slate-500 hover:text-brand-indigo hover:bg-slate-50 transition-colors"
                title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Candidate Table */}
        {isCandidatesLoading ? (
          <div className="p-8">
            <CardSkeleton />
          </div>
        ) : filteredAndSortedCandidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-secondary">
            No candidates found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-border text-slate-secondary uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      className="rounded border-slate-300 text-brand-indigo focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Must-Haves</th>
                  <th className="py-3 px-4">Key Skills</th>
                  <th className="py-3 px-4 text-center">Decision</th>
                  <th className="py-3 px-4">Status & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCandidates.map((candidate: any) => {
                  const isDuplicate = candidate.failureReason === 'DUPLICATE';
                  const isNoEmail = candidate.failureReason === 'NO_EMAIL';
                  const isEditingThisEmail = editingEmailId === candidate.id;
                  const isSelected = selectedCandidateIds.includes(candidate.id);

                  // Calculate matched must-haves
                  const criteriaResults = Array.isArray(candidate.criteriaResults) ? candidate.criteriaResults : [];
                  const mustHaves = criteriaResults.filter((c: any) => c.type === 'must-have' || c.type === 'must_have');
                  const passedMustHaves = mustHaves.filter((c: any) => c.passed).length;

                  // Extract matched skill chips
                  const matchedSkills = candidate.breakdown?.matchedKeywords || [];
                  const displayedSkills = matchedSkills.slice(0, 3);
                  const overflowSkillsCount = Math.max(0, matchedSkills.length - 3);

                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? 'bg-indigo-50/40' : ''
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
                          className="rounded border-slate-300 text-brand-indigo focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Candidate Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-primary hover:text-brand-indigo transition-colors">
                          {candidate.fullName}
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
                                className="text-xs px-2 py-0.5 border border-brand-indigo rounded focus:outline-none w-40"
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
                                className="p-1 bg-brand-indigo text-white rounded hover:bg-brand-hover disabled:opacity-50"
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
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors mt-0.5"
                            >
                              <Mail className="w-2.5 h-2.5" />
                              Missing Email
                            </button>
                          )
                        ) : (
                          <div className="text-[11px] text-slate-secondary">{candidate.email || '—'}</div>
                        )}
                      </td>

                      {/* Score Ring / Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {candidate.score !== null && candidate.score !== undefined ? (
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${
                              candidate.score >= batch.cutoff
                                ? 'bg-emerald-100 text-state-success'
                                : candidate.score >= batch.cutoff - 5
                                ? 'bg-amber-100 text-state-warning'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {candidate.score}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Matched Must-Haves */}
                      <td className="py-3.5 px-4 text-center">
                        {mustHaves.length > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              passedMustHaves === mustHaves.length
                                ? 'bg-emerald-50 text-state-success border border-emerald-200'
                                : 'bg-amber-50 text-state-warning border border-amber-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {passedMustHaves} / {mustHaves.length}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">N/A</span>
                        )}
                      </td>

                      {/* Key Skills Chips */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {displayedSkills.map((skill: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium truncate max-w-[90px]"
                            >
                              {skill}
                            </span>
                          ))}
                          {overflowSkillsCount > 0 && (
                            <span className="px-1 py-0.5 bg-slate-50 text-slate-400 rounded text-[10px] font-medium">
                              +{overflowSkillsCount}
                            </span>
                          )}
                          {displayedSkills.length === 0 && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Decision & Override Indicator */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
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
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}

                          {candidate.decisionSource === 'manual' && (
                            <span className="text-[9px] text-primary font-medium flex items-center gap-0.5">
                              <UserCheck className="w-2.5 h-2.5" />
                              Manual Override
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status & Flags */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {candidate.status === 'scored' && !isDuplicate && (
                            <span className="text-[11px] text-slate-500">Evaluated</span>
                          )}

                          {isDuplicate && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-state-warning border border-amber-200">
                              <Copy className="w-2.5 h-2.5" />
                              Duplicate
                            </span>
                          )}

                          {candidate.status === 'pending' && (
                            <span className="text-[11px] text-slate-400">In queue...</span>
                          )}

                          {candidate.status === 'processing' && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-brand-indigo font-medium">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              Parsing...
                            </span>
                          )}

                          {candidate.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-state-danger border border-red-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {candidate.failureReason || 'Failed'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredAndSortedCandidates.length > 0 && (
          <div className="p-4 border-t border-slate-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-secondary bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-brand-indigo"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                Showing {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} -{' '}
                {Math.min(totalItems, currentPage * pageSize)} of {totalItems} candidates
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-medium text-slate-primary">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Criteria Builder Modal */}
      <CriteriaBuilderModal
        batchId={batchId!}
        isOpen={showCriteriaModal}
        onClose={() => setShowCriteriaModal(false)}
        currentCriteria={batch.criteria}
        currentCutoff={batch.cutoff}
        onCriteriaSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
          queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
        }}
      />

      {/* Candidate Detail Slide-In Drawer */}
      <CandidateDrawer
        batchId={batchId!}
        candidate={selectedCandidate}
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
        isBatchFinalized={isBatchFinalized}
        onDecisionUpdated={(candidateId, decision) => {
          if (selectedCandidate && selectedCandidate.id === candidateId) {
            setSelectedCandidate({ ...selectedCandidate, decision, decisionSource: 'manual' });
          }
          queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
          queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
        }}
      />

      {/* Application Forms Modal */}
      <BatchFormsModal
        batchId={batchId!}
        batchName={batch.name}
        isOpen={showFormsModal}
        onClose={() => setShowFormsModal(false)}
      />

      {/* Email Settings Modal */}
      <EmailSettingsModal
        isOpen={showEmailSettingsModal}
        onClose={() => setShowEmailSettingsModal(false)}
      />

      {/* Email Template Editor Modal */}
      <EmailTemplateEditorModal
        batchId={batchId!}
        batchTitle={batch.jobTitle}
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
      />

      {/* Finalize Batch Modal */}
      <FinalizeBatchModal
        batchId={batchId!}
        batchName={batch.name}
        candidateCounts={counts}
        isOpen={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        onFinalizedSuccess={() => {
          setMainView('delivery');
        }}
      />

      {/* Delete Batch Confirmation Modal */}
      {showDeleteBatchModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-state-danger">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center border border-red-200">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-primary">Permanently Delete Batch</h3>
                <p className="text-[11px] text-slate-secondary">{batch.name}</p>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 leading-relaxed">
              <strong>Warning:</strong> This will permanently delete this recruitment batch, all {counts.total} candidate records, scoring breakdowns, and their uploaded PDF resumes from storage. This cannot be undone.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-primary mb-1">
                Type <span className="font-mono text-state-danger font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full text-xs font-mono border border-slate-300 rounded px-3 py-2 uppercase focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteBatchModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                disabled={deleteConfirmText.trim() !== 'DELETE' || isDeletingBatch}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded text-white bg-state-danger hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingBatch ? 'Deleting...' : 'Delete Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
