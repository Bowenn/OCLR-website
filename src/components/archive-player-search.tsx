"use client";

import { useState, type ReactNode } from "react";
import { useAppTranslations } from "@/i18n/shared";

export function ArchivePlayerSearch({
  players,
}: {
  players: { id: number; searchText: string; card: ReactNode }[];
}) {
  const tr = useAppTranslations();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = players.filter((player) =>
    player.searchText.toLowerCase().includes(query),
  );
  return (
    <div className="stack">
      <div className="archive-player-search-toolbar">
        <label className="field">
          <span>{tr("Search players")}</span>
          <input
            type="search"
            value={search}
            maxLength={200}
            placeholder={tr("Username, osu! ID or team")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="muted small" role="status">
          {visible.length} / {players.length} {tr("players")}
        </p>
      </div>
      {visible.length ? (
        <ul className="archive-player-grid">
          {visible.map((player) => player.card)}
        </ul>
      ) : (
        <p className="muted">{tr("No players match your search.")}</p>
      )}
    </div>
  );
}
