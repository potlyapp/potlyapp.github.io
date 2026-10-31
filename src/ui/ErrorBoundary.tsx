import { Component, type ErrorInfo, type ReactNode } from 'react';
import { fa } from '../i18n/fa';

interface Props {
  children: ReactNode;
  /** `root` replaces the whole screen and offers a reload; `section` keeps the shell and offers retry + home. */
  level?: 'root' | 'section';
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Potly render error', error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const root = this.props.level === 'root';
    return (
      <section role="alert" aria-labelledby="error-title" className="error-boundary">
        <h1 id="error-title" tabIndex={-1} ref={(el) => el?.focus()}>
          {fa.errorBoundary.title}
        </h1>
        <p>{root ? fa.errorBoundary.rootBody : fa.errorBoundary.body}</p>
        <div className="form-actions">
          {root ? (
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              {fa.errorBoundary.reload}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={this.retry}>
                {fa.errorBoundary.retry}
              </button>
              <a className="btn" href="/">
                {fa.errorBoundary.home}
              </a>
            </>
          )}
        </div>
      </section>
    );
  }
}
