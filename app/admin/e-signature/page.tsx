"use client";

import {
  Download,
  FilePlus2,
  ScanSearch,
  ShieldCheck,
  UploadCloud,
  AlertCircle,
  Layers,
  ChevronRight,
  CheckCircle2,
  Save,
} from "lucide-react";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PDFDocument } from "pdf-lib";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import type { PointerEvent as ReactPointerEvent } from "react";
import { SignatureModal } from "./signature-modal";

type SignatureStamp = {
  id: string;
  file: File;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  canvasWidth: number;
  canvasHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function AdminESignaturePage() {
  return (
    <Suspense fallback={<LoadingState title="Loading" subtitle="Fetching E-Signature Workspace..." />}>
      <ESignatureContent />
    </Suspense>
  );
}

function ESignatureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();

  const [authChecking, setAuthChecking] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [linkedDocumentId, setLinkedDocumentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [generatedPdfBytes, setGeneratedPdfBytes] = useState<ArrayBuffer | null>(null);
  const [downloadName, setDownloadName] = useState("signed-document.pdf");
  const [signedDownloadUrl, setSignedDownloadUrl] = useState<string | null>(null);

  const [signatures, setSignatures] = useState<SignatureStamp[]>([]);
  const [activeSigId, setActiveSigId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<SignatureStamp | null>(null);
  const [signatureDragOffset, setSignatureDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [isResizingSignature, setIsResizingSignature] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectedPage, setSelectedPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfStageSize, setPdfStageSize] = useState({ width: 0, height: 0 });
  const [previewReady, setPreviewReady] = useState(false);
  const [isApplyingSignature, setIsApplyingSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) { router.replace("/signin"); return; }
        setAdminUserId(user.id);

        const response = await fetch(`/api/access/context?userId=${user.id}`);
        const context = await response.json().catch(() => null);
        if (!context?.isAdmin) { router.replace(context?.canGenerate ? "/generate" : "/pending"); return; }

        // Auto-load document from query param
        const docId = searchParams.get("documentId");
        const explicitStoragePath = searchParams.get("storagePath");

        if (docId) {
          setLinkedDocumentId(docId);
          setAutoLoading(true);
          try {
            if (explicitStoragePath) {
              const pvRes = await fetch(`/api/admin/vault/preview?userId=${user.id}&path=${encodeURIComponent(explicitStoragePath)}`);
              const pvData = await pvRes.json();
              if (pvData.url) {
                const pdfRes = await fetch(pvData.url);
                if (pdfRes.ok) {
                  const blob = await pdfRes.blob();
                  const file = new File([blob], `${docId}.pdf`, { type: "application/pdf" });
                  await handlePdfSelect(file);
                }
              }
            } else {
              // Get storage path from pending list
              const pendingRes = await fetch(`/api/admin/pending-documents?userId=${user.id}`);
              const pendingBody = await pendingRes.json();
              const targetDoc = (pendingBody.pending || []).find((d: any) => d.id === docId);
              if (targetDoc?.fileUrl) {
                const pdfRes = await fetch(targetDoc.fileUrl);
                if (pdfRes.ok) {
                  const blob = await pdfRes.blob();
                  const file = new File([blob], targetDoc.processed_file_name || `${docId}.pdf`, { type: "application/pdf" });
                  await handlePdfSelect(file);
                }
              } else if (targetDoc?.storage_path) {
                const pvRes = await fetch(`/api/admin/vault/preview?userId=${user.id}&path=${encodeURIComponent(targetDoc.storage_path)}`);
                const pvData = await pvRes.json();
                if (pvData.url) {
                  const pdfRes = await fetch(pvData.url);
                  if (pdfRes.ok) {
                    const blob = await pdfRes.blob();
                    const file = new File([blob], targetDoc.processed_file_name || `${docId}.pdf`, { type: "application/pdf" });
                    await handlePdfSelect(file);
                  }
                }
              }
            }
          } catch (e) { console.error("Auto-load failed:", e); }
          setAutoLoading(false);
        }
      } catch { router.replace("/signin"); return; }
      finally { setAuthChecking(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase, searchParams]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      if (signedDownloadUrl) URL.revokeObjectURL(signedDownloadUrl);
      // Only revoke signatures on unmount, not on every state change
      signatures.forEach(s => URL.revokeObjectURL(s.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount/unmount

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Delete / Backspace to remove active signature
      if ((e.key === "Delete" || e.key === "Backspace") && activeSigId) {
        setSignatures(prev => prev.filter(s => s.id !== activeSigId));
        setActiveSigId(null);
      }

      // Ctrl + C to copy
      if (e.ctrlKey && e.key === "c" && activeSigId) {
        const sig = signatures.find(s => s.id === activeSigId);
        if (sig) setClipboard({ ...sig });
      }

      // Ctrl + V to paste
      if (e.ctrlKey && e.key === "v" && clipboard) {
        const newId = Math.random().toString(36).substr(2, 9);
        const newSig: SignatureStamp = {
          ...clipboard,
          id: newId,
          x: clamp(clipboard.x + 20, 0, Math.max(0, pdfStageSize.width - clipboard.width)),
          y: clamp(clipboard.y + 20, 0, Math.max(0, pdfStageSize.height - clipboard.height)),
          page: selectedPage,
          canvasWidth: pdfStageSize.width,
          canvasHeight: pdfStageSize.height,
        };
        setSignatures(prev => [...prev, newSig]);
        setActiveSigId(newId);
        // Update clipboard to the new position so multiple pastes stagger
        setClipboard(newSig);
      }

      // Arrow keys for nudging
      if (activeSigId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const nudge = e.shiftKey ? 10 : 1;
        setSignatures(prev => prev.map(s => {
          if (s.id !== activeSigId) return s;
          return {
            ...s,
            x: clamp(s.x + (e.key === "ArrowLeft" ? -nudge : e.key === "ArrowRight" ? nudge : 0), 0, Math.max(0, pdfStageSize.width - s.width)),
            y: clamp(s.y + (e.key === "ArrowUp" ? -nudge : e.key === "ArrowDown" ? nudge : 0), 0, Math.max(0, pdfStageSize.height - s.height)),
          };
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSigId, signatures, clipboard, selectedPage, pdfStageSize]);

  useEffect(() => {
    if (!generatedPdfBytes || !previewCanvasRef.current || !previewStageRef.current) return;

    let mounted = true;
    setPreviewReady(false);
    setPdfPreviewError(null);

    const renderPreview = async () => {
      const bytes = new Uint8Array(generatedPdfBytes.slice(0));
      let pdf: any = null;

      try {
        // @ts-ignore - dynamic import without types
        const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
        const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      } catch (pdfErr: any) {
        console.error("PDF.js loading error:", pdfErr);
        setPdfPreviewError("Preview fallback active. You can still apply signature and save.");
        return;
      }

      setNumPages(pdf.numPages || 0);
      const pageNumber = clamp(selectedPage, 1, pdf.numPages || 1);
      const page = await pdf.getPage(pageNumber);
      if (!mounted || !previewCanvasRef.current || !previewStageRef.current) return;

      const stageWidth = Math.max(420, previewStageRef.current.clientWidth);
      const viewport = page.getViewport({ scale: 1 });
      const scale = stageWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = previewCanvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
      canvas.style.height = `${Math.floor(scaledViewport.height)}px`;

      await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

      if (!mounted) return;
      setPreviewReady(true);
      setPdfStageSize({ width: canvas.width, height: canvas.height });
      setSignatures(prev => prev.map(s => {
        // Maintain relative position if canvas size changed
        const xRatio = s.x / s.canvasWidth;
        const yRatio = s.y / s.canvasHeight;
        const wRatio = s.width / s.canvasWidth;
        const hRatio = s.height / s.canvasHeight;

        const newW = wRatio * canvas.width;
        const newH = hRatio * canvas.height;
        const newX = xRatio * canvas.width;
        const newY = yRatio * canvas.height;

        return {
          ...s,
          width: newW,
          height: newH,
          x: clamp(newX, 0, Math.max(0, canvas.width - newW)),
          y: clamp(newY, 0, Math.max(0, canvas.height - newH)),
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        };
      }));
    };

    renderPreview().catch((err) => {
      console.error("PDF preview render failed:", err);
      setPreviewReady(false);
      setPdfPreviewError("Preview fallback active. You can still download the signed PDF.");
    });

    return () => {
      mounted = false;
    };
  }, [generatedPdfBytes, selectedPage]);

  const handlePdfSelect = async (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF file.");
      return;
    }

    setErrorMessage(null);
    setSelectedPdfFile(file);
    setSelectedPage(1);
    setPdfPreviewError(null);
    setPreviewReady(false);

    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const nextUrl = URL.createObjectURL(file);
    setPdfUrl(nextUrl);

    const bytes = await file.arrayBuffer();
    setGeneratedPdfBytes(bytes);
    if (signedDownloadUrl) {
      URL.revokeObjectURL(signedDownloadUrl);
      setSignedDownloadUrl(null);
    }
    setDownloadName(file.name.toLowerCase().endsWith(".pdf") ? file.name : `${file.name}.pdf`);
  };

  const handleSignatureSelect = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Signature must be a PNG or JPG image.");
      return;
    }

    setErrorMessage(null);
    const nextUrl = URL.createObjectURL(file);

    const image = new Image();
    image.onload = () => {
      const ratio = image.width / image.height;
      const width = 180;
      const height = Math.max(48, Math.round(width / (ratio || 2.5)));

      const newSig: SignatureStamp = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        url: nextUrl,
        x: 80,
        y: 80,
        width,
        height,
        page: selectedPage,
        canvasWidth: pdfStageSize.width || 800,
        canvasHeight: pdfStageSize.height || 1100,
      };

      setSignatures(prev => [...prev, newSig]);
      setActiveSigId(newSig.id);
    };
    image.src = nextUrl;
  };

  const duplicateSignature = (id: string) => {
    const sig = signatures.find(s => s.id === id);
    if (!sig) return;
    const newSig: SignatureStamp = {
      ...sig,
      id: Math.random().toString(36).substr(2, 9),
      x: sig.x + 20,
      y: sig.y + 20,
      page: selectedPage,
      canvasWidth: pdfStageSize.width,
      canvasHeight: pdfStageSize.height,
    };
    setSignatures(prev => [...prev, newSig]);
    setActiveSigId(newSig.id);
  };

  const handleSignaturePointerDown = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (!previewStageRef.current) return;
    const sig = signatures.find(s => s.id === id);
    if (!sig) return;

    setActiveSigId(id);
    const stage = previewStageRef.current.getBoundingClientRect();

    // Check if clicking the resize handle (bottom-right)
    const target = e.target as HTMLElement;
    if (target.dataset.resizeHandle) {
      setIsResizingSignature(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: sig.width,
        height: sig.height
      });
    } else {
      setSignatureDragOffset({
        x: e.clientX - stage.left - sig.x,
        y: e.clientY - stage.top - sig.y,
      });
      setIsDraggingSignature(true);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewStageRef.current || !activeSigId) return;

    if (isResizingSignature) {
      const deltaX = e.clientX - resizeStart.x;
      const sig = signatures.find(s => s.id === activeSigId);
      if (!sig) return;

      const ratio = sig.height / sig.width;
      const nextWidth = clamp(resizeStart.width + deltaX, 40, 500);
      const nextHeight = nextWidth * ratio;

      setSignatures(prev => prev.map(s => {
        if (s.id !== activeSigId) return s;
        return {
          ...s,
          width: nextWidth,
          height: nextHeight,
          x: clamp(s.x, 0, Math.max(0, pdfStageSize.width - nextWidth)),
          y: clamp(s.y, 0, Math.max(0, pdfStageSize.height - nextHeight)),
        };
      }));
      return;
    }

    if (!isDraggingSignature) return;

    const stage = previewStageRef.current.getBoundingClientRect();
    const nextX = e.clientX - stage.left - signatureDragOffset.x;
    const nextY = e.clientY - stage.top - signatureDragOffset.y;
    const maxWidth = pdfStageSize.width > 0 ? pdfStageSize.width : previewStageRef.current.clientWidth;
    const maxHeight = pdfStageSize.height > 0 ? pdfStageSize.height : previewStageRef.current.clientHeight;

    setSignatures(prev => prev.map(s => {
      if (s.id !== activeSigId) return s;
      return {
        ...s,
        x: clamp(nextX, 0, Math.max(0, maxWidth - s.width)),
        y: clamp(nextY, 0, Math.max(0, maxHeight - s.height)),
      };
    }));
  };

  const handleStagePointerUp = () => {
    setIsDraggingSignature(false);
    setIsResizingSignature(false);
  };

  const handleApplySignature = async () => {
    if (!generatedPdfBytes || signatures.length === 0) {
      setErrorMessage("Upload a PDF and place at least one signature first.");
      return;
    }

    setIsApplyingSignature(true);
    setErrorMessage(null);

    try {
      const pdfDoc = await PDFDocument.load(generatedPdfBytes.slice(0));

      for (const sig of signatures) {
        const pageIndex = clamp(sig.page - 1, 0, Math.max(0, pdfDoc.getPages().length - 1));
        const targetPage = pdfDoc.getPages()[pageIndex];
        if (!targetPage) continue;

        const sigBytes = await sig.file.arrayBuffer();
        const embeddedImage = sig.file.type.includes("png")
          ? await pdfDoc.embedPng(sigBytes)
          : await pdfDoc.embedJpg(sigBytes);

        const pageWidth = targetPage.getWidth();
        const pageHeight = targetPage.getHeight();
        const widthRatio = sig.width / sig.canvasWidth;
        const heightRatio = sig.height / sig.canvasHeight;
        const xRatio = sig.x / sig.canvasWidth;
        const yTopRatio = sig.y / sig.canvasHeight;

        const drawWidth = widthRatio * pageWidth;
        const drawHeight = heightRatio * pageHeight;
        const drawX = xRatio * pageWidth;
        const drawY = pageHeight - (yTopRatio * pageHeight) - drawHeight;

        targetPage.drawImage(embeddedImage, {
          x: clamp(drawX, 0, Math.max(0, pageWidth - drawWidth)),
          y: clamp(drawY, 0, Math.max(0, pageHeight - drawHeight)),
          width: drawWidth,
          height: drawHeight,
        });
      }

      const signedBytes = await pdfDoc.save();
      const signedArray = signedBytes instanceof Uint8Array ? signedBytes : new Uint8Array(signedBytes as any);
      const signedBuffer = signedArray.buffer.slice(
        signedArray.byteOffset,
        signedArray.byteOffset + signedArray.byteLength
      ) as ArrayBuffer;

      // Revoke old URL before setting new one
      if (signedDownloadUrl) {
        URL.revokeObjectURL(signedDownloadUrl);
      }

      const signedBlob = new Blob([signedBuffer], { type: "application/pdf" });
      const nextUrl = URL.createObjectURL(signedBlob);
      setSignedDownloadUrl(nextUrl);
      setDownloadName(selectedPdfFile ? `signed-${selectedPdfFile.name.replace(/\.pdf$/i, "")}.pdf` : "signed-document.pdf");
      setGeneratedPdfBytes(signedBuffer);
      setPreviewReady(false);
      resetSignature();
      setSuccessMessage("Signatures burned successfully. You can now export the PDF.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to apply signatures.");
    } finally {
      setIsApplyingSignature(false);
    }
  };

  const resetSignature = () => {
    setSignatures([]);
    setActiveSigId(null);
    setIsDraggingSignature(false);
    setErrorMessage(null);
  };

  const clearPdf = () => {
    setSelectedPdfFile(null);
    setGeneratedPdfBytes(null);
    setSelectedPage(1);
    setNumPages(0);
    setPreviewReady(false);
    setPdfPreviewError(null);
    setSignedDownloadUrl(null);
    setDownloadName("signed-document.pdf");
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    resetSignature();
  };

  const handleDownload = () => {
    const url = signedDownloadUrl || pdfUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveAndSign = async () => {
    if (!generatedPdfBytes || !adminUserId || !linkedDocumentId) {
      setErrorMessage("Apply your signature to the document first.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const blob = new Blob([generatedPdfBytes], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("adminUserId", adminUserId);
      formData.append("documentId", linkedDocumentId);
      formData.append("signedPdf", blob, downloadName);

      const res = await fetch("/api/admin/e-signature", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSuccessMessage("Document signed and verified successfully! Redirecting to the vault...");
      setTimeout(() => setSuccessMessage(null), 4000);
      router.replace("/admin/vault");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save signed document.");
    } finally {
      setIsSaving(false);
    }
  };

  if (authChecking) {
    return <LoadingState title="Secure Terminal" subtitle="Authenticating signing workspace..." />;
  }

  return (
    <div className="relative min-h-screen w-full bg-[#020617] flex flex-col overflow-hidden">
      {/* ═══ Background Layer ═══ */}
      <BackgroundPaths mode="background" className="opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/60 to-[#020617] pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col mx-auto w-full max-w-[1800px] px-4 sm:px-6 py-6 h-screen overflow-hidden">

        {/* ═══ Header Section ═══ */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6 shrink-0">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#38bdf8]/10 border border-[#38bdf8]/20">
                <ShieldCheck className="h-3.5 w-3.5 text-[#38bdf8]" />
              </div>
              <span className="dmsans text-[8px] font-black uppercase tracking-[0.4em] text-[#38bdf8]/80"></span>
            </div>
            <h1 className="playfair text-2xl font-bold text-white sm:text-3xl">
              Digital <span className="professional-gradient-text">E-Signature</span>
            </h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-white/[0.05] bg-[#0f172a]/40 backdrop-blur-md">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/20">
                <ScanSearch className="h-3.5 w-3.5 text-[#38bdf8]" />
              </div>
              <div className="flex flex-col">
                <p className="dmsans text-[7px] font-bold uppercase tracking-widest text-white/30 leading-none mb-1">Document Status</p>
                <p className="dmsans text-[10px] font-black text-white leading-none">
                  {numPages ? `${numPages} Pages Loaded` : "Awaiting "}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══ Studio Layout ═══ */}
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden">

          {/* ════ Sidebar (4/12) ════ */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-2 pb-6"
          >
            {/* 1. DOCUMENT REGISTRY */}
            <div className="flex flex-col rounded-[1.5rem] border border-white/[0.08] bg-[#0f172a]/80 backdrop-blur-2xl shadow-xl overflow-hidden shrink-0">
              <div className="p-5 border-b border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#38bdf8]/10">
                    <UploadCloud className="h-3.5 w-3.5 text-[#38bdf8]" />
                  </div>
                  <h3 className="dmsans text-[10px] font-black text-white uppercase tracking-widest">Document Registry</h3>
                </div>
              </div>
              <div className="p-5">
                <label
                  htmlFor="pdf-upload"
                  className="group relative flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed border-white/5 bg-[#020617]/40 hover:bg-[#020617]/60 hover:border-[#38bdf8]/30 transition-all cursor-pointer overflow-hidden"
                >
                  <FilePlus2 className="h-6 w-6 text-white/10 group-hover:text-[#38bdf8]/50 transition-colors" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="dmsans text-[9px] font-black text-white/40 uppercase tracking-widest group-hover:text-[#38bdf8]/70 transition-colors">
                      {selectedPdfFile ? "Update Document" : "Import PDF"}
                    </span>
                    <span className="dmsans text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] text-center px-4 truncate max-w-[200px]">
                      {selectedPdfFile ? selectedPdfFile.name : "BARCODED PDF"}
                    </span>
                  </div>
                  <input id="pdf-upload" type="file" className="hidden" accept="application/pdf" onChange={(e) => handlePdfSelect(e.target.files?.[0] || null)} />
                </label>
                {selectedPdfFile && (
                  <button onClick={clearPdf} className="w-full mt-3 py-2 dmsans text-[8px] font-black text-white/20 hover:text-red-400/60 uppercase tracking-widest transition-colors">
                    Terminate Active Session
                  </button>
                )}
              </div>
            </div>

            {/* 2. STAMP ELEMENTS */}
            <div className="flex flex-col rounded-[1.5rem] border border-white/[0.08] bg-[#0f172a]/80 backdrop-blur-2xl shadow-xl overflow-hidden shrink-0">
              <div className="p-5 border-b border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#38bdf8]/10">
                    <Layers className="h-3.5 w-3.5 text-[#38bdf8]" />
                  </div>
                  <h3 className="dmsans text-[10px] font-black text-white uppercase tracking-widest">Stamp Elements</h3>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <button
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#020617]/40 hover:bg-[#020617]/60 hover:border-[#38bdf8]/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 group-hover:border-[#38bdf8]/40 transition-colors">
                      <FilePlus2 className="h-4 w-4 text-white/20 group-hover:text-[#38bdf8]" />
                    </div>
                    <span className="dmsans text-[10px] font-black text-white/50 uppercase tracking-widest group-hover:text-white/80 transition-colors">Add Signature</span>
                  </div>
                  <div className="h-5 w-5 rounded-full border border-white/10 flex items-center justify-center text-[10px] text-white/20 group-hover:border-[#38bdf8]/40 group-hover:text-[#38bdf8] transition-all">+</div>
                </button>

                <AnimatePresence mode="wait">
                  {activeSigId && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-xl bg-[#020617]/80 border border-[#38bdf8]/30 shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] animate-pulse" />
                          <span className="dmsans text-[8px] font-black text-white/90 uppercase tracking-[0.2em]">Active Stamp</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => duplicateSignature(activeSigId)} className="p-2 rounded-lg bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8] hover:text-white transition-all border border-[#38bdf8]/10">
                            <Layers className="h-3 w-3" />
                          </button>
                          <button onClick={() => { setSignatures(prev => prev.filter(s => s.id !== activeSigId)); setActiveSigId(null); }} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/10">
                            <span className="text-[10px] font-bold">✕</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                          <label className="dmsans text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Scale Precision</label>
                          <span className="dmsans text-[10px] font-black text-[#38bdf8]">{Math.round(signatures.find(s => s.id === activeSigId)?.width || 180)}px</span>
                        </div>
                        <input
                          type="range" min={40} max={600} value={signatures.find(s => s.id === activeSigId)?.width || 180}
                          onChange={(e) => {
                            const nextWidth = Number(e.target.value);
                            setSignatures(prev => prev.map(s => {
                              if (s.id !== activeSigId) return s;
                              const ratio = s.height / s.width;
                              return { ...s, width: nextWidth, height: nextWidth * ratio };
                            }));
                          }}
                          className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 3. NAVIGATION & ACTIONS */}
            <div className="flex flex-col rounded-[1.5rem] border border-white/[0.08] bg-[#0f172a]/80 backdrop-blur-2xl shadow-xl overflow-hidden shrink-0">
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#38bdf8]/10">
                      <ScanSearch className="h-3.5 w-3.5 text-[#38bdf8]" />
                    </div>
                    <span className="dmsans text-[10px] font-black text-white/60 uppercase tracking-widest">Pages</span>
                  </div>
                  <span className="dmsans text-[10px] font-black text-[#38bdf8] bg-[#38bdf8]/10 px-2.5 py-1 rounded-full border border-[#38bdf8]/20">
                    <span className="whitespace-nowrap">
                      {selectedPage} / {numPages || 1}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedPage(p => Math.max(1, p - 1))} disabled={selectedPage <= 1} className="flex-1 h-10 flex items-center justify-center rounded-xl border border-white/5 bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-20 transition-all">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  <button onClick={() => setSelectedPage(p => Math.min(numPages || p + 1, p + 1))} disabled={selectedPage >= (numPages || 1)} className="flex-1 h-10 flex items-center justify-center rounded-xl border border-white/5 bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-20 transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="pt-4 border-t border-white/[0.05] space-y-3">
                  <button
                    onClick={handleApplySignature}
                    disabled={signatures.length === 0 || isApplyingSignature}
                    className="w-full h-12 rounded-xl bg-[#38bdf8] text-[#020617] dmsans text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all disabled:opacity-20 shadow-lg shadow-[#38bdf8]/10"
                  >
                    {isApplyingSignature ? "Embedding..." : `Confirm ${signatures.length} Stamp${signatures.length === 1 ? '' : 's'}`}
                  </button>
                  <button onClick={resetSignature} className="w-full py-1 dmsans text-[8px] font-black text-white/20 hover:text-white/60 uppercase tracking-widest transition-colors text-center">
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* 4. COMMAND CENTER */}
            <div className="rounded-[1.5rem] border border-white/[0.05] bg-[#0f172a]/40 backdrop-blur-xl p-5 shrink-0">
              <h4 className="dmsans text-[8px] font-black text-white/30 uppercase tracking-[0.3em] mb-4">Command Center</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[["Ctrl+C", "Copy"], ["Ctrl+V", "Paste"], ["Del", "Delete"], ["Arrows", "Nudge"]].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="dmsans text-[8px] font-bold text-white/40">{label}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[7px] font-mono text-white/60">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ════ Studio Workspace (8/12) ════ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-12 lg:col-span-8 xl:col-span-9 relative flex flex-col h-full z-10 min-w-0"
          >
            <div className="relative flex-1 rounded-[2rem] border border-white/[0.08] bg-[#0f172a]/60 backdrop-blur-3xl p-4 sm:p-8 overflow-y-auto custom-scrollbar shadow-[inset_0_0_100px_rgba(0,0,0,0.4)] flex flex-col items-center">

              {!selectedPdfFile ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm py-20">
                  <div className="h-20 w-20 rounded-[2rem] bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6 animate-float">
                    <FilePlus2 className="h-8 w-8 text-white/10" />
                  </div>
                  <h4 className="playfair text-xl font-bold text-white/60 mb-3">No Active Document</h4>
                  <p className="dmsans text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] leading-relaxed">
                    Import a BARCODED PDF document to initiate the digital signing.
                  </p>
                </div>
              ) : (
                <div
                  ref={previewStageRef}
                  onPointerMove={handleStagePointerMove}
                  onPointerUp={handleStagePointerUp}
                  onPointerCancel={handleStagePointerUp}
                  onClick={(e) => { if (e.target === e.currentTarget || e.target instanceof HTMLCanvasElement) setActiveSigId(null); }}
                  className={cn("relative mx-auto touch-none transition-all duration-700 mt-4", !previewReady ? "opacity-0 scale-95" : "opacity-100 scale-100")}
                  style={{ width: "100%", maxWidth: 920 }}
                >
                  <canvas ref={previewCanvasRef} className="mx-auto block w-full rounded-lg border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.6)]" />

                  {signatures.filter(s => s.page === selectedPage).map((sig) => (
                    <motion.div
                      key={sig.id} onPointerDown={(e) => handleSignaturePointerDown(e, sig.id)}
                      className={cn("absolute z-30 cursor-move select-none rounded-sm border p-0.5 transition-all", activeSigId === sig.id ? "border-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_25px_rgba(56,189,248,0.4)]" : "border-white/20 bg-white/5")}
                      style={{ left: sig.x, top: sig.y, width: sig.width, height: sig.height, touchAction: "none" }}
                    >
                      <img src={sig.url} alt="signature" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                      {activeSigId === sig.id && (
                        <>
                          <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-[#38bdf8] border border-white shadow-lg" />
                          <div data-resize-handle="true" className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full bg-white border-2 border-[#38bdf8] shadow-xl cursor-nwse-resize flex items-center justify-center group/h">
                            <div className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full group-hover/h:scale-125 transition-transform" />
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Bottom Finalization Bar */}
              {selectedPdfFile && (
                <div className="mt-8 w-full max-w-[1000px] border-t border-white/[0.05] pt-8 mb-4">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500/60" />
                        <span className="dmsans text-[9px] font-black text-white/40 uppercase tracking-widest">Protocol Verification</span>
                      </div>
                      <p className="dmsans text-[10px] font-black text-white/20 uppercase tracking-widest leading-relaxed">
                        {signedDownloadUrl ? "Document verified. Proceed to final export." : "Please confirm stamps to authorize document export."}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      {linkedDocumentId && (
                        <button
                          onClick={handleSaveAndSign} disabled={isSaving || !signedDownloadUrl}
                          className="flex items-center justify-center gap-3 px-8 h-14 rounded-xl bg-emerald-500 text-white dmsans text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all disabled:opacity-20 shadow-xl shadow-emerald-500/10"
                        >
                          {isSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="h-3.5 w-3.5" />}
                          {isSaving ? "Syncing..." : "Sync & Finalize"}
                        </button>
                      )}
                      <button
                        onClick={handleDownload} disabled={!signedDownloadUrl}
                        className={cn(
                          "flex items-center justify-center gap-3 px-8 h-14 rounded-xl dmsans text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl",
                          signedDownloadUrl
                            ? "bg-white text-[#020617] hover:bg-[#38bdf8] shadow-white/5"
                            : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
                        )}
                      >
                        <Download className="h-3.5 w-3.5" /> Export Signed PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Status Notifications */}
            <div className="absolute bottom-6 right-6 z-50 pointer-events-none">
              <AnimatePresence mode="popLayout">
                {successMessage && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-[#020617]/90 backdrop-blur-xl px-5 py-3 shadow-2xl">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="dmsans text-[9px] font-black text-emerald-400 uppercase tracking-widest">{successMessage}</p>
                  </motion.div>
                )}
                {errorMessage && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-[#020617]/90 backdrop-blur-xl px-5 py-3 shadow-2xl">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <p className="dmsans text-[9px] font-black text-red-400 uppercase tracking-widest">{errorMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
      <SignatureModal 
        isOpen={isSignatureModalOpen} 
        onClose={() => setIsSignatureModalOpen(false)} 
        onSelect={handleSignatureSelect} 
      />
    </div>
  );
}
