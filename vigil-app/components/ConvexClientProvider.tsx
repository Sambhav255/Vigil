"use client";

import { ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

// Only initialise the Convex client when the URL is configured.
// Without it, auth features are unavailable but the dashboard still renders.
const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  if (!convex) {
    // Convex not configured — render children without auth wrapping
    return <>{children}</>;
  }

  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
