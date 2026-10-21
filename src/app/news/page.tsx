import Link from "next/link";
import { publicNews } from "@/lib/public-news";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = { title: "News & announcements" };
export default async function News() {
  const announcements = await publicNews();
  return (
    <div className="container page">
      <PageHeading title="News & announcements" />
      {announcements.length ? (
        <div className="news-list">
          {announcements.map((a) => (
            <article key={a.slug}>
              <div>
                <p className="eyebrow">
                  {a.future ? "SCHEDULED" : a.kind.toUpperCase()}
                </p>
                <p className="muted small">
                  {a.future ? "Scheduled for " : ""}
                  {formatDate(a.at, a.timeZone)}
                </p>
              </div>
              <div>
                <h2>
                  <Link className="news-headline" href={`/news/${a.slug}`}>
                    {a.title} <span aria-hidden="true">→</span>
                  </Link>
                </h2>
                <p className="muted">{a.summary}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No announcements yet.</p>
      )}
    </div>
  );
}
