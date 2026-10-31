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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-indigo">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-primary">Decision Email Templates</h2>
              <p className="text-[11px] text-slate-secondary">
                Configure personalized communication dispatched upon batch finalization.
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

        {/* Tab Selection */}
        <div className="flex border-b border-slate-border bg-slate-50/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('shortlisted')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'shortlisted'
                ? 'border-brand-indigo text-brand-indigo bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-state-success"></span>
            Shortlisted Candidates Email
          </button>
          <button
            onClick={() => setActiveTab('unshortlisted')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'unshortlisted'
                ? 'border-brand-indigo text-brand-indigo bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Unshortlisted Candidates Email
          </button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between text-xs ${
              notification.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-state-success'
                : 'bg-red-50 border border-red-200 text-state-danger'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Editor Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading templates...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Editor & Variable Chips */}
              <div className="space-y-4">
                {/* Available Variables */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Available Dynamic Variables (Click to Insert)
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-slate-100 hover:bg-indigo-50 hover:text-brand-indigo border border-slate-200 rounded transition-colors text-slate-700"
                      >
                        <Sparkles className="w-3 h-3 text-brand-indigo" />
                        {v.token}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-primary mb-1">
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
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo"
                  />
                </div>

                {/* Body (HTML) Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-primary">
                      Email Body (HTML / Plain Text)
                    </label>
                    <span className="text-[10px] text-slate-400">HTML tags supported</span>
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
                    className="w-full text-xs font-mono border border-slate-300 rounded-md p-3 bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => testEmailMutation.mutate()}
                    disabled={testEmailMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {testEmailMutation.isPending ? 'Sending Test...' : 'Send Test to Me'}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Sends live preview to your authenticated HR email.
                  </span>
                </div>
              </div>

              {/* Right Column: Live Rendered Preview */}
              <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 pb-3 border-b border-slate-200">
                  <Eye className="w-4 h-4 text-brand-indigo" />
                  <span>Live Rendered Preview</span>
                  <span className="text-[10px] font-normal text-slate-400 ml-auto">
                    Sample Candidate: Alex Mercer
                  </span>
                </div>

                <div className="mt-3 bg-white border border-slate-200 rounded-md p-4 shadow-2xs flex-1 flex flex-col">
                  <div className="border-b border-slate-100 pb-2.5 mb-3">
                    <div className="text-[11px] text-slate-400">Subject:</div>
                    <div className="text-xs font-semibold text-slate-900 mt-0.5">
                      {renderedSubject || <span className="text-slate-300 italic">No subject specified</span>}
                    </div>
                  </div>

                  <div className="flex-1 text-xs text-slate-700 leading-relaxed overflow-y-auto">
                    {renderedBody ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: renderedBody }}
                        className="prose prose-xs max-w-none"
                      />
                    ) : (
                      <span className="text-slate-300 italic">Email body preview is empty</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                  <span>
                    Template uses standard HTML formatting. Recipient client will render inline styles and links safely.
                  </span>
                </div>
              </div>
            </div>
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

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
            className="px-5 py-1.5 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-xs disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Templates'}
          </button>
        </div>
      </div>
    </div>
  );
};

