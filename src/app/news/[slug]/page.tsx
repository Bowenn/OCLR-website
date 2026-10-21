import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicNewsItem } from "@/lib/public-news";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tr = await getAppTranslations();
  const { slug } = await params;
  const item = await publicNewsItem(slug, undefined, tr);
  return {
    title: item?.title ?? tr("Announcement"),
    description: item?.summary,
  };
}
export default async function Announcement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tr = await getAppTranslations();

  const { slug } = await params;
  const item = await publicNewsItem(slug, undefined, tr);
  if (!item) notFound();
  return (
    <article className="container page prose">
      <Link href="/news" className="text-link">
        {tr("← All announcements")}
      </Link>
      <div className="spaced">
        <PageHeading
          eyebrow={`${item.future ? "Scheduled for " : ""}${tr(formatDate(item.at, item.timeZone, tr.locale))}`}
          title={item.title}
        >
          {item.summary}
        </PageHeading>
      </div>
      {item.source && (
        <p>
          <Link className="button secondary" href={item.source.url}>
            {tr("View ")}
            {item.source.label}
          </Link>
        </p>
      )}
      {item.sections.map((s, i) => (
        <section key={i}>
          <h2>{s.heading}</h2>
          <p className="preserve-lines">{s.body}</p>
        </section>
      ))}
    </article>
  );
}
