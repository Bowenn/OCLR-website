import type { ResolvedMatch } from "./bracket-model";

export const s5KnockoutOrder = [
  "a25",
  "a26",
  "b27",
  "b28",
  "wf",
  "b30",
  "b31",
  "b32",
  "lf",
  "gf",
];
export function isS5Source(url: string) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/100CrQhmcX3lQ_7yn4xcP3cC316A7t35wK6kGfSW2tyM(?:\/edit)?$/.test(
    url,
  );
}

// Reconstructed from the saved competitors/outcomes; see
// docs/s5-final-placements-analysis.md. No dates, seed tie-breaks or reset
// fixtures are invented. Keep reference semantics rather than official slots.
const inputs: Record<string, [string, "winner" | "loser"][]> = {
  wf: [
    ["a25", "winner"],
    ["a26", "winner"],
  ],
  b30: [
    ["a26", "loser"],
    ["b27", "winner"],
  ],
  b31: [
    ["a25", "loser"],
    ["b28", "winner"],
  ],
  b32: [
    ["b30", "winner"],
    ["b31", "winner"],
  ],
  lf: [
    ["wf", "loser"],
    ["b32", "winner"],
  ],
  gf: [
    ["wf", "winner"],
    ["lf", "winner"],
  ],
};
export function completeS5Paths(matches: ResolvedMatch[]): boolean {
  const byId = new Map(matches.map((m) => [m.id, m]));
  if (
    matches.length !== 10 ||
    byId.size !== 10 ||
    s5KnockoutOrder.some(
      (id) => !byId.has(id) || byId.get(id)!.winnerSlot === null,
    )
  )
    return false;
  const updates: { target: ResolvedMatch; slot: number; source: string }[] = [];
  for (const [id, sources] of Object.entries(inputs)) {
    const target = byId.get(id)!;
    const slots = new Set<number>();
    for (const [origin, outcome] of sources) {
      const source = byId.get(origin)!;
      const team =
        source.slots[
          outcome === "winner" ? source.winnerSlot! : 1 - source.winnerSlot!
        ].teamId;
      const slot = target.slots.findIndex((s) => s.teamId === team);
      if (!team || slot < 0 || slots.has(slot)) return false;
      slots.add(slot);
      updates.push({ target, slot, source: origin });
    }
  }
  for (const match of matches)
    for (const slot of match.slots) slot.sourceMatchId = null;
  for (const { target, slot, source } of updates)
    target.slots[slot].sourceMatchId = source;
  return true;
}
