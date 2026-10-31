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
  FileText
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

  // Helper to persist batch or update existing draft
  const persistBatch = async (status: 'draft' | 'active' = 'draft'): Promise<string> => {
    if (!name.trim() || !jobTitle.trim() || !jdText.trim()) {
      throw new Error('Please fill in Batch Name, Job Title, and Job Description.');
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
      setErrorMsg('Please enter Batch Name, Job Title, and Job Description.');
      return;
    }
    setErrorMsg(null);
    try {
      if (!batchId) {
        await persistBatch('draft');
      }
      setCurrentStep(2);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating batch.');
    }
  };

  const handleFinalizeBatch = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const id = await persistBatch('active');
      navigate(`/hr/batches/${id}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to activate batch.');
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
      <div className="flex items-center justify-between border-b border-border pb-4">
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
      <div className="grid grid-cols-4 gap-2.5 text-center">
        {[
          { step: 1, label: '1. Role Details', icon: Briefcase },
          { step: 2, label: '2. Cutoff & Criteria', icon: Sliders },
          { step: 3, label: '3. Add Candidates', icon: Users },
          { step: 4, label: '4. Review & Launch', icon: CheckCircle2 }
        ].map(({ step, label, icon: Icon }) => (
          <div
            key={step}
            className={`p-2.5 rounded-md border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              currentStep === step
                ? 'border-primary bg-slate-100 text-ink-primary font-semibold'
                : currentStep > step
                ? 'border-emerald-200 bg-emerald-50 text-state-success'
                : 'border-border bg-surface text-ink-muted'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-state-danger rounded-md text-xs">
          {errorMsg}
        </div>
      )}

      {/* Step 1: Job Details */}
      {currentStep === 1 && (
        <div className="bg-surface border border-border rounded-md p-6 space-y-5 shadow-subtle">
          <h2 className="text-sm font-semibold text-ink-primary border-b border-border pb-3">
            Step 1: Role Specifications
          </h2>

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
                className="w-full text-xs px-3 py-2 border border-border rounded focus:border-primary focus:outline-none bg-surface"
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
                className="w-full text-xs px-3 py-2 border border-border rounded focus:border-primary focus:outline-none bg-surface"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-ink-primary">
                Job Description & Requirements *
              </label>
              <label className="text-[11px] text-brand-accent hover:underline cursor-pointer flex items-center gap-1 font-medium">
                <FileText className="w-3 h-3" />
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
              rows={8}
              placeholder="Paste the full job description text: responsibilities, must-have skills, preferred experience..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="w-full text-xs p-3 border border-border rounded focus:border-primary focus:outline-none font-mono leading-relaxed bg-surface"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={handleNextFromStep1}
            >
              Continue to Criteria
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Scoring Criteria */}
      {currentStep === 2 && (
        <div className="bg-surface border border-border rounded-md p-6 space-y-6 shadow-subtle">
          <h2 className="text-sm font-semibold text-ink-primary border-b border-border pb-3">
            Step 2: Qualification Cutoff & Match Logic
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-ink-primary">
                  Qualification Cutoff Benchmark
                </label>
                <span className="text-sm font-bold text-ink-primary px-2.5 py-0.5 rounded bg-surface-subtle border border-border tabular-nums">
                  {cutoff}%
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary mb-3">
                Candidates scoring at or above this threshold receive a <strong>Shortlisted</strong> recommendation.
                Borderline candidates (within 5 points) are marked for <strong>Needs Review</strong>.
              </p>
              <input
                type="range"
                min={40}
                max={95}
                value={cutoff}
                onChange={(e) => setCutoff(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-ink-muted mt-1 tabular-nums">
                <span>40% (Lenient)</span>
                <span>70% (Standard)</span>
                <span>95% (Strict)</span>
              </div>
            </div>

            <div className="bg-surface-subtle border border-border rounded p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-ink-primary font-semibold text-xs">
                <Sliders className="w-4 h-4 text-primary" />
                Deterministic Scoring & Verbatim Evidence
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed">
                The engine evaluates requirements by grounding matches against verifiable resume snippets.
                Dealbreaker rules, knockout criteria, and customized must-have weights can be managed from the batch criteria drawer.
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
              Continue to Resumes Upload
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Add Candidates / Bulk Upload */}
      {currentStep === 3 && (
        <div className="bg-surface border border-border rounded-md p-6 space-y-6 shadow-subtle">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">
                Step 3: Bulk Upload Candidate Resumes
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Upload candidate PDF resumes. Engine parses text, reconstructs reading order, and evaluates match criteria.
              </p>
            </div>
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
              Review & Finalize
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review and Finalize */}
      {currentStep === 4 && (
        <div className="bg-surface border border-border rounded-md p-6 space-y-6 shadow-subtle">
          <h2 className="text-sm font-semibold text-ink-primary border-b border-border pb-3">
            Step 4: Review Batch Specifications
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-surface-subtle rounded border border-border space-y-2">
              <span className="text-ink-muted font-medium block">Job Details</span>
              <div className="text-sm font-bold text-ink-primary">{name}</div>
              <div className="text-ink-secondary">{jobTitle}</div>
            </div>

            <div className="p-4 bg-surface-subtle rounded border border-border space-y-2">
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

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900 leading-relaxed">
            <strong>Ready to launch:</strong> Activating this batch triggers background text reconstruction and evaluation across all resumes.
            Processing runs continuously on the server worker without requiring the browser tab to remain open.
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
