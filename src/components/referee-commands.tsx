"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./referee-commands.module.css";
import { useAppTranslations } from "@/i18n/shared";
import {
  copyRefereeCommand,
  refereeCommands,
  refereeSettingsSchema,
  type RefereeCommand,
  type RefereeCommandInput,
  type RefereeSettings,
} from "@/lib/referee-commands";

function CommandLine({
  command,
  compact = false,
}: {
  command: RefereeCommand;
  compact?: boolean;
}) {
  const tr = useAppTranslations();
  const text = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "manual"
  >("idle");
  const labels = {
    make: tr("Create room"),
    set: tr("Room rules"),
    addref: tr("Add Streamer to room"),
    invite: tr("Invite player"),
    timer: tr("Timer"),
    map: tr("Change beatmap"),
    mods: tr("Set Mods"),
    start: tr("Start countdown"),
    abort: tr("Abort game"),
  };
  const reasons: Record<string, string> = {
    "Configure Mods compatible with the round ruleset.": tr(
      "Configure Mods compatible with the round ruleset.",
    ),
    "Enter a valid room name.": tr("Enter a valid room name."),
    "Configure the round rules and room size first.": tr(
      "Configure the round rules and room size first.",
    ),
    "Enter a valid osu! username for the Streamer.": tr(
      "Enter a valid osu! username for the Streamer.",
    ),
    "This player's saved UID is missing.": tr(
      "This player's saved UID is missing.",
    ),
    "Choose a positive timer duration.": tr(
      "Choose a positive timer duration.",
    ),
    "Select a saved pool map and configure the ruleset first.": tr(
      "Select a saved pool map and configure the ruleset first.",
    ),
    "Configure this pool category's Mods policy first.": tr(
      "Configure this pool category's Mods policy first.",
    ),
    "Configure the independent start countdown first.": tr(
      "Configure the independent start countdown first.",
    ),
  };
  const label = command.teamName
    ? `${command.teamName} · ${command.playerName || labels[command.kind]}`
    : labels[command.kind];
  async function copy() {
    if (!command.text) return;
    setStatus("copying");
    const next = await copyRefereeCommand(command.text, navigator.clipboard);
    setStatus(next);
    if (next === "copied") setCopied(true);
    if (next === "manual") {
      requestAnimationFrame(() => {
        text.current?.focus();
        text.current?.select();
      });
    }
  }
  return (
    <div
      className={`${styles.command} ${compact ? styles.compactCommand : ""}`}
    >
      <div className={styles.commandField}>
        <span>{label}</span>
        {command.text ? (
          compact && status !== "manual" ? (
            <code className={styles.inlineCommand}>{command.text}</code>
          ) : (
            <textarea
              ref={text}
              aria-label={label}
              value={command.text}
              readOnly
              rows={command.kind === "make" ? 2 : 1}
              spellCheck={false}
              className={styles.commandText}
              onFocus={(event) => event.currentTarget.select()}
            />
          )
        ) : (
          <span className="small muted">
            {reasons[command.reason ?? ""] ?? tr("Command unavailable.")}
          </span>
        )}
      </div>
      <div className={styles.copyAction}>
        <button
          type="button"
          className={compact ? styles.iconCopy : "secondary"}
          data-copied={copied}
          title={copied ? tr("Copied") : tr("Copy command")}
          disabled={!command.text || status === "copying"}
          onClick={copy}
          aria-label={tr("Copy {value0}", { value0: label })}
        >
          {compact ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
            </svg>
          ) : status === "copying" ? (
            tr("Copying…")
          ) : status === "copied" ? (
            tr("Copied")
          ) : (
            tr("Copy command")
          )}
        </button>
        <span
          className={`small muted ${styles.copyStatus} ${compact && status !== "manual" ? "sr-only" : ""}`}
          role="status"
        >
          {status === "copied"
            ? tr("Copied. Execute this command yourself in osu!.")
            : status === "manual"
              ? tr(
                  "Clipboard unavailable. Select the command and copy it manually.",
                )
              : ""}
        </span>
      </div>
    </div>
  );
}

