import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { withdrawRegistration } from "@/lib/registrations";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    return NextResponse.json(
      await withdrawRegistration(user, id, await readJson(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
