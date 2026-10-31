import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Building,
  Clock,
  ArrowRight
} from 'lucide-react';
import { checksApi, CandidateCheckData } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getRecentAtsChecks, StoredAtsCheckSummary } from '../../lib/atsStorage';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const CheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { addToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User past checks history (combines authenticated + localStorage)
  const [pastChecks, setPastChecks] = useState<Array<CandidateCheckData | StoredAtsCheckSummary>>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Initial load from localStorage (instant display for guests and members)
    const localRecents = getRecentAtsChecks();
    if (localRecents.length > 0) {
      setPastChecks(localRecents);
    }

    // 2. If logged in, fetch server-stored checks and merge
    if (profile) {
      setIsLoadingPast(true);
      checksApi
        .getUserChecks()
        .then((res) => {
          // Merge deduplicating by ID
          const map = new Map<string, CandidateCheckData | StoredAtsCheckSummary>();
          for (const c of res.data) map.set(c.id, c);
          for (const c of localRecents) {
            if (!map.has(c.id)) map.set(c.id, c);
          }
          setPastChecks(Array.from(map.values()));
        })
        .catch(() => {})
        .finally(() => setIsLoadingPast(false));
    }
  }, [profile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage(null);
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF documents are supported. Please select a .pdf file.');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMessage('File exceeds the 5 MB limit. Please select a smaller PDF file.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage('Please upload a PDF resume file.');
      return;
    }
    if (!jdText.trim() || jdText.trim().length < 30) {
      setErrorMessage('Please provide a complete Job Description (minimum 30 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('jdText', jdText.trim());
      if (jobTitle.trim()) formData.append('jobTitle', jobTitle.trim());
      if (company.trim()) formData.append('company', company.trim());

      const res = await checksApi.createCheck(formData);
      addToast('success', 'Resume parsed and scored successfully!');
      navigate(`/checks/${res.data.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process resume check. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Title & Intro */}
      <div className="text-center space-y-1.5 pb-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
          ATS Resume Checker & Keyword Matcher
        </h1>
        <p className="text-xs text-ink-secondary max-w-xl mx-auto leading-relaxed">
          Screen your resume deterministically against any job description. Check extractability, formatting compliance, and missing core skills.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-state-danger flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-state-danger shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Upload & Job Form */}
      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-md shadow-subtle p-6 space-y-5">
        {/* Step 1: Upload Resume */}
        <div>
          <label className="block text-xs font-semibold text-ink-primary mb-1">
            1. Upload Resume (PDF Only) <span className="text-state-danger">*</span>
          </label>
          <p className="text-xs text-ink-muted mb-2.5">
            Only text-based PDFs are supported. Scanned images or password-protected files cannot be extracted.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                validateAndSetFile(e.target.files[0]);
              }
            }}
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded p-7 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-surface-subtle'
                  : 'border-border hover:border-border-strong bg-surface-subtle/50'
              }`}
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-surface border border-border flex items-center justify-center text-ink-muted mb-2.5">
                <UploadCloud className="w-5 h-5 text-ink-primary" />
              </div>
              <p className="text-xs font-medium text-ink-primary">
                Drag and drop your PDF resume here, or <span className="text-brand-accent underline">browse files</span>
              </p>
              <p className="text-[11px] text-ink-muted mt-1 font-mono">Maximum file size: 5 MB</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-surface-subtle border border-border rounded">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-primary truncate max-w-sm">{file.name}</p>
                  <p className="text-[11px] text-ink-muted font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-state-danger hover:underline font-medium px-2 py-1"
              >
                Change File
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Target Job Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-primary mb-1">
              Target Job Title (Optional)
            </label>
            <div className="relative">
              <Briefcase className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="e.g. Senior Backend Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded border border-border bg-surface text-ink-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-primary mb-1">
              Company Name (Optional)
            </label>
            <div className="relative">
              <Building className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="e.g. Stripe, Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded border border-border bg-surface text-ink-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Paste Job Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-ink-primary">
              2. Paste Job Description <span className="text-state-danger">*</span>
            </label>
            <span className={`text-[11px] font-mono ${jdText.length >= 30 ? 'text-state-success' : 'text-ink-muted'}`}>
              {jdText.length} characters (min. 30)
            </span>
          </div>
          <textarea
            rows={7}
            placeholder="Paste the full job requirements, responsibilities, and qualifications text..."
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            className="w-full text-xs p-3 rounded border border-border bg-surface text-ink-primary font-mono focus:outline-none focus:border-primary leading-relaxed"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border">
          <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-state-success shrink-0" />
            <span>Strict privacy: Resumes auto-expire. No training data reuse.</span>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !file || jdText.trim().length < 30}
            isLoading={isSubmitting}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Check ATS Alignment
          </Button>
        </div>
      </form>

      {/* Recent Resume Checks History */}
      {(pastChecks.length > 0 || profile) && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-ink-muted" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary">Your Recent Resume Checks</h2>
          </div>

          {isLoadingPast && pastChecks.length === 0 ? (
            <div className="p-4 bg-surface border border-border rounded text-center text-xs text-ink-muted">
              Loading previous checks...
            </div>
          ) : pastChecks.length === 0 ? (
            <div className="p-4 bg-surface border border-border rounded text-center text-xs text-ink-muted">
              No previous checks found. Run your first check above!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pastChecks.map((c) => (
                <Link
                  key={c.id}
                  to={`/checks/${c.id}`}
                  className="bg-surface border border-border rounded p-3.5 shadow-subtle hover:border-border-strong transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xs font-semibold text-ink-primary">{c.jobTitle}</h3>
                    <p className="text-[11px] text-ink-muted mt-0.5 font-mono">
                      {c.company ? `${c.company} • ` : ''}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={(c.scoreBefore ?? 0) >= 75 ? 'shortlisted' : (c.scoreBefore ?? 0) >= 50 ? 'needs_review' : 'dealbreaker'}
                      size="sm"
                    >
                      {c.scoreBefore ?? 0}/100
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
