import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, fullName, designation, department, role } = body as {
      userId?: string;
      email?: string;
      fullName?: string;
      designation?: string;
      department?: string;
      role?: string;
    };

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email are required." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Missing Supabase admin client." }, { status: 500 });
    }

    try {
      const { data: existingOfficer } = await (supabaseAdmin.from("officers") as any)
        .select("id, role, approved")
        .eq("email", email)
        .maybeSingle();

      if (existingOfficer) {
        const updatePayload: Record<string, unknown> = {
          user_id: userId,
          email,
          role: existingOfficer.role ?? role ?? "officer",
          confirmed: true,
          approved: existingOfficer.role === "admin" ? true : existingOfficer.approved ?? false,
        };

        if (fullName) updatePayload.full_name = fullName;
        if (designation) updatePayload.designation = designation;
        if (department) updatePayload.department = department;

        await (supabaseAdmin.from("officers") as any).update(updatePayload).eq("email", email);
      } else {
        await (supabaseAdmin.from("officers") as any).insert({
          user_id: userId,
          email,
          full_name: fullName ?? email,
          designation: designation ?? "Officer",
          department: department ?? "BCA",
          role: role === "admin" ? "admin" : "officer",
          confirmed: true,
          approved: role === "admin",
        });
      }
    } catch (err) {
      console.error("/api/officers/complete supabase error:", err);
      try {
        await query(
          `INSERT INTO officers (user_id, email, confirmed, full_name, designation, department, role, approved)
           VALUES ($1, $2, true, $3, $4, $5, $6, $7)
           ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, confirmed = true, full_name = COALESCE(EXCLUDED.full_name, officers.full_name), designation = COALESCE(EXCLUDED.designation, officers.designation), department = COALESCE(EXCLUDED.department, officers.department), role = COALESCE(EXCLUDED.role, officers.role), approved = COALESCE(EXCLUDED.approved, officers.approved)`,
          [userId, email, fullName ?? email, designation ?? "Officer", department ?? "BCA", role === "admin" ? "admin" : "officer", role === "admin"]
        );
      } catch (sqlErr) {
        console.error("/api/officers/complete fallback SQL error:", sqlErr);
        return NextResponse.json({ error: "Failed to link or create officer." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to complete officer registration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



