import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi, EmailBatchSendsResponse } from '../../lib/api.js';
import {
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  UserCheck,
  UserX,
  Edit2
} from 'lucide-react';

interface EmailDeliveryViewProps {
  batchId: string;
}

export const EmailDeliveryView: React.FC<EmailDeliveryViewProps> = ({ batchId }) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery<EmailBatchSendsResponse>({
    queryKey: ['batch-email-sends', batchId],
    queryFn: () => shortlistApi.getBatchEmailSends(batchId),
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      // Auto-poll every 2 seconds if any emails are still queued
      const hasQueued = (query.state.data?.stats.queued || 0) > 0;
      return hasQueued ? 2000 : false;
    }
  });

  const retryMutation = useMutation({
    mutationFn: () => shortlistApi.retryFailedEmailSends(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-email-sends', batchId] });
    }
  });

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-12 text-center text-xs text-ink-muted">
        Loading delivery logs...
      </div>
    );
  }

  const sends = data?.sends || [];
  const stats = data?.stats || { total: 0, queued: 0, sent: 0, failed: 0, shortlisted: 0, unshortlisted: 0 };
  const sender = data?.connectedSender;

  if (sends.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-12 text-center">
        <Mail className="w-10 h-10 text-ink-muted mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-ink-primary">No Emails Dispatched Yet</h3>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto mt-1">
          When this batch is finalized, candidate decision emails will be formatted and queued for delivery here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Total Dispatches</p>
          <p className="text-xl font-bold text-ink-primary mt-1 font-mono">{stats.total}</p>
          <p className="text-[11px] text-ink-secondary mt-0.5">
            {stats.shortlisted} Shortlisted • {stats.unshortlisted} Regret
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Delivered</p>
          <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">{stats.sent}</p>
          <p className="text-[11px] text-ink-secondary mt-0.5">
            {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}% success rate
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">In Flight / Queued</p>
          <p className="text-xl font-bold text-amber-700 mt-1 font-mono">{stats.queued}</p>
          <p className="text-[11px] text-ink-secondary mt-0.5">Throttled (~1 per 2s)</p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[10px] font-bold text-state-danger uppercase tracking-wider">Failed / Bounced</p>
          <p className="text-xl font-bold text-state-danger mt-1 font-mono">{stats.failed}</p>
          <p className="text-[11px] text-ink-secondary mt-0.5">Retryable</p>
        </div>
      </div>

      {/* Header with Sender info and Retry button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-lg p-3.5">
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <Mail className="w-4 h-4 text-brand shrink-0" />
          <span>
            Connected Sender: <strong className="text-ink-primary font-mono">{sender?.address || 'System Default'}</strong>
            {sender?.provider && (
              <span className="uppercase text-[10px] ml-1.5 px-1.5 py-0.5 bg-surface-subtle border border-border rounded text-ink-secondary font-semibold">
                {sender.provider}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {stats.failed > 0 && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-white bg-state-danger hover:bg-red-700 transition-colors shadow-2xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {retryMutation.isPending ? 'Retrying...' : `Retry Failed (${stats.failed})`}
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-border bg-surface text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sends Table */}
      <div className="bg-surface border border-border rounded-lg shadow-soft overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-subtle border-b border-border text-ink-muted font-bold uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-4">Candidate</th>
              <th className="py-2.5 px-4">Recipient Email</th>
              <th className="py-2.5 px-4">Decision Type</th>
              <th className="py-2.5 px-4">Delivery Status</th>
              <th className="py-2.5 px-4 text-right">Timestamp / Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sends.map((send) => (
              <tr key={send.id} className="hover:bg-surface-subtle transition-colors">
                {/* Candidate Name */}
                <td className="py-3 px-4 font-semibold text-ink-primary">
                  {send.candidateName || 'Unknown Candidate'}
                </td>

                {/* Candidate Email + Manual Correction Badge */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink-secondary">{send.candidateEmail}</span>
                    {send.isManualEmail && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                        title="Candidate email was manually entered or updated by HR"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        Manually Provided
                      </span>
                    )}
                  </div>
                </td>

                {/* Kind */}
                <td className="py-3 px-4">
                  {send.kind === 'shortlisted' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <UserCheck className="w-3 h-3" />
                      Shortlisted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-subtle text-ink-muted border border-border">
                      <UserX className="w-3 h-3" />
                      Unshortlisted
                    </span>
                  )}
                </td>

                {/* Status Badge */}
                <td className="py-3 px-4">
                  {send.status === 'sent' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Delivered
                    </span>
                  )}
                  {send.status === 'queued' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                      <Clock className="w-3 h-3" />
                      Queued
                    </span>
                  )}
                  {send.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-state-danger border border-red-200">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  )}
                </td>

                {/* Details / Timestamp */}
                <td className="py-3 px-4 text-right text-ink-muted text-[11px] font-mono">
                  {send.status === 'sent' && send.sentAt && (
                    <span>{new Date(send.sentAt).toLocaleTimeString()}</span>
                  )}
                  {send.status === 'failed' && send.errorMessage && (
                    <span className="text-state-danger font-medium truncate max-w-xs inline-block" title={send.errorMessage}>
                      {send.errorMessage}
                    </span>
                  )}
                  {send.status === 'queued' && (
                    <span className="text-ink-muted">Waiting for rate limit slot...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

