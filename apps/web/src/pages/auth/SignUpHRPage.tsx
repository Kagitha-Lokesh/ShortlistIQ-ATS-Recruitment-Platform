import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { SignUpHRInputSchema, SignUpHRInput } from '@shortlistiq/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';

export const SignUpHRPage: React.FC = () => {
  const { signUpHR } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignUpHRInput>({
    resolver: zodResolver(SignUpHRInputSchema),
    defaultValues: {
      fullName: '',
      organizationName: '',
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: SignUpHRInput) => {
    try {
      await signUpHR(data);
      showToast({
        type: 'success',
        title: 'Account & Organization created',
        message: `Welcome to ShortlistIQ, ${data.fullName}. Organization ${data.organizationName} is ready.`
      });
      navigate('/hr/dashboard');
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Registration failed',
        message: err instanceof Error ? err.message : 'Failed to create HR account. Please try again.'
      });
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <div className="bg-card border border-slate-border rounded-lg p-8 shadow-soft">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded bg-indigo-50 border border-indigo-100 text-brand-indigo flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-primary">Register Your HR Organization</h1>
          <p className="text-xs text-slate-secondary mt-1">
            Deterministic resume screening with multi-tenant privacy
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-primary mb-1">
              Full Name
            </label>
            <input
              type="text"
              {...register('fullName')}
              placeholder="Sarah Jenkins"
              className="w-full px-3 py-2 text-xs rounded border border-slate-border bg-white text-slate-primary placeholder-slate-400 focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-colors"
            />
            {errors.fullName && (
              <p className="text-[11px] text-state-danger mt-1">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-primary mb-1">
              Company / Organization Name
            </label>
            <input
              type="text"
              {...register('organizationName')}
              placeholder="Acme Recruitment Ltd."
              className="w-full px-3 py-2 text-xs rounded border border-slate-border bg-white text-slate-primary placeholder-slate-400 focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-colors"
            />
            {errors.organizationName && (
              <p className="text-[11px] text-state-danger mt-1">{errors.organizationName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-primary mb-1">
              Work Email
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="sarah@acme.com"
              className="w-full px-3 py-2 text-xs rounded border border-slate-border bg-white text-slate-primary placeholder-slate-400 focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-colors"
            />
            {errors.email && (
              <p className="text-[11px] text-state-danger mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-primary mb-1">
              Password (min 8 characters)
            </label>
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating Organization...
                </>
              ) : (
                <>
                  Create HR Organization Account
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-border text-center text-xs text-slate-secondary">
          Already have an account?{' '}
          <Link to="/auth/signin" className="font-semibold text-brand-indigo hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

