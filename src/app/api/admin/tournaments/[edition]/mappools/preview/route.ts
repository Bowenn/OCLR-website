import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { previewBeatmap } from "@/lib/mappools";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { edition } = await context.params;
    return NextResponse.json(
      await previewBeatmap(user, edition, await readJson(request, 1024)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
