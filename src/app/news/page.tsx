import Link from "next/link";
import { publicAnnouncements } from "@/lib/announcements";
import { formatDate } from "@/lib/editions";
import { EmptyState, PageHeading } from "@/components/ui";
export const metadata = { title: "News & announcements" };
export default function News() {
  const announcements = publicAnnouncements();
  return (
    <div className="container page">
      <PageHeading eyebrow="FROM THE OCLR STAGE" title="News & announcements">
        Confirmed updates from osu! Chinese League Rookie.
      </PageHeading>
      {announcements.length ? (
        <div className="news-list">
          {announcements.map((a) => (
            <article key={a.slug}>
              <div>
                <p className="eyebrow">ANNOUNCEMENT</p>
                <p className="muted small">
                  {formatDate(a.publishedAt, "UTC")}
                </p>
              </div>
              <div>
                <h2>
                  <Link href={`/news/${a.slug}`}>
                    {a.title} <span aria-hidden="true">↗</span>
                  </Link>
                </h2>
                <p className="muted">{a.summary}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No announcements yet">
          Official updates will appear here when approved. Tournament
          information is published as it is confirmed.
        </EmptyState>
      )}
    </div>
  );
}
