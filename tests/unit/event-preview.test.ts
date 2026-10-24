import { afterEach, describe, expect, it, vi } from "vitest";
import { eventPreview } from "../../src/lib/event-preview";
import { previewScores } from "../../src/lib/event-statistics";
afterEach(() => vi.unstubAllEnvs());
describe("edition design content", () => {
  it("never substitutes fictional data for another edition or a production edition", () => {
    expect(eventPreview("s11")).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    expect(eventPreview("dev-s11")).toBeNull();
    expect(previewScores("dev-s11")).toBeNull();
  });
  it("keeps Swiss records consistent and advances eight of sixteen teams", () => {
    const data = eventPreview("dev-s11")!;
    const records = new Map(data.teams.map((t) => [t, { wins: 0, losses: 0 }]));
    const rounds = [
      ...new Set(
        data.matches.filter((m) => m.stage === "group").map((m) => m.round),
      ),
    ];
    expect(rounds).toHaveLength(5);
    for (const round of rounds) {
      const seen = new Set<string>();
      for (const match of data.matches.filter((m) => m.round === round)) {
        for (const [i, name] of [match.red, match.blue].entries()) {
          expect(seen.has(name)).toBe(false);
          seen.add(name);
          const record = records.get(name)!;
          expect(record.wins).toBeLessThan(3);
          expect(record.losses).toBeLessThan(3);
          expect(match.record).toBe(`${record.wins}–${record.losses}`);
          if (match.score![i] > match.score![1 - i]) record.wins++;
          else record.losses++;
        }
      }
    }
    expect([...records.values()].filter((r) => r.wins === 3)).toHaveLength(8);
    expect([...records.values()].filter((r) => r.losses === 3)).toHaveLength(8);
  });
  it("keeps identities unique and statistics attached to the same roster", () => {
    const data = eventPreview("dev-s11")!;
    const names = new Set(data.players.map((p) => p.name));
    expect(names.size).toBe(data.players.length);
    for (const score of previewScores("dev-s11")!) {
      expect(names.has(score.player)).toBe(true);
      expect(score.accuracy).toBeGreaterThan(0);
      expect(score.accuracy).toBeLessThanOrEqual(1);
      expect(score.mc).toBeGreaterThan(0);
      expect(score.slot).toMatch(/^(NM|HD|HR|DT|FM|TB)\d+$/);
    }
  });
});
