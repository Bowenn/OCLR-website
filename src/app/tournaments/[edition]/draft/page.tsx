import Link from "next/link";
import { publicDraft } from "@/lib/draft";
import { PageHeading } from "@/components/ui";
import { LiveDraft } from "@/components/live-draft";
export const metadata = { title: "Live draft" };
export default async function Draft({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ presenter?: string }>;
}) {
  const { edition } = await params;
  const presenter = (await searchParams).presenter === "1";
  return (
    <>
      {!presenter && (
        <>
          <PageHeading
            eyebrow="THE TEAM STORY STARTS HERE"
            title="Captain draft"
          >
            Published selections, captain turns and roster progress.
          </PageHeading>
          <Link
            href={`/tournaments/${edition}/draft?presenter=1`}
            className="text-link"
          >
            Open presenter view ↗
          </Link>
          <Link
            href={`/tournaments/${edition}/draft/overlay`}
            className="text-link broadcast-link"
          >
            Open broadcast overlay ↗
          </Link>
        </>
      )}
      <LiveDraft
        slug={edition}
        initial={await publicDraft(edition)}
        presenter={presenter}
      />
    </>
  );
}
