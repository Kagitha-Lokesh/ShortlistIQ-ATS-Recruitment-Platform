import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { validateExtractedText } from '@shortlistiq/engine';
import { useToast } from '../../context/ToastContext.js';

export const CandidatePage: React.FC = () => {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; error?: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast({
        type: 'error',
        title: 'Unsupported File Format',
        message: 'Only text-based PDF resumes are supported. Please upload a PDF.'
      });
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);

    // Simulate pre-screening text extraction check
    setIsVerifying(true);
    setTimeout(() => {
      // For demonstration of Product Rule 1: Text-based vs scanned
      const simulatedText = file.name.toLowerCase().includes('scanned') || file.name.toLowerCase().includes('image')
        ? '   '
        : 'Senior Full Stack Developer with 6 years experience specializing in TypeScript, React, Node.js, and PostgreSQL.';

      const result = validateExtractedText(simulatedText);
      setValidationResult(result);
      setIsVerifying(false);

      if (!result.isValid) {
        showToast({
          type: 'error',
          title: 'Unusable PDF Detected',
          message: result.error
        });
      } else {
        showToast({
          type: 'success',
          title: 'Text-Based PDF Verified',
          message: 'Your resume contains extractable text and is ready for deterministic parsing.'
        });
      }
    }, 600);
  };

  return (
    <div className="space-y-8">
      {/* Intro Header */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-primary">
          Check Your Resume Against Job Criteria
        </h1>
        <p className="text-sm text-slate-secondary leading-relaxed">
          Get transparent, deterministic feedback on how your experience aligns with ATS requirements before you submit.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-card border-2 border-dashed border-slate-border rounded-lg p-10 text-center hover:border-brand-indigo/50 transition-colors shadow-soft max-w-2xl mx-auto">
        <input
          type="file"
          id="resume-upload"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <label htmlFor="resume-upload" className="cursor-pointer block">
          <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 text-brand-indigo flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-primary mb-1">
            {selectedFile ? selectedFile.name : 'Click to select or drag and drop your resume'}
          </p>
          <p className="text-xs text-slate-secondary">
            Strictly text-based PDF resumes only (max 5MB)
          </p>
        </label>

        {isVerifying && (
          <div className="mt-4 text-xs text-brand-indigo font-medium flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-indigo animate-ping"></span>
            Verifying extractable text layer...
          </div>
        )}

        {validationResult && (
          <div className="mt-6 text-left">
            {validationResult.isValid ? (
              <div className="p-4 rounded bg-emerald-50 border border-emerald-200 text-xs text-state-success flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Text-based PDF confirmed</p>
                  <p className="text-slate-secondary mt-0.5">
                    Extractable text detected successfully. Ready for Phase 2 candidate parsing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded bg-red-50 border border-red-200 text-xs text-state-danger flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Text Extraction Failed</p>
                  <p className="mt-0.5 text-state-danger">{validationResult.error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trust & Privacy Notice */}
      <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-border rounded-lg p-5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-indigo flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-secondary">
          <p className="font-medium text-slate-primary mb-1">Privacy Guarantee for Candidates</p>
          Your resume is analyzed in isolation. We do not store your resume permanently without your explicit consent, and your contact info is never shared or added to marketing databases.
        </div>
      </div>
    </div>
  );
};

