import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Trash2,
  Info,
  Check,
  AlertTriangle,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import { checksApi, CandidateCheckData } from '../../lib/api.js';
import { getAtsCheck, updateAtsCheck, removeAtsCheck } from '../../lib/atsStorage.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.js';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  animateScoreRing,
  animateCounter,
  animateProgressBar,
  isReducedMotion,
  MOTION_DURATIONS,
  MOTION_EASES
} from '../../lib/motion.js';

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const scoreNumberRef = useRef<HTMLSpanElement>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

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
      showToast({
        type: 'info',
        title: 'Check Deleted',
        message: 'Resume check has been removed.'
      });
      navigate('/checker');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete check'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;

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

  const breakdown = check?.breakdown;
  const overallScore = Math.round(check?.scoreBefore ?? 0);

  // SVG circular progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  const scoreTier =
    overallScore >= 75
      ? { text: 'text-state-success', stroke: '#065F46', label: 'Strong Alignment', variant: 'shortlisted' as const }
      : overallScore >= 50
      ? { text: 'text-state-warning', stroke: '#92400E', label: 'Moderate Alignment (Needs Optimization)', variant: 'needs_review' as const }
      : { text: 'text-state-danger', stroke: '#991B1B', label: 'Low Keyword Alignment', variant: 'unshortlisted' as const };

  // GSAP animation for score ring, numeric counter, and breakdown progress bars (must be before any early returns)
  useGSAP(
    () => {
      if (!check || !containerRef.current) return;

      if (isReducedMotion()) {
        if (circleRef.current) {
          gsap.set(circleRef.current, { strokeDashoffset });
        }
        if (scoreNumberRef.current) {
          scoreNumberRef.current.textContent = overallScore.toString();
        }
        barRefs.current.forEach((bar, idx) => {
          if (!bar) return;
          const val = [
            breakdown?.keywordScore ?? 0,
            breakdown?.skillsScore ?? 0,
            breakdown?.experienceScore ?? 0,
            breakdown?.formattingScore ?? 0,
            breakdown?.readabilityScore ?? 0
          ][idx] ?? 0;
          gsap.set(bar, { width: `${val}%` });
        });
        return;
      }

      // 1. Entrance stagger for results sections
      gsap.fromTo(
        containerRef.current.querySelectorAll('.animate-fade-up'),
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION_DURATIONS.standard,
          stagger: 0.04,
          ease: MOTION_EASES.standard,
          clearProps: 'transform'
        }
      );

      // 2. Animate Circular Score Ring to genuine value
      animateScoreRing(circleRef.current, overallScore, radius, MOTION_DURATIONS.emphasis);

      // 3. Animate Counter to genuine value
      animateCounter(scoreNumberRef.current, overallScore, MOTION_DURATIONS.emphasis);

      // 4. Animate Breakdown Progress Bars
      const scores = [
        breakdown?.keywordScore ?? 0,
        breakdown?.skillsScore ?? 0,
        breakdown?.experienceScore ?? 0,
        breakdown?.formattingScore ?? 0,
        breakdown?.readabilityScore ?? 0
      ];
      barRefs.current.forEach((bar, idx) => {
        if (bar) {
          animateProgressBar(bar, scores[idx] ?? 0, MOTION_DURATIONS.emphasis);
        }
      });
    },
    { dependencies: [check?.id, overallScore], scope: containerRef }
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !check) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-state-danger flex items-center justify-center mx-auto border border-red-200">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-ink-primary">Resume Check Not Found</h2>
        <p className="text-xs text-ink-secondary">{error || 'Unable to locate this analysis record.'}</p>
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

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-16">
      {/* Top Header */}
      <div className="animate-fade-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/checker" className="text-xs text-ink-muted hover:text-ink-primary flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Checker</span>
            </Link>
            <span className="text-border-strong">•</span>
            <span className="text-xs text-ink-secondary font-mono">{new Date(check.createdAt).toLocaleDateString()}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">
            {check.jobTitle || 'ATS Match Evaluation'} {check.company ? <span className="font-normal text-ink-secondary">at {check.company}</span> : ''}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => navigate('/checker')}
          >
            Check Another
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileText className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/checks/${check.id}/export`)}
          >
            Export Resume
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/checks/${check.id}/suggestions`)}
          >
            Improve Match Score
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-ink-muted" />}
            onClick={handleDeleteCheck}
            isLoading={isDeleting}
            aria-label="Delete this check"
          />
        </div>
      </div>

      {/* Main Score & Plain-Language Summary Card */}
      <Card className="animate-fade-up shadow-subtle p-6 flex flex-col md:flex-row items-center gap-8">
        {/* Circular SVG Ring showing true value */}
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="var(--border)"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              ref={circleRef}
              cx="64"
              cy="64"
              r={radius}
              stroke={scoreTier.stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span ref={scoreNumberRef} className={`text-3xl font-extrabold tabular-nums ${scoreTier.text}`}>{overallScore}</span>
            <span className="text-[10px] font-semibold text-ink-muted tracking-wider uppercase">Out of 100</span>
          </div>
        </div>

        {/* Score Context & Plain Language Summary */}
        <div className="flex-1 space-y-2.5 text-center md:text-left">
          <div className="inline-flex">
            <Badge variant={scoreTier.variant} size="md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{scoreTier.label}</span>
            </Badge>
          </div>

          <h3 className="text-sm font-semibold text-ink-primary">
            Plain-Language Match Summary
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            {overallScore >= 75
              ? 'Your resume presents strong textual alignment with the core responsibilities and technical qualifications specified in this job description. To maximize interview rates, ensure all highlighted skills cite measurable achievements.'
              : overallScore >= 50
              ? 'Your resume demonstrates relevant foundational experience but misses several explicit competencies requested by this role. Adding verbatim bullet points for missing skills can significantly improve alignment.'
              : 'Your resume shows significant keyword and requirement gaps when compared to this job description. Many automated filters may rank this document low unless missing core competencies are clearly documented.'}
          </p>

          <div className="pt-1">
            <Link
              to={`/checks/${check.id}/suggestions`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Review step-by-step suggestions to optimize this score
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      {/* Honest Estimate Transparency Notice */}
      <div className="p-4 bg-surface-subtle border border-border rounded-lg flex items-start gap-3 text-xs text-ink-secondary">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-ink-primary block mb-0.5">
            Important Note: This Score is an Estimate
          </span>
          <p className="leading-relaxed text-[11px]">
            This score reflects deterministic keyword overlap and section extractability calculated specifically against the job text provided. It does not guarantee an interview or offer, and it is not an output from any proprietary employer ATS. Human hiring managers make all final selection decisions.
          </p>
        </div>
      </div>

      {/* Five Breakdown Bars */}
      <Card className="shadow-subtle p-6 space-y-5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
            Five-Pillar Match Breakdown
          </h2>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Transparent scoring components calculated deterministically without algorithmic black-boxes.
          </p>
        </div>

        <div className="space-y-4">
          {/* Pillar 1: Keyword Overlap */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">1. Keyword Overlap (TF-IDF weighted)</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.keywordScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-surface-subtle border border-border rounded-full overflow-hidden">
              <div
                ref={(el) => (barRefs.current[0] = el)}
                className="h-full bg-primary rounded-full"
                style={{ width: `${breakdown?.keywordScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Pillar 2: Skills Alignment */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">2. Required Skills Match (Dictionary verified)</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.skillsScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-surface-subtle border border-border rounded-full overflow-hidden">
              <div
                ref={(el) => (barRefs.current[1] = el)}
                className="h-full bg-primary rounded-full"
                style={{ width: `${breakdown?.skillsScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Pillar 3: Experience Relevance */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">
                3. Work History Relevance ({breakdown?.detectedYearsExperience ?? 0} yrs detected)
              </span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.experienceScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-surface-subtle border border-border rounded-full overflow-hidden">
              <div
                ref={(el) => (barRefs.current[2] = el)}
                className="h-full bg-emerald-700 rounded-full"
                style={{ width: `${breakdown?.experienceScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Pillar 4: Formatting & Structure */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">4. Document Extractability & Section Completeness</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.formattingScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-surface-subtle border border-border rounded-full overflow-hidden">
              <div
                ref={(el) => (barRefs.current[3] = el)}
                className="h-full bg-slate-700 rounded-full"
                style={{ width: `${breakdown?.formattingScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Pillar 5: Readability & Document Structure */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-ink-primary">5. Readability & Clear Structure</span>
              <span className="text-ink-secondary tabular-nums font-semibold">{breakdown?.readabilityScore ?? 0} / 100</span>
            </div>
            <div className="w-full h-2 bg-surface-subtle border border-border rounded-full overflow-hidden">
              <div
                ref={(el) => (barRefs.current[4] = el)}
                className="h-full bg-primary rounded-full"
                style={{ width: `${breakdown?.readabilityScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Matched and Missing Keyword Chips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Matched Keywords */}
        <Card className="shadow-subtle p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wider flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-state-success" />
              Matched Keywords ({breakdown?.matchedKeywords?.length || 0})
            </h3>
            <span className="text-[11px] text-ink-muted">Found in resume</span>
          </div>

          {breakdown?.matchedKeywords && breakdown.matchedKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {breakdown.matchedKeywords.map((kw: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{kw}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-muted py-4 text-center">No exact keywords matched.</p>
          )}
        </Card>

        {/* Missing Keywords */}
        <Card className="shadow-subtle p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-state-warning" />
              Missing Key Skills ({breakdown?.missingKeywords?.length || 0})
            </h3>
            <span className="text-[11px] text-ink-muted">Present in JD</span>
          </div>

          {breakdown?.missingKeywords && breakdown.missingKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {breakdown.missingKeywords.map((kw: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-amber-50 text-amber-900 border border-amber-200"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>{kw}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-state-success py-4 text-center font-medium">
              Excellent! No major keyword omissions detected.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};
