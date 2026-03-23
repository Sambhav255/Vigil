"use client";

// NOTE: This component requires `npx convex dev` to have been run first.
// Until convex/_generated/api exists, this renders nothing.

import { useEffect, useState } from "react";
import styles from "./UserProfileButton.module.css";

// Lazy-load Convex hooks so the app compiles even before `npx convex dev`
let _useAuthActions: (() => { signOut: () => void }) | null = null;
let _useQuery: ((api: unknown) => unknown) | null = null;
let _useMutation: ((api: unknown) => (args: unknown) => Promise<unknown>) | null = null;
let _api: Record<string, Record<string, unknown>> | null = null;
let _convexLoaded = false;

async function loadConvex() {
  if (_convexLoaded) return;
  try {
    const [authMod, convexMod, apiMod] = await Promise.all([
      import("@convex-dev/auth/react"),
      import("convex/react"),
      import("@/convex/_generated/api"),
    ]);
    _useAuthActions = authMod.useAuthActions;
    _useQuery = convexMod.useQuery as typeof _useQuery;
    _useMutation = convexMod.useMutation as typeof _useMutation;
    _api = apiMod.api as typeof _api;
    const profiles = _api?.profiles as
      | { getMyProfile?: unknown; createProfile?: unknown }
      | undefined;
    if (!profiles?.getMyProfile || !profiles?.createProfile) {
      return;
    }
    _convexLoaded = true;
  } catch {
    // Convex not yet initialised — render nothing
  }
}

type Profile = {
  displayName?: string;
  watchlist?: string[];
  alertPreferences?: { severityThreshold?: string };
} | null | undefined;

function ProfileButtonInner() {
  const authActions = _useAuthActions?.();
  const signOut = authActions?.signOut;
  const profile = _useQuery!(_api!.profiles.getMyProfile) as Profile;
  const createProfile = _useMutation!(_api!.profiles.createProfile);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (profile === null) {
      void (createProfile as (args: { displayName: string }) => Promise<unknown>)({ displayName: "Trader" });
    }
  }, [profile, createProfile]);

  if (profile === undefined) return null;

  const initial = profile?.displayName?.[0]?.toUpperCase() ?? "V";

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label="User profile"
      >
        <span className={styles.avatar}>{initial}</span>
        <span className={styles.name}>{profile?.displayName ?? "Trader"}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropSection}>
              <div className={styles.dropLabel}>Signed in as</div>
              <div className={styles.dropValue}>{profile?.displayName ?? "Trader"}</div>
            </div>

            {profile?.watchlist && profile.watchlist.length > 0 && (
              <div className={styles.dropSection}>
                <div className={styles.dropLabel}>Watchlist</div>
                <div className={styles.watchlist}>
                  {profile.watchlist.map((t: string) => (
                    <span key={t} className={styles.watchChip}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.dropSection}>
              <div className={styles.dropLabel}>Alert threshold</div>
              <div className={styles.dropValue}>
                {profile?.alertPreferences?.severityThreshold ?? "high"} severity
              </div>
            </div>

            {signOut && (
              <div className={styles.dropFooter}>
                <button
                  type="button"
                  className={styles.signOutBtn}
                  onClick={() => void signOut()}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function UserProfileButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadConvex().then(() => {
      if (_convexLoaded) setReady(true);
    });
  }, []);

  if (!ready) return null;

  // Re-render with hooks now that Convex modules are loaded
  return <ProfileButtonInner />;
}
