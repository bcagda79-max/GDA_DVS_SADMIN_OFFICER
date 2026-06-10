import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOfficerContextByUserId } from "@/lib/officer-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const adminUserId = String(formData.get("adminUserId") || "").trim();
    const documentId = String(formData.get("documentId") || "").trim();
    const signedPdf = formData.get("signedPdf");

    if (!adminUserId || !documentId || !(signedPdf instanceof File)) {
      return NextResponse.json({ error: "adminUserId, documentId, and signedPdf are required." }, { status: 400 });
    }

    const ctx = await getOfficerContextByUserId(adminUserId);
    if (!ctx?.isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
    }

    // 1. Fetch the current document record to get its storage_path
    const { data: docRecord, error: fetchError } = await (supabaseAdmin.from("documents") as any)
      .select("storage_path, processed_file_name")
      .eq("id", documentId)
      .maybeSingle();

    if (fetchError || !docRecord) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const storagePath = docRecord.storage_path;
    if (!storagePath) {
      return NextResponse.json({ error: "No storage path for this document." }, { status: 400 });
    }

    // 2. Read the signed PDF bytes
    const pdfBuffer = Buffer.from(await signedPdf.arrayBuffer());

    // 3. Replace the file in Supabase storage (using update to overwrite reliably, falling back to upload)
    let uploadError = null;
    const { error: storageUpdateError } = await supabaseAdmin.storage
      .from("documents")
      .update(storagePath, pdfBuffer, {
        contentType: "application/pdf",
      });

    if (storageUpdateError) {
      // Fallback to upload with upsert if update fails (e.g. if file not found)
      const { error: retryError } = await supabaseAdmin.storage
        .from("documents")
        .upload(storagePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      uploadError = retryError;
    }

    if (uploadError) {
      throw uploadError;
    }

    // 4. Mark the document as verified + signed using a raw query to preserve boolean typing.
    const updateResult = await query(
      `UPDATE documents SET verified = $1, verified_by = $2, verified_at = $3, mime_type = $4, file_size = $5 WHERE id = $6 RETURNING *`,
      [true, adminUserId, new Date().toISOString(), "application/pdf", pdfBuffer.length, documentId]
    );

    if (!updateResult.rows || updateResult.rows.length === 0) {
      return NextResponse.json({ error: "Failed to update document status." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, documentId });
  } catch (err: any) {
    console.error("e-signature API error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
