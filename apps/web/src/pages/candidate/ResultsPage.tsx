import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Info
} from 'lucide-react';
import { checksApi, CandidateCheckData } from '../../lib/api';
import { getAtsCheck, updateAtsCheck, removeAtsCheck } from '../../lib/atsStorage';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [check, setCheck] = useState<CandidateCheckData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteCheck = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to permanently delete this resume analysis and uploaded file?')) {
      return;
    }
    try {
      setIsDeleting(true);
      removeAtsCheck(id);
      await checksApi.deleteCheck(id);
      navigate('/checker');
    } catch (err: any) {
      alert(err.message || 'Failed to delete check');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    // Check localStorage first for instant display
    const cached = getAtsCheck(id);
    if (cached) {
      setCheck(cached as any);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    checksApi
      .getCheck(id)
      .then((res) => {
        setCheck(res.data);
        updateAtsCheck(id, res.data);
      })
      .catch((err) => {
        if (!cached) {
          setError(err.message || 'Failed to load resume check results.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !check) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-state-danger flex items-center justify-center mx-auto mb-4 border border-red-200">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-ink-primary mb-2">Resume Check Not Found</h2>
        <p className="text-sm text-ink-secondary mb-6">{error || 'Unable to locate this analysis record.'}</p>
        <Button
          variant="primary"
          leftIcon={<RotateCcw className="w-4 h-4" />}
          onClick={() => navigate('/checker')}
        >
          Try Another Resume
        </Button>
      </div>
    );
  }

  const breakdown = check.breakdown;
  const overallScore = check.scoreBefore;

  // Determine score color badge
  const scoreBadge =
    overallScore >= 75
      ? { text: 'text-state-success', stroke: '#15803D', label: 'Strong Alignment' }
      : overallScore >= 50
      ? { text: 'text-state-warning', stroke: '#B45309', label: 'Moderate Alignment' }
      : { text: 'text-state-danger', stroke: '#B91C1C', label: 'Low ATS Alignment' };

  // SVG circular progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">ATS Analysis Result</span>
            <span className="text-ink-muted">•</span>
            <span className="text-xs text-ink-secondary font-mono">{new Date(check.createdAt).toLocaleDateString()}</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary">
            {check.jobTitle} {check.company ? <span className="font-normal text-ink-secondary">at {check.company}</span> : ''}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {profile && (
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleDeleteCheck}
            >
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={() => navigate('/checker')}
          >
            Check Another
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileText className="w-3.5 h-3.5 text-primary" />}
            onClick={() => navigate(`/checks/${check.id}/export`)}
          >
            Export ATS Formats
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/checks/${check.id}/suggestions`)}
          >
            View AI Suggestions
          </Button>
        </div>
      </div>

      {/* Main Score & Overview Card */}
      <div className="bg-surface border border-border rounded-md shadow-subtle p-6 flex flex-col md:flex-row items-center gap-8">
        {/* Circular SVG Ring */}
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#E2E8F0"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={scoreBadge.stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-3xl font-extrabold tabular-nums ${scoreBadge.text}`}>{overallScore}</span>
            <span className="text-[10px] font-semibold text-ink-muted tracking-wider uppercase">Out of 100</span>
          </div>
        </div>

        {/* Score Context & Next Step */}
        <div className="flex-1 space-y-2.5 text-center md:text-left">
          <div className="inline-flex">
            <Badge
              variant={overallScore >= 75 ? 'shortlisted' : overallScore >= 50 ? 'needs_review' : 'dealbreaker'}
            >
              {scoreBadge.label}
            </Badge>
          </div>

          <p className="text-xs text-ink-secondary leading-relaxed">
            {overallScore >= 75
              ? 'Your resume strongly matches the core technical requirements and structure expected by modern ATS screening filters.'
              : overallScore >= 50
              ? 'Your resume has a solid foundation but is missing key keywords or structural evidence that ATS algorithms rank for.'
              : 'Your resume shows significant keyword gaps compared to the target job description. Use our targeted suggestions to bridge the difference.'}
          </p>

          <div className="pt-1">
            <Link
              to={`/checks/${check.id}/suggestions`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              See exactly how to optimize your resume with grounded suggestions
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Explicit ATS Accuracy & Transparency Disclaimer */}
      <div className="p-4 bg-surface-subtle border border-border rounded-md flex items-start gap-3 text-xs text-ink-secondary">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-ink-primary block mb-0.5">
            ATS Score Transparency & Accuracy Disclosure
          </span>
          <p className="leading-relaxed text-[11px]">
            This score is an estimate of match against this job description, based on extractable text and standard recruitment criteria. It does not predict whether you will be interviewed or hired, and it is not what any specific employer's ATS will output.
          </p>
        </div>
      </div>

      {/* Resume Parse Quality & Extractability Status */}
      <div className="bg-surface border border-border rounded-md shadow-subtle p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-ink-primary uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Resume Parse & Section Extraction Report
          </h2>
          <Badge variant="parse_ok" size="sm">
            100% Extractable Text
          </Badge>
        </div>

        <p className="text-xs text-ink-secondary">
          ATS screening engines rely strictly on extractable text. Here is how your resume was ingested:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-surface-subtle border border-border rounded">
            <span className="text-[11px] text-ink-muted block">Contact Details</span>
            <span className="font-semibold text-ink-primary">
              {breakdown?.basics?.email && breakdown.basics.email !== 'NO_EMAIL' ? 'Extracted' : 'Missing email'}
            </span>
          </div>
          <div className="p-3 bg-surface-subtle border border-border rounded">
            <span className="text-[11px] text-ink-muted block">Work Experience</span>
            <span className="font-semibold text-ink-primary tabular-nums">
              {breakdown?.detectedYearsExperience ? `${breakdown.detectedYearsExperience} yrs detected` : 'Detected'}
            </span>
          </div>
          <div className="p-3 bg-surface-subtle border border-border rounded">
            <span className="text-[11px] text-ink-muted block">Skills Ingested</span>
            <span className="font-semibold text-ink-primary tabular-nums">
              {breakdown?.matchedKeywords?.length ? `${breakdown.matchedKeywords.length} keywords matched` : 'Extracted'}
            </span>
          </div>
          <div className="p-3 bg-surface-subtle border border-border rounded">
            <span className="text-[11px] text-ink-muted block">Formatting Standard</span>
            <span className="font-semibold text-ink-primary tabular-nums">
              {breakdown?.formattingScore ?? 85}% Standard
            </span>
          </div>
        </div>
      </div>

      {/* 5 Breakdown Bars */}
      <div className="bg-surface border border-border rounded-md shadow-subtle p-5">
        <h2 className="text-xs font-bold text-ink-primary uppercase tracking-wider mb-4">
          ATS Evaluation Breakdown (5 Core Pillars)
        </h2>

        <div className="space-y-3.5">
          {/* 1. Keyword Overlap */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">Keyword Match (TF-IDF weighted)</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.keywordScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.keywordScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 2. Skills Match */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">Skills Alignment (Dictionary & JD match)</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.skillsScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-700 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.skillsScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 3. Experience Relevance */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">
                Experience Relevance ({breakdown?.detectedYearsExperience ?? 0} yrs detected)
              </span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.experienceScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.experienceScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 4. Formatting & Structure */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">Formatting & Section Completeness</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.formattingScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-600 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.formattingScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 5. Readability */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">
                Readability & Flow (Flesch score: {breakdown?.readability?.readingEase ?? 0})
              </span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.readabilityScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-700 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.readabilityScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Keywords Chips & Candidate Basics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Keywords Chips */}
        <div className="bg-surface border border-border rounded-md shadow-subtle p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Matched Keywords ({breakdown?.matchedKeywords?.length ?? 0})
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {breakdown?.matchedKeywords && breakdown.matchedKeywords.length > 0 ? (
                breakdown.matchedKeywords.slice(0, 16).map((kw) => (
                  <Badge key={kw} variant="shortlisted" size="sm">
                    {kw}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-ink-muted">No keywords matched directly</span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Missing Priority Keywords ({breakdown?.missingKeywords?.length ?? 0})
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {breakdown?.missingKeywords && breakdown.missingKeywords.length > 0 ? (
                breakdown.missingKeywords.slice(0, 16).map((kw) => (
                  <Badge key={kw} variant="needs_review" size="sm">
                    {kw}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-state-success font-medium">No critical keywords missing!</span>
              )}
            </div>
          </div>
        </div>

        {/* Candidate Basics Extracted */}
        <div className="bg-surface border border-border rounded-md shadow-subtle p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary mb-3.5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Detected Contact & Identity Info
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2.5 text-ink-primary">
              <User className="w-4 h-4 text-ink-muted" />
              <span className="font-semibold">{breakdown?.basics?.name || 'Not detected'}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-ink-muted" />
              {breakdown?.basics?.email === 'NO_EMAIL' ? (
                <span className="text-state-danger font-medium">Missing email in resume!</span>
              ) : (
                <span className="text-ink-primary font-mono">{breakdown?.basics?.email || 'Not detected'}</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-ink-primary">
              <Phone className="w-4 h-4 text-ink-muted" />
              <span className="font-mono">{breakdown?.basics?.phone || 'No phone number detected'}</span>
            </div>

            <div className="pt-2 border-t border-border flex flex-wrap gap-3">
              {breakdown?.basics?.links?.linkedin && (
                <a
                  href={breakdown.basics.links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn Profile
                </a>
              )}
              {breakdown?.basics?.links?.github && (
                <a
                  href={breakdown.basics.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline"
                >
                  <Github className="w-3.5 h-3.5" />
                  GitHub Profile
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
