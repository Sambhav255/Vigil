# Add Convex Backend with Auth and User Profiles to Vigil

## Overview

Add Convex as the backend for Vigil. Use Convex Auth (their built-in auth library — NOT Clerk, NOT Auth0) for authentication with GitHub OAuth + email/password. Create user profiles with watchlists, alert preferences, and hit-rate validation logging. Everything must work on Convex's free tier.

**Important**: Read the Convex docs before implementing anything:
- Quickstart: https://docs.convex.dev/quickstart/nextjs
- Convex Auth: https://labs.convex.dev/auth
- Convex Auth setup: https://labs.convex.dev/auth/setup
- Passwords: https://labs.convex.dev/auth/config/passwords
- OAuth: https://labs.convex.dev/auth/config/oauth
- Auth in functions: https://docs.convex.dev/auth/functions-auth

---

## Step 1: Install and Initialize Convex

```bash
npm install convex @convex-dev/auth @auth/core
npx convex dev
```

This creates a `convex/` folder and prompts you to log in with GitHub and create a project. Keep `npx convex dev` running in a terminal — it syncs your backend functions to the cloud automatically.

Add the Convex URL to your `.env.local`:
```
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

---

## Step 2: Set Up Convex Auth

### convex/auth.config.ts
```ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### convex/auth.ts
```ts
import GitHub from "@auth/core/providers/github";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub, Password],
});
```

### convex/http.ts
```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

### Set environment variables in Convex dashboard (npx convex dashboard):
- `SITE_URL` = `http://localhost:3000` (development) 
- `AUTH_GITHUB_ID` = your GitHub OAuth app client ID
- `AUTH_GITHUB_SECRET` = your GitHub OAuth app client secret

To create a GitHub OAuth app: go to github.com → Settings → Developer settings → OAuth Apps → New. Set callback URL to `https://your-deployment.convex.site/api/auth/callback/github`

---

## Step 3: Define the Schema

### convex/schema.ts
```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // User profiles (extends the auth users table)
  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    watchlist: v.array(v.string()), // ticker symbols: ["NVDA", "BTC", "SPY"]
    alertPreferences: v.object({
      emailAlerts: v.boolean(),
      severityThreshold: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      assetFilter: v.array(v.string()), // only alert for these tickers
      mutedCategories: v.array(v.string()), // muted force categories
    }),
    dashboardLayout: v.object({
      sectorFilter: v.optional(v.string()),
      assetClassFilter: v.string(), // "all" | "stocks" | "crypto" | "commodities"
      threatSortBy: v.string(), // "severity" | "probability" | "recent"
    }),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Hit-rate validation logging
  alertLog: defineTable({
    userId: v.optional(v.id("users")),
    threatId: v.string(),
    threatTitle: v.string(),
    asset: v.string(),
    direction: v.string(), // "bearish" | "bullish"
    compositeScore: v.number(),
    probability: v.number(),
    probSource: v.string(),
    category: v.string(),
    severity: v.string(),
    assetPriceAtAlert: v.number(),
    priceAt1h: v.optional(v.number()),
    priceAt4h: v.optional(v.number()),
    priceAt24h: v.optional(v.number()),
    priceAt7d: v.optional(v.number()),
    wasCorrect: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"])
    .index("by_asset", ["asset"]),

  // User-saved threat notes
  savedThreats: defineTable({
    userId: v.id("users"),
    threatId: v.string(),
    note: v.optional(v.string()),
    savedAt: v.number(),
  }).index("by_userId", ["userId"])
    .index("by_userId_threatId", ["userId", "threatId"]),
});
```

---

## Step 4: Backend Functions

