import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOfficerContextByUserId } from "@/lib/officer-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = String(url.searchParams.get("userId") || "").trim();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const ctx = await getOfficerContextByUserId(userId);
    if (!ctx?.isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, department, title, recipient_name, issue_date, expiry_date, storage_path, processed_file_name, created_at")
      .eq("verified", false)
      .eq("is_forwarded", true)
      .order("created_at", { ascending: false });

    // If the DB schema hasn't been migrated to include `is_forwarded` / `verified`
    // the PostgREST call will return an error (PGRST204). Detect that case and
    // return an empty pending list with a warning so the admin UI doesn't break.
    if (error) {
      const msg = String(error.message || error).toLowerCase();
      const code = (error as any)?.code;
      if (msg.includes("could not find") || msg.includes("is_forwarded") || msg.includes("verified") || code === "PGRST204") {
        // eslint-disable-next-line no-console
        console.warn("pending-documents: documents table missing expected columns (is_forwarded/verified).", msg || error);
        return NextResponse.json({ pending: [], warning: "schema_missing_flags" });
      }
      throw error;
    }

    // Create short-lived signed URLs for admin download
    const withUrls = await Promise.all((data || []).map(async (d: any) => {
      try {
        const { data: signed, error: sErr } = await supabaseAdmin.storage.from("documents").createSignedUrl(d.storage_path, 60);
        return { ...d, fileUrl: sErr ? null : signed?.signedUrl ?? null };
      } catch {
        return { ...d, fileUrl: null };
      }
    }));

    return NextResponse.json({ pending: withUrls });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
