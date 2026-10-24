import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
import { changePlayerMessage } from "@/lib/player-messages";
type Context = {
  params: Promise<{ edition: string; osuId: string; messageId: string }>;
};
async function change(
  request: Request,
  context: Context,
  operation: "edit" | "delete",
) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser();
    const { edition, osuId, messageId } = await context.params;
    return NextResponse.json(
      await changePlayerMessage(
        actor,
        edition,
        Number(osuId),
        messageId,
        operation,
        await readJson(request, 8192),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  return change(request, context, "edit");
}
export async function DELETE(request: Request, context: Context) {
  return change(request, context, "delete");
}
