import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
import {
  statisticsCommand,
  statisticsWorkspace,
} from "@/lib/archive-statistics";
type Context = { params: Promise<{ edition: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return NextResponse.json(
      await statisticsWorkspace(
        await requireUser(),
        (await context.params).edition,
        new URL(request.url).searchParams.get("fixture") ?? "",
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
      await statisticsCommand(
        await requireUser(),
        (await context.params).edition,
        await readJson(request, 32768),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
