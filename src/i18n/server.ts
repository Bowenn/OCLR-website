import { getLocale, getTranslations } from "next-intl/server";
import { appTranslator } from "./translate";
import { cache } from "react";
export const getAppTranslations = cache(async () => {
  return appTranslator(await getTranslations("ui"), await getLocale());
});
