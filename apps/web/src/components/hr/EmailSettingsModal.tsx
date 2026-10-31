import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi, EmailAccount } from '../../lib/api.js';
import {
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  ShieldCheck,
  Info,
  Laptop
} from 'lucide-react';

interface EmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailSettingsModal: React.FC<EmailSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const queryClient = useQueryClient();
  const [mockProvider, setMockProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [mockEmail, setMockEmail] = useState('recruiter@example.com');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => shortlistApi.getEmailAccounts(),
    enabled: isOpen
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => shortlistApi.disconnectEmailAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setSuccessMsg('Account disconnected and OAuth token revoked.');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to disconnect account');
    }
  });

  const mockConnectMutation = useMutation({
    mutationFn: ({ provider, email }: { provider: 'gmail' | 'outlook'; email: string }) =>
      shortlistApi.connectMockEmail(provider, email),
    onSuccess: (acc: EmailAccount) => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setSuccessMsg(`Successfully connected ${acc.provider.toUpperCase()} account: ${acc.address}`);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to connect test account');
    }
  });

  const handleOAuthConnect = async (provider: 'gmail' | 'outlook') => {
    try {
      setErrorMsg(null);
      const { url } = await shortlistApi.getOAuthConnectUrl(provider);
      // In production/oauth flow, this redirects to Google/Microsoft consent screen
      window.location.href = url;
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to initiate ${provider} OAuth`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-indigo">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-primary">Email Account Connections</h2>
              <p className="text-[11px] text-slate-secondary">
                Connect your business Gmail or Outlook account to dispatch candidate decisions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-state-danger">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-state-success">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Connected Accounts Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-primary uppercase tracking-wider mb-3">
              Active Sender Accounts
            </h3>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading connected accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No email accounts connected</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Connect Gmail or Outlook below to enable automated email dispatching.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 border border-slate-200 rounded-lg flex items-center justify-between bg-white hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-xs uppercase ${
                          acc.provider === 'gmail'
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}
                      >
                        {acc.provider === 'gmail' ? 'GM' : 'MS'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-primary">{acc.address}</p>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-state-success border border-emerald-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Connected
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-secondary">
                          {acc.provider === 'gmail' ? 'Google Workspace / Gmail' : 'Microsoft 365 / Outlook'} • AES-256 Encrypted
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => disconnectMutation.mutate(acc.id)}
                      disabled={disconnectMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-state-danger hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                      title="Revoke OAuth token and disconnect"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connect New Provider Options */}
          <div>
            <h3 className="text-xs font-semibold text-slate-primary uppercase tracking-wider mb-3">
              Connect a Provider
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gmail Button */}
              <button
                onClick={() => handleOAuthConnect('gmail')}
                className="p-4 border border-slate-200 rounded-lg text-left hover:border-brand-indigo hover:shadow-xs transition-all bg-white group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-slate-primary">Google Gmail</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-indigo transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-secondary leading-relaxed">
                    Connect via official Google OAuth with scope <code className="bg-slate-100 px-1 rounded text-[10px]">gmail.send</code>.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-semibold text-brand-indigo group-hover:underline">
                  Connect Google Account &rarr;
                </div>
              </button>

              {/* Outlook Button */}
              <button
                onClick={() => handleOAuthConnect('outlook')}
                className="p-4 border border-slate-200 rounded-lg text-left hover:border-brand-indigo hover:shadow-xs transition-all bg-white group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-slate-primary">Microsoft Outlook</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-indigo transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-secondary leading-relaxed">
                    Connect via Microsoft Graph API with delegated scope <code className="bg-slate-100 px-1 rounded text-[10px]">Mail.Send</code>.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-semibold text-brand-indigo group-hover:underline">
                  Connect Microsoft Account &rarr;
                </div>
              </button>
            </div>
          </div>

          {/* Important Verification Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <Info className="w-4 h-4 text-state-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">Developer & Testing Note:</span> Gmail OAuth for public users requires official Google verification. During development and testing, ensure your Google Cloud project is in test mode and add your test email under designated <strong>Test Users</strong>.
            </div>
          </div>

          {/* Quick Mock Connect for Local / Development Testing */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-semibold text-slate-primary">
                Instant Development Connection (Mock Mode)
              </h4>
            </div>
            <p className="text-[11px] text-slate-secondary">
              Use a mock account for testing finalization and queue dispatching without registering external API client IDs.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <select
                value={mockProvider}
                onChange={(e) => setMockProvider(e.target.value as 'gmail' | 'outlook')}
                className="w-full sm:w-36 text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo"
              >
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
              </select>

              <input
                type="email"
                value={mockEmail}
                onChange={(e) => setMockEmail(e.target.value)}
                placeholder="recruiter@example.com"
                className="w-full sm:flex-1 text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo"
              />

              <button
                type="button"
                onClick={() => mockConnectMutation.mutate({ provider: mockProvider, email: mockEmail })}
                disabled={mockConnectMutation.isPending || !mockEmail}
                className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-medium rounded text-white bg-slate-800 hover:bg-slate-900 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {mockConnectMutation.isPending ? 'Connecting...' : 'Connect Test Account'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-border bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

