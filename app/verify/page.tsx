"use client";

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { BrowserMultiFormatReader, ChecksumException } from "@zxing/library";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Database,
  Info,
  Keyboard,
  Lock,
  SearchCheck,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Footer } from "@/components/ui/footer";
import { BackgroundPaths } from "@/components/ui/background-paths";

type VerificationMode = "manual" | "scan";
type VerificationStatus = "authentic" | "invalid" | "revoked";

type VerificationResult = {
  status: VerificationStatus;
  documentId?: string;
  title?: string;
  department?: string;
  recipient?: string;
  issueDate?: string;
  expiryDate?: string;
};

type ResultRow = {
  label: string;
  value: string | undefined;
  monospace?: boolean;
};

const formatResult = (value: string) => value.trim().toUpperCase();

// Subcomponent that uses useSearchParams inside a Suspense block
function VerifyContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<VerificationMode>("manual");
  const [documentId, setDocumentId] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const verifyDocument = useCallback(async (rawDocumentId: string): Promise<VerificationResult> => {
    const normalized = formatResult(rawDocumentId);
    if (!normalized) {
      return { status: "invalid" };
    }

    setIsChecking(true);
    try {
      const response = await fetch(`/api/verify?id=${encodeURIComponent(normalized)}`);
      const payload = (await response.json().catch(() => null)) as
        | VerificationResult
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("status" in payload)) {
        return { status: "invalid" };
      }
      return payload as VerificationResult;
    } catch {
      return { status: "invalid" };
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Auto-verify on mount if "id" param exists in URL
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) {
      const cleanId = idParam.trim();
      const autoVerify = async () => {
        await Promise.resolve(); // Defer state update asynchronously to avoid synchronous effect warnings
        setDocumentId(cleanId);
        const res = await verifyDocument(cleanId);
        setResult(res);
      };
      autoVerify();
    }
  }, [searchParams, verifyDocument]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Scanning logic using ZXing for multi-platform support
  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();

    const startScanning = async () => {
      try {
        const videoInputDevices = await codeReader.listVideoInputDevices();
        // Select back camera if available
        const selectedDeviceId = videoInputDevices.length > 1
          ? videoInputDevices.find(device => device.label.toLowerCase().includes('back'))?.deviceId || videoInputDevices[0].deviceId
          : videoInputDevices[0]?.deviceId;

        await codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current, async (result, err) => {
          if (result) {
            const detectedValue = result.getText();
            if (detectedValue) {
              const verificationResult = await verifyDocument(detectedValue);
              setResult(verificationResult);
              setScanning(false);
              codeReader.reset();
            }
          }
          if (err && !(err instanceof ChecksumException)) {
            // Error handling for non-critical errors if needed
          }
        });
      } catch (err) {
        console.error("Scanner Error:", err);
        setCameraError("Failed to initialize scanner. Please check camera permissions.");
      }
    };

    startScanning();

    return () => {
      codeReader.reset();
    };
  }, [scanning, verifyDocument]);

  const handleManualVerify = async () => {
    if (!documentId.trim()) return;
    setResult(await verifyDocument(documentId));
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setMode("scan");
      setScanning(true);
    } catch {
      setCameraError("Camera access is unavailable or permission was denied.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const resetVerification = () => {
    setResult(null);
    setDocumentId("");
    setMode("manual");
    stopCamera();
    setCameraError(null);
  };

  const renderRows = (rows: ResultRow[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#38bdf8]/10 bg-white dark:bg-[#0f172a]/95">
      {rows.map((row, idx) => (
        <div
          key={row.label}
          className={`grid grid-cols-1 gap-1 border-b border-slate-100 dark:border-white/5 px-5 py-4 last:border-b-0 sm:grid-cols-[160px_1fr] sm:items-center ${idx % 2 === 0 ? "bg-slate-50 dark:bg-white/5" : "bg-transparent"
            }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/40 dmsans">
            {row.label}
          </p>
          <div className="text-sm text-slate-900 dark:text-white/85 font-medium dmsans">
            {row.label === "Status" ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 dark:border-emerald-600/10 bg-emerald-50 dark:bg-emerald-700/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                Active
              </span>
            ) : row.monospace ? (
              <span className="font-mono text-xs font-semibold tracking-wider bg-slate-100 dark:bg-[#38bdf8]/5 border border-slate-200 dark:border-[#38bdf8]/10 rounded px-2 py-0.5 text-slate-900 dark:text-white/85">
                {row.value}
              </span>
            ) : (
              row.value
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    if (result.status === "authentic") {
      const rows: ResultRow[] = [
        { label: "Document ID", value: result.documentId, monospace: true },
        { label: "Title", value: result.title },
        { label: "Department", value: result.department },
        { label: "Recipient / Entity", value: result.recipient },
        { label: "Issue Date", value: result.issueDate },
        { label: "Expiry Date", value: result.expiryDate || "N/A" },
        { label: "Status", value: "Active" },
      ];

      return (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-[#38bdf8]/10 bg-gradient-to-br from-[#0f172a] to-[#020617] p-6 text-white shadow-[0_40px_80px_rgba(0,0,0,0.8)] backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#38bdf8] shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="playfair text-xl sm:text-2xl font-bold text-white">Document Authentic</h3>
                  <p className="mt-1 text-xs text-white/60 dmsans font-light">
                    This document is verified and officially registered in the GDA-DVS registry.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-center rounded-full bg-gradient-to-r from-[#1e40af] to-[#38bdf8] px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-[0_6px_20px_rgba(30,64,175,0.2)] dmsans">
                Verified System Lock
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#38bdf8]/10 bg-[#0f172a]/95 p-4 shadow-[0_40px_80px_rgba(0,0,0,0.4)]">
            {renderRows(rows)}

            <button
              type="button"
              onClick={resetVerification}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e40af] to-[#1e3a8a] px-5 py-4 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] shadow-[0_10px_30px_rgba(30,64,175,0.2)] playfair"
            >
              Verify Another Document
            </button>
          </div>
        </div>
      );
    }

    // Invalid Status
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-[#7F1D1D] to-[#450A0A] p-6 text-white shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-red-400">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="playfair text-xl sm:text-2xl font-bold text-white">Record Not Found</h3>
                <p className="mt-1 text-xs text-white/60 dmsans font-light">
                  No match was found in the official verification system.
                </p>
              </div>
            </div>
            <span className="self-start sm:self-center rounded-full bg-red-650 px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-md dmsans">
              Invalid Entry
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/10 bg-red-50 dark:bg-red-500/5 p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-500" />
            <p className="text-sm leading-relaxed dmsans font-light text-red-900 dark:text-red-200">
              We could not find any active registry records corresponding to the submitted Document ID. Please double check characters or spacing formats.
            </p>
          </div>

          <div className="rounded-xl border border-red-500/10 bg-red-100 dark:bg-red-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-xs leading-relaxed dmsans font-light text-red-900 dark:text-red-300">
                Warning: If this document has been presented to you as a certified original GDA certificate or land deed, it might be fabricated. Report suspicious documents to legal authorities immediately.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetVerification}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-white/10 px-5 py-4 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 shadow-md playfair"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full z-25">
      <div className="relative mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 z-10">
        <section className="rounded-3xl border border-[#38bdf8]/10 bg-[#0f172a]/40 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          {result ? (
            renderResult()
          ) : (
            <div className="space-y-6">
              {/* Mode selection tabs */}
              <div className="flex flex-col sm:flex-row rounded-2xl border border-[#38bdf8]/10 bg-white/5 p-1.5 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => { setMode("manual"); stopCamera(); }}
                  className={`group relative flex-1 flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${mode === "manual"
                      ? "bg-[#38bdf8]/10 text-[#38bdf8] shadow-sm"
                      : "text-white/40 hover:text-white"
                    } ${"mb-3 sm:mb-0"}`}
                >
                  <Keyboard
                    className={`h-4.5 w-4.5 transition-colors duration-300 ${mode === "manual" ? "text-[#38bdf8]" : "text-white/20 group-hover:text-[#38bdf8]"
                      }`}
                  />
                  <span>Manual Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("scan"); startCamera(); }}
                  className={`group relative flex-1 flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${mode === "scan"
                      ? "bg-[#38bdf8]/10 text-[#38bdf8] shadow-sm"
                      : "text-white/40 hover:text-white"
                    }`}
                >
                  <Camera
                    className={`h-4.5 w-4.5 transition-colors duration-300 ${mode === "scan" ? "text-[#38bdf8]" : "text-white/20 group-hover:text-[#38bdf8]"
                      }`}
                  />
                  <span>Scan Barcode</span>
                </button>
              </div>

              {/* MANUAL ENTRY MODE */}
              {mode === "manual" ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1 dmsans">
                      Document ID
                    </label>
                    <div className="relative focus-within:shadow-[0_0_30px_rgba(56,189,248,0.05)] rounded-xl transition-all duration-300">
                      <Keyboard className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-white/20" />
                      <input
                        value={documentId}
                        onChange={(event) => setDocumentId(event.target.value)}
                        placeholder="e.g. GDA-REV-2026-X8A2"
                        className="w-full rounded-xl border border-white/5 bg-white/2 px-5 py-4 pl-12 text-sm text-white placeholder:text-white/20 outline-none transition-all duration-300 focus:border-[#38bdf8]/30 focus:bg-white/5"
                      />
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-[#38bdf8]/10 bg-[#38bdf8]/5 px-4 py-3 text-xs text-white/60 dmsans font-light">
                    <Info className="h-4.5 w-4.5 text-[#38bdf8] shrink-0" />
                    <span className="font-medium">Format requirement: GDA-[DEPT]-[YEAR]-[ID]</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualVerify}
                    disabled={isChecking || !documentId.trim()}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e40af] to-[#38bdf8] px-6 py-4 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed playfair shadow-[0_10px_30px_rgba(30,64,175,0.2)]"
                  >
                    {isChecking ? (
                      <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-r-white" />
                    ) : (
                      <SearchCheck className="h-4.5 w-4.5" />
                    )}
                    <span>{isChecking ? "Accessing Registry..." : "Verify Credentials"}</span>
                  </button>
                </div>
              ) : (
                /* SCANNING CAMERA MODE */
                <div className="space-y-5">
                  {!scanning ? (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-transparent hover:bg-[rgba(255,255,255,0.02)] px-6 py-4 text-sm font-semibold text-white/80 transition-all duration-300 hover:scale-[1.01] shadow-sm playfair"
                    >
                      <Camera className="h-4.5 w-4.5" />
                      <span>Initialize Camera Scanner</span>
                    </button>
                  ) : null}

                  <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.35)] shadow-inner">
                    <div className="relative aspect-[4/3] w-full">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className={`h-full w-full object-cover transition-opacity duration-300 ${scanning ? "opacity-100" : "opacity-0"
                          }`}
                      />
                      {!scanning && (
                        <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center space-y-2">
                          <Camera className="h-10 w-10 text-white/10" />
                          <p className="text-xs text-white/40 dmsans font-light">Camera feed standby</p>
                        </div>
                      )}

                      {/* Scanner bounds overlays */}
                      <span className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-[rgba(14,165,233,0.7)]" />
                      <span className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-[rgba(14,165,233,0.7)]" />
                      <span className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-[rgba(14,165,233,0.7)]" />
                      <span className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-[rgba(14,165,233,0.7)]" />

                      {scanning && (
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                          <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--color-accent)] shadow-[0_0_30px_rgba(14,165,233,1)] animation-scan" />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-center text-xs text-gray-500 dmsans font-light">
                    Center the Code128 barcode or QR code badge within the camera brackets.
                  </p>

                  {scanning && (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-600 bg-transparent hover:bg-[rgba(255,0,0,0.04)] px-6 py-4 text-sm font-semibold text-red-400 transition-all duration-300 hover:scale-[1.01] dmsans"
                    >
                      <span>Terminate Scanner</span>
                    </button>
                  )}

                  {cameraError && (
                    <div className="rounded-xl border border-orange-800 bg-[rgba(255,120,40,0.06)] p-4">
                      <div className="flex items-start gap-3 text-orange-200">
                        <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-orange-400" />
                        <p className="text-xs leading-relaxed dmsans font-light text-orange-200">{cameraError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function VerifyDocumentPage({ showFooter = true }: { showFooter?: boolean }) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) return; // public visitor stays on public verify

        const res = await fetch(`/api/access/context?userId=${user.id}`);
        const ctx = await res.json().catch(() => null);
        if (ctx?.found) {
          if (ctx.isAdmin) return router.replace("/admin/verify");
          if (ctx.canGenerate) return router.replace("/home/verify");
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [router, supabase]);
  return (
    <>
      <div className="min-h-screen bg-[#020617] pb-24 relative overflow-hidden">
        {/* Custom animations */}
        <style jsx global>{`
          .animation-scan {
            animation: scanner-sweep 2.8s infinite ease-in-out;
          }
          @keyframes scanner-sweep {
            0% { top: 0%; opacity: 0.1; }
            50% { top: 100%; opacity: 1; }
            100% { top: 0%; opacity: 0.1; }
          }
          .perspective-1000 {
            perspective: 1000px;
          }
          .preserve-3d {
            transform-style: preserve-3d;
          }
          .backface-hidden {
            backface-visibility: hidden;
          }
        `}</style>

        {/* PAGE HEADER SECTION */}
        <section className="bg-[#020617] pt-12 sm:pt-14 md:pt-16 pb-16 sm:pb-20 relative overflow-hidden">
          {/* Glowing background paths */}
          <BackgroundPaths mode="background" className="opacity-70" />

          {/* Radial overlays */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.05)_0%,transparent_75%)] z-5" />

          {/* Blue top radial */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(56,189,248,0.05),transparent)]" />

          {/* Noise grain overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '256px',
            }}
          />

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none bg-gradient-to-t from-[#020617] to-transparent z-10" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">

              {/* Left Column: Heading and info */}
              <div className="md:col-span-7 text-left space-y-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#38bdf8]/30 bg-[#38bdf8]/5 shadow-[0_0_30px_rgba(56,189,248,0.12)]"
                >
                  <Lock className="h-6 w-6 text-[#38bdf8]" />
                  <span className="absolute inset-0 rounded-2xl border border-[#38bdf8]/30 animate-ping opacity-30" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="playfair text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.08] tracking-tight text-glow-white"
                >
                  <span>Verify Document</span>
                  <span className="block text-gradient-blue">Authenticity</span>
                </motion.h1>

                <p className="hidden md:block max-w-2xl text-sm sm:text-base leading-[1.85] text-white/55 dmsans font-light">
                  Authenticate government records, land titles, and GDA certificate stamps in real-time. Enter the printed Document ID below or initialize your camera scanner to instantly query the ledger.
                </p>
                <p className="md:hidden max-w-full text-sm leading-[1.85] text-white/70 dmsans font-light">
                  Enter Document ID or open your camera to scan the code.
                </p>

                {/* Quick Trust badges - hide on mobile for a cleaner experience */}
                <div className="hidden sm:flex flex-wrap gap-2 pt-2">
                  {[
                    [Lock, "Tamper-Proof Verification"],
                    [Database, "GDA Central Registry"],
                    [ShieldCheck, "Official GDA Seal"],
                  ].map(([Icon, label], idx) => {
                    const LucideIcon = Icon as React.ComponentType<{ className?: string }>;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-4 py-2 text-[10px] text-white/45 dmsans tracking-wide"
                      >
                        <LucideIcon className="h-3.5 w-3.5 text-[#38bdf8]" />
                        <span>{label as string}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: 3D Holographic Credential Badge */}
              <div className="md:col-span-5 flex justify-center md:justify-end">
                <div className="perspective-1000 w-[300px] h-[300px] relative hidden md:block select-none">
                  <motion.div
                    className="w-full h-full preserve-3d"
                    animate={{
                      rotateY: [-10, 10, -10],
                      rotateX: [6, -6, 6],
                      y: [-6, 6, -6]
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {/* Glassmorphic Holo Badge */}
                    <div className="absolute inset-0 rounded-3xl border border-[#38bdf8]/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden">
                      {/* Inner ambient glow */}
                      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_60%)] pointer-events-none" />
                      {/* Holographic glowing lines in bg */}
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(56,189,248,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-[pulse_4s_infinite]" />

                      {/* Top bar */}
                      <div className="flex items-start justify-between relative z-10">
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-[#38bdf8] dmsans">
                            GDA Registry
                          </span>
                          <h4 className="text-xs font-bold text-white tracking-wider dmsans uppercase">
                            Secure Seal DVS
                          </h4>
                        </div>
                        {/* Official GDA mark (clean, no border/background) */}
                        <div className="h-9 w-9 flex items-center justify-center">
                          <Image
                            src="/gda_logo.png"
                            alt="GDA Logo"
                            width={36}
                            height={36}
                            className="h-9 w-9 object-contain"
                            priority
                          />
                        </div>
                      </div>

                      {/* Middle barcode representation */}
                      <div className="space-y-3 relative z-10">
                        <div className="h-6 w-full flex items-center justify-between opacity-60">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <span
                              key={i}
                              className="rounded-sm"
                              style={{
                                background: 'rgba(56,189,248,0.8)',
                                width: i % 3 === 0 ? "2px" : i % 5 === 0 ? "4px" : "1px",
                                height: i % 2 === 0 ? "100%" : "70%",
                                display: 'inline-block',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-[7px] text-white/50 font-mono tracking-widest uppercase">
                          <span>Verified Certificate</span>
                          <span>ID: 8A2-DVS</span>
                        </div>
                      </div>

                      {/* Bottom lock layer */}
                      <div className="flex items-center justify-between relative z-10 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          <span className="text-[9px] font-medium tracking-wider text-emerald-400 dmsans uppercase">
                            Registry Active
                          </span>
                        </div>
                        <Lock size={12} className="text-white/40" />
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* MAIN LOOKUP CARD (Suspense wrapper to protect useSearchParams) */}
        <Suspense
          fallback={
            <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 relative z-25">
              <div className="rounded-3xl border border-[#38bdf8]/10 bg-[#0f172a]/95 p-12 text-center shadow-[0_30px_60px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center space-y-3 backdrop-blur-sm">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#38bdf8] border-r-transparent" />
                <p className="text-xs text-white/60 dmsans font-light">Preparing verification dashboard...</p>
              </div>
            </div>
          }
        >
          <VerifyContent />
        </Suspense>

      </div>
      {showFooter && <Footer />}
    </>
  );
}
