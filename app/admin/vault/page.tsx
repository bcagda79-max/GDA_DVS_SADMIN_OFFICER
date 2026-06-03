"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingState } from "@/components/ui/loading-state";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { cn } from "@/lib/utils";
import {
  Folder,
  FolderOpen,
  FileText,
  ArrowLeft,
  Eye,
  Clock,
  Database,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  ChevronRight,
  Layers,
  Hash,
  User2
} from "lucide-react";

export default function VaultPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) return router.replace("/signin");
        setUserId(user.id);

        const res = await fetch(`/api/admin/vault?userId=${user.id}`);
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to load repository.");
        }
        setDocuments(body.documents ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  const departments = useMemo(() => {
    const depMap = new Map<string, number>();
    documents.forEach(doc => {
      if (doc.department) {
        depMap.set(doc.department, (depMap.get(doc.department) || 0) + 1);
      }
    });
    return Array.from(depMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (!selectedDepartment) return [];

    let docs = documents.filter(d => d.department === selectedDepartment);

    const term = searchQuery.trim().toLowerCase();
    if (term) {
      docs = docs.filter(item =>
        [item.id, item.title, item.recipient_name, item.processed_file_name].some(field =>
          String(field ?? "").toLowerCase().includes(term)
        )
      );
    }

    return docs;
  }, [documents, selectedDepartment, searchQuery]);

  const handlePreview = async (doc: any) => {
    if (!doc.storage_path) {
      setPreviewError("No file associated with this record.");
      setTimeout(() => setPreviewError(null), 3000);
      return;
    }

    setPreviewingId(doc.id);
    try {
      const res = await fetch(`/api/admin/vault/preview?userId=${userId}&path=${encodeURIComponent(doc.storage_path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.open(data.url, "_blank");
    } catch (e: any) {
      setPreviewError("Preview generation failed.");
      setTimeout(() => setPreviewError(null), 3000);
    } finally {
      setPreviewingId(null);
    }
  };

  // Department color palette
  const deptColors = [
    { bg: "from-blue-600/20 to-blue-400/5", border: "border-blue-500/20", icon: "text-blue-400", glow: "group-hover:shadow-blue-500/10" },
    { bg: "from-violet-600/20 to-violet-400/5", border: "border-violet-500/20", icon: "text-violet-400", glow: "group-hover:shadow-violet-500/10" },
    { bg: "from-emerald-600/20 to-emerald-400/5", border: "border-emerald-500/20", icon: "text-emerald-400", glow: "group-hover:shadow-emerald-500/10" },
    { bg: "from-amber-600/20 to-amber-400/5", border: "border-amber-500/20", icon: "text-amber-400", glow: "group-hover:shadow-amber-500/10" },
    { bg: "from-rose-600/20 to-rose-400/5", border: "border-rose-500/20", icon: "text-rose-400", glow: "group-hover:shadow-rose-500/10" },
    { bg: "from-cyan-600/20 to-cyan-400/5", border: "border-cyan-500/20", icon: "text-cyan-400", glow: "group-hover:shadow-cyan-500/10" },
    { bg: "from-pink-600/20 to-pink-400/5", border: "border-pink-500/20", icon: "text-pink-400", glow: "group-hover:shadow-pink-500/10" },
    { bg: "from-teal-600/20 to-teal-400/5", border: "border-teal-500/20", icon: "text-teal-400", glow: "group-hover:shadow-teal-500/10" },
  ];

  if (loading) {
    return <LoadingState title="Loading" subtitle="Fetching Documents..." />;
  }

  return (
    <div className="relative min-h-screen w-full bg-[#020617] flex flex-col overflow-x-hidden">
      <BackgroundPaths mode="background" className="opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/60 to-[#020617] pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col mx-auto w-full max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 lg:px-8">

        {/* ═══ Error Notification ═══ */}
        <AnimatePresence>
          {previewError && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-2xl border border-red-500/20 bg-[#0f172a]/95 backdrop-blur-xl px-6 py-4 shadow-2xl shadow-red-500/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
              </div>
              <p className="dmsans text-sm font-bold text-red-400 uppercase tracking-widest">{previewError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!selectedDepartment ? (
            /* ═══════════════════ DEPARTMENT DIRECTORY ═══════════════════ */
            <motion.div
              key="folders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              {/* Page Header */}
              <div className="mb-12">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-3 mb-5"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/20 shadow-[0_0_15px_rgba(56,189,248,0.1)]">
                        <Layers className="h-4 w-4 text-[#38bdf8]" />
                      </div>
                      <span className="dmsans text-[10px] font-bold uppercase tracking-[0.4em] text-[#38bdf8]">Archival Registry</span>
                    </motion.div>
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="playfair text-4xl font-bold text-white sm:text-6xl leading-tight"
                    >
                      Central <span className="professional-gradient-text">Vault</span>
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="dmsans mt-5 max-w-xl text-sm leading-relaxed text-white/40"
                    >
                      A high-security document repository partitioned by department. Each folder contains cryptographically verified credentials and official correspondence.
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="group glass-card rounded-2xl p-5 border-white/[0.05] min-w-[160px]">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/15 group-hover:bg-[#38bdf8]/20 transition-all">
                          <Database className="h-5 w-5 text-[#38bdf8]" />
                        </div>
                        <div>
                          <p className="dmsans text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">Total Assets</p>
                          <p className="dmsans text-3xl font-bold text-white leading-none mt-1">{documents.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="group glass-card rounded-2xl p-5 border-white/[0.05] min-w-[160px]">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15 group-hover:bg-emerald-500/20 transition-all">
                          <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="dmsans text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">Active Units</p>
                          <p className="dmsans text-3xl font-bold text-white leading-none mt-1">{departments.length}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Department Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {departments.map(([dept, count], i) => {
                  const color = deptColors[i % deptColors.length];
                  return (
                    <motion.button
                      key={dept}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + (i * 0.05), duration: 0.5 }}
                      onClick={() => setSelectedDepartment(dept)}
                      className={cn(
                        "group relative flex flex-col text-left overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[#0f172a]/30 backdrop-blur-xl p-8 transition-all duration-500",
                        "hover:border-white/[0.15] hover:bg-[#0f172a]/50 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]",
                        color.glow
                      )}
                    >
                      {/* Animated Corner Accent */}
                      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <ChevronRight className="h-5 w-5 text-white/20 group-hover:translate-x-1 transition-transform" />
                      </div>

                      {/* Icon Section */}
                      <div className="relative mb-8">
                        <div className={cn(
                          "flex h-16 w-16 items-center justify-center rounded-[1.25rem] border transition-all duration-500 shadow-lg bg-gradient-to-br",
                          color.bg, color.border
                        )}>
                          <Folder className={cn("h-8 w-8 transition-all duration-300 group-hover:scale-110", color.icon)} />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-8 w-8 flex items-center justify-center rounded-lg bg-[#020617] border border-white/5 shadow-xl">
                          <span className="dmsans text-[10px] font-black text-white/60">{count}</span>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="mt-auto">
                        <h3 className="playfair text-xl font-bold text-white mb-2 group-hover:text-[#38bdf8] transition-colors line-clamp-1">{dept}</h3>
                        <div className="flex items-center gap-2">
                          <span className="dmsans text-[9px] font-bold uppercase tracking-[0.3em] text-white/20">Department Unit</span>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/[0.05] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-white/20" />
                            <span className="dmsans text-[10px] font-bold text-white/40">Files</span>
                          </div>
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Empty State */}
              {departments.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-32 text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative mb-8"
                  >
                    <div className="h-24 w-24 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex items-center justify-center backdrop-blur-sm">
                      <Folder className="h-12 w-12 text-white/10" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[#020617] border border-white/5 flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 text-white/20" />
                    </div>
                  </motion.div>
                  <h3 className="playfair text-2xl font-bold text-white/40 mb-3">No Data Segments Found</h3>
                  <p className="dmsans text-sm text-white/20 max-w-xs leading-relaxed">
                    The central repository is currently awaiting incoming authenticated documents.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            /* ═══════════════════ DOCUMENT LEDGER ═══════════════════ */
            <motion.div
              key="files"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              {/* Toolbar Section */}
              <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-6">
                  <motion.button
                    whileHover={{ x: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setSelectedDepartment(null); setSearchQuery(""); }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-[#38bdf8]/10 hover:text-[#38bdf8] hover:border-[#38bdf8]/30 transition-all duration-300 shadow-xl"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </motion.button>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-1 rounded-full bg-[#38bdf8]" />
                      <span className="dmsans text-[10px] font-bold uppercase tracking-[0.4em] text-[#38bdf8]/60">{selectedDepartment} Unit</span>
                    </div>
                    <h2 className="playfair text-3xl sm:text-4xl font-bold text-white">
                      Document <span className="professional-gradient-text">Ledger</span>
                    </h2>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20 transition-colors group-focus-within:text-[#38bdf8]" />
                    <input
                      type="text"
                      placeholder="Search archival records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#0f172a]/60 pl-12 pr-4 dmsans text-sm text-white placeholder:text-white/20 focus:border-[#38bdf8]/30 focus:bg-[#0f172a]/80 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex items-center gap-3 px-5 h-12 rounded-2xl border border-white/[0.06] bg-[#0f172a]/50 backdrop-blur-md">
                    <Hash className="h-4 w-4 text-[#38bdf8]/40" />
                    <span className="dmsans text-xs font-black text-white/50 uppercase tracking-widest">{filteredDocuments.length} Entries</span>
                  </div>
                </div>
              </div>

              {/* Ledger Container */}
              <div className="relative group flex-1">
                {/* Decorative border glow */}
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/0 via-white/[0.05] to-white/0 rounded-[2rem] pointer-events-none" />

                <div className="rounded-[2rem] border border-white/[0.08] bg-[#0f172a]/40 backdrop-blur-2xl overflow-hidden flex flex-col shadow-2xl">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                          <th className="px-8 py-6 dmsans text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <FileText className="h-3.5 w-3.5" /> Asset Description
                            </div>
                          </th>
                          <th className="px-6 py-6 dmsans text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <Hash className="h-3.5 w-3.5" /> Registry ID
                            </div>
                          </th>
                          <th className="px-6 py-6 dmsans text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <Clock className="h-3.5 w-3.5" /> Timestamp
                            </div>
                          </th>
                          <th className="px-6 py-6 dmsans text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">Status</th>
                          <th className="px-8 py-6 text-right dmsans text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filteredDocuments.length > 0 ? (
                          filteredDocuments.map((doc, idx) => (
                            <motion.tr
                              key={doc.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="group relative hover:bg-gradient-to-r hover:from-[#38bdf8]/[0.05] hover:to-transparent transition-all duration-300"
                            >
                              <td className="px-8 py-6 relative">
                                {/* Left accent line on hover */}
                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#38bdf8] scale-y-0 opacity-0 group-hover:scale-y-100 group-hover:opacity-100 transition-all duration-300 origin-center" />
                                <div className="flex items-center gap-5">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#020617] text-white/20 group-hover:bg-[#38bdf8]/10 group-hover:border-[#38bdf8]/20 group-hover:text-[#38bdf8] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.1)] transition-all duration-500">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="dmsans text-[14px] font-bold text-white group-hover:text-[#38bdf8] transition-colors truncate max-w-[320px]">
                                      {doc.title || "Standardized Document"}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <User2 className="h-3 w-3 text-white/20" />
                                      <p className="dmsans text-[11px] font-semibold text-white/30 truncate max-w-[280px]">
                                        {doc.recipient_name || doc.original_file_name || "Internal System File"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <span className="font-mono text-[10px] font-bold text-[#38bdf8]/60 bg-[#38bdf8]/5 px-3 py-1.5 rounded-lg border border-[#38bdf8]/10 shadow-inner whitespace-nowrap">
                                  {doc.id}
                                </span>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex flex-col">
                                  <span className="dmsans text-xs font-bold text-white/50 tracking-wide">
                                    {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                  <span className="dmsans text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">
                                    {new Date(doc.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                {doc.verified ? (
                                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-1.5 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                    <span className="dmsans text-[10px] font-black uppercase tracking-widest text-emerald-400">Verified</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                    <span className="dmsans text-[10px] font-black uppercase tracking-widest text-amber-400">In Review</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-8 py-6 text-right">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handlePreview(doc)}
                                  disabled={previewingId === doc.id}
                                  className={cn(
                                    "inline-flex h-11 items-center gap-3 rounded-xl border px-6 text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                                    "bg-[#0f172a]/80 text-white border-white/[0.1] hover:bg-[#38bdf8] hover:border-[#38bdf8] hover:text-[#020617] hover:shadow-[0_0_20px_rgba(56,189,248,0.4)]",
                                    "disabled:opacity-30 disabled:pointer-events-none"
                                  )}
                                >
                                  {previewingId === doc.id ? (
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                  {previewingId === doc.id ? "Decrypting" : "Access"}
                                </motion.button>
                              </td>
                            </motion.tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-8 py-32 text-center">
                              <div className="flex flex-col items-center gap-5">
                                <div className="h-20 w-20 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                  <Search className="h-8 w-8 text-white/5" />
                                </div>
                                <div>
                                  <p className="playfair text-xl font-bold text-white/30 mb-2">No Matching Records</p>
                                  <p className="dmsans text-xs text-white/10 max-w-[280px] mx-auto leading-relaxed uppercase tracking-widest font-bold">
                                    Adjust your search parameters or select a different department folder.
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Ledger Footer */}
                  {filteredDocuments.length > 0 && (
                    <div className="border-t border-white/[0.06] px-8 py-5 flex flex-col sm:flex-row items-center justify-between bg-white/[0.01] gap-4">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
                          <span className="dmsans text-[10px] font-black uppercase tracking-[0.2em] text-white/30"></span>
                        </div>
                        <div className="h-4 w-px bg-white/[0.1]" />
                        <span className="dmsans text-[10px] font-bold text-white/20 uppercase tracking-widest">

                        </span>
                      </div>
                      <span className="dmsans text-[10px] font-black text-[#38bdf8]/40 uppercase tracking-[0.3em]">
                        GDA DVS
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
