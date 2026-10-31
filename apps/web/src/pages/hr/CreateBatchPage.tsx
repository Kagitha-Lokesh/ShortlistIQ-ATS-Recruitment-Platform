import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shortlistApi } from '../../lib/api.js';
import { BulkUploader } from '../../components/hr/BulkUploader.js';
import {
  Briefcase,
  Sliders,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  FileText,
  AlertTriangle,
  Info,
  Sparkles,
  Server
} from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';

export const CreateBatchPage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Steps: 1 = Details, 2 = Criteria, 3 = Upload, 4 = Review
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jdText, setJdText] = useState('');
  const [cutoff, setCutoff] = useState(70);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // JD Quality Warnings
  const jdWarnings: string[] = [];
  if (jdText.trim()) {
    if (jdText.length < 200) {
      jdWarnings.push('Job description is unusually short (< 200 characters). May result in generic match evaluation.');
    }
    if (!/(skill|experience|responsibilit|requirement|qualification)/i.test(jdText)) {
      jdWarnings.push('No obvious requirements or skills headers detected. Consider listing concrete competencies.');
    }
    if (/fast-paced|rockstar|ninja|guru|wear many hats/i.test(jdText)) {
      jdWarnings.push('Contains ambiguous buzzwords ("ninja", "rockstar", "fast-paced") that reduce scoring precision.');
    }
  }

  // Helper to persist batch or update existing draft
  const persistBatch = async (status: 'draft' | 'active' = 'draft'): Promise<string> => {
    if (!name.trim() || !jobTitle.trim() || !jdText.trim()) {
      throw new Error('Please fill in Batch Campaign Name, Target Job Title, and Job Description.');
    }

    if (batchId) {
      const updated = await shortlistApi.updateBatch(batchId, {
        name,
        jobTitle,
        jdText,
        cutoff,
        status
      });
      return updated.id;
    } else {
      const created = await shortlistApi.createBatch({
        name,
        jobTitle,
        jdText,
        cutoff,
        status
      });
      setBatchId(created.id);
      return created.id;
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      setErrorMsg(null);
      const id = await persistBatch('draft');
      navigate(`/hr/batches/${id}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save batch draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleNextFromStep1 = async () => {
    if (!name.trim() || !jobTitle.trim() || !jdText.trim()) {
      setErrorMsg('Please enter Batch Campaign Name, Target Job Title, and Job Description.');
      return;
    }
    setErrorMsg(null);
    try {
      if (!batchId) {
        await persistBatch('draft');
      }
      setCurrentStep(2);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error initializing batch draft.');
    }
  };

  const handleFinalizeBatch = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const id = await persistBatch('active');
      navigate(`/hr/batches/${id}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to launch screening batch.');
      setIsSubmitting(false);
    }
  };

  const handleJdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJdText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-primary">Create Screening Batch</h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Configure job specifications and bulk upload candidate resumes for transparent scoring
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          isLoading={isSavingDraft}
          disabled={!name || !jobTitle}
          leftIcon={<Save className="w-3.5 h-3.5" />}
          onClick={handleSaveDraft}
        >
          Save Draft
        </Button>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        {[
          { step: 1, label: '1. Role Details', icon: Briefcase },
          { step: 2, label: '2. Cutoff & Criteria', icon: Sliders },
          { step: 3, label: '3. Add Candidates', icon: Users },
          { step: 4, label: '4. Review & Launch', icon: CheckCircle2 }
        ].map(({ step, label, icon: Icon }) => (
          <div
            key={step}
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              currentStep === step
                ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20'
                : currentStep > step
                ? 'border-emerald-200 bg-emerald-50 text-status-shortlist-text'
                : 'border-border bg-surface text-ink-muted'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-status-danger-text rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 1: Job Details */}
      {currentStep === 1 && (
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-bold text-ink-primary">
              Step 1: Role Specifications & Description
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              The engine extracts required skills, experience thresholds, and evaluation criteria directly from this text.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-primary mb-1">
                Batch Campaign Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Senior Backend Engineers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-border rounded-lg focus:border-primary focus:outline-none bg-surface text-ink-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-primary mb-1">
                Target Job Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Backend Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-border rounded-lg focus:border-primary focus:outline-none bg-surface text-ink-primary"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink-primary">
                Job Description & Requirements *
              </label>
              <label className="text-[11px] text-primary hover:underline cursor-pointer flex items-center gap-1 font-medium">
                <FileText className="w-3.5 h-3.5" />
                Upload Text File (.txt)
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleJdFileUpload}
                />
              </label>
            </div>
            <textarea
              rows={9}
              placeholder="Paste the full job description text: responsibilities, must-have skills, preferred experience, required qualifications..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="w-full text-xs p-3.5 border border-border rounded-lg focus:border-primary focus:outline-none font-mono leading-relaxed bg-surface text-ink-primary"
            />
          </div>

          {/* Real-time JD Quality Feedback */}
          {jdWarnings.length > 0 && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-900">
              <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Job Description Quality Suggestions
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                {jdWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={handleNextFromStep1}
            >
              Continue to Cutoff & Criteria
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Scoring Criteria */}
      {currentStep === 2 && (
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-bold text-ink-primary">
              Step 2: Qualification Cutoff & Deterministic Rules
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Set the qualification bar. Candidates at or above the cutoff are marked as Shortlisted; borderline candidates are flagged for human review.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-ink-primary">
                  Qualification Cutoff Benchmark
                </label>
                <span className="text-sm font-bold text-ink-primary px-3 py-1 rounded-lg bg-surface-muted border border-border tabular-nums">
                  {cutoff}% Match
                </span>
              </div>
              <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
                Candidates scoring at or above this threshold receive a <strong className="text-status-shortlist-text">Shortlisted</strong> recommendation.
                Borderline candidates (within 5 points) are placed in <strong className="text-status-review-text">Needs Review</strong> with an explicit reason for recruiter discretion.
              </p>
              <input
                type="range"
                min={40}
                max={95}
                value={cutoff}
                onChange={(e) => setCutoff(Number(e.target.value))}
                className="w-full h-2 bg-surface-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[11px] text-ink-muted mt-1.5 tabular-nums">
                <span>40% (Lenient Screening)</span>
                <span>70% (Standard Benchmark)</span>
                <span>95% (Strict Knockout)</span>
              </div>
            </div>

            <div className="bg-surface-subtle border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-ink-primary font-semibold text-xs">
                <Sliders className="w-4 h-4 text-primary" />
                Deterministic Scoring & Verbatim Evidence Guarantee
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed">
                The engine evaluates requirements by grounding matches against verifiable resume snippets.
                Dealbreaker rules, knockout criteria, and customized must-have weights can be further fine-tuned in the Criteria Builder drawer after launch.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => setCurrentStep(1)}
            >
              Back
            </Button>

            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => setCurrentStep(3)}
            >
              Continue to Bulk Upload
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Add Candidates / Bulk Upload */}
      {currentStep === 3 && (
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-bold text-ink-primary">
              Step 3: Bulk Upload Candidate Resumes
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Upload candidate PDF resumes. The engine reconstructs reading order, parses text, and matches requirements.
            </p>
          </div>

          <BulkUploader
            batchId={batchId || undefined}
            autoUpload={true}
            onFilesSelected={(files) => setSelectedFiles((prev) => [...prev, ...files])}
          />

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => setCurrentStep(2)}
            >
              Back
            </Button>

            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => setCurrentStep(4)}
            >
              Review Batch & Launch
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review and Finalize */}
      {currentStep === 4 && (
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-bold text-ink-primary">
              Step 4: Review Batch Specifications
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Confirm your screening parameters before activating the batch pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2">
              <span className="text-ink-muted font-medium block">Job Details</span>
              <div className="text-sm font-bold text-ink-primary">{name}</div>
              <div className="text-ink-secondary">{jobTitle}</div>
            </div>

            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2">
              <span className="text-ink-muted font-medium block">Scoring & Candidates</span>
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Cutoff Threshold:</span>
                <span className="font-bold text-ink-primary tabular-nums">{cutoff}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Resumes Uploaded:</span>
                <span className="font-bold text-ink-primary tabular-nums">{selectedFiles.length} files</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-subtle border border-border rounded-xl text-xs text-ink-secondary leading-relaxed flex items-start gap-3">
            <Server className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <strong className="text-ink-primary">Asynchronous Background Processing:</strong> Activating this batch triggers background text reconstruction and evaluation across all resumes.
              Processing runs continuously on the server worker without requiring the browser tab to remain open.
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => setCurrentStep(3)}
            >
              Back
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                isLoading={isSavingDraft}
                onClick={handleSaveDraft}
              >
                Save as Draft
              </Button>

              <Button
                variant="primary"
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={handleFinalizeBatch}
              >
                Activate Batch & Process
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
