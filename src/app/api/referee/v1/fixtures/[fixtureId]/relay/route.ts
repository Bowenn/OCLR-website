import {
  requireDesktopUser,
  desktopResponse,
  desktopError,
} from "@/lib/desktop-auth";
import { readJson } from "@/lib/http";
import { refereeIrcRelay } from "@/lib/referee-irc";
export async function POST(
  request: Request,
  context: { params: Promise<{ fixtureId: string }> },
) {
  try {
    const actor = await requireDesktopUser(request, "referee:relay");
    const { fixtureId } = await context.params;
    return desktopResponse(
      await refereeIrcRelay(actor, fixtureId, await readJson(request, 524288)),
      200,
      "Referee",
    );
  } catch (e) {
    return desktopError(e);
  }
}
