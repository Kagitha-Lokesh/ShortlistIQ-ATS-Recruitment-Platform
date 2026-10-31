import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shortlistApi } from '../../lib/api.js';
import { FormBuilderModal } from './FormBuilderModal.js';
import {
  X,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  FileText,
  Users,
  AlertCircle
} from 'lucide-react';
import { CardSkeleton } from '../ui/Skeleton.js';

interface BatchFormsModalProps {
  batchId: string;
  batchName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BatchFormsModal: React.FC<BatchFormsModalProps> = ({
  batchId,
  batchName,
  isOpen,
  onClose
}) => {
  const queryClient = useQueryClient();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [formToEdit, setFormToEdit] = useState<any | null>(null);
  const [showBuilderModal, setShowBuilderModal] = useState(false);

  // Fetch batch forms
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['batch-forms', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      return shortlistApi.getBatchForms(batchId);
    },
    enabled: isOpen && Boolean(batchId)
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: async (formId: string) => {
      return shortlistApi.toggleFormPublished(formId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-forms', batchId] });
    }
  });

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      return shortlistApi.deleteForm(formId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-forms', batchId] });
    }
  });

  const handleCopyLink = (slug: string) => {
    const origin = window.location.origin;
    const url = `${origin}/apply/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-indigo" />
                <h2 className="text-base font-bold text-slate-primary">Application Forms</h2>
              </div>
              <p className="text-xs text-slate-secondary mt-0.5">
                Manage public candidate application forms for <span className="font-semibold text-slate-700">{batchName}</span>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFormToEdit(null);
                  setShowBuilderModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Form
              </button>
              <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-lg">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-primary">No application forms created yet</h3>
                <p className="text-xs text-slate-secondary max-w-md mx-auto mt-1 mb-4">
                  Create a public application form with custom screening questions and knockout rules to accept candidate
                  applications online.
                </p>
                <button
                  onClick={() => {
                    setFormToEdit(null);
                    setShowBuilderModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Form
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {forms.map((form: any) => {
                  const isCopied = copiedSlug === form.slug;
                  const publicUrl = `${window.location.origin}/apply/${form.slug}`;
                  const customFieldsCount = Array.isArray(form.schema?.fields)
                    ? form.schema.fields.filter((f: any) => !f.isLocked).length
                    : 0;
                  const knockoutCount = Array.isArray(form.knockoutRules) ? form.knockoutRules.length : 0;

                  return (
                    <div
                      key={form.id}
                      className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm font-bold text-slate-primary">{form.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              form.isPublished
                                ? 'bg-emerald-50 text-state-success border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {form.isPublished ? 'Published (Accepting)' : 'Closed'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => togglePublishMutation.mutate(form.id)}
                            disabled={togglePublishMutation.isPending}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              form.isPublished
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                            title={form.isPublished ? 'Close form to stop new submissions' : 'Open form to accept submissions'}
                          >
                            {form.isPublished ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                            {form.isPublished ? 'Close Form' : 'Re-open Form'}
                          </button>

                          <button
                            onClick={() => {
                              setFormToEdit(form);
                              setShowBuilderModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-brand-indigo hover:bg-slate-50 rounded border border-slate-200 transition-colors"
                            title="Edit Form Questions & Rules"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this form?')) {
                                deleteFormMutation.mutate(form.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-state-danger hover:bg-red-50 rounded border border-slate-200 transition-colors"
                            title="Delete Form"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Public URL Box */}
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-xs text-slate-400 shrink-0">Public URL:</span>
                        <input
                          type="text"
                          readOnly
                          value={publicUrl}
                          className="w-full text-xs bg-transparent border-0 font-mono text-slate-700 focus:outline-none"
                        />
                        <button
                          onClick={() => handleCopyLink(form.slug)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-state-success" /> : <Copy className="w-3.5 h-3.5" />}
                          {isCopied ? 'Copied!' : 'Copy Link'}
                        </button>
                        <a
                          href={`/apply/${form.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-500 hover:text-brand-indigo transition-colors shrink-0"
                          title="Open public page in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Users className="w-3.5 h-3.5 text-brand-indigo" />
                          {form.submissionCount ?? 0} Submissions
                        </span>
                        <span>•</span>
                        <span>{customFieldsCount} custom questions</span>
                        <span>•</span>
                        <span>{knockoutCount} knockout rules</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Builder Modal */}
      <FormBuilderModal
        batchId={batchId}
        isOpen={showBuilderModal}
        onClose={() => {
          setShowBuilderModal(false);
          setFormToEdit(null);
        }}
        formToEdit={formToEdit}
        onFormSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['batch-forms', batchId] });
        }}
      />
    </>
  );
};

