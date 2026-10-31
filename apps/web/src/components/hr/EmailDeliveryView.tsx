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
      <div className="bg-white border border-slate-border rounded-lg p-12 text-center text-xs text-slate-400">
        Loading delivery logs...
      </div>
    );
  }

  const sends = data?.sends || [];
  const stats = data?.stats || { total: 0, queued: 0, sent: 0, failed: 0, shortlisted: 0, unshortlisted: 0 };
  const sender = data?.connectedSender;

  if (sends.length === 0) {
    return (
      <div className="bg-white border border-slate-border rounded-lg p-12 text-center">
        <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-primary">No Emails Dispatched Yet</h3>
        <p className="text-xs text-slate-secondary max-w-sm mx-auto mt-1">
          When this batch is finalized, candidate decision emails will be formatted and queued for delivery here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Dispatches</p>
          <p className="text-xl font-bold text-slate-primary mt-1">{stats.total}</p>
          <p className="text-[10px] text-slate-secondary mt-0.5">
            {stats.shortlisted} Shortlisted • {stats.unshortlisted} Regret
          </p>
        </div>

        <div className="bg-white border border-slate-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Delivered</p>
          <p className="text-xl font-bold text-state-success mt-1">{stats.sent}</p>
          <p className="text-[10px] text-slate-secondary mt-0.5">
            {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}% success rate
          </p>
        </div>

        <div className="bg-white border border-slate-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">In Flight / Queued</p>
          <p className="text-xl font-bold text-state-warning mt-1">{stats.queued}</p>
          <p className="text-[10px] text-slate-secondary mt-0.5">Throttled (~1 per 2s)</p>
        </div>

        <div className="bg-white border border-slate-border rounded-lg p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Failed / Bounced</p>
          <p className="text-xl font-bold text-state-danger mt-1">{stats.failed}</p>
          <p className="text-[10px] text-slate-secondary mt-0.5">Retryable</p>
        </div>
      </div>

      {/* Header with Sender info and Retry button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-border rounded-lg p-3.5">
        <div className="flex items-center gap-2 text-xs text-slate-secondary">
          <Mail className="w-4 h-4 text-brand-indigo" />
          <span>
            Connected Sender: <strong className="text-slate-primary">{sender?.address || 'System Default'}</strong>
            {sender?.provider && (
              <span className="uppercase text-[10px] ml-1 px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-white bg-state-danger hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {retryMutation.isPending ? 'Retrying...' : `Retry Failed (${stats.failed})`}
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sends Table */}
      <div className="bg-white border border-slate-border rounded-lg shadow-soft overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-border text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-4">Candidate</th>
              <th className="py-2.5 px-4">Recipient Email</th>
              <th className="py-2.5 px-4">Decision Type</th>
              <th className="py-2.5 px-4">Delivery Status</th>
              <th className="py-2.5 px-4 text-right">Timestamp / Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sends.map((send) => (
              <tr key={send.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Candidate Name */}
                <td className="py-3 px-4 font-semibold text-slate-primary">
                  {send.candidateName || 'Unknown Candidate'}
                </td>

                {/* Candidate Email + Manual Correction Badge */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600">{send.candidateEmail}</span>
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-state-success border border-emerald-200">
                      <UserCheck className="w-3 h-3" />
                      Shortlisted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <UserX className="w-3 h-3" />
                      Unshortlisted
                    </span>
                  )}
                </td>

                {/* Status Badge */}
                <td className="py-3 px-4">
                  {send.status === 'sent' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-state-success border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Delivered
                    </span>
                  )}
                  {send.status === 'queued' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-state-warning border border-amber-200 animate-pulse">
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
                <td className="py-3 px-4 text-right text-slate-secondary text-[11px]">
                  {send.status === 'sent' && send.sentAt && (
                    <span>{new Date(send.sentAt).toLocaleTimeString()}</span>
                  )}
                  {send.status === 'failed' && send.errorMessage && (
                    <span className="text-state-danger font-medium truncate max-w-xs inline-block" title={send.errorMessage}>
                      {send.errorMessage}
                    </span>
                  )}
                  {send.status === 'queued' && (
                    <span className="text-slate-400">Waiting for throttle slot...</span>
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

