import type { HistoricalArchive } from "../../src/lib/historical-archive";
import { historicalArchive } from "./historical-archive";

/** Synthetic compatibility evidence; never copied from organizer/private records. */
export function historicalSourceDetails(
  slug = "history-test",
): HistoricalArchive {
  const a = structuredClone(historicalArchive);
  a.formatVersion = 2;
  a.editionSlug = slug;
  a.draftMode = "final-tiers";
  a.picks = [];
  a.players = a.players.filter((p) => p.osuId !== 91002);
  a.players.find((p) => p.osuId === 91003)!.tier = null;
  a.players.find((p) => p.osuId === 91003)!.sourceRole = "VICE";
  a.unresolvedPlayers = [
    {
      id: "unknown-captain",
      username: "Synthetic unknown captain",
      teamId: "beta",
      role: "captain",
      tier: 0,
      source: "Synthetic!A1",
    },
  ];
  a.rosterReplacements = [
    {
      id: "replacement-slot",
      teamId: "alpha",
      tier: 4,
      replacedAt: null,
      note: "Synthetic replacement history; dates and membership are unknown.",
      source: "Synthetic!A2",
      people: [
        {
          username: "Synthetic former name",
          osuId: 91005,
          source: "Synthetic!A3",
        },
        {
          username: "Synthetic later name",
          osuId: 91006,
          source: "Synthetic!A4",
        },
      ],
    },
  ];
  a.matches[0].score = null;
  a.matches[0].review = {
    status: "pending",
    workingScore: [3, 5],
    rawScore: [3, 6],
    possibleScore: null,
    note: "Synthetic post-match TB hypothesis, awaiting confirmation.",
    startedAt: "2021-05-08T10:00:00Z",
    redTeamId: "alpha",
    blueTeamId: "beta",
    games: [],
  };
  a.pools[0].maps[0].title = null;
  a.qualifiers = [
    {
      name: "Synthetic raw qualifier",
      poolId: a.pools[0].id,
      source: "Synthetic!A5",
      records: [
        {
          username: "Synthetic qualifier",
          source: "Synthetic!A6",
          scores: [{ slot: a.pools[0].maps[0].slot, score: 1234567 }],
        },
      ],
    },
  ];
  a.sourceFacts = [
    {
      category: "rules",
      label: "Synthetic surviving rule facts",
      text: "Synthetic Swiss format; source facts only.",
      source: "Synthetic!A7",
    },
  ];
  return a;
}
