import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}
interface ErrorBoundaryState {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {}

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main style={{ padding: "2rem", maxWidth: "42rem", margin: "0 auto" }}>
          <h1>Something went wrong while rendering this review</h1>
          <p>
            Your file content never left this browser. Reload the page to start again; if a specific
            file triggers this repeatedly, please report it with the file shape (not its contents if
            they are private).
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Skillcheck
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
