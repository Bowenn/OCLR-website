import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { EventStatistics } from "../../src/components/event-statistics";
import type { EventScore } from "../../src/lib/event-statistics";
import en from "../../messages/en.json";
const score: EventScore = {
  osuId: 11,
  teamId: "X",
  player: "Same",
  team: "Same team",
  round: "Final",
  slot: "NM1",
  title: "Synthetic map",
  mapId: 1001,
  score: 100,
  accuracy: 0.98,
  combo: 100,
  mods: "NM",
  mp: 1,
  game: "1",
  fixture: "one",
};
const scores = [
  score,
  { ...score, osuId: 22, teamId: "Y", score: 50 },
  { ...score, player: "Old name", game: "2", score: 80 },
];
const coverage = {
  slug: "synthetic",
  players: [
    { osuId: 11, username: "Same" },
    { osuId: 22, username: "Same" },
  ],
  teams: [
    { id: "X", name: "Same team" },
    { id: "Y", name: "Same team" },
  ],
  stages: ["Final"],
  fixtures: [],
  poolFixtures: [
    {
      id: "one",
      round: "Final",
      teams: ["Same team", "Same team"],
      teamIds: ["X", "Y"],
      maps: [score],
      picks: [],
      bans: [
        { team: "Same team", teamId: "X", maps: [] },
        { team: "Same team", teamId: "Y", maps: [] },
      ],
    },
  ],
} as unknown as NonNullable<Parameters<typeof EventStatistics>[0]["coverage"]>;
createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    <EventStatistics scores={scores} coverage={coverage} />
  </NextIntlClientProvider>,
);
