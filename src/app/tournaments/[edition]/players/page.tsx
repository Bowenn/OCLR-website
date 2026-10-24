import { currentUser } from "@/lib/auth/user";
import { publicPlayerIntroductions } from "@/lib/player-messages";
import { EventPlayers } from "@/components/event-players";
import { eventPreview } from "@/lib/event-preview";
import { historicalPage } from "@/components/historical-archive";
import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { publicPlayers } from "@/lib/players";
import { getPublicEdition } from "@/lib/content";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/http";
import { Action, PageHeading } from "@/components/ui";
import { after } from "next/server";
import {
  cachedDirectoryStatistics,
  refreshDirectoryStatistics,
  type DirectoryStatistics,
} from "@/lib/osu-profiles";
import { z } from "zod";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Players"),
    description: tr(
      "Accepted players and announced teams for this OCLR tournament.",
    ),
  };
}

export default async function Players({
  searchParams,
  params,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tr = await getAppTranslations();

  const { edition } = await params;
  const archivePage = await historicalPage(edition, "players");
  if (archivePage) return archivePage;
  const currentEdition = await getPublicEdition(edition);
  if (!currentEdition) notFound();
  const preview = eventPreview(edition);
  if (preview)
    return (
      <>
        <PageHeading title={tr("Players")} />
        <EventPlayers edition={edition} players={preview.players} preview />
      </>
    );
  const base = `/tournaments/${edition}/players`;
  let result;
  let view: "cards" | "list" = "cards";
  try {
    const query = await searchParams;
    const selected = z
      .enum(["cards", "list"])
      .default("cards")
      .safeParse(query.view);
    if (
      !selected.success ||
      Object.keys(query).some((key) => !["q", "page", "view"].includes(key))
    )
      throw new HttpError(400, "Choose a valid player search and page.");
    view = selected.data;
    result = await publicPlayers({ q: query.q, page: query.page, edition });
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 400) throw error;
    return (
      <div className="directory-page edition-players">
        <PageHeading eyebrow={tr("PUBLIC DIRECTORY")} title={tr("Players")}>
          {tr(error.message)}
        </PageHeading>
        <Action href={base}>{tr("Clear filters")}</Action>
      </div>
    );
  }
  const { rows, total, filters } = result;
  const { statistics, refreshIds } = await cachedDirectoryStatistics(
    rows.map((p) => p.osuId),
  ).catch(() => ({
    statistics: new Map<number, DirectoryStatistics>(),
    refreshIds: [] as number[],
  }));
  if (refreshIds.length)
    after(async () => {
      try {
        // A publication or registration decision may change after rendering.
        const current = await publicPlayers(filters);
        const visible = new Set(current.rows.map((p) => p.osuId));
        await refreshDirectoryStatistics(
          refreshIds.filter((id) => visible.has(id)),
        );
      } catch {
        // Stats refresh must never prevent an otherwise usable public directory.
      }
    });
  const [viewer, introductions] = await Promise.all([
    currentUser(),
    publicPlayerIntroductions(
      edition,
      rows.map((p) => p.osuId),
      currentEdition.registration?.publicIntroductionQuestionId,
    ),
  ]);
  const query = new URLSearchParams({ q: filters.q, view });
  return (
    <div className="directory-page edition-players">
      <PageHeading title={tr("Players")} />
      <form action={base} className="event-tools">
        <label>
          {tr("Search players")}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder={tr("Username or osu! ID")}
          />
        </label>
        <button>{tr("Search")}</button>
      </form>
      <EventPlayers
        edition={edition}
        search={false}
        signedIn={Boolean(viewer)}
        viewerId={viewer?.osuId}
        grouped={rows.some((p) => p.participation === "finalized_roster")}
        players={rows.map((p) => ({
          id: p.osuId,
          name: p.username,
          team: p.team?.name ?? null,
          captain: p.captain,
          bio: introductions.get(p.osuId),
          rank: statistics.get(p.osuId)?.globalRank ?? null,
          pp: statistics.get(p.osuId)?.pp ?? null,
          href: `/players/${p.osuId}?edition=${edition}`,
          fetchedAt: statistics.get(p.osuId)?.fetchedAt,
        }))}
      />
      <nav className="actions spaced" aria-label={tr("Player directory pages")}>
        {filters.page > 1 && (
          <Link
            className="button secondary"
            href={`${base}?${query}&page=${filters.page - 1}`}
          >
            {tr("← Previous")}
          </Link>
        )}
        {filters.page * 24 < total && (
          <Link
            className="button secondary"
            href={`${base}?${query}&page=${filters.page + 1}`}
          >
            {tr("Next →")}
          </Link>
        )}
      </nav>
    </div>
  );
}
