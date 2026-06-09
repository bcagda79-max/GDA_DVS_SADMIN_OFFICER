import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const bucket = url.searchParams.get("bucket") || "default";
    const pathParam = url.searchParams.get("path") || "";

    const formData = await req.formData();
    const file = formData.get("file") || formData.get("buffer");
    if (!(file instanceof File) && !file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buf = Buffer.from(await (file as File).arrayBuffer());
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(pathParam, buf);

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("uploads POST error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
