import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { shortlistApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { EmailSettingsModal } from '../../components/hr/EmailSettingsModal.js';
import {
  Plus,
  Mail,
  ArrowRight,
  FolderPlus,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';

export const DashboardPage: React.FC = () => {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [showEmailSettingsModal, setShowEmailSettingsModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard-data'],
    queryFn: async () => {
      return shortlistApi.getDashboard();
    }
  });

  const stats = data?.stats;
  const recentBatches = data?.recentBatches || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">
            Screening & Batch Dashboard
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Workspace: <span className="font-semibold text-ink-primary">{organization?.name || 'Organization'}</span> • Transparent candidate evaluation
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Mail className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => setShowEmailSettingsModal(true)}
          >
            Email Accounts
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => navigate('/hr/batches/new')}
          >
            New Screening Batch
          </Button>
        </div>
      </div>

      {/* 4 Clean Typographic KPI Cards (Taste-Skill App Standard: Type, Not Tiles) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Batches */}
          <div className="bg-surface border border-border rounded-md p-4 shadow-subtle">
            <span className="text-xs font-medium text-ink-muted block mb-1">Active Batches</span>
            <div className="text-2xl font-bold text-ink-primary tabular-nums tracking-tight">
              {stats?.activeBatches ?? 0}
            </div>
            <p className="text-[11px] text-ink-muted mt-1">Screening pipelines</p>
          </div>

          {/* Resumes Processed */}
          <div className="bg-surface border border-border rounded-md p-4 shadow-subtle">
            <span className="text-xs font-medium text-ink-muted block mb-1">Resumes Scored</span>
            <div className="text-2xl font-bold text-ink-primary tabular-nums tracking-tight">
              {stats?.resumesProcessed ?? 0}
            </div>
            <p className="text-[11px] text-ink-muted mt-1">Deterministic parsing</p>
          </div>

          {/* Shortlisted Candidates */}
          <div className="bg-surface border border-border rounded-md p-4 shadow-subtle">
            <span className="text-xs font-medium text-ink-muted block mb-1">Shortlisted (Month)</span>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums tracking-tight">
              {stats?.shortlistedThisMonth ?? 0}
            </div>
            <p className="text-[11px] text-ink-muted mt-1">Met or exceeded cutoff</p>
          </div>

          {/* Emails Delivered */}
          <div className="bg-surface border border-border rounded-md p-4 shadow-subtle">
            <span className="text-xs font-medium text-ink-muted block mb-1">Dispatched Updates</span>
            <div className="text-2xl font-bold text-ink-primary tabular-nums tracking-tight">
              {stats?.emailsSent ?? 0}
            </div>
            <p className="text-[11px] text-ink-muted mt-1">HR notifications sent</p>
          </div>
        </div>
      )}

      {/* Recent Batches Section */}
      <div className="bg-surface border border-border rounded-md shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">Recent Recruitment Batches</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Review processing status, cutoff benchmarks, and candidate shortlists
            </p>
          </div>

          {recentBatches.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/hr/batches/new')}
            >
              New Batch
            </Button>
          )}
        </div>

        {recentBatches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border text-ink-muted flex items-center justify-center mx-auto mb-3">
              <FolderPlus className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-ink-primary mb-1">
              No recruitment batches active
            </h3>
            <p className="text-xs text-ink-secondary max-w-sm mx-auto mb-5 leading-relaxed">
              Create a batch, upload candidate PDF resumes, and evaluate requirements with grounded evidence citations.
            </p>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/hr/batches/new')}
            >
              Create First Batch
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-subtle border-b border-border text-ink-muted uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Batch & Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 w-44">Parsing Progress</th>
                  <th className="py-2.5 px-3 text-center">Cutoff</th>
                  <th className="py-2.5 px-3 text-center">Shortlisted</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentBatches.map((batch: any) => {
                  const counts = batch.candidateCounts || {};
                  const total = counts.total || 0;
                  const processed = (counts.scored || 0) + (counts.failed || 0);
                  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
                  const isProcessing = (counts.pending || 0) > 0 || (counts.processing || 0) > 0;

                  return (
                    <tr key={batch.id} className="hover:bg-surface-hover transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/hr/batches/${batch.id}`}
                          className="font-semibold text-ink-primary hover:text-brand-accent transition-colors block"
                        >
                          {batch.name}
                        </Link>
                        <span className="text-[11px] text-ink-muted block mt-0.5">{batch.jobTitle}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            batch.status === 'finalized'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : batch.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {batch.status}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-ink-secondary">
                            <span>
                              {processed} / {total} resumes
                            </span>
                            <span className="font-semibold text-ink-primary tabular-nums">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isProcessing ? 'bg-primary' : 'bg-emerald-600'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center tabular-nums font-semibold text-ink-primary">
                        {batch.cutoff}%
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 tabular-nums">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {counts.shortlisted || 0}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-ink-muted text-[11px]">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/hr/batches/${batch.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-primary hover:text-brand-accent transition-colors"
                        >
                          Review Batch
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Settings Modal */}
      {showEmailSettingsModal && (
        <EmailSettingsModal
          isOpen={showEmailSettingsModal}
          onClose={() => setShowEmailSettingsModal(false)}
        />
      )}
    </div>
  );
};
