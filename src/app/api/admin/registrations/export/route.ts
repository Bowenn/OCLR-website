import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { listApplications } from "@/lib/staff";
import { csv } from "@/lib/csv";
import { apiError } from "@/lib/http";
export async function GET(request: NextRequest) {
  try {
    const { rows } = await listApplications(
      await requireStaff(),
      Object.fromEntries(request.nextUrl.searchParams),
      true,
    );
    const body = csv([
      ["osu! ID", "Username", "Edition", "Status", "Submitted at (UTC)"],
      ...rows.map((r) => [
        r.userId,
        r.username,
        r.editionSlug,
        r.status,
        r.createdAt.toISOString(),
      ]),
    ]);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="oclr-registrations.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
