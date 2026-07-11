import { Component, type ErrorInfo, type ReactNode } from 'react';

import { AppButton } from './AppButton';

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
        <div
          className="utility-tool"
          style={{ padding: 48, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}
        >
          <h2 style={{ marginBottom: 12 }}>{label} hit an error</h2>
          <p style={{ color: 'var(--muted, #5b6475)', marginBottom: 20 }}>
            Switching browser tabs during translation can interrupt the in-browser model. Reload to
            continue — your original PDF is unchanged.
          </p>
          <p style={{ fontSize: 13, color: '#8a93a3', marginBottom: 24, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <AppButton title="Try again" onClick={this.reset} />
            <AppButton title="Reload page" variant="ghost" onClick={() => window.location.reload()} />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
