import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { addManualRegistration } from "@/lib/manual-registrations";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser();
    const { edition } = await context.params;
    const registration = await addManualRegistration(
      actor,
      edition,
      await readJson(request, 4096),
    );
    return NextResponse.json(
      {
        id: registration.id,
        userId: registration.userId,
        status: registration.status,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
