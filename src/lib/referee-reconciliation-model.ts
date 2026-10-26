import type { RefereeProjection } from "./referee-model";

export type ReconciliationLink = {
  attemptId: string;
  importId: string | null;
  sourceFingerprint: string | null;
  gameId: number | null;
  sessionRevision: number;
  dependencyFingerprint: string;
};
export type ReconciliationSource = {
  importId: string;
  fingerprint: string;
  matchId: number;
  complete: boolean;
  current: boolean;
  games: {
    id: number;
    beatmapId: number | null;
    winnerTeamId: string | null;
    tied: boolean;
    ended: boolean;
    problems: string[];
  }[];
};
/** Never match by beatmap alone: repeat plays, warmups and replays require a human choice. */
export function compareRefereeAttempts(
  projection: RefereeProjection,
  links: ReconciliationLink[],
  sources: ReconciliationSource[],
  revision: number,
  dependencyFingerprint: string,
) {
  return projection.activeSelections.flatMap((selection) =>
    selection.attempts.map((attempt) => {
      const link = links.find((l) => l.attemptId === attempt.id);
      const source = sources.find((s) => s.importId === link?.importId);
      const game = source?.games.find((g) => g.id === link?.gameId);
      let status:
        | "unmatched"
        | "stale"
        | "missing"
        | "incomplete"
        | "different_map"
        | "different_result"
        | "matched" = "unmatched";
      if (link?.importId) {
        if (
          link.sessionRevision !== revision ||
          link.dependencyFingerprint !== dependencyFingerprint ||
          !source?.current ||
          source.fingerprint !== link.sourceFingerprint
        )
          status = "stale";
        else if (!game) status = "missing";
        else if (game.beatmapId !== selection.beatmapId)
          status = "different_map";
        else if (
          !source.complete ||
          !game.ended ||
          game.problems.length ||
          ["pending", "playing"].includes(attempt.status)
        )
          status = "incomplete";
        else if (
          attempt.status === "completed"
            ? game.winnerTeamId !== attempt.winnerTeamId || game.tied
            : attempt.status === "tied"
              ? !game.tied
              : true
        )
          status = "different_result";
        else status = "matched";
      }
      return {
        attemptId: attempt.id,
        pickId: selection.id,
        pickTeamId: selection.teamId,
        beatmapId: selection.beatmapId,
        category: selection.category,
        attemptNumber: attempt.number,
        attemptStatus: attempt.status,
        winnerTeamId: attempt.winnerTeamId,
        // Input may be a database row. Keep request keys and receipt hashes server-only.
        link: link
          ? {
              attemptId: link.attemptId,
              importId: link.importId,
              sourceFingerprint: link.sourceFingerprint,
              gameId: link.gameId,
              sessionRevision: link.sessionRevision,
              dependencyFingerprint: link.dependencyFingerprint,
            }
          : null,
        sourceWinnerTeamId: game?.winnerTeamId ?? null,
        status,
      };
    }),
  );
}
