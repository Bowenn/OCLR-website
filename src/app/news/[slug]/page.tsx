import Link from "next/link";
import { notFound } from "next/navigation";
import { publicAnnouncement } from "@/lib/announcements";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = publicAnnouncement(slug);
  return { title: item?.title ?? "Announcement", description: item?.summary };
}
export default async function Announcement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = publicAnnouncement(slug);
  if (!item) notFound();
  return (
    <article className="container page prose">
      <Link href="/news" className="text-link">
        ← All announcements
      </Link>
      <div className="spaced">
        <PageHeading
          eyebrow={formatDate(item.publishedAt, "UTC")}
          title={item.title}
        >
          {item.summary}
        </PageHeading>
      </div>
      {item.sections.map((s, i) => (
        <section key={i}>
          <h2>{s.heading}</h2>
          <p className="preserve-lines">{s.body}</p>
        </section>
      ))}
    </article>
  );
}
