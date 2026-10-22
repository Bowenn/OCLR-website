export type DraftState =
  "setup" | "ready" | "live" | "paused" | "completed" | "finalized" | "aborted";
export type DraftIdentity = {
  osuId: number;
  username: string;
  // Optional read-time overlay projection. Older persisted snapshots remain valid.
  profile?: {
    avatarUrl: string | null;
    pp: number | null;
    globalRank: number | null;
    status: "loading" | "fresh" | "unavailable";
    fetchedAt: string | null;
  };
};
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
  // Optional for snapshots published before roster capacity was included.
  capacities?: Record<string, number | null>;
  engineRevision: number;
  turnSequence: string[];
  eligiblePool: DraftIdentity[];
};
