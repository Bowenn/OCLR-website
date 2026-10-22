import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { previewManualRegistration } from "@/lib/manual-registrations";
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
      await previewManualRegistration(
        actor,
        edition,
        await readJson(request, 1024),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
