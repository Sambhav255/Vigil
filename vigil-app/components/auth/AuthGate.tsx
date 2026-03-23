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
              <div className={styles.brandName}>VIGIL</div>
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
