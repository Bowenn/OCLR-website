"use client";
import { useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import styles from "./referee-panel.module.css";

export function RefereeIrc({
  draft,
  simulation,
  disabled,
  startSeconds,
  selectionLabel,
  onChange,
  onPrepare,
  onConfirm,
}: {
  draft: string;
  simulation: boolean;
  disabled: boolean;
  startSeconds: number;
  selectionLabel: string | null;
  onChange: (text: string) => void;
  onPrepare: (text: string) => void;
  onConfirm: () => Promise<boolean>;
}) {
  const tr = useAppTranslations();
  const [history, setHistory] = useState<
    { text: string; time: string; selection: string | null }[]
  >([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  async function submit() {
    if (
      inFlight.current ||
      disabled ||
      !simulation ||
      !draft.trim() ||
      /[\r\n\u0000]/.test(draft)
    )
      return;
    inFlight.current = true;
    setSending(true);
    setError(false);
    const text = draft,
      selection = selectionLabel;
    try {
      if (!(await onConfirm())) {
        setError(true);
        return;
      }
      setHistory((items) => [
        ...items,
        {
          text,
          selection,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);
      requestAnimationFrame(() =>
        log.current?.scrollTo({ top: log.current.scrollHeight }),
      );
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  return (
    <aside className={`panel ${styles.irc}`} aria-label={tr("IRC console")}>
      <header>
        <h2>{"IRC"}</h2>
        <span className="badge">
          {simulation ? tr("Simulation only") : tr("IRC not connected")}
        </span>
      </header>
      <p className="small muted">
        {tr("No real IRC connection. Simulated sends do not reach osu!.")}
      </p>
      <div
        className={styles.ircLog}
        role="log"
        aria-label={tr("Simulated IRC history")}
        ref={log}
      >
        {!history.length && (
          <p className="muted">
            {tr("Choose a command or pool map on the left.")}
          </p>
        )}
        {history.map((line, index) => (
          <div className={styles.ircMessage} key={index}>
            <time>{line.time}</time>
            <code>{line.text}</code>
            <small>
              {tr("Simulation confirmed")}
              {line.selection ? ` · ${line.selection}` : ""}
            </small>
          </div>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className={styles.ircComposer}
      >
        {selectionLabel && (
          <p className="small" role="status">
            {tr("Pending: {value0}", { value0: selectionLabel })}
          </p>
        )}
        <label htmlFor="referee-irc-input">{tr("IRC command")}</label>
        <input
          id="referee-irc-input"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          disabled={disabled || sending}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="submit"
          disabled={disabled || sending || !simulation || !draft.trim()}
        >
          {sending ? tr("Sending…") : tr("Simulate send")}
        </button>
        {error && (
          <p role="alert">
            {tr(
              "Command not confirmed. Check the current BP step and try again.",
            )}
          </p>
        )}
      </form>
      <footer className={styles.ircQuick} aria-label={tr("Quick commands")}>
        {[30, 60, 120].map((seconds) => (
          <button
            key={seconds}
            type="button"
            className="secondary"
            disabled={disabled || sending}
            onClick={() => onPrepare(`!mp timer ${seconds}`)}
          >
            {seconds}s
          </button>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={disabled || sending}
          onClick={() => onPrepare(`!mp start ${startSeconds}`)}
        >
          {`!mp start ${startSeconds}`}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={disabled || sending}
          onClick={() => onPrepare("!mp aborttimer")}
        >
          {"!mp aborttimer"}
        </button>
      </footer>
    </aside>
  );
}
