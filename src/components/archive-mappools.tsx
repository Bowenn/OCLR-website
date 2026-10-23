"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { HistoricalArchive } from "@/lib/historical-archive";
import { formatBeatmapDuration } from "@/lib/mappool-model";
import { WorkspaceTabs } from "./workspace-tabs";

type Pool = HistoricalArchive["pools"][number];
export function ArchiveMappools({
  pool,
  stages,
}: {
  pool: Pool;
  stages: { id: string; name: string; count: number; href: string }[];
}) {
  const tr = useAppTranslations(),
    tabId = useId();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = nav.current;
    const active = strip?.querySelector('[aria-current="page"]');
    if (!strip || !active) return;
    const item = active.getBoundingClientRect(),
      bounds = strip.getBoundingClientRect();
    if (item.left < bounds.left) strip.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right)
      strip.scrollLeft += item.right - bounds.right;
  }, [pool.id]);
  const [mod, setMod] = useState("all"),
    [search, setSearch] = useState("");
  // Preserve source order and literal titles; archive stats are not live osu! metadata.
  const mods = [...new Set(pool.maps.map((m) => m.slot.replace(/\d+$/, "")))];
  const query = search.trim().toLocaleLowerCase();
  const maps = pool.maps.filter(
    (m) =>
      (mod === "all" || m.slot.replace(/\d+$/, "") === mod) &&
      (!query ||
        [m.slot, m.title, m.mapper, m.beatmapId]
          .filter((v) => v !== null)
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)),
  );
  const number = new Intl.NumberFormat(tr.locale, { maximumFractionDigits: 2 });
  return (
    <div className="archive-pools">
      <nav
        ref={nav}
        className="archive-pool-stages"
        aria-label={tr("Mappool stages")}
      >
        {stages.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            aria-current={s.id === pool.id ? "page" : undefined}
          >
            <span>{s.name}</span>
            <span className="archive-pool-count">{s.count}</span>
          </Link>
        ))}
      </nav>
      <div className="archive-pool-toolbar">
        <p className="muted small" role="status">
          {tr("{shown} / {total} maps", {
            shown: maps.length,
            total: pool.maps.length,
          })}
        </p>
        <label className="field">
          <span className="sr-only">{tr("Search maps")}</span>
          <input
            type="search"
            placeholder={tr("Title, mapper, slot or beatmap ID")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <WorkspaceTabs
        id={tabId}
        label={tr("Mod filter")}
        appearance="line"
        value={mod}
        onChange={setMod}
        items={[
          { value: "all", label: tr("All mods") },
          ...mods.map((value) => ({ value, label: value })),
        ]}
      />
      <div
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-${mod}`}
        tabIndex={0}
      >
        <h2 className="sr-only">{pool.name}</h2>
        {maps.length ? (
          <ol className="archive-map-list">
            {maps.map((m) => (
              <li key={m.slot} id={`map-${m.slot}`}>
                <span className="archive-map-slot">{m.slot}</span>
                <div className="archive-map-identity">
                  <h3>
                    {m.beatmapId ? (
                      <a
                        className="context-link"
                        href={`https://osu.ppy.sh/beatmaps/${m.beatmapId}`}
                      >
                        {m.title}
                      </a>
                    ) : (
                      m.title
                    )}
                  </h3>
                  <p className="muted small">
                    {tr("Mapper")}: {m.mapper ?? tr("Not recorded")}
                    {m.beatmapId ? (
                      <>
                        {" "}
                        · <span>#{m.beatmapId}</span>
                      </>
                    ) : (
                      <> · {tr("Beatmap ID unresolved")}</>
                    )}
                  </p>
                </div>
                <dl className="archive-map-stats">
                  {[
                    [
                      tr("SR"),
                      m.stars,
                      m.stars === null ? null : `${number.format(m.stars)} ★`,
                    ],
                    [
                      tr("BPM"),
                      m.bpm,
                      m.bpm === null ? null : number.format(m.bpm),
                    ],
                    [
                      tr("Drain"),
                      m.drainSeconds,
                      m.drainSeconds === null
                        ? null
                        : formatBeatmapDuration(m.drainSeconds),
                    ],
                    [
                      tr("CS"),
                      m.cs,
                      m.cs === null ? null : number.format(m.cs),
                    ],
                    [
                      tr("AR"),
                      m.ar,
                      m.ar === null ? null : number.format(m.ar),
                    ],
                    [
                      tr("OD"),
                      m.od,
                      m.od === null ? null : number.format(m.od),
                    ],
                  ].map(([label, raw, value]) => (
                    <div key={String(label)}>
                      <dt>{label}</dt>
                      <dd
                        title={raw === null ? tr("Not recorded") : String(raw)}
                      >
                        {value ?? (
                          <span aria-label={tr("Not recorded")}>—</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        ) : (
          <p className="notice">{tr("No maps match these filters.")}</p>
        )}
      </div>
    </div>
  );
}
