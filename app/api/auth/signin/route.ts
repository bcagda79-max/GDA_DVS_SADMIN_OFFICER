import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "@/lib/db";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const USERS_FALLBACK = path.join(process.cwd(), ".data", "users.json");

async function findFallbackUserByEmail(email: string) {
  try {
    const txt = await fs.promises.readFile(USERS_FALLBACK, "utf8");
    const arr: any[] = JSON.parse(txt || "[]");
    return arr.find((u) => u.email === email) ?? null;
  } catch {
    return null;
  }
}

function setAuthCookie(token: string) {
  const cookie = `gdavs_token=${token}; Path=/; HttpOnly; SameSite=Lax`;
  return cookie;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

    // Try DB lookup
    let user: any = null;
    try {
      const r = await query("SELECT id,email,password_hash FROM auth_users WHERE email = $1 LIMIT 1", [email]);
      if (r.rows?.[0]) user = r.rows[0];
    } catch (e) {
      try {
        const r2 = await query("SELECT id,email,password_hash FROM users WHERE email = $1 LIMIT 1", [email]);
        if (r2.rows?.[0]) user = r2.rows[0];
      } catch (e2) {
        // ignore
      }
    }

    if (!user) {
      user = await findFallbackUserByEmail(email);
    }

    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: "Missing JWT_SECRET" }, { status: 500 });

    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: "7d" });
    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    res.headers.set("Set-Cookie", setAuthCookie(token));
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
