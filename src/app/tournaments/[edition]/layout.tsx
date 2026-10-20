import Link from "next/link";
import { notFound } from "next/navigation";
import { publicDraft } from "@/lib/draft";
import { getPublicEdition } from "@/lib/content";
export const dynamic = "force-dynamic";
export default async function EditionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const edition = getPublicEdition(slug);
  if (!edition) notFound();
  const [draftResult] = await Promise.allSettled([publicDraft(slug)]);
  const draft = draftResult.status === "fulfilled" ? draftResult.value : null;
  const liveUnavailable = draftResult.status === "rejected";
  return (
    <div className="container page workspace">
      <aside className="sidebar">
        <Link href="/tournaments" className="eyebrow">
          ← TOURNAMENTS
        </Link>
        <h2>{edition.name}</h2>
        <nav aria-label="Tournament navigation">
          {[
            ["", "Overview"],
            ["/rules", "Rules"],
            ["/schedule", "Schedule"],
            ["/mappools", "Mappools"],
            ["/results", "Results"],
            ["/bracket", "Bracket"],
            ["/participants", "Participants"],
            ["/teams", "Teams"],
          ].map(([path, name]) => (
            <Link key={path} href={`/tournaments/${slug}${path}`}>
              {name}
            </Link>
          ))}
          <Link href={`/players?edition=${slug}`}>Players</Link>
          {draft && <Link href={`/tournaments/${slug}/draft`}>Live draft</Link>}
        </nav>
      </aside>
      <div className="workspace-main">
        {liveUnavailable && (
          <p className="notice" role="status">
            Live tournament information is temporarily unavailable. Confirmed
            rules and dates remain accessible.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
