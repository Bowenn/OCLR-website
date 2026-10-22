import { NextResponse } from "next/server";
import { publicAwards } from "@/lib/awards";
import { apiError, HttpError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const data = await publicAwards((await context.params).edition);
    if (!data) throw new HttpError(404, "Tournament not found.");
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