/** Parent keys this editor by saved session revision after successful saves/reloads. */
export function RefereeCommands({
  settings,
  policy,
  rules,
  teams,
  selectedMap,
  onSave,
  canRecord,
  busy = false,
  mapSelector,
  stage,
  draft: controlledDraft,
  onDraftChange,
}: RefereeCommandInput & {
  onSave: (settings: RefereeSettings) => void | Promise<void>;
  canRecord: boolean;
  busy?: boolean;
  mapSelector?: ReactNode;
  stage?: "preparation" | "play";
  draft?: RefereeSettings;
  onDraftChange?: (settings: RefereeSettings) => void;
}) {
  const tr = useAppTranslations();
  const id = useId();
  const [localDraft, setLocalDraft] = useState(settings);
  const draft = controlledDraft ?? localDraft;
  const setDraft = (value: RefereeSettings) => {
    if (onDraftChange) onDraftChange(value);
    else setLocalDraft(value);
  };
  const [error, setError] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(settings);
  const commands = refereeCommands({
    settings: draft,
    policy,
    rules,
    teams,
    selectedMap,
  });
  const live = commands.filter((command) =>
    ["timer", "map", "mods", "start", "abort"].includes(command.kind),
  );
  const modules = [
    {
      title: tr("Room creation and rules"),
      kinds: ["make", "set"],
      hint: tr(
        "Send make to BanchoBot to create the room, then set its team mode, scoring and capacity.",
      ),
    },
    {
      title: tr("Players and room staff"),
      kinds: ["addref", "invite"],
      hint: tr(
        "The room creator adds the Streamer as a referee. Invite every player from both saved rosters by UID, including substitutes.",
      ),
    },
    {
      title: tr("Map and Mods"),
      kinds: ["map", "mods"],
      hint: tr(
        "Choose a pool map, then copy both map and Mods commands. Mods include this round's NF and Freemod settings.",
      ),
    },
    {
      title: tr("Timers and start"),
      kinds: ["timer", "start"],
      hint: tr(
        "Timer starts a preparation countdown. Start begins the game after its separate countdown.",
      ),
    },
    {
      title: tr("Game interruption"),
      kinds: ["abort"],
      hint: tr(
        "Abort stops the game in osu!. Record the actual outcome or replay separately in the BP stage.",
      ),
    },
  ];
  const integer = (value: string) => (value === "" ? null : Number(value));
  const update = <K extends keyof RefereeSettings>(
    key: K,
    value: RefereeSettings[K],
  ) => setDraft({ ...draft, [key]: value });
  async function save() {
    const parsed = refereeSettingsSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        tr(
          "Use single-line names, a room size from 1 to 16 and positive whole seconds.",
        ),
      );
      return;
    }
    setError("");
    try {
      await onSave(parsed.data);
    } catch {
      setError(
        tr("Command settings could not be saved. Your changes are still here."),
      );
    }
  }
  const numberField = (
    key: "timerSeconds" | "startSeconds" | "roomSize",
    label: string,
    max?: number,
  ) => (
    <label className={styles.field} htmlFor={`${id}-${key}`}>
      {label}
      <input
        id={`${id}-${key}`}
        type="number"
        min={1}
        max={max}
        step={1}
        value={draft[key] ?? ""}
        disabled={!canRecord || busy}
        onChange={(event) => update(key, integer(event.target.value))}
      />
    </label>
  );
  return (
    <section
      className={`panel ${styles.assistant}`}
      aria-label={
        stage === "preparation" ? tr("Command list") : tr("Current commands")
      }
    >
      <div>
        <h3>
          {stage === "preparation"
            ? tr("Command list")
            : tr("Current commands")}
        </h3>
        {stage !== "preparation" && (
          <p className="small muted">
            {tr(
              "Copy commands here, then execute them in osu!. Copying never records a Ban, Pick or game result.",
            )}
          </p>
        )}
      </div>
      {stage !== "play" && (
        <>
          <div className={styles.modules}>
            {modules.map((module) => (
              <section
                className={styles.commandModule}
                key={module.title}
                aria-label={module.title}
              >
                <h4>{module.title}</h4>
                <div className={styles.moduleColumns}>
                  <div className={styles.commandList}>
                    {commands
                      .filter((command) => module.kinds.includes(command.kind))
                      .map((command) => (
                        <CommandLine
                          key={`${command.id}:${command.text}`}
                          command={command}
                          compact
                        />
                      ))}
                  </div>
                  <div className={styles.commandHint}>
                    <p>{module.hint}</p>
                    {module.kinds.includes("map") && mapSelector}
                  </div>
                </div>
              </section>
            ))}
          </div>
          <details className={styles.setupSettings}>
            <summary>{tr("Edit room settings")}</summary>
            <div className={styles.stack}>
              <label className={styles.field} htmlFor={`${id}-room`}>
                {tr("Room name")}
                <input
                  id={`${id}-room`}
                  value={draft.roomName}
                  maxLength={200}
                  disabled={!canRecord || busy}
                  onChange={(event) => update("roomName", event.target.value)}
                />
              </label>
              <p className="small muted">
                {tr(
                  "!mp make creates a new room. Send it to BanchoBot. To rename an existing room, use !mp name instead.",
                )}
              </p>
              {numberField("timerSeconds", tr("Timer seconds"))}
              {numberField("startSeconds", tr("Start countdown seconds"))}
              {numberField(
                "roomSize",
                tr("Room slots (not players per team)"),
                16,
              )}
              {rules && (
                <p className="small muted">
                  {tr("Players per team: {value0}", {
                    value0: rules.playersPerTeam,
                  })}{" "}
                  ·{" "}
                  {rules.teamType === "team-vs"
                    ? tr("Team Vs")
                    : tr("Head To Head")}{" "}
                  · {rules.scoringType === "scorev2" ? "Score V2" : "Score"}
                </p>
              )}
              <label className={styles.field} htmlFor={`${id}-streamer`}>
                {tr("Streamer osu! username")}
                <input
                  id={`${id}-streamer`}
                  value={draft.streamerUsername}
                  maxLength={50}
                  disabled={!canRecord || busy}
                  onChange={(event) =>
                    update("streamerUsername", event.target.value)
                  }
                />
              </label>
              <p className="small muted">
                {tr(
                  "Only the room creator can execute !mp addref. It grants osu! room controls and does not change website roles.",
                )}
              </p>
            </div>
          </details>
        </>
      )}

      {stage !== "preparation" && (
        <>
          {mapSelector}
          <div className={styles.timers}>
            {numberField("timerSeconds", tr("Timer seconds"))}
            {numberField("startSeconds", tr("Start countdown seconds"))}
            <div className={`actions ${styles.presets}`}>
              {(
                [
                  ["banSeconds", tr("Ban timer")],
                  ["pickSeconds", tr("Pick timer")],
                  ["prepareSeconds", tr("Preparation timer")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="secondary"
                  disabled={!canRecord || busy || !policy?.[key]}
                  onClick={() => update("timerSeconds", policy?.[key] ?? null)}
                >
                  {label}
                  {policy?.[key] ? ` · ${policy[key]}s` : ""}
                </button>
              ))}
            </div>
            <p className={`small muted ${styles.timerHint}`}>
              {tr(
                "The start countdown is independent of the Ban, Pick and preparation timers.",
              )}
            </p>
          </div>
          {changed && (
            <p className="small" role="status">
              {tr(
                "Unsaved command settings. Command previews use the values shown here.",
              )}
            </p>
          )}
          <div className={styles.stack}>
            {live.map((command) => (
              <CommandLine
                key={`${command.id}:${command.text}`}
                command={command}
              />
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {canRecord && (stage !== "preparation" || changed) && (
        <div className="actions">
          <button type="button" disabled={busy || !changed} onClick={save}>
            {tr("Save command settings")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || !changed}
            onClick={() => {
              setDraft(settings);
              setError("");
            }}
          >
            {tr("Discard unsaved settings")}
          </button>
        </div>
      )}
    </section>
  );
}
