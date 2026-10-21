import { useLocale, useTranslations } from "next-intl";
import { appTranslator } from "./translate";
export function useAppTranslations() {
  return appTranslator(useTranslations("ui"), useLocale());
}
