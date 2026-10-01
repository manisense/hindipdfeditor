import { Component, type ErrorInfo, type ReactNode } from 'react';

import { RecoveryScreen } from './RecoveryScreen';
import './ErrorBoundary.css';

type Props = {
  children: ReactNode;
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
      return <RecoveryScreen error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}
