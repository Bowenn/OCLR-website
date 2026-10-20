import { NextResponse } from "next/server";
import { publicMappools } from "@/lib/mappools";
import { apiError, HttpError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ edition: string; poolId: string }> },
) {
  try {
    const { edition, poolId } = await context.params;
    const [pool] = await publicMappools(edition, poolId);
    if (!pool) throw new HttpError(404, "Published mappool not found.");
    return NextResponse.json(pool, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
