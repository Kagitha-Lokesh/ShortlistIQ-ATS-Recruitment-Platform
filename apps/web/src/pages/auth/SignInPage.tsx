import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { SignInInputSchema, SignInInput } from '@shortlistiq/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { LogIn, ArrowRight, Loader2 } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const { signIn, signInWithOAuth, resetPasswordForEmail } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInInputSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: SignInInput) => {
    try {
      await signIn(data);
      showToast({
        type: 'success',
        title: 'Signed in successfully',
        message: 'Welcome back to your workspace.'
      });
      navigate('/hr/dashboard');
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Sign in failed',
        message: err instanceof Error ? err.message : 'Invalid credentials. Please try again.'
      });
    }
  };

  const handleOAuth = async (provider: 'google' | 'azure') => {
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      showToast({
        type: 'info',
        title: `${provider === 'google' ? 'Google' : 'Microsoft'} Sign In`,
        message: err instanceof Error ? err.message : 'OAuth provider connection pending.'
      });
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email) {
      showToast({
        type: 'warning',
        title: 'Email Required',
        message: 'Please enter your email address in the field first to receive reset instructions.'
      });
      return;
    }

    try {
      setIsResetting(true);
      await resetPasswordForEmail(email);
      showToast({
        type: 'success',
        title: 'Reset link dispatched',
        message: `Password reset instructions sent to ${email}.`
      });
    } catch (err) {
      showToast({
        type: 'info',
        title: 'Password Reset',
        message: err instanceof Error ? err.message : 'Failed to dispatch reset email.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="bg-card border border-slate-border rounded-lg p-8 shadow-soft">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded bg-indigo-50 border border-indigo-100 text-brand-indigo flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-primary">Sign in to ShortlistIQ</h1>
          <p className="text-xs text-slate-secondary mt-1">Access your HR shortlisting workspace</p>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border border-slate-border bg-white hover:bg-slate-50 transition-colors text-slate-primary"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuth('azure')}
            className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border border-slate-border bg-white hover:bg-slate-50 transition-colors text-slate-primary"
          >
            <svg className="w-4 h-4" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Microsoft
          </button>
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-slate-border w-full"></div>
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 absolute">
            Or with email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-primary mb-1">
              Work Email
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="you@company.com"
              className="w-full px-3 py-2 text-xs rounded border border-slate-border bg-white text-slate-primary placeholder-slate-400 focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-colors"
            />
            {errors.email && (
              <p className="text-[11px] text-state-danger mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-primary">Password</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-[11px] text-brand-indigo hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs rounded border border-slate-border bg-white text-slate-primary placeholder-slate-400 focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-colors"
            />
            {errors.password && (
              <p className="text-[11px] text-state-danger mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-border text-center text-xs text-slate-secondary">
          Don't have an HR organization account?{' '}
          <Link to="/auth/signup-hr" className="font-semibold text-brand-indigo hover:underline">
            Sign Up as HR
          </Link>
        </div>
      </div>
    </div>
  );
};

