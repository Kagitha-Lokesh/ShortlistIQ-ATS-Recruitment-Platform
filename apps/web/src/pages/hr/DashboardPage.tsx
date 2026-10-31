import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { shortlistApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { EmailSettingsModal } from '../../components/hr/EmailSettingsModal.js';
import {
  Briefcase,
  Plus,
  Users,
  FileCheck,
  Mail,
  ArrowRight,
  FolderPlus
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';

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
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-primary">
            HR Recruitment Dashboard
          </h1>
          <p className="text-xs text-slate-secondary mt-1">
            Organization: <span className="font-semibold text-slate-primary">{organization?.name || 'Organization'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setShowEmailSettingsModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            Email Accounts
          </button>
          <button
            onClick={() => navigate('/hr/batches/new')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Batch
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Active Batches */}
          <div className="bg-white border border-slate-border rounded-lg p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-secondary">Active Batches</span>
              <div className="w-7 h-7 rounded bg-indigo-50 text-brand-indigo flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-primary">{stats?.activeBatches ?? 0}</div>
            <p className="text-[11px] text-slate-400 mt-1">Recruitment campaigns</p>
          </div>

          {/* Resumes Processed */}
          <div className="bg-white border border-slate-border rounded-lg p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-secondary">Resumes Processed</span>
              <div className="w-7 h-7 rounded bg-emerald-50 text-state-success flex items-center justify-center">
                <FileCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-primary">{stats?.resumesProcessed ?? 0}</div>
            <p className="text-[11px] text-slate-400 mt-1">Deterministic scored</p>
          </div>

          {/* Shortlisted This Month */}
          <div className="bg-white border border-slate-border rounded-lg p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-secondary">Shortlisted (Month)</span>
              <div className="w-7 h-7 rounded bg-amber-50 text-state-warning flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-primary">{stats?.shortlistedThisMonth ?? 0}</div>
            <p className="text-[11px] text-slate-400 mt-1">Met or exceeded cutoff</p>
          </div>

          {/* Emails Sent */}
          <div className="bg-white border border-slate-border rounded-lg p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-secondary">Emails Sent</span>
              <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-primary">{stats?.emailsSent ?? 0}</div>
            <p className="text-[11px] text-slate-400 mt-1">Automated candidate updates</p>
          </div>
        </div>
      )}

      {/* Recent Batches Section */}
      <div className="bg-white border border-slate-border rounded-lg shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-primary">Recent Recruitment Batches</h2>
            <p className="text-xs text-slate-secondary mt-0.5">
              Monitor resume parsing progress and qualification rates
            </p>
          </div>

          {recentBatches.length > 0 && (
            <button
              onClick={() => navigate('/hr/batches/new')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-indigo hover:text-brand-hover"
            >
              <Plus className="w-3.5 h-3.5" />
              New Batch
            </button>
          )}
        </div>

        {recentBatches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <FolderPlus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-primary mb-1">
              No recruitment batches yet
            </h3>
            <p className="text-xs text-slate-secondary max-w-sm mx-auto mb-6 leading-relaxed">
              Create your first batch, upload hundreds of candidate PDF resumes, and let the deterministic engine parse, score, and rank them automatically.
            </p>
            <button
              onClick={() => navigate('/hr/batches/new')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Batch
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-border text-slate-secondary uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-5">Batch & Job Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 w-48">Processing Progress</th>
                  <th className="py-3 px-4 text-center">Cutoff</th>
                  <th className="py-3 px-4 text-center">Shortlisted</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBatches.map((batch: any) => {
                  const counts = batch.candidateCounts;
                  const total = counts.total || 0;
                  const processed = counts.scored + counts.failed;
                  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
                  const isProcessing = counts.pending > 0 || counts.processing > 0;

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <Link
                          to={`/hr/batches/${batch.id}`}
                          className="font-medium text-slate-primary hover:text-brand-indigo transition-colors block"
                        >
                          {batch.name}
                        </Link>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{batch.jobTitle}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            batch.status === 'active'
                              ? 'bg-emerald-50 text-state-success border border-emerald-200'
                              : batch.status === 'draft'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {batch.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-primary font-medium">
                              {processed} / {total}
                            </span>
                            <span className="text-slate-secondary">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                isProcessing ? 'bg-brand-indigo animate-pulse' : 'bg-state-success'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          {counts.failed > 0 && (
                            <span className="text-[10px] text-state-danger font-medium block">
                              {counts.failed} failed
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-primary">
                        {batch.cutoff}%
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-state-success">
                          {counts.shortlisted}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <Link
                          to={`/hr/batches/${batch.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-indigo bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                        >
                          View
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

      <EmailSettingsModal
        isOpen={showEmailSettingsModal}
        onClose={() => setShowEmailSettingsModal(false)}
      />
    </div>
  );
};
