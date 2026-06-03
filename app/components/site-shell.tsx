"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SiteHeader } from "./site-header";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { LoadingState } from "@/components/ui/loading-state";

const LAST_ACTIVE_KEY = "gdav_last_active";
const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function SiteShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = getSupabaseClient();
  const [checkingSession, setCheckingSession] = useState(true);
  const activityRef = useRef<number>(Date.now());

  const isAdminRoute = pathname?.startsWith("/admin");
  const isOfficerRoute = pathname === "/home" || pathname === "/history" || pathname === "/generate" || pathname === "/pending";
  const isSplashRoute = pathname === "/";
  const hasCustomHeader = isAdminRoute || isOfficerRoute || isSplashRoute;

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
        const now = Date.now();

        // If last active is older than threshold, sign out and send to signin
        if (user && lastActive && now - lastActive > SESSION_IDLE_MS) {
          await supabase.auth.signOut();
          if (mounted) router.replace("/signin");
          return;
        }

        // If there's no server session, just continue (public landing will show)
        // Otherwise preserve user and continue to app
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    check();

    // Update last-active periodically on user activity
    function setActive() {
      activityRef.current = Date.now();
      try {
        localStorage.setItem(LAST_ACTIVE_KEY, String(activityRef.current));
      } catch { }
    }

    const events = ["mousemove", "keydown", "touchstart", "visibilitychange"] as const;
    events.forEach((ev) => document.addEventListener(ev, setActive));

    // Save on unload
    const onBeforeUnload = () => {
      try {
        localStorage.setItem(LAST_ACTIVE_KEY, String(activityRef.current));
      } catch { }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      mounted = false;
      events.forEach((ev) => document.removeEventListener(ev, setActive));
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {!hasCustomHeader && <SiteHeader />}

      {/* Polished full-screen loader while checking session on site open */}
      {checkingSession ? (
        <LoadingState title="Loading" subtitle="Checking Your Session..." />
      ) : (
        <main className={!hasCustomHeader ? "pt-[68px] sm:pt-[72px]" : ""}>{children}</main>
      )}
    </div>
  );
}