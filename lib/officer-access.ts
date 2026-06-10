import { getSupabaseAdmin } from "./supabaseAdmin";

export type OfficerRole = "admin" | "officer";

export type OfficerRecord = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  designation: string;
  department: string;
  role: OfficerRole;
  confirmed: boolean;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

export type OfficerContext = OfficerRecord & {
  isAdmin: boolean;
  canGenerate: boolean;
  isPending: boolean;
};

export async function getOfficerByUserId(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await (supabaseAdmin.from("officers") as any)
    .select(
      "id, user_id, email, full_name, designation, department, role, confirmed, approved, approved_at, approved_by, created_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as OfficerRecord;
}

export async function getOfficerByEmail(email: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await (supabaseAdmin.from("officers") as any)
    .select(
      "id, user_id, email, full_name, designation, department, role, confirmed, approved, approved_at, approved_by, created_at",
    )
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as OfficerRecord;
}

export async function getOfficerContextByUserId(userId: string): Promise<OfficerContext | null> {
  const officer = await getOfficerByUserId(userId);

  if (!officer) {
    return null;
  }

  return {
    ...officer,
    isAdmin: officer.role === "admin",
    canGenerate: officer.role === "admin" || officer.approved,
    isPending: officer.role !== "admin" && !officer.approved,
  };
}

export async function getOfficerContextByEmail(email: string): Promise<OfficerContext | null> {
  const officer = await getOfficerByEmail(email);
  if (!officer) return null;
  return {
    ...officer,
    isAdmin: officer.role === "admin",
    canGenerate: officer.role === "admin" || officer.approved,
    isPending: officer.role !== "admin" && !officer.approved,
  };
}
