import { desktopFixtures } from "@/lib/desktop-referee";
import { desktopResponse, desktopError } from "@/lib/desktop-auth";
export async function GET(request: Request) {
  try {
    return desktopResponse(await desktopFixtures(request), 200, "Referee");
  } catch (e) {
    return desktopError(e);
  }
}
