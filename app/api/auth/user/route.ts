import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.split(";").map((s) => s.trim()).find((c) => c.startsWith("gdavs_token="));
    if (!match) return NextResponse.json(null, { status: 200 });
    const token = match.split("=")[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: "Missing JWT_SECRET" }, { status: 500 });
    try {
      const decoded = jwt.verify(token, secret) as any;
      return NextResponse.json({ user: { id: decoded.id, email: decoded.email } });
    } catch (e) {
      return NextResponse.json(null, { status: 200 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
