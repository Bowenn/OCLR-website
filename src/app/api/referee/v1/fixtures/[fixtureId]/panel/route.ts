import { desktopPanel } from "@/lib/desktop-referee";
import { desktopResponse, desktopError } from "@/lib/desktop-auth";
export async function GET(
  request: Request,
  context: { params: Promise<{ fixtureId: string }> },
) {
  try {
    return desktopResponse(
      await desktopPanel(request, (await context.params).fixtureId),
      200,
      "Referee",
    );
  } catch (e) {
    return desktopError(e);
  }
}
