"use client";
import { useEffect, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
type DesktopSession = {
  id: string;
  device_name: string;
  platform: string;
  expires_at: string;
  status: "active" | "expired" | "revoked";
};
export function DesktopSessions() {
  const tr = useAppTranslations();
  const [sessions, setSessions] = useState<DesktopSession[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    void fetch("/api/desktop/v1/auth/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const body = await response.json();
        if (!disposed) setSessions(body.data.sessions);
      })
      .catch(() => {
        if (!disposed) setError(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);
  async function revoke(id: string) {
    if (busy) return;
    setBusy(id);
    setError(false);
    try {
      const response = await fetch(`/api/desktop/v1/auth/sessions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw Error();
      setSessions((items) =>
        items.map((item) =>
          item.id === id ? { ...item, status: "revoked" } : item,
        ),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="panel form-stack">
      {loading && <p role="status">{tr("Loading desktop sessions…")}</p>}
      {error && (
        <p className="notice" role="alert">
          {tr("Desktop sessions could not be updated. Try again.")}
        </p>
      )}
      {!loading && !sessions.length && <p>{tr("No desktop sessions.")}</p>}
      {sessions.map((session) => (
        <article key={session.id} className="panel form-stack">
          <strong>{session.device_name}</strong>
          <span className="small muted">
            {session.platform} · {session.expires_at}
          </span>
          <span>
            {session.status === "active"
              ? tr("Active")
              : session.status === "revoked"
                ? tr("Revoked")
                : tr("Expired")}
          </span>
          {session.status === "active" && (
            <button
              type="button"
              className="secondary"
              disabled={busy !== null}
              onClick={() => void revoke(session.id)}
            >
              {busy === session.id
                ? tr("Revoking…")
                : tr("Revoke desktop session")}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
