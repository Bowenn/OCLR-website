import { eq } from "drizzle-orm";
import type { db } from "@/db";
import { editionState } from "@/db/schema";
import { HttpError } from "./http";

/** Call under the edition row lock shared with archive import. */
export async function assertOperationalEdition(
  slug: string,
  reader: Pick<ReturnType<typeof db>, "select">,
) {
  const [state] = await reader
    .select({ configuration: editionState.configuration })
    .from(editionState)
    .where(eq(editionState.slug, slug));
  if (!state?.configuration) throw new HttpError(404, "Tournament not found.");
  if (state?.configuration?.archive)
    throw new HttpError(
      409,
      "Historical archives are edited through the archive importer.",
    );
}
