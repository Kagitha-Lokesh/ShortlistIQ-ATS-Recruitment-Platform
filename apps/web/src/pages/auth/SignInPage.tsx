import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { SignInInputSchema, SignInInput } from '@shortlistiq/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { LogIn, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';

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
      <div className="bg-surface border border-border rounded-md p-8 shadow-subtle">
        <div className="text-center mb-6">
          <div className="w-9 h-9 rounded bg-surface-subtle border border-border text-ink-primary flex items-center justify-center mx-auto mb-2.5">
            <LogIn className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-bold text-ink-primary">Sign in to ShortlistIQ</h1>
          <p className="text-xs text-ink-secondary mt-0.5">Access your HR screening workspace</p>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOAuth('google')}
            leftIcon={
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
            }
          >
            Google
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOAuth('azure')}
            leftIcon={
              <svg className="w-3.5 h-3.5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
            }
          >
            Microsoft
          </Button>
        </div>

        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-border w-full"></div>
          <span className="bg-surface px-2.5 text-[10px] uppercase tracking-wider text-ink-muted absolute">
            Or with email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-ink-primary mb-1">
              Work Email
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="you@company.com"
              className="w-full px-3 py-2 text-xs rounded border border-border bg-surface text-ink-primary placeholder-ink-muted focus:border-primary focus:outline-none transition-colors"
            />
            {errors.email && (
              <p className="text-[11px] text-state-danger mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-ink-primary">Password</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-[11px] text-brand-accent hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs rounded border border-border bg-surface text-ink-primary placeholder-ink-muted focus:border-primary focus:outline-none transition-colors"
            />
            {errors.password && (
              <p className="text-[11px] text-state-danger mt-1">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-1"
            isLoading={isSubmitting}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-5 pt-5 border-t border-border text-center text-xs text-ink-secondary">
          Don't have an HR organization account?{' '}
          <Link to="/auth/signup-hr" className="font-semibold text-ink-primary hover:underline">
            Sign Up as HR
          </Link>
        </div>
      </div>
    </div>
  );
};
