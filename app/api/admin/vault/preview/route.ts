import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOfficerContextByUserId } from "@/lib/officer-access";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const path = searchParams.get("path");

    if (!userId || !path) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
    }

    // 1. Verify user is Admin
    const ctx = await getOfficerContextByUserId(userId);
    if (!ctx?.isAdmin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    // 2. Generate signed URL for 1 hour
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 3600);

    if (error) {
      throw error;
    }

    // Append cache-buster to prevent aggressive browser caching of PDFs
    const urlWithCacheBuster = data.signedUrl
      ? `${data.signedUrl}${data.signedUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
      : null;

    return NextResponse.json({ url: urlWithCacheBuster }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate preview." },
      { status: 500 }
    );
  }
}
