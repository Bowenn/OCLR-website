import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { tournamentForAdmin, tournamentCommand } from "@/lib/tournaments";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
type Context = { params: Promise<{ edition: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return NextResponse.json(
      await tournamentForAdmin(
        await requireUser(),
        (await context.params).edition,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    return NextResponse.json(
      await tournamentCommand(
        await requireUser(),
        (await context.params).edition,
        await readJson(request, 524288),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
