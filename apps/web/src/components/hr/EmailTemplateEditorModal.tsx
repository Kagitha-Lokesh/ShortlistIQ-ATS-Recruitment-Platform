import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi, EmailTemplatesResponse } from '../../lib/api.js';
import {
  X,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  Info
} from 'lucide-react';

interface EmailTemplateEditorModalProps {
  batchId: string;
  batchTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EmailTemplateEditorModal: React.FC<EmailTemplateEditorModalProps> = ({
  batchId,
  batchTitle,
  isOpen,
  onClose
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'shortlisted' | 'unshortlisted'>('shortlisted');

  // Form state
  const [shortlistedSubject, setShortlistedSubject] = useState('');
  const [shortlistedBody, setShortlistedBody] = useState('');
  const [unshortlistedSubject, setUnshortlistedSubject] = useState('');
  const [unshortlistedBody, setUnshortlistedBody] = useState('');

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch Templates
  const { data: templates, isLoading } = useQuery<EmailTemplatesResponse>({
    queryKey: ['batch-templates', batchId],
    queryFn: () => shortlistApi.getBatchTemplates(batchId),
    enabled: isOpen && Boolean(batchId)
  });

  useEffect(() => {
    if (templates) {
      setShortlistedSubject(templates.shortlisted.subject || '');
      setShortlistedBody(templates.shortlisted.bodyHtml || '');
      setUnshortlistedSubject(templates.unshortlisted.subject || '');
      setUnshortlistedBody(templates.unshortlisted.bodyHtml || '');
    }
  }, [templates]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      shortlistApi.updateBatchTemplates(batchId, {
        shortlisted: {
          subject: shortlistedSubject,
          bodyHtml: shortlistedBody
        },
        unshortlisted: {
          subject: unshortlistedSubject,
          bodyHtml: unshortlistedBody
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-templates', batchId] });
      setNotification({
        type: 'success',
        message: 'Templates saved successfully!'
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to save templates.'
      });
    }
  });

  // Test Email Mutation
  const testEmailMutation = useMutation({
    mutationFn: () => shortlistApi.sendTestEmail(batchId, activeTab),
    onSuccess: (data) => {
      setNotification({
        type: 'success',
        message: `Test email dispatched to ${data.recipient}!`
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to send test email.'
      });
    }
  });

  // Insert variable into active textarea
  const insertVariable = (varName: string) => {
    if (activeTab === 'shortlisted') {
      setShortlistedBody((prev) => prev + varName);
    } else {
      setUnshortlistedBody((prev) => prev + varName);
    }
  };

  if (!isOpen) return null;

  // Live rendered sample data
  const currentSubject = activeTab === 'shortlisted' ? shortlistedSubject : unshortlistedSubject;
  const currentBody = activeTab === 'shortlisted' ? shortlistedBody : unshortlistedBody;

  const sampleRender = (template: string) => {
    return template
      .replace(/{{candidate_name}}/g, 'Alex Mercer')
      .replace(/{{job_title}}/g, batchTitle || 'Software Engineer')
      .replace(/{{company}}/g, 'Acme Technologies');
  };

  const renderedSubject = sampleRender(currentSubject);
  const renderedBody = sampleRender(currentBody);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg shadow-xl border border-border max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-brand">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Decision Email Templates</h2>
              <p className="text-[11px] text-ink-secondary">
                Configure personalized communication dispatched upon batch finalization.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-muted hover:text-ink-primary hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border bg-surface-subtle px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('shortlisted')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'shortlisted'
                ? 'border-brand text-brand bg-surface'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Shortlisted Candidates Email
          </button>
          <button
            onClick={() => setActiveTab('unshortlisted')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'unshortlisted'
                ? 'border-brand text-brand bg-surface'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-ink-muted" />
            Unshortlisted Candidates Email
          </button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`mx-6 mt-4 p-3 rounded flex items-center justify-between text-xs ${
              notification.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-state-danger'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-state-danger" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-ink-muted hover:text-ink-primary font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Editor Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink-muted">Loading templates...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Editor & Variable Chips */}
              <div className="space-y-4">
                {/* Available Variables */}
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Dynamic Merge Variables (Click to Insert)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Candidate Name', token: '{{candidate_name}}' },
                      { label: 'Job Title', token: '{{job_title}}' },
                      { label: 'Company Name', token: '{{company}}' }
                    ].map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertVariable(v.token)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-surface-subtle hover:bg-surface hover:text-brand border border-border rounded transition-colors text-ink-secondary"
                        title={`Insert ${v.label}`}
                      >
                        <Sparkles className="w-3 h-3 text-brand" />
                        {v.token}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-xs font-semibold text-ink-primary mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={activeTab === 'shortlisted' ? shortlistedSubject : unshortlistedSubject}
                    onChange={(e) =>
                      activeTab === 'shortlisted'
                        ? setShortlistedSubject(e.target.value)
                        : setUnshortlistedSubject(e.target.value)
                    }
                    placeholder="e.g. Next steps regarding your application for {{job_title}}"
                    className="w-full text-xs border border-border rounded px-3 py-2 bg-surface text-ink-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Body (HTML) Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-ink-primary">
                      Email Body (HTML / Plain Text)
                    </label>
                    <span className="text-[10px] text-ink-muted">HTML tags supported</span>
                  </div>
                  <textarea
                    rows={12}
                    value={activeTab === 'shortlisted' ? shortlistedBody : unshortlistedBody}
                    onChange={(e) =>
                      activeTab === 'shortlisted'
                        ? setShortlistedBody(e.target.value)
                        : setUnshortlistedBody(e.target.value)
                    }
                    placeholder="Enter email content..."
                    className="w-full text-xs font-mono border border-border rounded p-3 bg-surface text-ink-primary focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => testEmailMutation.mutate()}
                    disabled={testEmailMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded text-ink-primary bg-surface border border-border hover:bg-surface-hover transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {testEmailMutation.isPending ? 'Sending Test...' : 'Send Test to Me'}
                  </button>
                  <span className="text-[11px] text-ink-muted">
                    Dispatches preview to your authenticated recruiter email.
                  </span>
                </div>
              </div>

              {/* Right Column: Live Rendered Preview */}
              <div className="flex flex-col bg-surface-subtle border border-border rounded p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary pb-3 border-b border-border">
                  <Eye className="w-4 h-4 text-brand" />
                  <span>Live Rendered Preview</span>
                  <span className="text-[11px] font-normal text-ink-muted ml-auto">
                    Sample Candidate: Alex Mercer
                  </span>
                </div>

                <div className="mt-3 bg-surface border border-border rounded p-4 shadow-2xs flex-1 flex flex-col">
                  <div className="border-b border-border pb-2.5 mb-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">Subject:</div>
                    <div className="text-xs font-semibold text-ink-primary mt-0.5">
                      {renderedSubject || <span className="text-ink-muted italic">No subject specified</span>}
                    </div>
                  </div>

                  <div className="flex-1 text-xs text-ink-secondary leading-relaxed overflow-y-auto">
                    {renderedBody ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: renderedBody }}
                        className="prose prose-xs max-w-none text-ink-primary"
                      />
                    ) : (
                      <span className="text-ink-muted italic">Email body preview is empty</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 text-[11px] text-ink-muted">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-ink-muted" />
                  <span>
                    Template uses standard HTML formatting. Recipient client will render inline styles and links safely.
                  </span>
                </div>
              </div>
            </div>
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

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
            className="px-5 py-1.5 text-xs font-semibold rounded text-white bg-brand hover:bg-brand-hover transition-colors shadow-2xs disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Templates'}
          </button>
        </div>
      </div>
    </div>
  );
};

