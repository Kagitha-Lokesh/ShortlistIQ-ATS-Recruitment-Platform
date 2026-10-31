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
  Eye,
  Check,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';

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
  const [activeTab, setActiveTab] = useState<'criteria' | 'jd-quality'>('criteria');

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
    } catch {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-3xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-subtle/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-primary">
                Shortlisting Criteria & Qualification Rules
              </h2>
              <p className="text-[11px] text-ink-secondary">
                Configure deterministic rules. Changes trigger background re-scoring with grounded evidence citations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink-primary rounded-md hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-border px-6 pt-2 bg-surface">
          <button
            onClick={() => setActiveTab('criteria')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'criteria'
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Rules & Cutoff Benchmark
          </button>
          <button
            onClick={() => setActiveTab('jd-quality')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'jd-quality'
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Confirmed Requirements & JD Audit
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-status-danger-text rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'jd-quality' ? (
            <div className="space-y-4">
              <div className="bg-surface-subtle border border-border p-4 rounded-xl space-y-2">
                <h3 className="font-semibold text-ink-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-status-shortlist-text" />
                  Job Description Quality Analysis
                </h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Clear, specific job requirements produce higher scoring accuracy and prevent candidates from being penalized for ambiguous terminology.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-status-shortlist-text shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Concrete Competencies Detected</span>
                    <span className="text-[11px] text-emerald-900 block mt-0.5">
                      Technical requirements and core responsibilities are well-isolated and ready for deterministic match evaluations.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Confirmed Requirements Step</span>
                    <span className="text-[11px] text-blue-900 block mt-0.5">
                      All criteria items set in this batch are mapped directly against resume evidence. No hallucinations or black-box rejections occur.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* AI Suggested Criteria Chips */}
              <div className="space-y-2 bg-primary/5 border border-primary/20 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    AI-Suggested Criteria from Job Description
                  </span>
                  {isLoadingSuggestions && (
                    <span className="text-[11px] text-primary flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analyzing JD...
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-secondary">
                  Click any chip to add it directly to your deterministic evaluation rules.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestedChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleAddCriterion(chip)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-ink-primary hover:border-primary hover:text-primary transition-all shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-primary" />
                      <span className="capitalize text-[10px] px-1.5 py-0.2 rounded font-semibold bg-surface-muted text-ink-muted">
                        {chip.type}
                      </span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                  {!isLoadingSuggestions && suggestedChips.length === 0 && (
                    <span className="text-[11px] text-ink-muted italic">
                      All suggested criteria have been added.
                    </span>
                  )}
                </div>
              </div>

              {/* Cutoff & Must-Haves Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-surface-subtle border border-border rounded-xl">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-ink-primary">
                      Qualification Cutoff Score
                    </label>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tabular-nums">
                      {cutoff}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={95}
                    value={cutoff}
                    onChange={(e) => setCutoff(Number(e.target.value))}
                    className="w-full h-1.5 bg-surface-muted rounded appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-ink-muted mt-1 tabular-nums">
                    <span>40% (Lenient)</span>
                    <span>70% (Standard)</span>
                    <span>95% (Strict)</span>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={alwaysRequireAllMustHaves}
                      onChange={(e) => setAlwaysRequireAllMustHaves(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary border-border"
                    />
                    <div>
                      <span className="font-semibold text-ink-primary block">
                        Always Require All Must-Haves
                      </span>
                      <span className="text-[11px] text-ink-secondary block mt-0.5 leading-relaxed">
                        If enabled, candidates missing any must-have criterion cannot be shortlisted, regardless of ATS match score.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Active Criteria Rules List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-ink-primary">
                    Active Evaluation Criteria ({criteria.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleAddCriterion()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Manual Rule
                  </button>
                </div>

                {criteria.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-xl text-ink-muted bg-surface-subtle/30">
                    No custom criteria added yet. Click suggested chips above or Add Manual Rule.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {criteria.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-3 bg-surface border border-border rounded-xl flex items-center gap-3 shadow-2xs"
                      >
                        <span className="text-ink-muted font-mono text-[11px] w-4">
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
                          className="text-xs py-1 px-2 border border-border rounded-md focus:border-primary focus:outline-none bg-surface-muted font-medium text-ink-primary"
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
                          className="flex-1 text-xs px-2.5 py-1 border border-border rounded-md focus:border-primary focus:outline-none bg-surface text-ink-primary"
                        />

                        {/* Weight (1 - 10) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-ink-muted">Weight:</span>
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
                            className="w-12 text-xs px-1.5 py-1 border border-border rounded-md text-center focus:outline-none bg-surface text-ink-primary font-mono"
                          />
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCriterion(item.id)}
                          className="p-1 text-ink-muted hover:text-status-danger-text rounded"
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
                <div className="bg-surface-subtle border border-border rounded-xl p-4 space-y-3">
                  <span className="font-semibold text-ink-primary block">
                    Sample Candidates Scoring Simulation (5 Resumes)
                  </span>
                  <div className="divide-y divide-border">
                    {previewCandidates.map((c) => (
                      <div key={c.candidateId} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-ink-primary">{c.fullName}</span>
                          <span className="text-ink-muted ml-2 text-[11px]">({c.email})</span>
                          <div className="text-[10px] text-ink-secondary mt-0.5">{c.decisionReason}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary tabular-nums">{c.score}%</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              c.decision === 'shortlisted'
                                ? 'bg-emerald-50 text-status-shortlist-text border border-emerald-200'
                                : c.decision === 'needs_review'
                                ? 'bg-amber-50 text-status-review-text border border-amber-200'
                                : 'bg-surface-muted text-ink-secondary border border-border'
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
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface-subtle/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRunPreview}
            disabled={isPreviewing}
            leftIcon={isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          >
            Preview on 5 Candidates
          </Button>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveAndRescore}
              disabled={isSaving}
              leftIcon={isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            >
              Save & Re-score Candidates
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
