import type { publicMappools } from "@/lib/mappools";
import { categories, categoryNames, slotLabel } from "@/lib/mappool-model";
import { BeatmapDetails } from "./beatmap-details";
export function MappoolView({
  pool,
}: {
  pool: Awaited<ReturnType<typeof publicMappools>>[number];
}) {
  return (
    <>
      <p className="notice">
        {pool.fmMode
          ? `${pool.fmMode === "free_mod" ? "Free Mod" : "Force Mod"}: ${pool.fmRestrictions || "Detailed mod restrictions have not been published."}`
          : "FM is not enabled for this pool."}
      </p>
      <nav className="actions" aria-label="Mappool categories">
        {categories.map((c) => {
          const count = pool.entries.filter((e) => e.category === c).length;
          return count ? (
            <a className="button secondary" key={c} href={`#maps-${c}`}>
              {c} · {count}
            </a>
          ) : (
            <span className="badge" key={c}>
              {c} · 0
            </span>
          );
        })}
      </nav>
      {categories
        .filter((c) => pool.entries.some((e) => e.category === c))
        .map((category) => {
          const entries = pool.entries.filter((e) => e.category === category);
          return (
            <section
              className="section-space"
              id={`maps-${category}`}
              key={category}
            >
              <div className="section-title">
                <h2>
                  {category}{" "}
                  <span className="muted">
                    /{" "}
                    {category === "FM" && pool.fmMode
                      ? pool.fmMode === "free_mod"
                        ? "Free Mod"
                        : "Force Mod"
                      : categoryNames[category]}
                  </span>
                </h2>
                <span className="muted small">
                  {entries.length} {entries.length === 1 ? "slot" : "slots"}
                </span>
              </div>
              <ol className="mappool-slots">
                {entries.map((e) => (
                  <li className="panel" key={e.id}>
                    <BeatmapDetails
                      beatmapId={e.beatmapId}
                      metadata={e.metadata}
                      label={slotLabel(e.category, e.position)}
                    />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
    </>
  );
}
