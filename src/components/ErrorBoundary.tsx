import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches rendering errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            background: "#fafafa",
            color: "#333",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "#666",
              maxWidth: "400px",
              marginBottom: "1.5rem",
            }}
          >
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details
              style={{
                marginBottom: "1.5rem",
                maxWidth: "500px",
                textAlign: "left",
                fontSize: "0.85rem",
                color: "#888",
              }}
            >
              <summary style={{ cursor: "pointer" }}>Error details</summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginTop: "0.5rem",
                  padding: "0.75rem",
                  background: "#f0f0f0",
                  borderRadius: "6px",
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "8px",
                border: "none",
                background: "#f6421f",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
                background: "#fff",
                color: "#333",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
