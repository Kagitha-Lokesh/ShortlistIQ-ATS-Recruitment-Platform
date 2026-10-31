import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { SignInInputSchema, SignInInput } from '@shortlistiq/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { LogIn, ArrowRight, ShieldCheck, Mail, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Input, Label } from '../../components/ui/Input.js';
import { Card, CardContent } from '../../components/ui/Card.js';

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
        message: 'Welcome back to your HR workspace.'
      });
      navigate('/hr/dashboard');
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Sign in failed',
        message: err instanceof Error ? err.message : 'Invalid credentials. Please verify your email and password.'
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
        message: err instanceof Error ? err.message : 'OAuth provider connection initiated.'
      });
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email) {
      showToast({
        type: 'warning',
        title: 'Email Required',
        message: 'Please enter your email address in the field to receive reset instructions.'
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
    <div className="max-w-md mx-auto px-4 py-16">
      <Card className="p-6 sm:p-8 shadow-subtle">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded bg-surface-subtle border border-border text-ink-primary flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">Sign in to ShortlistIQ</h1>
          <p className="text-xs text-ink-secondary mt-1">Access your HR screening workspace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label required>Work Email Address</Label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="recruiter@company.com"
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label required className="mb-0">Password</Label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-[11px] text-ink-secondary hover:text-ink-primary hover:underline transition-colors select-none"
              >
                {isResetting ? 'Sending link…' : 'Forgot password?'}
              </button>
            </div>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-3.5 h-3.5" />}
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isSubmitting}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Sign In to Dashboard
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-surface px-3 text-[11px] uppercase tracking-wider text-ink-muted">
            Or continue with SSO
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOAuth('google')}
            className="w-full"
          >
            Google Workspace
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOAuth('azure')}
            className="w-full"
          >
            Microsoft Entra
          </Button>
        </div>

        {/* Footer Links */}
        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-ink-secondary space-y-2">
          <p>
            Don't have an HR workspace yet?{' '}
            <Link to="/auth/signup-hr" className="font-semibold text-ink-primary hover:underline">
              Create an organization account
            </Link>
          </p>
          <p className="text-[11px] text-ink-muted">
            Are you a job candidate?{' '}
            <Link to="/checker" className="text-primary hover:underline">
              Check your resume free without an account
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
