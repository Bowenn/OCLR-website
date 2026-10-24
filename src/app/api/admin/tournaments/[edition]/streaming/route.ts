import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { streamingWorkspace } from "@/lib/streaming";
import { apiError } from "@/lib/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const actor = await requireUser();
    const { edition } = await context.params;
    return NextResponse.json(
      await streamingWorkspace(
        actor,
        edition,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
