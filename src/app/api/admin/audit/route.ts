import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { auditLog } from "@/lib/audit";
import { apiError } from "@/lib/http";
export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await auditLog(
        await requireUser(),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
