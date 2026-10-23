import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  historicalArchiveSchema,
  archiveCounts,
  archiveWinner,
} from "../../src/lib/historical-archive";
import { archiveBracket } from "../../src/lib/archive-bracket";
import { historicalRulebook } from "../../src/lib/historical-rulebooks";

const a = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s7-archive.json", "utf8")),
);
describe("S7 source competition package", () => {
  it("keeps 64 evidenced identities and final Tiers without invented picks", () => {
    expect(archiveCounts(a)).toEqual({
      teams: 8,
      players: 64,
      picks: 0,
      results: 22,
      incomplete: 0,
      pools: 3,
      maps: 47,
    });
    expect(a.draftMode).toBe("final-tiers");
    for (const team of a.teams) {
      const members = a.players.filter((p) => p.teamId === team.id);
      expect(members).toHaveLength(8);
      expect(
        members.filter((p) => p.role !== "coach").map((p) => p.tier),
      ).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(members.find((p) => p.role === "coach")?.tier).toBeNull();
    }
    expect(a.players.find((p) => p.username === "Kotor1")?.osuId).toBe(2351439);
    expect(a.players.find((p) => p.username === "Aurora_fang")?.osuId).toBe(
      9887164,
    );
    expect(a.players.find((p) => p.username === "Lemon tea")?.osuId).toBe(
      11841499,
    );
  });
  it("applies only the organizer-confirmed January year and A8 forfeit corrections", () => {
    expect(a.matches.find((m) => m.label === "A7")?.scheduledAt).toBe(
      "2022-01-05T20:00:00+08:00",
    );
    expect(a.matches.find((m) => m.label === "A8")).toMatchObject({
      scheduledAt: "2022-01-02T21:00:00+08:00",
      teamA: "team-c",
      teamB: "team-g",
      forfeitWinner: 0,
      score: null,
      mpUrls: [],
    });
    expect(a.matches.find((m) => m.label === "A9")?.scheduledAt).toBe(
      "2022-01-03T20:00:00+08:00",
    );
    expect(a.matches.find((m) => m.label === "A10")?.scheduledAt).toBe(
      "2022-01-02T21:00:00+08:00",
    );
    expect(a.matches[0].scheduledAt).toBe("2021-12-27T20:00:00+08:00");
    expect(a.matches.at(-1)).toMatchObject({
      label: "GF",
      score: [7, 1],
      scheduledAt: "2022-03-05T20:30:00+08:00",
      mpUrls: ["https://osu.ppy.sh/community/matches/98427039"],
    });
    expect(a.matches.filter((m) => m.score)).toHaveLength(21);
    expect(a.matches.filter((m) => m.vodUrl)).toHaveLength(2);
    for (const standing of a.standings) {
      expect(standing.rank).toBeNull();
      const matches = a.matches.filter(
        (m) =>
          m.stage === `Group ${standing.group}` &&
          [m.teamA, m.teamB].includes(standing.teamId),
      );
      expect(matches).toHaveLength(3);
      const wins = matches.filter(
        (m) => [m.teamA, m.teamB][archiveWinner(m)!] === standing.teamId,
      ).length;
      expect([standing.wins, standing.losses]).toEqual([wins, 3 - wins]);
      expect(standing.mapsWon).toBe(
        matches.reduce(
          (sum, m) =>
            sum + (m.score?.[m.teamA === standing.teamId ? 0 : 1] ?? 0),
          0,
        ),
      );
    }
    const bracket = archiveBracket(a, (id) => `/matches/${id}`)!;
    expect(
      bracket.groups.flatMap((g) => g.rounds.flatMap((r) => r.matches)),
    ).toHaveLength(22);
    expect(
      bracket.groups
        .filter((g) => g.layout === "grid")
        .map((g) => [g.label, g.rounds[0].matches.length]),
    ).toEqual([
      ["A", 6],
      ["B", 6],
    ]);
  });
  it("retains literal ACE maps and name-only staff, and excludes absent content", () => {
    expect(a.pools.map((p) => p.maps.length)).toEqual([15, 15, 17]);
    expect(a.pools.every((p) => p.maps.at(-1)?.slot === "ACE1")).toBe(true);
    expect(a.pools[0].maps.find((m) => m.slot === "NM1")).toMatchObject({
      beatmapId: 1981240,
      title: "Sasaki Rico - Recollections [Resolve]",
      mapper: "Lasse",
      stars: 6.39,
      drainSeconds: 238,
    });
    expect(a.staff).toHaveLength(18);
    expect(a.staff.filter((s) => s.osuId === null)).toHaveLength(11);
    expect(a.staff.find((s) => s.username === "Muziyami")?.osuId).toBeNull();
    expect(historicalRulebook(a)).toBeNull();
    expect(JSON.stringify(a)).not.toMatch(
      /选手名单!|教练名单!|Damage!|Chess!|联系方式|@qq|@gmail/,
    );
    expect(a.picks).toEqual([]);
    expect(a.links).toEqual([]);
  });
});
