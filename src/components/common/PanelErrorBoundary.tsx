import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "./EmptyState.tsx";

interface PanelErrorBoundaryProps {
  readonly children: ReactNode;
  readonly label: string;
}
interface PanelErrorBoundaryState {
  readonly failed: boolean;
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  override state: PanelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PanelErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {}

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div>
          <EmptyState
            title={`${this.props.label} could not be loaded`}
            description="The rest of your review is unaffected. This usually means the app was updated while this page was open."
          />
          <p style={{ textAlign: "center" }}>
            <button type="button" onClick={() => window.location.reload()}>
              Reload Skillcheck
            </button>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
