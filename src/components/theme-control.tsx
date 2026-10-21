"use client";
import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import { themeCookie, type Theme } from "@/lib/preferences";

export function ThemeControl({ initialTheme }: { initialTheme: Theme }) {
  const tr = useAppTranslations();

  const [theme, setTheme] = useState(initialTheme);
  return (
    <button
      type="button"
      className="secondary theme-control"
      aria-label={tr("Switch tournament to {value0} theme", {
        value0: tr(theme === "light" ? "dark" : "light"),
      })}
      title={tr("Tournament appearance: {value0}", { value0: tr(theme) })}
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        setTheme(next);
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        {theme === "light" ? (
          <path d="M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        )}
      </svg>
    </button>
  );
}
