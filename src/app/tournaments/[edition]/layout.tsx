import Link from "next/link";
import { TournamentNavigation } from "@/components/tournament-navigation";
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
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const [draftResult] = await Promise.allSettled([publicDraft(slug)]);
  const draft = draftResult.status === "fulfilled" ? draftResult.value : null;
  const liveUnavailable = draftResult.status === "rejected";
  return (
    <div className="container page workspace tournament-workspace">
      <aside className="sidebar">
        <Link href="/tournaments" className="eyebrow">
          ← TOURNAMENTS
        </Link>
        <h2>{edition.name}</h2>
        <TournamentNavigation slug={slug} liveDraft={Boolean(draft)} />
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
