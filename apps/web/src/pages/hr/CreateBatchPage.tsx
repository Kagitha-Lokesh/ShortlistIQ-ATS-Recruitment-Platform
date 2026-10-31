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
  Loader2,
  FileText
} from 'lucide-react';

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
      // Ensure batch row exists in database so step 3 can upload directly
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

  // Helper to handle JD text file upload
  const handleJdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setJdText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between border-b border-slate-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-primary">Create Recruitment Batch</h1>
          <p className="text-xs text-slate-secondary mt-0.5">
            Configure job specifications and bulk upload candidate resumes for deterministic ranking
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSavingDraft || !name || !jobTitle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Draft
        </button>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { step: 1, label: '1. Job Details', icon: Briefcase },
          { step: 2, label: '2. Scoring Criteria', icon: Sliders },
          { step: 3, label: '3. Add Candidates', icon: Users },
          { step: 4, label: '4. Review & Launch', icon: CheckCircle2 }
        ].map(({ step, label, icon: Icon }) => (
          <div
            key={step}
            className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              currentStep === step
                ? 'border-brand-indigo bg-indigo-50/60 text-brand-indigo shadow-sm'
                : currentStep > step
                ? 'border-emerald-200 bg-emerald-50/50 text-state-success'
                : 'border-slate-200 bg-white text-slate-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-state-danger rounded text-xs">
          {errorMsg}
        </div>
      )}

      {/* Step 1: Job Details */}
      {currentStep === 1 && (
        <div className="bg-white border border-slate-border rounded-lg p-6 space-y-5 shadow-soft">
          <h2 className="text-sm font-semibold text-slate-primary border-b border-slate-border pb-3">
            Step 1: Job Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-primary mb-1">
                Batch Campaign Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Senior Backend Engineers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-primary mb-1">
                Job Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Backend Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-primary">
                Job Description *
              </label>
              <label className="text-[11px] text-brand-indigo hover:underline cursor-pointer flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Upload JD Text File
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
              placeholder="Paste the full job description, required skills, responsibilities, and qualification expectations..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="w-full text-xs p-3 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none font-mono leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-border">
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
            >
              Continue to Criteria
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Scoring Criteria */}
      {currentStep === 2 && (
        <div className="bg-white border border-slate-border rounded-lg p-6 space-y-6 shadow-soft">
          <h2 className="text-sm font-semibold text-slate-primary border-b border-slate-border pb-3">
            Step 2: Qualification Cutoff & Criteria
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-primary">
                  Qualification Cutoff Score
                </label>
                <span className="text-sm font-bold text-brand-indigo px-2.5 py-0.5 rounded bg-indigo-50">
                  {cutoff}%
                </span>
              </div>
              <p className="text-[11px] text-slate-secondary mb-3">
                Candidates scoring above this threshold will automatically receive a <strong>Shortlisted</strong> decision.
                Scores within 5 points will be flagged as <strong>Needs Review</strong>.
              </p>
              <input
                type="range"
                min={40}
                max={95}
                value={cutoff}
                onChange={(e) => setCutoff(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>40% (Lenient)</span>
                <span>70% (Standard)</span>
                <span>95% (Strict)</span>
              </div>
            </div>

            {/* Criteria placeholder banner for Phase 7 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-slate-primary font-semibold text-xs">
                <Sliders className="w-4 h-4 text-brand-indigo" />
                Deterministic ATS Evaluation Engine Active
              </div>
              <p className="text-xs text-slate-secondary leading-relaxed">
                The local engine extracts tech skills, experience duration, and keyword TF-IDF frequencies directly from the job description text.
                Advanced must-have, nice-to-have, and dealbreaker custom rules can be configured in <strong>Phase 7 (Criteria Builder)</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-border">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
            >
              Continue to Resumes Upload
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Add Candidates / Bulk Upload */}
      {currentStep === 3 && (
        <div className="bg-white border border-slate-border rounded-lg p-6 space-y-6 shadow-soft">
          <div className="border-b border-slate-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-primary">
                Step 3: Bulk Upload Candidate Resumes
              </h2>
              <p className="text-xs text-slate-secondary mt-0.5">
                Upload up to 500+ text-based PDF resumes. Files are uploaded in chunks with concurrency 3.
              </p>
            </div>
          </div>

          <BulkUploader
            batchId={batchId || undefined}
            autoUpload={true}
            onFilesSelected={(files) => setSelectedFiles((prev) => [...prev, ...files])}
          />

          <div className="flex items-center justify-between pt-4 border-t border-slate-border">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
            >
              Review & Finalize
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review and Finalize */}
      {currentStep === 4 && (
        <div className="bg-white border border-slate-border rounded-lg p-6 space-y-6 shadow-soft">
          <h2 className="text-sm font-semibold text-slate-primary border-b border-slate-border pb-3">
            Step 4: Review Batch Specifications
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
              <span className="text-slate-400 font-medium block">Job Details</span>
              <div className="text-sm font-bold text-slate-primary">{name}</div>
              <div className="text-slate-primary">{jobTitle}</div>
            </div>

            <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
              <span className="text-slate-400 font-medium block">Scoring & Candidates</span>
              <div className="flex items-center justify-between">
                <span className="text-slate-secondary">Cutoff Threshold:</span>
                <span className="font-bold text-brand-indigo">{cutoff}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-secondary">Resumes Uploaded:</span>
                <span className="font-bold text-slate-primary">{selectedFiles.length} files</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded text-xs text-amber-800 leading-relaxed">
            <strong>Ready to launch:</strong> Activating this batch will trigger background parsing and scoring across all candidate resumes.
            You can close the tab or refresh at any time—processing runs continuously on the server worker.
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-border">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={handleFinalizeBatch}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Launching Batch...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Activate Batch & Process
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

