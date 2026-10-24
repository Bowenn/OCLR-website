import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { teams, captains } from "@/db/schema";
import { getPublicEdition } from "@/lib/content";
import { currentUser } from "@/lib/auth/user";
import { assertReadCapability } from "@/lib/auth/staff";
import { readTeamImage } from "@/lib/team-media";
export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await context.params;
    if (!z.uuid().safeParse(teamId).success)
      return new Response(null, { status: 404 });
    const [row] = await db()
      .select({ team: teams, captainPublished: captains.published })
      .from(teams)
      .innerJoin(
        captains,
        and(
          eq(captains.editionSlug, teams.editionSlug),
          eq(captains.userId, teams.captainId),
        ),
      )
      .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)));
    if (!row?.team.avatarKey) return new Response(null, { status: 404 });
    const publicIdentity =
      row.team.identityPublished &&
      row.captainPublished &&
      !!(await getPublicEdition(row.team.editionSlug));
    if (!publicIdentity) {
      const user = await currentUser();
      if (!user) return new Response(null, { status: 404 });
      await assertReadCapability(user, "manage_teams", row.team.editionSlug);
    }
    return new Response(
      new Uint8Array(await readTeamImage(row.team.avatarKey)),
      {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      },
    );
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
