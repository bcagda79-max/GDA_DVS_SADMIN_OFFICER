"use client";

import { useEffect, useState } from "react";
import { X, Plus, UploadCloud, Loader2, Save } from "lucide-react";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type SavedSignature = {
  id: string;
  name: string;
  designation: string;
  image_url: string;
};

export function SignatureModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (file: File) => void;
}) {
  const supabase = getSupabaseClient();
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Signature Form
  const [newName, setNewName] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFilePreview, setNewFilePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSignatures();
      setIsAddingNew(false);
      resetForm();
    }
  }, [isOpen]);

  const fetchSignatures = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("saved_signatures")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSignatures(data as any);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setNewName("");
    setNewDesignation("");
    setNewFile(null);
    if (newFilePreview) URL.revokeObjectURL(newFilePreview);
    setNewFilePreview(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG/JPG).");
      return;
    }
    setNewFile(file);
    setNewFilePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSaveSignature = async () => {
    if (!newName || !newDesignation || !newFile) {
      setError("Please fill all fields and select an image.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const fileExt = newFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(filePath, newFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase
        .from("saved_signatures")
        .insert([{ name: newName, designation: newDesignation, image_url: imageUrl }] as any);

      if (insertError) throw insertError;

      await fetchSignatures();
      setIsAddingNew(false);
    } catch (e: any) {
      setError(e.message || "Failed to save signature.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectSaved = async (sig: SavedSignature) => {
    try {
      setIsLoading(true);
      const res = await fetch(sig.image_url);
      const blob = await res.blob();
      const file = new File([blob], `signature-${sig.id}.png`, { type: blob.type });
      onSelect(file);
      onClose();
    } catch (e) {
      console.error("Failed to load signature image", e);
    } finally {
      setIsLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#0f172a]/95 backdrop-blur-3xl border border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-[2rem] flex flex-col overflow-hidden relative"
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#38bdf8]/50 to-transparent opacity-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/[0.05] bg-white/[0.01]">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#38bdf8]/10 border border-[#38bdf8]/20">
                <Save className="h-3.5 w-3.5 text-[#38bdf8]" />
              </div>
              <span className="dmsans text-[9px] font-black uppercase tracking-[0.3em] text-[#38bdf8]/80">Secure Vault</span>
            </div>
            <h2 className="playfair text-2xl font-bold text-white">E-Signature Library</h2>
          </div>
          <button onClick={onClose} className="p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-white/40 hover:text-white transition-all group">
            <X className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {isAddingNew ? (
              <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-xl mx-auto space-y-6 bg-[#020617]/40 p-8 rounded-[1.5rem] border border-white/[0.05] shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="playfair text-xl text-white font-bold">Add New Signature</h3>
                  <button onClick={() => setIsAddingNew(false)} className="text-[10px] text-white/40 hover:text-white uppercase tracking-[0.2em] transition-colors">Cancel</button>
                </div>

                {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-xs border border-red-500/20">{error}</div>}

                <div className="space-y-4">
                  <div>
                    <label className="dmsans text-[10px] font-bold uppercase tracking-widest text-[#38bdf8]/60 mb-1 block">Officer Name</label>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. MR.Fawad khan" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#38bdf8]/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="dmsans text-[10px] font-bold uppercase tracking-widest text-[#38bdf8]/60 mb-1 block">Designation</label>
                    <input type="text" value={newDesignation} onChange={e => setNewDesignation(e.target.value)} placeholder="e.g. Director General" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#38bdf8]/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="dmsans text-[10px] font-bold uppercase tracking-widest text-[#38bdf8]/60 mb-1 block">Signature Image (SIGNATURE IMAGE (TRANSPARENT PNG ONLY) )</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl hover:border-[#38bdf8]/50 hover:bg-[#38bdf8]/5 transition-colors cursor-pointer overflow-hidden relative">
                      {newFilePreview ? (
                        <img src={newFilePreview} alt="Preview" className="h-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud className="h-6 w-6 text-white/40 mb-2" />
                          <span className="text-xs text-white/40">Click to upload image</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>
                  <button onClick={handleSaveSignature} disabled={isSaving} className="w-full h-12 bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#020617] font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSaving ? "Saving..." : "Save Signature to Library"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex justify-between items-center mb-8">
                  <p className="dmsans text-[10px] text-white/40 uppercase tracking-widest hidden sm:block">Select an authoritative signature to embed</p>
                  <button onClick={() => setIsAddingNew(true)} className="flex items-center gap-2 px-6 h-11 bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 rounded-xl hover:bg-[#38bdf8] hover:text-[#020617] transition-all font-bold text-[10px] uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(56,189,248,0.15)] hover:shadow-[0_0_25px_rgba(56,189,248,0.4)]">
                    <Plus className="h-4 w-4" /> Add New E-Sign
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="h-8 w-8 text-[#38bdf8] animate-spin" />
                    <span className="dmsans text-[10px] uppercase tracking-widest text-white/40">Fetching Secure Vault...</span>
                  </div>
                ) : signatures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                    <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                      <Save className="h-6 w-6 text-white/20" />
                    </div>
                    <h3 className="playfair text-xl font-bold text-white/60 mb-2">Library is Empty</h3>
                    <p className="text-white/40 dmsans text-[11px] max-w-sm leading-relaxed">
                      No authoritative signatures saved yet. Click the button above to import your first official signature into the secure vault.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {signatures.map(sig => (
                      <div key={sig.id} onClick={() => handleSelectSaved(sig)} className="group cursor-pointer rounded-[1.5rem] border border-white/[0.05] bg-[#020617]/40 backdrop-blur-md hover:bg-[#020617]/80 hover:border-[#38bdf8]/40 transition-all duration-300 p-6 flex flex-col items-center shadow-xl hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#38bdf8]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="h-28 w-full flex items-center justify-center bg-white/[0.02] border border-white/[0.02] rounded-xl p-4 mb-5 group-hover:bg-white/[0.04] transition-colors">
                          <img src={sig.image_url} alt={sig.name} className="max-h-full max-w-full object-contain filter contrast-125 brightness-110 drop-shadow-xl" />
                        </div>
                        <h4 className="playfair text-lg font-bold text-white mb-1.5 text-center truncate w-full group-hover:text-[#38bdf8] transition-colors">{sig.name}</h4>
                        <p className="dmsans text-[9px] font-black text-white/40 uppercase tracking-[0.2em] text-center w-full truncate bg-white/5 py-1 px-3 rounded-full group-hover:bg-[#38bdf8]/10 group-hover:text-[#38bdf8] transition-colors">{sig.designation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
