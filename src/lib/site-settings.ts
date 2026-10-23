import { eq } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/db";
import { siteSettings, siteSettingEvents } from "@/db/schema";
import { assertCapability } from "./auth/staff";
import type { User } from "./auth/sessions";
import { HttpError } from "./http";
import { appearances, readAppearance } from "./preferences";

export async function readSiteSettings() {
  const [settings] = await db()
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 1));
  return (
    settings ?? {
      id: 1,
      defaultAppearance: "default" as const,
      revision: 0,
      updatedAt: null,
    }
  );
}

// Request-local deduplication only: the next request sees a saved default without
// redeployment. A cosmetic preference must not take down public pages on DB failure.
export const defaultSiteAppearance = cache(async () => {
  if (!process.env.DATABASE_URL) return "default" as const;
  try {
    return readAppearance((await readSiteSettings()).defaultAppearance);
  } catch {
    console.error(
      "Site appearance is temporarily unavailable; using the original design.",
    );
    return "default" as const;
  }
});

export async function siteSettingsForAdmin(actor: User) {
  // No edition argument deliberately requires a global Admin grant.
  await assertCapability(actor, "configure_tournament");
  return readSiteSettings();
}

export async function updateSiteSettings(actor: User, input: unknown) {
  await assertCapability(actor, "configure_tournament");
  const parsed = z
    .object({
      defaultAppearance: z.enum(appearances),
      expectedRevision: z.number().int().min(0).max(2147483646),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Select a valid website appearance.");
  return db().transaction(async (tx) => {
    await tx.insert(siteSettings).values({ id: 1 }).onConflictDoNothing();
    const [before] = await tx
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .for("update");
    await assertCapability(actor, "configure_tournament", undefined, tx);
    if (before.revision !== parsed.data.expectedRevision)
      throw new HttpError(
        409,
        "Website settings changed. Refresh before saving.",
      );
    if (before.defaultAppearance === parsed.data.defaultAppearance)
      return before;
    const [after] = await tx
      .update(siteSettings)
      .set({
        defaultAppearance: parsed.data.defaultAppearance,
        revision: before.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1))
      .returning();
    await tx.insert(siteSettingEvents).values({
      actorId: actor.osuId,
      before: before.defaultAppearance,
      after: after.defaultAppearance,
      revision: after.revision,
    });
    return after;
  });
}
