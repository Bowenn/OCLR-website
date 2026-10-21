"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { publicMappools } from "@/lib/mappools";
import {
  categories,
  categoryNames,
  slotLabel,
  formatBeatmapNumber as number,
  formatBeatmapDuration as duration,
} from "@/lib/mappool-model";
import { BeatmapCover } from "./beatmap-cover";
import { MappoolView } from "./mappool-view";
type Pool = Awaited<ReturnType<typeof publicMappools>>[number];
type Entry = Pool["entries"][number];
function modRating(entry: Entry) {
  const m = entry.metadata;
  return m.attributes
    ? `${number(m.attributes.stars, 2)} ★ · ${m.attributes.configuration}`
    : entry.category === "NM"
      ? "No Mod uses base difficulty"
      : ["FM", "TB"].includes(entry.category)
        ? "Variable mods"
        : "Not calculated";
}
function MapDetails({
  entry,
  pool,
  slug,
  previous,
  next,
  onMove,
  onClose,
}: {
  entry: Entry;
  pool: Pool;
  slug: string;
  previous?: Entry;
  next?: Entry;
  onMove: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  const m = entry.metadata;
  return (
    <dialog
      ref={dialog}
      className="map-dialog"
      aria-labelledby={title}
      onClose={onClose}
    >
      <header>
        <span className="eyebrow">
          {pool.name} / {slotLabel(entry.category, entry.position)}
        </span>
        <button
          className="secondary"
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close map details"
        >
          Close
        </button>
      </header>
      <div className="map-dialog-body">
        <BeatmapCover key={m.setId} setId={m.setId} />
        <p className="eyebrow">{m.artist}</p>
        <h2 id={title}>{m.title}</h2>
        <p className="muted">
          [{m.difficulty}] · {m.mapper}
        </p>
        <dl className="map-detail-grid">
          {[
            ["Beatmap ID", entry.beatmapId],
            ["Beatmapset ID", m.setId],
            ["Base difficulty", `${number(m.stars, 2)} ★`],
            ["Official Mod SR", modRating(entry)],
            ["Base BPM", number(m.bpm)],
            ["Base length", duration(m.duration)],
            [
              "AR / OD / CS / HP",
              [m.ar, m.od, m.cs, m.hp].map((v) => number(v)).join(" / "),
            ],
            ...(m.attributes
              ? [
                  ["Ruleset", m.attributes.ruleset],
                  ["Max combo", number(m.attributes.maxCombo)],
                  ...Object.entries(m.attributes.values).map(
                    ([label, value]) => [
                      label.replaceAll("_", " "),
                      number(value),
                    ],
                  ),
                ]
              : []),
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {entry.category === "FM" && (
          <p className="notice">
            {pool.fmMode === "force_mod" ? "Force Mod" : "Free Mod"}
            {pool.fmRestrictions
              ? `: ${pool.fmRestrictions}`
              : ": Detailed restrictions have not been published."}
          </p>
        )}
        <div className="actions">
          <a
            className="button"
            href={`https://osu.ppy.sh/beatmaps/${entry.beatmapId}`}
          >
            Open on osu!
          </a>
          <Link
            className="button secondary"
            href={`/tournaments/${slug}/mappools/${pool.id}#map-${entry.id}`}
            onClick={() => dialog.current?.close()}
          >
            Map permalink
          </Link>
        </div>
        <div className="map-dialog-navigation">
          <button
            className="secondary"
            type="button"
            disabled={!previous}
            onClick={() => previous && onMove(previous.id)}
          >
            Previous map
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!next}
            onClick={() => next && onMove(next.id)}
          >
            Next map
          </button>
        </div>
      </div>
    </dialog>
  );
}
export function MappoolBrowser({
  pool,
  slug,
  headingLevel = 2,
}: {
  pool: Pool;
  slug: string;
  headingLevel?: 2 | 5;
}) {
  const CardHeading = headingLevel === 5 ? "h5" : "h2";
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("slot");
  const [view, setView] = useState("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const ordered = categories.flatMap((c) =>
    pool.entries
      .filter((e) => e.category === c)
      .sort((a, b) => a.position - b.position),
  );
  const term = search.trim().toLocaleLowerCase();
  const entries = ordered.filter(
    (e) =>
      (!category || e.category === category) &&
      (!term ||
        [
          slotLabel(e.category, e.position),
          e.beatmapId,
          e.metadata.title,
          e.metadata.artist,
          e.metadata.mapper,
          e.metadata.difficulty,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(term)),
  );
  if (sort === "title")
    entries.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title));
  if (sort === "stars")
    entries.sort((a, b) => b.metadata.stars - a.metadata.stars);
  const activeIndex = entries.findIndex((e) => e.id === selected);
  const active = entries[activeIndex];
  const mean =
    pool.entries.length &&
    pool.entries.every((e) => Number.isFinite(e.metadata.stars))
      ? pool.entries.reduce((sum, e) => sum + e.metadata.stars, 0) /
        pool.entries.length
      : null;
  return (
    <div className="mappool-browse">
      <div className="pool-summary">
        <span>
          <strong>{pool.entries.length}</strong> released maps
        </span>
        {mean !== null && (
          <span>
            <strong>{number(mean, 2)} ★</strong> average base SR
          </span>
        )}
        <span>
          {categories
            .filter((c) => pool.entries.some((e) => e.category === c))
            .join(" / ")}
        </span>
      </div>
      <div className="map-browse-toolbar">
        <div
          className="event-pills"
          role="group"
          aria-label={`${pool.name}: mod filter`}
        >
          {[
            ["", "All mods"],
            ...categories
              .filter((c) => pool.entries.some((e) => e.category === c))
              .map((c) => [c, c]),
          ].map(([value, label]) => (
            <button
              className="secondary"
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
                setSelected(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="event-pills"
          role="group"
          aria-label={`${pool.name}: map view`}
        >
          {["cards", "compact"].map((value) => (
            <button
              className="secondary"
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                setSelected(null);
              }}
            >
              {value === "cards" ? "Map cards" : "Compact table"}
            </button>
          ))}
        </div>
      </div>
      <div className="map-browse-filters">
        <label className="field">
          <span>Search {pool.name}</span>
          <input
            type="search"
            value={search}
            placeholder="Title, artist, mapper or slot"
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(null);
            }}
          />
        </label>
        <label className="field">
          <span>Sort {pool.name}</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setSelected(null);
            }}
          >
            <option value="slot">Slot order</option>
            <option value="title">Song title</option>
            <option value="stars">Base difficulty</option>
          </select>
        </label>
      </div>
      <p className="muted small" role="status">
        {entries.length} / {pool.entries.length} maps
      </p>
      {view === "compact" ? (
        <MappoolView pool={{ ...pool, entries }} headingLevel={headingLevel} />
      ) : (
        <>
          <p className="muted small">
            Stars, BPM and length show base map values. Official mod difficulty
            is listed separately when available.
          </p>
          {pool.entries.some((e) => e.category === "FM") && (
            <p className="notice">
              {pool.fmMode === "force_mod" ? "Force Mod" : "Free Mod"}
              {pool.fmRestrictions
                ? `: ${pool.fmRestrictions}`
                : ": Detailed restrictions have not been published."}
            </p>
          )}
          <div className="map-card-grid">
            {entries.map((e) => (
              <article
                className="map-browse-card"
                id={`map-${e.id}`}
                key={e.id}
                data-category={e.category}
              >
                <div className="map-card-cover">
                  <BeatmapCover setId={e.metadata.setId} />
                  <span className="map-slot-badge">
                    {slotLabel(e.category, e.position)}
                  </span>
                </div>
                <div className="map-card-copy">
                  <p className="eyebrow">
                    {categoryNames[e.category]} · {e.metadata.artist}
                  </p>
                  <CardHeading>
                    <button
                      className="map-open-button"
                      type="button"
                      aria-label={`View ${slotLabel(e.category, e.position)}: ${e.metadata.title}`}
                      onClick={() => setSelected(e.id)}
                    >
                      {e.metadata.title}
                    </button>
                  </CardHeading>
                  <p className="muted small">[{e.metadata.difficulty}]</p>
                  <p className="muted small">
                    {e.metadata.mapper} · BID {e.beatmapId}
                  </p>
                  <div className="map-card-values">
                    <span>{number(e.metadata.stars, 2)} ★ base</span>
                    <span>{number(e.metadata.bpm)} BPM</span>
                    <span>{duration(e.metadata.duration)}</span>
                  </div>
                  <p className="map-mod-rating muted small">{modRating(e)}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {!entries.length && (
        <p className="notice">No beatmaps match these filters.</p>
      )}
      {active && (
        <MapDetails
          entry={active}
          pool={pool}
          slug={slug}
          previous={entries[activeIndex - 1]}
          next={entries[activeIndex + 1]}
          onMove={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
