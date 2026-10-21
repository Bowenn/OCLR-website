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
  const { slug } = await params;
  const item = await publicNewsItem(slug);
  return { title: item?.title ?? "Announcement", description: item?.summary };
}
export default async function Announcement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await publicNewsItem(slug);
  if (!item) notFound();
  return (
    <article className="container page prose">
      <Link href="/news" className="text-link">
        ← All announcements
      </Link>
      <div className="spaced">
        <PageHeading
          eyebrow={`${item.future ? "Scheduled for " : ""}${formatDate(item.at, item.timeZone)}`}
          title={item.title}
        >
          {item.summary}
        </PageHeading>
      </div>
      {item.source && (
        <p>
          <Link className="button secondary" href={item.source.url}>
            View {item.source.label}
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
