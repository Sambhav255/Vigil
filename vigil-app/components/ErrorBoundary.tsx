"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
};

type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("[VigilDashboard] UI error boundary caught:", error, info);
  }

  render() {
    const { hasError } = this.state;
    const { fallback, label, children } = this.props;

    if (hasError) {
      return (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.25)",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          {label ? <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div> : null}
          {fallback ?? "Something went wrong while rendering this section."}
        </div>
      );
    }

    return children;
  }
}

