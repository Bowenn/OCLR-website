import type { HistoricalArchive } from "./historical-archive";
import type { ResolvedBracket, ResolvedMatch } from "./bracket-model";

/** Edges mean a team's previous recorded appearance, never an invented qualification rule. */
export function archiveBracket(
  archive: HistoricalArchive,
  detailsHref: (id: string) => string,
): ResolvedBracket | null {
  const groups = new Map(archive.standings.map((s) => [s.teamId, s.group]));
  const sorted = [...archive.matches]
    .filter((m) => m.score)
    .sort(
      (a, b) =>
        (a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity) -
          (b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity) ||
        a.id.localeCompare(b.id),
    );
  if (!sorted.length) return null;
  const groupMatches = new Map<string, ResolvedMatch[]>();
  const rounds: { label: string; matches: ResolvedMatch[] }[] = [];
  const last = new Map<string, { id: string; column: number; at: number }[]>();
  for (const m of sorted) {
    const g = groups.get(m.teamA);
    const isGroup =
      g && g === groups.get(m.teamB) && /^(?:group(?:\s|$)|GS$)/i.test(m.stage);
    const at = m.scheduledAt ? Date.parse(m.scheduledAt) : null;
    const predecessors = [m.teamA, m.teamB].map((team) => {
      if (isGroup || at === null) return null;
      const earlier = (last.get(team) ?? []).filter((p) => p.at < at);
      const latest = earlier.at(-1);
      // Simultaneous source appearances cannot establish a unique predecessor.
      return latest && earlier.filter((p) => p.at === latest.at).length === 1
        ? latest
        : null;
    });
    const column = Math.max(
      0,
      ...predecessors.map((p) => (p ? p.column + 1 : 0)),
    );
    const resolved: ResolvedMatch = {
      id: m.id,
      label: m.label,
      status: "completed",
      scores: m.score!,
      winnerSlot: m.score![0] > m.score![1] ? 0 : 1,
      note: null,
      detailsUrl: detailsHref(m.id),
      slots: [m.teamA, m.teamB].map((teamId, i) => ({
        teamId,
        label: archive.teams.find((t) => t.id === teamId)!.name,
        sourceMatchId: predecessors[i]?.id ?? null,
        kind: "team" as const,
      })) as ResolvedMatch["slots"],
    };
    if (isGroup) {
      groupMatches.set(g, [...(groupMatches.get(g) ?? []), resolved]);
    } else {
      // Missing dates do not create edges or chronological ordering claims.
      const index = at === null ? rounds.length : column;
      rounds[index] ??= { label: m.stage, matches: [] };
      if (!rounds[index].label.split(" / ").includes(m.stage))
        rounds[index].label += ` / ${m.stage}`;
      rounds[index].matches.push(resolved);
      if (at !== null)
        for (const team of [m.teamA, m.teamB]) {
          last.set(team, [
            ...(last.get(team) ?? []),
            { id: m.id, column: index, at },
          ]);
        }
    }
  }
  return {
    editionSlug: archive.editionSlug,
    published: true,
    formatLabel: "Historical archive",
    source: { label: "Source", url: archive.sourceUrl },
    updatedAt: `${archive.capturedOn}T00:00:00Z`,
    groups: [
      ...(rounds.length
        ? [
            {
              id: "match-path",
              label: "Match path",
              rounds: rounds.filter(Boolean).map((r, i) => ({
                ...r,
                id: `round-${i}`,
                label: `${r.label} · ${i + 1}`,
              })),
            },
          ]
        : []),
      ...[...groupMatches]
        .map(([g, matches], i) => ({
          id: `group-${i}`,
          label: g,
          layout: "grid" as const,
          rounds: [
            {
              id: `group-round-${i}`,
              label: sorted.find((m) => m.id === matches[0].id)!.stage,
              matches,
            },
          ],
        }))
        .sort((a, b) =>
          a.label.localeCompare(b.label, "en", { numeric: true }),
        ),
    ],
  };
}
