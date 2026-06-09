import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const select = url.searchParams.get("select") || "*";
    const order = url.searchParams.get("order") || "created_at";
    const orderDir = url.searchParams.get("orderDir") || "desc";

    const supabaseAdmin = getSupabaseAdmin();
    const q = (supabaseAdmin.from("saved_signatures") as any)
      .select(select)
      .order(order, { ascending: orderDir === "asc" });

    const res = await q;
    // align with client expectation
    return NextResponse.json({ data: res?.data ?? null });
  } catch (err: any) {
    console.error("saved_signatures GET error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await (supabaseAdmin.from("saved_signatures") as any).insert(rows);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("saved_signatures POST error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