### convex/profiles.ts
```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// Get current user's profile
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return profile;
  },
});

// Create profile on first login
export const createProfile = mutation({
  args: {
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if profile already exists
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("profiles", {
      userId,
      displayName: args.displayName,
      watchlist: ["SPY", "QQQ", "BTC", "ETH", "NVDA", "TSLA", "GLD", "CL"],
      alertPreferences: {
        emailAlerts: false,
        severityThreshold: "high",
        assetFilter: [],
        mutedCategories: [],
      },
      dashboardLayout: {
        assetClassFilter: "all",
        threatSortBy: "severity",
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

// Update watchlist
export const updateWatchlist = mutation({
  args: {
    watchlist: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      watchlist: args.watchlist,
      lastActiveAt: Date.now(),
    });
  },
});

// Update alert preferences
export const updateAlertPreferences = mutation({
  args: {
    alertPreferences: v.object({
      emailAlerts: v.boolean(),
      severityThreshold: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      assetFilter: v.array(v.string()),
      mutedCategories: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      alertPreferences: args.alertPreferences,
      lastActiveAt: Date.now(),
    });
  },
});

// Update dashboard layout preferences
export const updateDashboardLayout = mutation({
  args: {
    dashboardLayout: v.object({
      sectorFilter: v.optional(v.string()),
      assetClassFilter: v.string(),
      threatSortBy: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      dashboardLayout: args.dashboardLayout,
      lastActiveAt: Date.now(),
    });
  },
});
```

### convex/alertLog.ts
```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// Log an alert for hit-rate validation
export const logAlert = mutation({
  args: {
    threatId: v.string(),
    threatTitle: v.string(),
    asset: v.string(),
    direction: v.string(),
    compositeScore: v.number(),
    probability: v.number(),
    probSource: v.string(),
    category: v.string(),
    severity: v.string(),
    assetPriceAtAlert: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    return await ctx.db.insert("alertLog", {
      userId: userId ?? undefined,
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update price tracking for hit-rate validation
export const updateAlertPrice = mutation({
  args: {
    alertId: v.id("alertLog"),
    field: v.union(
      v.literal("priceAt1h"),
      v.literal("priceAt4h"),
      v.literal("priceAt24h"),
      v.literal("priceAt7d")
    ),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      [args.field]: args.price,
    });
  },
});

// Get hit-rate stats
export const getHitRateStats = query({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db
      .query("alertLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    const completed = alerts.filter((a) => a.priceAt24h !== undefined);
    if (completed.length === 0) return { hitRate: null, total: 0, correct: 0 };

    const correct = completed.filter((a) => {
      if (!a.priceAt24h || !a.assetPriceAtAlert) return false;
      const moved = a.priceAt24h - a.assetPriceAtAlert;
      if (a.direction === "bearish") return moved < 0;
      if (a.direction === "bullish") return moved > 0;
      return false;
    });

    return {
      hitRate: Math.round((correct.length / completed.length) * 100),
      total: completed.length,
      correct: correct.length,
    };
  },
});
```

### convex/savedThreats.ts
```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const saveThread = mutation({
  args: {
    threatId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("savedThreats")
      .withIndex("by_userId_threatId", (q) =>
        q.eq("userId", userId).eq("threatId", args.threatId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { note: args.note });
      return existing._id;
    }

    return await ctx.db.insert("savedThreats", {
      userId,
      threatId: args.threatId,
      note: args.note,
      savedAt: Date.now(),
    });
  },
});

export const getMySavedThreats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("savedThreats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const removeSavedThreat = mutation({
  args: { threatId: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("savedThreats")
      .withIndex("by_userId_threatId", (q) =>
        q.eq("userId", userId).eq("threatId", args.threatId)
      )
      .first();

    if (existing) await ctx.db.delete(existing._id);
  },
});
```

---

## Step 5: Frontend Provider Setup

### components/ConvexClientProvider.tsx
```tsx
"use client";

import { ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
```

### app/layout.tsx — wrap the app with the provider
```tsx
import ConvexClientProvider from "@/components/ConvexClientProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

---

## Step 6: Auth UI Components

### components/auth/SignInForm.tsx

Build a sign-in/sign-up form that supports both GitHub OAuth and email/password. Use the `useAuthActions` hook from `@convex-dev/auth/react`.

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn("password", { email, password, flow });
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div>
      {/* GitHub OAuth button */}
      <button onClick={() => signIn("github")}>
        Continue with GitHub
      </button>

      <div>{/* divider: "or" */}</div>

      {/* Email/password form */}
      <form onSubmit={handleEmailPassword}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p>{error}</p>}
        <button type="submit" disabled={loading}>
          {flow === "signIn" ? "Sign In" : "Sign Up"}
        </button>
      </form>

      <button onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
```

---

