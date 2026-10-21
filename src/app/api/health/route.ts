import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
let release: string | null = null;
try {
  const value = readFileSync(
    join(process.cwd(), ".oclr-release"),
    "utf8",
  ).trim();
  if (/^[a-f0-9]{40}$/.test(value)) release = value;
} catch {
  // Local development/older manually installed releases have no release marker.
}
export async function GET() {
  try {
    await db().execute(sql`SELECT 1`);
    return NextResponse.json(
      { status: "ok", release },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", release },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
