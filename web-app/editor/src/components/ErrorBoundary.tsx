import { Component, type ErrorInfo, type ReactNode } from 'react';
import { House, RefreshCw, RotateCcw } from 'lucide-react';

import { AppButton } from './AppButton';
import { AppStatus } from './AppStatus';
import './ErrorBoundary.css';

type Props = {
  children: ReactNode;
  /** Optional label shown in the recovery UI (e.g. "Translate"). */
  label?: string;
};

type State = {
  error: Error | null;
};

/**
 * Catches render/runtime errors so a crashed tool (e.g. after tab backgrounding kills WASM)
 * shows a reload affordance instead of a blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const label = this.props.label ?? 'This tool';
      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <a className="error-boundary__brand" href="/edit/">
              <img src="/assets/app-icon.png" alt="" width={36} height={36} />
              Hindi PDF <strong>Editor</strong>
            </a>
            <span className="error-boundary__eyebrow">Safe recovery</span>
            <h2>{label} needs a quick reset</h2>
            <p className="error-boundary__intro">
              Switching browser tabs during translation can interrupt browser processing. Your
              original PDF is unchanged.
            </p>
            <AppStatus tone="error" title="What happened">
              {this.state.error.message}
            </AppStatus>
            <div className="error-boundary__actions">
              <AppButton
                title="Try again"
                icon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={this.reset}
              />
              <AppButton
                title="Reload page"
                icon={<RefreshCw size={16} aria-hidden="true" />}
                variant="secondary"
                onClick={() => window.location.reload()}
              />
            </div>
            <a className="error-boundary__home" href="/edit/">
              <House size={15} aria-hidden="true" /> Back to all tools
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
