"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, LockKeyhole } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabaseClient";

export function AuthButton() {
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setEmail(data?.session?.user?.email ?? null);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    router.replace("/");
  }

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="dmsans text-[12px] text-white/50 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 mr-2 max-w-[180px] truncate">
            {email}
          </div>
          <button
            onClick={signOut}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-red-400/20 text-red-400/70 hover:border-red-400/40 hover:text-red-400 px-3 py-2 transition-all duration-300"
          >
            <LogOut size={15} />
            <span className="dmsans text-[13px] font-medium">Sign out</span>
          </button>
        </div>

        {/* Mobile compact sign-out */}
        <button
          onClick={signOut}
          disabled={loading}
          className="sm:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-[#7F1D1D]/20 text-red-400 hover:text-white transition-all duration-300 hover:scale-105 shadow-md"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <a
      href="/signin"
      aria-label="Portal Sign In"
      title="Admin Sign In"
      className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/5 text-[#38bdf8] hover:bg-[#38bdf8]/15 hover:border-[#38bdf8]/60 transition-all duration-300"
    >
      <LockKeyhole size={17} />
    </a>
  );
}
