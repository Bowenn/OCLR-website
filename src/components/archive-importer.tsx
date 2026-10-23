"use client";
import Link from "next/link";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import {
  historicalArchiveSchema,
  archiveCounts,
  type HistoricalArchive,
} from "@/lib/historical-archive";
import { ConfirmMutation } from "./confirm-mutation";

export function ArchiveImporter({
  slug,
  revision,
  published,
  eligible,
  archive,
}: {
  slug: string;
  revision: number;
  published: boolean;
  eligible: boolean;
  archive?: HistoricalArchive;
}) {
  const tr = useAppTranslations();
  const [text, setText] = useState("");
  const [review, setReview] = useState<HistoricalArchive | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  function validate() {
    setError("");
    setReview(null);
    setSaved(false);
    try {
      if (new TextEncoder().encode(text).byteLength > 450000)
        throw new Error(tr("Archive file exceeds the size limit."));
      const parsed = historicalArchiveSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        setError(
          `${tr("Invalid archive data.")} ${parsed.error.issues[0].path.join(".")}: `,
        );
        return;
      }
      if (parsed.data.editionSlug !== slug)
        throw new Error(tr("Archive edition does not match this tournament."));
      setReview(parsed.data);
    } catch (error) {
      setError(
        error instanceof SyntaxError
          ? tr("The request contains invalid JSON.")
          : tr((error as Error).message),
      );
    }
  }
  const counts = review
    ? archiveCounts(review)
    : archive
      ? archiveCounts(archive)
      : null;
  return (
    <div className="stack">
      <p>
        {tr(
          "Import source records into an unpublished, completed edition. Review the saved preview, then publish the tournament separately.",
        )}
      </p>
      <p className="muted">
        {tr(
          "Archive identities do not create accounts, registrations or staff permissions.",
        )}
      </p>
      <Link href={`/admin/tournaments/${slug}/settings`}>
        {tr("Tournament settings")}
      </Link>
      {archive && (
        <Link href={`/admin/tournaments/${slug}/archive/preview`}>
          {tr("Open saved archive preview")}
        </Link>
      )}
      {(!eligible || published) && (
        <p className="notice">
          {tr(
            "Import archives into an unpublished, completed tournament without registration.",
          )}
        </p>
      )}
      <label className="field">
        <span>{tr("Archive JSON file")}</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setReview(null);
            setSaved(false);
            setError("");
            if (!file) return;
            if (file.size > 450000) {
              setText("");
              setError(tr("Archive file exceeds the size limit."));
              return;
            }
            try {
              setText(await file.text());
            } catch {
              setError(tr("Could not read the archive file."));
            }
          }}
        />
      </label>
      <label className="field">
        <span>{tr("Archive JSON")}</span>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReview(null);
            setSaved(false);
          }}
        />
      </label>
      <div className="actions">
        <button type="button" onClick={validate} disabled={!text}>
          {tr("Validate and review archive")}
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error-text">
          {error}
        </p>
      )}
      {counts && (
        <dl className="archive-counts">
          {[
            [tr("Teams"), counts.teams],
            [tr("Players & coaches"), counts.players],
            [tr("Draft picks"), counts.picks],
            [tr("Recorded results"), counts.results],
            [tr("Unconfirmed records"), counts.incomplete],
            [tr("Mappools"), counts.pools],
            [tr("Maps"), counts.maps],
          ].map(([label, n]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{n}</dd>
            </div>
          ))}
        </dl>
      )}
      {review && (
        <section className="stack">
          <h2>{tr("Review source records")}</h2>
          <a href={review.sourceUrl} rel="noreferrer">
            {tr("Original archive spreadsheet")}
          </a>
          <ul>
            {review.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
          <details>
            <summary>{tr("All import fields")}</summary>
            <pre className="archive-json">
              {JSON.stringify(review, null, 2)}
            </pre>
          </details>
          <ConfirmMutation
            label={tr("Save archive draft")}
            title={tr("Save archive draft")}
            description={tr(
              "Save these historical source records privately. This replaces any previous archive draft and does not publish results.",
            )}
            url={`/api/admin/tournaments/${slug}`}
            payload={{
              action: "archive",
              archive: review,
              expectedRevision: revision,
              confirmed: true,
            }}
            disabled={!eligible || published || saved}
            onSuccess={() => {
              setSaved(true);
              setReview(null);
              setText("");
            }}
          />
        </section>
      )}
      {saved && (
        <p role="status">
          {tr(
            "Archive draft saved. Review the saved preview before publishing.",
          )}
        </p>
      )}
    </div>
  );
}
