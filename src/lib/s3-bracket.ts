import type { ResolvedMatch } from "./bracket-model";

export const s3KnockoutOrder = [
  "ko-a1",
  "ko-a3",
  "ko-b2",
  "ko-b4",
  "ko-a5",
  "ko-b7",
  "ko-b6",
  "ko-b8",
  "ko-b9",
  "ko-a10",
];
export function isS3Source(url: string) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/1o4asx7nZQTAWwNjK_TyB_aq2ZWD471BHAxcdLp-TPAo(?:\/edit)?$/.test(
    url,
  );
}

// Reconstructed from the saved competitors/outcomes; see
// docs/s3-bracket-reconstruction.md. No dates, seed tie-breaks or reset
// fixtures are invented. Keep reference semantics rather than official slots.
const inputs: Record<string, [string, "winner" | "loser"][]> = {
  "ko-a5": [
    ["ko-a1", "winner"],
    ["ko-a3", "winner"],
  ],
  "ko-b7": [
    ["ko-a1", "loser"],
    ["ko-b2", "winner"],
  ],
  "ko-b6": [
    ["ko-a3", "loser"],
    ["ko-b4", "winner"],
  ],
  "ko-b8": [
    ["ko-b7", "winner"],
    ["ko-b6", "winner"],
  ],
  "ko-b9": [
    ["ko-a5", "loser"],
    ["ko-b8", "winner"],
  ],
  "ko-a10": [
    ["ko-a5", "winner"],
    ["ko-b9", "winner"],
  ],
};
export function completeS3Paths(matches: ResolvedMatch[]): boolean {
  const byId = new Map(matches.map((m) => [m.id, m]));
  if (
    matches.length !== 10 ||
    byId.size !== 10 ||
    s3KnockoutOrder.some(
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
