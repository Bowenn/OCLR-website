import { desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { userProfileCache } from "@/db/schema";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { captainSetup } from "@/lib/captains";
import { PageHeading } from "@/components/ui";
import { CaptainManager } from "@/components/captain-manager";
import type { CaptainIdentity } from "@/components/captain-player-card";
export default async function Captains({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { edition } = await params;
    const setup = await captainSetup(actor, edition);
    const ids = [
      ...new Set([...setup.captains, ...setup.pool].map((p) => p.userId)),
    ];
    // Private, authorized workspace: one cached identity query, without provider fan-out on page reads.
    const cached = ids.length
      ? await db()
          .select({
            osuId: userProfileCache.osuId,
            profile: userProfileCache.profile,
          })
          .from(userProfileCache)
          .where(
            sql`${inArray(userProfileCache.osuId, ids)} AND ${userProfileCache.errorStatus} IS DISTINCT FROM 404`,
          )
          .orderBy(desc(userProfileCache.attemptedAt))
      : [];
    const identities: Record<number, CaptainIdentity> = {};
    for (const row of cached)
      if (row.profile && !identities[row.osuId])
        identities[row.osuId] = {
          avatarUrl: row.profile.avatarUrl,
          countryCode: row.profile.countryCode,
          countryName: row.profile.countryName,
        };
    return (
      <>
        <PageHeading eyebrow="PARTICIPANTS" title="Captains & player pool">
          Appoint captains and arrange their selection order.
        </PageHeading>
        <p className="small muted">
          Setup {setup.locked ? "locked" : "unlocked"}
        </p>
        <CaptainManager slug={edition} setup={setup} identities={identities} />
      </>
    );
  });
}
