import { NextResponse } from "next/server";
import { getPublicEditions } from "@/lib/content";
import { publicEditionSummary } from "@/lib/tournaments";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    return NextResponse.json(
      (await getPublicEditions()).map(publicEditionSummary),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
