import { eventPreview } from "./event-preview";
export type EventScore = {
  osuId: number;
  teamId: string;
  player: string;
  team: string;
  round: string;
  slot: string;
  title: string;
  mapId: number | null;
  score: number;
  accuracy: number | null;
  combo: number | null;
  mods: string;
  mp: number | null;
  game: string;
  mc?: number;
  fixture: string;
  grade?: string;
  bans?: number;
  poolMatches?: number;
};
export function previewScores(slug: string): EventScore[] | null {
  const p = eventPreview(slug);
  if (!p) return null;
  const maps = p.maps.length
    ? p.maps
    : [
        {
          slot: "NM1",
          title: "CHiCO with HoneyWorks - color [Newly Colored World]",
        },
      ];
  return p.matches
    .filter(
      (m) =>
        m.stage === "group" &&
        (m.id.startsWith("S1-") || m.id.startsWith("S2-")),
    )
    .flatMap((match, fixtureIndex) => {
      const banned = new Set([
        ...(match.redBan ?? "").split(" · "),
        ...(match.blueBan ?? "").split(" · "),
      ]);
      const available = maps.filter((m) => !banned.has(m.slot));
      const count = match.score![0] + match.score![1];
      return Array.from({ length: count }, (_, j) => {
        const map = available[j % available.length];
        return [match.red, match.blue].flatMap((team, side) =>
          p.players
            .filter((player) => player.team === team)
            .flatMap((player, index) => {
              if ((index + j) % 6 >= 4) return [];
              const i = p.players.indexOf(player);
              const winner = j < match.score![0] ? 0 : 1;
              return [
                {
                  osuId: player.id,
                  teamId: `preview:${slug}:team:${p.teams.indexOf(team)}`,
                  player: player.name,
                  team,
                  round: match.round,
                  slot: map.slot,
                  title: map.title,
                  mapId: null,
                  score:
                    (winner === side ? 880000 : 620000) -
                    ((i * 1731 + j * 9331 + fixtureIndex * 7231) % 110000),
                  accuracy: 0.991 - ((i * 7 + j * 3) % 65) / 1000,
                  combo: 1200 - ((i * 37 + j * 13) % 600),
                  mods: map.slot.replace(/\d/g, ""),
                  mp: null,
                  game: `${match.id}-${j}`,
                  fixture: match.id,
                  mc: 2.1 - i * 0.014,
                  grade: index % 3 === 0 ? "S" : "A",
                  bans: 0,
                  poolMatches: 8,
                },
              ];
            }),
        );
      }).flat();
    });
}