## Step 7: Auth Gating on the Dashboard

### components/auth/AuthGate.tsx

Use Convex's `<Authenticated>`, `<Unauthenticated>`, and `<AuthLoading>` components to gate the dashboard.

```tsx
"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInForm } from "./SignInForm";

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        {/* Loading spinner while checking auth state */}
        <div className="flex h-screen items-center justify-center bg-[#09090b]">
          <div className="text-zinc-500 text-sm">Loading...</div>
        </div>
      </AuthLoading>

      <Unauthenticated>
        {/* Full-screen login page */}
        <LoginPage />
      </Unauthenticated>

      <Authenticated>
        {/* The actual dashboard */}
        {children}
      </Authenticated>
    </>
  );
}

function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#09090b]">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
            VIGIL
          </h1>
          <p className="text-sm text-zinc-500">
            Geopolitical event severity intelligence
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
```

### Use AuthGate in the main page

In your main dashboard page (probably `app/page.tsx` or wherever the dashboard renders), wrap it:

```tsx
import { AuthGate } from "@/components/auth/AuthGate";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
```

---

## Step 8: User Profile Button and Settings

### components/UserProfileButton.tsx

Add a small user avatar/button in the top-right of the dashboard that opens a settings dropdown. Use `useAuthActions` for sign out, and `useQuery` to fetch the profile.

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";

export function UserProfileButton() {
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getMyProfile);
  const createProfile = useMutation(api.profiles.createProfile);
  const [open, setOpen] = useState(false);

  // Auto-create profile on first login
  useEffect(() => {
    if (profile === null) {
      createProfile({ displayName: "Trader" });
    }
  }, [profile, createProfile]);

  if (profile === undefined) return null; // loading

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">
          {profile?.displayName?.[0]?.toUpperCase() || "V"}
        </div>
        <span className="text-xs text-zinc-400">
          {profile?.displayName || "Trader"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-lg p-3 z-50 shadow-xl">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            Profile
          </div>
          <div className="text-sm text-zinc-300 mb-3">
            {profile?.displayName}
          </div>

          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            Watchlist
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {profile?.watchlist?.map((t: string) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="border-t border-zinc-800 pt-2 mt-2">
            <button
              onClick={() => signOut()}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Place `<UserProfileButton />` in the top-right corner of your ticker bar or metric row.

---

## Step 9: Settings Panel

Create a settings panel (modal or slide-over) where users can:

1. **Edit display name** — mutation: `updateProfile`
2. **Manage watchlist** — add/remove tickers with `updateWatchlist` mutation
3. **Set alert preferences** — severity threshold, muted categories with `updateAlertPreferences`
4. **View hit-rate stats** — query: `getHitRateStats` — shows "X% of high-severity alerts correctly predicted direction within 24h (N total)"

The settings panel should match Vigil's dark theme: bg-zinc-900, border-zinc-800, text-zinc-100 for headings, text-zinc-400 for body, accent color for buttons.

---

## Styling Notes

The login page and all auth UI must match Vigil's existing dark theme:
- Background: bg-[#09090b]
- Cards: bg-zinc-900/50 border border-zinc-800
- Input fields: bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-red-500/40 rounded-md px-3 py-2 text-sm
- Buttons (primary): bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 rounded-md px-4 py-2 text-sm font-medium
- GitHub button: bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 with a GitHub icon
- Divider text ("or"): text-zinc-600 text-xs with border lines on each side
- Error messages: text-red-400 text-xs
- Link text: text-zinc-500 hover:text-zinc-300 text-xs

---

## What NOT to do

- Do NOT use Clerk or Auth0 — use Convex Auth (built-in). It's free with no external service dependency.
- Do NOT create a separate users table — Convex Auth already creates one via `authTables`. The `profiles` table extends it with a `userId` foreign key.
- Do NOT use `useAuth()` from Clerk — use `useConvexAuth()` from `convex/react` for auth state.
- Do NOT store passwords yourself — Convex Auth handles hashing with Scrypt automatically.
- Do NOT add any features not listed here. This is specifically: auth + profiles + watchlist + alert preferences + hit-rate logging + settings panel.
- Do NOT change any existing dashboard functionality, data, or layout. Only ADD the auth gate, user button, and settings panel.
