"use client";

import { useEffect, useRef } from "react";
import type { DraftBoard } from "@/lib/draft-types";
import { draftLabels } from "./draft-board";
import { usePoll } from "./use-poll";
import styles from "./broadcast-draft.module.css";

// Retractions always clear the display. A delayed older snapshot must not rewind it.
export function acceptBroadcastSnapshot(
  current: DraftBoard | null,
  next: DraftBoard | null,
) {
  return (
    !current ||
    !next ||
    current.sessionId !== next.sessionId ||
    next.version >= current.version
  );
}

export function shouldRevealPick(
  previous: DraftBoard | null,
  next: DraftBoard | null,
) {
  const latest = next?.picks.at(-1);
  return Boolean(
    previous &&
    next &&
    latest &&
    previous.sessionId === next.sessionId &&
    next.version > previous.version &&
    !previous.picks.some((pick) => pick.id === latest.id),
  );
}

export function BroadcastDraft({
  slug,
  name,
  initial,
  available,
  background,
}: {
  slug: string;
  name: string;
  initial: DraftBoard | null;
  available: boolean;
  background: "opaque" | "transparent";
}) {
  const { value: board, connected } = usePoll<DraftBoard>(
    `/api/tournaments/${slug}/draft`,
    initial,
    {
      accept: acceptBroadcastSnapshot,
      credentials: "omit",
      initiallyConnected: available,
    },
  );
  const previous = useRef(initial);
  const spotlight = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      shouldRevealPick(previous.current, board) &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      spotlight.current?.animate(
        [
          { transform: "translateY(10px)", boxShadow: "inset 4px 0 #efa5ff" },
          { transform: "translateY(0)", boxShadow: "inset 4px 0 #a55bcc" },
        ],
        { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
    previous.current = board;
  }, [board]);
  const latest = board?.picks.at(-1);
  const complete = board?.state === "completed" || board?.state === "finalized";
  return (
    <div
      className={styles.broadcast}
      data-broadcast
      data-background={background}
    >
      <header className={styles.header}>
        <div className={styles.brand}>
          OCLR<span>osu! Chinese League Rookie</span>
        </div>
        <div className={styles.heading}>
          <p className="eyebrow">CAPTAIN DRAFT</p>
          <h1>{name}</h1>
        </div>
        <div className={styles.status}>
          <strong data-state={board?.state ?? "waiting"}>
            {board ? draftLabels[board.state] : "Awaiting published draft"}
          </strong>
          <p role="status">
            {connected
              ? "Connected · updates every 2s"
              : "Reconnecting · last published state"}
          </p>
        </div>
      </header>

      <div className={styles.stage}>
        <section
          className={styles.selection}
          ref={spotlight}
          aria-label="Latest published selection"
        >
          <p className="eyebrow">
            {latest
              ? `PICK ${String(latest.turnIndex + 1).padStart(2, "0")} / SELECTED`
              : "THE NEXT TEAM STORY"}
          </p>
          <div aria-live="polite" aria-atomic="true">
            <h2>{latest?.player.username ?? "The stage is ready."}</h2>
            {latest ? (
              <>
                <p className={styles.destination}>{latest.team.name}</p>
                <p className={styles.caption}>
                  Selected by Captain {latest.team.captain.username}
                </p>
              </>
            ) : (
              <p className={styles.caption}>
                Selections appear here when published.
              </p>
            )}
          </div>
        </section>
        <section
          className={styles.turn}
          aria-label="Current published captain turn"
        >
          <p className="eyebrow">
            {complete
              ? "DRAFT COMPLETE"
              : board?.state === "paused"
                ? "ON HOLD"
                : "CURRENT TURN"}
          </p>
          <h2>
            {board?.activeTeam?.name ??
              (complete ? "Teams assembled." : "Waiting for the next stage.")}
          </h2>
          {board?.activeTeam && (
            <p className={styles.caption}>
              Captain {board.activeTeam.captain.username}
            </p>
          )}
          <div className={styles.progress}>
            <span>
              {board?.turnCount
                ? `${Math.min(board.turnIndex + (complete ? 0 : 1), board.turnCount)} / ${board.turnCount}`
                : "—"}
            </span>
            <p>
              {complete
                ? "Configured picks completed"
                : "Configured pick order"}
            </p>
          </div>
        </section>
      </div>

      <div className={styles.details}>
        <section
          className={styles.rosters}
          aria-label="Published roster progress"
          tabIndex={0}
        >
          <h2>
            Team rosters <span>Published draft progress</span>
          </h2>
          {board?.rosters.length ? (
            <div className={styles.rosterGrid}>
              {board.rosters.map(({ team, players }) => (
                <article
                  key={team.id}
                  data-active={board.activeTeam?.id === team.id}
                >
                  <h3>{team.name}</h3>
                  <p className={styles.caption}>
                    Captain {team.captain.username}
                  </p>
                  <p className={styles.count}>
                    {players.length}{" "}
                    {players.length === 1 ? "player" : "players"}
                  </p>
                  <ul>
                    {players.map((player) => (
                      <li key={player.osuId}>
                        <span>{player.username}</span>
                        {player.osuId === team.captain.osuId && (
                          <small>Captain</small>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.caption}>
              Team rosters have not been published.
            </p>
          )}
        </section>
        <section
          className={styles.history}
          aria-label="Recent published selections"
          tabIndex={0}
        >
          <h2>Recent picks</h2>
          {board?.picks.length ? (
            <ol>
              {board.picks
                .slice(-5)
                .reverse()
                .map((pick) => (
                  <li key={pick.id}>
                    <span className={styles.pickNumber}>
                      {String(pick.turnIndex + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{pick.player.username}</strong>
                      <p>
                        {pick.team.name} · Captain {pick.team.captain.username}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          ) : (
            <p className={styles.caption}>No selections published yet.</p>
          )}
        </section>
      </div>
      <footer className={styles.footer}>
        <span>INDIVIDUAL ENTRY. CAPTAIN DRAFT. TEAM COMPETITION.</span>
        <span>Published selections only</span>
      </footer>
    </div>
  );
}
