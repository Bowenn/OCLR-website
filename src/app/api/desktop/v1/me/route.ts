import {
  requireDesktopUser,
  desktopResponse,
  desktopError,
} from "@/lib/desktop-auth";
export async function GET(request: Request) {
  try {
    const u = await requireDesktopUser(request);
    return desktopResponse({
      subject: { osuId: u.osuId, username: u.username },
      session_id: u.sessionId,
      scope: u.scopes,
      access_expires_at: u.accessExpiresAt.toISOString(),
      refresh_expires_at: u.refreshExpiresAt.toISOString(),
      session_expires_at: u.sessionExpiresAt.toISOString(),
    });
  } catch (e) {
    return desktopError(e);
  }
}
