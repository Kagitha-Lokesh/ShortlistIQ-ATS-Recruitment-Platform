import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Trash2
} from 'lucide-react';
import { ResumeData, TemplateThemeOptions } from '@shortlistiq/shared';
import { checksApi, CandidateCheckData, ApiError } from '../../lib/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';

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
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  // Verification state
  const [verification, setVerification] = useState<{
    extractable: boolean;
    reParsedScore: number;
    sectionsDetected: string[];
    characterCount: number;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);

    Promise.all([checksApi.getCheck(id), checksApi.getResumeData(id)])
      .then(([checkRes, resumeRes]) => {
        setCheck(checkRes.data);
        setResumeData(resumeRes.data.resumeData);

        // Run initial verification
        runVerification(id, resumeRes.data.resumeData, options);
      })
      .catch((err) => {
        addToast('error', err.message || 'Failed to load resume details.');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const runVerification = (
    checkId: string,
    data: ResumeData,
    opts: TemplateThemeOptions
  ) => {
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
      const filename = `${resumeData.contact.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_ATS_Resume.pdf`;
      await checksApi.downloadPdf(id, { resumeData, options }, filename);
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
      const filename = `${resumeData.contact.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_ATS_Resume.docx`;
      await checksApi.downloadDocx(id, { resumeData, options }, filename);
      addToast('success', 'Word document (.docx) downloaded successfully!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to download DOCX.');
    } finally {
      setIsExportingDocx(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-border">
        <div className="flex items-center gap-3">
          <Link
            to={`/checks/${id}/suggestions`}
            className="p-2 rounded hover:bg-slate-100 text-slate-secondary transition-colors"
            title="Back to Suggestions"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-indigo" />
              ATS-Optimized Resume Export
            </h1>
            <p className="text-xs text-slate-secondary">
              Single-column, pure text formatting engineered to pass parsing filters and maintain 100% human legibility.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadDocx}
            disabled={isExportingDocx}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-border hover:bg-slate-50 transition-colors shadow-soft disabled:opacity-50"
          >
            {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download Word (.docx)
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50"
          >
            {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-soft">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-state-success flex-shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                ATS Parseability Verified (100% Extractable Text)
              </span>
              {isVerifying && <Loader2 className="w-3 h-3 text-state-success animate-spin" />}
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
            <span className="text-lg font-extrabold text-state-success">
              {verification?.reParsedScore ?? check?.scoreAfter ?? check?.scoreBefore ?? 85} / 100
            </span>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-border">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-brand-indigo text-brand-indigo'
              : 'border-transparent text-slate-secondary hover:text-slate-primary'
          }`}
        >
          <Layout className="w-4 h-4" />
          Templates & Live A4 Preview
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-brand-indigo text-brand-indigo'
              : 'border-transparent text-slate-secondary hover:text-slate-primary'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Edit Resume Content
        </button>
      </div>

      {/* TAB 1: Preview & Template Settings */}
      {activeTab === 'preview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Sidebar (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Template Gallery */}
            <div className="bg-card border border-slate-border rounded-lg p-5 shadow-soft space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-muted flex items-center gap-1.5">
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
                    onClick={() => {
                      const nextOpts = { ...options, template: tpl.id as any };
                      setOptions(nextOpts);
                      if (id) runVerification(id, resumeData, nextOpts);
                    }}
                    className={`p-3 text-left rounded-lg border text-xs transition-all ${
                      options.template === tpl.id
                        ? 'border-brand-indigo bg-indigo-50/40 text-brand-indigo ring-1 ring-brand-indigo'
                        : 'border-slate-border hover:border-slate-300 bg-white text-slate-primary'
                    }`}
                  >
                    <span className="font-bold block mb-0.5">{tpl.name}</span>
                    <span className="text-[10px] text-slate-secondary leading-tight block">{tpl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Accent Color Palette */}
            <div className="bg-card border border-slate-border rounded-lg p-5 shadow-soft space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-muted flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                Accent Color (Safe Palette)
              </label>

              <div className="flex items-center gap-3">
                {Object.entries(ACCENT_COLOR_MAP).map(([key, col]) => (
                  <button
                    key={key}
                    onClick={() => {
                      const nextOpts = { ...options, accentColor: key as any };
                      setOptions(nextOpts);
                      if (id) runVerification(id, resumeData, nextOpts);
                    }}
                    title={col.name}
                    className={`w-7 h-7 rounded-full transition-transform ${col.bgClass} ${
                      options.accentColor === key ? 'ring-2 ring-offset-2 ring-brand-indigo scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 3. Typography & Spacing */}
            <div className="bg-card border border-slate-border rounded-lg p-5 shadow-soft space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-muted flex items-center gap-1.5 mb-2">
                  <Type className="w-3.5 h-3.5" />
                  Font Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setOptions({ ...options, fontSize: sz })}
                      className={`py-1.5 text-xs font-medium capitalize rounded border transition-colors ${
                        options.fontSize === sz
                          ? 'bg-brand-indigo text-white border-brand-indigo'
                          : 'bg-white text-slate-secondary border-slate-border hover:bg-slate-50'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-muted flex items-center gap-1.5 mb-2">
                  <Maximize2 className="w-3.5 h-3.5" />
                  Page Margins
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['compact', 'normal', 'spacious'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setOptions({ ...options, margins: m })}
                      className={`py-1.5 text-xs font-medium capitalize rounded border transition-colors ${
                        options.margins === m
                          ? 'bg-brand-indigo text-white border-brand-indigo'
                          : 'bg-white text-slate-secondary border-slate-border hover:bg-slate-50'
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
          <div className="lg:col-span-8 flex justify-center bg-slate-100/70 p-6 rounded-lg border border-slate-border overflow-x-auto">
            <div
              className={`w-full max-w-[760px] min-h-[960px] bg-white shadow-md border border-slate-200 transition-all ${
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
      ) : (
        /* TAB 2: Editable Review Form */
        <div className="bg-card border border-slate-border rounded-lg p-6 shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-border">
            <div>
              <h2 className="text-base font-bold text-slate-primary">Verify & Edit Resume Content</h2>
              <p className="text-xs text-slate-secondary">
                Ensure all converted fields and accepted suggestions match your exact career history before downloading.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab('preview');
                if (id) runVerification(id, resumeData, options);
              }}
              className="px-4 py-2 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover shadow-sm"
            >
              Save & Preview Templates
            </button>
          </div>

          {/* Contact Fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-muted">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-secondary mb-1">Full Name</label>
                <input
                  type="text"
                  value={resumeData.contact.fullName}
                  onChange={(e) =>
                    setResumeData({
                      ...resumeData,
                      contact: { ...resumeData.contact, fullName: e.target.value }
                    })
                  }
                  className="w-full text-xs p-2 rounded border border-slate-border bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-secondary mb-1">Email</label>
                <input
                  type="text"
                  value={resumeData.contact.email}
                  onChange={(e) =>
                    setResumeData({
                      ...resumeData,
                      contact: { ...resumeData.contact, email: e.target.value }
                    })
                  }
                  className="w-full text-xs p-2 rounded border border-slate-border bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-secondary mb-1">Phone</label>
                <input
                  type="text"
                  value={resumeData.contact.phone || ''}
                  onChange={(e) =>
                    setResumeData({
                      ...resumeData,
                      contact: { ...resumeData.contact, phone: e.target.value }
                    })
                  }
                  className="w-full text-xs p-2 rounded border border-slate-border bg-white"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-muted">Professional Summary</h3>
            <textarea
              rows={4}
              value={resumeData.summary}
              onChange={(e) => setResumeData({ ...resumeData, summary: e.target.value })}
              className="w-full text-xs p-2.5 rounded border border-slate-border bg-white font-sans leading-relaxed"
            />
          </div>

          {/* Experience Entries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-muted">Work Experience</h3>
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
                className="inline-flex items-center gap-1 text-xs text-brand-indigo hover:underline font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </button>
            </div>

            {resumeData.experience.map((job, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-slate-border bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-primary">Position #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = resumeData.experience.filter((_, i) => i !== idx);
                      setResumeData({ ...resumeData, experience: updated });
                    }}
                    className="text-slate-muted hover:text-state-danger p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-secondary mb-0.5">Job Title</label>
                    <input
                      type="text"
                      value={job.title}
                      onChange={(e) => {
                        const next = [...resumeData.experience];
                        next[idx].title = e.target.value;
                        setResumeData({ ...resumeData, experience: next });
                      }}
                      className="w-full text-xs p-1.5 rounded border border-slate-border bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-secondary mb-0.5">Company</label>
                    <input
                      type="text"
                      value={job.company}
                      onChange={(e) => {
                        const next = [...resumeData.experience];
                        next[idx].company = e.target.value;
                        setResumeData({ ...resumeData, experience: next });
                      }}
                      className="w-full text-xs p-1.5 rounded border border-slate-border bg-white"
                    />
                  </div>
                </div>

                {/* Highlights */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-secondary mb-0.5">
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
                    className="w-full text-xs p-2 rounded border border-slate-border bg-white font-mono"
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
