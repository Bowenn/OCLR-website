"use client";

import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import type { CaptainBoard, DraftBoard } from "@/lib/draft-types";
import { usePoll } from "./use-poll";
import { DraftBoardView } from "./draft-board";
import { DraftPick } from "./draft-pick";
import { Action, EmptyState } from "./ui";
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
  const tr = useAppTranslations();

  const [feedback, setFeedback] = useState<{
    message: string;
    version: number;
  } | null>(null);
  const endpoint = `/api/tournaments/${slug}/draft${captainId ? "/captain" : ""}`;
  const {
    value: board,
    connected,
    authorizationLost,
  } = usePoll<DraftBoard | CaptainBoard>(endpoint, initial);
  const canPick = Boolean(
    captainId &&
    board?.state === "live" &&
    board.activeTeam?.captain.osuId === captainId &&
    connected &&
    "eligiblePool" in board,
  );
  if (authorizationLost)
    return (
      <section className="panel" role="alert">
        <h2>{tr("Sign-in or captain access changed.")}</h2>
        <p className="muted">
          {tr(
            "Your session may have expired. Sign in again; captain appointments are managed by the organizer.",
          )}
        </p>
        <Action href="/login">{tr("Sign in again")}</Action>
      </section>
    );
  return (
    <div className={presenter ? "presenter-view" : ""}>
      <div className={captainId ? "draft-room-connection" : "section-title"}>
        {!captainId && <p className="eyebrow">{tr("OCLR / LIVE DRAFT")}</p>}
        <p className="connection-state small" role="status">
          {connected
            ? tr("Connected · updates every 2s")
            : tr("Reconnecting · showing last published state")}
        </p>
      </div>
      {feedback && board && feedback.version === board.version && (
        <p className="notice" role="status">
          {tr(feedback.message)}
        </p>
      )}
      {board ? (
        <>
          {captainId && "eligiblePool" in board && (
            <p className="muted small">
              {tr("Your configured turns:")}{" "}
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
                .join(", ") || tr("None")}
              .
            </p>
          )}
          {captainId && "eligiblePool" in board ? (
            (() => {
              const own = board.rosters.find(
                (r) => r.team.captain.osuId === captainId,
              );
              return own ? (
                <>
                  <p className="draft-room-turn">
                    <span className="badge">{board.state}</span>{" "}
                    {board.activeTeam
                      ? `Pick ${board.turnIndex + 1} of ${board.turnCount} · Captain ${board.activeTeam.captain.username}`
                      : "No active turn"}
                  </p>
                  <DraftPick
                    key={`${board.sessionId}:${board.engineRevision}:${board.version}:${own.team.id}`}
                    slug={slug}
                    sessionId={board.sessionId}
                    revision={board.engineRevision}
                    turnIndex={board.turnIndex}
                    team={own.team}
                    players={own.players}
                    capacity={board.capacities?.[own.team.id]}
                    pool={board.eligiblePool}
                    staff={false}
                    enabled={canPick}
                    unavailableMessage={
                      !connected
                        ? "Reconnecting. Selection is unavailable until the snapshot refreshes."
                        : board.state === "live"
                          ? "Waiting for your turn."
                          : "Picking is unavailable in the current published state."
                    }
                    onFeedback={(message) =>
                      setFeedback({ message, version: board.version })
                    }
                  />
                  <details className="section-space">
                    <summary>
                      {tr("Published draft board and pick history")}
                    </summary>
                    <DraftBoardView board={{ ...board, pool: null }} />
                  </details>
                </>
              ) : (
                <p className="notice">
                  {tr("Your team is awaiting publication.")}
                </p>
              );
            })()
          ) : (
            <DraftBoardView board={board} />
          )}
        </>
      ) : (
        <EmptyState title={tr("Draft awaiting publication")}>
          {tr(
            "No draft board is published for this edition. Check the tournament announcements.",
          )}
        </EmptyState>
      )}
    </div>
  );
}
