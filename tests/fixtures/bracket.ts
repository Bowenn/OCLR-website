import type { Bracket } from "../../src/lib/bracket-model";
export function bracketFixture(
  editionSlug: string,
  teamA: string,
  teamB: string,
): Bracket {
  return {
    editionSlug,
    published: true,
    formatLabel: "Synthetic structured-match fixture",
    source: {
      label: "Isolated automated fixture; not OCLR results",
      url: null,
    },
    updatedAt: "2026-01-01T00:00:00Z",
    groups: [
      {
        id: "main",
        label: "Synthetic bracket",
        rounds: [
          {
            id: "opening",
            label: "Opening match",
            matches: [
              {
                id: "match-one",
                label: "Synthetic match 1",
                status: "completed",
                slots: [
                  { type: "team", teamId: teamA },
                  { type: "team", teamId: teamB },
                ],
                scores: [3, 1],
                winnerSlot: 0,
                note: null,
              },
            ],
          },
          {
            id: "next",
            label: "Next match",
            matches: [
              {
                id: "match-two",
                label: "Synthetic match 2",
                status: "pending",
                slots: [
                  { type: "winner", matchId: "match-one" },
                  { type: "loser", matchId: "match-one" },
                ],
                scores: [null, null],
                winnerSlot: null,
                note: null,
              },
            ],
          },
        ],
      },
    ],
  };
}
