import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-subtle border border-transparent',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200',
  outline: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 shadow-subtle',
  danger: 'bg-white text-red-700 hover:bg-red-50 border border-red-200',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 border border-transparent shadow-subtle'
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5 rounded',
  md: 'px-3.5 py-1.5 text-xs font-medium gap-2 rounded-md',
  lg: 'px-4 py-2 text-sm font-medium gap-2.5 rounded-md'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'outline',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center transition-colors font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
