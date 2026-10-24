import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { addManualRegistrations } from "@/lib/manual-registrations";
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
      await addManualRegistrations(
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
