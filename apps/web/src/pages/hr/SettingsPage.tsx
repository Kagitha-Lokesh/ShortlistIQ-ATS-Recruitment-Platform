import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi, EmailAccount } from '../../lib/api.js';
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
  Mail,
  Plus,
  Server,
  Lock,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';

export const SettingsPage: React.FC = () => {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'privacy' | 'audit' | 'email' | 'profile'>('privacy');

  // Retention State
  const [retentionDays, setRetentionDays] = useState<number>(60);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email Connection State
  const [mockProvider, setMockProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [mockEmail, setMockEmail] = useState('recruiter@acme.com');

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

  // Fetch Connected Email Accounts
  const { data: emailAccounts = [], isLoading: isLoadingEmails } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => shortlistApi.getEmailAccounts()
  });

  // Save Retention Mutation
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['org-privacy-activity'] });
      setIsSavedSuccess(true);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to trigger data lifecycle cleanup');
    }
  });

  // Connect Email Mutation
  const connectEmailMutation = useMutation({
    mutationFn: ({ provider, email }: { provider: 'gmail' | 'outlook'; email: string }) =>
      shortlistApi.connectMockEmail(provider, email),
    onSuccess: (acc: EmailAccount) => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setIsSavedSuccess(true);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to connect email account');
    }
  });

  // Disconnect Email Mutation
  const disconnectEmailMutation = useMutation({
    mutationFn: (id: string) => shortlistApi.disconnectEmailAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setIsSavedSuccess(true);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to disconnect account');
    }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-xl font-bold tracking-tight text-ink-primary">
          Organization Settings & Privacy
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          Manage workspace settings, automated data retention limits, connected communication accounts, and candidate privacy audit trails.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'privacy'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Data Retention</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Deletion Requests & Audit Log</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'email'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Connections ({emailAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Workspace Tenancy</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-status-danger-text">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSavedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-status-shortlist-text">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Changes successfully saved and recorded to organization audit trail.</span>
        </div>
      )}

      {/* Tab 1: Retention Policy */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Automated Data Retention Policy
                </h2>
                <p className="text-xs text-ink-secondary mt-1 max-w-xl leading-relaxed">
                  Candidate resumes, form answers, and deterministic scoring evaluations are automatically purged after this period. Expired records are deleted daily by background workers.
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-status-shortlist-text border border-emerald-200 shrink-0">
                GDPR & CCPA Compliant
              </span>
            </div>

            {isLoadingSettings ? (
              <CardSkeleton />
            ) : (
              <div className="space-y-4 pt-2 border-t border-border">
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
                      className={`p-3.5 text-left rounded-xl border transition-all ${
                        retentionDays === opt.days
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-2xs'
                          : 'border-border hover:border-border-strong bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-ink-primary">{opt.label}</span>
                        {retentionDays === opt.days && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-[11px] text-ink-secondary">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                  <span className="text-xs text-ink-muted">
                    Changes apply immediately to newly uploaded candidates and future checks.
                  </span>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    isLoading={saveMutation.isPending}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Save Retention Policy
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Manual Lifecycle Purge Action */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wider">
                Run Data Lifecycle Cleanup
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                Immediately trigger the server worker to purge all expired candidate rows and orphaned storage files.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => cleanupMutation.mutate()}
              isLoading={cleanupMutation.isPending}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Run Lifecycle Purge Now
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: Deletion Activity & Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Deletion Activity & Compliance Audit Log
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                Chronological log of candidate privacy erasures, batch deletions, and retention updates.
              </p>
            </div>

            <span className="text-[11px] text-ink-muted font-mono">
              Identity details hashed for privacy
            </span>
          </div>

          {isLoadingLogs ? (
            <div className="p-12 text-center text-xs text-ink-muted">Loading audit log...</div>
          ) : activityLogs.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldCheck className="w-8 h-8 text-ink-muted mx-auto mb-2" />
              <p className="text-xs font-medium text-ink-primary">No deletion events recorded</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Candidate privacy requests and batch purges will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border text-ink-muted font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Details / Compliance Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-ink-muted text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            log.action === 'CANDIDATE_DATA_DELETED_BY_REQUEST'
                              ? 'bg-red-50 text-status-danger-text border border-red-200'
                              : log.action === 'BATCH_DELETED'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-ink-primary">
                        {log.entity}
                      </td>
                      <td className="py-3 px-4 text-ink-secondary text-[11px]">
                        {log.meta?.message || JSON.stringify(log.meta || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Email Connections */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-5">
            <div className="border-b border-border pb-4">
              <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Connected Email Accounts
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Send shortlisting notifications and status updates directly from your corporate inbox.
              </p>
            </div>

            {/* List of Connected Accounts */}
            {isLoadingEmails ? (
              <div className="p-8 text-center text-xs text-ink-muted">Loading email accounts...</div>
            ) : emailAccounts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl text-ink-muted bg-surface-subtle/30">
                <Mail className="w-8 h-8 mx-auto mb-2 text-ink-muted" />
                <p className="text-xs font-semibold text-ink-primary">No email accounts connected</p>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Connect a sender account below to dispatch decision emails to candidates.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emailAccounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="p-4 bg-surface border border-border rounded-xl flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center font-bold text-xs uppercase text-ink-primary">
                        {acc.provider[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-ink-primary">{acc.address}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-50 text-status-shortlist-text border border-emerald-200">
                            Connected
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-muted capitalize">
                          Provider: {acc.provider}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectEmailMutation.mutate(acc.id)}
                      isLoading={disconnectEmailMutation.isPending}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Connect Form */}
            <div className="p-4 bg-surface-subtle border border-border rounded-xl space-y-4 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Connect New Sender Account
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Provider
                  </label>
                  <select
                    value={mockProvider}
                    onChange={(e) => setMockProvider(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
                  >
                    <option value="gmail">Google Workspace / Gmail</option>
                    <option value="outlook">Microsoft 365 / Outlook</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Sender Email Address
                  </label>
                  <input
                    type="email"
                    value={mockEmail}
                    onChange={(e) => setMockEmail(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => connectEmailMutation.mutate({ provider: mockProvider, email: mockEmail })}
                  isLoading={connectEmailMutation.isPending}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Connect & Authenticate Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Profile & Tenancy */}
      {activeTab === 'profile' && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Workspace Identity & Isolation</h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Organizational tenancy and cryptographic storage boundaries.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-status-shortlist-text border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-status-shortlist-text" />
              Isolated Multi-Tenant Node
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-surface-subtle border border-border rounded-xl">
              <span className="text-[11px] font-semibold text-ink-muted uppercase">Workspace Name</span>
              <p className="text-sm font-bold text-ink-primary mt-1">
                {organization?.name || 'Recruitment Workspace'}
              </p>
            </div>

            <div className="p-4 bg-surface-subtle border border-border rounded-xl">
              <span className="text-[11px] font-semibold text-ink-muted uppercase">Workspace Tenancy UUID</span>
              <p className="text-xs font-mono text-ink-secondary mt-1 break-all">
                {organization?.id || '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
