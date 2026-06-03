"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { AuthFeedback } from "@/components/ui/auth-feedback";
import { Mail, Lock, User, Briefcase, Building2, UserPlus, ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { BackgroundPaths } from "@/components/ui/background-paths";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function SignUpPage() {
  const supabase: any = getSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("BCA");
  const [customDepartment, setCustomDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>(["BCA", "Administration", "Tourism", "Accounts", "Technical"]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 5500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  // Fetch all departments (built-in + custom saved by admin)
  useEffect(() => {
    fetch(`/api/departments?_t=${Date.now()}`)
      .then(r => r.json())
      .then(body => {
        if (body.departments?.length) {
          setDepartments([...body.departments, "Any Other"]);
        }
      })
      .catch(() => {}); // fallback to defaults on error
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
      const finalDepartment = department === "Any Other" ? customDepartment.trim() : department;
      if (!finalDepartment) throw new Error("Department is required.");

      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName,
            designation,
            department: finalDepartment,
            role: "officer",
          },
        },
      });

      if (result.error) {
        setFeedback({ type: "error", message: result.error.message });
      } else {
        try {
          await fetch("/api/officers/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              fullName,
              designation,
              department: finalDepartment,
              userId: result.data?.user?.id ?? null,
              role: "officer",
            }),
          });
        } catch {
          // ignore request creation failures for now; auth user still exists
        }

        setFeedback({
          type: "success",
          message: "Your request has been sent to admin for approval.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message ?? "Sign-up failed." });
    }

    setLoading(false);
  }

  return (
    <>
      <div className="relative min-h-screen bg-[#020617] flex flex-col justify-between overflow-hidden">
        {/* Background Animation (3D Animation 3: Flowing trails) */}
        <BackgroundPaths mode="background" className="opacity-60" />

        {/* Radial brand blending overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.05)_0%,transparent_60%)] z-5" />

        {/* Back Link */}
        <div className="absolute top-6 left-6 z-30">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-xs font-semibold text-white/85 transition-all duration-300 hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[#38bdf8]" />
            <span>Go Back</span>
          </Link>
        </div>

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
            className="w-full max-w-[520px] relative z-10 preserve-3d"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            whileHover={{ rotateY: -3, rotateX: 3, scale: 1.01 }}
          >
            {/* Glow Ring Behind Card */}
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-[#38bdf8]/20 to-transparent opacity-30 blur-2xl transition duration-500" />

            <div className="relative w-full backdrop-blur-xl bg-[#0f172a]/40 border border-[#38bdf8]/10 rounded-3xl p-8 sm:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.6)] space-y-6">

              {/* Header logo & title */}
              <div className="flex flex-col items-center text-center space-y-3.5">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105">
                  <Image
                    src="/gda_logo.png"
                    alt="GDA Logo"
                    width={64}
                    height={64} className="object-contain"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#38bdf8] dmsans block">
                    New Officer Registration
                  </span>
                  <h2 className="playfair text-2xl font-bold text-white tracking-wide">
                    Create Officer Account
                  </h2>
                  <p className="text-xs text-white/55 dmsans font-light max-w-xs leading-relaxed">
                    Enter your official details below to register. Your account will require administrator approval before logging in.
                  </p>
                </div>
              </div>

              <AuthFeedback
                message={feedback?.message ?? null}
                type={feedback?.type ?? "error"}
                onClose={() => setFeedback(null)}
              />

              <form className="space-y-5" onSubmit={handleSignUp}>
                <div className="grid gap-4 sm:grid-cols-2">

                  {/* Full Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 pl-1 dmsans">
                      Full Name
                    </label>
                    <div className="relative group">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38bdf8]" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        placeholder="Full name"
                        className="w-full rounded-2xl border border-white/5 bg-white/2 px-4 py-3.5 pl-11 text-sm text-white placeholder:text-white/20 outline-none transition duration-300 focus:border-[#38bdf8]/30 focus:bg-white/5 focus:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                      />
                    </div>
                  </div>

                  {/* Designation */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 pl-1 dmsans">
                      Designation
                    </label>
                    <div className="relative group">
                      <Briefcase className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38bdf8]" />
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        required
                        placeholder="e.g. Planning Officer"
                        className="w-full rounded-2xl border border-white/5 bg-white/2 px-4 py-3.5 pl-11 text-sm text-white placeholder:text-white/20 outline-none transition duration-300 focus:border-[#38bdf8]/30 focus:bg-white/5 focus:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 pl-1 dmsans">
                      Department
                    </label>
                    <div className="relative group">
                      <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38bdf8]" />
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-white/5 bg-[#0f172a] px-4 py-3.5 pl-11 text-sm text-white outline-none transition duration-300 focus:border-[#38bdf8]/30 focus:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                      >
                        {departments.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    {department === "Any Other" && (
                      <div className="relative group mt-3">
                        <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38bdf8]" />
                        <input
                          type="text"
                          value={customDepartment}
                          onChange={(e) => setCustomDepartment(e.target.value)}
                          required
                          placeholder="Enter department name"
                          className="w-full rounded-2xl border border-white/5 bg-white/2 px-4 py-3.5 pl-11 text-sm text-white placeholder:text-white/20 outline-none transition duration-300 focus:border-[#38bdf8]/30 focus:bg-white/5 focus:shadow-[0_0_20px_rgba(56,189,248,0.05)]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Official Email */}
                  <div className="space-y-1.5 sm:col-span-2">
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

                  {/* Secure Password */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 pl-1 dmsans">
                      Secure Password
                    </label>
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
                </div>

                {/* Sign Up Button */}
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
                        <span className="dmsans text-sm text-white tracking-wide">Submit Registration Request</span>
                        <UserPlus className="h-4 w-4 text-[#38bdf8] group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </button>

                {/* Footer Links */}
                <div className="pt-2 flex flex-col items-center space-y-4">
                  <div className="flex items-center gap-4 text-[11px] text-white/30 dmsans uppercase tracking-widest">
                    <span className="h-px w-8 bg-white/5" />
                    Already registered?
                    <span className="h-px w-8 bg-white/5" />
                  </div>

                  <Link
                    href="/signin"
                    className="group flex items-center gap-2 text-[#38bdf8] hover:text-white transition-all duration-300 dmsans font-bold text-xs uppercase tracking-widest"
                  >
                    <span>Back to Sign In</span>
                    <div className="h-5 w-5 rounded-full border border-[#38bdf8]/20 flex items-center justify-center group-hover:bg-[#38bdf8]/10 transition-colors">
                      <LogIn className="h-2.5 w-2.5" />
                    </div>
                  </Link>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}



