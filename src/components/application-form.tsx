"use client";

import { useAppTranslations } from "@/i18n/shared";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Edition } from "@/lib/editions";
export function ApplicationForm({
  edition,
  username,
  configurationVersion,
}: {
  edition: Edition;
  username: string;
  configurationVersion: number;
}) {
  const tr = useAppTranslations();

  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const answers = Object.fromEntries(
        (edition.registration?.questions ?? []).map((q) => [
          q.id,
          String(form.get(q.id) ?? ""),
        ]),
      );
      const result = await fetch(
        `/api/tournaments/${edition.slug}/registrations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(edition.rules
              ? {
                  rulesAcknowledged: form.get("rules") === "on",
                  rulesVersion: edition.rules.version,
                }
              : {}),
            ...(edition.eligibility
              ? { eligibilityAcknowledged: form.get("eligibility") === "on" }
              : {}),
            configurationVersion,
            answers,
          }),
        },
      );
      if (!result.ok) {
        const data = await result.json();
        setError(data.error ?? "Your application could not be saved.");
        return;
      }
      router.push("/dashboard?submitted=1");
      router.refresh();
    } catch {
      setError(
        "Your connection was interrupted. Check your dashboard before trying again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel form-stack">
      <p>
        {tr("Applying individually as ")}
        <strong>{username}</strong>
        {tr(". Your osu! identity comes from your signed-in session.")}
      </p>
      {edition.registration?.questions.map((q) => (
        <label key={q.id} className="field">
          <span>
            {q.label}
            {q.required ? tr(" (required)") : tr(" (optional)")}
          </span>
          <textarea
            name={q.id}
            required={q.required}
            maxLength={q.maxLength}
            rows={3}
          />
        </label>
      ))}
      {edition.rules && (
        <label className="check-field">
          <input name="rules" type="checkbox" required />
          <span>
            {tr("I have read and agree to the")}{" "}
            <Link
              className="text-link"
              href={`/tournaments/${edition.slug}/rules`}
              target="_blank"
              rel="noopener"
            >
              {tr("published rules (opens a new tab)")}
            </Link>
            {tr(", version ")}
            {edition.rules.version}.
          </span>
        </label>
      )}
      {edition.eligibility && (
        <label className="check-field">
          <input name="eligibility" type="checkbox" required />
          <span>
            {tr(
              "I have read the eligibility requirements and confirm I meet them.",
            )}
          </span>
        </label>
      )}
      <p className="small muted">
        {tr(
          "Applications are reviewed by tournament staff. Submitting is not acceptance or official osu! validation. If accepted, your osu! username, osu! ID and accepted participation in this tournament appear automatically in its public Players directory. Application answers and staff review notes remain private. Read the",
        )}{" "}
        <Link href="/privacy" className="text-link">
          {tr("privacy notice")}
        </Link>{" "}
        {tr("before applying.")}
      </p>
      {error && (
        <p className="notice error-text" role="alert">
          {tr(error)}
        </p>
      )}
      <button disabled={pending} type="submit">
        {pending
          ? tr("Saving application…")
          : tr("Submit individual application")}
      </button>
    </form>
  );
}
