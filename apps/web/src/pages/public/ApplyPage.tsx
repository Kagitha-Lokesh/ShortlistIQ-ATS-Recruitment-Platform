import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { shortlistApi } from '../../lib/api.js';
import { FormField } from '@shortlistiq/shared';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  Copy,
  Loader2,
  XCircle,
  Briefcase
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.js';

export const ApplyPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Success state
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Fetch Public Form Schema
  const { data: form, isLoading, error } = useQuery({
    queryKey: ['public-form', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Missing form slug');
      return shortlistApi.getPublicForm(slug);
    },
    enabled: Boolean(slug),
    retry: false
  });

  // Submission Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!slug) throw new Error('Missing slug');
      if (!fullName.trim()) throw new Error('Please enter your full name.');
      if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid email address.');
      if (!phone.trim()) throw new Error('Please enter your contact phone number.');
      if (!resumeFile) throw new Error('Please upload your resume in PDF format.');
      if (!consent) throw new Error('You must consent to data processing to submit this application.');

      // Check custom required fields
      const schemaFields: FormField[] = form?.schema?.fields || [];
      for (const field of schemaFields) {
        if (field.required && !field.isLocked) {
          const val = answers[field.id];
          if (val === undefined || val === null || String(val).trim() === '') {
            throw new Error(`Please answer: "${field.label}"`);
          }
        }
      }

      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('phone', phone.trim());
      formData.append('consent', 'true');
      formData.append('answers', JSON.stringify(answers));
      formData.append('resume', resumeFile);
      formData.append('honeypot', honeypot);
      formData.append('turnstileToken', 'mock-turnstile-pass');

      return shortlistApi.submitPublicApplication(slug, formData);
    },
    onSuccess: (data) => {
      setSubmittedRef(data.referenceNumber || 'APP-RECEIVED');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err: any) => {
      setValidationError(err.message || 'Failed to submit application.');
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setValidationError('Only text-based PDF files are supported.');
      setResumeFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setValidationError('Resume file must be under 10MB.');
      setResumeFile(null);
      return;
    }

    setValidationError(null);
    setResumeFile(file);
  };

  const handleCopyRef = () => {
    if (!submittedRef) return;
    navigator.clipboard.writeText(submittedRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="w-full max-w-xl space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // Not Found
  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white p-8 rounded-xl shadow-soft border border-slate-200 max-w-md w-full text-center space-y-4">
          <XCircle className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-primary">Application Form Not Found</h2>
          <p className="text-xs text-slate-secondary">
            The link you accessed may be incorrect or the job posting may have been removed.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-xs"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // Closed Form
  if (!form.isPublished) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white p-8 rounded-xl shadow-soft border border-slate-200 max-w-md w-full text-center space-y-4">
          <Clock className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-primary">Position Closed</h2>
          <p className="text-xs text-slate-secondary leading-relaxed">
            The application form for <strong className="text-slate-800">{form.jobTitle || form.title}</strong> is
            currently closed and is no longer accepting new submissions.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-xs"
          >
            Visit ShortlistIQ
          </Link>
        </div>
      </div>
    );
  }

  // Submission Success Confirmation Screen
  if (submittedRef) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white p-8 sm:p-10 rounded-xl shadow-lg border border-slate-200 max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-state-success">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-primary">Application Submitted!</h2>
            <p className="text-xs text-slate-secondary mt-1.5">
              Thank you for applying for <span className="font-semibold text-slate-800">{form.jobTitle || form.title}</span>.
              Your application has been received and logged in our system.
            </p>
          </div>

          {/* Reference ID Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Application Reference ID
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-lg font-bold text-brand-indigo tracking-wider">{submittedRef}</span>
              <button
                onClick={handleCopyRef}
                className="p-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:text-brand-indigo hover:bg-slate-50 transition-colors shadow-2xs"
                title="Copy reference number"
              >
                {copiedRef ? <Check className="w-4 h-4 text-state-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">Save this reference ID for any inquiries regarding your application.</p>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Our hiring team evaluates each candidate according to ATS criteria and role standards. If your qualifications
            align, a recruiter will reach out to schedule next steps.
          </div>
        </div>
      </div>
    );
  }

  const customFields: FormField[] = (form.schema?.fields || []).filter((f: FormField) => !f.isLocked);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-soft space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-brand-indigo border border-indigo-200">
            <Briefcase className="w-3.5 h-3.5" />
            Job Application
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-primary tracking-tight">
            {form.jobTitle || form.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-secondary leading-relaxed">
            Please fill out the form below and upload your resume in PDF format. We evaluate every application thoroughly.
          </p>
        </div>

        {/* Error message */}
        {validationError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-state-danger flex items-start gap-2.5 shadow-2xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="font-medium">{validationError}</div>
          </div>
        )}

        {/* Application Form Card */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setValidationError(null);
            submitMutation.mutate();
          }}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-soft space-y-6"
        >
          {/* Honeypot hidden input (anti-bot) */}
          <div style={{ display: 'none', position: 'absolute', left: '-9999px' }} aria-hidden="true">
            <label htmlFor="_website_hp">Do not fill this field</label>
            <input
              type="text"
              id="_website_hp"
              name="_website_hp"
              tabIndex={-1}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Section 1: Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-primary border-b border-slate-100 pb-2">
              1. Contact Information
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-state-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-state-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@example.com"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-state-danger">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Resume PDF Upload */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-primary border-b border-slate-100 pb-2">
              2. Resume Document <span className="text-state-danger">*</span>
            </h3>

            <div className="border-2 border-dashed border-slate-300 hover:border-brand-indigo/60 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                type="file"
                id="resumeUpload"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {resumeFile ? (
                <div className="flex items-center justify-between p-3 bg-white border border-emerald-200 rounded-lg text-left max-w-md mx-auto">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-state-success rounded">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                        {resumeFile.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {(resumeFile.size / 1024).toFixed(0)} KB • PDF Document
                      </div>
                    </div>
                  </div>
                  <label
                    htmlFor="resumeUpload"
                    className="text-xs font-semibold text-brand-indigo hover:text-brand-hover cursor-pointer px-2 py-1"
                  >
                    Change
                  </label>
                </div>
              ) : (
                <label htmlFor="resumeUpload" className="cursor-pointer block space-y-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-700">
                    Click to upload your resume <span className="text-slate-400 font-normal">or drag and drop</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PDF format only (Text-based, max 10MB). Image scans cannot be parsed.
                  </p>
                </label>
              )}
            </div>
          </div>

          {/* Section 3: Custom Screening Questions (if any) */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-slate-primary border-b border-slate-100 pb-2">
                3. Screening Questions
              </h3>

              {customFields.map((field: FormField) => {
                const answerVal = answers[field.id];

                return (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {field.label}
                      {field.required && <span className="text-state-danger ml-1">*</span>}
                    </label>

                    {/* Field Types */}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        required={field.required}
                        value={answerVal ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                        placeholder={field.placeholder || ''}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
                      />
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={3}
                        required={field.required}
                        value={answerVal ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                        placeholder={field.placeholder || ''}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
                      />
                    )}

                    {field.type === 'number' && (
                      <input
                        type="number"
                        required={field.required}
                        value={answerVal ?? ''}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            [field.id]: e.target.value === '' ? '' : Number(e.target.value)
                          })
                        }
                        placeholder={field.placeholder || 'e.g. 3'}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
                      />
                    )}

                    {field.type === 'boolean' && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="radio"
                            name={`bool_${field.id}`}
                            checked={answerVal === true}
                            onChange={() => setAnswers({ ...answers, [field.id]: true })}
                            className="text-brand-indigo focus:ring-0"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="radio"
                            name={`bool_${field.id}`}
                            checked={answerVal === false}
                            onChange={() => setAnswers({ ...answers, [field.id]: false })}
                            className="text-brand-indigo focus:ring-0"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    )}

                    {field.type === 'select' && (
                      <select
                        required={field.required}
                        value={answerVal ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none"
                      >
                        <option value="">{field.placeholder || 'Select an option...'}</option>
                        {(field.options || []).map((opt: string, idx: number) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'multiselect' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(field.options || []).map((opt: string, idx: number) => {
                          const currentSelected: string[] = Array.isArray(answerVal) ? answerVal : [];
                          const isSelected = currentSelected.includes(opt);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? currentSelected.filter((item) => item !== opt)
                                  : [...currentSelected, opt];
                                setAnswers({ ...answers, [field.id]: next });
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                isSelected
                                  ? 'bg-brand-indigo text-white border-brand-indigo shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        required={field.required}
                        value={answerVal ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo focus:outline-none bg-white"
                      />
                    )}

                    {field.helpText && <p className="text-[11px] text-slate-400">{field.helpText}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section 4: Mandatory Consent Checkbox */}
          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-brand-indigo focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                {form.schema?.consentText ||
                  'I consent to the collection, processing and retention of my personal data and resume for recruitment purposes in accordance with data privacy regulations.'}
                <span className="text-state-danger font-bold ml-1">*</span>
                <span className="block mt-1 text-[11px] text-slate-400">
                  Read our <Link to="/privacy" target="_blank" className="text-brand-indigo underline">Privacy Policy</Link> and <Link to="/terms" target="_blank" className="text-brand-indigo underline">Terms</Link>. You can request erasure anytime via our <Link to="/privacy/delete-data" target="_blank" className="text-brand-indigo underline">Candidate Privacy Portal</Link>.
                </span>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitMutation.isPending || !resumeFile || !consent}
              className="w-full py-3 px-4 rounded-lg text-sm font-bold text-white bg-brand-indigo hover:bg-brand-hover active:bg-indigo-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <span>Submit Application</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-2 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-state-success" />
              Secured with ATS criteria validation & encryption.
            </p>
          </div>
        </form>
      </div>

      {/* Footer branding */}
      <footer className="text-center py-6 text-xs text-slate-400">
        Powered by{' '}
        <span className="font-semibold text-slate-600">ShortlistIQ ATS Recruitment Platform</span>
      </footer>
    </div>
  );
};

