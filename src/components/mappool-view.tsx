import type { publicMappools } from "@/lib/mappools";
import {
  categories,
  categoryNames,
  slotLabel,
  formatBeatmapDuration,
  formatBeatmapNumber,
} from "@/lib/mappool-model";
import { BeatmapCover } from "./beatmap-cover";

type Pool = Awaited<ReturnType<typeof publicMappools>>[number];
const columns = [
  "Mapper",
  "BID",
  "Base SR",
  "Official Mod SR",
  "BPM",
  "Length",
  "AR",
  "OD",
  "CS",
  "HP",
] as const;

function MappoolRow({ entry: e }: { entry: Pool["entries"][number] }) {
  const m = e.metadata;
  const url = `https://osu.ppy.sh/beatmaps/${e.beatmapId}`;
  const fields = [
    m.mapper,
    <a className="text-link" href={url} key="bid">
      {e.beatmapId}
    </a>,
    formatBeatmapNumber(m.stars, 2),
    <span key="mods">
      {m.attributes ? (
        <details className="mappool-mod-attributes">
          <summary>
            {formatBeatmapNumber(m.attributes.stars, 2)}
            <small>{m.attributes.configuration}</small>
          </summary>
          <dl>
            <div>
              <dt>Ruleset</dt>
              <dd>{m.attributes.ruleset}</dd>
            </div>
            <div>
              <dt>Max combo</dt>
              <dd>{formatBeatmapNumber(m.attributes.maxCombo)}</dd>
            </div>
            {Object.entries(m.attributes.values).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{formatBeatmapNumber(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : (
        <>
          —
          <small>
            {e.category === "FM" || e.category === "TB"
              ? "Variable / unconfigured"
              : "Unconfigured"}
          </small>
        </>
      )}
    </span>,
    formatBeatmapNumber(m.bpm),
    formatBeatmapDuration(m.duration),
    formatBeatmapNumber(m.ar),
    formatBeatmapNumber(m.od),
    formatBeatmapNumber(m.cs),
    formatBeatmapNumber(m.hp),
  ];
  return (
    <tr>
      <th scope="row">{slotLabel(e.category, e.position)}</th>
      <td className="mappool-map">
        <div className="mappool-map-identity">
          <BeatmapCover setId={m.setId} />
          <div>
            <a className="text-link" href={url}>
              {m.artist} — {m.title}
            </a>
            <p className="muted">[{m.difficulty}]</p>
          </div>
        </div>
        <details className="mappool-mobile-details">
          <summary>
            {formatBeatmapNumber(m.stars, 2)} ★ base ·{" "}
            {formatBeatmapNumber(m.bpm)} BPM ·{" "}
            {formatBeatmapDuration(m.duration)}{" "}
            <span className="text-link">Details</span>
          </summary>
          <dl>
            {fields.map((value, i) => (
              <div key={columns[i]}>
                <dt>{columns[i]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </td>
      {fields.map((value, i) => (
        <td className="mappool-extra" key={columns[i]}>
          {value}
        </td>
      ))}
    </tr>
  );
}
export function MappoolView({ pool }: { pool: Pool }) {
  const populated = categories.filter((c) =>
    pool.entries.some((e) => e.category === c),
  );
  if (!populated.length)
    return (
      <p className="muted">No beatmaps have been released for this pool.</p>
    );
  return (
    <div className="mappool-public">
      <nav className="actions" aria-label="Mappool categories">
        {populated.map((c) => (
          <a className="button secondary" key={c} href={`#maps-${c}`}>
            {c} · {pool.entries.filter((e) => e.category === c).length}
          </a>
        ))}
      </nav>
      <p id="mappool-values" className="muted small spaced">
        Map values are unmodified base values. Official Mod SR is shown only for
        explicitly configured mods.
      </p>
      {populated.map((category) => {
        const entries = pool.entries.filter((e) => e.category === category);
        const name =
          category === "FM" && pool.fmMode
            ? pool.fmMode === "free_mod"
              ? "Free Mod"
              : "Force Mod"
            : categoryNames[category];
        return (
          <section
            className="section-space"
            id={`maps-${category}`}
            key={category}
            aria-labelledby={`maps-${category}-title`}
          >
            <div className="section-title">
              <h2 id={`maps-${category}-title`}>
                {category} <span className="muted">/ {name}</span>
              </h2>
              <span className="muted small">
                {entries.length} {entries.length === 1 ? "slot" : "slots"}
              </span>
            </div>
            {category === "FM" && (
              <p className="muted small">
                {name}:{" "}
                {pool.fmRestrictions ||
                  "Detailed mod restrictions have not been published."}
              </p>
            )}
            <div
              className="table-scroll"
              role="region"
              aria-label={`${category} beatmaps`}
              tabIndex={0}
            >
              <table
                className="mappool-sheet"
                aria-describedby="mappool-values"
              >
                <caption className="sr-only">
                  {category} / {name} beatmaps
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Slot</th>
                    <th scope="col">Beatmap / Difficulty</th>
                    {columns.map((label) => (
                      <th className="mappool-extra" scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <MappoolRow key={e.id} entry={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
