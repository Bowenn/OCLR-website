import { registrationAvailability } from "@/lib/registrations";
import { Action, Badge } from "./ui";
import { EditionArtwork } from "./edition-artwork";
import { formatDate, publicEditionSummary, type Edition } from "@/lib/editions";
export async function EditionCard({ edition }: { edition: Edition }) {
  const state = await registrationAvailability(edition);
  const summary = publicEditionSummary(edition.summary);
  return (
    <article className="edition-card">
      <EditionArtwork slug={edition.slug} logo={edition.branding.logo} />
      <div className="edition-copy">
        {state !== "open" && <Badge>Registration: {state}</Badge>}
        <h2>{edition.name}</h2>
        {summary && <p className="muted">{summary}</p>}
        <div className="actions">
          {state === "open" && (
            <Action href={`/tournaments/${edition.slug}/register`}>
              Register
            </Action>
          )}
          <Action href={`/tournaments/${edition.slug}`} secondary>
            View tournament
          </Action>
        </div>
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
      </dl>
    </article>
  );
}
