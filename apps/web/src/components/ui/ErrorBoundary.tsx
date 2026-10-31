import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Note: Privacy first: never log personal data
    console.error('ErrorBoundary caught error:', error.message, errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.fallbackComponent) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-6">
          <div className="bg-white border border-slate-border rounded-lg p-8 max-w-md w-full shadow-soft text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-state-danger flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-primary mb-2">
              Something went wrong
            </h3>
            <p className="text-xs text-slate-secondary mb-6 leading-relaxed">
              An unexpected error occurred while rendering this view. Your data is safe.
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  private get fallbackComponent() {
    return Boolean(this.props.fallback);
  }
}

