import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", `gdavs_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
  return res;
}
