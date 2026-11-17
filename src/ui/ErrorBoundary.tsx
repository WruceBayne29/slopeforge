import { Component } from 'react';
import type { ReactNode } from 'react';

/** Shows a plain message instead of a blank page if a view throws while rendering. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>SlopeForge hit a problem</h1>
        <p>Something went wrong while drawing the page: {this.state.message}</p>
        <p>
          Reloading usually clears it. If a link or file caused this, please report it at{' '}
          <a href="https://github.com/WruceBayne29/slopeforge/issues">
            github.com/WruceBayne29/slopeforge
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '';
            window.location.reload();
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
