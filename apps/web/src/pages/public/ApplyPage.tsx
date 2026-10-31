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
      <div className="min-h-screen bg-ground py-12 px-4 flex items-center justify-center">
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
      <div className="min-h-screen bg-ground flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-surface p-8 rounded-lg shadow-soft border border-border max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center mx-auto text-ink-muted">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-ink-primary">Application Form Not Found</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            The link you accessed may be incorrect or the job posting may have been removed or archived.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition-colors shadow-2xs"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Closed Form
  if (!form.isPublished) {
    return (
      <div className="min-h-screen bg-ground flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-surface p-8 rounded-lg shadow-soft border border-border max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-ink-primary">Applications Closed</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            The application form for <strong className="text-ink-primary">{form.jobTitle || form.title}</strong> is
            currently closed and is no longer accepting new submissions.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-surface border border-border text-ink-primary hover:bg-surface-hover transition-colors shadow-2xs"
            >
              Visit ShortlistIQ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Submission Success Confirmation Screen
  if (submittedRef) {
    return (
      <div className="min-h-screen bg-ground flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-surface p-8 sm:p-10 rounded-xl shadow-soft border border-border max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-ink-primary">Application Submitted Successfully</h2>
            <p className="text-xs text-ink-secondary">
              Thank you for applying for <span className="font-semibold text-ink-primary">{form.jobTitle || form.title}</span>.
              Your application has been received and registered.
            </p>
          </div>

          {/* Reference ID Card */}
          <div className="p-4 bg-surface-subtle border border-border rounded-lg space-y-2">
            <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Application Reference ID
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-lg font-bold text-brand tracking-wider select-all">{submittedRef}</span>
              <button
                type="button"
                onClick={handleCopyRef}
                className="p-1.5 bg-surface border border-border rounded text-ink-secondary hover:text-brand hover:bg-surface-hover transition-colors shadow-2xs"
                title="Copy reference number"
              >
                {copiedRef ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-ink-muted">Please save this reference ID for any status inquiries regarding your application.</p>
          </div>

          <div className="p-3 bg-surface border border-border rounded-lg text-left space-y-1.5 text-xs text-ink-secondary">
            <div className="flex items-center gap-1.5 font-semibold text-ink-primary text-xs">
              <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
              <span>Next Steps & Review Process</span>
            </div>
            <p className="leading-relaxed text-[11px] text-ink-secondary">
              Our recruitment team evaluates candidates against verified role requirements. Every decision is reviewed by a human recruiter. If your profile is shortlisted, our team will contact you via email with interview details.
            </p>
          </div>

          <div className="text-[11px] text-ink-muted pt-2 border-t border-border flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-ink-primary underline transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/privacy/delete-data" className="hover:text-ink-primary underline transition-colors">Candidate Erasure Request</Link>
          </div>
        </div>
      </div>
    );
  }

  const customFields: FormField[] = (form.schema?.fields || []).filter((f: FormField) => !f.isLocked);

  return (
    <div className="min-h-screen bg-ground py-10 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header Banner */}
        <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-soft space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-surface-subtle text-ink-secondary border border-border">
            <Briefcase className="w-3.5 h-3.5 text-brand" />
            Job Application
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-primary tracking-tight">
            {form.jobTitle || form.title}
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Please fill out the form below and upload your resume in text-based PDF format. Each application is carefully reviewed against role requirements.
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
          className="bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-soft space-y-6"
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted border-b border-border pb-2">
              1. Candidate Information
            </h3>

            <div>
              <label className="block text-xs font-semibold text-ink-primary mb-1">
                Full Name <span className="text-state-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Email Address <span className="text-state-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@example.com"
                  className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Phone Number <span className="text-state-danger">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Resume PDF Upload */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted border-b border-border pb-2">
              2. Resume Document <span className="text-state-danger">*</span>
            </h3>

            <div className="border border-dashed border-border hover:border-border-strong rounded-lg p-6 text-center transition-colors bg-surface-subtle">
              <input
                type="file"
                id="resumeUpload"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {resumeFile ? (
                <div className="flex items-center justify-between p-3 bg-surface border border-emerald-200 rounded text-left max-w-md mx-auto">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-ink-primary truncate max-w-[200px] sm:max-w-xs">
                        {resumeFile.name}
                      </div>
                      <div className="text-[10px] text-ink-muted font-mono">
                        {(resumeFile.size / 1024).toFixed(0)} KB • PDF Document
                      </div>
                    </div>
                  </div>
                  <label
                    htmlFor="resumeUpload"
                    className="text-xs font-semibold text-brand hover:text-brand-hover cursor-pointer px-2 py-1"
                  >
                    Change
                  </label>
                </div>
              ) : (
                <label htmlFor="resumeUpload" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-ink-muted">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-ink-primary">
                    Click to select resume <span className="text-ink-muted font-normal">or drag and drop</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    Text-based PDF only (Max 10MB). Scanned image PDFs without selectable text cannot be processed.
                  </p>
                </label>
              )}
            </div>
          </div>

          {/* Section 3: Custom Screening Questions (if any) */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted border-b border-border pb-2">
                3. Screening Questions
              </h3>

              {customFields.map((field: FormField) => {
                const answerVal = answers[field.id];

                return (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-primary">
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
                        className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={3}
                        required={field.required}
                        value={answerVal ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                        placeholder={field.placeholder || ''}
                        className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none leading-relaxed"
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
                        className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    )}

                    {field.type === 'boolean' && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-primary">
                          <input
                            type="radio"
                            name={`bool_${field.id}`}
                            checked={answerVal === true}
                            onChange={() => setAnswers({ ...answers, [field.id]: true })}
                            className="text-brand focus:ring-0"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-primary">
                          <input
                            type="radio"
                            name={`bool_${field.id}`}
                            checked={answerVal === false}
                            onChange={() => setAnswers({ ...answers, [field.id]: false })}
                            className="text-brand focus:ring-0"
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
                        className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
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
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                                isSelected
                                  ? 'bg-brand text-white border-brand shadow-2xs'
                                  : 'bg-surface-subtle text-ink-secondary border-border hover:bg-surface-hover'
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
                        className="w-full text-xs px-3.5 py-2.5 border border-border rounded bg-surface text-ink-primary focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    )}

                    {field.helpText && <p className="text-[11px] text-ink-muted">{field.helpText}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section 4: Mandatory Consent Checkbox */}
          <div className="pt-4 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-border text-brand focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-ink-secondary leading-relaxed">
                {form.schema?.consentText ||
                  'I consent to the collection, processing and retention of my personal data and resume for recruitment evaluation in accordance with data privacy regulations.'}
                <span className="text-state-danger font-bold ml-1">*</span>
                <span className="block mt-1 text-[11px] text-ink-muted">
                  Read our <Link to="/privacy" target="_blank" className="text-brand underline hover:text-brand-hover">Privacy Policy</Link> and <Link to="/terms" target="_blank" className="text-brand underline hover:text-brand-hover">Terms</Link>. You can request data erasure anytime via our <Link to="/privacy/delete-data" target="_blank" className="text-brand underline hover:text-brand-hover">Candidate Privacy Portal</Link>.
                </span>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitMutation.isPending || !resumeFile || !consent}
              className="w-full py-3 px-4 rounded text-xs font-semibold text-white bg-brand hover:bg-brand-hover active:bg-brand transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <p className="text-center text-[11px] text-ink-muted mt-2.5 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              <span>Transmitted securely over encrypted HTTPS. Verifiable audit logging.</span>
            </p>
          </div>
        </form>
      </div>

      {/* Footer branding */}
      <footer className="text-center py-6 text-xs text-ink-muted">
        Powered by{' '}
        <span className="font-semibold text-ink-secondary">ShortlistIQ ATS Recruitment Platform</span>
      </footer>
    </div>
  );
};

