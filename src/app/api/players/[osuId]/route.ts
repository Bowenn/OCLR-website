import { NextResponse } from "next/server";
import { publishedPlayerProfile } from "@/lib/player-profiles";
import { apiError, HttpError } from "@/lib/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ osuId: string }> },
) {
  try {
    if (request.headers.has("authorization"))
      throw new HttpError(403, "Use a browser session for this operation.");
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((key) => !["mode", "edition"].includes(key)) ||
      query.getAll("mode").length > 1 ||
      query.getAll("edition").length > 1 ||
      (query.has("edition") && !/^[a-z0-9-]+$/.test(query.get("edition")!))
    )
      throw new HttpError(400, "Choose one supported ruleset.");
    const result = await publishedPlayerProfile(
      (await params).osuId,
      query.get("mode") ?? undefined,
      query.get("edition") ?? undefined,
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
