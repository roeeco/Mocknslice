import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

interface ViewportErrorBoundaryState {
  failed: boolean;
}

export class ViewportErrorBoundary extends Component<
  PropsWithChildren,
  ViewportErrorBoundaryState
> {
  state: ViewportErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ViewportErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The 3D viewport stopped rendering.', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="webgl-fallback" role="alert">
          The 3D preview stopped rendering. Model data and inspection controls remain available.
        </div>
      );
    }
    return this.props.children;
  }
}
