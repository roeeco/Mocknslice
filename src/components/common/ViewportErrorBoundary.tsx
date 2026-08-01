import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

interface ViewportErrorBoundaryState {
  failed: boolean;
}

interface ViewportErrorBoundaryProps extends PropsWithChildren {
  resetKey: string;
}

export class ViewportErrorBoundary extends Component<
  ViewportErrorBoundaryProps,
  ViewportErrorBoundaryState
> {
  state: ViewportErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ViewportErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The 3D viewport stopped rendering.', error, info.componentStack);
  }

  componentDidUpdate(previous: ViewportErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="webgl-fallback" role="alert">
          <p>
            The 3D preview stopped rendering. Model data and inspection controls remain available.
          </p>
          <button type="button" onClick={() => this.setState({ failed: false })}>
            Retry 3D preview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
