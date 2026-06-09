import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const USERS_FALLBACK = path.join(process.cwd(), ".data", "users.json");

async function saveFallbackUser(user: any) {
  await fs.promises.mkdir(path.dirname(USERS_FALLBACK), { recursive: true });
  let arr: any[] = [];
  try {
    const txt = await fs.promises.readFile(USERS_FALLBACK, "utf8");
    arr = JSON.parse(txt || "[]");
  } catch {
    arr = [];
  }
  arr.push(user);
  await fs.promises.writeFile(USERS_FALLBACK, JSON.stringify(arr, null, 2));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);
    const id = (global as any).crypto?.randomUUID?.() ?? String(Date.now());

    // Try to insert into a DB table named `auth_users` or `users` if present.
    try {
      await query("INSERT INTO auth_users(id,email,password_hash,created_at) VALUES($1,$2,$3,now())", [id, email, hash]);
    } catch (dbErr) {
      try {
        await query("INSERT INTO users(id,email,password_hash,created_at) VALUES($1,$2,$3,now())", [id, email, hash]);
      } catch (e) {
        // fallback to file storage
        await saveFallbackUser({ id, email, password_hash: hash, created_at: new Date().toISOString() });
      }
    }

    return NextResponse.json({ user: { id, email } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
