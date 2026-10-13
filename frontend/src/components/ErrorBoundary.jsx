import React from 'react';
import { ShieldAlert, RefreshCw, ArrowLeft, Home, AlertTriangle } from 'lucide-react';

/**
 * NER88 Institutional React Error Boundary
 * Prevents application crashes from rendering blank screens.
 * Complies with Section 5 of the Master Debug Specification.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[NER88 ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoToCommandCenter = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/command-center';
  };

  render() {
    if (this.state.hasError) {
      const { sectionName = 'Section' } = this.props;
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-[320px] w-full p-6 sm:p-8 flex flex-col items-center justify-center bg-white border border-[#D9E0E7] rounded-[8px] shadow-subtle my-4 text-[#17202A] font-sans">
          <div className="w-12 h-12 rounded-[8px] bg-[#C62828]/10 border border-[#C62828]/30 flex items-center justify-center text-[#C62828] mb-4 shadow-subtle">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="text-center max-w-lg space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/20">
              <span>NER88</span>
              <span>&bull;</span>
              <span>Application Error</span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-[#0B2744]">
              Something went wrong while loading this section.
            </h2>

            <p className="text-xs text-[#5B6570]">
              The section <strong className="text-[#17202A]">{sectionName}</strong> encountered an error during rendering. Other sections and navigation remain fully functional.
            </p>

            {/* Error detail box */}
            <div className="p-3 bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] text-left text-xs font-mono text-[#C62828] break-all my-3 max-h-36 overflow-y-auto">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#5B6570] mb-1 font-sans">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D99A00]" />
                <span>Diagnostic Message:</span>
              </div>
              <div>{errorMessage}</div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs flex items-center gap-1.5 shadow-subtle transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Section</span>
              </button>

              <button
                onClick={this.handleGoToCommandCenter}
                className="px-4 py-2 rounded-[6px] bg-white hover:bg-[#F6F8FA] text-[#123B66] border border-[#D9E0E7] font-bold text-xs flex items-center gap-1.5 shadow-subtle transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-[#185A8D]" />
                <span>Return to Command Center</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
