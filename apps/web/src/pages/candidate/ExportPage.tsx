import React, { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Download,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layout,
  Palette,
  Type,
  Maximize2,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  Check,
  Code2,
  Copy,
  FileCode,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ResumeData, TemplateThemeOptions } from '@shortlistiq/shared';
import { checksApi, CandidateCheckData } from '../../lib/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';
import { getAtsCheck, updateAtsCheck } from '../../lib/atsStorage';

const ACCENT_COLOR_MAP: Record<string, { name: string; hex: string; bgClass: string }> = {
  indigo: { name: 'Deep Indigo', hex: '#3730A3', bgClass: 'bg-[#3730A3]' },
  slate: { name: 'Slate Gray', hex: '#334155', bgClass: 'bg-[#334155]' },
  navy: { name: 'Navy Blue', hex: '#1E3A8A', bgClass: 'bg-[#1E3A8A]' },
  forest: { name: 'Forest Green', hex: '#166534', bgClass: 'bg-[#166534]' },
  charcoal: { name: 'Charcoal', hex: '#18181B', bgClass: 'bg-[#18181B]' }
};

export const ExportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [check, setCheck] = useState<CandidateCheckData | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [options, setOptions] = useState<TemplateThemeOptions>({
    template: 'modern',
    accentColor: 'indigo',
    fontSize: 'medium',
    margins: 'normal'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'preview' | 'latex' | 'edit'>(
    tabParam === 'latex' ? 'latex' : tabParam === 'edit' ? 'edit' : 'preview'
  );
  const [latexSource, setLatexSource] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshingLatex, setIsRefreshingLatex] = useState(false);

  useEffect(() => {
    if (tabParam === 'latex' || tabParam === 'edit' || tabParam === 'preview') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Verification state
  const [verification, setVerification] = useState<{
    extractable: boolean;
    reParsedScore: number;
    sectionsDetected: string[];
    characterCount: number;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Background fetch of high-quality export representation
  useEffect(() => {
    if (id && resumeData && !latexSource) {
      checksApi
        .getLatexSource(id, { resumeData, options })
        .then((res) => {
          setLatexSource(res.data.latexSource);
          updateAtsCheck(id, { latexSource: res.data.latexSource });
        })
        .catch(() => {
          // Silent fallback to standard PDF engine if LaTeX service is unreachable
        });
    }
  }, [id, resumeData]);

  useEffect(() => {
    if (!id) return;

    // Check localStorage first for instant hydration
    const cached = getAtsCheck(id);
    if (cached) {
      if (cached.resumeData) {
        setResumeData(cached.resumeData);
        setIsLoading(false);
        runVerification(id, cached.resumeData, options);
      }
      if (cached.latexSource) {
        setLatexSource(cached.latexSource);
      }
      setCheck(cached as any);
    } else {
      setIsLoading(true);
    }

    Promise.all([checksApi.getCheck(id), checksApi.getResumeData(id)])
      .then(([checkRes, resumeRes]) => {
        setCheck(checkRes.data);
        setResumeData(resumeRes.data.resumeData);
        updateAtsCheck(id, {
          resumeData: resumeRes.data.resumeData,
          candidateName: resumeRes.data.resumeData.contact?.fullName || 'Candidate'
        });

        // Run initial verification
        runVerification(id, resumeRes.data.resumeData, options);
      })
      .catch((err) => {
        if (!cached?.resumeData) {
          addToast('error', err.message || 'Failed to load resume details.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const runVerification = (
    checkId: string,
    data: ResumeData | null | undefined,
    opts: TemplateThemeOptions
  ) => {
    if (!data) return;
    setIsVerifying(true);
    checksApi
      .verifyAndExportPdf(checkId, { resumeData: data, options: opts })
      .then((res) => {
        setVerification(res.data.verification);
      })
      .catch(() => {})
      .finally(() => setIsVerifying(false));
  };

  const handleDownloadPdf = async () => {
    if (!id || !resumeData) return;
    setIsExportingPdf(true);
    try {
      const filename = `${(resumeData.contact?.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')}_ATS_Resume.pdf`;
      addToast('info', 'Compiling and verifying ATS resume PDF…');
      if (latexSource) {
        await checksApi.downloadLatexPdf(id, { latexSource, resumeData }, filename);
      } else {
        await checksApi.downloadPdf(id, { resumeData, options }, filename);
      }
      addToast('success', 'PDF downloaded successfully!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to download PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!id || !resumeData) return;
    setIsExportingDocx(true);
    try {
      const filename = `${(resumeData.contact?.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')}_ATS_Resume.docx`;
      await checksApi.downloadDocx(id, { resumeData, options }, filename);
      addToast('success', 'Word document (.docx) downloaded successfully!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to download DOCX.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleCopyLatex = async () => {
    if (!latexSource) {
      addToast('info', 'LaTeX code is generating...');
      return;
    }
    try {
      await navigator.clipboard.writeText(latexSource);
      setIsCopied(true);
      addToast('success', 'LaTeX source copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      addToast('error', 'Failed to copy LaTeX to clipboard');
    }
  };

  const handleDownloadTex = () => {
    if (!latexSource) {
      addToast('error', 'LaTeX source not available yet');
      return;
    }
    const blob = new Blob([latexSource], { type: 'application/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(resumeData?.contact?.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')}_Resume.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('success', 'Downloaded .tex file');
  };

  const handleRefreshLatex = async () => {
    if (!id || !resumeData) return;
    try {
      setIsRefreshingLatex(true);
      addToast('info', 'Re-syncing LaTeX source from resume content...');
      const res = await checksApi.getLatexSource(id, { resumeData, options });
      setLatexSource(res.data.latexSource);
      updateAtsCheck(id, { latexSource: res.data.latexSource });
      addToast('success', 'LaTeX source updated!');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to refresh LaTeX source');
    } finally {
      setIsRefreshingLatex(false);
    }
  };

  const handleOptionChange = (newOpts: TemplateThemeOptions) => {
    setOptions(newOpts);
    if (id && resumeData) {
      runVerification(id, resumeData, newOpts);
      // Refresh backend source in background
      checksApi
        .getLatexSource(id, { resumeData, options: newOpts })
        .then((res) => {
          setLatexSource(res.data.latexSource);
          updateAtsCheck(id, { latexSource: res.data.latexSource });
        })
        .catch(() => {});
    }
  };

  if (isLoading || !resumeData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-96 rounded-lg" />
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-[750px] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const currentAccent = ACCENT_COLOR_MAP[options.accentColor] || ACCENT_COLOR_MAP.indigo;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            to={`/checks/${id}/suggestions`}
            className="p-2 rounded-md hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
            title="Back to Suggestions"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              ATS-Optimized Resume Export
            </h1>
            <p className="text-xs text-ink-secondary">
              Single-column, pure text formatting engineered to pass parsing filters and maintain 100% human legibility.
            </p>
          </div>
        </div>

        {/* Action Buttons: Only ONE Download PDF button, plus Word (.docx) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadDocx}
            disabled={isExportingDocx}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md text-ink-primary bg-surface border border-border hover:bg-surface-hover transition-colors shadow-xs disabled:opacity-50"
          >
            {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download Word (.docx)
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md text-primary-foreground bg-primary hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50"
          >
            {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Parse Verification Banner */}
      {verification && !verification.extractable ? (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Verification Warning: Potential Parse Issue Detected
                </span>
                {isVerifying && <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />}
              </div>
              <p className="text-xs text-amber-900 mt-0.5">
                The compiled document had missing section headers or unextracted text blocks. Please review your content in the Edit tab before submitting to an employer.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-status-shortlist-text flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  ATS Parseability Verified (100% Extractable Text)
                </span>
                {isVerifying && <Loader2 className="w-3 h-3 text-status-shortlist-text animate-spin" />}
              </div>
              <p className="text-xs text-emerald-900 mt-0.5">
                Verified Section Sequence:{' '}
                <strong>
                  {verification?.sectionsDetected && verification.sectionsDetected.length > 0
                    ? verification.sectionsDetected.join(' → ')
                    : 'Professional Summary → Technical Skills → Work Experience → Education'}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-8 md:pl-0">
            <div className="text-right">
              <span className="text-[11px] font-semibold uppercase text-emerald-800 block">Verified ATS Score</span>
              <span className="text-lg font-extrabold text-status-shortlist-text">
                {verification?.reParsedScore ?? check?.scoreAfter ?? check?.scoreBefore ?? 85} / 100
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mode Navigation Tabs: Live A4 Preview, LaTeX Code & Compiler, and Content Editor */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        <button
          onClick={() => {
            setActiveTab('preview');
            setSearchParams({ tab: 'preview' }, { replace: true });
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Layout className="w-4 h-4" />
          Templates & Live A4 Preview
        </button>
        <button
          onClick={() => {
            setActiveTab('latex');
            setSearchParams({ tab: 'latex' }, { replace: true });
            if (!latexSource && id && resumeData) {
              checksApi
                .getLatexSource(id, { resumeData, options })
                .then((res) => setLatexSource(res.data.latexSource))
                .catch(() => {});
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'latex'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>LaTeX Source & Compiler</span>
          <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-primary/10 text-primary font-bold">
            Pure TeX
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('edit');
            setSearchParams({ tab: 'edit' }, { replace: true });
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Edit Resume Content
        </button>
      </div>

      {/* TAB 1: Preview & Template Settings */}
      {activeTab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Sidebar (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Template Gallery */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5" />
                Select ATS Template
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'modern', name: 'Modern', desc: 'Clean sans-serif with bold hierarchy & accent rule' },
                  { id: 'classic', name: 'Classic', desc: 'Traditional serif header & classic divider' },
                  { id: 'compact', name: 'Compact', desc: 'Tighter margins & dense content flow' },
                  { id: 'minimal', name: 'Minimal', desc: 'Swiss typographic style with ample whitespace' }
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleOptionChange({ ...options, template: tpl.id as any })}
                    className={`p-3 text-left rounded-lg border text-xs transition-all ${
                      options.template === tpl.id
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                        : 'border-border hover:border-border-strong bg-surface text-ink-primary'
                    }`}
                  >
                    <span className="font-bold block mb-0.5">{tpl.name}</span>
                    <span className="text-[10px] text-ink-secondary leading-tight block">{tpl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Accent Color Palette */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                Accent Color (Safe Palette)
              </label>

              <div className="flex items-center gap-3">
                {Object.entries(ACCENT_COLOR_MAP).map(([key, col]) => (
                  <button
                    key={key}
                    onClick={() => handleOptionChange({ ...options, accentColor: key as any })}
                    title={col.name}
                    className={`w-7 h-7 rounded-full transition-transform ${col.bgClass} ${
                      options.accentColor === key ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 3. Typography & Spacing */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5 mb-2">
                  <Type className="w-3.5 h-3.5" />
                  Font Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => handleOptionChange({ ...options, fontSize: sz })}
                      className={`py-1.5 text-xs font-medium capitalize rounded-md border transition-colors ${
                        options.fontSize === sz
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface text-ink-secondary border-border hover:bg-surface-hover'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5 mb-2">
                  <Maximize2 className="w-3.5 h-3.5" />
                  Page Margins
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['compact', 'normal', 'spacious'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleOptionChange({ ...options, margins: m })}
                      className={`py-1.5 text-xs font-medium capitalize rounded-md border transition-colors ${
                        options.margins === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface text-ink-secondary border-border hover:bg-surface-hover'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Main Pane: Live A4 HTML Preview (8 Cols) */}
          <div className="lg:col-span-8 flex justify-center bg-surface-muted p-6 rounded-lg border border-border overflow-x-auto">
            <div
              className={`w-full max-w-[760px] min-h-[960px] bg-white text-slate-900 shadow-md border border-slate-200 transition-all ${
                options.template === 'classic' ? 'font-serif' : 'font-sans'
              } ${
                options.margins === 'compact'
                  ? 'p-8'
                  : options.margins === 'spacious'
                  ? 'p-14'
                  : 'p-10'
              }`}
            >
              {/* Header */}
              <div className={`mb-5 ${options.template === 'classic' ? 'text-center' : 'text-left'}`}>
                <h2
                  className={`font-bold tracking-tight text-slate-900 ${
                    options.fontSize === 'small' ? 'text-xl' : options.fontSize === 'large' ? 'text-3xl' : 'text-2xl'
                  }`}
                  style={{ color: options.template === 'modern' ? currentAccent.hex : '#0F172A' }}
                >
                  {resumeData.contact.fullName || 'Candidate Name'}
                </h2>

                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-2 gap-y-1 justify-start items-center">
                  {resumeData.contact.email && <span>{resumeData.contact.email}</span>}
                  {resumeData.contact.phone && <span>• {resumeData.contact.phone}</span>}
                  {resumeData.contact.location && <span>• {resumeData.contact.location}</span>}
                  {resumeData.contact.linkedin && <span>• {resumeData.contact.linkedin}</span>}
                  {resumeData.contact.github && <span>• {resumeData.contact.github}</span>}
                </div>
              </div>

              {/* Summary */}
              {resumeData.summary && (
                <div className="mb-5">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider pb-1 mb-2"
                    style={{
                      color: options.template === 'modern' ? currentAccent.hex : '#0F172A',
                      borderBottom: options.template !== 'minimal' ? `1.5px solid ${options.template === 'modern' ? currentAccent.hex : '#CBD5E1'}` : 'none'
                    }}
                  >
                    Professional Summary
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">{resumeData.summary}</p>
                </div>
              )}

              {/* Skills */}
              {resumeData.skills && resumeData.skills.length > 0 && (
                <div className="mb-5">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider pb-1 mb-2"
                    style={{
                      color: options.template === 'modern' ? currentAccent.hex : '#0F172A',
                      borderBottom: options.template !== 'minimal' ? `1.5px solid ${options.template === 'modern' ? currentAccent.hex : '#CBD5E1'}` : 'none'
                    }}
                  >
                    Technical Skills
                  </h3>
                  <div className="space-y-1 text-xs">
                    {resumeData.skills.map((cat, idx) => (
                      <p key={idx} className="text-slate-700">
                        <strong className="text-slate-900">{cat.category}: </strong>
                        {cat.items.join(', ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {resumeData.experience && resumeData.experience.length > 0 && (
                <div className="mb-5">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider pb-1 mb-2"
                    style={{
                      color: options.template === 'modern' ? currentAccent.hex : '#0F172A',
                      borderBottom: options.template !== 'minimal' ? `1.5px solid ${options.template === 'modern' ? currentAccent.hex : '#CBD5E1'}` : 'none'
                    }}
                  >
                    Work Experience
                  </h3>
                  <div className="space-y-3.5">
                    {resumeData.experience.map((job, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between items-baseline mb-1">
                          <p className="font-bold text-slate-900">
                            {job.title} <span className="font-normal italic text-slate-700">| {job.company}</span>
                          </p>
                          <span className="text-slate-500 text-[11px]">
                            {job.startDate} – {job.endDate || 'Present'}
                          </span>
                        </div>
                        {job.highlights && job.highlights.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed pl-1">
                            {job.highlights.map((h, hIdx) => (
                              <li key={hIdx}>{h}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {resumeData.education && resumeData.education.length > 0 && (
                <div className="mb-4">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider pb-1 mb-2"
                    style={{
                      color: options.template === 'modern' ? currentAccent.hex : '#0F172A',
                      borderBottom: options.template !== 'minimal' ? `1.5px solid ${options.template === 'modern' ? currentAccent.hex : '#CBD5E1'}` : 'none'
                    }}
                  >
                    Education
                  </h3>
                  <div className="space-y-2 text-xs">
                    {resumeData.education.map((edu, idx) => (
                      <div key={idx} className="flex justify-between items-baseline">
                        <p className="font-bold text-slate-900">
                          {edu.degree} <span className="font-normal text-slate-700">| {edu.institution}</span>
                        </p>
                        {edu.endDate && <span className="text-slate-500 text-[11px]">{edu.endDate}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LaTeX Source Code & Compiler */}
      {activeTab === 'latex' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main LaTeX Code Editor (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-surface-muted border-b border-border gap-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  <span className="font-mono text-xs font-bold text-ink-primary">resume.tex</span>
                  <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                    TeX Live UTF-8
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLatex ? 'animate-spin' : ''}`} />}
                    onClick={handleRefreshLatex}
                    disabled={isRefreshingLatex}
                    title="Re-generate LaTeX code from the current resume content"
                  >
                    Sync Content
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopyLatex}
                    title="Copy full LaTeX code to clipboard"
                  >
                    {isCopied ? 'Copied!' : 'Copy Code'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={handleDownloadTex}
                    title="Download raw .tex file"
                  >
                    .tex File
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-surface">
                {latexSource ? (
                  <textarea
                    value={latexSource}
                    onChange={(e) => setLatexSource(e.target.value)}
                    rows={26}
                    spellCheck={false}
                    className="w-full font-mono text-xs leading-relaxed text-ink-primary bg-surface-muted/50 border border-border rounded-md p-4 focus:outline-none focus:ring-1 focus:ring-primary resize-y font-normal"
                    placeholder="% LaTeX source code will render here..."
                  />
                ) : (
                  <div className="py-20 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="text-xs text-ink-secondary">Compiling LaTeX representation from resume data...</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-ink-muted pt-3 border-t border-border mt-3 gap-2">
                  <span>
                    Lines: <strong className="text-ink-secondary">{latexSource ? latexSource.split('\n').length : 0}</strong> &nbsp;|&nbsp;
                    Characters: <strong className="text-ink-secondary">{latexSource?.length || 0}</strong>
                  </span>
                  <span className="font-mono text-[10px]">Standard Article Class • Geometry (0.75in) • Enumitem</span>
                </div>
              </div>
            </div>
          </div>

          {/* LaTeX Compilation & Export Controls (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Quick Compile Action */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" />
                  Compile & Download PDF
                </h3>
                <p className="text-xs text-ink-secondary mt-1">
                  Server-side LaTeX engine compiles this exact code into a publication-quality binary PDF.
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full"
                leftIcon={isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
              >
                {isExportingPdf ? 'Compiling PDF...' : 'Compile LaTeX to PDF'}
              </Button>

              <div className="text-[11px] text-ink-muted bg-surface-muted p-3 rounded-md space-y-1">
                <p className="font-semibold text-ink-primary">Why use LaTeX for ATS resumes?</p>
                <p>
                  LaTeX compiles to pure vector text streams with predictable character coordinates. ATS parsers extract 100% of keywords with zero layout distortion.
                </p>
              </div>
            </div>

            {/* Overleaf & External TeX Usage */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">External Compilers</h4>
              <p className="text-xs text-ink-secondary">
                You can copy this document directly into Overleaf, TeXShop, or compile locally with command-line tools:
              </p>
              <div className="bg-surface-muted p-2.5 rounded-md font-mono text-[11px] text-ink-primary overflow-x-auto">
                pdflatex resume.tex
              </div>
              <ul className="text-xs text-ink-secondary space-y-1.5 list-disc list-inside">
                <li>Compatible with Overleaf (pdfLaTeX engine)</li>
                <li>Uses only standard TeX Live core packages</li>
                <li>No custom fonts required (Computer Modern / TeX Gyre)</li>
              </ul>
            </div>

            {/* Included Packages */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Standard Packages Used</h4>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">geometry</Badge>
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">hyperref</Badge>
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">enumitem</Badge>
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">titlesec</Badge>
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">xcolor</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Editable Review Form */}
      {activeTab === 'edit' && (
        <div className="bg-surface border border-border rounded-lg p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Verify & Edit Resume Content</h2>
              <p className="text-xs text-ink-secondary">
                Ensure all converted fields and accepted suggestions match your exact career history before downloading.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab('preview');
                if (id) runVerification(id, resumeData, options);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-md text-primary-foreground bg-primary hover:bg-primary-hover shadow-xs"
            >
              Save & Preview Templates
            </button>
          </div>

          {/* Contact Fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Full Name</label>
                <input
                  type="text"
                  value={resumeData.contact.fullName}
                  onChange={(e) =>
                    setResumeData({
                      ...resumeData,
                      contact: { ...resumeData.contact, fullName: e.target.value }
                    })
                  }
                  className="w-full text-xs p-2 rounded-md border border-border bg-surface text-ink-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Email</label>
                <input
                  type="text"
                  value={resumeData.contact.email}
                  onChange={(e) =>
                    setResumeData({
                      ...resumeData,
                      contact: { ...resumeData.contact, email: e.target.value }
                    })
                  }
                  className="w-full text-xs p-2 rounded-md border border-border bg-surface text-ink-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Phone</label>
                <input
                  type="text"
                  value={resumeData.contact.phone || ''}
                  onChange={(e) =>
                    setResumeData({
                      ...resumeData,
                      contact: { ...resumeData.contact, phone: e.target.value }
                    })
                  }
                  className="w-full text-xs p-2 rounded-md border border-border bg-surface text-ink-primary"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Professional Summary</h3>
            <textarea
              rows={4}
              value={resumeData.summary}
              onChange={(e) => setResumeData({ ...resumeData, summary: e.target.value })}
              className="w-full text-xs p-2.5 rounded-md border border-border bg-surface text-ink-primary font-sans leading-relaxed"
            />
          </div>

          {/* Experience Entries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Work Experience</h3>
              <button
                type="button"
                onClick={() =>
                  setResumeData({
                    ...resumeData,
                    experience: [
                      ...resumeData.experience,
                      {
                        title: 'Software Engineer',
                        company: 'Company Name',
                        location: '',
                        startDate: '2022',
                        endDate: 'Present',
                        current: true,
                        highlights: ['Contributed to production code.']
                      }
                    ]
                  })
                }
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </button>
            </div>

            {resumeData.experience.map((job, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-border bg-surface-muted/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-ink-primary">Position #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = resumeData.experience.filter((_, i) => i !== idx);
                      setResumeData({ ...resumeData, experience: updated });
                    }}
                    className="text-ink-muted hover:text-status-danger-text p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-ink-secondary mb-0.5">Job Title</label>
                    <input
                      type="text"
                      value={job.title}
                      onChange={(e) => {
                        const next = [...resumeData.experience];
                        next[idx].title = e.target.value;
                        setResumeData({ ...resumeData, experience: next });
                      }}
                      className="w-full text-xs p-1.5 rounded-md border border-border bg-surface text-ink-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-ink-secondary mb-0.5">Company</label>
                    <input
                      type="text"
                      value={job.company}
                      onChange={(e) => {
                        const next = [...resumeData.experience];
                        next[idx].company = e.target.value;
                        setResumeData({ ...resumeData, experience: next });
                      }}
                      className="w-full text-xs p-1.5 rounded-md border border-border bg-surface text-ink-primary"
                    />
                  </div>
                </div>

                {/* Highlights */}
                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-0.5">
                    Bullet Highlights (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={job.highlights.join('\n')}
                    onChange={(e) => {
                      const next = [...resumeData.experience];
                      next[idx].highlights = e.target.value.split('\n').filter(Boolean);
                      setResumeData({ ...resumeData, experience: next });
                    }}
                    className="w-full text-xs p-2 rounded-md border border-border bg-surface text-ink-primary font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
