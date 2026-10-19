import { Action, Badge } from "./ui";
import { enrollmentState, formatDate, type Edition } from "@/lib/editions";
export function EditionCard({ edition }: { edition: Edition }) {
  const state = enrollmentState(edition);
  return (
    <article className="featured-edition">
      <div className="edition-art" aria-hidden="true">
        <span>
          OCLR<small>THE ROOKIE STAGE</small>
        </span>
      </div>
      <div className="edition-copy">
        <Badge>Registration: {state}</Badge>
        <h3>{edition.name}</h3>
        <p className="muted">{edition.summary}</p>
        <Action href={`/tournaments/${edition.slug}`}>View tournament →</Action>
      </div>
      <dl className="edition-facts">
        <div>
          <dt>Registration opens</dt>
          <dd>
            {formatDate(
              edition.registration?.opensAt ?? null,
              edition.timeZone,
            )}
          </dd>
        </div>
        <div>
          <dt>Registration closes</dt>
          <dd>
            {formatDate(
              edition.registration?.closesAt ?? null,
              edition.timeZone,
            )}
          </dd>
        </div>
        <div>
          <dt>Entry</dt>
          <dd>Individual registration</dd>
        </div>
      </dl>
    </article>
  );
}
