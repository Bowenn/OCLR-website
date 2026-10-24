import type { EventScore } from "./event-statistics";

// A slot is only meaningful within its round and beatmap identity. Preview
// maps without numeric IDs retain their literal title as the identity fallback.
export function eventMapKey(score: EventScore) {
  return JSON.stringify([score.round, score.slot, score.mapId ?? score.title]);
}

export function groupEventMaps(scores: EventScore[]) {
  const maps = new Map<
    string,
    { key: string; label: string; plays: EventScore[] }
  >();
  for (const score of scores) {
    const key = eventMapKey(score);
    const map = maps.get(key);
    if (map) map.plays.push(score);
    else
      maps.set(key, {
        key,
        label: `${score.round} · ${score.slot} · ${score.mapId ?? score.title}`,
        plays: [score],
      });
  }
  return [...maps.values()];
}
