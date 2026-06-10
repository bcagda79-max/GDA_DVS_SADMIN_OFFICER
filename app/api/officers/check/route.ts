import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const email = url.searchParams.get("email")?.trim();

    if (!userId) {
      if (!email) {
        return NextResponse.json({ allowed: false }, { status: 400 });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ allowed: false }, { status: 500 });
    }

    const queryBuilder = (supabaseAdmin.from("officers") as any).select("id, approved, confirmed");
    if (userId) {
      queryBuilder.eq("user_id", userId);
    } else {
      queryBuilder.eq("email", email);
    }
    const { data, error } = await queryBuilder.eq("confirmed", true).maybeSingle();

    if (error) {
      return NextResponse.json({ allowed: false }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ allowed: false, emailFound: !!email, pending: false });
    }

    return NextResponse.json({
      allowed: true,
      approved: Boolean(data.approved),
      pending: Boolean(data.confirmed && !data.approved),
      emailFound: true,
    });
  } catch (err) {
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}
