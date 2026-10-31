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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-primary">Finalize Batch & Dispatch Emails</h2>
              <p className="text-[11px] text-slate-secondary">{batchName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-state-danger">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CRITICAL GUARDRAIL: needs_review candidates exist */}
          {hasNeedsReview ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-state-danger">
                <ShieldAlert className="w-4 h-4 text-state-danger" />
                <span>Finalization Blocked: Pending Reviews</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                There are still <strong>{candidateCounts.needsReview} candidate(s)</strong> awaiting review. All candidate decisions must be finalized as either <strong>Shortlisted</strong> or <strong>Unshortlisted</strong> before automated decision emails can be triggered.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white border border-red-300 text-state-danger hover:bg-red-50 transition-colors"
                >
                  Return to Candidate Review
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Decision Breakdown Summary */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Recipient Breakdown
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                    <p className="text-xs text-emerald-800 font-medium">Shortlisted Candidates</p>
                    <p className="text-xl font-bold text-state-success mt-1">
                      {candidateCounts.shortlisted}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Will receive Acceptance Email</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-700 font-medium">Unshortlisted Candidates</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {candidateCounts.unshortlisted}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Will receive Regret Email</p>
                  </div>
                </div>
              </div>

              {/* Connected Sender Info */}
              <div className="p-3.5 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-brand-indigo" />
                  <div>
                    <p className="text-xs font-semibold text-slate-primary">
                      {connectedAccount
                        ? connectedAccount.address
                        : 'No sender account connected'}
                    </p>
                    <p className="text-[10px] text-slate-secondary">
                      {connectedAccount
                        ? `Sending via ${connectedAccount.provider.toUpperCase()} OAuth`
                        : 'Please connect an account in Email Settings first.'}
                    </p>
                  </div>
                </div>
                {!connectedAccount && (
                  <span className="text-[11px] font-semibold text-state-danger">Required</span>
                )}
              </div>

              {/* Daily Limit Warning Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-state-warning flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Provider Daily Rate Limits:</span> Gmail and Outlook enforce daily sending caps (e.g., 500-2,000/day). To ensure high deliverability and avoid spam filters, outbound emails are automatically throttled (~1 message per 2 seconds).
                </div>
              </div>

              {/* Batch Lock Notice */}
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
                <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>
                  Once finalized, this batch is <strong>permanently locked</strong>. Candidate statuses, criteria, and cutoff thresholds cannot be edited while emails are in flight.
                </span>
              </div>

              {/* Confirmation Input Guard */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-primary mb-1">
                  Type <span className="font-mono text-state-danger font-bold">SEND</span> to confirm dispatch:
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type SEND in capital letters"
                  className="w-full text-xs font-mono border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo uppercase"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-border bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
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
              className="inline-flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold rounded text-white bg-state-danger hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50"
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

