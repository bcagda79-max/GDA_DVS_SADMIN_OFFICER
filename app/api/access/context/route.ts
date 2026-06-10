import { NextResponse } from "next/server";
import { getOfficerContextByUserId, getOfficerContextByEmail } from "@/lib/officer-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const email = url.searchParams.get("email")?.trim();

  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email is required." }, { status: 400 });
  }

  const context = userId
    ? await getOfficerContextByUserId(userId)
    : await getOfficerContextByEmail(email!);

  if (!context) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  return NextResponse.json({
    found: true,
    userId: context.user_id,
    email: context.email,
    fullName: context.full_name,
    designation: context.designation,
    department: context.department,
    role: context.role,
    confirmed: context.confirmed,
    approved: context.approved,
    isAdmin: context.isAdmin,
    canGenerate: context.canGenerate,
    isPending: context.isPending,
  });
}
