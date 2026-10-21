"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { localeCookie, locales } from "@/i18n/config";
import { useAppTranslations } from "@/i18n/shared";

const names = { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" };
export function LanguageControl() {
  const locale = useLocale();
  const tr = useAppTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="language-control">
      <span className="sr-only">{tr("Language")}</span>
      <select
        value={locale}
        disabled={pending}
        aria-label={tr("Language")}
        onChange={(event) => {
          document.cookie = `${localeCookie}=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          start(() => router.refresh());
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {names[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
