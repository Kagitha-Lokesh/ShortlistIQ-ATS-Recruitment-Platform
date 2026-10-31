import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi, FinalizeBatchResult } from '../../lib/api.js';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  ShieldAlert,
  Send,
  X,
  Clock,
  AlertCircle
} from 'lucide-react';

interface FinalizeBatchModalProps {
  batchId: string;
  batchName: string;
  candidateCounts: {
    total: number;
    shortlisted: number;
    unshortlisted: number;
    needsReview: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onFinalizedSuccess?: () => void;
}

export const FinalizeBatchModal: React.FC<FinalizeBatchModalProps> = ({
  batchId,
  batchName,
  candidateCounts,
  isOpen,
  onClose,
  onFinalizedSuccess
}) => {
  const queryClient = useQueryClient();
  const [confirmationText, setConfirmationText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get sender accounts to confirm one is connected
  const { data: accounts = [], isLoading: isAccountsLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => shortlistApi.getEmailAccounts(),
    enabled: isOpen
  });

  const connectedAccount = accounts[0] || null;
  const hasNeedsReview = (candidateCounts.needsReview || 0) > 0;
  const totalRecipients = (candidateCounts.shortlisted || 0) + (candidateCounts.unshortlisted || 0);

  // Finalize Mutation
  const finalizeMutation = useMutation<FinalizeBatchResult, Error>({
    mutationFn: () => shortlistApi.finalizeBatch(batchId, confirmationText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-candidates', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-email-sends', batchId] });
      if (onFinalizedSuccess) {
        onFinalizedSuccess();
      }
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to finalize batch');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg shadow-xl border border-border max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-ink-primary">
              <Lock className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Finalize Batch & Enqueue Emails</h2>
              <p className="text-[11px] text-ink-secondary truncate max-w-xs">{batchName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-muted hover:text-ink-primary hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2.5 text-xs text-state-danger">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Pre-Finalize Verification Checklist */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
              Pre-Finalize Checklist
            </h4>
            <div className="border border-border rounded divide-y divide-border bg-surface-subtle">
              {/* Check 1: 0 Needs Review */}
              <div className="p-2.5 px-3 flex items-center justify-between text-xs">
                <span className="text-ink-secondary font-medium">1. All candidates reviewed (0 pending)</span>
                {hasNeedsReview ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-state-danger bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <AlertCircle className="w-3 h-3" />
                    {candidateCounts.needsReview} pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Resolved (0 pending)
                  </span>
                )}
              </div>

              {/* Check 2: Connected Sender */}
              <div className="p-2.5 px-3 flex items-center justify-between text-xs">
                <span className="text-ink-secondary font-medium">2. Connected email sender</span>
                {connectedAccount ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    {connectedAccount.provider.toUpperCase()}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-state-danger bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <AlertCircle className="w-3 h-3" />
                    No account
                  </span>
                )}
              </div>

              {/* Check 3: Total Candidates with Decisions */}
              <div className="p-2.5 px-3 flex items-center justify-between text-xs">
                <span className="text-ink-secondary font-medium">3. Candidate notifications</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-primary bg-surface px-2 py-0.5 rounded border border-border">
                  <Mail className="w-3 h-3 text-brand" />
                  {totalRecipients} recipients
                </span>
              </div>
            </div>
          </div>

          {/* CRITICAL GUARDRAIL: needs_review candidates exist */}
          {hasNeedsReview ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-state-danger">
                <ShieldAlert className="w-4 h-4 text-state-danger" />
                <span>Finalization Blocked: Pending Reviews Required</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                There are still <strong>{candidateCounts.needsReview} candidate(s)</strong> awaiting review. All candidate decisions must be marked as either <strong>Shortlisted</strong> or <strong>Unshortlisted</strong> before automated decision emails can be triggered.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-surface border border-red-300 text-state-danger hover:bg-red-50 transition-colors shadow-2xs"
                >
                  Return to Candidate Review
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Recipient Breakdown Summary */}
              <div>
                <h4 className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2">
                  Recipient Dispatch Summary
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded">
                    <p className="text-xs text-emerald-800 font-medium">Shortlisted Candidates</p>
                    <p className="text-xl font-bold text-emerald-700 mt-1">
                      {candidateCounts.shortlisted}
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Shortlist decision email</p>
                  </div>
                  <div className="p-3 bg-surface-subtle border border-border rounded">
                    <p className="text-xs text-ink-primary font-medium">Unshortlisted Candidates</p>
                    <p className="text-xl font-bold text-ink-primary mt-1">
                      {candidateCounts.unshortlisted}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-0.5">Regret notification email</p>
                  </div>
                </div>
              </div>

              {/* Connected Sender Info */}
              <div className="p-3.5 border border-border rounded bg-surface-subtle flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-brand shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-ink-primary">
                      {connectedAccount
                        ? connectedAccount.address
                        : 'No sender account connected'}
                    </p>
                    <p className="text-[11px] text-ink-secondary">
                      {connectedAccount
                        ? `Sending via ${connectedAccount.provider.toUpperCase()} OAuth integration`
                        : 'Please connect an account in Email Settings first.'}
                    </p>
                  </div>
                </div>
                {!connectedAccount && (
                  <span className="text-[11px] font-semibold text-state-danger bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    Required
                  </span>
                )}
              </div>

              {/* Daily Limit Warning Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Provider Rate Limits & Throttling:</span> Major providers (Google Workspace / Microsoft 365) enforce daily sending quotas (500–2,000 emails/day). To protect inbox reputation and deliverability, emails are queued and dispatched with automatic spacing (~1 message every 2 seconds).
                </div>
              </div>

              {/* Batch Lock Notice */}
              <div className="p-3 bg-surface-subtle border border-border rounded flex items-start gap-2.5 text-xs text-ink-secondary">
                <Lock className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
                <span>
                  Once finalized, this batch is <strong>permanently locked</strong>. Candidate statuses, criteria scores, and cutoff thresholds cannot be modified while emails are queued.
                </span>
              </div>

              {/* Confirmation Input Guard */}
              <div className="pt-2 border-t border-border">
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Type <span className="font-mono text-state-danger font-bold">SEND</span> to confirm dispatch:
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type SEND in capital letters"
                  className="w-full text-xs font-mono border border-border rounded px-3 py-2 bg-surface text-ink-primary focus:outline-none focus:ring-1 focus:ring-ring uppercase tracking-wider"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-surface-subtle flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-surface border border-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors shadow-2xs"
          >
            Cancel
          </button>

          {!hasNeedsReview && (
            <button
              type="button"
              onClick={() => finalizeMutation.mutate()}
              disabled={
                confirmationText.trim() !== 'SEND' ||
                !connectedAccount ||
                finalizeMutation.isPending ||
                totalRecipients === 0
              }
              className="inline-flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold rounded text-white bg-state-danger hover:bg-red-700 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              {finalizeMutation.isPending ? 'Finalizing & Enqueuing...' : 'Finalize & Dispatch Emails'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

