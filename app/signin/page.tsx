"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { AuthFeedback } from "@/components/ui/auth-feedback";
import { Mail, Lock, LogIn, ArrowLeft, Shield, Eye, EyeOff } from "lucide-react";
import { BackgroundPaths } from "@/components/ui/background-paths";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function SignInPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function logLogin(userId: string, status: string) {
    try {
      const userAgent = navigator.userAgent;
      const resp = await fetch("/api/access/login-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          status,
          userAgent,
          browser: userAgent.includes("Edg/")
            ? "Edge"
            : userAgent.includes("Chrome/")
              ? "Chrome"
              : userAgent.includes("Firefox/")
                ? "Firefox"
                : userAgent.includes("Safari/")
                  ? "Safari"
                  : "Unknown",
          operatingSystem: userAgent.includes("Windows NT")
            ? "Windows"
            : userAgent.includes("Mac OS X")
              ? "macOS"
              : userAgent.includes("Android")
                ? "Android"
                : userAgent.includes("iPhone")
                  ? "iOS"
                  : "Unknown",
          deviceType: /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "Mobile" : "Desktop",
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        console.error("login-log failed:", err ?? await resp.text());
      }
    } catch {
      // ignore logging errors but surface to console for debugging
      console.error("login-log request error");
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setFeedback({ type: "error", message: result.error.message });
      setLoading(false);
      return;
    }

    const user = result.data?.user ?? null;

    // Ensure the officers table is linked to this auth user (set user_id)
    try {
      if (user?.id && user?.email) {
        await fetch("/api/officers/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            fullName: (user.user_metadata ?? {})?.full_name ?? (user.user_metadata ?? {})?.fullName ?? undefined,
          }),
        });
      }
    } catch (e) {
      // ignore linking failures; login flow continues
      console.error("officers.complete linking failed:", e);
    }

    const response = await fetch(`/api/access/context?userId=${user.id}`);
    const context = await response.json().catch(() => null);

    if (!context?.found) {
      setFeedback({
        type: "error",
        message: "Your account is not yet linked to the officer panel. Please contact the admin.",
      });
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    await logLogin(user.id, context.isAdmin ? "admin" : context.canGenerate ? "approved" : "pending");

    if (context.isAdmin) {
      router.replace("/admin");
    } else if (context.canGenerate) {
        router.replace("/home");
    } else {
      setFeedback({
        type: "success",
        message: "Your request is pending admin approval. You can check the pending page while waiting.",
      });
      router.replace("/pending");
    }

    setLoading(false);
  }

  function goToSignUp() {
    router.push("/signup");
  }

  return (
    <>
      <div className="relative min-h-screen bg-[#020617] flex flex-col justify-between overflow-hidden">
        {/* Background Animation (3D Animation 3: Flowing trails) */}
        <BackgroundPaths mode="background" className="opacity-60" />
        
        {/* Radial brand blending overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.05)_0%,transparent_60%)] z-5" />



        {/* Custom Perspective styles */}
        <style jsx global>{`
          .perspective-1000 {
            perspective: 1000px;
          }
          .preserve-3d {
            transform-style: preserve-3d;
          }
        `}</style>

        {/* Main Centered Content */}
        <div className="flex-1 flex items-center justify-center px-4 py-16 relative z-10 perspective-1000">
          <motion.div 
            className="w-full max-w-[440px] relative z-10 preserve-3d"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            whileHover={{ rotateY: 5, rotateX: -5, scale: 1.02 }}
          >
            {/* Glow Ring Behind Card */}
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-[#38bdf8]/20 to-transparent opacity-30 blur-2xl transition duration-500" />
            
            <div className="relative w-full backdrop-blur-xl bg-[#0f172a]/40 border border-[#38bdf8]/10 rounded-3xl p-8 sm:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.6)] space-y-6">
              
              {/* Header logo & title */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105">
                  <Image
                    src="/gda_logo.png"
                    alt="GDA Logo"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#38bdf8] dmsans block">
                    Access Portal
                  </span>
                  <h2 className="playfair text-2xl font-bold text-white tracking-wide">
                    Officer Sign In
                  </h2>
                  <p className="text-xs text-white/55 dmsans font-light max-w-[280px] leading-relaxed">
                    Authorized access only. Use your official GDA credentials to securely log into the verification engine.
                  </p>
                </div>
              </div>

              <AuthFeedback
                message={feedback?.message ?? null}
                type={feedback?.type ?? "error"}
                onClose={() => setFeedback(null)}
              />

              <form className="space-y-5" onSubmit={signInWithPassword}>
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 pl-1 dmsans">
                    Official Email
                  </label>
                  <div className="relative group">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38bdf8]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="name@gda.gov.pk"
                      className="w-full rounded-2xl border border-white/5 bg-white/2 px-4 py-3.5 pl-11 text-sm text-white placeholder:text-white/20 outline-none transition duration-300 focus:border-[#38bdf8]/30 focus:bg-white/5 focus:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between pl-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 dmsans">
                      Secure Password
                    </label>
                    <button type="button" className="text-[9px] font-bold text-[#38bdf8]/60 hover:text-[#38bdf8] transition-colors dmsans uppercase tracking-tighter">
                      Forgot?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38bdf8]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-white/5 bg-white/2 px-4 py-3.5 pl-11 pr-11 text-sm text-white placeholder:text-white/20 outline-none transition duration-300 focus:border-[#38bdf8]/30 focus:bg-white/5 focus:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] p-[1px] font-semibold transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(30,64,175,0.25)] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#020617]/40 transition-colors group-hover:bg-transparent">
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : (
                      <>
                        <span className="dmsans text-sm text-white tracking-wide">Sign In to Dashboard</span>
                        <LogIn className="h-4 w-4 text-[#38bdf8] group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </button>

                {/* Footer Links */}
                <div className="pt-4 flex flex-col items-center space-y-4">
                  <div className="flex items-center gap-4 text-[11px] text-white/30 dmsans uppercase tracking-widest">
                    <span className="h-px w-8 bg-white/5" />
                    New to the portal?
                    <span className="h-px w-8 bg-white/5" />
                  </div>
                  
                  <button
                    type="button"
                    onClick={goToSignUp}
                    className="group flex items-center gap-2 text-[#38bdf8] hover:text-white transition-all duration-300 dmsans font-bold text-xs uppercase tracking-widest"
                  >
                    <span>Request Officer Access</span>
                    <div className="h-5 w-5 rounded-full border border-[#38bdf8]/20 flex items-center justify-center group-hover:bg-[#38bdf8]/10 transition-colors">
                      <Shield className="h-2.5 w-2.5" />
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
