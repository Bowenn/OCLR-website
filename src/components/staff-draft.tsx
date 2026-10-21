"use client";

import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import type { StaffDraft } from "@/lib/draft";
import type { DraftBoard, DraftTeam } from "@/lib/draft-types";
import { usePoll } from "./use-poll";
import { DraftPick } from "./draft-pick";
import { ConfirmMutation } from "./confirm-mutation";
import { DraftOrderEditor } from "./draft-order-editor";
import { DraftBoardView } from "./draft-board";
function Controls({ slug, data }: { slug: string; data: StaffDraft }) {
  const tr = useAppTranslations();

  const state = data.session?.state ?? "setup";
  const version = data.session?.version ?? 0;
  const allowed = [
    ...(state === "ready" ? ["start"] : []),
    ...(state === "live" ? ["pause"] : []),
    ...(state === "paused"
      ? ["resume", ...(data.session?.turnIndex ? ["undo"] : [])]
      : []),
    ...(state === "completed" ? ["finalize", "undo"] : []),
    ...(["setup", "ready", "paused", "completed"].includes(state) &&
    data.session
      ? ["abort"]
      : []),
    ...(state === "aborted" ? ["recover"] : []),
    ...(state !== "setup" && !data.session?.publicSnapshot ? ["publish"] : []),
  ];
  const labels: Record<string, string> = {
    ready: "Freeze draft setup",
    start: "Start & release draft",
    pause: "Pause draft",
    resume: "Resume draft",
    undo: "Void last pick",
    finalize: "Finalize rosters",
    abort: "Abort draft",
    recover: "Reopen setup",
    publish: "Release draft board",
  };
  function actionPayload(action: string) {
    return {
      command: { action },
      expectedVersion: version,
      confirmed: true,
    };
  }
  return (
    <section className="panel form-stack">
      <h2>{tr("Staff controls")}</h2>

      {state === "setup" && <DraftOrderEditor slug={slug} data={data} />}
      <div className="actions">
        {allowed.map((action) => (
          <ConfirmMutation
            key={action}
            requireConfirmation={!["pause", "resume"].includes(action)}
            label={labels[action]}
            title={`${tr(labels[action])}?`}
            description={
              action === "publish"
                ? tr(
                    "Release the current approved captain/team state and committed picks. Remaining pool is shown only when separately approved. This does not create a pick.",
                  )
                : action === "abort"
                  ? tr(
                      "Stop the draft. Committed picks are retained; no further picks are accepted until recovery.",
                    )
                  : action === "undo"
                    ? tr(
                        "Void the last pick and remove that player from the roster. Later turns may need review.",
                      )
                    : action === "finalize"
                      ? tr(
                          "Finalize the drafted rosters. Normal roster edits will be locked.",
                        )
                      : action === "start"
                        ? tr(
                            "Release this approved draft and start the captain turns. Confirmed picks and turn changes will appear live. Only the active captain can pick.",
                          )
                        : tr(
                            "Reopen draft setup. Review the existing order and rosters before freezing again.",
                          )
            }
            url={`/api/admin/tournaments/${slug}/draft`}
            payload={actionPayload(action)}
          />
        ))}
      </div>
    </section>
  );
}
export function StaffDraftRoom({
  slug,
  initial,
}: {
  slug: string;
  initial: StaffDraft;
}) {
  const tr = useAppTranslations();

  const [feedback, setFeedback] = useState<{
    message: string;
    version: number;
  } | null>(null);
  const { value: data, connected } = usePoll<StaffDraft>(
    `/api/admin/tournaments/${slug}/draft`,
    initial,
  );
  if (!data)
    return (
      <p className="notice" role="alert">
        {tr(
          "Staff access is unavailable. Sign in again or contact the organizer.",
        )}
      </p>
    );
  const session = data.session;
  const teamMap = new Map<string, DraftTeam>(
    data.teams.map((t) => [
      t.team.id,
      {
        id: t.team.id,
        name: t.team.name,
        captain: { osuId: t.team.captainId, username: t.captainName },
      },
    ]),
  );
  const currentTeam = session
    ? teamMap.get(session.turnSequence[session.turnIndex])
    : undefined;
  const preview: DraftBoard | null = session
    ? {
        sessionId: session.id,
        version: session.version,
        state: session.state,
        turnIndex: session.turnIndex,
        turnCount: session.turnSequence.length,
        activeTeam: currentTeam ?? null,
        picks: data.picks
          .filter((p) => !p.voidedAt)
          .map((p) => ({
            id: p.id,
            turnIndex: p.turnIndex,
            team: teamMap.get(p.teamId)!,
            player: data.identities.find((u) => u.osuId === p.playerId)!,
          })),
        rosters: data.teams.map((t) => ({
          team: teamMap.get(t.team.id)!,
          players: data.members
            .filter((m) => m.membership.teamId === t.team.id)
            .map((m) => ({ osuId: m.membership.userId, username: m.username })),
        })),
        pool: null,
      }
    : null;
  const canPick = Boolean(
    connected && session?.state === "live" && Boolean(session.publicSnapshot),
  );
  return (
    <>
      <p role="status" className="connection-state small">
        {connected
          ? tr("Connected · updates every 2s")
          : tr("Reconnecting · actions may be stale")}
      </p>
      {feedback && feedback.version === session?.publicVersion && (
        <p className="notice" role="status">
          {tr(feedback.message)}
        </p>
      )}
      {session && session.state !== "setup" && (
        <>
          {currentTeam && session && (
            <DraftPick
              key={`pick:${session.id}:${session.version}`}
              slug={slug}
              sessionId={session.id}
              revision={session.version}
              turnIndex={session.turnIndex}
              team={currentTeam}
              players={
                preview?.rosters.find((r) => r.team.id === currentTeam.id)
                  ?.players ?? []
              }
              capacity={
                data.teams.find((t) => t.team.id === currentTeam.id)?.team
                  .capacity
              }
              unavailableMessage={
                !connected
                  ? "Reconnecting. Wait for the authoritative snapshot."
                  : "Picking is available during a released live turn."
              }
              pool={data.availablePool}
              staff
              enabled={canPick}
              onFeedback={(message) =>
                setFeedback({ message, version: session.publicVersion })
              }
            />
          )}
          <h2 className="section-space">{tr("Staff preview")}</h2>
          <p className="muted small">
            {tr(
              "Private operational state. This preview is not the public broadcast.",
            )}
          </p>
          {preview && <DraftBoardView board={preview} privatePreview />}
        </>
      )}
      <Controls
        key={`controls:${session?.id ?? "new"}:${session?.version ?? 0}:${data.edition?.setupVersion}`}
        slug={slug}
        data={data}
      />
    </>
  );
}
