import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { ownRegistrations } from "@/lib/registrations";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await ownRegistrations(user.osuId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
