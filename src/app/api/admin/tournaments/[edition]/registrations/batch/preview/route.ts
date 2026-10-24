import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { previewManualRegistrations } from "@/lib/manual-registrations";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser();
    const { edition } = await context.params;
    return NextResponse.json(
      await previewManualRegistrations(
        actor,
        edition,
        await readJson(request, 32768),
      ),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
