import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, readLocale } from "./config";

export default getRequestConfig(async () => {
  const locale = readLocale((await cookies()).get(localeCookie)?.value);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
  };
});
