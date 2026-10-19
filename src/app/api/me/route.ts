import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    return NextResponse.json(await requireUser(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
