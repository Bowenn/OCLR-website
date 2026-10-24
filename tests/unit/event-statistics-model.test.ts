import { describe, expect, it } from "vitest";
import {
  eventMapKey,
  groupEventMaps,
} from "../../src/lib/event-statistics-model";
import type { EventScore } from "../../src/lib/event-statistics";
const score: EventScore = {
  player: "Synthetic Player",
  team: "Synthetic Team",
  round: "gs1",
  slot: "NM1",
  title: "Synthetic Map A",
  mapId: 1001,
  score: 800000,
  accuracy: 0.98,
  combo: 100,
  mods: "NM",
  mp: 1,
  game: "1",
  fixture: "one",
};
describe("event beatmap identity", () => {
  it("separates reused slots across maps and rounds while grouping the same map's plays", () => {
    const maps = groupEventMaps([
      score,
      { ...score, player: "Second Player", score: 700000 },
      { ...score, round: "gs2", mapId: 1002, title: "Synthetic Map B" },
      { ...score, mapId: 1003, title: "Synthetic Map C" },
      { ...score, round: "gs2" },
    ]);
    expect(maps.map((map) => map.plays.length)).toEqual([2, 1, 1, 1]);
    expect(new Set(maps.map((map) => map.key)).size).toBe(4);
    expect(new Set(maps.map((map) => map.label)).size).toBe(4);
  });
  it("keeps preview titles distinct when stable numeric IDs are unavailable", () => {
    const maps = groupEventMaps([
      { ...score, mapId: null },
      { ...score, mapId: null, title: "Synthetic Map B" },
    ]);
    expect(maps).toHaveLength(2);
    expect(eventMapKey({ ...score, title: "Changed display text" })).toBe(
      eventMapKey(score),
    );
  });
});
