import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { importFixtureMatch } from "@/lib/results";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ edition: string; fixtureId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { edition, fixtureId } = await context.params;
    return NextResponse.json(
      await importFixtureMatch(
        user,
        edition,
        fixtureId,
        await readJson(request),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
