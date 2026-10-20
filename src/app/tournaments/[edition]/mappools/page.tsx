import Link from "next/link";
import { publicMappools } from "@/lib/mappools";
import { EmptyState, PageHeading } from "@/components/ui";
export const metadata = { title: "Published mappools" };
export default async function MappoolsPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const pools = await publicMappools(edition);
  return (
    <>
      <PageHeading eyebrow="THE MAPS" title="Mappools">
        Released pools, organized by competition stage and round. No sign-in
        required.
      </PageHeading>
      {pools.length ? (
        ["group", "knockout"]
          .filter((stage) => pools.some((p) => p.stage === stage))
          .map((stage) => (
            <section className="section-space" key={stage}>
              <h2>{stage === "group" ? "Group Stage" : "Knockout Stage"}</h2>
              <div className="stack">
                {pools
                  .filter((p) => p.stage === stage)
                  .map((p) => (
                    <article className="panel" key={p.id}>
                      <p className="eyebrow">{p.roundName}</p>
                      <h3>
                        <Link
                          className="text-link"
                          href={`/tournaments/${edition}/mappools/${p.id}`}
                        >
                          {p.name} ↗
                        </Link>
                      </h3>
                      <p className="muted">
                        {p.entries.length} maps · Published
                        {p.fmMode
                          ? ` · ${p.fmMode === "free_mod" ? "Free Mod" : "Force Mod"}`
                          : ""}
                      </p>
                    </article>
                  ))}
              </div>
            </section>
          ))
      ) : (
        <EmptyState title="No mappools published">
          Organizers will release the approved maps here.
        </EmptyState>
      )}
    </>
  );
}
