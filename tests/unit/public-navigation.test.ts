import { describe, expect, it } from "vitest";
import { publicTournamentSection } from "../../src/lib/public-navigation";
describe("public edition navigation", () => {
  const base = "/tournaments/season-test";
  it.each([
    ["", ""],
    ["/mappools/pool-id", "mappools"],
    ["/teams/team-id", "teams"],
    ["/matches/match-id", "schedule"],
    ["/register", ""],
    ["/rules", "rules"],
    ["/bracket", "bracket"],
    ["/players", "players"],
    ["/team", "teams"],
  ])("selects one destination for %s", (suffix, section) => {
    expect(publicTournamentSection(base + suffix, base)).toBe(section);
  });
  it("does not select a similarly prefixed edition", () => {
    expect(publicTournamentSection(base + "-other/mappools", base)).toBeNull();
  });
});
