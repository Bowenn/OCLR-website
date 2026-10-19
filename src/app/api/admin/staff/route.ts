import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { changeStaffRole, listStaffRoles } from "@/lib/staff-roles";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function GET() {
  try {
    return NextResponse.json(await listStaffRoles(await requireUser()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    return NextResponse.json(
      await changeStaffRole(user, await readJson(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
