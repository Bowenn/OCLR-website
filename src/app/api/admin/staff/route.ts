import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import {
  changeStaffRole,
  changeStaffRoleSet,
  listStaffRoles,
} from "@/lib/staff-roles";
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
    const input = await readJson(request);
    return NextResponse.json(
      await (input &&
      typeof input === "object" &&
      "action" in input &&
      input.action === "set_roles"
        ? changeStaffRoleSet(user, input)
        : changeStaffRole(user, input)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
