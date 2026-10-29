import {
  listDesktopSessions,
  desktopResponse,
  desktopError,
} from "@/lib/desktop-auth";
import { requireUser } from "@/lib/auth/user";
export async function GET() {
  try {
    return desktopResponse(await listDesktopSessions(await requireUser()));
  } catch (e) {
    return desktopError(e);
  }
}
