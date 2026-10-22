import { NextResponse } from "next/server";
import { getPublicEditions } from "@/lib/content";
import { publicEditionSummary } from "@/lib/tournaments";
import { registrationAvailability } from "@/lib/registrations";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    return NextResponse.json(
      await Promise.all(
        (await getPublicEditions()).map(async (e) =>
          publicEditionSummary(e, await registrationAvailability(e)),
        ),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
