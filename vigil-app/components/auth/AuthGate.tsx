"use client";

import { ReactNode } from "react";
import styles from "./AuthGate.module.css";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

// When Convex is not configured, skip auth entirely and render children directly.
// Once NEXT_PUBLIC_CONVEX_URL is set and `npx convex dev` has been run, auth activates.
export function AuthGate({ children }: { children: ReactNode }) {
  if (!CONVEX_URL) {
    return <>{children}</>;
  }

  return <AuthGateInner>{children}</AuthGateInner>;
}

function AuthGateInner({ children }: { children: ReactNode }) {
  // Dynamic require so the module only loads when Convex is configured
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Authenticated, AuthLoading, Unauthenticated } = require("convex/react") as {
    Authenticated: React.FC<{ children: ReactNode }>;
    AuthLoading: React.FC<{ children: ReactNode }>;
    Unauthenticated: React.FC<{ children: ReactNode }>;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignInForm } = require("./SignInForm") as { SignInForm: React.FC };

  return (
    <>
      <AuthLoading>
        <div className={styles.fullScreen}>
          <div className={styles.loadingDot} />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className={styles.fullScreen}>
          <div className={styles.card}>
            <div className={styles.brand}>
              <div className={styles.brandName}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8, marginTop: -2 }}>
                  <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <line x1="12" y1="9" x2="12" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  <line x1="12" y1="15" x2="12" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  <line x1="9" y1="12" x2="5.5" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  <line x1="15" y1="12" x2="18.5" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                </svg>
                VIGIL
              </div>
              <div className={styles.brandSub}>Geopolitical event severity intelligence</div>
            </div>
            <SignInForm />
            <p className={styles.legal}>
              Vigil displays geopolitical event severity data and is not investment advice.
            </p>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>{children}</Authenticated>
    </>
  );
}
