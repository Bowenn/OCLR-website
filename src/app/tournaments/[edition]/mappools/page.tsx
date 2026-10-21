import Link from "next/link";
import { publicMappools } from "@/lib/mappools";
import { EmptyState, PageHeading } from "@/components/ui";
import { MappoolBrowser } from "@/components/mappool-browser";
import { MappoolStages } from "@/components/mappool-stages";
export const metadata = { title: "Published mappools" };
export default async function MappoolsPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const pools = await publicMappools(edition);
  const stages = (["group", "knockout"] as const).flatMap((stage) => {
    const released = pools.filter((pool) => pool.stage === stage);
    if (!released.length) return [];
    const rounds = [...new Set(released.map((pool) => pool.roundId))];
    return [
      {
        value: stage,
        label: stage === "group" ? "Group Stage" : "Knockout Stage",
        content: (
          <div className="mappool-round-list">
            {rounds.map((roundId, index) => {
              const round = released.filter((pool) => pool.roundId === roundId);
              const mapCount = round.reduce(
                (total, pool) => total + pool.entries.length,
                0,
              );
              return (
                <details
                  className="mappool-public-round"
                  key={roundId}
                  open={index === 0}
                >
                  <summary>
                    <h3>{round[0].roundName}</h3>
                    <span className="muted small">
                      {round.length} {round.length === 1 ? "pool" : "pools"} ·{" "}
                      {mapCount} {mapCount === 1 ? "map" : "maps"}
                    </span>
                  </summary>
                  {round.map((pool) => (
                    <article
                      className="mappool-release"
                      key={pool.id}
                      aria-labelledby={`pool-${pool.id}-name`}
                    >
                      <header className="mappool-release-heading">
                        <h4 id={`pool-${pool.id}-name`}>
                          <Link
                            href={`/tournaments/${edition}/mappools/${pool.id}`}
                            className="text-link"
                          >
                            {pool.name}
                          </Link>
                        </h4>
                        <p className="muted small">
                          {pool.entries.length}{" "}
                          {pool.entries.length === 1 ? "map" : "maps"} ·
                          Released{" "}
                          <time dateTime={pool.publishedAt!.toISOString()}>
                            {new Intl.DateTimeFormat("en-GB", {
                              timeZone: "UTC",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(pool.publishedAt!)}
                          </time>{" "}
                          (UTC)
                        </p>
                      </header>
                      <MappoolBrowser
                        slug={edition}
                        pool={pool}
                        headingLevel={5}
                      />
                    </article>
                  ))}
                </details>
              );
            })}
          </div>
        ),
      },
    ];
  });
  return (
    <>
      <PageHeading eyebrow="THE MAPS" title="Mappools">
        Released beatmaps, organized by competition stage and round.
      </PageHeading>
      {stages.length ? (
        <MappoolStages stages={stages} />
      ) : (
        <EmptyState title="No mappools published">
          Organizers will release the approved maps here.
        </EmptyState>
      )}
    </>
  );
}
