import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ bucket: string; file: string[] }> }) {
  try {
    const { bucket, file } = await ctx.params;
    const decodedSegments = file.map((segment) => decodeURIComponent(segment));
    const relPath = decodedSegments.join("/");
    const filePath = path.join(process.cwd(), "uploads", bucket, relPath);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = await fs.promises.readFile(filePath);
    const headers = new Headers();
    // basic content type detection by extension
    if (filePath.endsWith(".pdf")) headers.set("Content-Type", "application/pdf");
    else if (filePath.endsWith(".png")) headers.set("Content-Type", "image/png");
    else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) headers.set("Content-Type", "image/jpeg");
    else headers.set("Content-Type", "application/octet-stream");
    return new NextResponse(data, { headers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
