import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { submitRegistration } from "@/lib/registrations";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { edition } = await context.params;
    const saved = await submitRegistration(
      user,
      edition,
      await readJson(request),
    );
    return NextResponse.json(
      { id: saved.id, status: saved.status },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
