import { z } from "zod";
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const time = z.iso.datetime({ offset: true }).nullable();
export const matchScoreSchema = z
  .object({
    osuId: id.nullable(),
    total: integer.nullable(),
    team: z.enum(["blue", "red", "none"]).nullable(),
    slot: integer.nullable(),
    passed: z.boolean().nullable(),
    mods: z.array(z.string().max(16)).max(64),
    accuracy: z.number().min(0).max(1).nullable(),
    combo: integer.nullable(),
    providerFields: z.record(
      z.string(),
      z.union([
        z.string().max(100),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ]),
    ),
    problems: z.array(z.string().max(250)).max(32),
  })
  .strict();
export const matchGameSchema = z
  .object({
    id,
    beatmapId: id.nullable(),
    startTime: time,
    endTime: time,
    mode: z.string().max(30).nullable(),
    teamType: z.string().max(40).nullable(),
    scoringType: z.string().max(40).nullable(),
    mods: z.array(z.string().max(16)).max(64),
    scores: z.array(matchScoreSchema).max(64),
    problems: z.array(z.string().max(250)).max(32),
    beatmap: z
      .object({
        setId: id.nullable(),
        title: z.string().max(500).nullable(),
        artist: z.string().max(500).nullable(),
        difficulty: z.string().max(500).nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const matchSourceSchema = z
  .object({
    schemaVersion: z.literal(1),
    apiVersion: z.literal("20220705"),
    fetchedAt: z.iso.datetime(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    match: z
      .object({
        id,
        title: z.string().max(500),
        startTime: time,
        endTime: time,
      })
      .strict(),
    firstEventId: integer,
    latestEventId: integer,
    currentGameId: id.nullable(),
    pages: z.number().int().min(1).max(100),
    complete: z.boolean(),
    warnings: z.array(z.string().max(300)).max(100),
    events: z
      .array(
        z
          .object({
            id,
            at: time,
            type: z.string().max(80),
            actorOsuId: id.nullable(),
            gameId: id.nullable(),
          })
          .strict(),
      )
      .max(10000),
    games: z.array(matchGameSchema).max(3000),
  })
  .strict();
export type MatchSource = z.infer<typeof matchSourceSchema>;
export type MatchGame = z.infer<typeof matchGameSchema>;
export type MatchScore = z.infer<typeof matchScoreSchema>;
export const gameDecisionSchema = z
  .object({
    gameId: id,
    included: z.boolean(),
    reason: z.string().trim().max(1000),
    complianceConfirmed: z.boolean(),
    substitutions: z
      .array(
        z
          .object({
            osuId: id,
            teamId: z.uuid(),
            reason: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
export type GameDecision = z.infer<typeof gameDecisionSchema>;
export type GamePreview = {
  game: MatchGame;
  players: (MatchScore & {
    teamId: string | null;
    evidence: "roster" | "substitution" | null;
  })[];
  colors: { blueTeamId: string | null; redTeamId: string | null };
  confidence: "roster" | "manual" | "unresolved";
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  tied: boolean;
  problems: string[];
  warnings: string[];
  decision: GameDecision | null;
};
export type SeriesOutcome = {
  homeWins: number;
  awayWins: number;
  tiedMaps: number;
  includedGames: number;
  winnerTeamId: string | null;
  draw: boolean;
  complete: boolean;
};
export type MatchImportPreview = {
  fixtureId: string;
  source: {
    matchId: number;
    title: string;
    fingerprint: string;
    complete: boolean;
    warnings: string[];
  };
  teams: { id: string; name: string }[];
  games: GamePreview[];
  series: SeriesOutcome;
  blockers: string[];
  canSubmit: boolean;
};

export type MatchContext = {
  fixture: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    status: string;
  };
  round: { scoringRules: unknown };
  teams: readonly {
    id: string;
    name: string;
    members: readonly { osuId: number; username: string }[];
  }[];
  pool: {
    fmMode: string | null;
    fmRestrictions: string;
    entries: readonly { beatmapId: number; category: string }[];
  } | null;
};
