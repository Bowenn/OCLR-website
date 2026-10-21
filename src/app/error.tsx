"use client";
import { useAppTranslations } from "@/i18n/shared";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const tr = useAppTranslations();

  return (
    <div className="container page" role="alert">
      <h1>{tr("Something went wrong.")}</h1>
      <p className="muted">
        {tr("Please try again. If the problem continues, return later.")}
      </p>
      <button onClick={reset}>{tr("Try again")}</button>
    </div>
  );
}
