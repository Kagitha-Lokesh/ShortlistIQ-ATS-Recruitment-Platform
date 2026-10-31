import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { SignUpHRInputSchema, SignUpHRInput } from '@shortlistiq/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Building2, ArrowRight, User, Mail, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Input, Label } from '../../components/ui/Input.js';
import { Card } from '../../components/ui/Card.js';

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
        message: `Welcome to ShortlistIQ, ${data.fullName}. Organization "${data.organizationName}" is ready.`
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
    <div className="max-w-md mx-auto px-4 py-12">
      <Card className="p-6 sm:p-8 shadow-subtle">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded bg-surface-subtle border border-border text-ink-primary flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">Register HR Organization</h1>
          <p className="text-xs text-ink-secondary mt-1">
            Deterministic resume screening with multi-tenant privacy
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label required>Full Name</Label>
            <Input
              type="text"
              placeholder="Sarah Jenkins"
              leftIcon={<User className="w-3.5 h-3.5" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />
          </div>

          <div>
            <Label required>Company / Organization Name</Label>
            <Input
              type="text"
              placeholder="Acme Global Inc."
              leftIcon={<Building2 className="w-3.5 h-3.5" />}
              error={errors.organizationName?.message}
              {...register('organizationName')}
            />
          </div>

          <div>
            <Label required>Work Email Address</Label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="s.jenkins@acme.com"
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <Label required>Password (minimum 8 characters)</Label>
            <Input
              type="password"
              autoComplete="new-password"
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
            Create Organization & Sign In
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-ink-secondary space-y-2">
          <p>
            Already have an HR account?{' '}
            <Link to="/auth/signin" className="font-semibold text-ink-primary hover:underline">
              Sign In
            </Link>
          </p>
          <p className="text-[11px] text-ink-muted">
            By creating an account, you agree to our Terms of Service and EEOC-compliant hiring principles.
          </p>
        </div>
      </Card>
    </div>
  );
};
