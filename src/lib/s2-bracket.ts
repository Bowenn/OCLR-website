import type { ResolvedMatch } from "./bracket-model";

// S2: group ranks 1–2 enter upper, 3–4 enter lower; no final reset.
// Reconstruct the twelve outcomes from the archived ten-match schedule only
// when every outcome agrees with the saved participants. Dates are irrelevant.
const inputs: Record<number, [number, "winner" | "loser"][]> = {
  5: [
    [4, "loser"],
    [1, "winner"],
  ],
  6: [
    [3, "loser"],
    [2, "winner"],
  ],
  7: [
    [3, "winner"],
    [4, "winner"],
  ],
  8: [
    [5, "winner"],
    [6, "winner"],
  ],
  9: [
    [7, "loser"],
    [8, "winner"],
  ],
  10: [
    [7, "winner"],
    [9, "winner"],
  ],
};

export function completeS2Paths(matches: ResolvedMatch[]) {
  const byNumber = new Map(
    matches.map((m) => [Number(m.id.match(/^es-a(\d+)$/)?.[1]), m]),
  );
  if (matches.length !== 10 || byNumber.size !== 10) return;
  if (
    Array.from({ length: 10 }, (_, i) => byNumber.get(i + 1)).some(
      (m) => !m || m.winnerSlot === null,
    )
  )
    return;
  const updates: { target: ResolvedMatch; slot: number; source: string }[] = [];
  for (const [number, sources] of Object.entries(inputs)) {
    const target = byNumber.get(Number(number))!;
    const slots = new Set<number>();
    for (const [origin, outcome] of sources) {
      const source = byNumber.get(origin)!;
      const team =
        source.slots[
          outcome === "winner" ? source.winnerSlot! : 1 - source.winnerSlot!
        ].teamId;
      const slot = target.slots.findIndex((s) => s.teamId === team);
      if (!team || slot < 0 || slots.has(slot)) return;
      slots.add(slot);
      updates.push({ target, slot, source: source.id });
    }
  }
  // Keep kind=team: these are reconstructed references, not saved official
  // winner/loser slots. The existing reference legend and switch still apply.
  for (const m of matches)
    for (const slot of m.slots) slot.sourceMatchId = null;
  for (const { target, slot, source } of updates)
    target.slots[slot].sourceMatchId = source;
}
