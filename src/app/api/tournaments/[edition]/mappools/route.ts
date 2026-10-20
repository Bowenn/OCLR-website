import { NextResponse } from "next/server";
import { publicMappools } from "@/lib/mappools";
import { apiError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const { edition } = await context.params;
    return NextResponse.json(await publicMappools(edition), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
