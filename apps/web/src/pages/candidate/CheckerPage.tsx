import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Building,
  Clock,
  ArrowRight,
  Trash2,
  ShieldCheck,
  Loader2,
  Info
} from 'lucide-react';
import { checksApi, CandidateCheckData } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  getRecentAtsChecks,
  StoredAtsCheckSummary,
  removeAtsCheck,
  clearAllAtsChecks
} from '../../lib/atsStorage.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card, CardContent } from '../../components/ui/Card.js';
import { Input, Label } from '../../components/ui/Input.js';
import { FileDropzone } from '../../components/blocks/FileDropzone.js';

export const CheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User past checks history (combines authenticated + localStorage)
  const [pastChecks, setPastChecks] = useState<Array<CandidateCheckData | StoredAtsCheckSummary>>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);

  useEffect(() => {
    loadPastChecks();
  }, [profile]);

  const loadPastChecks = () => {
    const localRecents = getRecentAtsChecks();
    setPastChecks(localRecents);

    if (profile) {
      setIsLoadingPast(true);
      checksApi
        .getUserChecks()
        .then((res) => {
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
  };

  const handleDeletePastCheck = async (e: React.MouseEvent, checkId: string) => {
    e.preventDefault();
    e.stopPropagation();

    removeAtsCheck(checkId);
    setPastChecks((prev) => prev.filter((c) => c.id !== checkId));

    if (profile) {
      try {
        await checksApi.deleteCheck(checkId);
      } catch {
        // Ignored if server delete fails; local state already purged
      }
    }
    showToast({
      type: 'info',
      title: 'Check removed',
      message: 'Analysis record cleared from your history.'
    });
  };

  const handleClearAllHistory = () => {
    if (!window.confirm('Are you sure you want to delete all stored candidate checks from your local browser?')) {
      return;
    }
    clearAllAtsChecks();
    setPastChecks([]);
    showToast({
      type: 'success',
      title: 'History Cleared',
      message: 'All local resume check history has been deleted.'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage('Please upload your resume in PDF format.');
      return;
    }
    if (!jdText.trim() || jdText.trim().length < 30) {
      setErrorMessage('Please provide a complete Job Description (minimum 30 characters required for accurate matching).');
      return;
    }

    try {
      setIsSubmitting(true);
      setAnalysisStep(1);

      // Simulated step progression for visual feedback while waiting for API response
      const stepTimer1 = setTimeout(() => setAnalysisStep(2), 700);
      const stepTimer2 = setTimeout(() => setAnalysisStep(3), 1500);

      const formData = new FormData();
      formData.append('resume', file);
      formData.append('jdText', jdText.trim());
      if (jobTitle.trim()) formData.append('jobTitle', jobTitle.trim());
      if (company.trim()) formData.append('company', company.trim());

      const res = await checksApi.createCheck(formData);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      showToast({
        type: 'success',
        title: 'Analysis Complete',
        message: 'Resume parsed and scored against job criteria.'
      });
      navigate(`/checks/${res.data.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to analyze resume. Please ensure the document is a readable, text-based PDF and try again.');
    } finally {
      setIsSubmitting(false);
      setAnalysisStep(1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-primary">
          Free ATS Resume Checker
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary max-w-xl mx-auto leading-relaxed">
          Evaluate your resume against any job description with positional coordinate parsing and factual keyword matching.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-state-danger flex items-start gap-2.5 shadow-subtle">
          <AlertCircle className="w-4 h-4 text-state-danger shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Analysis could not be completed</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Checker Form */}
      <Card className="shadow-subtle overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Section 1: Resume Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label required className="text-xs font-bold text-ink-primary uppercase tracking-wider mb-0">
                1. Upload Resume Document
              </Label>
              <span className="text-[11px] text-ink-muted">Text-based PDF only • Max 5MB</span>
            </div>
            <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
              Standard PDF files with selectable text. Scanned photo images, flattened graphics, or password-protected files cannot be extracted by ATS parsers.
            </p>

            <FileDropzone
              onFileSelect={(selectedFile) => setFile(selectedFile)}
              selectedFile={file}
              onClearFile={() => setFile(null)}
              accept=".pdf,application/pdf"
              maxSizeBytes={5 * 1024 * 1024}
              title="Upload your PDF resume"
              description="Drag and drop your file here, or click to browse"
            />
          </div>

          {/* Section 2: Optional Target Details */}
          <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Target Job Title (Optional)</Label>
              <Input
                type="text"
                placeholder="e.g. Senior Frontend Engineer"
                leftIcon={<Briefcase className="w-3.5 h-3.5" />}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label>Company Name (Optional)</Label>
              <Input
                type="text"
                placeholder="e.g. Google, Stripe, Acme Corp"
                leftIcon={<Building className="w-3.5 h-3.5" />}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Section 3: Job Description */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-1.5">
              <Label required className="text-xs font-bold text-ink-primary uppercase tracking-wider mb-0">
                2. Target Job Description
              </Label>
              <span className={`text-[11px] font-mono tabular-nums ${jdText.length >= 30 ? 'text-state-success font-semibold' : 'text-ink-muted'}`}>
                {jdText.length} characters (min 30)
              </span>
            </div>
            <p className="text-xs text-ink-secondary mb-2.5">
              Paste the full job posting requirements, required competencies, and responsibilities.
            </p>

            <textarea
              rows={7}
              placeholder="Paste job description requirements and qualifications here…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-xs p-3 rounded-md border border-border bg-surface text-ink-primary font-mono focus-visible:outline-2 focus-visible:outline-offset-2 leading-relaxed placeholder:text-ink-subtle disabled:opacity-50"
            />
          </div>

          {/* Active Analysis Step Progress */}
          {isSubmitting && (
            <div className="p-4 rounded-lg bg-surface-subtle border border-border space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span>Evaluating Document Against Criteria…</span>
              </div>
              <div className="space-y-1.5 pl-6 text-xs text-ink-secondary">
                <div className={`flex items-center gap-2 ${analysisStep >= 1 ? 'text-ink-primary font-medium' : 'text-ink-muted'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Step 1: Ingesting 2D layout coordinates & extractability</span>
                </div>
                <div className={`flex items-center gap-2 ${analysisStep >= 2 ? 'text-ink-primary font-medium' : 'text-ink-muted'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Step 2: Parsing sections & mapping skill dictionaries</span>
                </div>
                <div className={`flex items-center gap-2 ${analysisStep >= 3 ? 'text-ink-primary font-medium' : 'text-ink-muted'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Step 3: Generating deterministic score breakdown</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <ShieldCheck className="w-4 h-4 text-state-success flex-shrink-0" />
              <span>No signup required • 30-day auto-purge • PII stripped before scoring</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting || !file || jdText.trim().length < 30}
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Check ATS Alignment
            </Button>
          </div>
        </form>
      </Card>

      {/* History and Data Deletion Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-ink-muted" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
              Your Recent Resume Checks
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {pastChecks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllHistory}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px]"
              >
                Clear All History
              </Button>
            )}
            <Link
              to="/privacy/delete-data"
              className="text-[11px] text-ink-secondary hover:text-ink-primary underline font-medium"
            >
              Request Full Data Erasure
            </Link>
          </div>
        </div>

        {isLoadingPast && pastChecks.length === 0 ? (
          <div className="p-6 bg-surface border border-border rounded-lg text-center text-xs text-ink-muted">
            Loading previous checks…
          </div>
        ) : pastChecks.length === 0 ? (
          <div className="p-6 bg-surface border border-border rounded-lg text-center text-xs text-ink-muted">
            No stored checks found. Upload a resume above to get your first match score.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastChecks.map((c) => {
              const score = c.scoreBefore ?? 0;
              return (
                <div
                  key={c.id}
                  className="bg-surface border border-border rounded-lg p-3.5 shadow-subtle hover:border-border-strong transition-colors flex items-center justify-between gap-3 group"
                >
                  <Link to={`/checks/${c.id}`} className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-ink-primary truncate group-hover:text-primary transition-colors">
                      {c.jobTitle || 'ATS Resume Evaluation'}
                    </h3>
                    <p className="text-[11px] text-ink-muted mt-0.5 font-mono">
                      {c.company ? `${c.company} • ` : ''}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </Link>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={score >= 75 ? 'shortlisted' : score >= 50 ? 'needs_review' : 'unshortlisted'}
                      size="sm"
                      className="tabular-nums"
                    >
                      {score} / 100
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => handleDeletePastCheck(e, c.id)}
                      aria-label={`Delete check ${c.jobTitle || c.id}`}
                      className="p-1 text-ink-muted hover:text-state-danger rounded hover:bg-surface-subtle transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
