"use client";
import { useEffect, useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import { draftOverlayUrl } from "@/lib/overlay-url";
export function ObsSourceLink({
  slug,
  origin,
}: {
  slug: string;
  origin?: string;
}) {
  const tr = useAppTranslations();
  const [url, setUrl] = useState(() =>
    origin ? draftOverlayUrl(origin, slug) : "",
  );
  const [feedback, setFeedback] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!origin) setUrl(draftOverlayUrl(location.origin, slug));
  }, [origin, slug]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback(tr("URL copied."));
    } catch {
      field.current?.focus();
      field.current?.select();
      setFeedback(tr("Copy failed. Select the URL and copy it manually."));
    }
  }
  return (
    <section className="obs-source-link">
      <label className="field">
        <span>{tr("OBS Browser Source / Overlay URL")}</span>
        <textarea
          ref={field}
          value={url}
          readOnly
          rows={2}
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={!url}
          onClick={copy}
        >
          {tr("Copy URL")}
        </button>
      </div>
      <p className="muted small" role="status">
        {feedback
          ? tr(feedback)
          : tr("Only released draft information appears in the overlay.")}
      </p>
    </section>
  );
}
