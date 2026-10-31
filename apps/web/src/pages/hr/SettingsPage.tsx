import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  ShieldCheck,
  Building2,
  Trash2,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';

export const SettingsPage: React.FC = () => {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'privacy' | 'profile'>('privacy');

  // Form State
  const [retentionDays, setRetentionDays] = useState<number>(60);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: async () => {
      const res = await shortlistApi.getOrgSettings();
      if (res.retentionDays) {
        setRetentionDays(res.retentionDays);
      }
      return res;
    }
  });

  // Fetch Privacy Activity Logs
  const { data: activityLogs = [], isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['org-privacy-activity'],
    queryFn: () => shortlistApi.getOrgPrivacyActivity()
  });

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: () => shortlistApi.updateOrgSettings({ retentionDays }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      queryClient.invalidateQueries({ queryKey: ['org-privacy-activity'] });
      setIsSavedSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update retention policy');
      setIsSavedSuccess(false);
    }
  });

  // Run Lifecycle Cleanup Mutation
  const cleanupMutation = useMutation({
    mutationFn: () => shortlistApi.runDataLifecycleCleanup(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['org-privacy-activity'] });
      setIsSavedSuccess(true);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to trigger data lifecycle cleanup');
    }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-primary">
          Organization Settings
        </h1>
        <p className="text-xs text-slate-secondary mt-1">
          Manage workspace settings, automated data retention limits, and candidate privacy controls.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-border">
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'privacy'
              ? 'border-brand-indigo text-brand-indigo bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Data & Privacy</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'border-brand-indigo text-brand-indigo bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Organization Profile</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-state-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSavedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-state-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Settings successfully updated and logged to audit trail.</span>
        </div>
      )}

      {/* Tab: Data & Privacy */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          {/* Card: Retention Policy */}
          <div className="bg-white border border-slate-border rounded-lg p-6 shadow-soft space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-primary flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-indigo" />
                  Automated Data Retention Policy
                </h2>
                <p className="text-xs text-slate-secondary mt-1 max-w-xl leading-relaxed">
                  Candidate resumes, form answers, and deterministic scoring evaluations are automatically purged after this period. Expired records are deleted daily by background workers.
                </p>
              </div>

              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-state-success border border-emerald-200">
                GDPR & CCPA Compliant
              </span>
            </div>

            {isLoadingSettings ? (
              <CardSkeleton />
            ) : (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { days: 30, label: '30 Days', desc: 'Short-cycle hiring' },
                    { days: 60, label: '60 Days', desc: 'Recommended default' },
                    { days: 90, label: '90 Days', desc: 'Standard enterprise' },
                    { days: 180, label: '180 Days', desc: 'Extended compliance' }
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setRetentionDays(opt.days)}
                      className={`p-3.5 text-left rounded-lg border transition-all ${
                        retentionDays === opt.days
                          ? 'border-brand-indigo bg-indigo-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-primary">{opt.label}</span>
                        {retentionDays === opt.days && (
                          <span className="w-2 h-2 rounded-full bg-brand-indigo"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-secondary">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-slate-500">
                    Changes apply immediately to newly uploaded candidates and future checks.
                  </span>

                  <button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saveMutation.isPending ? 'Saving...' : 'Save Retention Policy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card: Manual Lifecycle Purge Action */}
          <div className="bg-white border border-slate-border rounded-lg p-6 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-primary uppercase tracking-wider">
                Run Data Lifecycle Cleanup
              </h3>
              <p className="text-xs text-slate-secondary mt-0.5">
                Immediately trigger the background worker to purge all expired candidate rows and orphaned storage files.
              </p>
            </div>

            <button
              type="button"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap shadow-xs disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${cleanupMutation.isPending ? 'animate-spin' : ''}`} />
              {cleanupMutation.isPending ? 'Cleaning up...' : 'Run Lifecycle Purge Now'}
            </button>
          </div>

          {/* Card: Deletion Activity & Audit Log */}
          <div className="bg-white border border-slate-border rounded-lg shadow-soft overflow-hidden">
            <div className="p-5 border-b border-slate-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-primary">
                  Deletion Activity & Compliance Audit Log
                </h3>
                <p className="text-xs text-slate-secondary mt-0.5">
                  Chronological log of candidate privacy erasures, batch deletions, and retention updates.
                </p>
              </div>

              <span className="text-[11px] text-slate-400">
                Personal identities anonymized for privacy
              </span>
            </div>

            {isLoadingLogs ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading activity logs...</div>
            ) : activityLogs.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No deletion events recorded</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Candidate privacy requests and batch deletions will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-border text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Target Entity</th>
                    <th className="py-2.5 px-4">Details / Compliance Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            log.action === 'CANDIDATE_DATA_DELETED_BY_REQUEST'
                              ? 'bg-red-50 text-state-danger border border-red-200'
                              : log.action === 'BATCH_DELETED'
                              ? 'bg-amber-50 text-state-warning border border-amber-200'
                              : 'bg-indigo-50 text-brand-indigo border border-indigo-200'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {log.entity}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {log.meta?.message || JSON.stringify(log.meta || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-border rounded-lg p-6 shadow-soft space-y-5">
          <div className="flex items-center justify-between border-b border-slate-border pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-primary">Organization Identity</h2>
              <p className="text-xs text-slate-secondary mt-0.5">
                Workspace tenancy and administrative details.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-state-success border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-state-success"></span>
              Isolated Multi-Tenant Node
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Organization Name</span>
              <p className="text-sm font-bold text-slate-primary mt-1">
                {organization?.name || 'My Organization'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Organization UUID</span>
              <p className="text-xs font-mono text-slate-600 mt-1 break-all">
                {organization?.id || '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

