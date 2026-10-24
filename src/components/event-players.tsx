"use client";
import { PlayerReactions } from "./player-reactions";
import { useState } from "react";
import Link from "next/link";
import { useAppTranslations } from "@/i18n/shared";
import type { EventPlayer } from "@/lib/event-preview";
export function EventPlayers({
  players,
  edition,
  grouped = false,
  preview = false,
  search = true,
}: {
  players: EventPlayer[];
  edition: string;
  grouped?: boolean;
  preview?: boolean;
  search?: boolean;
}) {
  const tr = useAppTranslations();
  const [query, setQuery] = useState("");
  const [byTeam, setByTeam] = useState(grouped);
  const rows = players.filter((p) =>
    `${p.name} ${p.team ?? ""} ${p.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const groups = byTeam ? [...new Set(rows.map((p) => p.team))] : [null];
  return (
    <section className="event-players">
      <div className="event-tools">
        {search && (
          <label>
            {tr("Search players")}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Username or osu! ID")}
            />
          </label>
        )}
        {(preview || grouped) && (
          <div className="event-tabs">
            <button aria-pressed={!byTeam} onClick={() => setByTeam(false)}>
              {tr("Registration list")}
            </button>
            <button aria-pressed={byTeam} onClick={() => setByTeam(true)}>
              {tr("Team groups")}
            </button>
          </div>
        )}
      </div>
      <p className="muted">
        {rows.length} {tr("Players")}
      </p>
      {groups.map((group) => (
        <section key={group ?? "all"} className="event-player-group">
          {byTeam && <h2>{group ?? tr("Players")}</h2>}
          {rows
            .filter((p) => !byTeam || p.team === group)
            .map((p) => (
              <article className="event-player-row" key={p.id}>
                <div className="event-player-basic">
                  <div className="event-player-identity">
                    <div className="event-player-monogram" aria-hidden="true">
                      {p.name.slice(0, 2)}
                    </div>
                    <div>
                      <h3>
                        {p.href ? (
                          <a href={`https://osu.ppy.sh/users/${p.id}`}>
                            {p.name}
                          </a>
                        ) : (
                          p.name
                        )}
                      </h3>
                      <span className="muted">
                        {p.captain && byTeam ? "Captain" : "osu!"}{" "}
                        {byTeam && p.team ? `· ${p.team}` : ""}
                      </span>
                      {p.href && (
                        <Link
                          className="text-link small"
                          href={p.href}
                          aria-label={tr("OCLR profile")}
                        >
                          {tr("OCLR profile")} ↗
                        </Link>
                      )}
                      {p.fetchedAt && (
                        <time className="sr-only" dateTime={p.fetchedAt}>
                          {p.fetchedAt}
                        </time>
                      )}
                      <dl>
                        <div>
                          <dt>{tr("Global rank")}</dt>
                          <dd>
                            {p.rank
                              ? `#${p.rank.toLocaleString(tr.locale)}`
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>PP</dt>
                          <dd>{p.pp?.toLocaleString(tr.locale) ?? "—"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <PlayerReactions
                    edition={edition}
                    playerId={p.id}
                    name={p.name}
                  />
                </div>
                <div className="event-player-bio">
                  <h4>{tr("Self introduction")}</h4>
                  <p>{p.bio ?? "—"}</p>
                </div>
                <div className="event-player-messages">
                  <h4>{tr("Message board")}</h4>
                  <div
                    className="event-message-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={tr("Messages for {name}", { name: p.name })}
                  >
                    {p.messages?.length ? (
                      p.messages.map((m, i) => (
                        <div key={i}>
                          <strong>{m.author}</strong>
                          <p>{m.text}</p>
                        </div>
                      ))
                    ) : (
                      <p>—</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </section>
      ))}
    </section>
  );
}
