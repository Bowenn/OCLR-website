import { NextResponse } from "next/server";
import { publicPlayers } from "@/lib/players";
import { apiError } from "@/lib/http";
export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await publicPlayers(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
