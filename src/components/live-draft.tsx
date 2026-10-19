"use client";
import { useState } from "react";
import type { CaptainBoard, DraftBoard } from "@/lib/draft-types";
import { usePoll } from "./use-poll";
import { DraftBoardView } from "./draft-board";
import { DraftPick } from "./draft-pick";
import { EmptyState } from "./ui";
export function LiveDraft({
  slug,
  initial,
  captainId,
  presenter = false,
}: {
  slug: string;
  initial: DraftBoard | CaptainBoard | null;
  captainId?: number;
  presenter?: boolean;
}) {
  const [feedback, setFeedback] = useState<{
    message: string;
    version: number;
  } | null>(null);
  const endpoint = `/api/tournaments/${slug}/draft${captainId ? "/captain" : ""}`;
  const { value: board, connected } = usePoll<DraftBoard | CaptainBoard>(
    endpoint,
    initial,
  );
  const canPick = Boolean(
    captainId &&
    board?.state === "live" &&
    board.activeTeam?.captain.osuId === captainId &&
    connected &&
    "eligiblePool" in board,
  );
  return (
    <div className={presenter ? "presenter-view" : ""}>
      <div className="section-title">
        <p className="eyebrow">
          OCLR / {captainId ? "CAPTAIN DRAFT ROOM" : "LIVE DRAFT"}
        </p>
        <p className="connection-state small" role="status">
          {connected
            ? "Connected · updates every 2s"
            : "Reconnecting · showing last published state"}
        </p>
      </div>
      {feedback && board && feedback.version === board.version && (
        <p className="notice" role="status">
          {feedback.message}
        </p>
      )}
      {board ? (
        <>
          {captainId && "eligiblePool" in board && (
            <p className="muted small">
              Your configured turns:{" "}
              {(board.turnSequence ?? [])
                .flatMap((teamId, index) =>
                  board.rosters.some(
                    (r) =>
                      r.team.id === teamId &&
                      r.team.captain.osuId === captainId,
                  )
                    ? [index + 1]
                    : [],
                )
                .join(", ") || "None"}
              .
            </p>
          )}
          <DraftBoardView board={board} />
          {captainId && !canPick && "eligiblePool" in board && (
            <section className="section-space" aria-label="Eligible draft pool">
              <h2>Eligible draft pool</h2>
              <p className="muted small">
                Read-only while you wait for your turn. This is the last
                published captain snapshot.
              </p>
              <ul className="public-pool">
                {board.eligiblePool.map((p) => (
                  <li key={p.osuId}>
                    {p.username} ({p.osuId})
                  </li>
                ))}
              </ul>
            </section>
          )}
          {captainId && (
            <section className="section-space">
              {canPick && board.activeTeam && "eligiblePool" in board ? (
                <DraftPick
                  key={`${board.sessionId}:${board.engineRevision}`}
                  slug={slug}
                  sessionId={board.sessionId}
                  revision={board.engineRevision}
                  turnIndex={board.turnIndex}
                  team={board.activeTeam}
                  pool={board.eligiblePool}
                  staff={false}
                  enabled={canPick}
                  onFeedback={(message) =>
                    setFeedback({ message, version: board.version })
                  }
                />
              ) : (
                <p className="notice">
                  {board.state === "live"
                    ? "Waiting for your published captain turn."
                    : "Picking is unavailable in the current published state."}
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <EmptyState title="Draft awaiting publication">
          No draft board is published for this edition. Check the tournament
          announcements.
        </EmptyState>
      )}
    </div>
  );
}
