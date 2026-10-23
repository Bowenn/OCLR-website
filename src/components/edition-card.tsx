import { getAppTranslations } from "@/i18n/server";
import { registrationAvailability } from "@/lib/registrations";
import { Action, Badge } from "./ui";
import { EditionArtwork } from "./edition-artwork";
import { formatDate, publicEditionSummary, type Edition } from "@/lib/editions";
export async function EditionCard({ edition }: { edition: Edition }) {
  const tr = await getAppTranslations();

  const state = await registrationAvailability(edition);
  const summary = publicEditionSummary(edition.summary);
  const historical = edition.status === "completed";
  return (
    <article className="edition-card">
      <EditionArtwork slug={edition.slug} logo={edition.branding.logo} />
      <div className="edition-copy">
        {historical ? (
          <Badge>{tr("Historical archive")}</Badge>
        ) : (
          state !== "open" && (
            <Badge>
              {tr("Registration: ")}
              {tr(state)}
            </Badge>
          )
        )}
        <h2>{edition.name}</h2>
        {summary && <p className="muted">{summary}</p>}
        <div className="actions">
          {state === "open" && (
            <Action href={`/tournaments/${edition.slug}/register`}>
              {tr("Register")}
            </Action>
          )}
          <Action href={`/tournaments/${edition.slug}`} secondary>
            {tr("View tournament")}
          </Action>
        </div>
      </div>
      {!historical && (
        <dl className="edition-facts">
          <div>
            <dt>{tr("Registration opens")}</dt>
            <dd>
              {tr(
                formatDate(
                  edition.registration?.opensAt ?? null,
                  edition.timeZone,
                  tr.locale,
                ),
              )}
            </dd>
          </div>
          <div>
            <dt>{tr("Registration closes")}</dt>
            <dd>
              {tr(
                formatDate(
                  edition.registration?.closesAt ?? null,
                  edition.timeZone,
                  tr.locale,
                ),
              )}
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}
