"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "../lib/supabaseClient";

export default function SplashPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkAuthAndRedirect = async () => {
      // Create a 3-second minimum display timer
      const timer = new Promise((resolve) => setTimeout(resolve, 3000));

      // Simultaneously check user authentication
      const checkAuth = async () => {
        try {
          const { data } = await supabase.auth.getUser();
          if (!data?.user) return "/signin";

          const res = await fetch(`/api/access/context?userId=${data.user.id}`);
          const body = await res.json().catch(() => null);

          if (body?.found) {
            if (body.isAdmin) return "/admin";
            if (body.canGenerate) return "/home";
          }
          return "/signin";
        } catch (e) {
          return "/signin";
        }
      };

      // Wait for both the 3-second timer and the auth check to complete
      const [_, nextRoute] = await Promise.all([timer, checkAuth()]);

      // Redirect smoothly
      router.replace(nextRoute as string);
    };

    checkAuthAndRedirect();
  }, [router, supabase]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020617] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03)_0%,transparent_60%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.05)_0%,transparent_70%)] animate-pulse duration-[3000ms]" />
        {/* Subtle noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="relative mb-8">
          {/* Logo glow */}
          <div className="absolute inset-0 rounded-full bg-[#38bdf8]/10 blur-2xl animate-pulse" />
          
          <motion.div
             initial={{ rotateY: 90 }}
             animate={{ rotateY: 0 }}
             transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
             style={{ perspective: 1000 }}
          >
            <Image
              src="/gda_logo.png"
              alt="GDA Logo"
              width={130}
              height={130}
              className="relative z-10 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              priority
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center space-y-3"
        >
          <h1 className="playfair text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-widest uppercase">
            Galiyat Development <span className="text-gradient-blue text-glow-blue">Authority</span>
          </h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
          >
            <p className="dmsans text-[11px] sm:text-sm font-bold tracking-[0.4em] uppercase text-white/50">
              Document Verification System
            </p>
          </motion.div>
        </motion.div>

        {/* Loading Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-14 w-64 h-[2px] bg-white/5 rounded-full overflow-hidden relative"
        >
          <motion.div
            initial={{ width: "0%", x: "0%" }}
            animate={{ width: ["0%", "50%", "100%"] }}
            transition={{ 
              duration: 2.2, 
              delay: 1, 
              ease: "easeInOut" 
            }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#1e40af] via-[#38bdf8] to-[#1e40af]"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
