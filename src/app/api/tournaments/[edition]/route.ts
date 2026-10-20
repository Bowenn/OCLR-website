import { NextResponse } from "next/server";
import { getPublicEdition } from "@/lib/content";
import { publicEditionSummary } from "@/lib/tournaments";
import { registrationAvailability } from "@/lib/registrations";
import { apiError, HttpError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ edition: string }> },
) {
  try {
    const edition = await getPublicEdition((await context.params).edition);
    if (!edition) throw new HttpError(404, "Tournament not found.");
    return NextResponse.json(
      publicEditionSummary(edition, await registrationAvailability(edition)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
