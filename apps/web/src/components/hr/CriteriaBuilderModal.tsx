import React, { useState, useEffect } from 'react';
import { shortlistApi } from '../../lib/api.js';
import {
  X,
  Sparkles,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Eye
} from 'lucide-react';

export interface CriterionItem {
  id: string;
  label: string;
  type: 'must-have' | 'nice-to-have' | 'dealbreaker';
  weight: number;
  keywords?: string[];
  minYears?: number;
}

interface CriteriaBuilderModalProps {
  batchId: string;
  isOpen: boolean;
  onClose: () => void;
  currentCriteria?: any;
  currentCutoff?: number;
  onCriteriaSaved: () => void;
}

export const CriteriaBuilderModal: React.FC<CriteriaBuilderModalProps> = ({
  batchId,
  isOpen,
  onClose,
  currentCriteria,
  currentCutoff = 70,
  onCriteriaSaved
}) => {
  const [cutoff, setCutoff] = useState(currentCutoff);
  const [alwaysRequireAllMustHaves, setAlwaysRequireAllMustHaves] = useState(false);
  const [criteria, setCriteria] = useState<CriterionItem[]>([]);
  const [suggestedChips, setSuggestedChips] = useState<CriterionItem[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [previewCandidates, setPreviewCandidates] = useState<any[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize from batch
  useEffect(() => {
    if (isOpen) {
      setCutoff(currentCutoff || 70);
      if (currentCriteria) {
        if (Array.isArray(currentCriteria)) {
          setCriteria(currentCriteria);
        } else if (currentCriteria.items) {
          setCriteria(currentCriteria.items);
          setAlwaysRequireAllMustHaves(Boolean(currentCriteria.alwaysRequireAllMustHaves));
        }
      }
      loadAiSuggestions();
    }
  }, [isOpen, batchId]);

  const loadAiSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      const suggestions = await shortlistApi.suggestCriteria(batchId);
      setSuggestedChips(suggestions || []);
    } catch (err) {
      // Fallback
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddCriterion = (chip?: CriterionItem) => {
    if (chip) {
      // Add from suggestion chip
      setCriteria((prev) => [
        ...prev,
        {
          id: `crit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          label: chip.label,
          type: chip.type,
          weight: chip.weight || 7,
          keywords: chip.keywords || [],
          minYears: chip.minYears
        }
      ]);
      setSuggestedChips((prev) => prev.filter((s) => s.id !== chip.id));
    } else {
      // Add manual criterion
      setCriteria((prev) => [
        ...prev,
        {
          id: `crit_${Date.now()}`,
          label: '',
          type: 'must-have',
          weight: 7,
          keywords: []
        }
      ]);
    }
  };

  const handleUpdateCriterion = (id: string, updates: Partial<CriterionItem>) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleDeleteCriterion = (id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRunPreview = async () => {
    try {
      setIsPreviewing(true);
      setErrorMsg(null);
      const results = await shortlistApi.previewCriteria(batchId, {
        criteria,
        cutoff,
        alwaysRequireAllMustHaves
      });
      setPreviewCandidates(results);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to preview scoring.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSaveAndRescore = async () => {
    try {
      setIsSaving(true);
      setErrorMsg(null);
      await shortlistApi.saveCriteria(batchId, {
        criteria,
        cutoff,
        alwaysRequireAllMustHaves
      });
      onCriteriaSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update criteria.');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-border rounded-xl shadow-2xl max-w-3xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-border flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-brand-indigo flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-primary">
                Shortlisting Criteria & Qualification Rules
              </h2>
              <p className="text-[11px] text-slate-secondary">
                Configure deterministic rules. Changes will trigger a background re-score across all resumes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-state-danger rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* AI Suggested Criteria Chips */}
          <div className="space-y-2 bg-indigo-50/50 border border-indigo-100 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-indigo" />
                AI-Suggested Criteria from Job Description
              </span>
              {isLoadingSuggestions && (
                <span className="text-[11px] text-brand-indigo flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing JD...
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-secondary">
              Click any chip to add it directly to your candidate evaluation rules.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {suggestedChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleAddCriterion(chip)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white border border-indigo-200 text-brand-indigo hover:bg-brand-indigo hover:text-white transition-all shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span className="capitalize text-[10px] px-1 bg-indigo-100/70 text-brand-indigo rounded font-semibold mr-1">
                    {chip.type}
                  </span>
                  {chip.label}
                </button>
              ))}
              {!isLoadingSuggestions && suggestedChips.length === 0 && (
                <span className="text-[11px] text-slate-400 italic">
                  All suggested criteria have been added.
                </span>
              )}
            </div>
          </div>

          {/* Cutoff & Must-Haves Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-primary">
                  Qualification Cutoff Score
                </label>
                <span className="text-xs font-bold text-brand-indigo bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {cutoff}%
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={95}
                value={cutoff}
                onChange={(e) => setCutoff(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-brand-indigo"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>40% (Lenient)</span>
                <span>70% (Default)</span>
                <span>95% (Strict)</span>
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alwaysRequireAllMustHaves}
                  onChange={(e) => setAlwaysRequireAllMustHaves(e.target.checked)}
                  className="mt-0.5 rounded text-brand-indigo focus:ring-brand-indigo border-slate-300"
                />
                <div>
                  <span className="font-semibold text-slate-primary block">
                    Always Require All Must-Haves
                  </span>
                  <span className="text-[11px] text-slate-secondary block mt-0.5 leading-relaxed">
                    If enabled, candidates missing any must-have criterion cannot be shortlisted, regardless of ATS score.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Active Criteria Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-primary">
                Active Evaluation Criteria ({criteria.length})
              </h3>
              <button
                type="button"
                onClick={() => handleAddCriterion()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-indigo hover:text-brand-hover"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Manual Rule
              </button>
            </div>

            {criteria.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 rounded-lg text-slate-400">
                No custom criteria added yet. Add suggested chips above or click Add Manual Rule.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {criteria.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3 shadow-xs"
                  >
                    <span className="text-slate-400 font-mono text-[11px] w-4">
                      {index + 1}.
                    </span>

                    {/* Type Selector */}
                    <select
                      value={item.type}
                      onChange={(e) =>
                        handleUpdateCriterion(item.id, {
                          type: e.target.value as any
                        })
                      }
                      className="text-xs py-1 px-2 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none bg-slate-50 font-medium"
                    >
                      <option value="must-have">Must-Have</option>
                      <option value="nice-to-have">Nice-To-Have</option>
                      <option value="dealbreaker">Dealbreaker</option>
                    </select>

                    {/* Label Input */}
                    <input
                      type="text"
                      placeholder="e.g. 5+ years experience building React apps..."
                      value={item.label}
                      onChange={(e) =>
                        handleUpdateCriterion(item.id, { label: e.target.value })
                      }
                      className="flex-1 text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
                    />

                    {/* Weight (1 - 10) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-slate-400">Weight:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={item.weight || 7}
                        onChange={(e) =>
                          handleUpdateCriterion(item.id, {
                            weight: Number(e.target.value)
                          })
                        }
                        className="w-12 text-xs px-1.5 py-1 border border-slate-300 rounded text-center focus:outline-none"
                      />
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCriterion(item.id)}
                      className="p-1 text-slate-400 hover:text-state-danger rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sample Candidates Scoring Preview */}
          {previewCandidates && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <span className="font-semibold text-slate-primary block">
                Sample Candidates Preview (5 Resumes)
              </span>
              <div className="divide-y divide-slate-200">
                {previewCandidates.map((c) => (
                  <div key={c.candidateId} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-slate-primary">{c.fullName}</span>
                      <span className="text-slate-400 ml-2 text-[11px]">({c.email})</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{c.decisionReason}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-indigo">{c.score}%</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          c.decision === 'shortlisted'
                            ? 'bg-emerald-100 text-state-success'
                            : c.decision === 'needs_review'
                            ? 'bg-amber-100 text-state-warning'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {c.decision}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-border bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRunPreview}
            disabled={isPreviewing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs"
          >
            {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            Preview on 5 Candidates
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAndRescore}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Save & Re-score All Candidates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

