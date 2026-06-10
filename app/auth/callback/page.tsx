"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import { Footer } from "@/components/ui/footer";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function handle() {
      try {
        const currentUrl = new URL(window.location.href);
        const code = currentUrl.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("Auth callback error:", error);
            router.replace("/signin");
            return;
          }
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          router.replace("/signin");
          return;
        }

        const user = userData.user;
        const userMetadata = (user.user_metadata ?? {}) as Record<string, string>;

        try {
          if (user?.id && user?.email) {
            await fetch("/api/officers/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user.id,
                email: user.email,
                fullName: userMetadata.full_name ?? userMetadata.fullName ?? "",
                designation: userMetadata.designation ?? "",
                department: userMetadata.department ?? "BCA",
                role: userMetadata.role ?? "officer",
              }),
            });
          }
        } catch (err) {
          // ignore
        }

        let response = await fetch(`/api/access/context?userId=${user.id}`);
        if (response.status === 404) {
          response = await fetch(`/api/access/context?email=${encodeURIComponent(user.email)}`);
        }
        const context = await response.json().catch(() => null);

        try {
          const resp = await fetch("/api/access/login-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              status: context?.isAdmin ? "admin" : context?.canGenerate ? "approved" : "pending",
              userAgent: navigator.userAgent,
            }),
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => null);
            console.error("login-log failed:", err ?? await resp.text());
          }
        } catch (e) {
          console.error("login-log request error:", e);
        }

        if (context?.isAdmin) {
          router.replace("/admin");
          return;
        }

        if (context?.canGenerate) {
          router.replace("/home");
          return;
        }

        router.replace("/pending");
      } catch (err) {
        console.error(err);
        router.replace("/signin");
      }
    }

    handle();
  }, [router]);

  return (
    <>
      <div className="mx-auto max-w-md p-6">Signing you in...</div>
      <Footer />
    </>
  );
}
