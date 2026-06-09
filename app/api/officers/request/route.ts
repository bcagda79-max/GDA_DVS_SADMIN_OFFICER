import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      fullName,
      designation,
      department,
      userId,
      role,
    } = body as {
      email?: string;
      fullName?: string;
      designation?: string;
      department?: string;
      userId?: string | null;
      role?: string;
    };

    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Missing Supabase admin client." }, { status: 500 });
    }

    const { data: existingOfficer } = await (supabaseAdmin.from("officers") as any)
      .select("id, role, approved")
      .eq("email", email)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      email,
      user_id: userId ?? null,
      full_name: fullName ?? email,
      designation: designation ?? "Officer",
      department: department ?? "BCA",
      role: role === "admin" ? "admin" : existingOfficer?.role ?? "officer",
      confirmed: Boolean(userId),
      approved: existingOfficer?.role === "admin" ? true : Boolean(existingOfficer?.approved),
    };

    if (existingOfficer) {
      const { error } = await (supabaseAdmin.from("officers") as any)
        .update(payload)
        .eq("email", email);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await (supabaseAdmin.from("officers") as any).insert(payload);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create officer request.";
    console.error("POST /api/officers/request error:", err);
    const responseBody: any = { error: message };
    if (process.env.NODE_ENV !== "production" && err instanceof Error) {
      responseBody.stack = err.stack;
    }
    return NextResponse.json(responseBody, { status: 500 });
  }
}
