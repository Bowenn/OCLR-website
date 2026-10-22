import { describe, expect, it } from "vitest";
import {
  isPublicPage,
  publicTournamentSection,
} from "../../src/lib/public-navigation";
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

describe("public appearance boundary", () => {
  it.each([
    "/",
    "/news",
    "/about",
    "/privacy",
    "/tournaments",
    "/players/123",
    "/tournaments/s11/rules",
    "/tournaments/s11/draft",
  ])("themes public page %s", (path) => expect(isPublicPage(path)).toBe(true));
  it.each([
    "/admin",
    "/admin/tournaments/s11",
    "/dashboard",
    "/login",
    "/tournaments/s11/team",
    "/tournaments/s11/draft/captain",
    "/tournaments/s11/draft/overlay",
  ])("isolates operational page %s", (path) =>
    expect(isPublicPage(path)).toBe(false),
  );
  it("isolates presenter mode without changing the normal spectator board", () =>
    expect(isPublicPage("/tournaments/s11/draft", true)).toBe(false));
});
