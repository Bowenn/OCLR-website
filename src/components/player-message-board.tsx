"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useAppTranslations } from "@/i18n/shared";
import type { PlayerMessage } from "@/lib/player-messages";
export function PlayerMessageBoard({
  edition,
  playerId,
  name,
  signedIn,
}: {
  edition: string;
  playerId: number;
  name: string;
  signedIn: boolean;
}) {
  const tr = useAppTranslations();
  const id = useId();
  const [messages, setMessages] = useState<PlayerMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const endpoint = `/api/tournaments/${edition}/players/${playerId}/messages`;
  const loadError = tr(
    "Messages could not be loaded. Please refresh to try again.",
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setMessages(await response.json());
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(loadError);
      });
    return () => controller.abort();
  }, [endpoint, loadError]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, requestId: requestId.current }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error);
        return;
      }
      setText("");
      requestId.current = null;
      const latest = await fetch(endpoint);
      if (!latest.ok) throw new Error();
      setMessages(await latest.json());
    } catch {
      setError(tr("This request could not be completed. Please try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="event-message-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr("Messages for {name}", { name })}
        aria-live="polite"
      >
        {messages.length ? (
          messages.map((message) => (
            <div key={message.id}>
              <a href={`https://osu.ppy.sh/users/${message.authorId}`}>
                <strong>{message.author}</strong>
              </a>
              <time className="small muted" dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString(tr.locale)}
              </time>
              <p className="preserve-lines">{message.text}</p>
            </div>
          ))
        ) : (
          <p>—</p>
        )}
      </div>
      {signedIn ? (
        <form className="player-message-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={id}>
            {tr("Leave a signed message for {name}", { name })}
          </label>
          <textarea
            id={id}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              requestId.current = null;
            }}
            maxLength={1000}
            rows={2}
            required
            disabled={busy}
          />
          <button disabled={busy || !text.trim()}>
            {busy ? tr("Saving…") : tr("Post message")}
          </button>
        </form>
      ) : (
        <Link className="text-link small" href="/login">
          {tr("Sign in with osu! to leave a signed message")}
        </Link>
      )}
      {error && (
        <p className="notice small" role="alert">
          {tr(error)}
        </p>
      )}
    </>
  );
}
