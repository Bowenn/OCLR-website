import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import { BroadcastDraft } from "@/components/broadcast-draft";
import { getPublicEdition } from "@/lib/content";
import { publicDraft } from "@/lib/draft";
import type { DraftBoard } from "@/lib/draft-types";

export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Draft broadcast"),
    robots: { index: false, follow: false },
  };
}

export default async function Overlay({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ background?: string }>;
}) {
  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  let initial: DraftBoard | null = null;
  let available = true;
  try {
    initial = await publicDraft(slug);
  } catch {
    available = false;
  }
  return (
    <BroadcastDraft
      slug={slug}
      name={edition.name}
      initial={initial}
      available={available}
      background={
        (await searchParams).background === "transparent"
          ? "transparent"
          : "opaque"
      }
    />
  );
}
