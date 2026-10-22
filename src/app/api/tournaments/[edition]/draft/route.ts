import { after, NextResponse } from "next/server";
import { publicDraft } from "@/lib/draft";
import { publicBroadcastDraft } from "@/lib/broadcast";
import { apiError } from "@/lib/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const { edition } = await context.params;
    const board =
      new URL(request.url).searchParams.get("overlay") === "1"
        ? await publicBroadcastDraft(edition, after)
        : await publicDraft(edition);
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
