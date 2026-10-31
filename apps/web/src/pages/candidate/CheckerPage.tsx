import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Building,
  Loader2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { checksApi, CandidateCheckData, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { saveAtsCheck, getRecentAtsChecks, StoredAtsCheckSummary } from '../../lib/atsStorage';

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
      setErrorMessage('Please provide a job description of at least 30 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jdText', jdText.trim());
      formData.append('turnstileToken', 'mock-turnstile-pass');
      if (jobTitle.trim()) formData.append('jobTitle', jobTitle.trim());
      if (company.trim()) formData.append('company', company.trim());

      const res = await checksApi.createCheck(formData);

      // Save complete check data to localStorage for instant recovery and offline caching
      saveAtsCheck({
        id: res.data.id,
        createdAt: res.data.createdAt,
        jobTitle: res.data.jobTitle,
        company: res.data.company,
        scoreBefore: res.data.scoreBefore,
        scoreAfter: res.data.scoreAfter,
        breakdown: res.data.breakdown,
        resumeText: res.data.resumeText,
        jdText: res.data.jdText || jdText,
        candidateName: (res.data.breakdown as any)?.candidateName || 'Candidate',
        suggestions: res.data.suggestions || []
      });

      addToast('success', 'Resume analyzed successfully!');
      navigate(`/checks/${res.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'NO_TEXT') {
          setErrorMessage(
            'The uploaded PDF contains no extractable text. Scanned images are not supported. Please upload a standard text-based PDF resume.'
          );
        } else if (err.code === 'RATE_LIMIT_EXCEEDED') {
          setErrorMessage(err.message);
        } else {
          setErrorMessage(err.message || 'An error occurred while evaluating your resume.');
        }
      } else {
        setErrorMessage('Unable to process resume. Please check your network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-primary">ATS Resume Checker</h1>
        <p className="text-sm text-slate-secondary mt-1">
          Upload your text-based resume and target job description to get a deterministic ATS compatibility score and actionable keyword suggestions.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-state-danger flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold block mb-0.5">Evaluation Error</span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Main Checker Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-slate-border rounded-lg shadow-soft p-6 space-y-6">
        {/* Step 1: Upload Resume */}
        <div>
          <label className="block text-sm font-semibold text-slate-primary mb-1.5">
            1. Upload Resume (PDF Only) <span className="text-state-danger">*</span>
          </label>
          <p className="text-xs text-slate-secondary mb-3">
            Only text-based PDFs are supported. Scanned images or password-protected files will be rejected.
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
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-brand-indigo bg-indigo-50/50'
                  : 'border-slate-border hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-indigo mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-primary">
                Drag and drop your PDF resume here, or <span className="text-brand-indigo underline">browse files</span>
              </p>
              <p className="text-xs text-slate-muted mt-1.5">Maximum file size: 5 MB</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-state-success">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-primary truncate max-w-sm">{file.name}</p>
                  <p className="text-xs text-slate-secondary">{(file.size / 1024).toFixed(1)} KB</p>
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
            <label className="block text-xs font-semibold text-slate-secondary mb-1">
              Target Job Title (Optional)
            </label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="e.g. Senior Full Stack Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2 rounded border border-slate-border bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-secondary mb-1">
              Company Name (Optional)
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="e.g. Stripe, Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2 rounded border border-slate-border bg-white text-slate-primary focus:outline-none focus:ring-1 focus:ring-brand-indigo"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Paste Job Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-primary">
              2. Paste Job Description <span className="text-state-danger">*</span>
            </label>
            <span className={`text-xs ${jdText.length >= 30 ? 'text-state-success' : 'text-slate-muted'}`}>
              {jdText.length} characters (min. 30)
            </span>
          </div>
          <textarea
            rows={7}
            placeholder="Paste the full job posting requirements, responsibilities, and qualifications here..."
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            className="w-full text-sm p-3 rounded-lg border border-slate-border bg-white text-slate-primary font-mono focus:outline-none focus:ring-1 focus:ring-brand-indigo"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-secondary flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-state-success" />
            <span>Strict privacy: Resumes auto-deleted after 30 days. No training data reuse.</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !file || jdText.trim().length < 30}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing & Scoring Resume...
              </>
            ) : (
              <>
                Check ATS Compatibility
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Recent Resume Checks History (from LocalStorage and Account) */}
      {(pastChecks.length > 0 || profile) && (
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-secondary" />
            <h2 className="text-base font-semibold text-slate-primary">Your Recent Resume Checks</h2>
          </div>

          {isLoadingPast && pastChecks.length === 0 ? (
            <div className="p-6 bg-card border border-slate-border rounded-lg text-center text-xs text-slate-secondary">
              Loading your previous analyses...
            </div>
          ) : pastChecks.length === 0 ? (
            <div className="p-6 bg-card border border-slate-border rounded-lg text-center text-xs text-slate-secondary">
              No previous resume checks recorded yet. Run your first check above!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastChecks.map((check) => (
                <Link
                  key={check.id}
                  to={`/checks/${check.id}`}
                  className="bg-card border border-slate-border rounded-lg p-4 shadow-soft hover:border-brand-indigo transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-slate-primary">{check.jobTitle}</h3>
                    <p className="text-xs text-slate-secondary mt-0.5">
                      {check.company ? `${check.company} • ` : ''}
                      {new Date(check.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        (check.scoreBefore ?? 0) >= 75
                          ? 'bg-emerald-50 text-state-success border border-emerald-200'
                          : (check.scoreBefore ?? 0) >= 50
                          ? 'bg-amber-50 text-state-warning border border-amber-200'
                          : 'bg-red-50 text-state-danger border border-red-200'
                      }`}
                    >
                      {check.scoreBefore ?? 0}/100
                    </span>
                    <p className="text-[10px] text-slate-muted mt-1">View Results</p>
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
