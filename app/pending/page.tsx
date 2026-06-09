"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/ui/footer";
import { getSupabaseClient } from "../../lib/supabaseClient";

export default function PendingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    supabase.auth.getUser().then((result: any) => {
      if (!result.data?.user) {
        router.replace("/signin");
      }
    });
  }, [router, supabase]);

  return (
    <>
      <div className="min-h-screen bg-[var(--color-bg)] px-4 py-20 text-[var(--color-text)]">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[0_18px_60px_rgba(17,24,39,0.08)]">
          <p className="font-dm-sans text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            Request Pending
          </p>
          <h1 className="mt-3 font-playfair text-4xl font-bold text-[var(--color-deep)]">
            Your officer account is waiting for admin approval.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-soft)] font-dm-sans">
            You have verified your email successfully. Now an admin must approve your request before the generate page opens.
            Once approved, you can sign in again and access the document generation workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/signin")}
              className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 font-semibold text-white transition hover:bg-[#143527]"
            >
              Back to sign in
            </button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/signin");
              }}
              className="rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 font-semibold text-[var(--color-deep)] transition hover:border-[var(--color-accent)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
