import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortlistApi } from '../../lib/api.js';
import {
  ShieldAlert,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Trash2,
  Lock,
  Clock,
  Sparkles
} from 'lucide-react';

export const CandidateDataDeletionPage: React.FC = () => {
  const [step, setStep] = useState<'request' | 'verify' | 'completed'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    recordsDeleted: number;
    filesDeleted: number;
  } | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await shortlistApi.requestDeletion(email);
      setStep('verify');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit numeric verification code.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await shortlistApi.verifyDeletion(email, code);
      setResultData(res.data);
      setStep('completed');
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-indigo transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to ShortlistIQ Home
        </Link>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-state-danger flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-primary">
              Candidate Right to Erasure
            </h1>
            <p className="text-xs text-slate-secondary leading-relaxed">
              In compliance with GDPR and CCPA privacy standards, you can permanently delete all your job applications, uploaded resumes, and ATS scores across every hiring organization.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-state-danger">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Submit Email */}
          {step === 'request' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-primary mb-1">
                  Your Candidate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alex.mercer@example.com"
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-indigo bg-white text-slate-primary"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  We will send a one-time 6-digit confirmation code to verify your identity.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                {isLoading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 2: Enter 6-digit Code */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
                <Clock className="w-4 h-4 text-brand-indigo flex-shrink-0 mt-0.5" />
                <span>
                  A 6-digit code was dispatched to <strong>{email}</strong>. It will expire in 15 minutes.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-primary mb-1">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-sm font-mono tracking-widest pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-brand-indigo bg-white text-slate-primary font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-state-danger flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Irreversible Action:</strong> Once confirmed, all candidate applications, resumes, answers, and scores will be permanently deleted.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="w-1/3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Change Email
                </button>
                <button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="w-2/3 py-2 text-xs font-semibold rounded-lg text-white bg-state-danger hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isLoading ? 'Purging Records...' : 'Confirm & Delete Everything'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success Screen */}
          {step === 'completed' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-state-success border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-primary">
                  All Records Permanently Deleted
                </h3>
                <p className="text-xs text-slate-secondary mt-1">
                  Your privacy request has been fully executed across all organizations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div>
                  <p className="text-[11px] text-slate-400">Applications Removed</p>
                  <p className="text-lg font-bold text-slate-primary mt-0.5">
                    {resultData?.recordsDeleted ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Files Cleared</p>
                  <p className="text-lg font-bold text-slate-primary mt-0.5">
                    {resultData?.filesDeleted ?? 0}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center w-full py-2 px-4 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Return to Homepage
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400">
          Protected under ShortlistIQ Zero-Retention & Privacy Framework • AES-256 Encrypted
        </p>
      </div>
    </div>
  );
};

