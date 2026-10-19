export type DraftState =
  "setup" | "ready" | "live" | "paused" | "completed" | "finalized" | "aborted";
export type DraftIdentity = { osuId: number; username: string };
export type DraftTeam = { id: string; name: string; captain: DraftIdentity };
export type DraftBoard = {
  sessionId: string;
  version: number;
  state: DraftState;
  turnIndex: number;
  turnCount: number;
  activeTeam: DraftTeam | null;
  picks: {
    id: string;
    turnIndex: number;
    team: DraftTeam;
    player: DraftIdentity;
  }[];
  rosters: { team: DraftTeam; players: DraftIdentity[] }[];
  pool: DraftIdentity[] | null;
};
export type CaptainBoard = DraftBoard & {
  engineRevision: number;
  eligiblePool: DraftIdentity[];
};
