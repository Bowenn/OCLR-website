import { getAppTranslations } from "@/i18n/server";
import { TournamentShell } from "@/components/tournament-navigation";
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
  const tr = await getAppTranslations();

  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const [draftResult] = await Promise.allSettled([publicDraft(slug)]);
  const draft = draftResult.status === "fulfilled" ? draftResult.value : null;
  const liveUnavailable = draftResult.status === "rejected";
  return (
    <TournamentShell slug={slug} name={edition.name} liveDraft={Boolean(draft)}>
      {liveUnavailable && (
        <p className="notice" role="status">
          {tr(
            "Live tournament information is temporarily unavailable. Confirmed rules and dates remain accessible.",
          )}
        </p>
      )}
      {children}
    </TournamentShell>
  );
}
