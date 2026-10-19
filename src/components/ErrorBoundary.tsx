import { Component } from 'react';
import type { ErrorInfo, PropsWithChildren, ReactNode } from 'react';

type FallbackRender = (props: { error: Error; resetError: () => void }) => ReactNode;

interface ErrorBoundaryProps {
  fallback?: ReactNode | FallbackRender;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback !== undefined) {
        return typeof fallback === 'function'
          ? fallback({ error, resetError: this.resetError })
          : fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-[#0b0f19] text-neutral-100 font-sans antialiased px-4">
          <div className="w-full max-w-lg bg-[rgba(11,15,25,0.65)] border border-white/5 rounded-2xl p-8 shadow-2xl text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
              </svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">Error</p>
            <h1 className="text-xl font-extrabold tracking-wide mb-3">Something went wrong</h1>
            <pre className="text-xs text-neutral-400 bg-neutral-950/60 border border-white/5 rounded-xl p-3 mb-6 whitespace-pre-wrap break-words text-left font-mono">
              {error.message}
            </pre>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="bg-amber-500 text-neutral-950 font-bold rounded-xl px-4 py-2 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Reload
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="bg-neutral-900/40 border border-white/5 text-neutral-300 font-bold rounded-xl px-4 py-2 hover:text-neutral-100 hover:border-white/10 transition-all cursor-pointer"
              >
                Back to home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
