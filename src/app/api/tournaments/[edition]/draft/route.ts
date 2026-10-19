import { NextResponse } from "next/server";
import { publicDraft } from "@/lib/draft";
import { apiError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const { edition } = await context.params;
    return NextResponse.json(await publicDraft(edition), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
