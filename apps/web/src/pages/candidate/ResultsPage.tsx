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
  Trash2
} from 'lucide-react';
import { checksApi, CandidateCheckData } from '../../lib/api';
import { getAtsCheck, updateAtsCheck, removeAtsCheck } from '../../lib/atsStorage';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';

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
        <h2 className="text-xl font-bold text-slate-primary mb-2">Resume Check Not Found</h2>
        <p className="text-sm text-slate-secondary mb-6">{error || 'Unable to locate this analysis record.'}</p>
        <Link
          to="/checker"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try Another Resume
        </Link>
      </div>
    );
  }

  const breakdown = check.breakdown;
  const overallScore = check.scoreBefore;

  // Determine score color badge
  const scoreBadge =
    overallScore >= 75
      ? { text: 'text-state-success', bg: 'bg-emerald-50', border: 'border-emerald-200', stroke: '#15803D', label: 'Strong Match' }
      : overallScore >= 50
      ? { text: 'text-state-warning', bg: 'bg-amber-50', border: 'border-amber-200', stroke: '#B45309', label: 'Moderate Match' }
      : { text: 'text-state-danger', bg: 'bg-red-50', border: 'border-red-200', stroke: '#B91C1C', label: 'Low ATS Alignment' };

  // SVG circular progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-muted">ATS Analysis Result</span>
            <span className="text-slate-muted">•</span>
            <span className="text-xs text-slate-secondary">{new Date(check.createdAt).toLocaleDateString()}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-primary">
            {check.jobTitle} {check.company ? <span className="font-normal text-slate-secondary">at {check.company}</span> : ''}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {profile && (
            <button
              onClick={handleDeleteCheck}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded text-state-danger bg-red-50 hover:bg-red-100 border border-red-200 transition-colors shadow-soft disabled:opacity-50"
              title="Permanently delete this check"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Deleting...' : 'Delete Check'}
            </button>
          )}
          <Link
            to="/checker"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded text-slate-primary bg-white border border-slate-border hover:bg-slate-50 transition-colors shadow-soft"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-muted" />
            Check Another
          </Link>
          <Link
            to={`/checks/${check.id}/export`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-border hover:bg-slate-50 transition-colors shadow-soft"
          >
            <FileText className="w-3.5 h-3.5 text-brand-indigo" />
            Export Formats
          </Link>
          <Link
            to={`/checks/${check.id}/suggestions`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            View AI Suggestions
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Score & Overview Card */}
      <div className="bg-card border border-slate-border rounded-lg shadow-soft p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8">
        {/* Circular SVG Ring */}
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <svg className="w-36 h-36 transform -rotate-90">
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke="#E2E8F0"
              strokeWidth="10"
              fill="transparent"
            />
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke={scoreBadge.stroke}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-4xl font-extrabold ${scoreBadge.text}`}>{overallScore}</span>
            <span className="text-[11px] font-semibold text-slate-muted tracking-wider uppercase">Out of 100</span>
          </div>
        </div>

        {/* Score Context & Next Step */}
        <div className="flex-1 space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${scoreBadge.bg} ${scoreBadge.text} ${scoreBadge.border}">
            <span>{scoreBadge.label}</span>
          </div>

          <p className="text-sm text-slate-secondary leading-relaxed">
            {overallScore >= 75
              ? 'Your resume strongly matches the core technical requirements and structure expected by modern ATS screening filters.'
              : overallScore >= 50
              ? 'Your resume has a solid foundation but is missing key keywords or structural evidence that ATS algorithms rank for.'
              : 'Your resume shows significant keyword gaps compared to the target job description. Use our targeted suggestions to bridge the difference.'}
          </p>

          <div className="pt-2">
            <Link
              to={`/checks/${check.id}/suggestions`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-brand-indigo hover:text-brand-hover underline"
            >
              See exactly how to raise your score with safe AI suggestions
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5 Breakdown Bars */}
      <div className="bg-card border border-slate-border rounded-lg shadow-soft p-6">
        <h2 className="text-sm font-bold text-slate-primary uppercase tracking-wider mb-5">
          Deterministic ATS Breakdown (5 Core Pillars)
        </h2>

        <div className="space-y-4">
          {/* 1. Keyword Overlap */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-primary">Keyword Match (TF-IDF weighted)</span>
              <span className="text-slate-secondary">{breakdown?.keywordScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-indigo rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.keywordScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 2. Skills Match */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-primary">Skills Alignment (Dictionary & JD match)</span>
              <span className="text-slate-secondary">{breakdown?.skillsScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.skillsScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 3. Experience Relevance */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-primary">
                Experience Relevance ({breakdown?.detectedYearsExperience ?? 0} yrs detected)
              </span>
              <span className="text-slate-secondary">{breakdown?.experienceScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.experienceScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 4. Formatting & Structure */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-primary">Formatting & Section Completeness</span>
              <span className="text-slate-secondary">{breakdown?.formattingScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-700 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.formattingScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* 5. Readability */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-primary">
                Readability & Flow (Flesch score: {breakdown?.readability?.readingEase ?? 0})
              </span>
              <span className="text-slate-secondary">{breakdown?.readabilityScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 rounded-full transition-all duration-500"
                style={{ width: `${breakdown?.readabilityScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Keywords Chips & Candidate Basics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Keywords Chips */}
        <div className="bg-card border border-slate-border rounded-lg shadow-soft p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-state-success" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-primary">
                Matched Keywords ({breakdown?.matchedKeywords?.length ?? 0})
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {breakdown?.matchedKeywords && breakdown.matchedKeywords.length > 0 ? (
                breakdown.matchedKeywords.slice(0, 16).map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 text-xs rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                  >
                    {kw}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-muted">No keywords matched directly</span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-state-warning" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-primary">
                Missing Priority Keywords ({breakdown?.missingKeywords?.length ?? 0})
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {breakdown?.missingKeywords && breakdown.missingKeywords.length > 0 ? (
                breakdown.missingKeywords.slice(0, 16).map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                  >
                    {kw}
                  </span>
                ))
              ) : (
                <span className="text-xs text-state-success font-medium">No critical keywords missing!</span>
              )}
            </div>
          </div>
        </div>

        {/* Candidate Basics Extracted */}
        <div className="bg-card border border-slate-border rounded-lg shadow-soft p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-primary mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-indigo" />
            Detected Contact & Identity Info
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-primary">
              <User className="w-4 h-4 text-slate-muted" />
              <span className="font-semibold">{breakdown?.basics?.name || 'Not detected'}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-slate-muted" />
              {breakdown?.basics?.email === 'NO_EMAIL' ? (
                <span className="text-state-danger font-medium">Missing email in resume!</span>
              ) : (
                <span className="text-slate-primary">{breakdown?.basics?.email || 'Not detected'}</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-slate-primary">
              <Phone className="w-4 h-4 text-slate-muted" />
              <span>{breakdown?.basics?.phone || 'No phone number detected'}</span>
            </div>

            <div className="pt-2 border-t border-slate-border flex flex-wrap gap-3">
              {breakdown?.basics?.links?.linkedin && (
                <a
                  href={breakdown.basics.links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-indigo hover:underline"
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
                  className="inline-flex items-center gap-1 text-xs text-brand-indigo hover:underline"
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

