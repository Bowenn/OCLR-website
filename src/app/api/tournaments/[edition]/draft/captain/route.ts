import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { captainDraft } from "@/lib/draft";
import { apiError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const user = await requireUser();
    const { edition } = await context.params;
    return NextResponse.json(await captainDraft(user, edition), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
