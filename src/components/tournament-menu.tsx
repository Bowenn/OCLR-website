"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
type EditionLink = { slug: string; name: string; season: string | null };
export function TournamentMenu({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: () => void;
}) {
  const tr = useAppTranslations();
  const [open, setOpen] = useState(false);
  const [editions, setEditions] = useState<EditionLink[] | null>(null);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // Request only on opening; no database/provider reads for unrelated header renders.
    fetch("/api/tournaments?navigation=1", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((rows: EditionLink[]) => {
        if (controller.signal.aborted) return;
        setEditions(rows);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      controller.abort();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function navigate() {
    setOpen(false);
    onNavigate();
  }
  return (
    <div
      className="header-tournaments"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <div className="tournament-menu-heading">
        <Link
          href="/tournaments"
          aria-current={
            path === "/tournaments" || path.startsWith("/tournaments/")
              ? "page"
              : undefined
          }
          onClick={navigate}
        >
          {tr("Tournaments")}
        </Link>
        <button
          className="tournament-menu-trigger"
          type="button"
          ref={trigger}
          aria-label={tr("Select tournament")}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            if (!open) {
              setEditions(null);
              setError(false);
            }
            setOpen(!open);
          }}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="tournament-dropdown"
          id={id}
          role="region"
          aria-label={tr("Tournaments")}
        >
          <div className="tournament-dropdown-list">
            {error ? (
              <p className="small muted" role="status">
                {tr("Unable to load tournaments.")}
              </p>
            ) : editions === null ? (
              <p className="small muted" role="status">
                {tr("Loading…")}
              </p>
            ) : editions.length ? (
              editions.map((e) => (
                <Link
                  key={e.slug}
                  href={`/tournaments/${e.slug}`}
                  aria-current={
                    path === `/tournaments/${e.slug}` ||
                    path.startsWith(`/tournaments/${e.slug}/`)
                      ? "page"
                      : undefined
                  }
                  onClick={navigate}
                >
                  {e.name}
                </Link>
              ))
            ) : (
              <p className="small muted">
                {tr("No tournaments published yet")}
              </p>
            )}
          </div>
          <Link
            className="tournament-dropdown-all"
            href="/tournaments"
            onClick={navigate}
          >
            {tr("All tournaments")}
          </Link>
        </div>
      )}
    </div>
  );
}
