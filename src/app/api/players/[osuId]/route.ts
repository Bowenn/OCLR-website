import { NextResponse } from "next/server";
import { publishedPlayerProfile } from "@/lib/player-profiles";
import { apiError, HttpError } from "@/lib/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ osuId: string }> },
) {
  try {
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((key) => key !== "mode") ||
      query.getAll("mode").length > 1
    )
      throw new HttpError(400, "Choose one supported ruleset.");
    const result = await publishedPlayerProfile(
      (await params).osuId,
      query.get("mode") ?? undefined,
    );
    // Preserve explicit upstream errors for clients when no saved profile exists.
    return NextResponse.json(result, {
      status: result.error?.status ?? 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
